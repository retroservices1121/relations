import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function r2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_URL,
  );
}

function client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });
}

export async function putR2Object(key: string, body: Uint8Array | Buffer, contentType: string) {
  await client().send(
    new PutObjectCommand({
      Bucket: required("R2_BUCKET"),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  const base = required("R2_PUBLIC_URL").replace(/\/$/, "");
  return { key, url: `${base}/${key}` };
}
