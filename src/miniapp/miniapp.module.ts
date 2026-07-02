import { Module } from '@nestjs/common';
import { MiniappController } from './miniapp.controller';
import { MiniappService } from './miniapp.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [MiniappController],
  providers: [MiniappService],
  exports: [MiniappService],
})
export class MiniappModule {}
