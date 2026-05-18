import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async uploadFile(bucket: string, folder: string, file: Express.Multer.File): Promise<string> {
    const client = this.supabaseService.getClient();
    
    const fileExt = file.originalname.split('.').pop()?.toLowerCase();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    // Normalize mimetype to bypass strict bucket validation
    let mimeType = file.mimetype;
    if (fileExt === 'jpg' || fileExt === 'jpeg' || fileExt === 'jfif') {
      mimeType = 'image/jpeg';
    } else if (fileExt === 'png') {
      mimeType = 'image/png';
    } else if (fileExt === 'webp') {
      mimeType = 'image/webp';
    } else if (fileExt === 'pdf') {
      mimeType = 'application/pdf';
    }

    const { data, error } = await client.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Storage Upload Failed: ${error.message}`);
      throw error;
    }

    const { data: { publicUrl } } = client.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrl;
  }

  async uploadBase64(bucket: string, folder: string, base64Data: string, filename: string): Promise<string> {
    const client = this.supabaseService.getClient();
    
    // Clean up base64 prefix if present (e.g., "data:image/jpeg;base64,...")
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');
    
    const fileExt = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    let mimeType = 'image/jpeg';
    if (fileExt === 'png') {
      mimeType = 'image/png';
    } else if (fileExt === 'webp') {
      mimeType = 'image/webp';
    }

    const { data, error } = await client.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      this.logger.error(`Storage Base64 Upload Failed: ${error.message}`);
      throw error;
    }

    const { data: { publicUrl } } = client.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrl;
  }
}
