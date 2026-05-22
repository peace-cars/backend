import { Controller, Get, Post, Patch, Body, Param, UseGuards, Logger, Req } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RolesGuard } from '../auth/roles.guard';
import { ScopeGuard } from '../auth/scope.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';
import { Public } from '../auth/public.decorator';

@Controller('locations')
@UseGuards(RolesGuard, ScopeGuard)
export class BranchManagementController {
  private readonly logger = new Logger(BranchManagementController.name);

  constructor(private readonly supabaseService: SupabaseService) {}
 
  @Public()
  @Get('public')
  async getPublic() {
    const { data, error } = await this.supabaseService.getClient()
      .from('locations')
      .select('id, name, address, phone_number, is_active')
      .eq('is_active', true)
      .order('name');
    
    if (error) throw new Error(error.message);
    return data || [];
  }

  @Get()
  async getAll(@Req() req: any) {
    const client = this.supabaseService.getClient();
    let query = client.from('locations').select('*');

    // Hierarchy Scoping
    if (req.user.role === Role.GENERAL_MANAGER || req.user.role === Role.FINANCE_AUDITOR) {
       // Global View
    } else if (req.user.scopedBranchIds?.length > 0) {
       query = query.in('id', req.user.scopedBranchIds);
    } else {
       return [];
    }

    const { data: locations, error } = await query.order('name');

    if (error) {
      this.logger.warn(`Locations fetch failed: ${error.message}`);
      throw new Error(error.message);
    }

    const managerIds = locations.map(l => l.manager_id).filter(Boolean);
    
    let managersData: any[] = [];
    if (managerIds.length > 0) {
      const { data: managers } = await client
        .from('profiles')
        .select('id, full_name, phone_number, role')
        .in('id', managerIds);
      managersData = managers || [];
    }

    // Map managers back to locations
    const data = locations.map(loc => {
      const manager = managersData.find(m => m.id === loc.manager_id);
      return { ...loc, manager: manager || null };
    });

    // Enrich with staff counts per branch
    const { data: profiles } = await client
      .from('profiles')
      .select('branch_id, role');

    const staffCounts: Record<string, number> = {};
    if (profiles) {
      for (const p of profiles) {
        if (p.branch_id) {
          staffCounts[p.branch_id] = (staffCounts[p.branch_id] || 0) + 1;
        }
      }
    }

    return (data || []).map(loc => ({
      ...loc,
      managerName: loc.manager?.full_name || null,
      managerPhone: loc.manager?.phone_number || null,
      managerId: loc.manager_id || null,
      staffCount: staffCounts[loc.id] || 0,
    }));
  }

  @Get('my-scope')
  async getMyScope(@Req() req: any) {
     const client = this.supabaseService.getClient();
     let branchName = 'Global HQ';
     
     if (req.user.branchId) {
        const { data: loc } = await client.from('locations').select('name').eq('id', req.user.branchId).single();
        if (loc) branchName = loc.name;
     }

     return {
        role: req.user.role,
        districtId: req.user.districtId,
        branchId: req.user.branchId,
        branchName: branchName,
        scopedBranchIds: req.user.scopedBranchIds
     };
  }

  @Get('districts/overview')
  @Roles(Role.GENERAL_MANAGER)
  async getDistrictOverview() {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.from('district_overview').select('*');
    if (error) throw new Error(`District overview fetch failed: ${error.message}`);
    return data || [];
  }

  @Get(':id/staff')
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  async getBranchStaff(@Param('id') branchId: string) {
    const client = this.supabaseService.getClient();
    
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('branch_id', branchId)
      .order('full_name');

    if (error) {
      this.logger.error(`Failed fetching branch staff: ${error.message}`);
      return [];
    }

    return (data || []).map(p => ({
      id: p.id,
      fullName: p.full_name,
      phone: p.phone_number,
      role: p.role,
      isActive: p.is_verified,
      commissionTier: p.commission_tier,
      locationId: p.branch_id,
    }));
  }

  @Post()
  @Roles(Role.GENERAL_MANAGER)
  async create(@Body() data: any) {
    const { data: newBranch, error } = await this.supabaseService.getClient()
      .from('locations')
      .insert([{ 
         name: data.name, 
         code: data.code, 
         address: data.address, 
         phone_number: data.phone,
         is_active: true
      }])
      .select()
      .single();
    if (error) return { success: false, message: error.message };
    return { success: true, branch: newBranch };
  }

  @Patch(':id/assign-manager')
  @Roles(Role.GENERAL_MANAGER)
  async assignManager(@Param('id') branchId: string, @Body() body: { managerId: string }) {
    const client = this.supabaseService.getClient();
    
    // Validate the person exists and is a DISTRICT_MANAGER
    const { data: person, error: personError } = await client
      .from('profiles')
      .select('id, role, full_name')
      .eq('id', body.managerId)
      .single();

    if (personError || !person) {
      return { success: false, message: 'Person not found' };
    }

    if (person.role !== Role.DISTRICT_MANAGER) {
      return { success: false, message: 'Only District Managers can be assigned to manage a branch' };
    }

    // Remove this DM from any other branch they currently manage
    await client
      .from('locations')
      .update({ manager_id: null })
      .eq('manager_id', body.managerId);

    // Assign the DM to this branch
    const { error: updateError } = await client
      .from('locations')
      .update({ manager_id: body.managerId })
      .eq('id', branchId);

    if (updateError) {
      return { success: false, message: updateError.message };
    }

    // Also update the DM's own branch_id to match their branch
    await client
      .from('profiles')
      .update({ branch_id: branchId })
      .eq('id', body.managerId);

    this.logger.log(`Assigned DM ${person.full_name} to branch ${branchId}`);
    return { success: true, managerName: person.full_name };
  }

  @Patch(':id/unassign-manager')
  @Roles(Role.GENERAL_MANAGER)
  async unassignManager(@Param('id') branchId: string) {
    const client = this.supabaseService.getClient();
    
    const { error } = await client
      .from('locations')
      .update({ manager_id: null })
      .eq('id', branchId);

    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  @Patch(':id')
  @Roles(Role.GENERAL_MANAGER)
  async update(@Param('id') id: string, @Body() data: any) {
    const { error } = await this.supabaseService.getClient()
      .from('locations')
      .update(data)
      .eq('id', id);
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  @Patch(':id/toggle')
  @Roles(Role.GENERAL_MANAGER)
  async toggleActive(@Param('id') id: string) {
    const client = this.supabaseService.getClient();
    const { data: currentBranch, error: fetchError } = await client
      .from('locations')
      .select('is_active')
      .eq('id', id)
      .single();
    
    if (fetchError || !currentBranch) {
      return { success: false, message: 'Branch not found or inaccessible' };
    }

    const { error } = await client
      .from('locations')
      .update({ is_active: !currentBranch.is_active })
      .eq('id', id);
    
    if (error) return { success: false, message: error.message };
    return { success: true, isActive: !currentBranch.is_active };
  }
}
