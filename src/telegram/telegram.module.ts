import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [SupabaseModule, RealtimeModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
