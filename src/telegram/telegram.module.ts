import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
