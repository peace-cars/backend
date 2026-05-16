import { Module } from '@nestjs/common';
import { StaffPerformanceService } from './staff-performance.service';
import { StaffPerformanceController } from './staff-performance.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [StaffPerformanceService],
  controllers: [StaffPerformanceController],
  exports: [StaffPerformanceService]
})
export class StaffPerformanceModule {}
