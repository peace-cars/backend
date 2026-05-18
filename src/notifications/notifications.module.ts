import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { FCMService } from './fcm.service';

@Module({
  imports: [SupabaseModule],
  controllers: [NotificationsController],
  providers: [FCMService],
  exports: [FCMService]
})
export class NotificationsModule {}
