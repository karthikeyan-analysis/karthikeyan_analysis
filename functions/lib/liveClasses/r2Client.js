"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.r2Bucket = exports.r2SecretAccessKey = exports.r2AccessKeyId = exports.r2AccountId = void 0;
exports.getR2Client = getR2Client;
exports.getPresignedUploadUrl = getPresignedUploadUrl;
exports.getPresignedDownloadUrl = getPresignedDownloadUrl;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const params_1 = require("firebase-functions/params");
exports.r2AccountId = (0, params_1.defineSecret)("R2_ACCOUNT_ID");
exports.r2AccessKeyId = (0, params_1.defineSecret)("R2_ACCESS_KEY_ID");
exports.r2SecretAccessKey = (0, params_1.defineSecret)("R2_SECRET_ACCESS_KEY");
exports.r2Bucket = (0, params_1.defineSecret)("R2_BUCKET");
function getCleanSecret(secret, fallback = "") {
    try {
        const val = secret.value();
        if (val)
            return val.trim().replace(/[\r\n]/g, "");
    }
    catch { }
    return fallback;
}
function getR2Client() {
    return new client_s3_1.S3Client({
        region: "auto",
        endpoint: `https://${getCleanSecret(exports.r2AccountId)}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: getCleanSecret(exports.r2AccessKeyId),
            secretAccessKey: getCleanSecret(exports.r2SecretAccessKey),
        },
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
    });
}
/**
 * Presigned PUT URL so the host's browser can upload a recorded class blob
 * straight to R2, without the bytes ever passing through our Cloud Functions.
 * A class-length recording comfortably fits under R2/S3's 5GB single-PUT
 * limit, so no multipart upload orchestration is needed for v1.
 */
async function getPresignedUploadUrl(key, _contentType, expiresInSeconds = 3600) {
    const bucketName = getCleanSecret(exports.r2Bucket, "kasc-live-class-recordings");
    const cleanKey = key.trim().replace(/[\r\n]/g, "");
    const command = new client_s3_1.PutObjectCommand({ Bucket: bucketName, Key: cleanKey });
    return (0, s3_request_presigner_1.getSignedUrl)(getR2Client(), command, { expiresIn: expiresInSeconds });
}
async function getPresignedDownloadUrl(key, expiresInSeconds) {
    const bucketName = getCleanSecret(exports.r2Bucket, "kasc-live-class-recordings");
    const cleanKey = key.trim().replace(/[\r\n]/g, "");
    const command = new client_s3_1.GetObjectCommand({ Bucket: bucketName, Key: cleanKey });
    return (0, s3_request_presigner_1.getSignedUrl)(getR2Client(), command, { expiresIn: expiresInSeconds });
}
