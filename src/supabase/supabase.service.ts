import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(SupabaseService.name);

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_KEY');

    if (!url || !key) {
      this.logger.error(`Missing env vars: SUPABASE_URL=${!!url}, SUPABASE_KEY=${!!key}`);
      throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in .env');
    }

    this.logger.log(`Supabase Client Initialized: ${url}`);
    this.supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verification Ping + Auto-create storage buckets
    const client = this.supabase;
    (async () => {
      try {
        const { error } = await client.from('profiles').select('count', { count: 'exact', head: true });
        if (error) {
          this.logger.error(`Supabase connectivity check failed: ${error.message}`);
        } else {
          this.logger.log(`Supabase connection confirmed.`);
        }

        // Auto-create required storage buckets
        const requiredBuckets = ['vehicles', 'documents'];
        const { data: existingBuckets } = await client.storage.listBuckets();
        const existingNames = (existingBuckets || []).map((b: any) => b.name);

        for (const bucketName of requiredBuckets) {
          if (!existingNames.includes(bucketName)) {
            const { error: createError } = await client.storage.createBucket(bucketName, {
              public: true,
              allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
              fileSizeLimit: 10485760 // 10MB
            });
            if (createError) {
              this.logger.warn(`Could not create bucket '${bucketName}': ${createError.message}`);
            } else {
              this.logger.log(`Storage bucket '${bucketName}' created successfully.`);
            }
          } else {
            this.logger.log(`Storage bucket '${bucketName}' already exists.`);
          }
        }
      } catch (err: any) {
        this.logger.error(`Supabase persistence layer unreachable: ${err.message || err}`);
      }
    })();
  }

  getClient() {
    return this.supabase;
  }
}
