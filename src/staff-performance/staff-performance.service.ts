import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class StaffPerformanceService {
  private readonly logger = new Logger(StaffPerformanceService.name);

  constructor(private readonly supabaseService: SupabaseService) {}
  
  async getLeaderboard(branchId?: string) {
    try {
      const supabase = this.supabaseService.getClient();
      let query = supabase
        .from('staff_leaderboard_stats')
        .select('*')
        .order('gamification_points', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
        
      if (error) {
        this.logger.error(`Error fetching leaderboard: ${error.message}`);
        return [];
      }
      
      return (data || []).map((st: any, idx: number) => ({
        id: st.staff_id,
        rank: idx + 1,
        fullName: st.full_name,
        role: st.is_inspector_verified ? "Certified Inspector" : "Triage Specialist",
        locationId: st.branch_id,
        score: st.gamification_points,
        totalSales: st.total_deals_closed,
        averageRating: st.average_rating,
        reviews: [],
        isSellerOfMonth: idx === 0
      }));
    } catch (e) {
      this.logger.error(`Failed to fetch leaderboard: ${e.message}`);
      return [];
    }
  }

  async toggleClock(staffId: string) {
    try {
      const supabase = this.supabaseService.getClient();
      const { data: activeShift } = await supabase
        .from('staff_shifts')
        .select('id, clocked_in_at')
        .eq('staff_id', staffId)
        .eq('is_active', true)
        .single();

      if (activeShift) {
         await supabase.from('staff_shifts').update({ is_active: false, clocked_out_at: new Date() }).eq('id', activeShift.id);
         return { success: true, message: "Clocked out", isOnline: false };
      } else {
         const { data: profile } = await supabase.from('profiles').select('branch_id').eq('id', staffId).single();
         await supabase.from('staff_shifts').insert({ staff_id: staffId, branch_id: profile?.branch_id, is_active: true });
         return { success: true, message: "Clocked in", isOnline: true, shiftStartedAt: new Date().toISOString() };
      }
    } catch (e) {
      this.logger.error(`Clock operation failed: ${e.message}`);
      return { success: false, message: "Offline sync failed" };
    }
  }

  async getStaffProfile(staffId: string) {
    try {
      const supabase = this.supabaseService.getClient();
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          id, full_name, role, branch_id, avatar_url, commission_tier, 
          is_verified, is_inspector_verified, gamification_points
        `)
        .eq('id', staffId)
        .single();
        
      if (error) {
        this.logger.error(`Error fetching staff profile: ${error.message}`);
        return null;
      }

      const { data: achievements } = await supabase
        .from('staff_unlocked_achievements')
        .select(`
          unlocked_at,
          staff_achievements_catalog(name, description, icon_name, point_value)
        `)
        .eq('staff_id', staffId);

      const { data: shift } = await supabase
        .from('staff_shifts')
        .select('id')
        .eq('staff_id', staffId)
        .eq('is_active', true)
        .single();

      return {
        ...profile,
        isClockedIn: !!shift,
        achievements: achievements?.map((a: any) => ({
          unlockedAt: a.unlocked_at,
          ...(a.staff_achievements_catalog as any)
        })) || []
      };
    } catch (e) {
      this.logger.error(`Failed to fetch staff profile: ${e.message}`);
      return null;
    }
  }

  async getRoster(locationId?: string) {
    try {
      const supabase = this.supabaseService.getClient();
      let query = supabase
        .from('profiles')
        .select(`
          id, full_name, role, branch_id, is_verified, is_inspector_verified, 
          gamification_points, total_completed_tasks, performance_rating,
          locations(name)
        `)
        .eq('is_verified', true)
        .order('full_name');

      if (locationId) {
        query = query.eq('branch_id', locationId);
      }

      const { data: profiles, error } = await query;
        
      if (error) {
        this.logger.error(`Error fetching roster: ${error.message}`);
        return [];
      }

      // Enhance with real-time stats (tasks and budgets)
      const enhancedRoster = await Promise.all((profiles || []).map(async (p: any) => {
        const { count: activeTasks } = await supabase
          .from('staff_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', p.id)
          .in('status', ['ASSIGNED', 'IN_PROGRESS', 'PENDING_REVIEW']);

        const { count: pendingBudgets } = await supabase
          .from('staff_budgets')
          .select('*', { count: 'exact', head: true })
          .eq('requester_id', p.id)
          .eq('status', 'REQUESTED');

        const { data: shift } = await supabase
          .from('staff_shifts')
          .select('id, clocked_in_at')
          .eq('staff_id', p.id)
          .eq('is_active', true)
          .single();

        return {
          ...p,
          locationName: p.locations?.name,
          activeTasks: activeTasks || 0,
          pendingBudgets: pendingBudgets || 0,
          isOnline: !!shift,
          shiftStartedAt: shift?.clocked_in_at
        };
      }));

      return enhancedRoster;
    } catch (err) {
      this.logger.error(`Failed fetching roster: ${err.message}`);
      return [];
    }
  }
}
