import { Controller, Get, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  async check() {
    try {
      const start = Date.now();
      // Simple query to verify DB connectivity
      const { error } = await this.supabase.getClient()
        .from('roles')
        .select('id')
        .limit(1);

      const dbLatency = Date.now() - start;

      if (error) {
        this.logger.error('Health Check Failed: Database error', error);
        return {
          status: 'error',
          database: 'disconnected',
          message: error.message,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        status: 'ok',
        database: 'connected',
        latency: `${dbLatency}ms`,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      this.logger.error('Health Check Failed: Exception', err);
      return {
        status: 'error',
        database: 'disconnected',
        message: err.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
