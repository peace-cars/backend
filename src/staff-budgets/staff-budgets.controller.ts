import { Controller, Post, Get, Patch, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { StaffBudgetsService } from './staff-budgets.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';
import { CreateBudgetRequestDto, ApproveBudgetDto, UpdateReceiptDto } from './dto/budget.dto';

@Controller('staff-budgets')
@UseGuards(RolesGuard)
export class StaffBudgetsController {
  constructor(private readonly budgetsService: StaffBudgetsService) {}

  @Post()
  @Roles(Role.STAFF, Role.DISTRICT_MANAGER)
  async request(@Req() req: any, @Body() body: CreateBudgetRequestDto) {
    return this.budgetsService.requestBudget(req.user.id, body.amount, body.purpose, body.receiptUrl);
  }

  @Get()
  @Roles(Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getAllBudgets(@Req() req: any, @Query('branchId') branchId?: string) {
    if (branchId) {
      if (req.user.role === Role.GENERAL_MANAGER || req.user.role === Role.FINANCE_AUDITOR) {
        return this.budgetsService.getBranchBudgets(branchId);
      } else if (req.user.role === Role.DISTRICT_MANAGER && req.user.scopedBranchIds?.includes(branchId)) {
        return this.budgetsService.getBranchBudgets(branchId);
      } else {
        return [];
      }
    }

    if (req.user.role === Role.DISTRICT_MANAGER) {
      if (!req.user.districtId) return [];
      return this.budgetsService.getDistrictBudgets(req.user.districtId);
    }
    if (req.user.role === Role.STAFF) {
      return this.budgetsService.getUserBudgets(req.user.id);
    }
    return this.budgetsService.getAllBudgets();
  }

  @Patch(':id/approve')
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  async approve(@Req() req: any, @Param('id') id: string, @Body() body: ApproveBudgetDto) {
    return this.budgetsService.approveBudget(id, req.user.id, body.amount, req.user.role, req.user.districtId);
  }

  @Patch(':id/disburse')
  @Roles(Role.FINANCE_AUDITOR, Role.GENERAL_MANAGER)
  async disburse(@Req() req: any, @Param('id') id: string) {
    return this.budgetsService.disburseBudget(id, req.user.id);
  }

  @Patch(':id/receipt')
  @Roles(Role.STAFF, Role.DISTRICT_MANAGER)
  async updateReceipt(@Param('id') id: string, @Body() body: UpdateReceiptDto) {
    return this.budgetsService.updateReceiptUrl(id, body.receiptUrl);
  }
}

