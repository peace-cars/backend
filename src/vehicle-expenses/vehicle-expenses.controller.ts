import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { VehicleExpensesService } from './vehicle-expenses.service';
import { RolesGuard } from '../auth/roles.guard';
import { ScopeGuard } from '../auth/scope.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';

/**
 * Vehicle Expenses Controller
 * 
 * Manages reconditioning, service, and repair costs attached to individual vehicles.
 * These expenses feed into the Total Unit Cost calculation:
 *   Total Unit Cost = Purchase Price + SUM(vehicle_expenses)
 *   Profit = Sale Price - Total Unit Cost
 * 
 * RBAC:
 *   - STAFF can create expenses for vehicles at their branch
 *   - DM can create/view expenses across their district
 *   - GM/FINANCE can view all; only GM can delete
 */
@Controller('vehicle-expenses')
@UseGuards(RolesGuard, ScopeGuard)
export class VehicleExpensesController {
  constructor(private readonly vehicleExpensesService: VehicleExpensesService) {}

  @Post(':vehicleId')
  @Roles(Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  async createExpense(
    @Param('vehicleId') id: string, 
    @Body() data: any,
    @Req() req: any
  ) {
    return this.vehicleExpensesService.createExpense(id, {
      amount: data.amount,
      purpose: data.purpose,
      category: data.category,
      staffId: req.user?.id || data.staffId
    });
  }

  @Get(':vehicleId')
  @Roles(Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getVehicleExpenses(@Param('vehicleId') id: string) {
    return this.vehicleExpensesService.getVehicleExpenses(id);
  }

  @Delete(':expenseId')
  @Roles(Role.GENERAL_MANAGER)
  async deleteExpense(@Param('expenseId') id: string) {
    return this.vehicleExpensesService.deleteExpense(id);
  }
}
