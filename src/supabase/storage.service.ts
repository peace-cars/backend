import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async uploadFile(bucket: string, folder: string, file: Express.Multer.File): Promise<string> {
    const client = this.supabaseService.getClient();
    
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { data, error } = await client.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
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
}
