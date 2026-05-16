import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [NotificationsController]
})
export class NotificationsModule {}
