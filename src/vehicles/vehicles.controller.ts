import { Controller, Get, Post, Patch, Delete, Req, Body, UseGuards, Param } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { RolesGuard } from '../auth/roles.guard';
import { ScopeGuard } from '../auth/scope.guard';
import { Roles } from '../auth/roles.decorator';
import { RequiresPermission } from '../auth/permissions.decorator';
import { Role } from '../auth/roles.enums';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  // Public Endpoint: Shows only RETAIL models for the Client Frontend
  @Get('showroom')
  async getShowroom() {
    const rawData = await this.vehiclesService.getShowroom();
    return rawData.map(v => ({
      id: v.id,
      make: v.make,
      model: v.model,
      year: v.year,
      retailPriceETB: v.retail_price_etb,
      dutyStatus: v.duty,
      fuelType: v.fuel,
      batterySoh: v.battery_soh_percent,
      branchId: v.branch_id,
      locationName: v.branches?.name || 'Main Registry',
      images: (Array.isArray(v.images) && v.images.length > 0) ? v.images : 
              (Array.isArray(v.gallery) && v.gallery.length > 0) ? v.gallery :
              (Array.isArray(v.image_urls) && v.image_urls.length > 0) ? v.image_urls :
              ["https://images.unsplash.com/photo-1550520920-aa136006dcce?auto=format&fit=crop&q=80&w=2938"],
      certifiedKm: v.certified_km || null,
      inquiryCount: v.inquiryCount || 0
    }));
  }

  @Get('showroom/:id')
  async getVehicleDetails(@Param('id') id: string) {
    const v = await this.vehiclesService.getVehicleById(id);
    return {
      id: v.id,
      make: v.make,
      model: v.model,
      year: v.year,
      retailPriceETB: v.retail_price_etb,
      dutyStatus: v.duty,
      fuelType: v.fuel,
      batterySoh: v.battery_soh_percent,
      branchId: v.branch_id,
      locationName: v.branches?.name || 'Main Registry',
      images: (Array.isArray(v.images) && v.images.length > 0) ? v.images : 
              (Array.isArray(v.gallery) && v.gallery.length > 0) ? v.gallery :
              (Array.isArray(v.image_urls) && v.image_urls.length > 0) ? v.image_urls :
              ["https://images.unsplash.com/photo-1550520920-aa136006dcce?auto=format&fit=crop&q=80&w=2938"],
      basePriceETB: v.total_landed_cost_etb || (v.retail_price_etb * 0.75),
      certifiedKm: v.certified_km || null,
      vinChassis: v.vin_chassis,
      plateCode: v.plate_code,
      chargerType: v.charger,
      softwareLanguage: v.software_language,
      rangeKm: v.range_km,
      motorPower: v.motor_power_kw,
      driveTrain: v.drive_train,
      interiorColor: v.interior_color,
      batteryCapacity: v.battery_capacity_kwh,
      features: v.features || [],
      inspection: { score: 96, engine_battery: 'Excellent', suspension: 'Perfect' },
      transit_metadata: { port: 'Djibouti', eta: 'Arrived' },
      inquiryCount: v.inquiryCount || 0 
    };
  }

  @Get('profitability')
  @UseGuards(RolesGuard, ScopeGuard)
  @RequiresPermission('inventory.audit')
  async getProfitability() {
    return this.vehiclesService.getProfitabilityReport();
  }

  @Get('aged-inventory')
  @UseGuards(RolesGuard, ScopeGuard)
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  async getAgedInventory() {
    return this.vehiclesService.getAgedInventory(60);
  }

  @Get()
  @UseGuards(RolesGuard, ScopeGuard)
  @RequiresPermission('inventory.view')
  async getAllVehicles(@Req() req: any) {
    return this.vehiclesService.getAll(req.user);
  }

  @Post()
  @UseGuards(RolesGuard, ScopeGuard)
  @RequiresPermission('inventory.create')
  async createVehicle(@Body() data: CreateVehicleDto) {
    return this.vehiclesService.createVehicle(data);
  }

  @Delete(':id')
  @UseGuards(RolesGuard, ScopeGuard)
  @RequiresPermission('inventory.delete')
  async deleteVehicle(@Param('id') id: string) {
    return this.vehiclesService.delete(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard, ScopeGuard)
  @RequiresPermission('inventory.update')
  async updateVehicle(@Param('id') id: string, @Body() data: UpdateVehicleDto) {
    return this.vehiclesService.update(id, data);
  }

  @Post('promote/:leadId')
  @UseGuards(RolesGuard, ScopeGuard)
  @RequiresPermission('inventory.create')
  async promoteFromTradeIn(@Param('leadId') leadId: string, @Body() data: { retailPrice: number }) {
    return this.vehiclesService.createFromTradeIn(leadId, data.retailPrice);
  }
}
