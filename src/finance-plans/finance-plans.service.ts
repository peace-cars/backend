import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseScopedService } from '../supabase/supabase-scoped.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role } from '../auth/roles.enums';

@Injectable()
export class FinancePlansService {
  private readonly logger = new Logger(FinancePlansService.name);

  constructor(
    private readonly supabaseService: SupabaseScopedService,
    private readonly notificationsService: NotificationsService
  ) {}

  async create(userId: string, data: any) {
    const supabase = this.supabaseService.getClient();
    
    const { data: plan, error } = await supabase
      .from('finance_plans')
      .insert([{
        customer_id: userId,
        vehicle_id: data.vehicleId,
        bank_id: data.bankId,
        down_payment_etb: data.downPaymentEtb,
        loan_amount_etb: data.loanAmountEtb,
        term_months: data.termMonths,
        interest_rate: data.interestRate,
        monthly_payment_etb: data.monthlyPaymentEtb,
        trade_in_value_etb: data.tradeInValueEtb || 0,
        insurance_cost_etb: data.insuranceCostEtb || 0,
        processing_fee_etb: data.processingFeeEtb || 0,
        total_payable_etb: data.totalPayableEtb || 0,
        status: 'SUBMITTED'
      }])
      .select('*, vehicles(make, model)')
      .single();

    if (error) {
      this.logger.error(`Failed to create finance plan: ${error.message}`);
      throw new BadRequestException('Failed to submit finance application.');
    }

    const vehicleLabel = plan.vehicles ? `${plan.vehicles.make} ${plan.vehicles.model}` : 'a vehicle';
    
    // Notify GM/Staff about new application
    await this.notificationsService.broadcastToRole(
      'GENERAL_MANAGER',
      '🏦 New Finance Application',
      `A new financing application was submitted for ${vehicleLabel}.`,
      'FINANCE_UPDATE',
      plan.id
    );

    // Notify Customer
    await this.notificationsService.notifyFinanceUpdate(
      userId,
      plan.id,
      'SUBMITTED',
      vehicleLabel
    );

    return plan;
  }

  async getAll(userId: string, userRole: string) {
    const supabase = this.supabaseService.getClient();
    let query = supabase.from('finance_plans').select(`
      *,
      vehicles(make, model, year, price),
      bank_partners(name, logo_url),
      profiles:customer_id(full_name, phone)
    `).order('created_at', { ascending: false });

    // If not staff, only show their own plans
    if (![Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR].includes(userRole as Role)) {
      query = query.eq('customer_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async updateStatus(planId: string, status: string, notes?: string) {
    const supabase = this.supabaseService.getClient();
    
    const { data: plan, error } = await supabase
      .from('finance_plans')
      .update({ status, admin_notes: notes })
      .eq('id', planId)
      .select('customer_id, vehicles(make, model)')
      .single();

    if (error || !plan) {
      throw new NotFoundException('Finance plan not found or update failed.');
    }

    const v = plan.vehicles as any;
    const vehicleLabel = v ? `${v.make} ${v.model}` : 'your vehicle';

    await this.notificationsService.notifyFinanceUpdate(
      plan.customer_id,
      planId,
      status,
      vehicleLabel
    );

    return { success: true, status };
  }
}
