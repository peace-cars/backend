import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';

const ALL_ROLES = [Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR];
const STAFF_ROLES = [Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR];

@Controller('messages')
@UseGuards(RolesGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('recent')
  @Roles(...ALL_ROLES)
  async getRecent(@Req() req: any) {
    return this.messagesService.getConversations(req.user.id, req.user.role);
  }

  @Get('conversations')
  @Roles(...ALL_ROLES)
  async getConversations(@Req() req: any) {
    return this.messagesService.getConversations(req.user.id, req.user.role);
  }

  @Get(':conversationId')
  @Roles(...ALL_ROLES)
  async getMessages(@Req() req: any, @Param('conversationId') id: string) {
    return this.messagesService.getMessages(req.user.id, req.user.role, id);
  }

  @Post()
  @Roles(...ALL_ROLES)
  async sendMessage(@Req() req: any, @Body() data: any) {
    return this.messagesService.sendMessage(req.user.id, req.user.role, {
      conversationId: data.conversationId,
      text: data.text,
      vehicleId: data.vehicleId
    });
  }

  @Patch(':conversationId/claim')
  @Roles(...STAFF_ROLES)
  async claimConversation(@Req() req: any, @Param('conversationId') id: string) {
    return this.messagesService.claimConversation(req.user.id, id);
  }

  @Patch(':conversationId/resolve')
  @Roles(...STAFF_ROLES)
  async resolveConversation(@Req() req: any, @Param('conversationId') id: string) {
    return this.messagesService.resolveConversation(req.user.id, req.user.role, id);
  }

  @Patch(':conversationId/assign')
  @Roles(Role.GENERAL_MANAGER)
  async reassignConversation(@Param('conversationId') id: string, @Body('staffId') staffId: string) {
    return this.messagesService.reassignConversation(staffId, id);
  }
}
