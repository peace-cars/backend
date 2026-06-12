import { Controller, Get, Post, Patch, Delete, Req, Body, UseGuards, Param, Query, ParseUUIDPipe, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { RolesGuard } from '../auth/roles.guard';
import { ScopeGuard } from '../auth/scope.guard';
import { Roles } from '../auth/roles.decorator';
import { RequiresPermission } from '../auth/permissions.decorator';
import { Role } from '../auth/roles.enums';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';
import { UpstashCacheInterceptor, CacheTTL } from '../redis/upstash-cache.interceptor';

@ApiTags('Vehicles / Inventory')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  // Public Endpoint: Shows only RETAIL models for the Client Frontend
  @ApiOperation({ summary: 'Get public showroom inventory', description: 'Returns a list of vehicles available for retail sale.' })
  @ApiResponse({ status: 200, description: 'List of showroom vehicles.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get('showroom')
  @UseInterceptors(UpstashCacheInterceptor)
  @CacheTTL(300)
  async getShowroom(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const result = await this.vehiclesService.getShowroom(pageNum, limitNum);
    
    const mapVehicle = (v: any) => ({
      ...v,
      images: (Array.isArray(v.images) && v.images.length > 0) ? v.images : 
              (Array.isArray(v.gallery) && v.gallery.length > 0) ? v.gallery :
              (Array.isArray(v.image_urls) && v.image_urls.length > 0) ? v.image_urls :
              ["https://images.unsplash.com/photo-1550520920-aa136006dcce?auto=format&fit=crop&q=80&w=2938"],
    });

    if (pageNum && limitNum) {
      return {
        ...result,
        data: (result as any).data.map(mapVehicle)
      };
    }
    
    return (result as any[]).map(mapVehicle);
  }

  @ApiOperation({ summary: 'Get details of a specific showroom vehicle' })
  @ApiResponse({ status: 200, description: 'Vehicle details.' })
  @Get('showroom/:id')
  @UseInterceptors(UpstashCacheInterceptor)
  @CacheTTL(60)
  async getVehicleDetails(@Param('id', ParseUUIDPipe) id: string) {
    const v = await this.vehiclesService.getVehicleById(id);
    return {
      ...v,
      images: (Array.isArray(v.images) && v.images.length > 0) ? v.images : 
              (Array.isArray(v.gallery) && v.gallery.length > 0) ? v.gallery :
              (Array.isArray(v.image_urls) && v.image_urls.length > 0) ? v.image_urls :
              ["https://images.unsplash.com/photo-1550520920-aa136006dcce?auto=format&fit=crop&q=80&w=2938"],
    };
  }

  @ApiOperation({ summary: 'Get profitability report' })
  @ApiBearerAuth('JWT-auth')
  @Get('profitability')
  @UseGuards(RolesGuard, ScopeGuard)
  @RequiresPermission('inventory.audit')
  @UseInterceptors(UpstashCacheInterceptor)
  @CacheTTL(60)
  async getProfitability(@Query('branchId') branchId?: string) {
    return this.vehiclesService.getProfitabilityReport(branchId);
  }

  @Get('aged-inventory')
  @UseGuards(RolesGuard, ScopeGuard)
  @Roles(Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR)
  @UseInterceptors(UpstashCacheInterceptor)
  @CacheTTL(120)
  async getAgedInventory(@Query('branchId') branchId?: string) {
    return this.vehiclesService.getAgedInventory(60, branchId);
  }

  @ApiOperation({ summary: 'Get all vehicles', description: 'Returns all vehicles within the user\'s authorization scope.' })
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by specific branch ID (Requires GM/DM role)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  @UseGuards(RolesGuard, ScopeGuard)
  @RequiresPermission('inventory.view')
  @UseInterceptors(UpstashCacheInterceptor)
  @CacheTTL(30)
  async getAllVehicles(
    @Req() req: any, 
    @Query('branchId') branchId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    return this.vehiclesService.getAll(req.user, branchId, pageNum, limitNum);
  }

  @ApiOperation({ summary: 'Create a new vehicle record' })
  @ApiBearerAuth('JWT-auth')
  @Post()
  @UseGuards(RolesGuard, ScopeGuard)
  @RequiresPermission('inventory.create')
  async createVehicle(@Body() data: CreateVehicleDto) {
    return this.vehiclesService.createVehicle(data);
  }

  @Delete(':id')
  @UseGuards(RolesGuard, ScopeGuard)
  @RequiresPermission('inventory.delete')
  async deleteVehicle(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehiclesService.delete(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard, ScopeGuard)
  @RequiresPermission('inventory.update')
  async updateVehicle(@Param('id', ParseUUIDPipe) id: string, @Body() data: UpdateVehicleDto) {
    return this.vehiclesService.update(id, data);
  }

  @ApiOperation({ summary: 'Get a single vehicle by ID (admin)' })
  @ApiBearerAuth('JWT-auth')
  @Get(':id')
  @UseGuards(RolesGuard, ScopeGuard)
  @RequiresPermission('inventory.view')
  async getVehicleById(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.vehiclesService.getVehicleById(id, req.user);
  }

  @Post('promote/:leadId')
  @UseGuards(RolesGuard, ScopeGuard)
  @RequiresPermission('inventory.create')
  async promoteFromTradeIn(@Param('leadId', ParseUUIDPipe) leadId: string, @Body() data: { retailPrice: number }) {
    return this.vehiclesService.createFromTradeIn(leadId, data.retailPrice);
  }
}
