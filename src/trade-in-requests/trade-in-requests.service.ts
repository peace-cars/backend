import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseScopedService } from '../supabase/supabase-scoped.service';
import { SupabaseService } from '../supabase/supabase.service';
import { Role } from '../auth/roles.enums';
import { PermissionsService } from '../auth/permissions.service';

@Injectable()
export class TradeInRequestsService {
  constructor(
    private readonly supabaseService: SupabaseScopedService,
    private readonly adminSupabase: SupabaseService,
    private readonly permissions: PermissionsService
  ) {}

  async getAllLeads(userId: string, userRole: Role, scopedBranchIds?: string[], explicitBranchId?: string) {
    // Use admin client to bypass RLS on inspections table
    // Endpoint is already protected by RolesGuard + ScopeGuard; scoping is applied manually below
    const supabase = this.adminSupabase.getClient();
    let query = supabase
      .from('trade_in_requests')
      .select(`
        id, created_at, vehicle_make_model, car_description,
        user_asking_price_etb, status, photos, financing_requested,
        vehicle_details, contact_phone, contact_city,
        profiles!trade_in_requests_customer_id_fkey(full_name, phone_number),
        branches!trade_in_requests_branch_id_fkey(name, address),
        branch_id,
        inspections(
          *,
          profiles:inspector_id(full_name, role)
        )
      `);

    // If an explicit branch is requested by a GM/DM, filter to that branch.
    // Ensure the branch requested is actually within their scope (or they are GM).
    if (explicitBranchId) {
      if (userRole === Role.GENERAL_MANAGER || userRole === Role.FINANCE_AUDITOR) {
        query = query.eq('branch_id', explicitBranchId);
      } else if (scopedBranchIds && scopedBranchIds.includes(explicitBranchId)) {
        query = query.eq('branch_id', explicitBranchId);
      } else {
        // If they requested a branch they don't have access to, return empty or default to their scope.
        // We'll throw forbidden to be safe.
        throw new ForbiddenException("You do not have access to this branch.");
      }
    } else {
      if (userRole === Role.GENERAL_MANAGER || userRole === Role.FINANCE_AUDITOR) {
         // Global view — no filter
      } else if (scopedBranchIds && scopedBranchIds.length > 0) {
         // Use hierarchy-aware scoping via scopedBranchIds
         query = query.or(
           scopedBranchIds.map(id => `branch_id.eq.${id}`).join(',') + ',branch_id.is.null'
         );
      } else {
         // Fallback: scope by user's assigned branch
         const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', userId).single();
         if (profile?.branch_id) {
            query = query.or(`branch_id.eq.${profile.branch_id},branch_id.is.null`);
         } else {
            query = query.is('branch_id', null);
         }
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);

    return data.map((req: any) => ({
      id: req.id,
      customer: req.profiles?.full_name || 'Walk-in',
      phone: req.contact_phone || req.profiles?.phone_number || 'No contact',
      vehicle: req.vehicle_make_model,
      plate: req.car_description || 'Unknown',
      arrivedAt: req.created_at,
      location: req.branches?.name || 'Local',
      locationAddress: req.branches?.address || '',
      financing: req.financing_requested,
      status: req.status,
      photos: req.photos,
      askingPrice: req.user_asking_price_etb,
      inspections: req.inspections,
      vehicleDetails: req.vehicle_details || {},
      contactPhone: req.contact_phone,
      contactCity: req.contact_city,
    }));
  }

  async getAssignedLeads(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', userId).single();
    if (!profile) throw new BadRequestException('Profile not found');

    const { data, error } = await supabase
      .from('trade_in_requests')
      .select(`
        id, created_at, vehicle_make_model, car_description,
        user_asking_price_etb, status, photos, financing_requested,
        profiles!trade_in_requests_customer_id_fkey(full_name, phone_number),
        branches!trade_in_requests_branch_id_fkey(name, address)
      `)
      .or(`assigned_staff_id.eq.${userId},and(status.eq.NEW_LEAD,branch_id.eq.${profile.branch_id})`)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    return data.map((req: any) => ({
      id: req.id,
      customer: req.profiles?.full_name || 'Walk-in',
      phone: req.profiles?.phone_number || 'No contact',
      vehicle: req.vehicle_make_model,
      plate: req.car_description || 'Unknown',
      arrivedAt: req.created_at,
      location: req.branches?.name || 'Local',
      financing: req.financing_requested,
      status: req.status,
      photos: req.photos
    }));
  }

  async processInspectionUpload(userId: string, data: any) {
    const supabase = this.supabaseService.getClient();
    const admin = this.adminSupabase.getClient();
    const { 
      leadId, 
      mechanical_score, 
      exterior_score, 
      interior_score,
      checklist,
      ev_data,
      final_notes
    } = data;

    // 1. Fetch lead to check assignment
    const { data: lead } = await admin
      .from('trade_in_requests')
      .select('assigned_staff_id')
      .eq('id', leadId)
      .single();

    // 2. Verify Inspector Privileges
    const { data: profile } = await admin
      .from('profiles')
      .select('is_inspector_verified, branch_id, role')
      .eq('id', userId)
      .single();

    const isAssigned = lead?.assigned_staff_id === userId;
    const isDM = profile?.role === Role.DISTRICT_MANAGER || profile?.role === Role.GENERAL_MANAGER;

    if (!profile?.is_inspector_verified && !isDM && !isAssigned) {
      throw new ForbiddenException('ACCESS DENIED: You are not authorized or assigned to this evaluation.');
    }

    // Insert Inspection Record
    const { error: insError } = await admin
      .from('inspections')
      .insert({
        trade_in_id: leadId,
        inspector_id: userId,
        mechanical_score,
        exterior_score,
        interior_score,
        checklist: checklist || {},
        detailed_photos: [], // Placeholder for future media handling
        ev_data: ev_data || {},
        final_notes: final_notes || '',
        is_certified: true
      });
      
    if (insError) throw new BadRequestException(insError.message);

    // 4. Mark Task as COMPLETED if exists
    await admin
      .from('staff_tasks')
      .update({ status: 'COMPLETED', completed_at: new Date() })
      .eq('trade_in_id', leadId)
      .eq('assigned_to', userId);

    // AI Pricing / Risk Guardian Logic
    const averageScore = (mechanical_score + exterior_score + interior_score) / 3;
    let riskFlag = null;
    let newStatus = 'MANAGER_REVIEW';

    if (averageScore < 40) {
      riskFlag = 'HIGH_RISK_REJECTION_RECOMMENDED';
    } else if (mechanical_score < 50) {
      riskFlag = 'POWERTRAIN_WARNING';
    }

    const { error: updError } = await admin
      .from('trade_in_requests')
      .update({ 
        status: newStatus,
        staff_notes: riskFlag ? `[RISK GUARDIAN: ${riskFlag}]` : 'Standard Evaluation Passed.'
      })
      .eq('id', leadId);

    if (updError) throw new BadRequestException(updError.message);

    // Notify Manager (DM) if needed
    if (riskFlag && profile?.branch_id) {
      const { data: loc } = await admin
        .from('locations')
        .select('manager_id')
        .eq('id', profile.branch_id)
        .single();
        
      if (loc?.manager_id) {
        await admin.from('notifications').insert({
          recipient_id: loc.manager_id, 
          title: 'HIGH RISK EVALUATION',
          message: `A vehicle at associated location was flagged: ${riskFlag}`,
          type: 'INSPECTION_ALERT',
          reference_id: leadId
        });
      }
    }

    return { 
      success: true, 
      riskProfile: riskFlag || 'LOW_RISK', 
      timestamp: new Date() 
    };
  }

  async createLead(authUserId: string, data: any) {
    const supabase = this.supabaseService.getClient();
    const { vehicleMakeModel, carDescription, askingPrice, locationId, photos } = data;
    
    const photoArray = Array.isArray(photos) ? photos : [];

    // Build the insert payload with optional rich vehicle details
    const insertPayload: any = {
      customer_id: authUserId,
      vehicle_make_model: vehicleMakeModel,
      car_description: carDescription,
      user_asking_price_etb: askingPrice,
      branch_id: locationId,
      status: 'NEW_LEAD',
      photos: photoArray,
      financing_requested: data.financingRequested || false,
    };

    // Add structured vehicle details if provided (Country Standard form)
    if (data.vehicleDetails && typeof data.vehicleDetails === 'object') {
      insertPayload.vehicle_details = data.vehicleDetails;
    }

    // Add contact info if provided
    if (data.contactPhone) {
      insertPayload.contact_phone = data.contactPhone;
    }
    if (data.contactCity) {
      insertPayload.contact_city = data.contactCity;
    }

    const { data: lead, error } = await supabase
      .from('trade_in_requests')
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return lead;
  }

  async getCustomerLeads(userId: string, customerId: string) {
    const admin = this.adminSupabase.getClient();
    const { data, error } = await admin
      .from('trade_in_requests')
      .select(`
        *,
        inspections(
          *,
          profiles:inspector_id(full_name, role)
        )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateStatus(userId: string, userRole: Role, leadId: string, status: string) {
    if (userRole !== Role.GENERAL_MANAGER && userRole !== Role.FINANCE_AUDITOR) {
      const canAccess = await this.permissions.canAccessTradeIn(userId, userRole, leadId);
      if (!canAccess) {
        throw new ForbiddenException('You do not have permission to update this trade-in lead.');
      }
    }

    const admin = this.adminSupabase.getClient();
    const { data, error } = await admin
      .from('trade_in_requests')
      .update({ status })
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async approveLead(leadId: string, offerPrice: number, notes?: string, callerRole?: Role) {
    const admin = this.adminSupabase.getClient();

    // Validate lead exists and is in an approvable state
    const { data: existing, error: fetchError } = await admin
      .from('trade_in_requests')
      .select('status')
      .eq('id', leadId)
      .single();

    if (fetchError || !existing) {
      throw new BadRequestException('Trade-in request not found.');
    }

    const approvableStatuses = ['MANAGER_REVIEW', 'ESCALATED_TO_GM', 'INSPECTION_PENDING'];
    if (!approvableStatuses.includes(existing.status)) {
      throw new BadRequestException(
        `Cannot approve a lead with status "${existing.status}". Expected one of: ${approvableStatuses.join(', ')}.`
      );
    }

    // Write to the correct notes column based on the caller's role
    const isGM = callerRole === Role.GENERAL_MANAGER;
    const notesPayload: Record<string, any> = {
      status: 'OFFER_MADE',
      final_dealer_offer_etb: offerPrice,
    };

    if (isGM) {
      notesPayload.gm_notes = notes || 'Valuation authorized by General Manager.';
    } else {
      notesPayload.dm_notes = notes || 'Valuation approved by District Manager.';
    }

    const { data, error } = await admin
      .from('trade_in_requests')
      .update(notesPayload)
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async rejectLead(leadId: string, reason: string, callerRole?: Role) {
    const admin = this.adminSupabase.getClient();

    // Write to the correct notes column based on the caller's role
    const isGM = callerRole === Role.GENERAL_MANAGER;
    const notesPayload: Record<string, any> = {
      status: 'REJECTED',
    };

    if (isGM) {
      notesPayload.gm_notes = reason || 'Asset rejected by General Manager.';
    } else {
      notesPayload.dm_notes = reason || 'Asset did not meet registry standards.';
    }

    const { data, error } = await admin
      .from('trade_in_requests')
      .update(notesPayload)
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getLeadById(userId: string, userRole: Role, leadId: string) {
    // Ownership/Access check
    const hasAccess = await this.permissions.canAccessTradeIn(userId, userRole, leadId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have permission to view this trade-in lead.');
    }

    const supabase = this.supabaseService.getClient();
    const { data: lead, error } = await supabase
      .from('trade_in_requests')
      .select(`
        id, created_at, vehicle_make_model, car_description,
        user_asking_price_etb, status, photos, financing_requested,
        profiles!trade_in_requests_customer_id_fkey(full_name, phone_number),
        branches!trade_in_requests_branch_id_fkey(name, address),
        branch_id
      `)
      .eq('id', leadId)
      .single();

    if (error) throw new BadRequestException(error.message);
    
    const castData = lead as any;
    return {
      id: castData.id,
      customer: castData.profiles?.full_name || 'Walk-in',
      phone: castData.profiles?.phone_number || 'No contact',
      vehicle: castData.vehicle_make_model,
      plate: castData.car_description || 'Unknown',
      arrivedAt: castData.created_at,
      location: castData.branches?.name || 'Local',
      financing: castData.financing_requested,
      status: castData.status,
      photos: castData.photos,
      user_asking_price_etb: castData.user_asking_price_etb,
      assigned_staff_id: castData.assigned_staff_id
    };
  }
}
