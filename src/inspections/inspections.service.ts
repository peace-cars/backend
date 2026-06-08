import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseScopedService } from '../supabase/supabase-scoped.service';

@Injectable()
export class InspectionsService {
  private readonly logger = new Logger(InspectionsService.name);

  constructor(private supabaseScoped: SupabaseScopedService) {}

  async getById(id: string) {
    try {
      const client = this.supabaseScoped.getClient();
      const { data, error } = await client
        .from('inspections')
        .select(`
          *,
          profiles(full_name, role)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      if (!data) throw new NotFoundException(`Inspection ${id} not found`);

      return data;
    } catch (err) {
      this.logger.error(`Failed to fetch inspection ${id}`, err);
      throw err;
    }
  }

  async getByVehicleId(vehicleId: string) {
    try {
      const client = this.supabaseScoped.getClient();
      const { data, error } = await client
        .from('inspections')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false });
      
      if (error) throw new BadRequestException(error.message);
      return data;
    } catch (err) {
      this.logger.error(`Failed to fetch inspections for vehicle ${vehicleId}`, err);
      throw err;
    }
  }

  async getByTradeInId(tradeInId: string) {
    try {
      const client = this.supabaseScoped.getClient();
      const { data, error } = await client
        .from('inspections')
        .select('*')
        .eq('trade_in_id', tradeInId)
        .order('created_at', { ascending: false });
      
      if (error) throw new BadRequestException(error.message);
      return data;
    } catch (err) {
      this.logger.error(`Failed to fetch inspections for trade-in ${tradeInId}`, err);
      throw err;
    }
  }
}
