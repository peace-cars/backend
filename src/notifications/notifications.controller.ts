import { Controller, Get, Post, Patch, Body, Param, Query, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { FCMService } from './fcm.service';

@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);
  
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly fcmService: FCMService
  ) {}

  @Get()
  async getAll(@Query('recipientId') recipientId?: string) {
    try {
      const client = this.supabaseService.getClient();
      let query = client.from('notifications').select('*').order('created_at', { ascending: false });
      
      if (recipientId) {
        query = query.eq('recipient_id', recipientId);
      }
      
      const { data, error } = await query;
      if (error) {
        this.logger.error(`Supabase error fetching notifications: ${error.message}`);
        return [];
      }
      
      // Map fields for client compatibility (e.g. is_read -> isRead)
      return (data || []).map(n => ({
        ...n,
        isRead: n.is_read,
        createdAt: n.created_at,
        referenceId: n.reference_id
      }));
    } catch (e) {
      this.logger.error(`Critical failure fetching notifications: ${e.message}`);
      return [];
    }
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    const { error } = await this.supabaseService.getClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  @Post('mark-all-read')
  async markAllRead(@Body() data: { recipientId: string }) {
    const { error } = await this.supabaseService.getClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', data.recipientId);
    
    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  @Post('register-fcm')
  async registerFCMToken(@Body() data: { userId: string; token: string }) {
    if (!data.userId || !data.token) {
      return { success: false, message: 'Missing userId or token' };
    }
    const success = await this.fcmService.registerToken(data.userId, data.token);
    return { success };
  }
}
