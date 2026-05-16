import { Module } from '@nestjs/common';
import { TradeInRequestsController } from './trade-in-requests.controller';
import { TradeInRequestsService } from './trade-in-requests.service';

import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [TradeInRequestsController],
  providers: [TradeInRequestsService]
})
export class TradeInRequestsModule {}
