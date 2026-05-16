import { Module } from '@nestjs/common';
import { FinancePlansController } from './finance-plans.controller';
import { FinancePlansService } from './finance-plans.service';

@Module({
  controllers: [FinancePlansController],
  providers: [FinancePlansService]
})
export class FinancePlansModule {}
