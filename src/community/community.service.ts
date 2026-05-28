import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class CommunityService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getPosts() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_posts')
      .select('id, title, content, upvotes, created_at, images, youtube_url, post_type, user_id, profiles(full_name, avatar_url, username)')
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(error.message);
    }
    return data;
  }

  async getPostById(postId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_posts')
      .select('id, title, content, upvotes, created_at, images, youtube_url, post_type, user_id, profiles(full_name, avatar_url, username)')
      .eq('id', postId)
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }
    return data;
  }

  async getComments(postId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_comments')
      .select('id, post_id, user_id, content, created_at, profiles(full_name, avatar_url, username)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      // Table might not exist yet — return empty
      console.warn('Comments table query failed:', error.message);
      return [];
    }
    return data;
  }

  async createComment(userId: string, postId: string, content: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_comments')
      .insert({
        user_id: userId,
        post_id: postId,
        content,
      })
      .select('id, post_id, user_id, content, created_at, profiles(full_name, avatar_url, username)')
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }
    return data;
  }

  async createPost(
    userId: string,
    title: string,
    content: string,
    images: string[] = [],
    youtubeUrl?: string,
    postType: string = 'discussion',
  ) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        user_id: userId,
        title,
        content,
        images,
        youtube_url: youtubeUrl || null,
        post_type: postType,
      })
      .select('id, title, content, upvotes, created_at, images, youtube_url, post_type, user_id, profiles(full_name, avatar_url, username)')
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }
    return data;
  }

  async upvotePost(postId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: post, error: fetchError } = await supabase
      .from('community_posts')
      .select('upvotes')
      .eq('id', postId)
      .single();

    if (fetchError || !post) {
      throw new BadRequestException('Post not found');
    }

    const { data, error } = await supabase
      .from('community_posts')
      .update({ upvotes: (post.upvotes || 0) + 1 })
      .eq('id', postId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }
    return data;
  }

  // ── Events ─────────────────────────────────────────────────────

  async getEvents() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_events')
      .select('*, profiles(full_name, avatar_url, username)')
      .order('event_date', { ascending: true });

    if (error) {
      // Table might not exist yet — return empty
      console.warn('Events table query failed:', error.message);
      return [];
    }
    return data;
  }

  async createEvent(
    userId: string,
    eventData: {
      title: string;
      description: string;
      event_date: string;
      location?: string;
      cover_image?: string;
      event_type?: string;
    },
  ) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_events')
      .insert({
        user_id: userId,
        title: eventData.title,
        description: eventData.description,
        event_date: eventData.event_date,
        location: eventData.location || null,
        cover_image: eventData.cover_image || null,
        event_type: eventData.event_type || 'meetup',
        rsvp_count: 0,
      })
      .select('*, profiles(full_name, avatar_url, username)')
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }
    return data;
  }

  async rsvpEvent(userId: string, eventId: string) {
    const supabase = this.supabaseService.getClient();

    // Simple RSVP: increment count
    const { data: event, error: fetchError } = await supabase
      .from('community_events')
      .select('rsvp_count')
      .eq('id', eventId)
      .single();

    if (fetchError || !event) {
      throw new BadRequestException('Event not found');
    }

    const { data, error } = await supabase
      .from('community_events')
      .update({ rsvp_count: (event.rsvp_count || 0) + 1 })
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }
    return data;
  }
}
