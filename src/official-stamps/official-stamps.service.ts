import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as crypto from 'crypto';

@Injectable()
export class OfficialStampsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async verifyAndStamp(userId: string, role: string, stampType: string) {
    // Simulated Cryptographic Verification
    const simulatedHash = crypto.createHash('sha256').update(userId + Date.now().toString()).digest('hex');
    
    let svgIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="3"/></svg>';
    if (stampType === 'FACE_ID_VERIFIED') {
       svgIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="green" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'; // Mock Check
    }

    const { data, error } = await this.supabaseService.getClient()
      .from('official_stamps')
      .insert([{
        owner_id: userId,
        stamp_type: stampType,
        signature_svg: `<g data-hash="${simulatedHash}" data-role="${role}">${svgIcon}</g>`,
        is_active: true
      }])
      .select()
      .single();

    if (error) throw new InternalServerErrorException(error.message);
    return data;
  }
}
