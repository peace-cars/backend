import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class StaffBudgetsService {
  private readonly logger = new Logger(StaffBudgetsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

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
          profiles!staff_budgets_requester_id_fkey(full_name, role, location_id, locations(name))
        `)
        .eq('profiles.location_id', locationId);

      if (error) {
        this.logger.error(`Error fetching branch budgets: ${error.message}`);
        return [];
      }
      
      // Filter out profiles that are not in the location (due to how PostgREST works with joins)
      return (data || []).filter((b: any) => b.profiles?.location_id === locationId);
    } catch (e) {
      this.logger.error(`Failed to fetch branch budgets: ${e.message}`);
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

  async approveBudget(id: string, approverId: string, amountApproved: number) {
    try {
      const { data, error } = await this.supabaseService.getClient()
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
      return null;
    }
  }

  async disburseBudget(id: string, auditorId: string) {
    try {
      const { data, error } = await this.supabaseService.getClient()
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
      return null;
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
