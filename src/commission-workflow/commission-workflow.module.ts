import { Module } from '@nestjs/common';
import { CommissionWorkflowController } from './commission-workflow.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [SupabaseModule, FinanceModule],
  controllers: [CommissionWorkflowController]
})
export class CommissionWorkflowModule {}

