import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getPresignedDownloadUrl, r2AccessKeyId, r2AccountId, r2Bucket, r2SecretAccessKey } from "./r2Client";
import { resolveCallerAccess } from "./access";

const PLAYBACK_URL_TTL_SECONDS = 2 * 60 * 60; // 2 hours

export const getRecordingPlaybackUrl = onCall(
  { cors: true, secrets: [r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2Bucket] },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required");
    }
    const uid = request.auth.uid;
    const classId = (request.data?.classId as string) || "";
    if (!classId) throw new HttpsError("invalid-argument", "classId required");

    const db = admin.firestore();
    const classSnap = await db.collection("liveClasses").doc(classId).get();
    if (!classSnap.exists) throw new HttpsError("not-found", "Class not found");
    const cls = classSnap.data() as Record<string, any>;

    let recordingKey = (request.data?.recordingKey as string) || cls.recordingKey;

    if (!recordingKey && Array.isArray(cls.recordings) && cls.recordings.length > 0) {
      recordingKey = cls.recordings[0]?.key || cls.recordings[0]?.recordingKey;
    }

    if (!recordingKey) {
      throw new HttpsError("failed-precondition", "Recording is not ready yet.");
    }

    const access = await resolveCallerAccess(db, uid, cls);
    if (access.kind === "denied") {
      throw new HttpsError("permission-denied", access.reason);
    }
    // host / co-host / admin / enrolled student may all view the recording.

    const disposition = (request.data?.disposition as "inline" | "attachment") || "inline";
    const filename = (request.data?.filename as string) || "";

    const url = await getPresignedDownloadUrl(recordingKey, PLAYBACK_URL_TTL_SECONDS, {
      disposition,
      filename,
    });
    return { url, expiresIn: PLAYBACK_URL_TTL_SECONDS };
  },
);
