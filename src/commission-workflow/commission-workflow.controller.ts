import { Controller, Get, Patch, Param, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../auth/roles.guard';
import { ScopeGuard } from '../auth/scope.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';
import { CommissionsService } from '../commissions/commissions.service';
import { AuthenticatedUser } from '../common/types/user.types';

@ApiTags('Commission Workflow')
@ApiBearerAuth('JWT-auth')
@Controller('commission-workflow')
@UseGuards(RolesGuard, ScopeGuard)
export class CommissionWorkflowController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @ApiOperation({ summary: 'Get all commissions with scoping' })
  @Get()
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getAll(@Req() req: { user: AuthenticatedUser }, @Query('branchId') branchId?: string) {
    return this.commissionsService.getAll(req.user, branchId);
  }

  @ApiOperation({ summary: 'DM verifies a commission payout' })
  @Patch(':id/dm-verify')
  @Roles(Role.DISTRICT_MANAGER)
  async dmVerify(@Param('id') id: string, @Req() req: { user: AuthenticatedUser }) {
    return this.commissionsService.dmVerify(id, req.user);
  }

  @ApiOperation({ summary: 'GM/Finance approves a commission payout' })
  @Patch(':id/gm-approve')
  @Roles(Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async gmApprove(@Param('id') id: string, @Req() req: { user: AuthenticatedUser }) {
    return this.commissionsService.gmApprove(id, req.user);
  }

  @ApiOperation({ summary: 'Get specific commission details' })
  @Get(':id')
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getById(@Param('id') id: string, @Req() req: { user: AuthenticatedUser }) {
    return this.commissionsService.getById(id, req.user);
  }
}
