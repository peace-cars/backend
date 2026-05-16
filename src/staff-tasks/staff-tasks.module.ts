import { Module } from '@nestjs/common';
import { StaffTasksController } from './staff-tasks.controller';
import { StaffTasksService } from './staff-tasks.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [StaffTasksController],
  providers: [StaffTasksService]
})
export class StaffTasksModule {}
