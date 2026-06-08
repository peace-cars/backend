import { Injectable, BadRequestException, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { SupabaseService } from '../supabase/supabase.service';
import { TelegramService } from '../telegram/telegram.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(forwardRef(() => TelegramService))
    private readonly telegramService: TelegramService,
    private redisService: RedisService,
    @Optional() private readonly realtime?: RealtimeGateway,
  ) {}

  private readonly COMMUNITY_CACHE_KEY = 'community:posts:v2'; // v2: explicit FK hints for community_post_upvotes ambiguity

  async getPosts(page?: number, limit?: number) {
    let cachedPosts = await this.redisService.get<any[]>(this.COMMUNITY_CACHE_KEY);

    if (!cachedPosts) {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('community_posts')
        .select('id, title, content, upvotes, created_at, updated_at, is_edited, images, youtube_url, post_type, tags, user_id, profiles!community_posts_user_id_fkey(full_name, avatar_url, username), community_comments(count)')
        .order('created_at', { ascending: false });

      if (error) {
        throw new BadRequestException(error.message);
      }
      cachedPosts = data || [];
      await this.redisService.set(this.COMMUNITY_CACHE_KEY, cachedPosts);
    }

    if (page !== undefined && limit !== undefined) {
      const startIndex = (page - 1) * limit;
      const paginatedData = cachedPosts.slice(startIndex, startIndex + limit);
      return {
        data: paginatedData,
        total: cachedPosts.length,
        page,
        limit
      };
    }

    return cachedPosts;
  }

  async getPostById(postId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_posts')
      .select('id, title, content, upvotes, created_at, updated_at, is_edited, images, youtube_url, post_type, tags, user_id, profiles!community_posts_user_id_fkey(full_name, avatar_url, username), community_comments(count)')
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
      .select('id, post_id, user_id, content, created_at, updated_at, is_edited, profiles!community_comments_user_id_fkey(full_name, avatar_url, username)')
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
      .select('id, post_id, user_id, content, created_at, updated_at, is_edited, profiles!community_comments_user_id_fkey(full_name, avatar_url, username)')
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    // Get post owner to notify them
    const { data: postData } = await supabase.from('community_posts').select('user_id').eq('id', postId).single();
    if (postData?.user_id) {
      await this.createCommunityNotification(postData.user_id, userId, 'comment', postId, data.id);
    }

    return data;
  }

  async editComment(userId: string, commentId: string, content: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_comments')
      .update({ content })
      .match({ id: commentId, user_id: userId }) // Ensure only author can edit
      .select('id, post_id, user_id, content, created_at, updated_at, is_edited, profiles!community_comments_user_id_fkey(full_name, avatar_url, username)')
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }
    return data;
  }

  async deleteComment(userId: string, commentId: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('community_comments')
      .delete()
      .match({ id: commentId, user_id: userId }); // Ensure only author can delete

    if (error) {
      throw new BadRequestException(error.message);
    }
    return { success: true };
  }

  async createPost(
    userId: string,
    title: string,
    content: string,
    images: string[] = [],
    youtubeUrl?: string,
    postType: string = 'discussion',
    tags: string[] = []
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
        tags,
      })
      .select('id, title, content, upvotes, created_at, updated_at, is_edited, images, youtube_url, post_type, tags, user_id, profiles!community_posts_user_id_fkey(full_name, avatar_url, username)')
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    // Fire-and-forget: broadcast to Telegram subscribers
    this.broadcastPostToTelegram(data, userId).catch(err =>
      this.logger.warn(`Telegram broadcast failed (non-blocking): ${err.message}`)
    );

    // Invalidate cache
    await this.redisService.del(this.COMMUNITY_CACHE_KEY);

    // Pub/Sub: Broadcast new post to all community subscribers
    if (this.realtime) {
      this.realtime.broadcastToRoom('community', 'new_post', data);
      this.logger.log(`[Pub/Sub] Broadcasted new_post to community room`);
    }

    return data;
  }

  async editPost(
    userId: string,
    postId: string,
    updates: { title?: string; content?: string; images?: string[]; tags?: string[] }
  ) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_posts')
      .update(updates)
      .match({ id: postId, user_id: userId }) // Ensure only author can edit
      .select('id, title, content, upvotes, created_at, updated_at, is_edited, images, youtube_url, post_type, tags, user_id, profiles!community_posts_user_id_fkey(full_name, avatar_url, username)')
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }
    return data;
  }

  async deletePost(userId: string, postId: string, userRole?: string) {
    const supabase = this.supabaseService.getClient();

    let query = supabase.from('community_posts').delete().eq('id', postId);
    
    // If not admin, restrict deletion to author only
    if (userRole !== 'ADMIN') {
      query = query.eq('user_id', userId);
    }

    const { error, data } = await query.select();

    if (error) {
      throw new BadRequestException(error.message);
    }
    
    if (!data || data.length === 0) {
      throw new BadRequestException('Post not found or unauthorized');
    }

    // Invalidate cache
    await this.redisService.del(this.COMMUNITY_CACHE_KEY);
    return { success: true };
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

  async upvotePost(userId: string, postId: string) {
    const supabase = this.supabaseService.getClient();

    // Atomic toggle: one vote per user, handled at DB level to prevent race conditions
    const { data, error } = await supabase.rpc('toggle_community_upvote', {
      p_post_id: postId,
      p_user_id: userId,
    });

    if (error) {
      this.logger.error(`Failed to toggle upvote on post ${postId}: ${error.message}`);
      throw new BadRequestException('Failed to upvote post. ' + error.message);
    }

    const result = data as { voted: boolean; upvotes: number };

    // Invalidate cache
    await this.redisService.del(this.COMMUNITY_CACHE_KEY);

    // Only notify on first vote (not on toggle-off)
    if (result.voted) {
      const { data: postData } = await supabase
        .from('community_posts')
        .select('user_id')
        .eq('id', postId)
        .single();
      if (postData?.user_id) {
        await this.createCommunityNotification(postData.user_id, userId, 'upvote', postId);
      }
    }

    // Pub/Sub: Broadcast the new upvote count to all community subscribers
    if (this.realtime) {
      this.realtime.broadcastToRoom('community', 'post_upvoted', { postId, newCount: result.upvotes, voted: result.voted });
    }

    return result;
  }

  async hasUpvoted(userId: string, postId: string): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('community_post_upvotes')
      .select('post_id')
      .match({ post_id: postId, user_id: userId })
      .maybeSingle();
    return !!data;
  }

  // ── Events ─────────────────────────────────────────────────────

  async getEvents() {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_events')
      .select('*, profiles(full_name, avatar_url, username)')
      .order('event_date', { ascending: true });

    if (error) {
      this.logger.warn('Events table query failed:', error.message);
      return [];
    }
    return data;
  }

  // ── Followers ─────────────────────────────────────────────────────

  async followUser(followerId: string, followingId: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('community_follows')
      .upsert({ follower_id: followerId, following_id: followingId }, { onConflict: 'follower_id,following_id' });

    if (error) throw new BadRequestException('Failed to follow user. ' + error.message);

    // Create notification
    await this.createCommunityNotification(followingId, followerId, 'follow');

    return { success: true };
  }

  async unfollowUser(followerId: string, followingId: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('community_follows')
      .delete()
      .match({ follower_id: followerId, following_id: followingId });

    if (error) throw new BadRequestException('Failed to unfollow user. ' + error.message);
    return { success: true };
  }

  async getFollowStatus(followerId: string, followingId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_follows')
      .select('created_at')
      .match({ follower_id: followerId, following_id: followingId })
      .maybeSingle();

    if (error) return { isFollowing: false };
    return { isFollowing: !!data };
  }

  async getFollowStats(userId: string) {
    const supabase = this.supabaseService.getClient();
    
    const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
      supabase.from('community_follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('community_follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId)
    ]);

    return { 
      followers: followersCount || 0, 
      following: followingCount || 0 
    };
  }

  // ── Notifications ─────────────────────────────────────────────────────

  async createCommunityNotification(userId: string, actorId: string, type: 'upvote' | 'comment' | 'follow', postId?: string, commentId?: string) {
    if (userId === actorId) return; // Don't notify yourself

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_notifications')
      .insert({
        user_id: userId,
        actor_id: actorId,
        type,
        post_id: postId || null,
        comment_id: commentId || null
      })
      .select('id, type, is_read, created_at, post_id, comment_id, actor:actor_id(id, full_name, avatar_url, username), post:post_id(title)')
      .single();

    if (error) {
      this.logger.warn(`Failed to create community notification: ${error.message}`);
      return;
    }

    // Pub/Sub: Push notification directly to the target user's room
    if (this.realtime && data) {
      this.realtime.broadcastToRoom(`user_${userId}`, 'new_notification', data);
      this.logger.log(`[Pub/Sub] Pushed new_notification to user_${userId}`);
    }
  }

  async getCommunityNotifications(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_notifications')
      .select('id, type, is_read, created_at, post_id, comment_id, actor:actor_id(id, full_name, avatar_url, username), post:post_id(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      this.logger.warn(`Failed to fetch notifications: ${error.message}`);
      return [];
    }
    return data;
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('community_notifications')
      .update({ is_read: true })
      .match({ id: notificationId, user_id: userId });

    if (error) throw new BadRequestException('Failed to mark read. ' + error.message);
    return { success: true };
  }

  async markAllNotificationsRead(userId: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('community_notifications')
      .update({ is_read: true })
      .match({ user_id: userId, is_read: false });

    if (error) throw new BadRequestException('Failed to mark all read. ' + error.message);
    return { success: true };
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

    // Atomic RSVP: Only increments counter if user hasn't RSVP'd before.
    // The safe_rsvp_event RPC handles the INSERT + conditional counter increment atomically.
    const { data, error } = await supabase.rpc('safe_rsvp_event', {
      p_event_id: eventId,
      p_user_id: userId,
    });

    if (error) {
      this.logger.error(`Failed to RSVP event ${eventId}: ${error.message}`);
      throw new BadRequestException('Failed to RSVP event. ' + error.message);
    }

    const result = data as { rsvped: boolean; rsvp_count: number };

    if (!result.rsvped) {
      throw new BadRequestException('You have already RSVP\'d to this event.');
    }

    return { rsvp_count: result.rsvp_count, rsvped: true };
  }

  async hasRsvped(userId: string, eventId: string): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('community_event_rsvps')
      .select('event_id')
      .match({ event_id: eventId, user_id: userId })
      .maybeSingle();
    return !!data;
  }

  async getEventRsvps(eventId: string) {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('community_event_rsvps')
      .select('user_id, created_at, profiles:user_id(full_name, avatar_url, username)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.warn(`Failed to fetch RSVPs for event ${eventId}: ${error.message}`);
      return [];
    }
    return data;
  }

  async cancelRsvp(userId: string, eventId: string) {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('community_event_rsvps')
      .delete()
      .match({ event_id: eventId, user_id: userId });

    if (error) {
      throw new BadRequestException('Failed to cancel RSVP. ' + error.message);
    }

    // Decrement the counter
    await supabase.rpc('decrement_event_rsvp', { event_id: eventId });

    const { data } = await supabase.from('community_events').select('rsvp_count').eq('id', eventId).single();
    return data;
  }
}
