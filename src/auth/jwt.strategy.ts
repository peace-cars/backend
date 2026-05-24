import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('SUPABASE_JWT_SECRET') || 'fall-back-secret-never-use-in-prod-1234!!',
    });
  }

  async validate(payload: any) {
    if (!payload) {
        throw new UnauthorizedException('Payload compromised.');
    }
    this.logger.debug(`Validating user session (UUID: ${payload.sub})`);

    const { data: profile } = await this.supabaseService.getClient()
      .from('profiles')
      .select('role, branch_id')
      .eq('id', payload.sub)
      .maybeSingle();
    
    return { 
        userId: payload.sub, 
        role: profile?.role || payload.user_metadata?.role || 'USER', 
        branchId: profile?.branch_id || payload.user_metadata?.branch_id || null
    };
  }
}
