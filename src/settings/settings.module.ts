import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [SettingsController]
})
export class SettingsModule {}
