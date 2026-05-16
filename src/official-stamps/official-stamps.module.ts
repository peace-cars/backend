import { Module } from '@nestjs/common';
import { OfficialStampsController } from './official-stamps.controller';
import { OfficialStampsService } from './official-stamps.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [OfficialStampsController],
  providers: [OfficialStampsService]
})
export class OfficialStampsModule {}
