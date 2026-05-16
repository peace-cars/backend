import { IsString, IsNumber, IsOptional, IsArray, IsUUID } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  make: string;

  @IsString()
  model: string;

  @IsNumber()
  year: number;

  @IsNumber()
  retail_price_etb: number;

  @IsString()
  duty: string;

  @IsString()
  fuel: string;

  @IsOptional()
  @IsNumber()
  battery_soh_percent?: number;

  @IsOptional()
  @IsString()
  plate_code?: string;

  @IsOptional()
  @IsString()
  vin_chassis?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  location_id?: string | null;

  @IsOptional()
  @IsNumber()
  certified_km?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional() @IsNumber() range_km?: number;
  @IsOptional() @IsNumber() motor_power_kw?: number;
  @IsOptional() @IsString() drive_train?: string;
  @IsOptional() @IsString() interior_color?: string;
  @IsOptional() @IsNumber() battery_capacity_kwh?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsString() software_language?: string;
  @IsOptional() @IsString() charger?: string;
  @IsOptional() @IsString() branch_id?: string;
}

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsNumber()
  retail_price_etb?: number;

  @IsOptional()
  @IsString()
  duty?: string;

  @IsOptional()
  @IsString()
  fuel?: string;

  @IsOptional()
  @IsNumber()
  battery_soh_percent?: number;

  @IsOptional()
  @IsString()
  plate_code?: string;

  @IsOptional()
  @IsString()
  vin_chassis?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  location_id?: string | null;

  @IsOptional()
  @IsNumber()
  certified_km?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional() @IsNumber() range_km?: number;
  @IsOptional() @IsNumber() motor_power_kw?: number;
  @IsOptional() @IsString() drive_train?: string;
  @IsOptional() @IsString() interior_color?: string;
  @IsOptional() @IsNumber() battery_capacity_kwh?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsString() software_language?: string;
  @IsOptional() @IsString() charger?: string;
  @IsOptional() @IsString() branch_id?: string;
}
