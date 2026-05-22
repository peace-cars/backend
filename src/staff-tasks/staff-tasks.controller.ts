import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { StaffTasksService } from './staff-tasks.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('staff-tasks')
@UseGuards(RolesGuard)
export class StaffTasksController {
  constructor(private readonly tasksService: StaffTasksService) {}

  @Get()
  @Roles('DISTRICT_MANAGER', 'GENERAL_MANAGER', 'STAFF')
  async getTasks(@Request() req: any, @Query('branchId') branchId?: string) {
    if (req.user.role === 'STAFF') {
      return this.tasksService.getMyTasks(req.user.userId || req.user.id);
    }
    if (req.user.role === 'DISTRICT_MANAGER') {
      if (!req.user.locationId) return [];
      return this.tasksService.getBranchTasks(req.user.locationId);
    }
    if (branchId) {
      return this.tasksService.getBranchTasks(branchId);
    }
    return this.tasksService.getAllTasks();
  }

  @Post()
  @Roles('DISTRICT_MANAGER', 'GENERAL_MANAGER')
  async assignTask(@Request() req: any, @Body() body: any) {
    return this.tasksService.assignTask({
      ...body,
      assigned_by: req.user.userId
    });
  }

  @Get('my-tasks')
  @Roles('STAFF', 'DISTRICT_MANAGER', 'GENERAL_MANAGER', 'FINANCE_AUDITOR')
  async getMyTasks(@Request() req: any) {
    return this.tasksService.getMyTasks(req.user.userId);
  }

  @Get('all')
  @Roles('DISTRICT_MANAGER', 'GENERAL_MANAGER')
  async getAllTasks(@Request() req: any, @Query('branchId') branchId?: string) {
    if (req.user.role === 'DISTRICT_MANAGER') {
      if (!req.user.locationId) return [];
      return this.tasksService.getBranchTasks(req.user.locationId);
    }
    if (branchId) {
      return this.tasksService.getBranchTasks(branchId);
    }
    return this.tasksService.getAllTasks();
  }

  @Patch(':id/progress')
  @Roles('STAFF')
  async updateProgress(@Param('id') id: string, @Body() body: { notes: string, coords?: string }) {
    return this.tasksService.updateProgress(id, body.notes, body.coords);
  }

  @Patch(':id/complete')
  @Roles('STAFF', 'DISTRICT_MANAGER')
  async completeTask(@Param('id') id: string) {
    return this.tasksService.completeTask(id);
  }
}
