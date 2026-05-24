import { Injectable, Logger, BadRequestException, Optional } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { QueueService } from '../queues/queue.service';
// Optional: sharp is a native dependency; ensure it's installed in the environment
let sharp: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sharp = require('sharp');
} catch (e) {
  // If sharp isn't installed, we'll fallback to uploading the original buffer.
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly supabaseService: SupabaseService,
              @Optional() private readonly queueService?: QueueService) {}

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

    // If this is an image and sharp is available, generate optimized variants
    const isImage = mimeType.startsWith('image/') && sharp;
    let mainBuffer: Buffer = file.buffer;

    if (isImage) {
      try {
        const baseName = fileName.replace(/\.[^.]+$/, '');
        const originalBase64 = file.buffer.toString('base64');

        if (this.queueService) {
          // Upload original first and process image variants asynchronously
          await this.queueService.addJob('process-image', {
            bucket,
            folder,
            baseName,
            originalExt: fileExt,
            originalBase64,
          });
          this.logger.log('Enqueued process-image job for background optimization');
        } else {
          const optimized = await sharp(file.buffer)
            .rotate()
            .resize({ width: 1600, withoutEnlargement: true })
            .toFormat('webp', { quality: 80 })
            .toBuffer();

          const thumb = await sharp(file.buffer)
            .rotate()
            .resize({ width: 400, withoutEnlargement: true })
            .toFormat('webp', { quality: 75 })
            .toBuffer();

          const thumbName = `${baseName}-thumb.webp`;
          const thumbPath = `${folder}/${thumbName}`;
          const { error: thumbErr } = await this.supabaseService.getClient().storage
            .from(bucket)
            .upload(thumbPath, thumb.buffer.slice(thumb.byteOffset, thumb.byteOffset + thumb.byteLength) as ArrayBuffer, { contentType: 'image/webp', upsert: true });
          if (thumbErr) this.logger.warn(`Thumbnail upload failed: ${thumbErr.message}`);

          const webpName = `${baseName}.webp`;
          const webpPath = `${folder}/${webpName}`;
          const { data: webpData, error: webpErr } = await this.supabaseService.getClient().storage
            .from(bucket)
            .upload(webpPath, optimized.buffer.slice(optimized.byteOffset, optimized.byteOffset + optimized.byteLength) as ArrayBuffer, { contentType: 'image/webp', upsert: true });
          if (!webpErr) {
            const { data: { publicUrl } } = this.supabaseService.getClient().storage.from(bucket).getPublicUrl(webpPath);
            this.logger.log(`Optimized upload successful: ${publicUrl}`);
            return publicUrl;
          }
          this.logger.warn(`Optimized upload failed, falling back to original: ${webpErr?.message}`);
        }
      } catch (err) {
        this.logger.warn('Image optimization failed, uploading original.', err?.message || err);
      }
    }

    // Retry up to 3 times for transient errors
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await client.storage
        .from(bucket)
        .upload(filePath, mainBuffer.buffer.slice(mainBuffer.byteOffset, mainBuffer.byteOffset + mainBuffer.byteLength) as ArrayBuffer, {
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
    const base64Match = base64Data.match(/^data:([^;]+);base64,/);
    const originalMimeType = base64Match ? base64Match[1] : 'image/jpeg';
    const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    if (buffer.length === 0) {
      throw new BadRequestException('Invalid base64 data: decoded to empty buffer.');
    }

    if (buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException(`Decoded file exceeds 10MB limit. File size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
    }

    const fileExt = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = this.generateFileName(filename);
    const filePath = `${folder}/${fileName}`;
    // Use extracted MIME type from base64 data, fall back to normalized extension
    const mimeType = this.normalizeMimeType(originalMimeType, fileExt);

    this.logger.debug(`Base64 uploading: ${filePath} (${mimeType}, ${(buffer.length / 1024).toFixed(1)}KB)`);
    this.logger.debug(`[DEBUG] originalMimeType: ${originalMimeType}, fileExt: ${fileExt}, base64Prefix: ${base64Data.substring(0, 40)}`);

    // If sharp available and image, create optimized variants (webp) and thumbnail
    const isImage = mimeType.startsWith('image/') && sharp;
    if (isImage && sharp) {
      const baseName = fileName.replace(/\.[^.]+$/, '');
      const originalBase64 = base64Clean;
      try {
        if (this.queueService) {
          await this.queueService.addJob('process-image', {
            bucket,
            folder,
            baseName,
            originalExt: fileExt,
            originalBase64,
          });
          this.logger.log('Enqueued process-image job for base64 optimization');
        } else {
          const optimized = await sharp(buffer)
            .rotate()
            .resize({ width: 1600, withoutEnlargement: true })
            .toFormat('webp', { quality: 80 })
            .toBuffer();

          const thumb = await sharp(buffer)
            .rotate()
            .resize({ width: 400, withoutEnlargement: true })
            .toFormat('webp', { quality: 75 })
            .toBuffer();

          const webpName = `${baseName}.webp`;
          const webpPath = `${folder}/${webpName}`;

          const { data: webpData, error: webpErr } = await client.storage
            .from(bucket)
            .upload(webpPath, optimized.buffer.slice(optimized.byteOffset, optimized.byteOffset + optimized.byteLength) as ArrayBuffer, { contentType: 'image/webp', upsert: true });

          if (!webpErr) {
            const thumb = await sharp(buffer)
              .rotate()
              .resize({ width: 320, withoutEnlargement: true })
              .toFormat('webp', { quality: 60 })
              .toBuffer();
            
            const thumbPath = filePath.replace(/\.[^.]+$/, '-thumb.webp');
            const { error: thumbErr } = await client.storage.from(bucket).upload(thumbPath, thumb.buffer.slice(thumb.byteOffset, thumb.byteOffset + thumb.byteLength) as ArrayBuffer, { contentType: 'image/webp', upsert: true });
            if (thumbErr) this.logger.warn(`Thumbnail upload failed: ${thumbErr.message}`);

            const { data: { publicUrl } } = client.storage.from(bucket).getPublicUrl(webpPath);
            this.logger.log(`Base64 optimized upload successful: ${publicUrl}`);
            return publicUrl;
          }
        }
      } catch (err) {
        this.logger.warn('Image optimization failed for base64 upload, falling back to original.', err?.message || err);
      }
    }

    const { data, error } = await client.storage
      .from(bucket)
      .upload(filePath, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer, {
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
