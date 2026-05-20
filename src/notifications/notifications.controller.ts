import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Logger, UseGuards, Req } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { FCMService } from './fcm.service';
import { NotificationsService } from './notifications.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';

@Controller('notifications')
@UseGuards(RolesGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);
  
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly fcmService: FCMService,
    private readonly notificationsService: NotificationsService
  ) {}

  @Get()
  async getAll(@Req() req: any, @Query('recipientId') recipientId?: string) {
    try {
      const targetId = recipientId || req.user.id;
      // Users can only view their own notifications unless they are GM
      if (req.user.id !== targetId && req.user.role !== Role.GENERAL_MANAGER) {
        return [];
      }

      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('notifications')
        .select('*')
        .eq('recipient_id', targetId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        this.logger.error(`Supabase error fetching notifications: ${error.message}`);
        return [];
      }
      
      return (data || []).map(n => ({
        ...n,
        isRead: n.is_read,
        createdAt: n.created_at,
        referenceId: n.reference_id,
        actionUrl: n.action_url
      }));
    } catch (e) {
      this.logger.error(`Critical failure fetching notifications: ${e.message}`);
      return [];
    }
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { count };
  }

  @Patch(':id/read')
  async markRead(@Req() req: any, @Param('id') id: string) {
    const { error } = await this.supabaseService.getClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('recipient_id', req.user.id); // Security: only mark own as read
    
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  @Post('mark-all-read')
  async markAllRead(@Req() req: any) {
    const { error } = await this.supabaseService.getClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', req.user.id)
      .eq('is_read', false);
    
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  @Delete(':id')
  async deleteNotification(@Req() req: any, @Param('id') id: string) {
    try {
      return await this.notificationsService.deleteNotification(id, req.user.id);
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  @Post('register-fcm')
  async registerFCMToken(@Req() req: any, @Body() data: { token: string }) {
    if (!data.token) {
      return { success: false, message: 'Missing token' };
    }
    // Optional device info for debugging
    const deviceInfo = (data as any).device || null;
    this.logger.log(`Register FCM token for user ${req.user.id}: ${data.token.substring(0,10)}... device=${JSON.stringify(deviceInfo)}`);
    const success = await this.fcmService.registerToken(req.user.id, data.token, deviceInfo);
    return { success };
  }

  @Get('tokens/:userId')
  @Roles(Role.GENERAL_MANAGER)
  async getTokens(@Param('userId') userId: string) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.from('profiles').select('id, full_name, fcm_token, last_seen_at').eq('id', userId).single();
    if (error) return { success: false, message: error.message };
    return { success: true, token: data?.fcm_token || null, profile: data };
  }

  @Post('test-push')
  @Roles(Role.GENERAL_MANAGER)
  async testPushNotification(@Req() req: any, @Body() data: { title: string, body: string, recipientId?: string }) {
    const targetId = data.recipientId || req.user.id;
    const result = await this.notificationsService.create(
      targetId,
      data.title || 'Test Notification',
      data.body || 'This is a test push notification from the PeaceCars system.',
      'SYSTEM'
    );
    return { success: !!result, message: result ? 'Push triggered' : 'Push failed' };
  }
}
