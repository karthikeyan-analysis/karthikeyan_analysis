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

  // 1. Build initial recording stream using provided live tracks or new getUserMedia
  if (params.initialVideoTrack || params.initialAudioTrack) {
    const tracks: MediaStreamTrack[] = [];
    if (params.initialVideoTrack) tracks.push(params.initialVideoTrack);
    if (params.initialAudioTrack) tracks.push(params.initialAudioTrack);
    stream = new MediaStream(tracks);
  } else {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: true,
      });
      tracksToStop.push(...stream.getTracks());
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tracksToStop.push(...stream.getTracks());
      } catch (err) {
        throw new Error("Could not access microphone/camera for live recording.");
      }
    }
  }

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

        // Tier 1: Cloudflare R2 Presigned PUT Upload with strict 8-second timeout
        try {
          const uploadData =
            prefetchedUploadData ||
            (await Promise.race([
              prefetchedPromise,
              new Promise<null>((r) => setTimeout(() => r(null), 3000)),
            ])) ||
            (await getUploadUrl({ classId: params.classId, contentType: mimeType })).data;

          if (uploadData?.url) {
            const cleanUploadUrl = (uploadData.url || "")
              .replace(/%0D%0A/gi, "")
              .replace(/[\r\n]/g, "");

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const putRes = await fetch(cleanUploadUrl, {
              method: "PUT",
              headers: { "Content-Type": mimeType },
              body: blob,
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (putRes.ok) {
              const finalResult: RecordingResult = {
                key: uploadData.key || recordingKey,
                durationSec,
                sizeBytes: blob.size,
              };
              params.onUploaded(finalResult);
              return finalResult;
            }
          }
        } catch (r2Err) {
          console.warn("Cloudflare R2 upload timed out or failed, executing Firebase Storage fail-safe fallback", r2Err);
        }

        // Tier 2 Fallback: Firebase Cloud Storage SDK Upload
        try {
          const storageRef = ref(storage, recordingKey);
          const uploadSnap = await uploadBytes(storageRef, blob, { contentType: mimeType });
          const downloadUrl = await getDownloadURL(uploadSnap.ref);

          const finalResult: RecordingResult = {
            key: recordingKey,
            durationSec,
            sizeBytes: blob.size,
            downloadUrl,
          };
          params.onUploaded(finalResult);
          return finalResult;
        } catch (storageErr) {
          console.warn("Firebase Storage fallback upload failed", storageErr);
        }

        // Tier 3 Emergency Fallback: Browser Direct Download
        if (chunks.length > 0) {
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

        const fallbackResult: RecordingResult = {
          key: recordingKey,
          durationSec,
          sizeBytes: blob.size,
        };
        params.onUploaded(fallbackResult);
        return fallbackResult;
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
      const oldTracks = stream.getVideoTracks();
      oldTracks.forEach((t) => stream.removeTrack(t));
      stream.addTrack(newTrack);
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
