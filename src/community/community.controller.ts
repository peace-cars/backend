import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, BadRequestException, Query, UseInterceptors } from '@nestjs/common';
import { CommunityService } from './community.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';
import { UpstashCacheInterceptor, CacheTTL } from '../redis/upstash-cache.interceptor';

@Controller('community')
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
  ) {}

  @Get('posts')
  @UseInterceptors(UpstashCacheInterceptor)
  @CacheTTL(30)
  async getPosts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.communityService.getPosts(pageNum, limitNum);
  }

  @Get('posts/:id')
  async getPostById(@Param('id') postId: string) {
    return this.communityService.getPostById(postId);
  }

  @Get('posts/:id/comments')
  async getComments(@Param('id') postId: string) {
    return this.communityService.getComments(postId);
  }

  @Post('posts/:id/comments')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async createComment(
    @Req() req: any,
    @Param('id') postId: string,
    @Body() data: { content: string },
  ) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.communityService.createComment(req.user.id, postId, data.content);
  }

  @Post('posts')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async createPost(
    @Req() req: any,
    @Body() data: { title: string; content: string; youtube_url?: string; post_type?: string; images?: string[]; tags?: string[] },
  ) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('User not authenticated');
    }

    const imageUrls = Array.isArray(data.images) ? data.images : [];

    return this.communityService.createPost(
      req.user.id,
      data.title,
      data.content,
      imageUrls,
      data.youtube_url,
      data.post_type || 'discussion',
      data.tags || [],
    );
  }

  @Patch('posts/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async editPost(
    @Req() req: any,
    @Param('id') postId: string,
    @Body() data: { title?: string; content?: string; images?: string[]; tags?: string[] },
  ) {
    if (!req.user || !req.user.id) throw new BadRequestException('User not authenticated');
    return this.communityService.editPost(req.user.id, postId, data);
  }

  @Delete('posts/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async deletePost(
    @Req() req: any,
    @Param('id') postId: string,
  ) {
    if (!req.user || !req.user.id) throw new BadRequestException('User not authenticated');
    return this.communityService.deletePost(req.user.id, postId, req.user.role);
  }

  @Patch('comments/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async editComment(
    @Req() req: any,
    @Param('id') commentId: string,
    @Body() data: { content: string },
  ) {
    if (!req.user || !req.user.id) throw new BadRequestException('User not authenticated');
    return this.communityService.editComment(req.user.id, commentId, data.content);
  }

  @Delete('comments/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async deleteComment(
    @Req() req: any,
    @Param('id') commentId: string,
  ) {
    if (!req.user || !req.user.id) throw new BadRequestException('User not authenticated');
    return this.communityService.deleteComment(req.user.id, commentId);
  }

  @Post('posts/:id/upvote')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async upvotePost(@Req() req: any, @Param('id') postId: string) {
    if (!req.user || !req.user.id) throw new BadRequestException('User not authenticated');
    return this.communityService.upvotePost(req.user.id, postId);
  }

  // ── Followers ──────────────────────────────────────────────────

  @Post('users/:id/follow')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async followUser(@Req() req: any, @Param('id') followingId: string) {
    if (!req.user || !req.user.id) throw new BadRequestException('User not authenticated');
    return this.communityService.followUser(req.user.id, followingId);
  }

  @Delete('users/:id/follow')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async unfollowUser(@Req() req: any, @Param('id') followingId: string) {
    if (!req.user || !req.user.id) throw new BadRequestException('User not authenticated');
    return this.communityService.unfollowUser(req.user.id, followingId);
  }

  @Get('users/:id/follow-status')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getFollowStatus(@Req() req: any, @Param('id') followingId: string) {
    if (!req.user || !req.user.id) return { isFollowing: false };
    return this.communityService.getFollowStatus(req.user.id, followingId);
  }

  @Get('users/:id/follow-stats')
  async getFollowStats(@Param('id') userId: string) {
    return this.communityService.getFollowStats(userId);
  }

  // ── Notifications ──────────────────────────────────────────────

  @Get('notifications')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getCommunityNotifications(@Req() req: any) {
    if (!req.user || !req.user.id) throw new BadRequestException('User not authenticated');
    return this.communityService.getCommunityNotifications(req.user.id);
  }

  @Patch('notifications/:id/read')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async markNotificationRead(@Req() req: any, @Param('id') notificationId: string) {
    if (!req.user || !req.user.id) throw new BadRequestException('User not authenticated');
    return this.communityService.markNotificationRead(req.user.id, notificationId);
  }

  @Patch('notifications/read-all')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async markAllNotificationsRead(@Req() req: any) {
    if (!req.user || !req.user.id) throw new BadRequestException('User not authenticated');
    return this.communityService.markAllNotificationsRead(req.user.id);
  }

  // ── Events ─────────────────────────────────────────────────────

  @Get('events')
  async getEvents() {
    return this.communityService.getEvents();
  }

  @Post('events')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async createEvent(
    @Req() req: any,
    @Body() data: {
      title: string;
      description: string;
      event_date: string;
      location?: string;
      cover_image?: string;
      event_type?: string;
    },
  ) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.communityService.createEvent(req.user.id, data);
  }

  @Post('events/:id/rsvp')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async rsvpEvent(@Req() req: any, @Param('id') eventId: string) {
    if (!req.user || !req.user.id) {
      throw new BadRequestException('User not authenticated');
    }
    return this.communityService.rsvpEvent(req.user.id, eventId);
  }

  @Get('events/:id/rsvps')
  async getEventRsvps(@Param('id') eventId: string) {
    return this.communityService.getEventRsvps(eventId);
  }

  @Delete('events/:id/rsvp')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async cancelRsvp(@Req() req: any, @Param('id') eventId: string) {
    if (!req.user || !req.user.id) throw new BadRequestException('User not authenticated');
    return this.communityService.cancelRsvp(req.user.id, eventId);
  }
}
