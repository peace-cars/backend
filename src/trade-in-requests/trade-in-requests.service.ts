import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { SupabaseScopedService } from '../supabase/supabase-scoped.service';
import { SupabaseService } from '../supabase/supabase.service';
import { Role } from '../auth/roles.enums';
import { PermissionsService } from '../auth/permissions.service';
import { EvaluationEngineService } from './evaluation-engine.service';
import { AlertDispatcherService } from '../notifications/alert-dispatcher.service';
import { InspectionUploadDto } from './dto/trade-in.dto';

@Injectable()
export class TradeInRequestsService {
  private readonly logger = new Logger(TradeInRequestsService.name);

  constructor(
    private readonly supabaseService: SupabaseScopedService,
    private readonly adminSupabase: SupabaseService,
    private readonly permissions: PermissionsService,
    private readonly evaluationEngine: EvaluationEngineService,
    private readonly alertDispatcher: AlertDispatcherService
  ) {}

  async getAllLeads(userId: string, userRole: Role, scopedBranchIds?: string[], explicitBranchId?: string) {
    // Utilize the admin client as we handle authorization logic explicitly in the controller and service
    const supabase = this.adminSupabase.getClient();
    
    // Fetch profile to get exact branch_id for GM/STAFF
    const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', userId).single();
    const userBranchId = profile?.branch_id;

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

    if (explicitBranchId) {
      if ((userRole as any) === 'ADMIN' || userRole === Role.FINANCE_AUDITOR || (userRole as any) === 'GENERAL_MANAGER') {
        query = query.eq('branch_id', explicitBranchId);
      } else if (scopedBranchIds && scopedBranchIds.includes(explicitBranchId)) {
        query = query.eq('branch_id', explicitBranchId);
      } else {
        throw new ForbiddenException("You do not have access to this branch.");
      }
    } else {
      if ((userRole as any) === 'ADMIN' || userRole === Role.FINANCE_AUDITOR || (userRole as any) === 'GENERAL_MANAGER') {
        // Global view
      } else if (userRole === Role.STAFF) {
        if (userBranchId) {
          query = query.eq('branch_id', userBranchId);
        } else {
          // If Staff lacks a branch, return no leads to be safe
          query = query.is('branch_id', null);
        }
      } else if (scopedBranchIds && scopedBranchIds.length > 0) {
        query = query.in('branch_id', scopedBranchIds);
      } else if (userBranchId) {
        query = query.eq('branch_id', userBranchId);
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
      finalOffer: req.final_dealer_offer_etb,
      inspections: req.inspections,
      vehicleDetails: req.vehicle_details || {},
      contactPhone: req.contact_phone,
      contactCity: req.contact_city,
      branch_id: req.branch_id,
    }));
  }

  async getAssignedLeads(userId: string) {
    const supabase = this.adminSupabase.getClient();
    const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', userId).single();
    if (!profile) throw new BadRequestException('Profile not found');

    this.logger.debug(`getAssignedLeads: userId=${userId}, branch_id=${profile.branch_id}`);

    // Get assigned leads with complete details for staff vehicle inspection
    let query = supabase
      .from('trade_in_requests')
      .select(`
        id, created_at, vehicle_make_model, car_description,
        user_asking_price_etb, status, photos, financing_requested,
        vehicle_details, contact_phone, contact_city, branch_id,
        profiles!trade_in_requests_customer_id_fkey(full_name, phone_number),
        branches!trade_in_requests_branch_id_fkey(name, address),
        inspections(
          *,
          profiles:inspector_id(full_name, role)
        )
      `)
      .order('created_at', { ascending: false });

    if (profile.branch_id) {
      query = query.or(`assigned_staff_id.eq.${userId},branch_id.eq.${profile.branch_id}`);
    } else {
      query = query.eq('assigned_staff_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Error fetching assigned leads: ${error.message}`);
      throw new BadRequestException(error.message);
    }

    const result = (data || []).map((req: any) => ({
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
      finalOffer: req.final_dealer_offer_etb,
      user_asking_price_etb: req.user_asking_price_etb,
      vehicleDetails: req.vehicle_details || {},
      contactPhone: req.contact_phone,
      contactCity: req.contact_city,
      branchId: req.branch_id,
      inspections: req.inspections || []
    }));

    this.logger.debug(`getAssignedLeads: returned ${result.length} leads for staff`);
    return result;
  }

  async processInspectionUpload(userId: string, data: InspectionUploadDto) {
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

    const { data: lead } = await admin
      .from('trade_in_requests')
      .select('assigned_staff_id')
      .eq('id', leadId)
      .single();

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

    const { error: insError } = await admin
      .from('inspections')
      .insert({
        trade_in_id: leadId,
        inspector_id: userId,
        mechanical_score,
        exterior_score,
        interior_score,
        checklist: checklist || {},
        detailed_photos: [],
        ev_data: ev_data || {},
        final_notes: final_notes || '',
        is_certified: true
      });
      
    if (insError) throw new BadRequestException(insError.message);

    await admin
      .from('staff_tasks')
      .update({ status: 'COMPLETED', completed_at: new Date() })
      .eq('trade_in_id', leadId)
      .eq('assigned_to', userId);

    const assessment = this.evaluationEngine.evaluateRisk({ 
      mechanical: mechanical_score, 
      exterior: exterior_score, 
      interior: interior_score 
    });
    let newStatus = 'MANAGER_REVIEW';

    const { error: updError } = await admin
      .from('trade_in_requests')
      .update({ 
        status: newStatus,
        staff_notes: assessment.flags.length > 0 ? `[RISK GUARDIAN: ${assessment.flags.join(', ')}]` : 'Standard Evaluation Passed.'
      })
      .eq('id', leadId);

    if (updError) throw new BadRequestException(updError.message);

    if (assessment.riskLevel === 'HIGH' && profile?.branch_id) {
      await this.alertDispatcher.dispatchInspectionAlert(profile.branch_id, assessment.flags.join(', '), leadId);
    }

    return { 
      success: true, 
      riskProfile: assessment.riskLevel, 
      timestamp: new Date() 
    };
  }

  async createLead(authUserId: string, data: any) {
    const supabase = this.supabaseService.getClient();
    const { vehicleMakeModel, carDescription, askingPrice, locationId, photos } = data;
    
    const photoArray = Array.isArray(photos) ? photos : [];

    const insertPayload: any = {
      customer_id: authUserId,
      vehicle_make_model: vehicleMakeModel,
      car_description: carDescription,
      user_asking_price_etb: askingPrice,
      status: 'NEW_LEAD',
      photos: photoArray,
      financing_requested: data.financingRequested || false,
    };

    // Only set branch_id if provided — prevents FK violation when locationId is absent
    if (locationId) {
      insertPayload.branch_id = locationId;
    }

    if (data.vehicleDetails && typeof data.vehicleDetails === 'object') {
      insertPayload.vehicle_details = data.vehicleDetails;
    }

    if (data.contactPhone) {
      insertPayload.contact_phone = data.contactPhone;
    }
    if (data.contactCity) {
      insertPayload.contact_city = data.contactCity;
    }

    this.logger.debug(`createLead: userId=${authUserId}, locationId=${locationId}`);

    const { data: lead, error } = await supabase
      .from('trade_in_requests')
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return lead;
  }


  async getCustomerLeads(userId: string, customerId: string) {
    const supabase = this.adminSupabase.getClient(); // Bypass RLS as ownership is checked in controller
    const { data, error } = await supabase
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

    if (error) {
      throw new BadRequestException(error.message);
    }
    return data;
  }

  async updateStatus(userId: string, userRole: Role, leadId: string, status: string, assignedStaffId?: string) {
    if (userRole !== Role.GENERAL_MANAGER && userRole !== Role.FINANCE_AUDITOR) {
      const canAccess = await this.permissions.canAccessTradeIn(userId, userRole, leadId);
      if (!canAccess) {
        throw new ForbiddenException('You do not have permission to update this trade-in lead.');
      }
    }

    const updatePayload: any = { status };
    if (assignedStaffId) {
      updatePayload.assigned_staff_id = assignedStaffId;
      const supabase = this.adminSupabase.getClient();
      const { data: existingTask } = await supabase.from('staff_tasks').select('id').eq('trade_in_id', leadId).eq('assigned_to', assignedStaffId).single();
      if (!existingTask) {
        await supabase.from('staff_tasks').insert({
          trade_in_id: leadId,
          assigned_to: assignedStaffId,
          assigned_by: userId,
          status: 'ASSIGNED',
          description: 'Technical Evaluation & Appraisal'
        });
        
        await this.alertDispatcher.dispatchTaskAssignedAlert(assignedStaffId, leadId);
      }
    }

    const supabase = this.adminSupabase.getClient();
    const { data, error } = await supabase
      .from('trade_in_requests')
      .update(updatePayload)
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async approveLead(leadId: string, offerPrice: number, notes?: string, callerRole?: Role) {
    const supabase = this.adminSupabase.getClient(); // Bypass RLS as auth is handled by controller

    const { data: existing, error: fetchError } = await supabase
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

    const { data, error } = await supabase
      .from('trade_in_requests')
      .update(notesPayload)
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async rejectLead(leadId: string, reason: string, callerRole?: Role) {
    const supabase = this.adminSupabase.getClient();

    const isGM = callerRole === Role.GENERAL_MANAGER;
    const notesPayload: Record<string, any> = {
      status: 'REJECTED',
    };

    if (isGM) {
      notesPayload.gm_notes = reason || 'Asset rejected by General Manager.';
    } else {
      notesPayload.dm_notes = reason || 'Asset did not meet registry standards.';
    }

    const { data, error } = await supabase
      .from('trade_in_requests')
      .update(notesPayload)
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── Client: respond to a dealer offer ───────────────────────────────────────
  async respondToOffer(
    customerId: string,
    leadId: string,
    decision: 'ACCEPT' | 'REJECT' | 'COUNTER',
    counterPrice?: number,
  ) {
    const supabase = this.adminSupabase.getClient();

    const { data: lead, error: fetchErr } = await supabase
      .from('trade_in_requests')
      .select('status, customer_id, final_dealer_offer_etb')
      .eq('id', leadId)
      .single();

    if (fetchErr || !lead) throw new BadRequestException('Trade-in request not found.');
    if (lead.customer_id !== customerId)
      throw new ForbiddenException('You do not own this trade-in request.');
    if (!['OFFER_MADE', 'NEGOTIATING'].includes(lead.status))
      throw new BadRequestException(`Cannot respond to offer when status is "${lead.status}".`);

    let updatePayload: Record<string, any>;

    if (decision === 'ACCEPT') {
      updatePayload = { status: 'ACCEPTED' };
    } else if (decision === 'REJECT') {
      updatePayload = { status: 'CLOSED_LOST' };
    } else {
      // COUNTER
      if (!counterPrice || counterPrice <= 0)
        throw new BadRequestException('A valid counter-offer price is required.');
      updatePayload = {
        status: 'NEGOTIATING',
        user_asking_price_etb: counterPrice, // Represents client's latest counter position
      };
    }

    const { data, error } = await supabase
      .from('trade_in_requests')
      .update(updatePayload)
      .eq('id', leadId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── Admin: finalize acquisition → add to vehicle fleet ──────────────────────
  async acquireToFleet(
    adminUserId: string,
    leadId: string,
    vehicleData: {
      vin?: string;
      make?: string;
      model?: string;
      year?: number;
      fuel?: string;
      duty?: string;
      retailPrice?: number;
      vehicleStatus?: string; // REFURBISHMENT | SHOWROOM | SOLD
    },
  ) {
    const supabase = this.adminSupabase.getClient();

    const { data: lead, error: fetchErr } = await supabase
      .from('trade_in_requests')
      .select('*, inspections(*)')
      .eq('id', leadId)
      .single();

    if (fetchErr || !lead) throw new BadRequestException('Trade-in request not found.');
    if (lead.status !== 'ACCEPTED')
      throw new BadRequestException('Trade-in must be in ACCEPTED status before acquisition.');

    const details = (lead.vehicle_details as any) || {};
    const nameParts = (lead.vehicle_make_model || '').split(' ');
    const fleetStatus = vehicleData.vehicleStatus || 'REFURBISHMENT';

    const { data: vehicle, error: vErr } = await supabase
      .from('vehicles')
      .insert({
        vin_chassis: vehicleData.vin || `TI-${leadId.substring(0, 8).toUpperCase()}`,
        make: vehicleData.make || nameParts[0] || 'Unknown',
        model: vehicleData.model || nameParts.slice(1).join(' ') || 'Unknown',
        year: vehicleData.year || Number(details.year) || new Date().getFullYear(),
        fuel: (vehicleData.fuel || details.fuel_type || 'PETROL').toUpperCase(),
        duty: (vehicleData.duty || details.duty_status || 'DUTY_PAID').toUpperCase(),
        current_mileage: Number(details.mileage) || 0,
        retail_price_etb: vehicleData.retailPrice || lead.final_dealer_offer_etb || 0,
        images: lead.photos || [],
        branch_id: lead.branch_id,
        status: fleetStatus,
      })
      .select('id')
      .single();

    if (vErr) throw new BadRequestException(`Fleet entry failed: ${vErr.message}`);

    // Mark trade-in as reconditioning
    await supabase
      .from('trade_in_requests')
      .update({ status: 'RECONDITIONING' })
      .eq('id', leadId);

    // Generate Commissions
    if (fleetStatus === 'SHOWROOM' || fleetStatus === 'SOLD' || fleetStatus === 'REFURBISHMENT') {
      const { data: settings } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'evaluation_commission_percent')
        .single();
        
      const commissionPercent = parseFloat(settings?.value || '0.01');
      const commissionAmount = (vehicleData.retailPrice || lead.final_dealer_offer_etb || 0) * commissionPercent;

      const sourcerId = lead.broker_id || lead.assigned_staff_id;
      let inspectorId = null;

      if (lead.inspections && lead.inspections.length > 0) {
        // Assume the first inspection is the most relevant
        inspectorId = lead.inspections[0].inspector_id;
      }

      // 1. Commission for the Inspector
      if (inspectorId) {
        await supabase.from('commissions').insert({
          beneficiary_id: inspectorId,
          vehicle_id: vehicle.id,
          type: 'STAFF_INSPECTION_BONUS',
          amount_etb: commissionAmount,
          branch_id: lead.branch_id,
          is_paid: false,
        });
      }

      // 2. Commission for the Sourcer (if different from the inspector, or if there is no inspector)
      if (sourcerId && sourcerId !== inspectorId) {
        await supabase.from('commissions').insert({
          beneficiary_id: sourcerId,
          vehicle_id: vehicle.id,
          type: lead.broker_id ? 'BROKER_REFERRAL' : 'STAFF_INSPECTION_BONUS',
          amount_etb: commissionAmount,
          branch_id: lead.branch_id,
          is_paid: false,
        });
      }
    }

    return { success: true, vehicleId: vehicle.id, vehicleStatus: fleetStatus };
  }

  async getLeadById(userId: string, userRole: Role, leadId: string) {
    const hasAccess = await this.permissions.canAccessTradeIn(userId, userRole, leadId);
    if (!hasAccess) {
      throw new ForbiddenException('You do not have permission to view this trade-in lead.');
    }

    const supabase = this.adminSupabase.getClient();
    const { data: lead, error } = await supabase
      .from('trade_in_requests')
      .select(`
        id, created_at, vehicle_make_model, car_description,
        user_asking_price_etb, status, photos, financing_requested,
        vehicle_details, contact_phone, contact_city,
        profiles!trade_in_requests_customer_id_fkey(full_name, phone_number),
        branches!trade_in_requests_branch_id_fkey(name, address),
        branch_id,
        assigned_staff_id,
        inspections(
          *,
          profiles:inspector_id(full_name, role)
        )
      `)
      .eq('id', leadId)
      .single();

    if (error) throw new BadRequestException(error.message);
    
    const castData = lead as any;
    return {
      id: castData.id,
      customer: castData.profiles?.full_name || 'Walk-in',
      phone: castData.contact_phone || castData.profiles?.phone_number || 'No contact',
      vehicle: castData.vehicle_make_model,
      plate: castData.car_description || 'Unknown',
      arrivedAt: castData.created_at,
      location: castData.branches?.name || 'Local',
      locationAddress: castData.branches?.address || '',
      financing: castData.financing_requested,
      status: castData.status,
      photos: castData.photos,
      user_asking_price_etb: castData.user_asking_price_etb,
      assigned_staff_id: castData.assigned_staff_id,
      branch_id: castData.branch_id,
      vehicleDetails: castData.vehicle_details || {},
      contactPhone: castData.contact_phone,
      contactCity: castData.contact_city,
      inspections: castData.inspections
    };
  }
}
