import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { MiniappService } from './miniapp.service';
import { AuthService } from '../auth/auth.service';

@Controller('miniapp')
export class MiniappController {
  constructor(
    private readonly miniappService: MiniappService,
    private readonly authService: AuthService,
  ) {}

  @Post('auth')
  async authenticate(@Body('initDataRaw') initDataRaw: string) {
    if (!initDataRaw) {
      throw new UnauthorizedException('initDataRaw is required');
    }

    const tgUser = this.miniappService.validateInitData(initDataRaw);
    if (!tgUser) {
      throw new UnauthorizedException('Invalid Telegram initData signature');
    }

    // Upsert user and profile based on telegram ID
    const profile = await this.miniappService.upsertTelegramUser(tgUser);

    // Issue standard API session token
    const session = await this.authService.createSessionForUser(profile.id, 'USER', profile);

    return {
      success: true,
      data: {
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
        },
        user: { id: profile.id },
        profile: profile,
      },
    };
  }
}
