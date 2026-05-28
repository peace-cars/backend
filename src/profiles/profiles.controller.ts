import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enums';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  @Get('me')
  async getMyProfile(@Req() req: any) {
    return this.profilesService.getProfile(req.user.id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  @Patch('me')
  async updateMyProfile(@Req() req: any, @Body() body: any) {
    return this.profilesService.updateProfile(req.user.id, body);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  @Post('garage')
  async addCarToGarage(@Req() req: any, @Body() body: any) {
    return this.profilesService.addToGarage(req.user.id, body);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.BROKER, Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  @Delete('garage/:id')
  async removeCarFromGarage(@Req() req: any, @Param('id') carId: string) {
    return this.profilesService.removeFromGarage(req.user.id, carId);
  }

  // Public profile endpoint
  @Get(':id')
  async getPublicProfile(@Param('id') userId: string) {
    return this.profilesService.getProfile(userId);
  }
}
