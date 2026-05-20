import { Module, Global } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SupabaseScopedService } from './supabase-scoped.service';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { ConfigModule } from '@nestjs/config';
import { CryptoAuditService } from '../common/crypto-audit.service';
import { FsmService } from '../common/fsm.service';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [StorageController],
  providers: [SupabaseService, SupabaseScopedService, StorageService, CryptoAuditService, FsmService],
  exports: [SupabaseService, SupabaseScopedService, StorageService, CryptoAuditService, FsmService],
})
export class SupabaseModule {}


