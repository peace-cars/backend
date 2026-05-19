import { Controller, Post, UseInterceptors, UploadedFile, Body, UseGuards, BadRequestException, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { RolesGuard } from '../auth/roles.guard';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf'];
const ALLOWED_BUCKETS = ['vehicles', 'documents'];

@Controller('storage')
@UseGuards(RolesGuard)
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('bucket') bucket: string = 'vehicles',
    @Body('folder') folder: string = 'inventory',
  ) {
    if (!file) {
      throw new BadRequestException('No file provided. Please attach a file to upload.');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
    }

    const isAllowedType = ALLOWED_MIME_PREFIXES.some(prefix => file.mimetype.startsWith(prefix));
    if (!isAllowedType) {
      throw new BadRequestException(`File type "${file.mimetype}" is not allowed. Accepted: images and PDFs.`);
    }

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      throw new BadRequestException(`Invalid storage bucket "${bucket}".`);
    }

    try {
      const url = await this.storageService.uploadFile(bucket, folder, file);
      return { url, success: true };
    } catch (error: any) {
      this.logger.error(`Upload failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }
  }

  @Post('upload-base64')
  async uploadBase64(
    @Body('base64') base64: string,
    @Body('filename') filename: string,
    @Body('bucket') bucket: string = 'vehicles',
    @Body('folder') folder: string = 'inventory',
  ) {
    if (!base64 || !filename) {
      throw new BadRequestException('Both base64 data and filename are required.');
    }

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      throw new BadRequestException(`Invalid storage bucket "${bucket}".`);
    }

    try {
      const url = await this.storageService.uploadBase64(bucket, folder, base64, filename);
      return { url, success: true };
    } catch (error: any) {
      this.logger.error(`Base64 upload failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }
  }
}
