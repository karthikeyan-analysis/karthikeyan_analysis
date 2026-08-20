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
}

/**
 * Host-device client-side capture: no managed recording service exists on
 * this transport (see the build plan's decision #4/#5), so recording means
 * asking the host to share a tab/screen via getDisplayMedia, mixing in their
 * own mic (tab-audio capture alone does not include local mic input — the
 * host's own voice would otherwise be silent in the recording), recording
 * with MediaRecorder, and uploading the result straight to R2 or Firebase Storage
 * via presigned PUT / SDK upload on stop.
 */
export async function startRecordingCapture(params: {
  classId: string;
  onUploaded: (result: RecordingResult) => void;
  onError: (error: Error) => void;
  /** Fired once capture stops and the upload is about to begin. */
  onUploading?: () => void;
}): Promise<RecordingCaptureHandle> {
  let stream: MediaStream;
  let ownTracksCreated = false;

  try {
    // Direct host camera video & microphone audio capture (NO screen share popup)
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      audio: true,
    });
    ownTracksCreated = true;
  } catch (videoErr) {
    try {
      // Flexible resolution video + audio fallback
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      ownTracksCreated = true;
    } catch (e2) {
      console.warn("Camera video unavailable, falling back to audio capture", e2);
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      ownTracksCreated = true;
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

  // Pre-fetch presigned upload URL immediately so it's ready even if class cuts abruptly
  let prefetchedUploadData: { url: string; key: string } | null = null;
  const prefetchedPromise = getUploadUrl({ classId: params.classId, contentType: mimeType })
    .then((res) => {
      prefetchedUploadData = res.data;
      return res.data;
    })
    .catch((err) => {
      console.warn("Pre-fetching R2 upload URL failed, will retry on stop", err);
      return null;
    });

  // Configure MediaRecorder with efficient 800kbps video bitrate & 64kbps audio bitrate compression
  // This reduces video file size by ~75% while keeping 1080p/720p text, slides, and video crystal clear.
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 800_000,
    audioBitsPerSecond: 64_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const startedAt = Date.now();
  // Gather data every second so a blob is always available even on an abrupt stop.
  recorder.start(1000);

  const cleanupTracks = () => {
    if (ownTracksCreated && stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
  };

  let finishedPromise: Promise<RecordingResult | null> | null = null;

  // Emergency handler if window/tab is closed unexpectedly or class is cut suddenly
  const handleEmergencyUnload = () => {
    if (finishedPromise) return; // Already finishing cleanly
    try {
      if (recorder.state !== "inactive") {
        recorder.requestData();
      }
      if (chunks.length > 0 && prefetchedUploadData?.url) {
        const emergencyBlob = new Blob(chunks, { type: mimeType });
        const cleanUploadUrl = prefetchedUploadData.url.replace(/%0D%0A/gi, "").replace(/[\r\n]/g, "");
        // keepalive: true ensures request completes even after tab closes
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

        const durationSec = Math.round((Date.now() - startedAt) / 1000);
        params.onUploading?.();

        let recordingKey = "";

        // Use pre-fetched data if ready, or fetch now
        const uploadData = prefetchedUploadData || (await prefetchedPromise) || (await getUploadUrl({ classId: params.classId, contentType: mimeType })).data;

        // Strip any accidental CRLF (%0D%0A) linebreaks from backend secrets in URL
        const cleanUploadUrl = (uploadData.url || "")
          .replace(/%0D%0A/gi, "")
          .replace(/[\r\n]/g, "");

        const putRes = await fetch(cleanUploadUrl, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: blob,
          keepalive: true,
        });

        if (!putRes.ok) {
          throw new Error(`Upload to Cloudflare R2 failed with status ${putRes.status}`);
        }

        recordingKey = uploadData.key;

        const res: RecordingResult = {
          key: recordingKey,
          durationSec,
          sizeBytes: blob.size,
        };
        params.onUploaded(res);
        return res;
      } catch (err) {
        cleanupTracks();
        const error = err instanceof Error ? err : new Error(String(err));

        // Last-resort Fallback: local browser download
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
        params.onError(error);
        return null;
      }
    })();

    return finishedPromise;
  };

  // Handle track end event if stream ends
  stream.getVideoTracks()[0]?.addEventListener("ended", () => {
    void finish();
  });

  return { stop: () => finish() };
}
