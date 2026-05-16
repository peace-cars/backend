import { Injectable, Logger } from '@nestjs/common';
import { SupabaseScopedService } from '../supabase/supabase-scoped.service';

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(private supabaseService: SupabaseScopedService) {}

  async findAll() {
    try {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('branches')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      this.logger.error('Failed fetching locations', err);
      return [];
    }
  }
}
