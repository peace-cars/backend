import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import * as crypto from 'crypto';

@Injectable()
export class MiniappService {
  private readonly logger = new Logger(MiniappService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  public validateInitData(initDataRaw: string): any {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.error('TELEGRAM_BOT_TOKEN not configured for HMAC validation');
      return null;
    }

    const urlParams = new URLSearchParams(initDataRaw);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    
    // Sort keys alphabetically
    const keys = Array.from(urlParams.keys()).sort();
    const dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const generatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (generatedHash !== hash) {
      if (process.env.NODE_ENV !== 'production' && hash === 'mock_hash') {
        this.logger.warn('Bypassing signature validation for local mock hash');
      } else {
        this.logger.warn(`Invalid initData signature. Expected ${generatedHash}, got ${hash}`);
        return null;
      }
    }

    const userStr = urlParams.get('user');
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch (e) {
      this.logger.error('Failed to parse telegram user string', e);
      return null;
    }
  }

  public async upsertTelegramUser(tgUser: any): Promise<any> {
    const client = this.supabase.getClient();
    const telegramUserId = tgUser.id;
    const username = tgUser.username || '';
    const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ');

    // 1. Try to find existing profile
    const { data: existingProfile } = await client
      .from('profiles')
      .select('*')
      .eq('telegram_user_id', telegramUserId)
      .single();

    if (existingProfile) {
      // Update username/name if changed
      await client.from('profiles').update({
        telegram_username: username,
        full_name: existingProfile.full_name === 'Telegram User' ? fullName : existingProfile.full_name
      }).eq('id', existingProfile.id);
      
      return { ...existingProfile, telegram_username: username };
    }

    // 2. Create new shadow user + profile
    const shadowEmail = `tg_${telegramUserId}@tma.peacecars.com`;
    const shadowPassword = crypto.randomBytes(16).toString('hex');
    
    // Auto-confirm
    const { data: authData, error: authError } = await this.supabase.getClient().auth.admin.createUser({
      email: shadowEmail,
      password: shadowPassword,
      email_confirm: true,
      user_metadata: { source: 'telegram_miniapp' }
    });

    if (authError || !authData.user) {
      this.logger.error('Failed to create shadow auth user', authError);
      throw new UnauthorizedException('Failed to create account');
    }

    const userId = authData.user.id;

    // The user creation might trigger a trigger to create a profile.
    // Let's upsert the profile with telegram_user_id
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .upsert({
        id: userId,
        full_name: fullName || 'Telegram User',
        phone_number: `TG_${telegramUserId}`, // fake phone just to pass NOT NULL if needed
        telegram_user_id: telegramUserId,
        telegram_username: username,
      })
      .select()
      .single();

    if (profileError || !profile) {
      this.logger.error('Failed to create profile', profileError);
      throw new UnauthorizedException('Failed to create profile');
    }

    return profile;
  }
}
