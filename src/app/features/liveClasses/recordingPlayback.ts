import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";

/**
 * Always requests a fresh Cloudflare R2 presigned URL from Firebase Functions.
 * Firebase Storage download URLs are NOT cross-origin streamable in <video> tags.
 * R2 presigned URLs include correct Content-Type and CORS headers for browser playback.
 *
 * Throws a descriptive error if the function returns an empty URL so callers
 * can distinguish "no recording exists" from a network failure.
 */
export async function requestRecordingPlaybackUrl(
  classId: string,
  options?: {
    disposition?: "inline" | "attachment";
    filename?: string;
    recordingKey?: string;
  },
): Promise<{ url: string; expiresIn: number }> {
  if (!classId) {
    throw new Error("requestRecordingPlaybackUrl: classId is required.");
  }

  const call = httpsCallable<
    {
      classId: string;
      disposition?: "inline" | "attachment";
      filename?: string;
      recordingKey?: string;
    },
    { url: string; expiresIn: number }
  >(functions, "getRecordingPlaybackUrl");

  const { data } = await call({
    classId,
    disposition: options?.disposition,
    filename: options?.filename,
    recordingKey: options?.recordingKey ?? undefined,
  });

  if (!data || !data.url) {
    throw new Error(
      "Recording is not yet available or has been removed. The server returned no playback URL.",
    );
  }

  const cleanUrl = data.url
    .replace(/%0D%0A/gi, "")
    .replace(/[\r\n]/g, "")
    .trim();

  if (!cleanUrl) {
    throw new Error("Recording playback URL is empty after sanitization.");
  }

  return { url: cleanUrl, expiresIn: data.expiresIn ?? 7200 };
}
