import { Module } from '@nestjs/common';
import { CommissionWorkflowController } from './commission-workflow.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [CommissionWorkflowController]
})
export class CommissionWorkflowModule {}
