import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [SupabaseModule, ConfigModule],
  controllers: [SettingsController]
})
export class SettingsModule {}

