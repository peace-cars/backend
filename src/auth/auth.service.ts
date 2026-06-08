import { Injectable, Logger, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { createClient, User } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { Role } from './roles.enums';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private configService: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const authClient = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_KEY') || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      this.logger.warn(`Login failed for ${email}: ${authError?.message}`);
      throw new UnauthorizedException(authError?.message || 'Invalid credentials');
    }

    const { data: profile } = await this.supabaseService.getClient()
      .from('profiles')
      .select('id, role, full_name, phone_number, branch_id, is_verified, is_inspector_verified, gamification_points')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (!profile) {
      this.logger.warn(`Security Incident (Ghost User): User ${authData.user.id} logged in but has no profile. Initiating auto-repair...`);
      await this.repairProfile(authData.user);
      
      // Re-fetch profile after repair
      const { data: recoveredProfile } = await this.supabaseService.getClient()
        .from('profiles')
        .select('id, role, full_name, phone_number, branch_id, is_verified, is_inspector_verified, gamification_points')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (!recoveredProfile) {
        throw new UnauthorizedException('Authentication successful but profile auto-repair failed. Please contact HQ.');
      }
      
      this.logger.log(`Auto-repair successful for user ${authData.user.id}. Proceeding with login.`);
      
      return {
        session: {
          access_token: authData.session?.access_token,
          refresh_token: authData.session?.refresh_token,
          expires_at: authData.session?.expires_at,
        },
        user: {
          id: authData.user.id,
          email: authData.user.email,
        },
        profile: recoveredProfile,
      };
    }

    this.logger.log(`Login success for ${email}`);
    return {
      session: {
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
        expires_at: authData.session?.expires_at,
      },
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      profile,
    };
  }

  async repairProfile(user: User) {
    const { data: existing } = await this.supabaseService.getClient()
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    if (existing) return;

    this.logger.warn(`Ghost User detected: Repairing profile for ${user.id} (${user.email})`);

    const finalRole = user.user_metadata?.role || 'STAFF';
    
    const uuidDigits = user.id.replace(/[^0-9a-f]/g, '').slice(0, 9);
    const uniquePhone = `09${uuidDigits}`;

    const { data: roleRecord } = await this.supabaseService.getClient()
      .from('roles')
      .select('id')
      .eq('name', finalRole)
      .maybeSingle();

    const profileData = {
      id: user.id,
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown User',
      phone_number: user.user_metadata?.phone_number || uniquePhone,
      role: finalRole,
      role_id: roleRecord?.id || null,
      is_verified: (finalRole === 'USER' || finalRole === 'BROKER'),
      is_inspector_verified: false,
      gamification_points: 0,
      branch_id: user.user_metadata?.branch_id || null,
    };

    const { error } = await this.supabaseService.getClient()
      .from('profiles')
      .upsert(profileData);

    if (error) {
      if (error.code === '23505' && error.message.includes('phone_number')) {
        this.logger.warn(`Phone collision for ${user.id} - retrying with null phone...`);
        const { error: retryError } = await this.supabaseService.getClient()
          .from('profiles')
          .upsert({ ...profileData, phone_number: null });
        if (retryError) {
          this.logger.error(`Critical repair failure for ${user.id}: ${retryError.message}`);
        } else {
          this.logger.log(`Repair success (with null phone) for ${user.id}`);
        }
      } else {
        this.logger.error(`Repair failed for ${user.id}: ${error.message}`);
      }
    } else {
      this.logger.log(`Repair outcome: Profile restored for ${user.id}`);
    }
  }

  /**
   * Public self-registration — restricted to USER and BROKER roles only.
   * Staff/DM/GM accounts must be created via createStaffAccount() by an authorized manager.
   */
  async register(email: string, password: string, fullName: string, role: Role = Role.USER, phoneNumber: string | null = null, branchId?: string, avatarUrl?: string) {
    const authClient = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_KEY') || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // SECURITY: Only USER and BROKER can self-register. All other roles require GM provisioning.
    const selfRegistrableRoles = [Role.USER, Role.BROKER];
    if (!selfRegistrableRoles.includes(role)) {
      this.logger.warn(`[SECURITY] Blocked self-registration attempt: ${email} tried to register as ${role}`);
      throw new ForbiddenException('This role cannot be self-assigned. Contact your administrator.');
    }

    const finalFullName = fullName || 'New Partner';
    const finalPhoneNumber = phoneNumber || null;
    const finalAvatarUrl = avatarUrl || null;

    const { data: authData, error: authError } = await authClient.auth.signUp({
      email,
      password,
      options: {
        data: { 
          full_name: finalFullName, 
          role: role, 
          phone_number: finalPhoneNumber, 
          avatar_url: finalAvatarUrl 
        },
      },
    });

    if (authError || !authData.user) {
      this.logger.error(`Registration failed for ${email}: ${authError?.message}`);
      throw new BadRequestException(authError?.message || 'Registration failed');
    }

    const { data: roleRecord } = await this.supabaseService.getClient()
      .from('roles')
      .select('id')
      .eq('name', role)
      .maybeSingle();

    const profileData: any = {
      id: authData.user.id,
      full_name: finalFullName,
      phone_number: finalPhoneNumber,
      role: role,
      role_id: roleRecord?.id || null,
      is_verified: true, 
      is_inspector_verified: false,
      gamification_points: 0,
      branch_id: branchId || null,
      avatar_url: finalAvatarUrl,
    };

    const { error: profileError } = await this.supabaseService.getClient()
      .from('profiles')
      .upsert(profileData);

    if (profileError) {
      this.logger.error(`Profile creation failed: ${profileError.message}`);
      throw new BadRequestException(`Profile initialization failed: ${profileError.message}`);
    }

    this.logger.log(`Registration success: ${email} as ${role}`);

    return {
      session: authData.session ? {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
      } : null,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: role
      },
      profile: profileData,
    };
  }

  async getProfile(userId: string) {
    const { data: profile } = await this.supabaseService.getClient()
      .from('profiles')
      .select('id, role, full_name, phone_number, branch_id, is_verified, is_inspector_verified, gamification_points')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      throw new UnauthorizedException('Profile not found');
    }

    return profile;
  }

  async refresh(refreshToken: string) {
    const authClient = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_KEY') || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      this.logger.warn(`Token refresh failed: ${error?.message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const { data: profile } = await this.supabaseService.getClient()
      .from('profiles')
      .select('id, role, full_name, phone_number, branch_id, is_verified, is_inspector_verified, gamification_points')
      .eq('id', data.user!.id)
      .maybeSingle();

    return {
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
      user: {
        id: data.user!.id,
        email: data.user!.email,
      },
      profile: profile || null,
    };
  }

  /**
   * Admin-only staff provisioning — creates accounts with elevated roles.
   * Only callable by GENERAL_MANAGER via a protected controller endpoint.
   */
  async createStaffAccount(
    email: string,
    password: string,
    fullName: string,
    role: Role,
    branchId?: string,
    phoneNumber?: string,
    avatarUrl?: string,
  ) {
    const allowedProvisionRoles = [Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR];
    if (!allowedProvisionRoles.includes(role)) {
      throw new BadRequestException(`Role "${role}" cannot be provisioned via this endpoint. Use public registration for USER/BROKER.`);
    }

    const authClient = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_KEY') || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: authData, error: authError } = await authClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
          phone_number: phoneNumber || null,
          avatar_url: avatarUrl || null,
        },
      },
    });

    if (authError || !authData.user) {
      this.logger.error(`Staff provisioning failed for ${email}: ${authError?.message}`);
      throw new BadRequestException(authError?.message || 'Staff account creation failed');
    }

    const { data: roleRecord } = await this.supabaseService.getClient()
      .from('roles')
      .select('id')
      .eq('name', role)
      .maybeSingle();

    const profileData: Record<string, any> = {
      id: authData.user.id,
      full_name: fullName,
      phone_number: phoneNumber || null,
      role: role,
      role_id: roleRecord?.id || null,
      is_verified: true,
      is_inspector_verified: false,
      gamification_points: 0,
      branch_id: branchId || null,
      avatar_url: avatarUrl || null,
    };

    const { error: profileError } = await this.supabaseService.getClient()
      .from('profiles')
      .upsert(profileData);

    if (profileError) {
      this.logger.error(`Staff profile creation failed: ${profileError.message}`);
      throw new BadRequestException(`Profile initialization failed: ${profileError.message}`);
    }

    this.logger.log(`[ADMIN] Staff account provisioned: ${email} as ${role}`);

    return {
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: role,
      },
      profile: profileData,
    };
  }
}
