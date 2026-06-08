import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AlertDispatcherService {
  private readonly logger = new Logger(AlertDispatcherService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async dispatchInspectionAlert(branchId: string, riskFlag: string, leadId: string) {
    const admin = this.supabaseService.getClient();

    const { data: loc } = await admin
      .from('branches')
      .select('district(manager_id)')
      .eq('id', branchId)
      .single();
      
    const district = loc?.district as any;
    if (district?.manager_id) {
      const { error } = await admin.from('notifications').insert({
        recipient_id: district.manager_id, 
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

  async dispatchTaskAssignedAlert(staffId: string, leadId: string) {
    const admin = this.supabaseService.getClient();
    const { error } = await admin.from('notifications').insert({
      recipient_id: staffId, 
      title: 'New Inspection Assigned',
      message: `You have been assigned to evaluate a new trade-in request.`,
      type: 'LEAD_ASSIGNED',
      reference_id: leadId
    });
    if (error) {
      this.logger.error(`Failed to dispatch task alert: ${error.message}`);
    }
  }
}
