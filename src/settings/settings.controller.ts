import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';
import { Public } from '../auth/public.decorator';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

@Controller('settings')
@UseGuards(RolesGuard)
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  // ── Public endpoint — client app fetches feature flags without auth ──────────
  @Public()
  @Get()
  async getAll() {
    const { data, error } = await this.supabaseService.getClient()
      .from('system_settings')
      .select('*');

    if (error) throw new Error(error.message);

    return data.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
  }

  @Patch('exchange-rate')
  @Roles(Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async updateExchangeRate(@Body() data: { rate: string }) {
    const { error } = await this.supabaseService.getClient()
      .from('system_settings')
      .update({ value: data.rate })
      .eq('key', 'exchange_rate_usd_etb');

    if (error) return { success: false, message: error.message };
    return { success: true, newRate: data.rate };
  }

  // ── Feature flag toggle — GM only ────────────────────────────────────────────
  @Patch('feature-flags/:key')
  @Roles(Role.GENERAL_MANAGER)
  async updateFeatureFlag(
    @Param('key') key: string,
    @Body() data: { value: string },
  ) {
    const allowedKeys = ['feature_sell', 'feature_source', 'feature_community'];
    if (!allowedKeys.includes(key)) {
      throw new HttpException('Unknown feature flag key', HttpStatus.BAD_REQUEST);
    }

    // Upsert: create row if it doesn't exist yet
    const { error } = await this.supabaseService.getClient()
      .from('system_settings')
      .upsert({ key, value: data.value }, { onConflict: 'key' });

    if (error) return { success: false, message: error.message };
    this.logger.log(`Feature flag '${key}' set to '${data.value}'`);
    return { success: true, key, value: data.value };
  }

  @Patch(':key')
  @Roles(Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async updateSetting(@Param('key') key: string, @Body() data: { value: string }) {
    const { error } = await this.supabaseService.getClient()
      .from('system_settings')
      .update({ value: data.value })
      .eq('key', key);

    if (error) return { success: false, message: error.message };
    return { success: true };
  }

  // ── DANGER: Production data wipe — GM only ───────────────────────────────────
  @Post('wipe-all')
  @Roles(Role.GENERAL_MANAGER)
  async wipeAll(@Req() req: any) {
    this.logger.warn(`[WIPE] Initiated by GM user ${req.user?.id}`);

    // Use service-role key to bypass RLS
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>('SUPABASE_KEY') || this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!serviceRoleKey) {
      throw new HttpException(
        'SUPABASE_KEY is not configured on the server',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const admin = createClient(supabaseUrl!, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const wipedAt = new Date().toISOString();
    const errors: string[] = [];

    // Ordered delete — leaf tables first, then parent tables
    const WIPE_TABLES: string[] = [
      'audit_logs',
      'messages',
      'notifications',
      'official_stamps',
      'staff_performance',
      'approval_logs',
      'commissions',
      'staff_tasks',
      'staff_budgets',
      'documents',
      'vehicle_price_history',
      'vehicle_expenses',
      'inspections',
      'finance_plans',
      'trade_in_requests',
      'sourcing_requests',
      'conversations',
      'vehicles',
    ];

    for (const table of WIPE_TABLES) {
      const { error } = await admin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        this.logger.error(`[WIPE] Failed on table '${table}': ${error.message}`);
        errors.push(`${table}: ${error.message}`);
      } else {
        this.logger.log(`[WIPE] Cleared table '${table}'`);
      }
    }

    // Wipe profiles — but KEEP GENERAL_MANAGER and FINANCE_AUDITOR accounts
    const { error: profilesError } = await admin
      .from('profiles')
      .delete()
      .not('role', 'in', '("GENERAL_MANAGER","FINANCE_AUDITOR","ADMIN")');

    if (profilesError) {
      this.logger.error(`[WIPE] Failed on profiles: ${profilesError.message}`);
      errors.push(`profiles: ${profilesError.message}`);
    } else {
      this.logger.log('[WIPE] Cleared non-admin profiles');
    }

    if (errors.length > 0) {
      return {
        success: false,
        wipedAt,
        errors,
        message: 'Some tables failed to wipe. Check server logs.',
      };
    }

    this.logger.warn(`[WIPE] Complete. All test data cleared at ${wipedAt}`);
    return { success: true, wipedAt };
  }
}
