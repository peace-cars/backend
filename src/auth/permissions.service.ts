import { Injectable, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { Role } from './roles.enums';

@Injectable()
export class PermissionsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Verified if a user is a participant in a conversation or a high-level staff member.
   */
  async canAccessConversation(userId: string, userRole: Role, conversationId: string): Promise<boolean> {
    if (userRole === Role.GENERAL_MANAGER || userRole === Role.FINANCE_AUDITOR) {
      return true;
    }

    const client = this.supabaseService.getClient();

    // Fetch the target conversation
    const { data: conv } = await client
      .from('conversations')
      .select('customer_id, trade_in_id')
      .eq('id', conversationId)
      .single();

    if (!conv) return false;

    // Customer or explicit owner
    if (conv.customer_id === userId) return true;

    // For Staff/DM, check branch scoping
    if (userRole === Role.STAFF || userRole === Role.DISTRICT_MANAGER) {
       const { data: profile } = await client.from('profiles').select('location_id').eq('id', userId).single();
       if (!profile?.location_id) return false;

       // 1. Check Trade-In context
       if (conv.trade_in_id) {
         const { data: lead } = await client.from('trade_in_requests').select('branch_id').eq('id', conv.trade_in_id).single();
         if (lead?.branch_id === profile.location_id) return true;
       }

       // 2. Check Vehicle context
       const { data: convFull } = await client.from('conversations').select('vehicle_id').eq('id', conversationId).single();
       if (convFull?.vehicle_id) {
         const { data: vehicle } = await client.from('vehicles').select('branch_id').eq('id', convFull.vehicle_id).single();
         if (vehicle?.branch_id === profile.location_id || !vehicle?.branch_id) return true; // allow access to global leads (no branch)
       }
       
       // 3. Fallback: If it's a global lead (no trade_in, no vehicle)
       if (!conv.trade_in_id && !convFull?.vehicle_id) return true; 
    }

    return false;
  }

  /**
   * Verifies if a user can access a trade-in lead.
   */
  async canAccessTradeIn(userId: string, userRole: Role, leadId: string): Promise<boolean> {
    if (userRole === Role.GENERAL_MANAGER || userRole === Role.FINANCE_AUDITOR) return true;

    const client = this.supabaseService.getClient();

    const { data: lead } = await client
      .from('trade_in_requests')
      .select('customer_id, broker_id, branch_id, assigned_staff_id')
      .eq('id', leadId)
      .single();

    if (!lead) return false;

    // Ownership/Direct Participation check
    if (lead.customer_id === userId || lead.broker_id === userId || lead.assigned_staff_id === userId) {
       return true;
    }

    // Role-based branch scoping (Strict IDOR prevention)
    if (userRole === Role.DISTRICT_MANAGER || userRole === Role.STAFF) {
       const { data: profile } = await client.from('profiles').select('location_id').eq('id', userId).single();
       if (profile?.location_id && lead.branch_id === profile.location_id) {
           return true;
       }
    }

    return false;
  }
}
