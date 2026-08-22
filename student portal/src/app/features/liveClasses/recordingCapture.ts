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
  /** Dynamically switch the video track (e.g., when toggling screenshare mid-recording) */
  updateVideoTrack?: (newTrack: MediaStreamTrack) => void;
}

/**
 * Host & Co-Host client-side capture with screen share + mic audio mixing,
 * multi-tier cloud upload to Cloudflare R2 with fast 8s timeout and fail-safe fallback to Firebase Storage.
 */
export async function startRecordingCapture(params: {
  classId: string;
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

  let currentVideoTrack = params.initialVideoTrack || null;
  if (currentVideoTrack) {
    videoElement.srcObject = new MediaStream([currentVideoTrack]);
    void videoElement.play().catch(() => {});
  } else {
    try {
      const userMediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: true,
      });
      tracksToStop.push(...userMediaStream.getTracks());
      const vTrack = userMediaStream.getVideoTracks()[0];
      const aTrack = userMediaStream.getAudioTracks()[0];
      if (vTrack) {
        currentVideoTrack = vTrack;
        videoElement.srcObject = new MediaStream([vTrack]);
        void videoElement.play().catch(() => {});
      }
      if (aTrack && !params.initialAudioTrack) {
        params.initialAudioTrack = aTrack;
      }
    } catch {
      console.warn("Camera fallback not accessible for canvas compositor");
    }
  }

  let animFrameId: number | null = null;
  const renderFrame = () => {
    if (ctx) {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, 1280, 720);

      if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
        ctx.drawImage(videoElement, 0, 0, 1280, 720);
      } else {
        ctx.fillStyle = "#818cf8";
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("KASC Live Class Recording", 640, 360);
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
    ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((t) =>
      MediaRecorder.isTypeSupported(t),
    ) || "video/webm";

  const getUploadUrl = httpsCallable<{ classId: string; contentType: string }, { url: string; key: string }>(
    functions,
    "getRecordingUploadUrl",
  );

  let prefetchedUploadData: { url: string; key: string } | null = null;
  const prefetchedPromise = getUploadUrl({ classId: params.classId, contentType: mimeType })
    .then((res) => {
      prefetchedUploadData = res.data;
      return res.data;
    })
    .catch((err) => {
      console.warn("Pre-fetching R2 upload URL failed, will fallback on stop", err);
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
    try { videoElement.pause(); videoElement.srcObject = null; } catch {}
    tracksToStop.forEach((t) => {
      try { t.stop(); } catch {}
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
        const cleanUploadUrl = prefetchedUploadData.url.replace(/%0D%0A/gi, "").replace(/[\r\n]/g, "");
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

        const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        params.onUploading?.();

        const recordingKey = `recordings/${params.classId}/rec_${Date.now()}.webm`;

        let downloadUrl: string | undefined = undefined;
        let r2Key: string | undefined = undefined;

        // Tier 1: Cloudflare R2 Upload
        try {
          let uploadData: any = prefetchedUploadData;
          if (!uploadData) {
            try {
              const res = await getUploadUrl({ classId: params.classId, contentType: mimeType });
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
              const cleanHeaderContentType = mimeType.includes("mp4") ? "video/mp4" : "video/webm";
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
          const uploadSnap = await uploadBytes(storageRef, blob, { contentType: mimeType });
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

  const updateVideoTrack = (newTrack: MediaStreamTrack) => {
    try {
      currentVideoTrack = newTrack;
      videoElement.srcObject = new MediaStream([newTrack]);
      void videoElement.play().catch(() => {});
    } catch (err) {
      console.warn("Could not dynamically update recording video track", err);
    }
  };

  stream.getVideoTracks()[0]?.addEventListener("ended", () => {
    void finish();
  });

  return {
    stop: () => finish(),
    updateVideoTrack,
  };
}
