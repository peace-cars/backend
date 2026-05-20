import { Injectable, Logger, ForbiddenException, NotFoundException, Optional } from '@nestjs/common';
import { SupabaseScopedService } from '../supabase/supabase-scoped.service';
import { PermissionsService } from '../auth/permissions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Role } from '../auth/roles.enums';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly supabaseService: SupabaseScopedService,
    private readonly permissions: PermissionsService,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly realtime?: RealtimeGateway
  ) {}

  private isStaffRole(role: string): boolean {
    return [Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR].includes(role as Role);
  }

  async getConversations(userId: string, userRole: string) {
    try {
      const supabase = this.supabaseService.getClient();
      let query = supabase.from('conversations').select(`
        *,
        vehicles(make, model, year),
        profiles:customer_id(full_name),
        assigned_staff:assigned_staff_id(full_name)
      `);

      if (this.isStaffRole(userRole)) {
        if (userRole === Role.GENERAL_MANAGER || userRole === Role.FINANCE_AUDITOR) {
          // GM/Auditor sees all conversations
        } else if (userRole === Role.STAFF || userRole === Role.DISTRICT_MANAGER) {
          // Staff sees: unclaimed OR claimed by them
          query = query.or(`assigned_staff_id.is.null,assigned_staff_id.eq.${userId}`);
        }
      } else {
        // Customers see only their own conversations
        query = query.eq('customer_id', userId);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      this.logger.error(`Error fetching conversations for ${userId}`, err);
      return [];
    }
  }

  async getMessages(userId: string, userRole: Role, conversationId: string) {
    const hasAccess = await this.permissions.canAccessConversation(userId, userRole, conversationId);
    if (!hasAccess) {
      this.logger.warn(`Access Denied: ${userId} tried to read conversation ${conversationId}`);
      throw new ForbiddenException('You do not have permission to view this conversation.');
    }

    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles:sender_id(full_name, role)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      this.logger.error(`Error fetching messages for ${conversationId}`, err);
      return [];
    }
  }

  async sendMessage(senderId: string, userRole: Role, data: { conversationId?: string; text: string; vehicleId?: string }) {
    try {
      const supabase = this.supabaseService.getClient();
      let convId = data.conversationId;

      // Handle stringified nulls from client
      if (convId === 'null' || convId === 'undefined') {
        convId = undefined;
      }

      // Self-healing for client app (ChatPortal passes vehicleId).
      // If any user has a stale conversation ID, ignore it and auto-correct.
      if (convId && data.vehicleId) {
        const hasAccess = await this.permissions.canAccessConversation(senderId, userRole, convId);
        if (!hasAccess) {
          this.logger.warn(`Stale conversation ID ${convId} detected for user ${senderId}. Overriding.`);
          convId = undefined; 
        }
      }

      // 1. Find or Create Conversation (customer initiating or recovering from stale ID)
      if (!convId && data.vehicleId) {
        // Check for existing conversation for this customer+vehicle
        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .eq('customer_id', senderId)
          .eq('vehicle_id', data.vehicleId)
          .single();

        if (existing) {
          convId = existing.id;
        } else {
          const { data: newConv, error: convError } = await supabase
            .from('conversations')
            .insert([{ 
              customer_id: senderId, 
              vehicle_id: data.vehicleId,
              last_message: data.text,
              source: 'WEB',
              status: 'UNCLAIMED'
            }])
            .select()
            .single();
          
          if (convError) throw convError;
          convId = newConv.id;
        }
      }

      // 2. Ownership check for Staff/Admins, or if vehicleId wasn't provided
      if (convId) {
        const hasAccess = await this.permissions.canAccessConversation(senderId, userRole, convId);
        if (!hasAccess) {
          throw new ForbiddenException('You do not have permission to post to this conversation.');
        }
      }

      // 3. Get sender name for display
      let senderName = 'Unknown';
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', senderId)
          .single();
        senderName = profile?.full_name || 'Unknown';
      } catch {}

      // 4. Insert Message
      const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: convId,
          sender_id: senderId,
          sender_name: senderName,
          text: data.text,
          source: 'WEB'
        }])
        .select()
        .single();
      
      if (msgError) throw msgError;

      // 5. Staff first-responder claim logic
      if (this.isStaffRole(userRole) && convId) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('assigned_staff_id, status')
          .eq('id', convId)
          .single();

        if (conv && !conv.assigned_staff_id) {
          // First staff to respond claims the conversation
          await supabase
            .from('conversations')
            .update({ 
              assigned_staff_id: senderId,
              status: 'CLAIMED'
            })
            .eq('id', convId);
          
          this.logger.log(`Conversation ${convId} claimed by staff ${senderId}`);
        }
      }

      // 6. Update Conversation timestamp and last message
      await supabase
        .from('conversations')
        .update({ last_message: data.text, updated_at: new Date().toISOString() })
        .eq('id', convId);

      // 7. Emit real-time update for conversation participants
      if (convId) {
        try {
          this.realtime?.broadcastToRoom(`conv_${convId}`, 'message:new', {
            conversationId: convId,
            senderId,
            senderName,
            text: data.text,
            createdAt: new Date().toISOString(),
          });
        } catch (emitErr) {
          this.logger.debug('Realtime emit failed', emitErr?.message || emitErr);
        }
      }

      // 8. Check if this is a Telegram-sourced conversation → route reply through Telegram
      if (this.isStaffRole(userRole) && convId) {
        try {
          const { data: conv } = await supabase
            .from('conversations')
            .select('source, telegram_chat_id')
            .eq('id', convId)
            .single();

          if (conv?.source === 'TELEGRAM' && conv?.telegram_chat_id) {
            this.logger.log(`Staff reply to Telegram conversation ${convId} → chat ${conv.telegram_chat_id}`);
          }
        } catch {}
      }

      // 9. Trigger real-time notifications via FCM/Web
      if (convId) {
        await this.notificationsService.notifyNewMessage(
          convId,
          senderId,
          senderName,
          data.text
        );
      }

      return message;
    } catch (err) {
      this.logger.error('Failed to send message', err);
      throw err;
    }
  }

  /**
   * Staff claims an unclaimed conversation
   */
  async claimConversation(staffId: string, conversationId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: conv, error } = await supabase
      .from('conversations')
      .select('assigned_staff_id, status')
      .eq('id', conversationId)
      .single();

    if (error || !conv) throw new NotFoundException('Conversation not found.');

    if (conv.assigned_staff_id && conv.assigned_staff_id !== staffId) {
      throw new ForbiddenException('This conversation is already claimed by another staff member.');
    }

    const { error: updateError } = await supabase
      .from('conversations')
      .update({ assigned_staff_id: staffId, status: 'CLAIMED' })
      .eq('id', conversationId);

    if (updateError) throw updateError;

    this.logger.log(`Conversation ${conversationId} claimed by ${staffId}`);
    return { success: true, message: 'Conversation claimed.' };
  }

  /**
   * Resolve/close a conversation
   */
  async resolveConversation(userId: string, userRole: Role, conversationId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: conv } = await supabase
      .from('conversations')
      .select('assigned_staff_id')
      .eq('id', conversationId)
      .single();

    if (!conv) throw new NotFoundException('Conversation not found.');

    // Only assigned staff or GM can resolve
    if (conv.assigned_staff_id !== userId && userRole !== Role.GENERAL_MANAGER) {
      throw new ForbiddenException('Only the assigned staff or GM can resolve this conversation.');
    }

    await supabase
      .from('conversations')
      .update({ status: 'RESOLVED' })
      .eq('id', conversationId);

    return { success: true, message: 'Conversation resolved.' };
  }

  /**
   * Admin reassigns a conversation to a different staff member
   */
  async reassignConversation(newStaffId: string, conversationId: string) {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('conversations')
      .update({ assigned_staff_id: newStaffId, status: 'CLAIMED' })
      .eq('id', conversationId);

    if (error) throw error;

    this.logger.log(`Conversation ${conversationId} reassigned to ${newStaffId}`);
    return { success: true, message: 'Conversation reassigned.' };
  }
}
