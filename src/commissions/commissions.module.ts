import { Module } from '@nestjs/common';
import { CommissionsController } from './commissions.controller';
import { CommissionsService } from './commissions.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [SupabaseModule, FinanceModule],
  controllers: [CommissionsController],
  providers: [CommissionsService],
  exports: [CommissionsService]
})
export class CommissionsModule {}
