import { Module } from '@nestjs/common';
import { BankPartnersController } from './bank-partners.controller';
import { BankPartnersService } from './bank-partners.service';

@Module({
  controllers: [BankPartnersController],
  providers: [BankPartnersService]
})
export class BankPartnersModule {}
