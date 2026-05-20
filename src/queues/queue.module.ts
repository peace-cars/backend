import { Module, Global } from '@nestjs/common';
import { QueueService } from './queue.service';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Global()
@Module({
  imports: [ConfigModule, SupabaseModule, NotificationsModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
