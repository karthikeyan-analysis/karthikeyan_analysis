import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";

export interface RecordingResult {
  key: string;
  durationSec: number;
  sizeBytes: number;
}

export interface RecordingCaptureHandle {
  /** Explicitly stop and upload. Also fires automatically if the host uses the
   *  browser's native "Stop sharing" control instead of this. */
  stop: () => void;
}

/**
 * Host-device client-side capture: no managed recording service exists on
 * this transport (see the build plan's decision #4/#5), so recording means
 * asking the host to share a tab/screen via getDisplayMedia, mixing in their
 * own mic (tab-audio capture alone does not include local mic input — the
 * host's own voice would otherwise be silent in the recording), recording
 * with MediaRecorder, and uploading the result straight to R2 via a
 * presigned PUT URL on stop.
 */
export async function startRecordingCapture(params: {
  classId: string;
  onUploaded: (result: RecordingResult) => void;
  onError: (error: Error) => void;
  /** Fired once capture stops and the R2 upload is about to begin. */
  onUploading?: () => void;
}): Promise<RecordingCaptureHandle> {
  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30 },
    audio: true,
  });

  let micStream: MediaStream | null = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    // Continue without mic audio rather than fail the whole recording — a
    // recording missing host narration is still better than none at all.
  }

  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();

  const displayAudioTracks = displayStream.getAudioTracks();
  if (displayAudioTracks.length) {
    audioContext.createMediaStreamSource(new MediaStream(displayAudioTracks)).connect(destination);
  }
  if (micStream) {
    audioContext.createMediaStreamSource(micStream).connect(destination);
  }

  const combined = new MediaStream([
    ...displayStream.getVideoTracks(),
    ...destination.stream.getAudioTracks(),
  ]);

  const mimeType =
    ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((t) =>
      MediaRecorder.isTypeSupported(t),
    ) || "video/webm";

  const recorder = new MediaRecorder(combined, { mimeType });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const startedAt = Date.now();
  // Gather data every second so a blob is always available even on an abrupt stop.
  recorder.start(1000);

  const cleanupTracks = () => {
    displayStream.getTracks().forEach((t) => t.stop());
    micStream?.getTracks().forEach((t) => t.stop());
    void audioContext.close().catch(() => {});
  };

  let finished = false;
  const finish = async () => {
    if (finished) return;
    finished = true;
    try {
      const blob = await new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        if (recorder.state !== "inactive") recorder.stop();
      });
      cleanupTracks();

      const durationSec = Math.round((Date.now() - startedAt) / 1000);
      params.onUploading?.();

      const getUploadUrl = httpsCallable<{ classId: string; contentType: string }, { url: string; key: string }>(
        functions,
        "getRecordingUploadUrl",
      );
      const { data } = await getUploadUrl({ classId: params.classId, contentType: mimeType });

      const putRes = await fetch(data.url, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: blob,
      });
      if (!putRes.ok) {
        throw new Error(`Upload to R2 failed (status ${putRes.status})`);
      }

      params.onUploaded({ key: data.key, durationSec, sizeBytes: blob.size });
    } catch (err) {
      cleanupTracks();
      params.onError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Host clicked the browser's native "Stop sharing" instead of our button.
  displayStream.getVideoTracks()[0]?.addEventListener("ended", () => void finish());

  return { stop: () => void finish() };
}
