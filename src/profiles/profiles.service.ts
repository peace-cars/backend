import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ProfilesService {
  constructor(private supabaseService: SupabaseService) {}

  async getProfile(userId: string) {
    const supabase = this.supabaseService.getClient();
    
    // Get profile
    const { data: profile, error: pError } = await supabase
      .from('profiles')
      .select('id, full_name, username, bio, avatar_url, created_at')
      .eq('id', userId)
      .single();

    if (pError || !profile) {
      throw new NotFoundException('Profile not found');
    }

    // Fetch garage and posts concurrently to improve performance
    const [garageResult, postsResult] = await Promise.all([
      supabase
        .from('user_garages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('community_posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

    return {
      ...profile,
      garage: garageResult.data || [],
      posts: postsResult.data || [],
    };
  }

  async updateProfile(userId: string, updates: { username?: string; bio?: string; avatar_url?: string }) {
    // Strict whitelist — prevent injection of role, id, or other protected fields
    const ALLOWED_FIELDS = ['username', 'bio', 'avatar_url', 'full_name'];
    const sanitized: Record<string, any> = {};
    for (const key of ALLOWED_FIELDS) {
      if ((updates as any)[key] !== undefined) {
        sanitized[key] = (updates as any)[key];
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return { message: 'No valid fields to update' };
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('profiles')
      .update(sanitized)
      .eq('id', userId)
      .select('id, full_name, username, bio, avatar_url, created_at')
      .single();

    if (error) throw error;
    return data;
  }

  // Garage methods
  async addToGarage(userId: string, carData: any) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('user_garages')
      .insert({
        user_id: userId,
        make: carData.make,
        model: carData.model,
        year: parseInt(carData.year),
        description: carData.description,
        images: carData.images || [],
        is_public: carData.is_public ?? true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeFromGarage(userId: string, carId: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('user_garages')
      .delete()
      .eq('id', carId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  }
}
