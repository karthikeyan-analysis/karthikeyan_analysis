"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.r2Bucket = exports.r2SecretAccessKey = exports.r2AccessKeyId = exports.r2AccountId = void 0;
exports.getR2Client = getR2Client;
exports.ensureR2BucketCors = ensureR2BucketCors;
exports.getPresignedUploadUrl = getPresignedUploadUrl;
exports.getPresignedDownloadUrl = getPresignedDownloadUrl;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const params_1 = require("firebase-functions/params");
exports.r2AccountId = (0, params_1.defineSecret)("R2_ACCOUNT_ID");
exports.r2AccessKeyId = (0, params_1.defineSecret)("R2_ACCESS_KEY_ID");
exports.r2SecretAccessKey = (0, params_1.defineSecret)("R2_SECRET_ACCESS_KEY");
exports.r2Bucket = (0, params_1.defineSecret)("R2_BUCKET");
function cleanString(val) {
    return (val || "")
        .replace(/%0D%0A/gi, "")
        .replace(/[\r\n\t\f\v]/g, "")
        .trim();
}
function getCleanSecret(secret, fallback = "") {
    try {
        const val = secret.value();
        if (val)
            return cleanString(val);
    }
    catch { }
    return cleanString(fallback);
}
function cleanAccessKeyId(val) {
    const s = cleanString(val).replace(/["']/g, "").trim();
    const match = s.match(/[a-f0-9]{32}/i);
    return match ? match[0] : s.substring(0, 32);
}
function cleanSecretAccessKey(val) {
    return cleanString(val).replace(/["']/g, "").trim();
}
function cleanAccountId(val) {
    const s = cleanString(val).replace(/["']/g, "").trim();
    const match = s.match(/[a-f0-9]{32}/i);
    return match ? match[0] : s;
}
function getR2Client() {
    const accountId = cleanAccountId(getCleanSecret(exports.r2AccountId));
    const accessKeyId = cleanAccessKeyId(getCleanSecret(exports.r2AccessKeyId));
    const secretAccessKey = cleanSecretAccessKey(getCleanSecret(exports.r2SecretAccessKey));
    return new client_s3_1.S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
    });
}
async function ensureR2BucketCors() {
    try {
        const client = getR2Client();
        const bucketName = cleanString(getCleanSecret(exports.r2Bucket, "kasc-live-class-recordings"));
        await client.send(new client_s3_1.PutBucketCorsCommand({
            Bucket: bucketName,
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedOrigins: ["*"],
                        AllowedMethods: ["GET", "PUT", "POST", "HEAD", "DELETE"],
                        AllowedHeaders: ["*"],
                        ExposeHeaders: ["ETag"],
                        MaxAgeSeconds: 3600,
                    },
                ],
            },
        }));
    }
    catch (err) {
        console.warn("Automated R2 Bucket CORS sync notice:", err);
    }
}
/**
 * Presigned PUT URL so the host's browser can upload a recorded class blob
 * straight to R2, without the bytes ever passing through our Cloud Functions.
 * A class-length recording comfortably fits under R2/S3's 5GB single-PUT
 * limit, so no multipart upload orchestration is needed for v1.
 */
async function getPresignedUploadUrl(key, contentType, expiresInSeconds = 3600) {
    void ensureR2BucketCors();
    const bucketName = cleanString(getCleanSecret(exports.r2Bucket, "kasc-live-class-recordings"));
    const cleanKey = cleanString(key);
    const cleanContentType = contentType?.includes("mp4") ? "video/mp4" : "video/webm";
    const commandInput = {
        Bucket: bucketName,
        Key: cleanKey,
        ContentType: cleanContentType,
    };
    const command = new client_s3_1.PutObjectCommand(commandInput);
    return (0, s3_request_presigner_1.getSignedUrl)(getR2Client(), command, { expiresIn: expiresInSeconds });
}
async function getPresignedDownloadUrl(key, expiresInSeconds, options) {
    void ensureR2BucketCors();
    const bucketName = cleanString(getCleanSecret(exports.r2Bucket, "kasc-live-class-recordings"));
    const cleanKey = cleanString(key);
    const commandInput = {
        Bucket: bucketName,
        Key: cleanKey,
        // Always tell browsers this is a video/webm so they decode it correctly
        ResponseContentType: cleanKey.endsWith(".mp4") ? "video/mp4" : "video/webm",
    };
    if (options?.disposition === "attachment" || options?.filename) {
        const safeFilename = (options.filename || "recording.webm").replace(/[^a-zA-Z0-9_\.-]/g, "_");
        commandInput.ResponseContentDisposition = `attachment; filename="${safeFilename}"`;
    }
    const command = new client_s3_1.GetObjectCommand(commandInput);
    return (0, s3_request_presigner_1.getSignedUrl)(getR2Client(), command, { expiresIn: expiresInSeconds });
}
