import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { SupabaseScopedService } from '../supabase/supabase-scoped.service';
import { PermissionsService } from '../auth/permissions.service';
import { Role } from '../auth/roles.enums';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly supabaseService: SupabaseScopedService,
    private readonly permissions: PermissionsService
  ) {}

  async getConversations(userId: string, isStaff = false) {
    try {
      const supabase = this.supabaseService.getClient();
      let query = supabase.from('conversations').select(`
        *,
        vehicles(make, model, year),
        profiles:customer_id(full_name)
      `);

      if (isStaff) {
        // Staff/DM sees all conversations linked to their branch vehicles or trade-ins
        const { data: profile } = await supabase.from('profiles').select('location_id, role').eq('id', userId).single();
        
        if (profile?.role === Role.GENERAL_MANAGER || profile?.role === Role.FINANCE_AUDITOR) {
          // GM sees everything
        } else if (profile?.location_id) {
          // Filter by branch logic is complex in a single query with joins, 
          // so for now we show all active leads but they are protected by the canAccess check when opened.
          // In a production app, we would join trade_in_requests or vehicles to filter here.
        }
      } else {
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
    // 1. Ownership check
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

      // 1. Create Conversation if it doesn't exist
      if (!convId && data.vehicleId) {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert([{ 
            customer_id: senderId, 
            vehicle_id: data.vehicleId,
            last_message: data.text 
          }])
          .select()
          .single();
        
        if (convError) throw convError;
        convId = newConv.id;
      }

      // 2. Ownership check for existing conversations
      if (data.conversationId) {
        const hasAccess = await this.permissions.canAccessConversation(senderId, userRole, data.conversationId);
        if (!hasAccess) {
          throw new ForbiddenException('You do not have permission to post to this conversation.');
        }
      }

      // 3. Insert Message
      const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert([{
          conversation_id: convId,
          sender_id: senderId,
          text: data.text
        }])
        .select()
        .single();
      
      if (msgError) throw msgError;

      // 4. Update Conversation timestamp
      await supabase
        .from('conversations')
        .update({ last_message: data.text, updated_at: new Date().toISOString() })
        .eq('id', convId);

      return message;
    } catch (err) {
      this.logger.error('Failed to send message', err);
      // Temporarily log to file for debugging
      const fs = require('fs');
      try {
        fs.appendFileSync('c:\\peaceCars\\backend\\chat-error.log', new Date().toISOString() + '\n' + JSON.stringify(err, Object.getOwnPropertyNames(err), 2) + '\n\n');
      } catch (e) {}
      throw err;
    }
  }
}
