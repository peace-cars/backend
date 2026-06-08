import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private supabaseAdmin;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    // Use the service role key to bypass RLS — the upload endpoint is
    // already protected by RolesGuard so this is safe.
    const serviceRoleKey =
      this.configService.get<string>('SUPABASE_SERVICE_KEY') ||
      this.configService.get<string>('SUPABASE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
    }

    this.supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async uploadFile(file: Express.Multer.File, bucket: string, folder?: string): Promise<string> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // After browser-side compression the file arrives as .webp; honour that
    // by using the actual mimetype to determine the stored extension.
    const mimeToExt: Record<string, string> = {
      'image/webp': 'webp',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/heic': 'heic',
      'application/pdf': 'pdf',
    };
    const fileExt = mimeToExt[file.mimetype] || (file.originalname.split('.').pop() ?? 'webp');
    const fileName = `${uuidv4()}-${Date.now()}.${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    const { data, error } = await this.supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      throw new InternalServerErrorException(`Failed to upload file to Supabase: ${error.message}`);
    }

    const { data: publicData } = this.supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicData.publicUrl;
  }

  async uploadBase64(base64Data: string, bucket: string, folder?: string, filename?: string): Promise<string> {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new BadRequestException('Invalid base64 string');
    }
    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    
    const mimeToExt: Record<string, string> = {
      'image/webp': 'webp',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/heic': 'heic',
      'application/pdf': 'pdf',
    };
    const fileExt = mimeToExt[contentType] || 'webp';
    const name = filename || `${uuidv4()}-${Date.now()}.${fileExt}`;
    const filePath = folder ? `${folder}/${name}` : name;

    const { error } = await this.supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      throw new InternalServerErrorException(`Failed to upload base64 file to Supabase: ${error.message}`);
    }

    const { data: publicData } = this.supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicData.publicUrl;
  }
}
