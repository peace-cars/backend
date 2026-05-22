import { IsString, IsNumber, IsOptional, IsArray, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVehicleDto {
  @IsString()
  make: string;

  @IsString()
  model: string;

  @IsNumber()
  @Type(() => Number)
  year: number;

  @IsNumber()
  @Type(() => Number)
  retail_price_etb: number;

  @IsString()
  duty: string;

  @IsString()
  fuel: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
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
  @IsNumber()
  @Type(() => Number)
  certified_km?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional() @IsNumber() 
  @Type(() => Number)
  range_km?: number;
  @IsOptional() @IsNumber()
  @Type(() => Number)
  motor_power_kw?: number;
  @IsOptional() @IsString() drive_train?: string;
  @IsOptional() @IsString() interior_color?: string;
  @IsOptional() @IsNumber()
  @Type(() => Number)
  battery_capacity_kwh?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsString() software_language?: string;
  @IsOptional() @IsString() charger?: string;
  @IsOptional() @IsString() branch_id?: string;
  @IsOptional() @IsNumber()
  @Type(() => Number)
  unit_cost?: number;
  @IsOptional() @IsNumber()
  @Type(() => Number)
  floor_plan_loan?: number;
  @IsOptional() @IsString() maturity_date?: string;
  @IsOptional() @IsString() sold_date?: string;
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
  @IsNumber()
  certified_km?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @IsOptional() @IsNumber()
  @Type(() => Number)
  range_km?: number;
  @IsOptional() @IsNumber()
  @Type(() => Number)
  motor_power_kw?: number;
  @IsOptional() @IsString() drive_train?: string;
  @IsOptional() @IsString() interior_color?: string;
  @IsOptional() @IsNumber()
  @Type(() => Number)
  battery_capacity_kwh?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) features?: string[];
  @IsOptional() @IsString() software_language?: string;
  @IsOptional() @IsString() charger?: string;
  @IsOptional() @IsString() branch_id?: string;
  @IsOptional() @IsNumber()
  @Type(() => Number)
  unit_cost?: number;
  @IsOptional() @IsNumber()
  @Type(() => Number)
  floor_plan_loan?: number;
  @IsOptional() @IsString() maturity_date?: string;
  @IsOptional() @IsString() sold_date?: string;
}
