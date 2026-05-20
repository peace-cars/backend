import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FCMService implements OnModuleInit {
  private readonly logger = new Logger(FCMService.name);
  private firebaseApp: admin.app.App | null = null;

  constructor(private readonly supabaseService: SupabaseService) {}

  onModuleInit() {
    try {
      const serviceAccountPath = path.join(process.cwd(), 'peace-cars-firebase-admin.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        if (admin.apps.length === 0) {
          this.firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
        } else {
          this.firebaseApp = admin.app();
        }
        this.logger.log('🔥 Firebase Admin SDK successfully initialized using service account key.');
      } else {
        this.logger.warn('⚠️ peace-cars-firebase-admin.json not found. Push notifications will run in Mock Mode.');
      }
    } catch (e) {
      this.logger.error(`Failed to initialize Firebase Admin SDK: ${e.message}`);
    }
  }

  /**
   * Register a user's FCM device token in the database
   */
  async registerToken(userId: string, token: string, deviceInfo?: any): Promise<boolean> {
    try {
      const client = this.supabaseService.getClient();
      const updatePayload: any = { fcm_token: token, last_seen_at: new Date().toISOString() };
      if (deviceInfo) updatePayload.fcm_meta = deviceInfo;
      const { error } = await client
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId);

      if (error) {
        const msg = (error?.message || '').toLowerCase();

        // Handle missing fcm_meta column gracefully by retrying without the metadata
        if (deviceInfo && (msg.includes('fcm_meta') || msg.includes("could not find the 'fcm_meta'") || (msg.includes('column') && msg.includes('fcm_meta')))) {
          this.logger.warn(`Profiles table appears to be missing 'fcm_meta'. Retrying token registration without metadata for user ${userId}`);
          const { error: retryErr } = await client
            .from('profiles')
            .update({ fcm_token: token, last_seen_at: new Date().toISOString() })
            .eq('id', userId);

          if (retryErr) {
            this.logger.error(`Failed to register FCM token (retry) for user ${userId}: ${retryErr.message}`);
            return false;
          }

          this.logger.log(`FCM token successfully registered for user ${userId} (metadata skipped)`);
          return true;
        }

        this.logger.error(`Failed to register FCM token for user ${userId}: ${error.message}`);
        return false;
      }

      this.logger.log(`FCM token successfully registered for user ${userId} (${token.substring(0,12)}...)`);
      return true;
    } catch (e) {
      this.logger.error(`Exception registering FCM token: ${e.message}`);
      return false;
    }
  }

  /**
   * Send a standard push notification via Firebase Cloud Messaging REST API v1
   */
  async sendPushNotification(
    recipientId: string,
    title: string,
    body: string,
    data: Record<string, string> = {}
  ): Promise<boolean> {
    try {
      const client = this.supabaseService.getClient();
      
      // 1. Fetch recipient's FCM token from profile
      const { data: profile, error } = await client
        .from('profiles')
        .select('fcm_token, full_name')
        .eq('id', recipientId)
        .single();

      if (error || !profile) {
        this.logger.warn(`No active profile or FCM token found for user ${recipientId}`);
        return false;
      }

      const fcmToken = profile.fcm_token;
      if (!fcmToken) {
        this.logger.log(`[Mock Push] Recipient ${profile.full_name || recipientId} has no registered FCM device token.`);
        return false;
      }

      // 2. Dispatch real notification if Firebase SDK is active
      if (this.firebaseApp) {
        const payload: admin.messaging.Message = {
          token: fcmToken,
          notification: {
            title,
            body,
          },
          data: data || {},
        };

        const response = await this.firebaseApp.messaging().send(payload);
        this.logger.log(`FCM Push successfully dispatched to ${profile.full_name || recipientId}. Message ID: ${response}`);
        return true;
      }

      // 3. Mock fallback
      this.logger.log(`
┌──────────────────────────────────────────────────────────┐
│ [MOCK FCM PUSH NOTIFICATION]                             │
│ Recipient: ${profile.full_name || recipientId}             │
│ Token: ${fcmToken.substring(0, 15)}...                   │
│ Title: ${title}                                          │
│ Body: ${body}                                            │
│ Data: ${JSON.stringify(data)}                            │
│                                                          │
│ STATUS: SUCCESS (MOCK RUN - Keys not configured yet)     │
└──────────────────────────────────────────────────────────┘
      `);
      return true;
    } catch (e) {
      this.logger.error(`FCM Push dispatch critical failure: ${e.message}`);
      return false;
    }
  }
}
