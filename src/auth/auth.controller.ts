import { Controller, Post, Body, Get, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { RolesGuard } from './roles.guard';
import { Role } from './roles.enums';
import { Roles } from './roles.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(
      body.email,
      body.password,
      body.fullName,
      body.role || Role.USER,
      body.phoneNumber || null,
      body.locationId,
      body.avatarUrl,
    );
  }

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getMe(@Req() req: any) {
    if (!req.user) {
      throw new UnauthorizedException('User session not found.');
    }
    return this.authService.getProfile(req.user.id);
  }
}
