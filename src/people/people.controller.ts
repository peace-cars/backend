import { Controller, Get, Post, Patch, Body, Param, UseGuards, Logger, Req, Query } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RolesGuard } from '../auth/roles.guard';
import { ScopeGuard } from '../auth/scope.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';
import { CreatePersonDto, UpdatePersonDto } from './dto/people.dto';

@Controller('people')
@UseGuards(RolesGuard, ScopeGuard)
export class PeopleController {
  private readonly logger = new Logger(PeopleController.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  @Get()
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getAll(@Req() req: any, @Query('branchId') branchId?: string) {
    try {
      let query = this.supabaseService.getClient()
        .from('profiles')
        .select('*, locations(name)');
      
      if (branchId) {
        if (req.user.role === Role.GENERAL_MANAGER || req.user.role === Role.FINANCE_AUDITOR) {
          query = query.eq('location_id', branchId);
        } else if (req.user.role === Role.DISTRICT_MANAGER && req.user.scopedBranchIds?.includes(branchId)) {
          query = query.eq('location_id', branchId);
        } else {
           return []; // Unauthorized for this branch
        }
      } else {
        // Use scopedBranchIds for hierarchy-aware filtering
        // GM: sees all (scopedBranchIds contains ALL branches)
        // DM: sees staff across ALL branches in their district
        // FINANCE_AUDITOR: sees all (no branch scoping needed)
        if (req.user.role === Role.DISTRICT_MANAGER && req.user.scopedBranchIds?.length > 0) {
          query = query.in('location_id', req.user.scopedBranchIds);
        }
        // GM and FINANCE_AUDITOR see all — no filter applied
      }

      const { data: profiles, error } = await query;
      
      if (error) {
        this.logger.error(`Supabase error fetching people: ${error.message}`);
        return [];
      }
      
      if (!profiles) return [];

      return profiles.map(p => ({
        ...p,
        fullName: p.full_name,
        phone: p.phone_number,
        locationName: p.locations?.name || 'Unassigned',
        isActive: p.is_verified
      }));
    } catch (e) {
      this.logger.error(`Critical failure fetching people: ${e.message}`);
      return [];
    }
  }

  @Post()
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  async create(@Body() data: CreatePersonDto, @Req() req: any) {
    const client = this.supabaseService.getClient();
    
    // DM can only create staff within their scoped branches
    if (req.user.role === Role.DISTRICT_MANAGER && data.locationId) {
      if (!req.user.scopedBranchIds?.includes(data.locationId)) {
        return { success: false, message: 'Cannot create staff outside your district scope.' };
      }
    }

    // Auto-generate email from phone for internal users
    const email = `${data.phone.replace(/[^0-9]/g, '')}@peacecars.com`;
    const password = 'Password123!'; // HQ-set default

    // 1. Create auth user via admin API
    const { data: authData, error: authError } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
          full_name: data.fullName, 
          role: data.role, 
          phone_number: data.phone, 
          location_id: data.locationId 
      }
    });

    if (authError) return { success: false, message: authError.message };

    // Resolve district_id from the target location
    let districtId = null;
    if (data.locationId) {
      const { data: loc } = await client.from('locations').select('district_id').eq('id', data.locationId).single();
      districtId = loc?.district_id || null;
    }

    // 2. Insert profile
    const profileData = {
      id: authData.user.id,
      full_name: data.fullName,
      phone_number: data.phone,
      role: data.role,
      location_id: data.locationId || null,
      district_id: districtId,
      commission_tier: data.commissionTier || 1.0,
      is_verified: true, // internal staff created by admin
      is_inspector_verified: (data.role === Role.STAFF), 
      gamification_points: 0,
      date_of_birth: data.date_of_birth || null
    };

    const { error: profileError } = await client.from('profiles').insert(profileData);
    if (profileError) return { success: false, message: profileError.message };

    return { 
      success: true, 
      person: {
        ...profileData,
        fullName: profileData.full_name,
        phone: profileData.phone_number,
        locationName: 'Refreshing...', // Frontend will re-fetch
        isActive: true
      } 
    };
  }

  @Patch(':id')
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  async update(@Param('id') id: string, @Body() data: UpdatePersonDto, @Req() req: any) {
    // DM scope check: can only edit staff within their district
    if (req.user.role === Role.DISTRICT_MANAGER) {
      const { data: target } = await this.supabaseService.getClient()
        .from('profiles').select('location_id').eq('id', id).single();
      if (target?.location_id && !req.user.scopedBranchIds?.includes(target.location_id)) {
        return { success: false, message: 'Cannot edit staff outside your district.' };
      }
    }

    // Resolve district_id if location is changing
    let districtId = undefined;
    if (data.locationId) {
      const { data: loc } = await this.supabaseService.getClient()
        .from('locations').select('district_id').eq('id', data.locationId).single();
      districtId = loc?.district_id || null;
    }

    const updatePayload: any = {
      full_name: data.fullName,
      phone_number: data.phone,
      role: data.role,
      location_id: data.locationId,
      commission_tier: data.commissionTier,
      is_verified: data.isActive,
      date_of_birth: data.date_of_birth
    };

    if (districtId !== undefined) {
      updatePayload.district_id = districtId;
    }

    const { error } = await this.supabaseService.getClient()
      .from('profiles')
      .update(updatePayload)
      .eq('id', id);
    
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  @Patch(':id/toggle')
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  async toggleActive(@Param('id') id: string, @Req() req: any) {
    const client = this.supabaseService.getClient();

    // DM scope check
    if (req.user.role === Role.DISTRICT_MANAGER) {
      const { data: target } = await client.from('profiles').select('location_id').eq('id', id).single();
      if (target?.location_id && !req.user.scopedBranchIds?.includes(target.location_id)) {
        return { success: false, message: 'Cannot toggle staff outside your district.' };
      }
    }

    const { data: profile } = await client.from('profiles').select('is_verified, role').eq('id', id).single();
    if (profile) {
        const newVerifiedStatus = !profile.is_verified;
        const updateData: any = { is_verified: newVerifiedStatus };
        
        // Auto-certify STAFF as inspectors when verified
        if (newVerifiedStatus && profile.role === Role.STAFF) {
            updateData.is_inspector_verified = true;
        }

        const { error } = await client.from('profiles').update(updateData).eq('id', id);
        if (error) return { success: false, message: error.message };
        return { success: true, isActive: newVerifiedStatus };
    }
    return { success: false, message: 'Profile not found' };
  }
}
