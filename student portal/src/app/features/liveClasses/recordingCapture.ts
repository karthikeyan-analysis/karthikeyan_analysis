import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { functions, storage } from "../../../config/firebase";

export interface RecordingResult {
  key: string;
  durationSec: number;
  sizeBytes: number;
  downloadUrl?: string;
}

export interface RecordingCaptureHandle {
  /** Explicitly stop and upload. Returns a promise resolving when upload completes. */
  stop: () => Promise<RecordingResult | null>;
  /** Dynamically switch or mute the video track (e.g., when toggling camera or screenshare mid-recording) */
  updateVideoTrack?: (newTrack: MediaStreamTrack | null) => void;
  /** Dynamically update the audio track */
  updateAudioTrack?: (newTrack: MediaStreamTrack | null) => void;
}

/**
 * Host & Co-Host client-side capture with screen share + mic audio mixing,
 * multi-tier cloud upload to Cloudflare R2 with fast timeout and fail-safe fallback to Firebase Storage.
 */
export async function startRecordingCapture(params: {
  classId: string;
  className?: string;
  onUploaded: (result: RecordingResult) => void;
  onError: (error: Error) => void;
  /** Fired once capture stops and the upload is about to begin. */
  onUploading?: () => void;
  /** Initial video track if screenshare or camera is already active */
  initialVideoTrack?: MediaStreamTrack | null;
  /** Initial audio track (mic) */
  initialAudioTrack?: MediaStreamTrack | null;
}): Promise<RecordingCaptureHandle> {
  const tracksToStop: MediaStreamTrack[] = [];
  let stream: MediaStream;

  // 1. Build initial 30FPS Canvas Video Stream Compositor for guaranteed video keyframes
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");

  const videoElement = document.createElement("video");
  videoElement.autoplay = true;
  videoElement.muted = true;
  videoElement.playsInline = true;

  let currentVideoTrack: MediaStreamTrack | null =
    params.initialVideoTrack || null;
  if (currentVideoTrack && currentVideoTrack.readyState === "live") {
    videoElement.srcObject = new MediaStream([currentVideoTrack]);
    void videoElement.play().catch(() => {});
  } else {
    currentVideoTrack = null;
    videoElement.srcObject = null;
  }

  let animFrameId: number | null = null;
  const renderFrame = () => {
    if (ctx) {
      const isVideoActive =
        Boolean(currentVideoTrack) &&
        currentVideoTrack!.readyState === "live" &&
        currentVideoTrack!.enabled !== false &&
        videoElement.srcObject !== null &&
        videoElement.readyState >= 2 &&
        videoElement.videoWidth > 0;

      if (isVideoActive) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, 1280, 720);
        ctx.drawImage(videoElement, 0, 0, 1280, 720);
      } else {
        // Render branded audio-only / video muted standby screen
        const grad = ctx.createLinearGradient(0, 0, 1280, 720);
        grad.addColorStop(0, "#090d16");
        grad.addColorStop(0.5, "#1e1b4b");
        grad.addColorStop(1, "#0f172a");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1280, 720);

        // Center card
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        if (typeof (ctx as any).roundRect === "function") {
          ctx.beginPath();
          (ctx as any).roundRect(400, 200, 480, 320, 24);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(400, 200, 480, 320);
        }

        // Icon circle
        ctx.fillStyle = "rgba(99, 102, 241, 0.15)";
        ctx.beginPath();
        ctx.arc(640, 290, 40, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#818cf8";
        ctx.font = "bold 26px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🎙️", 640, 300);

        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText("Live Class Audio Session", 640, 370);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px sans-serif";
        ctx.fillText("Host video is currently paused", 640, 405);

        if (params.className) {
          ctx.fillStyle = "#a5b4fc";
          ctx.font = "bold 15px sans-serif";
          ctx.fillText(params.className, 640, 455);
        }
      }
    }
    animFrameId = requestAnimationFrame(renderFrame);
  };
  renderFrame();

  const canvasStream = canvas.captureStream(30);
  if (params.initialAudioTrack) {
    canvasStream.addTrack(params.initialAudioTrack);
  }

  stream = canvasStream;

  const mimeType =
    [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";

  const getUploadUrl = httpsCallable<
    { classId: string; contentType: string },
    { url: string; key: string }
  >(functions, "getRecordingUploadUrl");

  let prefetchedUploadData: { url: string; key: string } | null = null;
  const prefetchedPromise = getUploadUrl({
    classId: params.classId,
    contentType: mimeType,
  })
    .then((res) => {
      prefetchedUploadData = res.data;
      return res.data;
    })
    .catch((err) => {
      console.warn(
        "Pre-fetching R2 upload URL failed, will fallback on stop",
        err,
      );
      return null;
    });

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 1_000_000,
    audioBitsPerSecond: 96_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const startedAt = Date.now();
  recorder.start(1000);

  const cleanupTracks = () => {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    try {
      videoElement.pause();
      videoElement.srcObject = null;
    } catch {}
    tracksToStop.forEach((t) => {
      try {
        t.stop();
      } catch {}
    });
  };

  let finishedPromise: Promise<RecordingResult | null> | null = null;

  const handleEmergencyUnload = () => {
    if (finishedPromise) return;
    try {
      if (recorder.state !== "inactive") {
        recorder.requestData();
      }
      if (chunks.length > 0 && prefetchedUploadData?.url) {
        const emergencyBlob = new Blob(chunks, { type: mimeType });
        const cleanUploadUrl = prefetchedUploadData.url
          .replace(/%0D%0A/gi, "")
          .replace(/[\r\n]/g, "");
        void fetch(cleanUploadUrl, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: emergencyBlob,
          keepalive: true,
        });
      }
    } catch (e) {
      console.error("Emergency unload upload failed", e);
    }
  };

  window.addEventListener("beforeunload", handleEmergencyUnload);
  window.addEventListener("pagehide", handleEmergencyUnload);

  const finish = (): Promise<RecordingResult | null> => {
    if (finishedPromise) return finishedPromise;

    finishedPromise = (async () => {
      window.removeEventListener("beforeunload", handleEmergencyUnload);
      window.removeEventListener("pagehide", handleEmergencyUnload);

      try {
        const blob = await new Promise<Blob>((resolve) => {
          if (recorder.state === "inactive") {
            resolve(new Blob(chunks, { type: mimeType }));
            return;
          }
          let resolved = false;
          const done = () => {
            if (!resolved) {
              resolved = true;
              resolve(new Blob(chunks, { type: mimeType }));
            }
          };
          recorder.onstop = done;
          setTimeout(done, 500);
          try {
            recorder.stop();
          } catch {
            done();
          }
        });
        cleanupTracks();

        const durationSec = Math.max(
          1,
          Math.round((Date.now() - startedAt) / 1000),
        );
        params.onUploading?.();

        const recordingKey = `recordings/${params.classId}/rec_${Date.now()}.webm`;

        let downloadUrl: string | undefined = undefined;
        let r2Key: string | undefined = undefined;

        // Tier 1: Cloudflare R2 Upload
        try {
          let uploadData: any = prefetchedUploadData;
          if (!uploadData) {
            try {
              const res = await getUploadUrl({
                classId: params.classId,
                contentType: mimeType,
              });
              uploadData = res.data;
            } catch (getErr) {
              console.warn("R2 presigned upload URL notice:", getErr);
            }
          }

          if (uploadData?.url) {
            const cleanUploadUrl = (uploadData.url || "")
              .replace(/%0D%0A/gi, "")
              .replace(/[\r\n]/g, "");

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000);

            try {
              const cleanHeaderContentType = mimeType.includes("mp4")
                ? "video/mp4"
                : "video/webm";
              const putRes = await fetch(cleanUploadUrl, {
                method: "PUT",
                headers: { "Content-Type": cleanHeaderContentType },
                body: blob,
                signal: controller.signal,
              });
              clearTimeout(timeoutId);

              if (putRes.ok) {
                r2Key = uploadData.key;
              }
            } catch (putErr) {
              clearTimeout(timeoutId);
              console.warn("Cloudflare R2 PUT fetch notice:", putErr);
            }
          }
        } catch (r2Err) {
          console.warn("Cloudflare R2 upload notice:", r2Err);
        }

        // Firebase Cloud Storage Upload for instant HTML5 video streaming URL
        try {
          const storageRef = ref(storage, recordingKey);
          const uploadSnap = await uploadBytes(storageRef, blob, {
            contentType: mimeType,
          });
          downloadUrl = await getDownloadURL(uploadSnap.ref);
        } catch (storageErr) {
          console.warn("Firebase Storage upload notice:", storageErr);
        }

        // Tier 3 Emergency Fallback: Browser Direct Download if all cloud uploads fail
        if (!r2Key && !downloadUrl && chunks.length > 0) {
          try {
            const fallbackBlob = new Blob(chunks, { type: mimeType });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(fallbackBlob);
            a.download = `live-class-${params.classId}-${Date.now()}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          } catch (e) {
            console.error("Local fallback download failed", e);
          }
        }

        const finalResult: RecordingResult = {
          key: r2Key || recordingKey,
          durationSec,
          sizeBytes: blob.size,
          ...(downloadUrl ? { downloadUrl } : {}),
        };
        params.onUploaded(finalResult);
        return finalResult;
      } catch (err) {
        cleanupTracks();
        const error = err instanceof Error ? err : new Error(String(err));
        params.onError(error);
        return null;
      }
    })();

    return finishedPromise;
  };

  const updateVideoTrack = (newTrack: MediaStreamTrack | null) => {
    try {
      currentVideoTrack = newTrack;
      if (newTrack && newTrack.readyState === "live") {
        videoElement.srcObject = new MediaStream([newTrack]);
        void videoElement.play().catch(() => {});
      } else {
        videoElement.pause();
        videoElement.srcObject = null;
      }
    } catch (err) {
      console.warn("Could not dynamically update recording video track", err);
    }
  };

  const updateAudioTrack = (newTrack: MediaStreamTrack | null) => {
    try {
      if (newTrack && newTrack.readyState === "live") {
        canvasStream
          .getAudioTracks()
          .forEach((t) => canvasStream.removeTrack(t));
        canvasStream.addTrack(newTrack);
      }
    } catch (err) {
      console.warn("Could not dynamically update recording audio track", err);
    }
  };

  stream.getVideoTracks()[0]?.addEventListener("ended", () => {
    void finish();
  });

  return {
    stop: () => finish(),
    updateVideoTrack,
    updateAudioTrack,
  };
}
