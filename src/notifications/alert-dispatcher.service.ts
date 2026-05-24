import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AlertDispatcherService {
  private readonly logger = new Logger(AlertDispatcherService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async dispatchInspectionAlert(branchId: string, riskFlag: string, leadId: string) {
    const admin = this.supabaseService.getClient();

    const { data: loc } = await admin
      .from('locations')
      .select('manager_id')
      .eq('id', branchId)
      .single();
      
    if (loc?.manager_id) {
      const { error } = await admin.from('notifications').insert({
        recipient_id: loc.manager_id, 
        title: 'HIGH RISK EVALUATION',
        message: `A vehicle at associated location was flagged: ${riskFlag}`,
        type: 'INSPECTION_ALERT',
        reference_id: leadId
      });
      if (error) {
        this.logger.error(`Failed to dispatch alert: ${error.message}`);
      }
    }
  }
}
