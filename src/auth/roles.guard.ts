import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger, Inject, forwardRef } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';
import { RedisService } from '../redis/redis.service';
import { Role } from './roles.enums';
import { AuthenticatedUser } from '../common/types/user.types';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector, 
    private configService: ConfigService,
    private supabaseService: SupabaseService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
    private redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    const requiredPermissions = this.reflector.get<string[]>(PERMISSIONS_KEY, context.getHandler());
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    let userData: AuthenticatedUser | null = null;

    const authHeader = request.headers.authorization;
    let token = request.cookies?.access_token;

    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
       throw new UnauthorizedException('Missing Authorization Token.');
    }
        
    try {
      // Check Redis cache first (replaces the old unsafe global Map cache)
      const cacheKey = `auth:session:${token.substring(token.length - 16)}`;
      const cached = await this.redisService.get<any>(cacheKey);
          
      if (cached) {
        userData = cached;
        request.user = userData;
      } else {
        const { data: { user }, error } = await this.supabaseService.getClient().auth.getUser(token);
        if (error || !user) throw new UnauthorizedException('Invalid JWT Token.');

        const { data: profile } = await this.supabaseService.getClient()
          .from('profiles')
          .select(`
            *,
            roles (
              name,
              role_permissions (
                permissions ( slug )
              )
            )
          `)
          .eq('id', user.id)
          .maybeSingle();
            
        if (!profile) {
          this.logger.error(`Profile not found for user ${user.id}`);
          throw new UnauthorizedException('User profile not found or incomplete.');
        }
            
        const profileData = profile;
        const roleData = profileData.roles;
        const roleName = roleData?.name || profileData?.role || Role.USER;
            
        let permissions: string[] = [];
        if (roleData && roleData.role_permissions) {
          permissions = roleData.role_permissions
            .map((rp: any) => rp.permissions?.slug)
            .filter(Boolean);
        }
            
        let resolvedDistrictId = profileData.district_id || null;
        const resolvedBranchId = profileData.branch_id || null;

        if (!resolvedDistrictId && resolvedBranchId) {
          try {
            const { data: branchData } = await this.supabaseService.getClient()
              .from('branches')
              .select('district_id')
              .eq('id', resolvedBranchId)
              .maybeSingle();
            resolvedDistrictId = branchData?.district_id || null;
          } catch (e) {
            this.logger.warn(`Could not resolve district for branch ${resolvedBranchId}`);
          }
        }

        let scopedBranchIds: string[] = [];
        if (roleName === Role.DISTRICT_MANAGER && resolvedDistrictId) {
          try {
            const { data: districtBranches } = await this.supabaseService.getClient()
              .from('branches')
              .select('id')
              .eq('district_id', resolvedDistrictId);
            if (districtBranches) {
              scopedBranchIds = districtBranches.map((b: any) => b.id);
            }
          } catch (e) {
            this.logger.warn(`Could not resolve branches for district ${resolvedDistrictId}`);
          }
        }

        if (roleName === Role.GENERAL_MANAGER) {
          try {
            const { data: allBranches } = await this.supabaseService.getClient()
              .from('branches')
              .select('id');
            if (allBranches) {
              scopedBranchIds = allBranches.map((b: any) => b.id);
            }
          } catch (e) {
            this.logger.warn('Could not resolve all branches for GM');
          }
        }

        if (roleName === Role.STAFF && resolvedBranchId) {
          scopedBranchIds = [resolvedBranchId];
        }

        userData = { 
          id: user.id,
          userId: user.id,
          email: user.email || '', 
          role: roleName, 
          fullName: profileData.full_name || '',
          phoneNumber: profileData.phone_number,
          branchId: resolvedBranchId,
          districtId: resolvedDistrictId,
          locationId: resolvedBranchId,
          isVerified: profileData?.is_verified,
          gamificationPoints: profileData?.gamification_points,
          permissions: permissions,
          scopedBranchIds: scopedBranchIds,
        };
            
        // Cache in Redis with 60s TTL (replaces unbounded global Map)
        await this.redisService.set(cacheKey, userData, 60);

        request.user = userData;
      }
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error("Auth Guard Error: " + err.message);
      throw new UnauthorizedException('Authentication failed.');
    }

    if (!userData) {
      throw new UnauthorizedException('Authentication failed: user data could not be resolved.');
    }

    if (requiredRoles) {
      const hasRole = requiredRoles.includes(userData.role);
      if (!hasRole) {
        this.logger.warn(`[ROLE DENIED] User ${userData.id} (Role: ${userData.role}) tried to access ${request.url}. Required: ${requiredRoles.join(', ')}`);
        throw new UnauthorizedException(`Access Denied. Required Roles: ${requiredRoles.join(', ')}`);
      }
    }

    if (requiredPermissions) {
      if (userData.role === Role.GENERAL_MANAGER) {
        return true;
      }

      const hasPermission = requiredPermissions.every(p => userData.permissions.includes(p));
      if (!hasPermission) {
        this.logger.warn(`[PERMISSION DENIED] User ${userData.id} tried to access ${request.url}. Missing required permissions.`);
        throw new UnauthorizedException(`Access Denied. Missing required permissions.`);
      }
    }

    return true;
  }
}
