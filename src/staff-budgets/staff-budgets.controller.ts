import { Controller, Post, Get, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { StaffBudgetsService } from './staff-budgets.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';

@Controller('staff-budgets')
@UseGuards(RolesGuard)
export class StaffBudgetsController {
  constructor(private readonly budgetsService: StaffBudgetsService) {}

  @Post()
  @Roles(Role.STAFF, Role.DISTRICT_MANAGER)
  async request(@Req() req: any, @Body() body: { amount: number, purpose: string, receiptUrl?: string }) {
    return this.budgetsService.requestBudget(req.user.id, body.amount, body.purpose, body.receiptUrl);
  }

  @Get()
  @Roles(Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getAllBudgets(@Req() req: any) {
    if (req.user.role === Role.DISTRICT_MANAGER) {
      if (!req.user.locationId) return [];
      return this.budgetsService.getBranchBudgets(req.user.locationId);
    }
    if (req.user.role === Role.STAFF) {
      const all = await this.budgetsService.getAllBudgets();
      return all.filter((b: any) => b.requester_id === req.user.id);
    }
    return this.budgetsService.getAllBudgets();
  }

  @Patch(':id/approve')
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  async approve(@Req() req: any, @Param('id') id: string, @Body() body: { amount: number }) {
    return this.budgetsService.approveBudget(id, req.user.id, body.amount);
  }

  @Patch(':id/disburse')
  @Roles(Role.FINANCE_AUDITOR, Role.GENERAL_MANAGER)
  async disburse(@Req() req: any, @Param('id') id: string) {
    return this.budgetsService.disburseBudget(id, req.user.id);
  }

  @Patch(':id/receipt')
  @Roles(Role.STAFF, Role.DISTRICT_MANAGER)
  async updateReceipt(@Param('id') id: string, @Body() body: { receiptUrl: string }) {
    return this.budgetsService.updateReceiptUrl(id, body.receiptUrl);
  }
}
