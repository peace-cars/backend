import { Controller, Get, Body, Post } from '@nestjs/common';
import { FinanceService } from './finance.service';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('rate')
  getRate() {
    return { 
      currency: 'USD', 
      rate_etb: this.financeService.getDailyExchangeRate(),
      last_updated: new Date()
    };
  }

  @Post('calculator')
  calculateDelta(@Body() body: { targetCarPriceEtb: number, tradeInValueEtb: number, isEV: boolean }) {
    return this.financeService.calculateDelta(
      body.targetCarPriceEtb, 
      body.tradeInValueEtb, 
      body.isEV
    );
  }
}
