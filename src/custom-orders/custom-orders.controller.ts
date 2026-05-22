import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CustomOrdersService } from './custom-orders.service';
import { RolesGuard } from '../auth/roles.guard';
import { ScopeGuard } from '../auth/scope.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';
import { CreateCustomOrderDto, UpdateCustomOrderStatusDto, AssignCustomOrderDto } from './dto/custom-order.dto';

@Controller('custom-orders')
@UseGuards(RolesGuard, ScopeGuard)
export class CustomOrdersController {
  constructor(private readonly service: CustomOrdersService) {}

  @Post()
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  create(@Body() data: CreateCustomOrderDto) {
    return this.service.create(data);
  }

  @Get()
  @Roles(Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  getAll(@Req() req: any) {
    return this.service.getAll(req.user.role, req.user.scopedBranchIds);
  }

  @Get('stats')
  @Roles(Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  getStats() {
    return this.service.getStats();
  }

  @Patch(':id/status')
  @Roles(Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  updateStatus(@Param('id') id: string, @Body() data: UpdateCustomOrderStatusDto) {
    return this.service.updateStatus(id, data.status, data.staffNotes);
  }

  @Patch(':id/assign')
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  assignStaff(@Param('id') id: string, @Body() data: AssignCustomOrderDto) {
    return this.service.assignStaff(id, data.staffId);
  }
}
