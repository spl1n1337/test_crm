import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(
      this.config.get("AWS_ACCESS_KEY_ID") &&
        this.config.get("AWS_SECRET_ACCESS_KEY") &&
        this.config.get("AWS_S3_BUCKET"),
    );
  }

  private client() {
    return new S3Client({
      region: this.config.get("AWS_REGION") || "eu-central-1",
      endpoint: this.config.get("AWS_S3_ENDPOINT") || undefined,
      forcePathStyle: this.config.get("AWS_S3_FORCE_PATH_STYLE") === "true",
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: this.config.getOrThrow("AWS_ACCESS_KEY_ID"),
        secretAccessKey: this.config.getOrThrow("AWS_SECRET_ACCESS_KEY"),
      },
    });
  }

  private publicUrlFor(key: string) {
    const publicBase = this.config.get<string>("AWS_S3_PUBLIC_URL");
    if (publicBase) {
      return `${publicBase.replace(/\/$/, "")}/${key}`;
    }
    const bucket = this.config.getOrThrow("AWS_S3_BUCKET");
    const region = this.config.get("AWS_REGION") || "eu-central-1";
    const endpoint = this.config.get<string>("AWS_S3_ENDPOINT");
    if (endpoint) {
      return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
    }
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  async uploadPublicImage(input: {
    body: Buffer;
    contentType: string;
    folder: "avatars" | "tasks";
    fileName: string;
  }) {
    const ext = input.fileName.split(".").pop()?.toLowerCase() || "jpg";
    const key = `${input.folder}/${randomUUID()}.${ext}`;
    const bucket = this.config.getOrThrow("AWS_S3_BUCKET");

    const object = {
      Bucket: bucket,
      Key: key,
      Body: input.body,
      ContentType: input.contentType,
    };

    try {
      await this.client().send(new PutObjectCommand(object));
    } catch {
      try {
        await this.client().send(new PutObjectCommand({ ...object, ACL: "public-read" }));
      } catch (error) {
        const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
        throw new Error(
          /InvalidArgument|UnknownError|AccessDenied|NoSuchBucket/i.test(text)
            ? "Не удалось сохранить файл в хранилище. Проверьте бакет и права записи AWS_S3_BUCKET."
            : error instanceof Error && error.message
              ? error.message
              : "Не удалось сохранить файл в хранилище",
        );
      }
    }

    return { key, url: this.publicUrlFor(key) };
  }
}
