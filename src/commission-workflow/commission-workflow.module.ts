import { Module } from '@nestjs/common';
import { CommissionWorkflowController } from './commission-workflow.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { FinanceModule } from '../finance/finance.module';
import { CommissionsModule } from '../commissions/commissions.module';

@Module({
  imports: [SupabaseModule, FinanceModule, CommissionsModule],
  controllers: [CommissionWorkflowController]
})
export class CommissionWorkflowModule {}

