import { GetObjectCommand, PutObjectCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { defineSecret } from "firebase-functions/params";

export const r2AccountId = defineSecret("R2_ACCOUNT_ID");
export const r2AccessKeyId = defineSecret("R2_ACCESS_KEY_ID");
export const r2SecretAccessKey = defineSecret("R2_SECRET_ACCESS_KEY");
export const r2Bucket = defineSecret("R2_BUCKET");

function cleanString(val: string): string {
  return (val || "")
    .replace(/%0D%0A/gi, "")
    .replace(/[\r\n\t\f\v]/g, "")
    .trim();
}

function getCleanSecret(secret: ReturnType<typeof defineSecret>, fallback = ""): string {
  try {
    const val = secret.value();
    if (val) return cleanString(val);
  } catch {}
  return cleanString(fallback);
}

function cleanAccessKeyId(val: string): string {
  const s = cleanString(val).replace(/["']/g, "").trim();
  const match = s.match(/[a-f0-9]{32}/i);
  return match ? match[0] : s.substring(0, 32);
}

function cleanSecretAccessKey(val: string): string {
  return cleanString(val).replace(/["']/g, "").trim();
}

function cleanAccountId(val: string): string {
  const s = cleanString(val).replace(/["']/g, "").trim();
  const match = s.match(/[a-f0-9]{32}/i);
  return match ? match[0] : s;
}

export function getR2Client(): S3Client {
  const accountId = cleanAccountId(getCleanSecret(r2AccountId));
  const accessKeyId = cleanAccessKeyId(getCleanSecret(r2AccessKeyId));
  const secretAccessKey = cleanSecretAccessKey(getCleanSecret(r2SecretAccessKey));

  return new S3Client({
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

export async function ensureR2BucketCors(): Promise<void> {
  try {
    const client = getR2Client();
    const bucketName = cleanString(getCleanSecret(r2Bucket, "kasc-live-class-recordings"));
    await client.send(
      new PutBucketCorsCommand({
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
      }),
    );
  } catch (err) {
    console.warn("Automated R2 Bucket CORS sync notice:", err);
  }
}

/**
 * Presigned PUT URL so the host's browser can upload a recorded class blob
 * straight to R2, without the bytes ever passing through our Cloud Functions.
 * A class-length recording comfortably fits under R2/S3's 5GB single-PUT
 * limit, so no multipart upload orchestration is needed for v1.
 */
export async function getPresignedUploadUrl(key: string, contentType?: string, expiresInSeconds = 3600) {
  void ensureR2BucketCors();
  const bucketName = cleanString(getCleanSecret(r2Bucket, "kasc-live-class-recordings"));
  const cleanKey = cleanString(key);
  const commandInput: Record<string, any> = { Bucket: bucketName, Key: cleanKey };
  const command = new PutObjectCommand(commandInput as any);
  return getSignedUrl(getR2Client(), command, { expiresIn: expiresInSeconds });
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds: number,
  options?: { disposition?: "inline" | "attachment"; filename?: string },
) {
  void ensureR2BucketCors();
  const bucketName = cleanString(getCleanSecret(r2Bucket, "kasc-live-class-recordings"));
  const cleanKey = cleanString(key);
  const commandInput: Record<string, any> = { Bucket: bucketName, Key: cleanKey };

  if (options?.disposition === "attachment" || options?.filename) {
    const safeFilename = (options.filename || "recording.webm").replace(/[^a-zA-Z0-9_\.-]/g, "_");
    commandInput.ResponseContentDisposition = `attachment; filename="${safeFilename}"`;
  }

  const command = new GetObjectCommand(commandInput as any);
  return getSignedUrl(getR2Client(), command, { expiresIn: expiresInSeconds });
}
