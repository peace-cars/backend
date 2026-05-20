import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { BankPartnersModule } from '../bank-partners/bank-partners.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { LedgerService } from './ledger.service';

@Module({
  imports: [SupabaseModule, BankPartnersModule],
  controllers: [FinanceController],
  providers: [FinanceService, LedgerService],
  exports: [FinanceService, LedgerService]
})
export class FinanceModule {}

