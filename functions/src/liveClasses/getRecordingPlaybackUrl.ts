import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getPresignedDownloadUrl, r2AccessKeyId, r2AccountId, r2Bucket, r2SecretAccessKey } from "./r2Client";
import { resolveCallerAccess } from "./access";

const PLAYBACK_URL_TTL_SECONDS = 2 * 60 * 60; // 2 hours

/**
 * Returns true if the stored key is a Firebase Cloud Storage path
 * (Tier 2 fallback — the video only exists in Firebase Storage, NOT in R2).
 * R2 keys always start with "liveClasses/" e.g. "liveClasses/{classId}/{timestamp}.webm"
 * Firebase Storage fallback keys start with "recordings/" e.g. "recordings/{classId}/rec_{ts}.webm"
 */
function isFirebaseStorageKey(key: string): boolean {
  return key.startsWith("recordings/") || key.startsWith("gs://");
}

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

    // ── DUAL-PATH: Firebase Storage (old) vs Cloudflare R2 (new) ──────────────
    if (isFirebaseStorageKey(recordingKey)) {
      // This recording only exists in Firebase Storage (R2 upload had failed at time of recording).
      // Use Firebase Admin SDK to generate a signed download URL.
      try {
        const bucket = admin.storage().bucket();
        const file = bucket.file(recordingKey);
        const [exists] = await file.exists();
        if (!exists) {
          throw new HttpsError("not-found", "Recording file not found in storage.");
        }
        // Generate a 2-hour signed URL from Firebase Storage
        const [signedUrl] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + PLAYBACK_URL_TTL_SECONDS * 1000,
          ...(disposition === "attachment" && filename
            ? { responseDisposition: `attachment; filename="${filename}"` }
            : {}),
        });
        return { url: signedUrl, expiresIn: PLAYBACK_URL_TTL_SECONDS };
      } catch (err: any) {
        if (err instanceof HttpsError) throw err;
        console.error("Firebase Storage signed URL error:", err);
        throw new HttpsError("internal", "Could not generate playback URL.");
      }
    }

    // ── Cloudflare R2 path (standard, recordings uploaded to R2) ──────────────
    const url = await getPresignedDownloadUrl(recordingKey, PLAYBACK_URL_TTL_SECONDS, {
      disposition,
      filename,
    });
    return { url, expiresIn: PLAYBACK_URL_TTL_SECONDS };
  },
);

