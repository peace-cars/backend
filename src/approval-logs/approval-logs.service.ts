import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ApprovalLogsService {
  private readonly logger = new Logger(ApprovalLogsService.name);

  constructor(private readonly supabaseAdmin: SupabaseService) {}

  async createLog(data: {
    entity_id: string;
    entity_type: string;
    action: string;
    user_id: string;
    previous_state?: string;
    new_state?: string;
    notes?: string;
  }) {
    try {
      const admin = this.supabaseAdmin.getClient();
      const { error } = await admin.from('approval_logs').insert([data]);
      
      if (error) {
        this.logger.error(`Failed to create approval log: ${error.message}`);
        throw new BadRequestException(error.message);
      }
      return true;
    } catch (err) {
      this.logger.error('Error creating approval log', err);
      // We don't throw here to avoid failing the main transaction if logging fails,
      // but we log it locally.
      return false;
    }
  }

  async getByEntityId(entityId: string) {
    try {
      const admin = this.supabaseAdmin.getClient();
      const { data, error } = await admin
        .from('approval_logs')
        .select(`
          *,
          profiles:user_id(full_name, role)
        `)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });
      
      if (error) throw new BadRequestException(error.message);
      return data;
    } catch (err) {
      this.logger.error(`Failed to fetch approval logs for entity ${entityId}`, err);
      throw err;
    }
  }

  async getByUserId(userId: string) {
    try {
      const admin = this.supabaseAdmin.getClient();
      const { data, error } = await admin
        .from('approval_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw new BadRequestException(error.message);
      return data;
    } catch (err) {
      this.logger.error(`Failed to fetch approval logs for user ${userId}`, err);
      throw err;
    }
  }
}
