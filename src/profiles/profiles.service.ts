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

    // Get garage
    const { data: garage } = await supabase
      .from('user_garages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Get recent posts
    const { data: posts } = await supabase
      .from('community_posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    return {
      ...profile,
      garage: garage || [],
      posts: posts || [],
    };
  }

  async updateProfile(userId: string, updates: { username?: string; bio?: string; avatar_url?: string }) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
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
