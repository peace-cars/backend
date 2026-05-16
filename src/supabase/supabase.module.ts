import { Module, Global } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseScopedService } from './supabase-scoped.service';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [StorageController],
  providers: [SupabaseService, SupabaseScopedService, StorageService],
  exports: [SupabaseService, SupabaseScopedService, StorageService],
})
export class SupabaseModule {}
