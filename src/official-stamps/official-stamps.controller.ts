import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { OfficialStampsService } from './official-stamps.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('official-stamps')
@UseGuards(RolesGuard)
export class OfficialStampsController {
  constructor(private readonly stampsService: OfficialStampsService) {}

  @Post('verify')
  @Roles('STAFF', 'DISTRICT_MANAGER', 'GENERAL_MANAGER', 'FINANCE_AUDITOR')
  async verifyBiometric(@Request() req: any, @Body() body: { stampType: string }) {
    // Usually this requires real WebAuthn hardware check or Apple FaceID hooks,
    // For the Dealership OS, we simulate the assertion here and generate the stamp overlay.
    return this.stampsService.verifyAndStamp(req.user.userId, req.user.role, body.stampType);
  }
}
