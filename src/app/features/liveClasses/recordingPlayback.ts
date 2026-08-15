import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";
import { getLiveClass } from "./liveClassApi";

export async function requestRecordingPlaybackUrl(
  classId: string,
): Promise<{ url: string; expiresIn: number }> {
  try {
    const cls = await getLiveClass(classId);
    if (cls?.recordingDownloadUrl) {
      return { url: cls.recordingDownloadUrl, expiresIn: 86400 };
    }
  } catch (e) {
    console.warn("Could not fetch recordingDownloadUrl directly", e);
  }

  const call = httpsCallable<{ classId: string }, { url: string; expiresIn: number }>(
    functions,
    "getRecordingPlaybackUrl",
  );
  const { data } = await call({ classId });
  return data;
}
