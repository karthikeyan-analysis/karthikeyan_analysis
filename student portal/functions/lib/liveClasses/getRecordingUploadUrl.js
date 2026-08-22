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
exports.getRecordingUploadUrl = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const r2Client_1 = require("./r2Client");
const access_1 = require("./access");
/**
 * Host/co-host only. Returns a presigned R2 PUT URL so the browser uploads the
 * client-captured recording blob straight to R2 — never through our Functions.
 * The client finalizes `recordingStatus`/`recordingKey` on the `liveClasses`
 * doc itself afterward (a plain, already-admin-privileged Firestore write),
 * since there's no third-party recording pipeline left to fire a webhook.
 */
exports.getRecordingUploadUrl = (0, https_1.onCall)({ cors: true, secrets: [r2Client_1.r2AccountId, r2Client_1.r2AccessKeyId, r2Client_1.r2SecretAccessKey, r2Client_1.r2Bucket] }, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Login required");
    }
    const uid = request.auth.uid;
    const classId = request.data?.classId || "";
    const contentType = request.data?.contentType || "video/webm";
    if (!classId)
        throw new https_1.HttpsError("invalid-argument", "classId required");
    const db = admin.firestore();
    const classSnap = await db.collection("liveClasses").doc(classId).get();
    if (!classSnap.exists)
        throw new https_1.HttpsError("not-found", "Class not found");
    const cls = classSnap.data();
    const access = await (0, access_1.resolveCallerAccess)(db, uid, cls);
    if (access.kind !== "host" && access.kind !== "co-host") {
        throw new https_1.HttpsError("permission-denied", "Only the host or co-host can upload a recording.");
    }
    const cleanContentType = contentType.includes("mp4") ? "video/mp4" : "video/webm";
    const ext = cleanContentType.includes("mp4") ? "mp4" : "webm";
    const key = `liveClasses/${classId}/${Date.now()}.${ext}`;
    const url = await (0, r2Client_1.getPresignedUploadUrl)(key, cleanContentType);
    return { url, key };
});
