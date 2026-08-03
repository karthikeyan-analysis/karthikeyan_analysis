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
function getR2Client() {
    return new client_s3_1.S3Client({
        region: "auto",
        endpoint: `https://${exports.r2AccountId.value()}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: exports.r2AccessKeyId.value(),
            secretAccessKey: exports.r2SecretAccessKey.value(),
        },
    });
}
/**
 * Presigned PUT URL so the host's browser can upload a recorded class blob
 * straight to R2, without the bytes ever passing through our Cloud Functions.
 * A class-length recording comfortably fits under R2/S3's 5GB single-PUT
 * limit, so no multipart upload orchestration is needed for v1.
 */
async function getPresignedUploadUrl(key, contentType, expiresInSeconds = 3600) {
    const command = new client_s3_1.PutObjectCommand({ Bucket: exports.r2Bucket.value(), Key: key, ContentType: contentType });
    return (0, s3_request_presigner_1.getSignedUrl)(getR2Client(), command, { expiresIn: expiresInSeconds });
}
async function getPresignedDownloadUrl(key, expiresInSeconds) {
    const command = new client_s3_1.GetObjectCommand({ Bucket: exports.r2Bucket.value(), Key: key });
    return (0, s3_request_presigner_1.getSignedUrl)(getR2Client(), command, { expiresIn: expiresInSeconds });
}
