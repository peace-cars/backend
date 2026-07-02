import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { FCMService } from './fcm.service';
import { QueueService } from '../queues/queue.service';

export type NotificationType = 
  | 'NEW_MESSAGE' 
  | 'LEAD_ASSIGNED' 
  | 'STATUS_CHANGE' 
  | 'COMMISSION_READY' 
  | 'TRADE_IN_UPDATE'
  | 'FINANCE_UPDATE'
  | 'SYSTEM';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly fcmService: FCMService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Core: Create a notification in DB and dispatch push
   */
  async create(
    recipientId: string,
    title: string,
    body: string,
    type: NotificationType = 'SYSTEM',
    referenceId?: string,
    metadata?: Record<string, any>,
    actionUrl?: string,
  ) {
    try {
      const client = this.supabaseService.getClient();

      // 1. Insert notification into database
      const { data: notification, error } = await client
        .from('notifications')
        .insert([{
          recipient_id: recipientId,
          title,
          body,
          type,
          reference_id: referenceId || null,
          metadata: metadata || {},
          action_url: actionUrl || null,
          source: 'SYSTEM',
          is_read: false,
        }])
        .select()
        .single();

      if (error) {
        this.logger.error(`Failed to create notification: ${error.message}`);
        return null;
      }

      // 2. Dispatch FCM push notification (non-blocking) via background queue when available
      if (this.queueService) {
        await this.queueService.addJob('send-notification', {
          recipientId,
          title,
          body,
          meta: { type, referenceId, actionUrl }
        });
      } else {
        this.fcmService.sendPushNotification(recipientId, title, body, {
          type,
          referenceId: referenceId || '',
          actionUrl: actionUrl || '',
        }).catch(err => {
          this.logger.warn(`FCM push failed for ${recipientId}: ${err.message}`);
        });
      }

      return notification;
    } catch (err) {
      this.logger.error(`Notification creation failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Notify when a new message is received in a conversation
   */
  async notifyNewMessage(conversationId: string, senderId: string, senderName: string, messagePreview: string) {
    try {
      const client = this.supabaseService.getClient();

      // Get conversation to find the other party
      const { data: conv } = await client
        .from('conversations')
        .select('customer_id, assigned_staff_id, vehicle_id, vehicles(make, model)')
        .eq('id', conversationId)
        .single();

      if (!conv) return;

      const v = conv.vehicles as any;
      const vehicleName = v ? `${v.make} ${v.model}` : 'a vehicle';
      const preview = messagePreview.length > 60 ? messagePreview.substring(0, 60) + '...' : messagePreview;

      // Notify the other party (if sender is customer, notify staff; if staff, notify customer)
      if (conv.customer_id && conv.customer_id !== senderId) {
        await this.create(
          conv.customer_id,
          `New reply from ${senderName}`,
          `Re: ${vehicleName} — "${preview}"`,
          'NEW_MESSAGE',
          conversationId,
          { vehicleId: conv.vehicle_id, senderId },
          `/messages/${conversationId}`
        );
      }

      if (conv.assigned_staff_id && conv.assigned_staff_id !== senderId) {
        await this.create(
          conv.assigned_staff_id,
          `New message from ${senderName}`,
          `Re: ${vehicleName} — "${preview}"`,
          'NEW_MESSAGE',
          conversationId,
          { vehicleId: conv.vehicle_id, senderId },
          `/support/${conversationId}`
        );
      }

      // If no staff assigned yet, notify all staff at the branch (or globally if no branch scoping yet)
      if (!conv.assigned_staff_id && conv.customer_id === senderId) {
        await this.broadcastToRole('STAFF', 
          '📩 New customer inquiry',
          `${senderName} asked about ${vehicleName}: "${preview}"`,
          'NEW_MESSAGE',
          conversationId
        );
      }
    } catch (err) {
      this.logger.error(`notifyNewMessage failed: ${err.message}`);
    }
  }

  /**
   * Notify when a trade-in request status changes
   */
  async notifyStatusChange(
    entityType: string,
    entityId: string,
    newStatus: string,
    affectedUserIds: string[],
    entityLabel?: string,
  ) {
    const statusLabels: Record<string, string> = {
      'PENDING': '⏳ Pending Review',
      'UNDER_REVIEW': '🔍 Under Review',
      'APPROVED': '✅ Approved',
      'REJECTED': '❌ Rejected',
      'COMPLETED': '🎉 Completed',
      'SOURCING': '🔎 Sourcing',
      'SHOWROOM': '🏪 In Showroom',
      'SOLD': '💰 Sold',
    };

    const label = entityLabel || entityType;
    const statusText = statusLabels[newStatus] || newStatus;

    for (const userId of affectedUserIds) {
      await this.create(
        userId,
        `${label} Status Updated`,
        `Status changed to: ${statusText}`,
        'STATUS_CHANGE',
        entityId,
        { entityType, newStatus },
        entityType === 'TRADE_IN' ? `/trade-ins/${entityId}` : `/inventory/${entityId}`
      );
    }
  }

  /**
   * Notify when a commission is ready for payout
   */
  async notifyCommissionReady(staffId: string, amount: number, vehicleLabel: string) {
    await this.create(
      staffId,
      '💰 Commission Approved',
      `${(amount / 1000).toFixed(0)}K ETB commission for ${vehicleLabel} is ready for payout.`,
      'COMMISSION_READY',
      undefined,
      { amount },
      '/commissions'
    );
  }

  /**
   * Notify about finance plan updates
   */
  async notifyFinanceUpdate(userId: string, planId: string, status: string, vehicleLabel: string) {
    const messages: Record<string, string> = {
      'SUBMITTED': `Your financing application for ${vehicleLabel} has been submitted for review.`,
      'APPROVED': `Great news! Your financing for ${vehicleLabel} has been approved.`,
      'REJECTED': `Your financing application for ${vehicleLabel} was not approved. Contact us for alternatives.`,
      'ACTIVE': `Your financing for ${vehicleLabel} is now active.`,
    };

    await this.create(
      userId,
      `Finance Application: ${status}`,
      messages[status] || `Finance plan status updated to ${status}.`,
      'FINANCE_UPDATE',
      planId,
      { status },
      `/finance/${planId}`
    );
  }

  /**
   * Broadcast notification to all users of a specific role
   */
  async broadcastToRole(
    role: string,
    title: string,
    body: string,
    type: NotificationType = 'SYSTEM',
    referenceId?: string,
  ) {
    try {
      const client = this.supabaseService.getClient();
      let query = client
        .from('profiles')
        .select('id')
        .eq('role', role);

      if (role === 'STAFF') {
        query = query.not('branch_id', 'is', null);
      }

      const { data: users } = await query;

      if (!users || users.length === 0) return;

      for (const user of users) {
        await this.create(user.id, title, body, type, referenceId);
      }

      this.logger.log(`Broadcast to ${users.length} ${role} users: "${title}"`);
    } catch (err) {
      this.logger.error(`broadcastToRole failed: ${err.message}`);
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const client = this.supabaseService.getClient();
      const { count, error } = await client
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);

      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string) {
    const client = this.supabaseService.getClient();
    const { error } = await client
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('recipient_id', userId);

    if (error) throw error;
    return { success: true };
  }
}
