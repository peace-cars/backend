import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { StaffPerformanceService } from './staff-performance.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('staff-performance')
@UseGuards(RolesGuard)
export class StaffPerformanceController {
  constructor(private readonly performanceService: StaffPerformanceService) {}

  @Get('leaderboard')
  getLeaderboard() {
    return this.performanceService.getLeaderboard();
  }

  @Post('clock')
  @Roles('STAFF', 'DISTRICT_MANAGER', 'GENERAL_MANAGER')
  toggleClock(@Req() req: any) {
    return this.performanceService.toggleClock(req.user.userId);
  }

  @Get('me')
  @Roles('STAFF', 'DISTRICT_MANAGER', 'GENERAL_MANAGER', 'FINANCE_AUDITOR')
  getStaffProfile(@Req() req: any) {
    return this.performanceService.getStaffProfile(req.user.userId);
  }

  @Get('branch-roster')
  @UseGuards(RolesGuard)
  @Roles('GENERAL_MANAGER', 'DISTRICT_MANAGER')
  getRoster(@Req() req: any) {
    if (req.user.role === 'DISTRICT_MANAGER' && !req.user.locationId) {
      return [];
    }
    const locationId = req.user.role === 'DISTRICT_MANAGER' ? req.user.locationId : undefined;
    return this.performanceService.getRoster(locationId);
  }

  @Patch(':id/assign')
  assignLead(@Param('id') id: string, @Body() data: { staffId: string }) {
    // Left for branch managers
  }
}
