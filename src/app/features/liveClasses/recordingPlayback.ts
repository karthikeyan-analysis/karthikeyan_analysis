import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";

export async function requestRecordingPlaybackUrl(
  classId: string,
): Promise<{ url: string; expiresIn: number }> {
  const call = httpsCallable<{ classId: string }, { url: string; expiresIn: number }>(
    functions,
    "getRecordingPlaybackUrl",
  );
  const { data } = await call({ classId });
  return data;
}
