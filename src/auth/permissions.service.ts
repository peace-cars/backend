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
    const { data: conv, error } = await client
      .from('conversations')
      .select('customer_id')
      .eq('id', conversationId)
      .single();

    if (error || !conv) {
      console.error(`[PermissionsService] Conversation ${conversationId} not found or error:`, error);
      return false;
    }

    // Customer or explicit owner
    if (conv.customer_id === userId) {
      return true;
    } else {
      console.warn(`[PermissionsService] Ownership mismatch. conv.customer_id=${conv.customer_id}, userId=${userId}`);
    }

    // For Staff/DM, check branch scoping
    if (userRole === Role.STAFF || userRole === Role.DISTRICT_MANAGER) {
       const { data: profile } = await client.from('profiles').select('branch_id').eq('id', userId).single();
       if (!profile?.branch_id) return false;

       // 1. Check Vehicle context
       const { data: convFull } = await client.from('conversations').select('vehicle_id').eq('id', conversationId).single();
       if (convFull?.vehicle_id) {
         const { data: vehicle } = await client.from('vehicles').select('branch_id').eq('id', convFull.vehicle_id).single();
         if (vehicle?.branch_id === profile.branch_id || !vehicle?.branch_id) return true; // allow access to global leads (no branch)
       }
       
       // 2. Fallback: If it's a global lead (no vehicle)
       if (!convFull?.vehicle_id) return true; 
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

    const { data: profile } = await client.from('profiles').select('branch_id, district_id').eq('id', userId).single();
    const userBranchId = profile?.branch_id;
    const userDistrictId = profile?.district_id;

    if (userRole === Role.STAFF && userBranchId && lead.branch_id === userBranchId) {
      return true;
    }

    if (userRole === Role.DISTRICT_MANAGER && userDistrictId && lead.branch_id) {
      const { data: branch } = await client.from('branches').select('district_id').eq('id', lead.branch_id).single();
      if (branch?.district_id === userDistrictId) {
        return true;
      }
    }

    return false;
  }
}
