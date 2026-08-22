import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";

/**
 * Always requests a fresh Cloudflare R2 presigned URL from Firebase Functions.
 * Firebase Storage download URLs are NOT cross-origin streamable in <video> tags.
 * R2 presigned URLs include correct Content-Type and CORS headers for browser playback.
 */
export async function requestRecordingPlaybackUrl(
  classId: string,
  options?: { disposition?: "inline" | "attachment"; filename?: string; recordingKey?: string },
): Promise<{ url: string; expiresIn: number }> {
  const call = httpsCallable<
    { classId: string; disposition?: "inline" | "attachment"; filename?: string; recordingKey?: string },
    { url: string; expiresIn: number }
  >(functions, "getRecordingPlaybackUrl");

  const { data } = await call({
    classId,
    disposition: options?.disposition,
    filename: options?.filename,
    recordingKey: options?.recordingKey,
  });

  const cleanUrl = (data.url || "")
    .replace(/%0D%0A/gi, "")
    .replace(/[\r\n]/g, "")
    .trim();

  return { url: cleanUrl, expiresIn: data.expiresIn };
}
