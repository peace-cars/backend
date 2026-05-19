import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { FinancePlansService } from './finance-plans.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';

@Controller('finance-plans')
@UseGuards(RolesGuard)
export class FinancePlansController {
  constructor(private readonly financePlansService: FinancePlansService) {}

  @Post()
  @Roles(Role.USER, Role.STAFF, Role.GENERAL_MANAGER)
  async create(@Req() req: any, @Body() data: any) {
    return this.financePlansService.create(req.user.id, data);
  }

  @Get()
  async getAll(@Req() req: any) {
    return this.financePlansService.getAll(req.user.id, req.user.role);
  }

  @Patch(':id/status')
  @Roles(Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async updateStatus(@Param('id') id: string, @Body() data: { status: string; notes?: string }) {
    return this.financePlansService.updateStatus(id, data.status, data.notes);
  }
}
