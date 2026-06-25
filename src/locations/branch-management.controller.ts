import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Logger, Req, UseInterceptors } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';
import { RolesGuard } from '../auth/roles.guard';
import { ScopeGuard } from '../auth/scope.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';
import { Public } from '../auth/public.decorator';
import { UpstashCacheInterceptor, CacheTTL } from '../redis/upstash-cache.interceptor';

@Controller('locations')
@UseGuards(RolesGuard, ScopeGuard)
export class BranchManagementController {
  private readonly logger = new Logger(BranchManagementController.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly redisService: RedisService
  ) {}
 
  @Public()
  @Get('public')
  @UseInterceptors(UpstashCacheInterceptor)
  @CacheTTL(3600)
  async getPublic() {
    const { data, error } = await this.supabaseService.getClient()
      .from('branches')
      .select('id, name, address, district_id')
      .order('name');
    
    if (error) {
      this.logger.warn(`Public branches fetch failed: ${error.message}`);
      // Fallback: try selecting only id and name
      const { data: fallback } = await this.supabaseService.getClient()
        .from('branches')
        .select('id, name')
        .order('name');
      return fallback || [];
    }
    return data || [];
  }

  @Get()
  @UseInterceptors(UpstashCacheInterceptor)
  @CacheTTL(300)
  async getAll(@Req() req: any) {
    const client = this.supabaseService.getClient();
    let query = client.from('branches').select('id, name, address, district_id');

    // Hierarchy Scoping
    if (req.user.role === Role.GENERAL_MANAGER || req.user.role === Role.FINANCE_AUDITOR) {
       // Global View
    } else if (req.user.scopedBranchIds?.length > 0) {
       query = query.in('id', req.user.scopedBranchIds);
    } else {
       return [];
    }

    const { data: branches, error } = await query.order('name');

    if (error) {
      this.logger.warn(`Branches fetch failed: ${error.message}`);
      throw new Error(error.message);
    }

    const branchIds = (branches || []).map(b => b.id);

    // Find DMs assigned to each branch via profiles.branch_id
    const { data: profiles } = await client
      .from('profiles')
      .select('id, full_name, phone_number, role, branch_id, is_verified, commission_tier')
      .in('branch_id', branchIds.length > 0 ? branchIds : ['__none__']);

    const staffCounts: Record<string, number> = {};
    const branchManagers: Record<string, any> = {};

    for (const p of profiles || []) {
      if (p.branch_id) {
        staffCounts[p.branch_id] = (staffCounts[p.branch_id] || 0) + 1;
        if (p.role === Role.DISTRICT_MANAGER) {
          branchManagers[p.branch_id] = p;
        }
      }
    }

    return (branches || []).map(b => ({
      ...b,
      managerId: branchManagers[b.id]?.id || null,
      managerName: branchManagers[b.id]?.full_name || null,
      managerPhone: branchManagers[b.id]?.phone_number || null,
      staffCount: staffCounts[b.id] || 0,
    }));
  }

  @Get('my-scope')
  @UseInterceptors(UpstashCacheInterceptor)
  @CacheTTL(120)
  async getMyScope(@Req() req: any) {
     const client = this.supabaseService.getClient();
     let branchName = 'Global HQ';
     
     if (req.user.branchId) {
        const { data: loc } = await client.from('branches').select('name').eq('id', req.user.branchId).single();
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
  @UseInterceptors(UpstashCacheInterceptor)
  @CacheTTL(300)
  async getDistrictOverview() {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.from('district_overview').select('*');
    if (error) throw new Error(`District overview fetch failed: ${error.message}`);
    return data || [];
  }

  @Get(':id/staff')
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  @UseInterceptors(UpstashCacheInterceptor)
  @CacheTTL(60)
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
    // Only insert columns that exist on the branches table
    const insertData: any = { name: data.name };
    if (data.address) insertData.address = data.address;
    if (data.district_id) insertData.district_id = data.district_id;

    const { data: newBranch, error } = await this.supabaseService.getClient()
      .from('branches')
      .insert([insertData])
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

    // Unassign any existing DM from this branch (clear their branch_id if they are a DM of this branch)
    await client
      .from('profiles')
      .update({ branch_id: null })
      .eq('branch_id', branchId)
      .eq('role', Role.DISTRICT_MANAGER);

    // Assign new DM: set their branch_id to this branch
    const { error: updateError } = await client
      .from('profiles')
      .update({ branch_id: branchId })
      .eq('id', body.managerId);

    if (updateError) {
      return { success: false, message: updateError.message };
    }

    this.logger.log(`Assigned DM ${person.full_name} to branch ${branchId}`);
    return { success: true, managerName: person.full_name };
  }

  @Patch(':id/unassign-manager')
  @Roles(Role.GENERAL_MANAGER)
  async unassignManager(@Param('id') branchId: string) {
    const client = this.supabaseService.getClient();
    
    // Clear branch_id for any DM currently assigned to this branch
    const { error } = await client
      .from('profiles')
      .update({ branch_id: null })
      .eq('branch_id', branchId)
      .eq('role', Role.DISTRICT_MANAGER);

    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  @Patch(':id')
  @Roles(Role.GENERAL_MANAGER)
  async update(@Param('id') id: string, @Body() data: any) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.district_id !== undefined) updateData.district_id = data.district_id;

    if (Object.keys(updateData).length === 0) return { success: true };

    const { error } = await this.supabaseService.getClient()
      .from('branches')
      .update(updateData)
      .eq('id', id);
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  @Patch(':id/toggle')
  @Roles(Role.GENERAL_MANAGER)
  async toggleActive(@Param('id') id: string) {
    const client = this.supabaseService.getClient();
    const { data: currentBranch, error: fetchError } = await client
      .from('branches')
      .select('is_active')
      .eq('id', id)
      .single();
    
    if (fetchError || !currentBranch) {
      return { success: false, message: 'Branch not found or inaccessible' };
    }

    const { error } = await client
      .from('branches')
      .update({ is_active: !currentBranch.is_active })
      .eq('id', id);
    
    if (error) return { success: false, message: error.message };
    return { success: true, isActive: !currentBranch.is_active };
  }

  @Delete(':id')
  @Roles(Role.GENERAL_MANAGER)
  async deleteBranch(@Param('id') id: string) {
    const client = this.supabaseService.getClient();
    
    // First, unassign any staff members from this branch to prevent FK violations
    await client.from('profiles').update({ branch_id: null }).eq('branch_id', id);

    // Then delete the branch
    const { error } = await client.from('branches').delete().eq('id', id);
    if (error) return { success: false, message: error.message };

    // Invalidate caches for branches
    await this.redisService.delPattern('cache:*:/api/v1/locations*');

    return { success: true };
  }
}
