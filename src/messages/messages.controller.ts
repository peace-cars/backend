import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';

@Controller('messages')
@UseGuards(RolesGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('recent')
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getRecent(@Req() req: any) {
    const isStaff = req.user.role === Role.STAFF || req.user.role === Role.DISTRICT_MANAGER || req.user.role === Role.GENERAL_MANAGER;
    return this.messagesService.getConversations(req.user.id, isStaff);
  }

  @Get('conversations')
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getConversations(@Req() req: any) {
    const isStaff = req.user.role === Role.STAFF || req.user.role === Role.DISTRICT_MANAGER || req.user.role === Role.GENERAL_MANAGER;
    return this.messagesService.getConversations(req.user.id, isStaff);
  }

  @Get(':conversationId')
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getMessages(@Req() req: any, @Param('conversationId') id: string) {
    return this.messagesService.getMessages(req.user.id, req.user.role, id);
  }

  @Post()
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async sendMessage(@Req() req: any, @Body() data: any) {
    return this.messagesService.sendMessage(req.user.id, req.user.role, {
      conversationId: data.conversationId,
      text: data.text,
      vehicleId: data.vehicleId
    });
  }
}
