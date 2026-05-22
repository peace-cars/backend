import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { FsmService } from '../common/fsm.service';

@Injectable()
export class StaffBudgetsService {
  private readonly logger = new Logger(StaffBudgetsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly fsmService: FsmService,
  ) {}

  async requestBudget(requesterId: string, amount: number, purpose: string, receiptUrl?: string) {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('staff_budgets')
        .insert([{ 
          requester_id: requesterId, 
          amount_requested: amount, 
          purpose, 
          status: 'REQUESTED',
          receipt_url: receiptUrl || null 
        }])
        .select()
        .single();

      if (error) {
        this.logger.error(`Error requesting budget: ${error.message}`);
        return null;
      }
      return data;
    } catch (e) {
      this.logger.error(`Failed to request budget: ${e.message}`);
      return null;
    }
  }

  async getBranchBudgets(locationId: string) {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('staff_budgets')
        .select(`
          *, 
          profiles!staff_budgets_requester_id_fkey(full_name, role, branch_id, locations(name))
        `)
        .eq('profiles.branch_id', locationId);

      if (error) {
        this.logger.error(`Error fetching branch budgets: ${error.message}`);
        return [];
      }
      
      return (data || []).filter((b: any) => b.profiles?.branch_id === locationId);
    } catch (e) {
      this.logger.error(`Failed to fetch branch budgets: ${e.message}`);
      return [];
    }
  }

  async getUserBudgets(userId: string) {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('staff_budgets')
        .select('*, profiles!staff_budgets_requester_id_fkey(full_name, role, locations(name))')
        .eq('requester_id', userId);
      
      if (error) {
        this.logger.error(`Error fetching budgets for user ${userId}: ${error.message}`);
        return [];
      }
      return data || [];
    } catch (e) {
      this.logger.error(`Failed to fetch budgets for user ${userId}: ${e.message}`);
      return [];
    }
  }

  async getDistrictBudgets(districtId: string) {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('staff_budgets')
        .select(`
          *, 
          profiles!staff_budgets_requester_id_fkey(full_name, role, district_id, locations(name))
        `)
        .eq('profiles.district_id', districtId);

      if (error) {
        this.logger.error(`Error fetching district budgets: ${error.message}`);
        return [];
      }
      return (data || []).filter((b: any) => b.profiles?.district_id === districtId);
    } catch (e) {
      this.logger.error(`Failed to fetch district budgets: ${e.message}`);
      return [];
    }
  }

  async getAllBudgets() {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('staff_budgets')
        .select('*, profiles!staff_budgets_requester_id_fkey(full_name, role, locations(name))');
      
      if (error) {
        this.logger.error(`Error fetching budgets: ${error.message}`);
        return [];
      }
      return data || [];
    } catch (e) {
      this.logger.error(`Failed to fetch budgets: ${e.message}`);
      return [];
    }
  }

  async approveBudget(id: string, approverId: string, amountApproved: number, approverRole?: string, approverDistrictId?: string) {
    try {
      const client = this.supabaseService.getClient();

      // 1. Fetch budget with requester's district details
      const { data: budget, error: fetchErr } = await client
        .from('staff_budgets')
        .select('*, profiles!staff_budgets_requester_id_fkey(district_id)')
        .eq('id', id)
        .single();

      if (fetchErr || !budget) {
        throw new Error(`Budget request not found or inaccessible: ${fetchErr?.message}`);
      }

      // Enforce FSM transition
      this.fsmService.validateBudgetTransition(budget.status, 'APPROVED');

      // 2. If DISTRICT_MANAGER, enforce district alignment
      if (approverRole === 'DISTRICT_MANAGER') {
        const requesterDistrict = budget.profiles?.district_id;
        if (!requesterDistrict || requesterDistrict !== approverDistrictId) {
          throw new Error('Access Denied. You can only approve budget requests within your assigned district.');
        }
      }

      // 3. Approve and update
      const { data, error } = await client
        .from('staff_budgets')
        .update({
          status: 'APPROVED',
          approver_id: approverId,
          amount_approved: amountApproved
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.logger.error(`Error approving budget: ${error.message}`);
        return null;
      }
      return data;
    } catch (e) {
      this.logger.error(`Failed to approve budget: ${e.message}`);
      return { error: e.message };
    }
  }

  async disburseBudget(id: string, auditorId: string) {
    try {
      const client = this.supabaseService.getClient();

      // Fetch the current budget status to check FSM transition rules
      const { data: budget, error: fetchErr } = await client
        .from('staff_budgets')
        .select('status')
        .eq('id', id)
        .single();

      if (fetchErr || !budget) {
        throw new Error(`Budget record not found: ${fetchErr?.message}`);
      }

      // Enforce FSM transition: must be in APPROVED state
      this.fsmService.validateBudgetTransition(budget.status, 'DISBURSED');

      const { data, error } = await client
        .from('staff_budgets')
        .update({
          status: 'DISBURSED',
          auditor_id: auditorId,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.logger.error(`Error disbursing budget: ${error.message}`);
        return null;
      }
      return data;
    } catch (e) {
      this.logger.error(`Failed to disburse budget: ${e.message}`);
      throw e;
    }
  }

  async updateReceiptUrl(id: string, receiptUrl: string) {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('staff_budgets')
        .update({ receipt_url: receiptUrl })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (e) {
      this.logger.error(`Failed to update receipt for budget ${id}: ${e.message}`);
      return null;
    }
  }
}
