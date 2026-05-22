import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './roles.enums';

/**
 * ScopeGuard — Enforces organizational hierarchy on data access.
 * 
 * Must be used AFTER RolesGuard (which populates req.user with scopedBranchIds).
 * 
 * Hierarchy:
 *   GENERAL_MANAGER → Global access (all branches, all districts)
 *   DISTRICT_MANAGER → District access (all branches within their district)
 *   STAFF → Branch access (only their assigned branch)
 * 
 * This guard validates that write operations (POST/PATCH/DELETE) target
 * resources within the user's scope. For read operations, controllers
 * should use req.user.scopedBranchIds to filter queries.
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  private readonly logger = new Logger(ScopeGuard.name);

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const user = request.user;

    if (!user) return false;

    // GENERAL_MANAGER bypasses all scoping — God's Eye
    if (user.role === Role.GENERAL_MANAGER) return true;

    const body = request.body;
    const scopedBranchIds: string[] = user.scopedBranchIds || [];

    // DISTRICT_MANAGER scope enforcement
    if (user.role === Role.DISTRICT_MANAGER) {
      if (!user.districtId) {
        this.logger.warn(`[SCOPE DENIED] DM ${user.id} has no assigned district.`);
        throw new ForbiddenException('District Manager has no assigned district scope.');
      }

      // If the request targets a specific branch, ensure it's within the DM's district
      const baseUrl = request.baseUrl || request.originalUrl || request.url || '';
      const routePath = request.route?.path || '';
      const treatIdAsBranch = /(?:branches?|locations?)/i.test(baseUrl) || /(?:branch|location|district)/i.test(routePath);
      const explicitTargetBranchId = body?.branch_id || body?.branchId || request.params?.branchId || request.query?.branchId;
      const targetBranchId = explicitTargetBranchId || (treatIdAsBranch ? request.params?.id : undefined);
      if (targetBranchId && !scopedBranchIds.includes(targetBranchId)) {
        this.logger.warn(`[SCOPE DENIED] DM ${user.id} tried to access branch ${targetBranchId} outside district ${user.districtId}`);
        throw new ForbiddenException('Action outside of assigned district scope.');
      }

      // If the request targets a specific district, ensure it matches
      const targetDistrictId = body?.district_id || body?.districtId || request.params?.districtId || request.query?.districtId;
      if (targetDistrictId && targetDistrictId !== user.districtId) {
        this.logger.warn(`[SCOPE DENIED] DM ${user.id} tried to access district ${targetDistrictId}, assigned to ${user.districtId}`);
        throw new ForbiddenException('Action outside of assigned district scope.');
      }
    }

    // STAFF scope enforcement
    if (user.role === Role.STAFF) {
      if (!user.branchId) {
        this.logger.warn(`[SCOPE DENIED] Staff ${user.id} has no assigned branch.`);
        throw new ForbiddenException('Staff member has no assigned branch scope.');
      }

      // Staff can only operate within their own branch
      const baseUrl = request.baseUrl || request.originalUrl || request.url || '';
      const routePath = request.route?.path || '';
      const treatIdAsBranch = /(?:branches?|locations?)/i.test(baseUrl) || /(?:branch|location|district)/i.test(routePath);
      const explicitTargetBranchId = body?.branch_id || body?.branchId || request.params?.branchId || request.query?.branchId;
      const targetBranchId = explicitTargetBranchId || (treatIdAsBranch ? request.params?.id : undefined);
      if (targetBranchId && targetBranchId !== user.branchId) {
        this.logger.warn(`[SCOPE DENIED] Staff ${user.id} tried to access branch ${targetBranchId}, assigned to ${user.branchId}`);
        throw new ForbiddenException('Action outside of assigned branch scope.');
      }
    }

    return true;
  }
}
