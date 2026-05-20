import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LedgerService } from '../finance/ledger.service';

@Injectable()
export class VehicleExpensesService {
  private readonly logger = new Logger(VehicleExpensesService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly ledgerService: LedgerService,
  ) {}

  async createExpense(vehicleId: string, data: { amount: number; purpose: string; category?: string; staffId?: string }) {
    try {
      const supabase = this.supabaseService.getClient();
      
      // 1. Create Expense Record
      const { data: expense, error: expError } = await supabase
        .from('vehicle_expenses')
        .insert([{
          vehicle_id: vehicleId,
          amount_etb: data.amount,
          purpose: data.purpose,
          category: data.category || 'MAINTENANCE',
          staff_id: data.staffId,
          is_authorized: true // District Managers authorize by default
        }])
        .select()
        .single();
      
      if (expError) throw expError;

      // Post to Double-Entry Financial Ledger
      try {
        await this.ledgerService.postTransaction(
          `Vehicle Expense - Renovation of Vehicle ${vehicleId} (${data.purpose})`,
          'VEHICLE_EXPENSE',
          expense.id,
          [
            { accountName: 'Vehicle Repair Expense', type: 'DEBIT', amount: data.amount },
            { accountName: 'Operational Cash', type: 'CREDIT', amount: data.amount }
          ],
          data.staffId
        );
      } catch (ledgErr) {
        this.logger.error(`Failed to post vehicle expense ledger transaction: ${ledgErr.message}`);
        // We log but don't crash standard operations, or we could bubble up if we want hard assertions.
      }

      // 2. Refetch All Expenses for this vehicle to calculate total landed cost
      const { data: allExpenses } = await supabase
        .from('vehicle_expenses')
        .select('amount_etb')
        .eq('vehicle_id', vehicleId);
      
      const totalRenovationCost = (allExpenses || []).reduce((sum, e) => sum + (e.amount_etb || 0), 0);

      // 3. Update Vehicle Master Landed Cost
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('retail_price_etb')
        .eq('id', vehicleId)
        .single();
      
      // Landed cost is often the acquisition cost + renovation. For simplicity, we track renovation as a component.
      await supabase
        .from('vehicles')
        .update({ 
           total_landed_cost_etb: totalRenovationCost,
           status: 'UNDER_REPAIR' // Move to repair lifecycle stage automatically
        })
        .eq('id', vehicleId);

      return expense;
    } catch (err) {
      this.logger.error(`Failed to log expense for vehicle ${vehicleId}`, err);
      throw err;
    }
  }

  async getVehicleExpenses(vehicleId: string) {
    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('vehicle_expenses')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      this.logger.error(`Error fetching expenses for vehicle ${vehicleId}`, err);
      return [];
    }
  }

  async deleteExpense(expenseId: string) {
    try {
      const supabase = this.supabaseService.getClient();
      const { data: expense } = await supabase.from('vehicle_expenses').select('vehicle_id').eq('id', expenseId).single();
      
      const { error } = await supabase.from('vehicle_expenses').delete().eq('id', expenseId);
      if (error) throw error;

      if (expense?.vehicle_id) {
        // Recalculate landed cost
        const { data: allExpenses } = await supabase.from('vehicle_expenses').select('amount_etb').eq('vehicle_id', expense.vehicle_id);
        const totalCost = (allExpenses || []).reduce((sum, e) => sum + (e.amount_etb || 0), 0);
        await supabase.from('vehicles').update({ total_landed_cost_etb: totalCost }).eq('id', expense.vehicle_id);
      }
      
      return { success: true };
    } catch (err) {
      this.logger.error(`Failed to delete expense ${expenseId}`, err);
      throw err;
    }
  }
}
