import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { FCMService } from '../notifications/fcm.service';
let BullMQ: any = null;
let Queue: any = null;
let Worker: any = null;
let sharp: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  BullMQ = require('bullmq');
  Queue = BullMQ.Queue;
  Worker = BullMQ.Worker;
} catch (e) {
  // bullmq not installed — queue will be a mock
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sharp = require('sharp');
} catch (e) {
  // Optional sharp for image processing
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private queue: any = null;

  constructor(
    private readonly config: ConfigService,
    private readonly supabaseService: SupabaseService,
    @Optional() private readonly fcmService?: FCMService
  ) {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://127.0.0.1:6379';
    if (Queue) {
      this.queue = new Queue('peacecars', { connection: { url: redisUrl } });
      this.logger.log('BullMQ queue initialized.');

      if (Worker) {
        const worker = new Worker('peacecars', async (job: any) => {
          this.logger.log(`Processing job ${job.id} (${job.name})`);
          const { name, data } = job;

          if (name === 'send-notification') {
            const { recipientId, title, body, meta } = data;
            try {
              if (this.fcmService) {
                await this.fcmService.sendPushNotification(recipientId, title, body, meta || {});
                this.logger.log(`send-notification delivered for ${recipientId}`);
              } else {
                this.logger.warn('FCMService unavailable for send-notification job.');
              }
            } catch (err) {
              this.logger.error(`send-notification job failed: ${err.message}`);
              throw err;
            }
          }

          if (name === 'process-image') {
            const { bucket, folder, baseName, originalBase64, originalExt } = data;
            if (!sharp) {
              this.logger.warn('Sharp not available for process-image job.');
              return { ok: false };
            }
            try {
              const buffer = Buffer.from(originalBase64, 'base64');
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
              const thumbName = `${baseName}-thumb.webp`;
              const webpPath = `${folder}/${webpName}`;
              const thumbPath = `${folder}/${thumbName}`;

              const client = this.supabaseService.getClient();
              const { error: webpErr } = await client.storage
                .from(bucket)
                .upload(webpPath, optimized, { contentType: 'image/webp', upsert: true });

              if (webpErr) {
                this.logger.error(`process-image webp upload failed: ${webpErr.message}`);
                throw webpErr;
              }

              const { error: thumbErr } = await client.storage
                .from(bucket)
                .upload(thumbPath, thumb, { contentType: 'image/webp', upsert: true });

              if (thumbErr) {
                this.logger.warn(`process-image thumb upload failed: ${thumbErr.message}`);
              }

              this.logger.log(`process-image completed for ${bucket}/${baseName}`);
              return { ok: true };
            } catch (err) {
              this.logger.error(`process-image job failed: ${err.message}`);
              throw err;
            }
          }

          return { ok: true };
        }, { connection: { url: redisUrl } });

        worker.on('failed', (job: any, err: any) => {
          this.logger.error(`Job ${job.id} failed: ${err.message}`);
        });
      }
    } else {
      this.logger.warn('BullMQ not installed — queue operations are NO-OP. Install bullmq and redis to enable background processing.');
    }
  }

  async addJob(name: string, data: any, opts: any = {}) {
    if (!this.queue) {
      this.logger.log(`Queue not available, skipping job ${name}`);
      return null;
    }
    try {
      const job = await this.queue.add(name, data, opts);
      this.logger.log(`Enqueued job ${job.id} (${name})`);
      return job;
    } catch (err) {
      this.logger.error(`Failed to enqueue job ${name}: ${err.message}`);
      return null;
    }
  }
}
