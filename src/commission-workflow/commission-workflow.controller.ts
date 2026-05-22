import { Controller, Get, Patch, Body, Param, UseGuards, Req, Logger, Query } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RolesGuard } from '../auth/roles.guard';
import { ScopeGuard } from '../auth/scope.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';
import { LedgerService } from '../finance/ledger.service';

/**
 * Commission Workflow Controller
 * 
 * Manages the two-step approval pipeline for partner incentives:
 *   1. DM Verify   → District Manager confirms the payout is legitimate
 *   2. GM/Finance Approve → Final authorization + marks as paid
 * 
 * Commission amount calculation (done at creation time):
 *   commission = sale_price × commission_tier_percentage
 *   profit_margin = sale_price - total_unit_cost
 * 
 * RBAC:
 *   - DM can only verify commissions from their scoped branches
 *   - GM has global approve rights
 *   - FINANCE_AUDITOR can approve (final settlement authority)
 *   - All three roles can read the ledger
 */
@Controller('commission-workflow')
@UseGuards(RolesGuard, ScopeGuard)
export class CommissionWorkflowController {
  private readonly logger = new Logger(CommissionWorkflowController.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly ledgerService: LedgerService,
  ) {}

  @Get()
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getAll(@Req() req: any, @Query('branchId') branchId?: string) {
    const client = this.supabaseService.getClient();
    let query = client
      .from('commissions')
      .select('*, profiles!commissions_beneficiary_id_fkey(full_name, role, branch_id)')
      .order('created_at', { ascending: false });

    if (branchId) {
      if (req.user.role === Role.GENERAL_MANAGER || req.user.role === Role.FINANCE_AUDITOR) {
        query = query.eq('branch_id', branchId);
      } else if (req.user.role === Role.DISTRICT_MANAGER && req.user.scopedBranchIds?.includes(branchId)) {
        query = query.eq('branch_id', branchId);
      } else {
        return [];
      }
    } else {
      // DM scoping: only see commissions from staff in their district branches
      if (req.user.role === Role.DISTRICT_MANAGER && req.user.scopedBranchIds?.length > 0) {
        query = query.in('branch_id', req.user.scopedBranchIds);
      }
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    
    return (data || []).map((c: any) => ({
      id: c.id,
      beneficiaryName: c.profiles?.full_name,
      beneficiaryRole: c.profiles?.role,
      type: c.type,
      amountEtb: c.amount_etb,
      profitMargin: c.profit_margin || 0,
      dmVerified: c.dm_verified,
      gmApproved: c.gm_approved,
      isPaid: c.is_paid,
      payoutDate: c.payout_date,
      createdAt: c.created_at
    }));
  }

  @Patch(':id/dm-verify')
  @Roles(Role.DISTRICT_MANAGER)
  async dmVerify(@Param('id') id: string, @Req() req: any) {
    const client = this.supabaseService.getClient();

    // Scope check: DM can only verify commissions from their district
    if (req.user.scopedBranchIds?.length > 0) {
      const { data: commission } = await client
        .from('commissions')
        .select('branch_id')
        .eq('id', id)
        .single();

      if (commission?.branch_id && !req.user.scopedBranchIds.includes(commission.branch_id)) {
        this.logger.warn(`[SCOPE DENIED] DM ${req.user.id} tried to verify commission ${id} outside district`);
        return { success: false, message: 'Cannot verify commissions outside your district.' };
      }
    }

    const { error } = await client
      .from('commissions')
      .update({ dm_verified: true, dm_verified_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  @Patch(':id/gm-approve')
  @Roles(Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async gmApprove(@Param('id') id: string, @Req() req: any) {
    const client = this.supabaseService.getClient();

    // Ensure DM verification happened first (two-step enforcement)
    const { data: commission } = await client
      .from('commissions')
      .select('dm_verified, amount_etb, type, beneficiary_id')
      .eq('id', id)
      .single();

    if (!commission?.dm_verified) {
      return { success: false, message: 'Cannot approve: DM verification is required first.' };
    }

    const { error } = await client
      .from('commissions')
      .update({ 
        gm_approved: true, 
        is_paid: true,
        payout_date: new Date().toISOString(),
        approved_by: req.user.id
      })
      .eq('id', id);
    
    if (error) return { success: false, message: error.message };

    // Post to Double-Entry Ledger
    try {
      await this.ledgerService.postTransaction(
        `Disbursement of commission payout for record ${id} (Type: ${commission.type})`,
        'COMMISSION_PAID',
        id,
        [
          { accountName: 'Commission Expense', type: 'DEBIT', amount: commission.amount_etb },
          { accountName: 'Operational Cash', type: 'CREDIT', amount: commission.amount_etb }
        ],
        req.user.id
      );
    } catch (ledgErr) {
      this.logger.error(`Ledger record posting failed for commission approval ${id}: ${ledgErr.message}`);
    }

    this.logger.log(`Commission ${id} settled by ${req.user.role} (${req.user.id})`);
    return { success: true };
  }

  @Get(':id')
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getById(@Param('id') id: string, @Req() req: any) {
    const client = this.supabaseService.getClient();

    const { data: commission, error: cErr } = await client
      .from('commissions')
      .select('*')
      .eq('id', id)
      .single();

    if (cErr) throw new Error(cErr.message);
    if (!commission) return { success: false, message: 'Not found' };

    // If commission references a vehicle, fetch vehicle details
    let vehicle = null;
    if (commission.vehicle_id) {
      const { data: v, error: vErr } = await client
        .from('vehicles')
        .select('id, make, model, year, retail_price_etb, images, status')
        .eq('id', commission.vehicle_id)
        .single();
      if (!vErr) vehicle = v;
    }

    // Try to fetch latest inspection report for the vehicle (best-effort)
    let inspection = null;
    if (vehicle) {
      const { data: ins, error: iErr } = await client
        .from('inspections')
        .select('*')
        .eq('vehicle_id', vehicle.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (!iErr) inspection = ins;
    }

    return {
      commission,
      vehicle,
      inspection,
    };
  }
}
