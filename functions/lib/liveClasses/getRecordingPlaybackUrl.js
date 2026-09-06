"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecordingPlaybackUrl = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const r2Client_1 = require("./r2Client");
const access_1 = require("./access");
const PLAYBACK_URL_TTL_SECONDS = 2 * 60 * 60; // 2 hours
/**
 * Returns true if the stored key is a Firebase Cloud Storage path
 * (Tier 2 fallback — the video only exists in Firebase Storage, NOT in R2).
 * R2 keys always start with "liveClasses/" e.g. "liveClasses/{classId}/{timestamp}.webm"
 * Firebase Storage fallback keys start with "recordings/" e.g. "recordings/{classId}/rec_{ts}.webm"
 */
function isFirebaseStorageKey(key) {
    return key.startsWith("recordings/") || key.startsWith("gs://");
}
exports.getRecordingPlaybackUrl = (0, https_1.onCall)({ cors: true, secrets: [r2Client_1.r2AccountId, r2Client_1.r2AccessKeyId, r2Client_1.r2SecretAccessKey, r2Client_1.r2Bucket] }, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Login required");
    }
    const uid = request.auth.uid;
    const classId = request.data?.classId || "";
    if (!classId)
        throw new https_1.HttpsError("invalid-argument", "classId required");
    const db = admin.firestore();
    const classSnap = await db.collection("liveClasses").doc(classId).get();
    if (!classSnap.exists)
        throw new https_1.HttpsError("not-found", "Class not found");
    const cls = classSnap.data();
    let recordingKey = request.data?.recordingKey || cls.recordingKey;
    if (!recordingKey && Array.isArray(cls.recordings) && cls.recordings.length > 0) {
        recordingKey = cls.recordings[0]?.key || cls.recordings[0]?.recordingKey;
    }
    if (!recordingKey) {
        throw new https_1.HttpsError("failed-precondition", "Recording is not ready yet.");
    }
    const access = await (0, access_1.resolveCallerAccess)(db, uid, cls);
    if (access.kind === "denied") {
        throw new https_1.HttpsError("permission-denied", access.reason);
    }
    // host / co-host / admin / enrolled student may all view the recording.
    const disposition = request.data?.disposition || "inline";
    const filename = request.data?.filename || "";
    // ── DUAL-PATH: Firebase Storage (old) vs Cloudflare R2 (new) ──────────────
    if (isFirebaseStorageKey(recordingKey)) {
        // This recording only exists in Firebase Storage (R2 upload had failed at time of recording).
        // Use Firebase Admin SDK to generate a signed download URL.
        try {
            const bucket = admin.storage().bucket();
            const file = bucket.file(recordingKey);
            const [exists] = await file.exists();
            if (!exists) {
                throw new https_1.HttpsError("not-found", "Recording file not found in storage.");
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
        }
        catch (err) {
            if (err instanceof https_1.HttpsError)
                throw err;
            console.error("Firebase Storage signed URL error:", err);
            throw new https_1.HttpsError("internal", "Could not generate playback URL.");
        }
    }
    // ── Cloudflare R2 path (standard, recordings uploaded to R2) ──────────────
    const url = await (0, r2Client_1.getPresignedDownloadUrl)(recordingKey, PLAYBACK_URL_TTL_SECONDS, {
        disposition,
        filename,
    });
    return { url, expiresIn: PLAYBACK_URL_TTL_SECONDS };
});
