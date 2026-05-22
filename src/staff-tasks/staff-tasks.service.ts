import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class StaffTasksService {
  private readonly logger = new Logger(StaffTasksService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async assignTask(data: any) {
    try {
      const client = this.supabaseService.getClient();
      const { data: result, error } = await client
        .from('staff_tasks')
        .insert([data])
        .select()
        .single();

      if (error) {
        this.logger.error(`Error assigning task: ${error.message}`);
        return null;
      }

      // If this task links to a trade-in lead, grant the assignee evaluation access
      if (data.trade_in_id && data.assigned_to) {
        const { error: linkErr } = await client
          .from('trade_in_requests')
          .update({ assigned_staff_id: data.assigned_to })
          .eq('id', data.trade_in_id);
        if (linkErr) {
          this.logger.warn(`Could not link staff to trade-in: ${linkErr.message}`);
        } else {
          this.logger.log(`Linked staff ${data.assigned_to} to trade-in ${data.trade_in_id} for evaluation access`);
        }
      }

      return result;
    } catch (e) {
      this.logger.error(`Failed to assign task: ${e.message}`);
      return null;
    }
  }

  async getMyTasks(userId: string) {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('staff_tasks')
        .select('*, trade_in_requests(vehicle_make_model, user_asking_price_etb, customer_id, profiles!trade_in_requests_customer_id_fkey(full_name))')
        .eq('assigned_to', userId);

      if (error) {
        this.logger.error(`Error fetching my tasks: ${error.message}`);
        return [];
      }
      return data || [];
    } catch (e) {
      this.logger.error(`Failed to fetch my tasks: ${e.message}`);
      return [];
    }
  }

  async getBranchTasks(locationId: string) {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('staff_tasks')
        .select(`
          *, 
          assigned_to_profile:profiles!staff_tasks_assigned_to_fkey(full_name, branch_id), 
          trade_in_requests(vehicle_make_model, car_description, customer_id, profiles!trade_in_requests_customer_id_fkey(full_name))
        `)
        .eq('assigned_to_profile.branch_id', locationId);

      if (error) {
        this.logger.error(`Error fetching branch tasks: ${error.message}`);
        return [];
      }
      
      // Post-filter because PostgREST nested filtering can be tricky if not perfectly configured
      return (data || []).filter((t: any) => t.assigned_to_profile?.branch_id === locationId);
    } catch (e) {
      this.logger.error(`Failed to fetch branch tasks: ${e.message}`);
      return [];
    }
  }

  async getAllTasks() {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('staff_tasks')
        .select('*, profiles!staff_tasks_assigned_to_fkey(full_name), trade_in_requests(vehicle_make_model)');

      if (error) {
        this.logger.error(`Error fetching all tasks: ${error.message}`);
        return [];
      }
      return data || [];
    } catch (e) {
      this.logger.error(`Failed to fetch all tasks: ${e.message}`);
      return [];
    }
  }

  async updateProgress(id: string, progress_notes: string, location_coordinates?: string) {
    try {
      const payload: any = { progress_notes, status: 'IN_PROGRESS' };
      if (location_coordinates) payload.location_coordinates = location_coordinates;

      const { data, error } = await this.supabaseService.getClient()
        .from('staff_tasks')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.logger.error(`Error updating task progress: ${error.message}`);
        return null;
      }
      return data;
    } catch (e) {
      this.logger.error(`Failed to update task progress: ${e.message}`);
      return null;
    }
  }

  async completeTask(id: string) {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('staff_tasks')
        .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.logger.error(`Error completing task: ${error.message}`);
        return null;
      }
      return data;
    } catch (e) {
      this.logger.error(`Failed to complete task: ${e.message}`);
      return null;
    }
  }
}
