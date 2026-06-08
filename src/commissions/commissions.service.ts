import { Injectable, Logger, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LedgerService } from '../finance/ledger.service';
import { AuthenticatedUser } from '../common/types/user.types';
import { Role } from '../auth/roles.enums';

@Injectable()
export class CommissionsService {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly ledgerService: LedgerService,
  ) {}

  async getAll(user: AuthenticatedUser, branchId?: string) {
    const client = this.supabaseService.getClient();
    let query = client
      .from('commissions')
      .select('*, profiles!commissions_beneficiary_id_fkey(full_name, role, branch_id)')
      .order('created_at', { ascending: false });

    if (branchId) {
      if (user.role === Role.GENERAL_MANAGER || user.role === Role.FINANCE_AUDITOR) {
        query = query.eq('branch_id', branchId);
      } else if (user.role === Role.DISTRICT_MANAGER && user.scopedBranchIds?.includes(branchId)) {
        query = query.eq('branch_id', branchId);
      } else {
        return [];
      }
    } else {
      if (user.role === Role.DISTRICT_MANAGER && user.scopedBranchIds?.length > 0) {
        query = query.in('branch_id', user.scopedBranchIds);
      }
    }

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    
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

  async dmVerify(id: string, user: AuthenticatedUser) {
    const client = this.supabaseService.getClient();

    if (user.scopedBranchIds?.length > 0) {
      const { data: commission } = await client
        .from('commissions')
        .select('branch_id')
        .eq('id', id)
        .single();

      if (commission?.branch_id && !user.scopedBranchIds.includes(commission.branch_id)) {
        this.logger.warn(`[SCOPE DENIED] DM ${user.id} tried to verify commission ${id} outside district`);
        throw new ForbiddenException('Cannot verify commissions outside your district.');
      }
    }

    const { error } = await client
      .from('commissions')
      .update({ dm_verified: true, dm_verified_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  async gmApprove(id: string, user: AuthenticatedUser) {
    const client = this.supabaseService.getClient();

    const { data: commission } = await client
      .from('commissions')
      .select('dm_verified, amount_etb, type, beneficiary_id')
      .eq('id', id)
      .single();

    if (!commission?.dm_verified) {
      throw new BadRequestException('Cannot approve: DM verification is required first.');
    }

    const { error } = await client
      .from('commissions')
      .update({ 
        gm_approved: true, 
        is_paid: true,
        payout_date: new Date().toISOString(),
        approved_by: user.id
      })
      .eq('id', id);
    
    if (error) throw new BadRequestException(error.message);

    try {
      await this.ledgerService.postTransaction(
        `Disbursement of commission payout for record ${id} (Type: ${commission.type})`,
        'COMMISSION_PAID',
        id,
        [
          { accountName: 'Commission Expense', type: 'DEBIT', amount: commission.amount_etb },
          { accountName: 'Operational Cash', type: 'CREDIT', amount: commission.amount_etb }
        ],
        user.id
      );
    } catch (ledgErr: any) {
      this.logger.error(`Ledger record posting failed for commission approval ${id}: ${ledgErr.message}`);
    }

    this.logger.log(`Commission ${id} settled by ${user.role} (${user.id})`);
    return { success: true };
  }

  async getById(id: string, user: AuthenticatedUser) {
    const client = this.supabaseService.getClient();

    const { data: commission, error: cErr } = await client
      .from('commissions')
      .select('*')
      .eq('id', id)
      .single();

    if (cErr) throw new BadRequestException(cErr.message);
    if (!commission) throw new NotFoundException('Commission not found');

    let vehicle = null;
    if (commission.vehicle_id) {
      const { data: v, error: vErr } = await client
        .from('vehicles')
        .select('id, make, model, year, retail_price_etb, images, status')
        .eq('id', commission.vehicle_id)
        .single();
      if (!vErr) vehicle = v;
    }

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
