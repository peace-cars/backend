import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // If the user is authenticated, use their ID for rate limiting
    if (req.user?.id) {
      return req.user.id;
    }
    
    // Otherwise use IP
    return req.ips.length ? req.ips[0] : req.ip;
  }
}
