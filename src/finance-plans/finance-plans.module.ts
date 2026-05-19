import { Module } from '@nestjs/common';
import { FinancePlansController } from './finance-plans.controller';
import { FinancePlansService } from './finance-plans.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [FinancePlansController],
  providers: [FinancePlansService],
  exports: [FinancePlansService]
})
export class FinancePlansModule {}
