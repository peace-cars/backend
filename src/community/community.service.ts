import { Injectable, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
  ) {}

  async getPosts() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_posts')
      .select('id, title, content, upvotes, created_at, images, youtube_url, post_type, user_id, profiles(full_name, avatar_url, username), community_comments(count)')
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
      .select('id, title, content, upvotes, created_at, images, youtube_url, post_type, user_id, profiles(full_name, avatar_url, username), community_comments(count)')
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

    // Fire-and-forget: broadcast to Telegram subscribers
    this.broadcastPostToTelegram(data, userId).catch(err =>
      this.logger.warn(`Telegram broadcast failed (non-blocking): ${err.message}`)
    );

    return data;
  }

  private async broadcastPostToTelegram(post: any, userId: string) {
    // Resolve the author's display name
    const { data: profile } = await this.supabaseService.getClient()
      .from('profiles')
      .select('full_name, username')
      .eq('id', userId)
      .single();

    const authorName = profile?.full_name || profile?.username || 'Community Member';

    await this.telegramService.broadcastNewCommunityPost({
      id: post.id,
      title: post.title,
      content: post.content,
      post_type: post.post_type,
      images: post.images,
    }, authorName);
  }

  async upvotePost(postId: string) {
    const supabase = this.supabaseService.getClient();

    // Atomic Increment via Database RPC to prevent Race Conditions
    const { error } = await supabase.rpc('increment_community_upvotes', { post_id: postId });

    if (error) {
      this.logger.error(`Failed to upvote post ${postId}: ${error.message}`);
      throw new BadRequestException('Failed to upvote post. ' + error.message);
    }

    // Return current count for client to reflect
    const { data } = await supabase.from('community_posts').select('upvotes').eq('id', postId).single();
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

    // Atomic RSVP via Database RPC to prevent Race Conditions
    const { error } = await supabase.rpc('increment_event_rsvp', { event_id: eventId });

    if (error) {
      this.logger.error(`Failed to RSVP event ${eventId}: ${error.message}`);
      throw new BadRequestException('Failed to RSVP event. ' + error.message);
    }

    // Return current count for client to reflect
    const { data } = await supabase.from('community_events').select('rsvp_count').eq('id', eventId).single();
    return data;
  }
}
