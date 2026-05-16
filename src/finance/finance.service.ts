import { Injectable } from '@nestjs/common';

export interface FinanceCalculationResult {
  vehiclePriceEtb: number;
  tradeInValueEtb: number;
  deltaBalance: number;
  bankSuggestions: {
    bank: string;
    downPaymentRequired: number;
    monthlyInstallmentEstimates: number;
  }[];
}

@Injectable()
export class FinanceService {
  // Mock exchange rate or call to an external oracle
  getDailyExchangeRate() {
    return 112.5; // Example: 1 USD = 112.5 ETB (Black Market / Bank Hybrid Rate)
  }

  calculateDelta(targetCarPriceEtb: number, tradeInValueEtb: number, isEV: boolean): FinanceCalculationResult {
    const delta = Math.max(0, targetCarPriceEtb - tradeInValueEtb);
    
    // In Ethiopia, EVs might have lower downpayment requirements from specific banks
    const downPaymentPercent = isEV ? 0.3 : 0.5;

    return {
      vehiclePriceEtb: targetCarPriceEtb,
      tradeInValueEtb: tradeInValueEtb,
      deltaBalance: delta,
      bankSuggestions: [
        {
          bank: 'CBE (Commercial Bank of Ethiopia)',
          downPaymentRequired: delta * downPaymentPercent,
          monthlyInstallmentEstimates: (delta - (delta * downPaymentPercent)) / 60, // 5 years
        },
        {
          bank: 'Awash Bank (Premium Auto Loan)',
          downPaymentRequired: delta * downPaymentPercent,
          monthlyInstallmentEstimates: (delta - (delta * downPaymentPercent)) / 48, // 4 years
        }
      ]
    };
  }
}
