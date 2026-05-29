import { Module, forwardRef } from '@nestjs/common';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [SupabaseModule, forwardRef(() => TelegramModule)],
  controllers: [CommunityController],
  providers: [CommunityService]
})
export class CommunityModule {}
