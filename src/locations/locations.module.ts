import { Module } from '@nestjs/common';
import { BranchManagementController } from './branch-management.controller';
import { LocationsService } from './locations.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [BranchManagementController],
  providers: [LocationsService]
})
export class LocationsModule {}
