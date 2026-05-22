import { Injectable, Logger, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { Role } from './roles.enums';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private configService: ConfigService,
    private readonly prisma: PrismaService,
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

    // Fetch the real profile - NO MORE GHOST REPAIR ON LOGIN
    const profile = await this.prisma.profiles.findUnique({
      where: { id: authData.user.id },
      select: {
        id: true,
        role: true,
        full_name: true,
        phone_number: true,
        branch_id: true,
        is_verified: true,
        is_inspector_verified: true,
        gamification_points: true,
      },
    });

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
    const existing = await this.prisma.profiles.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
    if (existing) return;

    this.logger.warn(`Ghost User detected: Repairing profile for ${user.id} (${user.email})`);

    const finalRole = user.user_metadata?.role || 'STAFF';
    
    // Always generate a unique phone from UUID to avoid conflicts during repair
    const uuidDigits = user.id.replace(/[^0-9a-f]/g, '').slice(0, 9);
    const uniquePhone = `09${uuidDigits}`;

    const roleRecord = await this.prisma.roles.findUnique({
      where: { name: finalRole },
      select: { id: true },
    });

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

    try {
      await this.prisma.profiles.upsert({
        where: { id: user.id },
        update: profileData,
        create: profileData,
      });
      this.logger.log(`Repair outcome: Profile restored for ${user.id}`);
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('phone_number')) {
        this.logger.warn(`Phone collision for ${user.id} - retrying with null phone...`);
        try {
          await this.prisma.profiles.upsert({
            where: { id: user.id },
            update: { ...profileData, phone_number: null },
            create: { ...profileData, phone_number: null },
          });
          this.logger.log(`Repair success (with null phone) for ${user.id}`);
        } catch (retryError: any) {
          this.logger.error(`Critical repair failure for ${user.id}: ${retryError.message}`);
        }
      } else {
        this.logger.error(`Repair failed for ${user.id}: ${error.message}`);
      }
    }
  }

  async register(email: string, password: string, fullName: string, role: Role = Role.USER, phoneNumber: string | null = null, branchId?: string, avatarUrl?: string) {
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

    // 2. Fetch the Formal Role ID
    const roleRecord = await this.prisma.roles.findUnique({
      where: { name: role },
      select: { id: true },
    });

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
      branch_id: branchId || null,
      avatar_url: finalAvatarUrl,
    };

    try {
      await this.prisma.profiles.upsert({
        where: { id: authData.user.id },
        update: profileData,
        create: profileData,
      });
    } catch (profileError: any) {
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
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        full_name: true,
        phone_number: true,
        branch_id: true,
        is_verified: true,
        is_inspector_verified: true,
        gamification_points: true,
      },
    });

    if (!profile) {
      throw new UnauthorizedException('Profile not found');
    }

    return profile;
  }
}
