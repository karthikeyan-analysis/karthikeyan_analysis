import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getPresignedUploadUrl, r2AccessKeyId, r2AccountId, r2Bucket, r2SecretAccessKey } from "./r2Client";
import { resolveCallerAccess } from "./access";

/**
 * Host/co-host only. Returns a presigned R2 PUT URL so the browser uploads the
 * client-captured recording blob straight to R2 — never through our Functions.
 * The client finalizes `recordingStatus`/`recordingKey` on the `liveClasses`
 * doc itself afterward (a plain, already-admin-privileged Firestore write),
 * since there's no third-party recording pipeline left to fire a webhook.
 */
export const getRecordingUploadUrl = onCall(
  { cors: true, secrets: [r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2Bucket] },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required");
    }
    const uid = request.auth.uid;
    const classId = (request.data?.classId as string) || "";
    const contentType = (request.data?.contentType as string) || "video/webm";
    if (!classId) throw new HttpsError("invalid-argument", "classId required");

    const db = admin.firestore();
    const classSnap = await db.collection("liveClasses").doc(classId).get();
    if (!classSnap.exists) throw new HttpsError("not-found", "Class not found");
    const cls = classSnap.data() as Record<string, any>;

    const access = await resolveCallerAccess(db, uid, cls);
    if (access.kind !== "host" && access.kind !== "co-host") {
      throw new HttpsError("permission-denied", "Only the host or co-host can upload a recording.");
    }

    const cleanContentType = contentType.includes("mp4") ? "video/mp4" : "video/webm";
    const ext = cleanContentType.includes("mp4") ? "mp4" : "webm";
    const key = `liveClasses/${classId}/${Date.now()}.${ext}`;
    const url = await getPresignedUploadUrl(key, cleanContentType);
    return { url, key };
  },
);
