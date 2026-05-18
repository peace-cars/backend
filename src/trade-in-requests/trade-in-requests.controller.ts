import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { TradeInRequestsService } from './trade-in-requests.service';
import { RolesGuard } from '../auth/roles.guard';
import { ScopeGuard } from '../auth/scope.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';
import { CreateTradeInDto, InspectionUploadDto, UpdateStatusDto } from './dto/trade-in.dto';

@Controller('trade-in-requests')
@UseGuards(RolesGuard, ScopeGuard)
export class TradeInRequestsController {
  constructor(private readonly service: TradeInRequestsService) {}

  @Get()
  @Roles(Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  getAllLeads(@Req() req: any) {
    return this.service.getAllLeads(req.user.id, req.user.role, req.user.scopedBranchIds);
  }

  @Get('me')
  @Roles(Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  getAssignedLeads(@Req() req: any) {
     return this.service.getAssignedLeads(req.user.id);
  }

  @Post()
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  createLead(@Req() req: any, @Body() data: CreateTradeInDto) {
    return this.service.createLead(req.user.id, data);
  }

  @Get(':id')
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  getLeadById(@Req() req: any, @Param('id') id: string) {
    return this.service.getLeadById(req.user.id, req.user.role, id);
  }

  @Get('customer/:id')
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  getCustomerLeads(@Req() req: any, @Param('id') id: string) {
    // Only the customer themselves or higher staff can read this
    if (req.user.role === Role.USER && req.user.id !== id) {
       throw new ForbiddenException('You cannot view leads belonging to another customer.');
    }
    return this.service.getCustomerLeads(req.user.id, id);
  }

  @Post('inspection')
  @Roles(Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  uploadInspectionData(@Req() req: any, @Body() data: InspectionUploadDto) {
     return this.service.processInspectionUpload(req.user.id, data);
  }

  @Patch(':id/status')
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.STAFF)
  updateStatus(@Param('id') id: string, @Body() data: UpdateStatusDto) {
    return this.service.updateStatus(id, data.status);
  }

  @Patch(':id/approve')
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  approveLead(
    @Param('id') id: string, 
    @Body() data: { offerPrice: number, notes?: string },
    @Req() req: any
  ) {
    return this.service.approveLead(id, data.offerPrice, data.notes, req.user.role);
  }

  @Patch(':id/reject')
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER)
  rejectLead(
    @Param('id') id: string, 
    @Body() data: { reason: string },
    @Req() req: any
  ) {
    return this.service.rejectLead(id, data.reason, req.user.role);
  }
}
