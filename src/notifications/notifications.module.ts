import { Module, Global } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { FCMService } from './fcm.service';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  imports: [SupabaseModule],
  controllers: [NotificationsController],
  providers: [FCMService, NotificationsService],
  exports: [FCMService, NotificationsService]
})
export class NotificationsModule {}
