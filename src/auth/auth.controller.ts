import { Controller, Post, Body, Get, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, CreateStaffDto } from './dto/auth.dto';
import { RolesGuard } from './roles.guard';
import { Role } from './roles.enums';
import { Roles } from './roles.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Login with email and password' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(body.email, body.password);
    
    // Set httpOnly cookie
    res.cookie('access_token', result.session.access_token, {
      httpOnly: true,
      secure: true, 
      sameSite: 'none', 
      maxAge: 7 * 24 * 60 * 60 * 1000, 
    });
    res.cookie('refresh_token', result.session.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000, 
    });

    return result;
  }

  @ApiOperation({ summary: 'Register a new USER or BROKER account' })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('register')
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(
      body.email,
      body.password,
      body.fullName,
      body.role || Role.USER,
      body.phoneNumber || null,
      body.branchId,
      body.avatarUrl,
    );

    // Set httpOnly cookie
    res.cookie('access_token', result.session?.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.cookie('refresh_token', result.session?.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return result;
  }

  /**
   * GM-only endpoint for provisioning Staff, DM, GM, and Auditor accounts.
   * Cannot be called by anonymous or low-privilege users.
   */
  @ApiOperation({ summary: 'Create a staff/manager account (GM only)' })
  @ApiBearerAuth('JWT-auth')
  @Post('create-staff')
  @UseGuards(RolesGuard)
  @Roles(Role.GENERAL_MANAGER)
  async createStaffAccount(@Body() body: CreateStaffDto) {
    return this.authService.createStaffAccount(
      body.email,
      body.password,
      body.fullName,
      body.role,
      body.branchId,
      body.phoneNumber,
      body.avatarUrl,
    );
  }

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiBearerAuth('JWT-auth')
  @Get('me')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getMe(@Req() req: any) {
    if (!req.user) {
      throw new UnauthorizedException('User session not found.');
    }
    return this.authService.getProfile(req.user.id);
  }

  @ApiOperation({ summary: 'Log out and clear session cookie' })
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { httpOnly: true, secure: true, sameSite: 'none' });
    res.clearCookie('refresh_token', { httpOnly: true, secure: true, sameSite: 'none' });
    return { success: true, message: 'Logged out successfully' };
  }

  @ApiOperation({ summary: 'Refresh session using httpOnly cookie' })
  @Post('refresh')
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token cookie found.');
    }

    const result = await this.authService.refresh(refreshToken);
    
    res.cookie('access_token', result.session.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.cookie('refresh_token', result.session.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return result;
  }
}
