import { Injectable, BadRequestException } from '@nestjs/common';
import { BankPartnersService } from '../bank-partners/bank-partners.service';
import { SupabaseService } from '../supabase/supabase.service';

export interface BankSuggestion {
  bankId: string;
  bankName: string;
  logoUrl: string | null;
  interestRate: number;
  minDownPaymentRequired: number;
  maxLoanTermMonths: number;
  monthlyInstallmentEstimate: number;
  totalPayableEstimate: number;
  processingFeeEstimate: number;
}

export interface FinanceCalculationResult {
  vehiclePriceEtb: number;
  tradeInValueEtb: number;
  deltaBalance: number;
  insuranceEstimate: number;
  isEV: boolean;
  bankSuggestions: BankSuggestion[];
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly bankPartnersService: BankPartnersService,
    private readonly supabaseService: SupabaseService
  ) {}

  async getDailyExchangeRate(): Promise<number> {
    try {
      // In production, fetch from system_settings table. Fallback for now:
      return 112.5; 
    } catch {
      return 112.5;
    }
  }

  async calculateDelta(targetCarPriceEtb: number, tradeInValueEtb: number, isEV: boolean): Promise<FinanceCalculationResult> {
    if (targetCarPriceEtb <= 0) {
      throw new BadRequestException('Vehicle price must be greater than 0.');
    }

    const delta = Math.max(0, targetCarPriceEtb - tradeInValueEtb);
    
    // Comprehensive insurance in Ethiopia is usually around 2.5% - 3.5% annually. 
    // We estimate the first year cost here.
    const insuranceEstimate = targetCarPriceEtb * 0.03;

    // Fetch real bank partners from DB
    const banks = await this.bankPartnersService.getAll(true);
    const bankSuggestions: BankSuggestion[] = [];

    for (const bank of banks) {
      // EV Incentive: if EV, some banks offer discount on interest rate and down payment
      const effectiveInterestRate = isEV && bank.ev_incentive_discount_percent 
        ? Math.max(0, bank.interest_rate_percent - bank.ev_incentive_discount_percent)
        : bank.interest_rate_percent;

      // Calculate down payment (percentage of total car price, not just delta)
      const minDownPaymentRequired = targetCarPriceEtb * (bank.min_down_payment_percent / 100);

      // If trade-in covers the down payment, the loan amount is just the delta.
      // Otherwise, they need to put cash down to meet the min down payment.
      const loanAmount = Math.max(0, targetCarPriceEtb - Math.max(tradeInValueEtb, minDownPaymentRequired));

      // Skip banks if loan amount is below their minimum
      if (bank.min_loan_amount_etb && loanAmount < bank.min_loan_amount_etb) {
        continue;
      }
      if (bank.max_loan_amount_etb && loanAmount > bank.max_loan_amount_etb) {
        continue;
      }

      // Amortization Calculation (Standard PMT formula)
      const maxTerm = bank.max_loan_term_months;
      let monthlyInstallment = 0;
      let totalPayable = 0;

      if (loanAmount > 0 && maxTerm > 0) {
        const monthlyRate = (effectiveInterestRate / 100) / 12;
        if (monthlyRate === 0) {
          monthlyInstallment = loanAmount / maxTerm;
        } else {
          monthlyInstallment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, maxTerm)) / (Math.pow(1 + monthlyRate, maxTerm) - 1);
        }
        totalPayable = monthlyInstallment * maxTerm;
      }

      const processingFeeEstimate = loanAmount * (bank.processing_fee_percent / 100);

      bankSuggestions.push({
        bankId: bank.id,
        bankName: bank.name,
        logoUrl: bank.logo_url,
        interestRate: effectiveInterestRate,
        minDownPaymentRequired,
        maxLoanTermMonths: maxTerm,
        monthlyInstallmentEstimate: monthlyInstallment,
        totalPayableEstimate: totalPayable,
        processingFeeEstimate
      });
    }

    return {
      vehiclePriceEtb: targetCarPriceEtb,
      tradeInValueEtb: tradeInValueEtb,
      deltaBalance: delta,
      insuranceEstimate,
      isEV,
      bankSuggestions
    };
  }
}
