import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";
import { getLiveClass } from "./liveClassApi";

export async function requestRecordingPlaybackUrl(
  classId: string,
  options?: { disposition?: "inline" | "attachment"; filename?: string; recordingKey?: string },
): Promise<{ url: string; expiresIn: number }> {
  try {
    const cls = await getLiveClass(classId);
    if (cls?.recordingDownloadUrl && options?.disposition !== "attachment" && (!options?.recordingKey || options.recordingKey === cls.recordingKey)) {
      return { url: cls.recordingDownloadUrl, expiresIn: 86400 };
    }
  } catch (e) {
    console.warn("Could not fetch recordingDownloadUrl directly", e);
  }

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
