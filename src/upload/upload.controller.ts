import { Controller, Post, UseInterceptors, UploadedFile, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(RolesGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  @ApiOperation({ summary: 'Upload a file to Supabase Storage' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        bucket: {
          type: 'string',
        },
        folder: {
          type: 'string',
        },
      },
      required: ['file', 'bucket'],
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    // CRITICAL: memoryStorage() must be explicit — the default disk storage
    // does NOT populate file.buffer, causing silent upload failures.
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
      const allowed = [
        'image/jpeg', 'image/png', 'image/webp',
        'image/gif', 'image/heic', 'image/heif', 'application/pdf',
      ];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`File type "${file.mimetype}" is not allowed.`), false);
      }
    },
  }))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('bucket') bucket: string,
    @Body('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (!bucket) {
      throw new BadRequestException('Bucket name is required');
    }

    const publicUrl = await this.uploadService.uploadFile(file, bucket, folder);

    return {
      success: true,
      data: { url: publicUrl },
    };
  }

  @Post('base64')
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  @ApiOperation({ summary: 'Upload a base64 encoded file to Supabase Storage' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Base64 encoded file string with data URI scheme' },
        bucket: { type: 'string' },
        folder: { type: 'string' },
      },
      required: ['file', 'bucket'],
    },
  })
  async uploadBase64(
    @Body('file') base64: string,
    @Body('bucket') bucket: string,
    @Body('folder') folder?: string,
  ) {
    if (!base64 || !bucket) {
      throw new BadRequestException('Base64 data and bucket name are required');
    }

    const publicUrl = await this.uploadService.uploadBase64(base64, bucket, folder);

    return {
      success: true,
      data: { url: publicUrl },
    };
  }
}
