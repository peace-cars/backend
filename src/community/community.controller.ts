import { Controller, Get, Post, Body, Param, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { CommunityService } from './community.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';

@Controller('community')
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
  ) {}

  @Get('posts')
  async getPosts() {
    return this.communityService.getPosts();
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
    @Body() data: { title: string; content: string; youtube_url?: string; post_type?: string; images?: string[] },
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
    );
  }

  @Post('posts/:id/upvote')
  async upvotePost(@Param('id') postId: string) {
    return this.communityService.upvotePost(postId);
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
}
