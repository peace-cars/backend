import { Controller, Post, UseInterceptors, UploadedFile, Body, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('bucket') bucket: string = 'vehicles',
    @Body('folder') folder: string = 'inventory',
  ) {
    const url = await this.storageService.uploadFile(bucket, folder, file);
    return { url };
  }

  @Post('upload-base64')
  async uploadBase64(
    @Body('base64') base64: string,
    @Body('filename') filename: string,
    @Body('bucket') bucket: string = 'vehicles',
    @Body('folder') folder: string = 'inventory',
  ) {
    const url = await this.storageService.uploadBase64(bucket, folder, base64, filename);
    return { url };
  }
}
