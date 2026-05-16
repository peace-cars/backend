import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('settings')
export class SettingsController {
  
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get()
  async getAll() {
    const { data, error } = await this.supabaseService.getClient()
      .from('system_settings')
      .select('*');
    
    if (error) throw new Error(error.message);
    
    // Transform array to a Record for client compatibility
    return data.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
  }

  @Patch('exchange-rate')
  async updateExchangeRate(@Body() data: { rate: string }) {
    const { error } = await this.supabaseService.getClient()
      .from('system_settings')
      .update({ value: data.rate })
      .eq('key', 'exchange_rate_usd_etb');
    
    if (error) return { success: false, message: error.message };
    return { success: true, newRate: data.rate };
  }

  @Patch(':key')
  async updateSetting(@Param('key') key: string, @Body() data: { value: string }) {
    const { error } = await this.supabaseService.getClient()
      .from('system_settings')
      .update({ value: data.value })
      .eq('key', key);
    
    if (error) return { success: false, message: error.message };
    return { success: true };
  }
}
