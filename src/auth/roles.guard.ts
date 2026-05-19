import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger, Inject, forwardRef } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthService } from './auth.service';
import { Role } from './roles.enums';
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
    const isStrictAuthActive = this.configService.get<string>('USE_REAL_AUTH') === 'true';

    let userData: any = null;

    if (isStrictAuthActive) {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
           throw new UnauthorizedException('Missing Authorization Token.');
        }
        
        const token = authHeader.split(' ')[1];
        
        try {
          // Check simple memory cache first (TTL 60s)
          const now = Date.now();
          const cacheKey = `auth_${token}`;
          const cached = (global as any).__rolesCache?.get(cacheKey);
          
          if (cached && now - cached.timestamp < 60000) {
            userData = cached.data;
            request.user = userData;
          } else {
            const { data: { user }, error } = await this.supabaseService.getClient().auth.getUser(token);
            if (error || !user) throw new UnauthorizedException('Invalid JWT Token.');

            // Fetch Deep Profile with Roles, Permissions, AND Location→District hierarchy
            const { data: profile, error: profileError } = await this.supabaseService.getClient()
              .from('profiles')
              .select(`
                id,
                full_name,
                role,
                location_id,
                district_id,
                phone_number,
                is_verified,
                gamification_points,
                role_id,
                roles (
                  name,
                  role_permissions (
                    permissions (
                      slug
                    )
                  )
                )
              `)
              .eq('id', user.id)
              .single();
            
            if (profileError || !profile) {
              this.logger.error(`Profile not found for user ${user.id}: ${profileError?.message}`);
              throw new UnauthorizedException('User profile not found or incomplete.');
            }
            
            const profileData = profile as any;
            const roleData = Array.isArray(profileData?.roles) ? profileData?.roles[0] : profileData?.roles;
            const roleName = roleData?.name || profileData?.role || Role.USER;
            const permissions = roleData?.role_permissions?.map((rp: any) => rp.permissions.slug) || [];
            
            // Resolve hierarchy: branchId from location_id, districtId from profile or location's district
            let resolvedDistrictId = profileData?.district_id || null;
            const resolvedBranchId = profileData?.location_id || null;

            // If profile doesn't have district_id directly, derive it from the branch/location
            if (!resolvedDistrictId && resolvedBranchId) {
              try {
                const { data: locationData } = await this.supabaseService.getClient()
                  .from('locations')
                  .select('district_id')
                  .eq('id', resolvedBranchId)
                  .single();
                resolvedDistrictId = locationData?.district_id || null;
              } catch (e) {
                this.logger.warn(`Could not resolve district for branch ${resolvedBranchId}`);
              }
            }

            // For DMs, also resolve all branch IDs within their district (for downstream scoping)
            let scopedBranchIds: string[] = [];
            if (roleName === Role.DISTRICT_MANAGER && resolvedDistrictId) {
              try {
                const { data: districtBranches } = await this.supabaseService.getClient()
                  .from('locations')
                  .select('id')
                  .eq('district_id', resolvedDistrictId);
                scopedBranchIds = districtBranches?.map(b => b.id) || [];
              } catch (e) {
                this.logger.warn(`Could not resolve branches for district ${resolvedDistrictId}`);
              }
            }

            // For GMs, get ALL branch IDs (global scope)
            if (roleName === Role.GENERAL_MANAGER) {
              try {
                const { data: allBranches } = await this.supabaseService.getClient()
                  .from('locations')
                  .select('id');
                scopedBranchIds = allBranches?.map(b => b.id) || [];
              } catch (e) {
                this.logger.warn('Could not resolve all branches for GM');
              }
            }

            // For Staff, scope is just their own branch
            if (roleName === Role.STAFF && resolvedBranchId) {
              scopedBranchIds = [resolvedBranchId];
            }

            userData = { 
              id: user.id,
              userId: user.id, // For legacy controller compatibility
              email: user.email, 
              role: roleName, 
              fullName: profileData.full_name,
              phoneNumber: profileData.phone_number,
              branchId: resolvedBranchId,
              districtId: resolvedDistrictId,
              locationId: resolvedBranchId, // Legacy compat
              isVerified: profileData?.is_verified,
              gamificationPoints: profileData?.gamification_points,
              permissions: permissions,
              scopedBranchIds: scopedBranchIds, // Array of branch IDs this user can access
            };
            
            // Set Cache
            if (!(global as any).__rolesCache) {
              (global as any).__rolesCache = new Map();
            }
            (global as any).__rolesCache.set(cacheKey, { data: userData, timestamp: now });

            request.user = userData;
          }
        } catch (err: any) {
          this.logger.error("Auth Guard Error: " + err.message);
          throw new UnauthorizedException('Authentication failed.');
        }
    } else {
        // Fallback for Mock Auth (Prototyping)
        userData = { 
          id: 'mock-id',
          role: request.headers['x-user-role'] || Role.USER,
          permissions: [],
          branchId: request.headers['x-user-branch-id'],
          districtId: request.headers['x-user-district-id'],
          locationId: request.headers['x-user-branch-id'], // Legacy compat
          scopedBranchIds: request.headers['x-user-scoped-branches'] 
            ? request.headers['x-user-scoped-branches'].split(',') 
            : [],
        };
        request.user = userData;
    }

    // 1. Validate Roles (if any)
    if (requiredRoles) {
      const hasRole = requiredRoles.includes(userData.role);
      if (!hasRole) {
        this.logger.warn(`[ROLE DENIED] User ${userData.id} (Role: ${userData.role}) tried to access ${request.url}. Required: ${requiredRoles.join(', ')}`);
        throw new UnauthorizedException(`Access Denied. Required Roles: ${requiredRoles.join(', ')}`);
      }
    }

    // 2. Validate Permissions (if any)
    if (requiredPermissions) {
      // General Manager has all permissions by default
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
