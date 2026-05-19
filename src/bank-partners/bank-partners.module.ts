import { Module } from '@nestjs/common';
import { BankPartnersController } from './bank-partners.controller';
import { BankPartnersService } from './bank-partners.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [BankPartnersController],
  providers: [BankPartnersService],
  exports: [BankPartnersService]
})
export class BankPartnersModule {}
