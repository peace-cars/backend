import { Module } from '@nestjs/common';
import { StaffBudgetsController } from './staff-budgets.controller';
import { StaffBudgetsService } from './staff-budgets.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [StaffBudgetsController],
  providers: [StaffBudgetsService]
})
export class StaffBudgetsModule {}
