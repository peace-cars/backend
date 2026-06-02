import { Controller, Post, Get, Patch, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { SourcingRequestsService } from './sourcing-requests.service';
import { RolesGuard } from '../auth/roles.guard';
import { ScopeGuard } from '../auth/scope.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';

@Controller('sourcing-requests')
@UseGuards(RolesGuard, ScopeGuard)
export class SourcingRequestsController {
  constructor(private readonly sourcingRequestsService: SourcingRequestsService) {}

  @Post()
  async createRequest(@Body() data: any, @Req() req: any) {
    // Optionally link to customer if logged in
    const customerId = req.user?.id;
    return this.sourcingRequestsService.createRequest(data, customerId);
  }

  @Get('me')
  async getMyRequests(@Req() req: any) {
    return this.sourcingRequestsService.getMyRequests(req.user.id);
  }

  @Get()
  @Roles(Role.GENERAL_MANAGER, Role.DISTRICT_MANAGER, Role.STAFF)
  async getAllRequests(@Req() req: any, @Query('branchId') branchId?: string) {
    return this.sourcingRequestsService.getAllRequests(
      branchId, 
      req.user.role, 
      req.user.scopedBranchIds,
      req.user.branchId  // Pass user's own branchId as scope fallback
    );
  }

  @Get('assigned')
  @Roles(Role.STAFF)
  async getAssignedRequests(@Req() req: any) {
    return this.sourcingRequestsService.getAssignedRequests(req.user.id);
  }

  @Patch(':id/assign')
  @Roles(Role.GENERAL_MANAGER, Role.DISTRICT_MANAGER)
  async assignRequest(@Param('id') id: string, @Body('staffId') staffId?: string, @Body('branchId') branchId?: string) {
    return this.sourcingRequestsService.assignRequest(id, staffId, branchId);
  }

  @Patch(':id/status')
  @Roles(Role.GENERAL_MANAGER, Role.DISTRICT_MANAGER, Role.STAFF)
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.sourcingRequestsService.updateStatus(id, status);
  }

  @Post(':id/matches')
  @Roles(Role.STAFF, Role.GENERAL_MANAGER)
  async proposeMatch(@Param('id') id: string, @Body() matchData: any, @Req() req: any) {
    return this.sourcingRequestsService.proposeMatch(id, matchData, req.user.id);
  }

  @Patch('matches/:matchId/vote')
  async voteMatch(
    @Param('matchId') matchId: string, 
    @Body('action') action: 'LIKE' | 'REJECT', 
    @Body('rejectReason') rejectReason?: string
  ) {
    return this.sourcingRequestsService.voteMatch(matchId, action, rejectReason);
  }
}
