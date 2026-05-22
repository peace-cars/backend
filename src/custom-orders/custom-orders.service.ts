import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { Role } from '../auth/roles.enums';

@Injectable()
export class CustomOrdersService {
  private readonly logger = new Logger(CustomOrdersService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async create(data: any) {
    const client = this.supabaseService.getClient();

    const payload = {
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      make: data.make,
      model: data.model,
      year_range: data.yearRange || '2022-2025',
      fuel_type: data.fuelType || 'ELECTRIC',
      duty_preference: data.dutyPreference || 'DUTY_PAID',
      budget_etb: data.budgetEtb ? Number(data.budgetEtb) : null,
      notes: data.notes || null,
      status: 'PENDING',
    };

    const { data: order, error } = await client
      .from('custom_orders')
      .insert(payload)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create custom order: ${error.message}`);
      throw new BadRequestException(error.message);
    }

    return order;
  }

  async getAll(userRole: Role, scopedBranchIds?: string[]) {
    const client = this.supabaseService.getClient();

    let query = client
      .from('custom_orders')
      .select(`
        *,
        profiles:assigned_staff_id(full_name, phone_number, role)
      `);

    // GM and Finance see everything; others see only their scoped orders
    if (userRole !== Role.GENERAL_MANAGER && userRole !== Role.FINANCE_AUDITOR) {
      if (scopedBranchIds && scopedBranchIds.length > 0) {
        query = query.or(
          scopedBranchIds.map(id => `branch_id.eq.${id}`).join(',') + ',branch_id.is.null'
        );
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch custom orders: ${error.message}`);
      throw new BadRequestException(error.message);
    }

    return (data || []).map((o: any) => ({
      id: o.id,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      make: o.make,
      model: o.model,
      yearRange: o.year_range,
      fuelType: o.fuel_type,
      dutyPreference: o.duty_preference,
      budgetEtb: o.budget_etb,
      notes: o.notes,
      status: o.status,
      assignedStaff: o.profiles?.full_name || null,
      assignedStaffPhone: o.profiles?.phone_number || null,
      staffNotes: o.staff_notes,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    }));
  }

  async updateStatus(id: string, status: string, staffNotes?: string) {
    const client = this.supabaseService.getClient();

    const updatePayload: any = { status };
    if (staffNotes) updatePayload.staff_notes = staffNotes;

    const { data, error } = await client
      .from('custom_orders')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update custom order status: ${error.message}`);
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async assignStaff(id: string, staffId: string) {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('custom_orders')
      .update({ assigned_staff_id: staffId, status: 'REVIEWING' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to assign staff to custom order: ${error.message}`);
      throw new BadRequestException(error.message);
    }

    return data;
  }

  async getStats() {
    const client = this.supabaseService.getClient();

    const { count: activeCount, error: activeError } = await client
      .from('custom_orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['PENDING', 'REVIEWING', 'SOURCING']);

    if (activeError) {
      this.logger.warn(`Stats query failed: ${activeError.message}`);
      return { activeRequests: 0, totalRequests: 0 };
    }

    const { count: totalCount, error: totalError } = await client
      .from('custom_orders')
      .select('*', { count: 'exact', head: true });

    return {
      activeRequests: activeCount || 0,
      totalRequests: totalCount || 0,
    };
  }
}
