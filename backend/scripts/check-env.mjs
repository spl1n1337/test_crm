import { config } from "dotenv";
import { resolve } from "path";
import nodemailer from "nodemailer";
import {
  HeadBucketCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

const loaded = config({ path: resolve(import.meta.dirname, "../../.env"), override: true });
const keys = Object.keys(loaded.parsed || {}).filter((key) =>
  /SMTP_|AWS_S3|AWS_ACCESS|AWS_SECRET|AWS_REGION/.test(key),
);
console.log("parsed_keys", keys.join(","));
console.log("SMTP_USER", process.env.SMTP_USER);
console.log("SMTP_PASS_LEN", (process.env.SMTP_PASS || "").length);
console.log("AWS_S3_BUCKET", process.env.AWS_S3_BUCKET);
console.log("AWS_S3_ENDPOINT", process.env.AWS_S3_ENDPOINT);
console.log("HAS_KEY", Boolean(process.env.AWS_ACCESS_KEY_ID));

const smtp = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

try {
  await smtp.verify();
  console.log("SMTP: ok");
} catch (error) {
  console.log("SMTP: fail", error instanceof Error ? error.message : error);
}

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_S3_ENDPOINT,
  forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === "true",
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

s3.middlewareStack.add(
  (next) => async (args) => {
    const req = args.request;
    if (req?.headers) {
      console.log(
        "S3 headers",
        Object.keys(req.headers)
          .filter((name) => /amz|acl|content|checksum/i.test(name))
          .sort()
          .map((name) => `${name}=${String(req.headers[name]).slice(0, 80)}`)
          .join(" | "),
      );
      console.log("S3 path", req.method, req.protocol, req.hostname, req.path);
    }
    try {
      return await next(args);
    } catch (error) {
      const body = error?.$response?.body;
      if (body) {
        const text =
          typeof body === "string"
            ? body
            : Buffer.isBuffer(body)
              ? body.toString("utf8")
              : "";
        if (text) console.log("S3 body", text.slice(0, 800));
      }
      throw error;
    }
  },
  { step: "finalizeRequest", name: "debug-s3" },
);

const bucket = process.env.AWS_S3_BUCKET;
try {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log("S3 head: ok");
} catch (error) {
  console.log(
    "S3 head: fail",
    error instanceof Error ? `${error.name} ${error.message.split("\n")[0]}` : error,
  );
}

const key = `healthcheck/${Date.now()}.txt`;
try {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from("ok"),
        ContentType: "text/plain",
        ACL: "public-read",
      }),
    );
    console.log("S3 put: ok with ACL");
  } catch (error) {
    const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    console.log("S3 put ACL:", text.split("\n")[0]);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from("ok"),
        ContentType: "text/plain",
      }),
    );
    console.log("S3 put: ok without ACL");
  }
  const url = `${process.env.AWS_S3_PUBLIC_URL}/${key}`;
  const res = await fetch(url);
  console.log("S3 public GET:", res.status);
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log("S3 cleanup: ok");
} catch (error) {
  const err = error;
  console.log("S3 put: fail", err?.name, err?.message);
  console.log("S3 put code", err?.Code || err?.code, err?.$metadata);
  console.log("S3 put keys", err && typeof err === "object" ? Object.keys(err) : []);
}
