import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private supabaseService: SupabaseService,
    private readonly prisma: PrismaService,
  ) {
    super({
      // We extract the token from the standard Authorization Header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // The Supabase JWT Secret guarantees the token integrity and authenticity
      secretOrKey: configService.get<string>('SUPABASE_JWT_SECRET') || 'fall-back-secret-never-use-in-prod-1234!!',
    });
  }

  // The decrypted Supabase JWT matches this interface
  async validate(payload: any) {
    if (!payload) {
        throw new UnauthorizedException('Payload compromised.');
    }
    this.logger.debug(`Validating user session (UUID: ${payload.sub})`);

    // Fetch real profile from DB because seated users might have empty user_metadata
    const profile = await this.prisma.profiles.findUnique({
      where: { id: payload.sub },
      select: { role: true, branch_id: true },
    });
    
    return { 
        userId: payload.sub, 
        role: profile?.role || payload.user_metadata?.role || 'USER', 
        branchId: profile?.branch_id || payload.user_metadata?.branch_id || null
    };
  }
}
