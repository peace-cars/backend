import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class BankPartnersService {
  private readonly logger = new Logger(BankPartnersService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getAll(activeOnly: boolean = true) {
    const client = this.supabaseService.getClient();
    let query = client.from('bank_partners').select('*').order('name', { ascending: true });
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    if (error) {
      this.logger.error(`Error fetching bank partners: ${error.message}`);
      return [];
    }
    
    return data;
  }

  async getById(id: string) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.from('bank_partners').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  }
}
