import { Injectable, Logger, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { Role } from './roles.enums';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private configService: ConfigService
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

    const adminDb = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_KEY') || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch the real profile - NO MORE GHOST REPAIR ON LOGIN
    let { data: profile } = await adminDb
      .from('profiles')
      .select('id, role, full_name, phone_number, location_id, is_verified, is_inspector_verified, gamification_points')
      .eq('id', authData.user.id)
      .single();

    if (!profile) {
      this.logger.error(`Security Incident: User ${authData.user.id} logged in but has no profile record.`);
      throw new UnauthorizedException('Authentication successful but profile metadata is missing. Contact HQ.');
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

  async repairProfile(user: any) {
    const adminClient = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_KEY') || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: existing } = await adminClient.from('profiles').select('id').eq('id', user.id).single();
    if (existing) return;

    this.logger.warn(`Ghost User detected: Repairing profile for ${user.id} (${user.email})`);

    const finalRole = user.user_metadata?.role || 'STAFF';
    
    // Always generate a unique phone from UUID to avoid conflicts during repair
    const uuidDigits = user.id.replace(/[^0-9a-f]/g, '').slice(0, 9);
    const uniquePhone = `09${uuidDigits}`;

    const { data: roleRecord } = await adminClient
      .from('roles')
      .select('id')
      .eq('name', finalRole)
      .single();

    const profileData = {
      id: user.id,
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown User',
      phone_number: user.user_metadata?.phone_number || uniquePhone,
      role: finalRole,
      role_id: roleRecord?.id || null,
      is_verified: (finalRole === 'USER' || finalRole === 'BROKER'),
      is_inspector_verified: false,
      gamification_points: 0,
      location_id: user.user_metadata?.location_id || null,
    };

    const { error } = await adminClient.from('profiles').upsert(profileData, { onConflict: 'id' });
    
    if (error) {
      if (error.code === '23505' && error.message.includes('profiles_phone_number_key')) {
        this.logger.warn(`Phone collision for ${user.id} - retrying with null phone...`);
        // Retry without phone number if it caused a conflict
        const { error: retryError } = await adminClient.from('profiles').upsert({
          ...profileData,
          phone_number: null
        }, { onConflict: 'id' });
        
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

  async register(email: string, password: string, fullName: string, role: Role = Role.USER, phoneNumber: string | null = null, locationId?: string, avatarUrl?: string) {
    const authClient = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_KEY') || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // RESTRICT: Added admin roles as per user request for setup
    const safeRoles = [Role.USER, Role.BROKER, Role.GENERAL_MANAGER, Role.DISTRICT_MANAGER, Role.STAFF];
    if (!safeRoles.includes(role)) {
      this.logger.warn(`Unauthorized role request: ${email} tried to register as ${role}`);
      throw new ForbiddenException('Unauthorized role assignment.');
    }

    // Normalize inputs
    const finalFullName = fullName || 'New Partner';
    const finalPhoneNumber = phoneNumber || null;
    const finalAvatarUrl = avatarUrl || null;

    // 1. Create Auth user
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

    const adminClient = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_KEY') || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 2. Fetch the Formal Role ID
    const { data: roleRecord } = await adminClient
      .from('roles')
      .select('id')
      .eq('name', role)
      .single();

    // 3. Create/Update profile record
    const profileData: any = {
      id: authData.user.id,
      full_name: finalFullName,
      phone_number: finalPhoneNumber,
      role: role,
      role_id: roleRecord?.id || null, // Formal link for permissions system
      is_verified: true, 
      is_inspector_verified: false,
      gamification_points: 0,
      location_id: locationId || null,
      avatar_url: finalAvatarUrl,
    };

    const { error: profileError } = await adminClient.from('profiles').upsert(profileData, { onConflict: 'id' });
    
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
    const adminDb = createClient(
      this.configService.get<string>('SUPABASE_URL') || '',
      this.configService.get<string>('SUPABASE_KEY') || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await adminDb
      .from('profiles')
      .select('id, role, full_name, phone_number, location_id, is_verified, is_inspector_verified, gamification_points')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new UnauthorizedException('Profile not found');
    }

    return data;
  }
}
