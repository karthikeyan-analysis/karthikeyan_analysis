import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { defineSecret } from "firebase-functions/params";

export const r2AccountId = defineSecret("R2_ACCOUNT_ID");
export const r2AccessKeyId = defineSecret("R2_ACCESS_KEY_ID");
export const r2SecretAccessKey = defineSecret("R2_SECRET_ACCESS_KEY");
export const r2Bucket = defineSecret("R2_BUCKET");

export function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${r2AccountId.value()}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKeyId.value(),
      secretAccessKey: r2SecretAccessKey.value(),
    },
  });
}

/**
 * Presigned PUT URL so the host's browser can upload a recorded class blob
 * straight to R2, without the bytes ever passing through our Cloud Functions.
 * A class-length recording comfortably fits under R2/S3's 5GB single-PUT
 * limit, so no multipart upload orchestration is needed for v1.
 */
export async function getPresignedUploadUrl(key: string, contentType: string, expiresInSeconds = 3600) {
  const command = new PutObjectCommand({ Bucket: r2Bucket.value(), Key: key, ContentType: contentType });
  return getSignedUrl(getR2Client(), command, { expiresIn: expiresInSeconds });
}

export async function getPresignedDownloadUrl(key: string, expiresInSeconds: number) {
  const command = new GetObjectCommand({ Bucket: r2Bucket.value(), Key: key });
  return getSignedUrl(getR2Client(), command, { expiresIn: expiresInSeconds });
}
