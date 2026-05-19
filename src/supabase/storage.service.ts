import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Normalize MIME type based on file extension to bypass strict Supabase bucket validation.
   * Handles edge cases like HEIC (iPhone), JFIF, and misreported MIME types.
   */
  private normalizeMimeType(originalMime: string, fileExt: string): string {
    const ext = fileExt.toLowerCase();
    const mimeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'jfif': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif',
      'heic': 'image/heic',
      'heif': 'image/heif',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
    };
    return mimeMap[ext] || originalMime;
  }

  /**
   * Generate a unique, collision-resistant filename
   */
  private generateFileName(originalName: string): string {
    const fileExt = originalName.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `${random}-${timestamp}.${fileExt}`;
  }

  /**
   * Upload a file buffer to Supabase Storage with retry logic
   */
  async uploadFile(bucket: string, folder: string, file: Express.Multer.File): Promise<string> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Invalid file: no buffer data received.');
    }

    const client = this.supabaseService.getClient();
    const fileExt = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = this.generateFileName(file.originalname);
    const filePath = `${folder}/${fileName}`;
    const mimeType = this.normalizeMimeType(file.mimetype, fileExt);

    this.logger.debug(`Uploading: ${filePath} (${mimeType}, ${(file.size / 1024).toFixed(1)}KB)`);

    // Retry up to 2 times for transient errors
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await client.storage
        .from(bucket)
        .upload(filePath, file.buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (!error) {
        const { data: { publicUrl } } = client.storage.from(bucket).getPublicUrl(filePath);
        this.logger.log(`Upload successful: ${publicUrl}`);
        return publicUrl;
      }

      lastError = error;
      this.logger.warn(`Upload attempt ${attempt}/3 failed: ${error.message}`);

      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }

    this.logger.error(`Storage Upload Failed after 3 attempts: ${lastError?.message}`);
    throw new BadRequestException(`Storage upload failed: ${lastError?.message}`);
  }

  /**
   * Upload a base64-encoded image to Supabase Storage
   */
  async uploadBase64(bucket: string, folder: string, base64Data: string, filename: string): Promise<string> {
    const client = this.supabaseService.getClient();

    // Clean up base64 prefix if present (e.g., "data:image/jpeg;base64,...")
    const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    if (buffer.length === 0) {
      throw new BadRequestException('Invalid base64 data: decoded to empty buffer.');
    }

    if (buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('Decoded file exceeds 10MB limit.');
    }

    const fileExt = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = this.generateFileName(filename);
    const filePath = `${folder}/${fileName}`;
    const mimeType = this.normalizeMimeType('image/jpeg', fileExt);

    this.logger.debug(`Base64 uploading: ${filePath} (${mimeType}, ${(buffer.length / 1024).toFixed(1)}KB)`);

    const { data, error } = await client.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Storage Base64 Upload Failed: ${error.message}`);
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }

    const { data: { publicUrl } } = client.storage.from(bucket).getPublicUrl(filePath);
    this.logger.log(`Base64 upload successful: ${publicUrl}`);
    return publicUrl;
  }
}
