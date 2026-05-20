import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TelegramController } from './telegram.controller';

@Module({
  imports: [SupabaseModule, RealtimeModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
