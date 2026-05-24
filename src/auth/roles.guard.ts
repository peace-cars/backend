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
          const now = Date.now();
          const cacheKey = `auth_${token}`;
          const cached = (global as any).__rolesCache?.get(cacheKey);
          
          if (cached && now - cached.timestamp < 60000) {
            userData = cached.data;
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
              email: user.email, 
              role: roleName, 
              fullName: profileData.full_name,
              phoneNumber: profileData.phone_number,
              branchId: resolvedBranchId,
              districtId: resolvedDistrictId,
              locationId: resolvedBranchId,
              isVerified: profileData?.is_verified,
              gamificationPoints: profileData?.gamification_points,
              permissions: permissions,
              scopedBranchIds: scopedBranchIds,
            };
            
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
        userData = { 
          id: 'mock-id',
          role: request.headers['x-user-role'] || Role.USER,
          permissions: [],
          branchId: request.headers['x-user-branch-id'],
          districtId: request.headers['x-user-district-id'],
          locationId: request.headers['x-user-branch-id'],
          scopedBranchIds: request.headers['x-user-scoped-branches'] 
            ? (request.headers['x-user-scoped-branches'] as string).split(',') 
            : [],
        };
        request.user = userData;
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
