import {
  BadRequestException,
  Controller,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { AuthGuard } from "../auth/auth.guard";
import { validateImageFile } from "../common/validations";
import { UploadsService } from "./uploads.service";

@Controller("upload")
@UseGuards(AuthGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body("kind") kind?: string,
  ) {
    if (!this.uploads.isConfigured()) {
      throw new ServiceUnavailableException("Хранилище файлов не настроено. Заполните AWS_* в env.");
    }
    if (!file) {
      throw new BadRequestException("Файл не передан");
    }

    const invalid = validateImageFile({
      type: file.mimetype,
      size: file.size,
      name: file.originalname,
    });
    if (invalid) {
      throw new BadRequestException(invalid);
    }

    const folder = kind === "avatars" ? "avatars" : "tasks";
    const uploaded = await this.uploads.uploadPublicImage({
      body: file.buffer,
      contentType: file.mimetype,
      folder,
      fileName: file.originalname,
    });

    return {
      url: uploaded.url,
      key: uploaded.key,
      fileName: file.originalname,
      contentType: file.mimetype,
      sizeBytes: file.size,
    };
  }
}
