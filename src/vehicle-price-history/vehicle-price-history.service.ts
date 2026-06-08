import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class VehiclePriceHistoryService {
  private readonly logger = new Logger(VehiclePriceHistoryService.name);

  constructor(private readonly supabaseAdmin: SupabaseService) {}

  async logPriceChange(
    vehicleId: string,
    oldPrice: number,
    newPrice: number,
    changedById: string,
    reason?: string
  ) {
    // Don't log if price didn't actually change
    if (oldPrice === newPrice) return true;

    try {
      const admin = this.supabaseAdmin.getClient();
      const { error } = await admin.from('vehicle_price_history').insert({
        vehicle_id: vehicleId,
        old_price: oldPrice,
        new_price: newPrice,
        changed_by: changedById,
        reason: reason || null
      });
      
      if (error) {
        this.logger.error(`Failed to log price change: ${error.message}`);
        throw new BadRequestException(error.message);
      }
      return true;
    } catch (err) {
      this.logger.error('Error logging price change', err);
      return false; // Don't fail the main transaction
    }
  }

  async getHistory(vehicleId: string) {
    try {
      const admin = this.supabaseAdmin.getClient();
      const { data, error } = await admin
        .from('vehicle_price_history')
        .select(`
          *,
          profiles:changed_by(full_name, role)
        `)
        .eq('vehicle_id', vehicleId)
        .order('changed_at', { ascending: false });
      
      if (error) throw new BadRequestException(error.message);
      return data;
    } catch (err) {
      this.logger.error(`Failed to fetch price history for vehicle ${vehicleId}`, err);
      throw err;
    }
  }
}
