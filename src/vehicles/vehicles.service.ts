import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException, Optional, Inject, ConflictException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { SupabaseScopedService } from '../supabase/supabase-scoped.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FsmService } from '../common/fsm.service';
import { TelegramService } from '../telegram/telegram.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';
import { AlertDispatcherService } from '../notifications/alert-dispatcher.service';

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    private supabaseScoped: SupabaseScopedService,
    private supabaseAdmin: SupabaseService,
    private fsmService: FsmService,
    private telegramService: TelegramService,
    private redisService: RedisService,
    private alertDispatcher: AlertDispatcherService,
    @Optional() private readonly realtime?: RealtimeGateway,
  ) {}

  private readonly SHOWROOM_CACHE_KEY = 'vehicles:showroom';

  async getShowroom(page?: number, limit?: number) {
    try {
      let cachedShowroom = await this.redisService.get<any[]>(this.SHOWROOM_CACHE_KEY);

      if (!cachedShowroom) {
        const client = this.supabaseScoped.getClient();
        const { data, error } = await client
          .from('vehicles')
          .select(`
            *,
            branches(name),
            conversations(count)
          `)
          .eq('status', 'SHOWROOM')
          .order('created_at', { ascending: false });
        
        if (error) {
          this.logger.error(`Supabase Error: ${error.message} (${error.code})`);
          throw new BadRequestException(`DB_ERROR: ${error.message}`);
        }

        // Sensitive fields to strip from public showroom responses
        const SENSITIVE_FIELDS = [
          'purchase_cost_usd', 'exchange_rate_at_purchase', 
          'shipping_customs_cost_etb', 'refurbishment_cost_etb', 
          'total_landed_cost_etb', 'min_selling_price_etb', 
          'unit_cost'
        ];
        
        const mappedData = (data || []).map(v => {
          const sanitized = { ...v } as any;
          SENSITIVE_FIELDS.forEach(f => delete sanitized[f]);
          return {
            ...sanitized,
            inquiryCount: (v as any).conversations?.[0]?.count || 0,
            branchName: (v as any).branches?.name || 'Unassigned'
          };
        });

        cachedShowroom = mappedData;
        await this.redisService.set(this.SHOWROOM_CACHE_KEY, mappedData);
      }

      if (page !== undefined && limit !== undefined) {
        const start = (page - 1) * limit;
        const end = start + limit;
        return {
          data: cachedShowroom.slice(start, end),
          total: cachedShowroom.length,
          page,
          limit
        };
      }

      return cachedShowroom;
    } catch (err) {
      this.logger.error('Failed fetching showroom vehicles', err);
      throw err;
    }
  }

  async getVehicleById(id: string, user?: any) {
    try {
      const client = this.supabaseScoped.getClient();
      let query = client
        .from('vehicles')
        .select(`
          *,
          branches(name),
          conversations(count)
        `)
        .eq('id', id);

      // Scoping logic for internal views
      if (user && user.role !== 'ADMIN' && user.role !== 'GENERAL_MANAGER') {
        if (user.role === 'DISTRICT_MANAGER') {
          // DM's district check is handled at the controller level via ScopeGuard
        } else if (user.role === 'STAFF') {
          query = query.eq('branch_id', user.branchId);
        }
      }

      const { data, error } = await query.single();
      
      if (error) throw error;
      if (!data) throw new NotFoundException(`Vehicle ${id} not found`);

      const result: any = {
        ...data,
        inquiryCount: (data as any).conversations?.[0]?.count || 0
      };

      // Strip sensitive fields for public (unauthenticated) access
      if (!user) {
        const SENSITIVE_FIELDS = [
          'purchase_cost_usd', 'exchange_rate_at_purchase', 
          'shipping_customs_cost_etb', 'refurbishment_cost_etb', 
          'total_landed_cost_etb', 'min_selling_price_etb', 
          'unit_cost'
        ];
        SENSITIVE_FIELDS.forEach(f => delete result[f]);
      }

      return result;
    } catch (err) {
      this.logger.error(`Failed fetching vehicle ${id}`, err);
      throw err;
    }
  }

  async getAll(user: any, explicitBranchId?: string, page?: number, limit?: number) {
    try {
      const client = this.supabaseScoped.getClient();
      let query = client
        .from('vehicles')
        .select(`
          *,
          branches(name),
          conversations(count)
        `);

      if (explicitBranchId) {
        if (user.role === 'ADMIN' || user.role === 'FINANCE_AUDITOR' || user.role === 'GENERAL_MANAGER') {
          query = query.eq('branch_id', explicitBranchId);
        } else if (user.scopedBranchIds && user.scopedBranchIds.includes(explicitBranchId)) {
          query = query.eq('branch_id', explicitBranchId);
        } else {
          throw new ForbiddenException("You do not have access to this branch.");
        }
      } else {
        // Hierarchy-Aware Scoping via scopedBranchIds (populated by RolesGuard)
        if (user.role === 'ADMIN' || user.role === 'FINANCE_AUDITOR' || user.role === 'GENERAL_MANAGER') {
          // Global view — no filter
        } else if (user.scopedBranchIds && user.scopedBranchIds.length > 0) {
          // DM or Staff: filter to their scoped branches
          query = query.in('branch_id', user.scopedBranchIds);
        } else if (user.branchId) {
          // Fallback: filter by single branch
          query = query.eq('branch_id', user.branchId);
        }
      }

      query = query.order('created_at', { ascending: false });

      if (page !== undefined && limit !== undefined) {
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit - 1;
        query = query.range(startIndex, endIndex);
      }

      const { data, error, count } = await query;
      
      if (error) throw new BadRequestException(error.message);

      const mappedData = (data || []).map(v => ({
        ...v,
        inquiryCount: v.conversations?.[0]?.count || 0,
        branchName: v.branches?.name || 'Unassigned'
      }));

      if (page !== undefined && limit !== undefined) {
        return {
          data: mappedData,
          total: count || mappedData.length,
          page,
          limit
        };
      }

      return mappedData;
    } catch (err) {
      this.logger.error('Failed fetching all vehicles', err);
      throw err;
    }
  }

  async createVehicle(data: CreateVehicleDto) {
    try {
      const client = this.supabaseScoped.getClient();
      
      // Clean payload: Only include columns verified to exist in the DB schema
      const payload: Record<string, any> = {
        make: data.make,
        model: data.model,
        year: Number(data.year),
        retail_price_etb: Number(data.retail_price_etb),
        fuel: data.fuel,
        duty: data.duty,
        plate_code: data.plate_code || null,
        vin_chassis: data.vin_chassis || `VIN-${Date.now()}`,
        status: data.status || 'SOURCING',
        branch_id: data.branch_id || null,
        images: data.images || [],
        battery_soh_percent: data.battery_soh_percent || null,
        certified_km: data.certified_km || null,
        range_km: data.range_km || null,
        motor_power_kw: data.motor_power_kw || null,
        drive_train: data.drive_train || 'RWD',
        interior_color: data.interior_color || null,
        battery_capacity_kwh: data.battery_capacity_kwh || null,
        features: data.features || [],
        // Financial tracking fields (Migration 008)
        unit_cost: data.unit_cost ? Number(data.unit_cost) : 0,
        floor_plan_loan: data.floor_plan_loan || false,
        maturity_date: data.maturity_date || null,
        internal_documents: data.internal_documents || [],
      };

      const { data: newVehicle, error } = await client
        .from('vehicles')
        .insert([payload])
        .select()
        .single();
      
      if (error) {
        this.logger.error(`Supabase Error: ${error.message} (${error.code})`);
        throw new BadRequestException(`DB_ERROR: ${error.message}`);
      }

      if (newVehicle.status === 'SHOWROOM') {
        await this.redisService.del(this.SHOWROOM_CACHE_KEY);

        this.telegramService.handleNewShowroomVehicle(newVehicle).catch(err => {
          this.logger.error('Failed to dispatch new vehicle showroom alert', err);
        });

        if (this.realtime) {
          this.realtime.broadcastToRoom('showroom', 'showroom_vehicle_upserted', newVehicle);
        }
      }

      return newVehicle;
    } catch (err) {
      this.logger.error('Failed to create vehicle', err);
      throw err;
    }
  }

  async update(id: string, data: UpdateVehicleDto) {
    try {
      const client = this.supabaseScoped.getClient();

      // 1. Fetch current status and VIN of the vehicle to enforce FSM transition validation
      const { data: existing, error: fetchErr } = await client
        .from('vehicles')
        .select('status, vin_chassis')
        .eq('id', id)
        .single();
      
      if (fetchErr || !existing) {
        throw new NotFoundException(`Vehicle ${id} not found or inaccessible.`);
      }

      // 2. Validate FSM State Transition
      if (data.status && data.status !== existing.status) {
        this.fsmService.validateVehicleTransition(existing.status, data.status);

        // Rule: A vehicle cannot be transitioned to SHOWROOM without a certified inspection report
        if (data.status === 'SHOWROOM') {
          // Query inspections table directly
          const { data: inspections } = await client
            .from('inspections')
            .select('is_certified')
            .eq('vehicle_id', id);
          
          let isInspected = inspections?.some(i => i.is_certified) || false;

          // If no direct link, try matching via trade_in_requests ID referenced in vin_chassis
          if (!isInspected && existing.vin_chassis?.startsWith('TRAD-')) {
            const leadId = existing.vin_chassis.substring(5);
            const { data: leadInspections } = await client
              .from('inspections')
              .select('is_certified')
              .eq('trade_in_id', leadId);
            isInspected = leadInspections?.some(i => i.is_certified) || false;
          }

          if (!isInspected) {
            throw new BadRequestException('FSM Policy Violation: A vehicle cannot be listed under SHOWROOM status without a certified inspection report.');
          }
        }
      }

      // Build payload from only the fields that were actually provided (prevents NaN from Number(undefined))
      const payload: Record<string, any> = {};
      if (data.make !== undefined) payload.make = data.make;
      if (data.model !== undefined) payload.model = data.model;
      if (data.year !== undefined) { const y = Number(data.year); if (isNaN(y)) throw new BadRequestException('Invalid year value'); payload.year = y; }
      if (data.retail_price_etb !== undefined) { const p = Number(data.retail_price_etb); if (isNaN(p)) throw new BadRequestException('Invalid retail_price_etb value'); payload.retail_price_etb = p; }
      if (data.fuel !== undefined) payload.fuel = data.fuel;
      if (data.duty !== undefined) payload.duty = data.duty;
      if (data.plate_code !== undefined) payload.plate_code = data.plate_code;
      if (data.vin_chassis !== undefined) payload.vin_chassis = data.vin_chassis;
      if (data.status !== undefined) payload.status = data.status;
      if (data.branch_id !== undefined) payload.branch_id = data.branch_id || null;
      if (data.images !== undefined) payload.images = data.images;
      if (data.battery_soh_percent !== undefined) payload.battery_soh_percent = data.battery_soh_percent;
      if (data.certified_km !== undefined) payload.certified_km = data.certified_km;
      if (data.range_km !== undefined) payload.range_km = data.range_km;
      if (data.motor_power_kw !== undefined) payload.motor_power_kw = data.motor_power_kw;
      if (data.drive_train !== undefined) payload.drive_train = data.drive_train;
      if (data.interior_color !== undefined) payload.interior_color = data.interior_color;
      if (data.battery_capacity_kwh !== undefined) payload.battery_capacity_kwh = data.battery_capacity_kwh;
      if (data.features !== undefined) payload.features = data.features;
      if (data.unit_cost !== undefined) { const c = Number(data.unit_cost); if (isNaN(c)) throw new BadRequestException('Invalid unit_cost value'); payload.unit_cost = c; }
      if (data.floor_plan_loan !== undefined) payload.floor_plan_loan = data.floor_plan_loan;
      if (data.maturity_date !== undefined) payload.maturity_date = data.maturity_date || null;
      if (data.internal_documents !== undefined) payload.internal_documents = data.internal_documents;

      // Auto-set sold_date when status transitions to SOLD
      if (data.status === 'SOLD') {
        payload.sold_date = new Date().toISOString();
        this.logger.log(`Vehicle ${id} marked SOLD — sold_date recorded`);
      }

      // Conditional Update (Optimistic Concurrency Control)
      // Ensures the status hasn't been changed by another thread/request between fetch and update
      const { data: updated, error } = await client
        .from('vehicles')
        .update(payload)
        .eq('id', id)
        .eq('status', existing.status) // The critical concurrency check
        .select()
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // PGRST116 means zero rows returned from .single()
          this.logger.warn(`Concurrency conflict updating vehicle ${id}. Status changed from ${existing.status} mid-flight.`);
          throw new ConflictException(`The vehicle status was modified by another user. Please refresh and try again.`);
        }
        this.logger.error(`Supabase Update Error: ${error.message} (${error.code})`);
        throw new BadRequestException(`DB_ERROR: ${error.message}`);
      }

      if (updated.status === 'SHOWROOM' && existing.status !== 'SHOWROOM') {
        this.telegramService.handleNewShowroomVehicle(updated).catch(err => {
          this.logger.error('Failed to dispatch transitioned vehicle showroom alert', err);
        });
      }

      if (updated.status === 'SOLD' && existing.status !== 'SOLD') {
        if (updated.branch_id) {
          this.alertDispatcher.dispatchBranchManagerAlert(
            updated.branch_id,
            'Vehicle Sold',
            `${updated.make} ${updated.model} has been marked as sold.`,
            'VEHICLE_SOLD',
            updated.id
          ).catch(err => {
            this.logger.error('Failed to dispatch branch manager sold alert', err);
          });
        }
      }

      if (updated.status === 'SHOWROOM' || existing.status === 'SHOWROOM') {
        await this.redisService.del(this.SHOWROOM_CACHE_KEY);
      }

      // Realtime Pub/Sub: Notify showroom clients
      if (this.realtime) {
        if (updated.status === 'SHOWROOM') {
          this.realtime.broadcastToRoom('showroom', 'showroom_vehicle_upserted', updated);
        } else if (existing.status === 'SHOWROOM' && updated.status !== 'SHOWROOM') {
          this.realtime.broadcastToRoom('showroom', 'showroom_vehicle_removed', { id: updated.id });
        }
      }

      return updated;
    } catch (err) {
      this.logger.error(`Failed to update vehicle ${id}`, err);
      throw err;
    }
  }

  /**
   * Profitability Report
   * Calculates: Net Profit = Sale Price - (Purchase Cost + Reconditioning Expenses)
   * Uses the vehicle_profitability view if available, falls back to manual calculation.
   */
  async getProfitabilityReport(branchId?: string) {
    try {
      const client = this.supabaseScoped.getClient();
      
      // Try the computed view first (Migration 010)
      let viewQuery = client
        .from('vehicle_profitability')
        .select('*')
        .eq('status', 'SOLD')
        .order('sold_date', { ascending: false });

      if (branchId) {
        viewQuery = viewQuery.eq('branch_id', branchId);
      }

      const { data: viewData, error: viewError } = await viewQuery;

      if (!viewError && viewData && viewData.length > 0) {
        return viewData.map((v: any) => ({
          id: v.id,
          vehicle: `${v.year} ${v.make} ${v.model}`,
          salePrice: v.sale_price,
          purchaseCost: v.purchase_cost,
          reconditioningCost: v.reconditioning_cost,
          totalUnitCost: v.total_unit_cost,
          netProfit: v.net_profit,
          margin: v.profit_margin_pct,
          soldDate: v.sold_date,
          daysInStock: v.days_in_stock,
          branchName: v.branch_name
        }));
      }

      // Fallback: manual calculation from vehicles table
      let query = client
        .from('vehicles')
        .select('id, make, model, year, retail_price_etb, unit_cost, sold_date, branch_id, created_at')
        .eq('status', 'SOLD')
        .order('sold_date', { ascending: false });
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      
      if (error) {
        this.logger.error(`Supabase Error: ${error.message} (${error.code})`);
        throw new BadRequestException(`DB_ERROR: ${error.message}`);
      }
      
      return (data || []).map((v: any) => {
        const purchaseCost = Number(v.unit_cost) || 0;
        const salePrice = Number(v.retail_price_etb) || 0;
        return {
          id: v.id,
          vehicle: `${v.year} ${v.make} ${v.model}`,
          salePrice,
          purchaseCost,
          reconditioningCost: 0, // Expenses not joined in fallback
          totalUnitCost: purchaseCost,
          netProfit: salePrice - purchaseCost,
          margin: salePrice > 0 ? (((salePrice - purchaseCost) / salePrice) * 100).toFixed(1) : 0,
          soldDate: v.sold_date,
          daysInStock: v.created_at ? Math.floor((Date.now() - new Date(v.created_at).getTime()) / 86400000) : 0,
          branchName: v.branches?.name || null
        };
      });
    } catch (err) {
      this.logger.error('Failed fetching profitability report', err);
      throw err;
    }
  }

  /**
   * Aged Inventory Alert
   * Returns vehicles that have been in stock for more than `thresholdDays` days.
   * Default threshold: 60 days (configurable).
   */
  async getAgedInventory(thresholdDays = 60, branchId?: string) {
    try {
      const client = this.supabaseScoped.getClient();
      const cutoffDate = new Date(Date.now() - thresholdDays * 86400000).toISOString();
      
      let query = client
        .from('vehicles')
        .select('id, make, model, year, retail_price_etb, unit_cost, floor_plan_loan, maturity_date, created_at, branch_id, branches:branch_id(name)')
        .neq('status', 'SOLD')
        .lt('created_at', cutoffDate)
        .order('created_at', { ascending: true });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        this.logger.error(`Supabase Error: ${error.message} (${error.code})`);
        throw new BadRequestException(`DB_ERROR: ${error.message}`);
      }
      
      return (data || []).map((v: any) => ({
        id: v.id,
        vehicle: `${v.year} ${v.make} ${v.model}`,
        daysInStock: Math.floor((Date.now() - new Date(v.created_at).getTime()) / 86400000),
        retailPrice: v.retail_price_etb,
        unitCost: v.unit_cost || 0,
        isFloorPlan: v.floor_plan_loan || false,
        maturityDate: v.maturity_date,
        isOverdue: v.maturity_date ? new Date(v.maturity_date) < new Date() : false,
        branchName: v.branches?.name || 'Unassigned'
      }));
    } catch (err) {
      this.logger.error('Failed fetching aged inventory', err);
      throw err;
    }
  }

  async createFromTradeIn(leadId: string, retailPrice: number) {
    try {
      // Use admin client for promotion to ensure atomic cross-table updates bypass RLS if needed for this administrative action
      const admin = this.supabaseAdmin.getClient();
      
      const { data: lead, error: leadError } = await admin
        .from('trade_in_requests')
        .select('*')
        .eq('id', leadId)
        .single();
      
      if (leadError || !lead) throw new Error(`Lead ${leadId} not found`);

      // Robust parsing: "2025 ford f150" -> year: 2025, make: ford, model: f150
      const parts = (lead.vehicle_make_model || '').trim().split(/\s+/);
      let year = 2024;
      let make = 'Unknown';
      let model = 'Model';

      if (parts.length > 0) {
        const firstPart = parseInt(parts[0]);
        if (!isNaN(firstPart) && firstPart > 1900 && firstPart < 2100) {
          year = firstPart;
          make = parts[1] || 'Unknown';
          model = parts.slice(2).join(' ') || 'Model';
        } else {
          make = parts[0];
          model = parts.slice(1).join(' ') || 'Model';
        }
      }

      // Consolidate location/branch IDs
      const hubId = lead.branch_id;

      const { data: vehicle, error: vehError } = await admin
        .from('vehicles')
        .insert([{
          make: make,
          model: model,
          year: year,
          retail_price_etb: retailPrice,
          status: 'REFURBISHMENT',
          branch_id: hubId,
          vin_chassis: `TRAD-${leadId.substring(0,8).toUpperCase()}`,
          images: lead.photos || []
        }])
        .select()
        .single();

      if (vehError) {
        this.logger.error(`VehError during promotion: ${vehError.message} (${vehError.code})`);
        throw vehError;
      }

      const { error: updError } = await admin
        .from('trade_in_requests')
        .update({ status: 'ACCEPTED' })
        .eq('id', leadId);

      if (updError) {
        this.logger.error(`UpdError during promotion: ${updError.message}`);
        // We don't throw here to avoid 500 if the vehicle was already created, but we should log it
      }

      return vehicle;
    } catch (err) {
      this.logger.error(`Failed to promote lead ${leadId}`, err);
      throw err;
    }
  }

  async delete(id: string) {
    try {
      const client = this.supabaseScoped.getClient();
      const { error } = await client.from('vehicles').delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      this.logger.error(`Failed to delete vehicle ${id}`, err);
      throw err;
    }
  }
}
