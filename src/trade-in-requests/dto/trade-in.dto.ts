import { IsString, IsNumber, IsOptional, IsArray, IsUUID, IsBoolean, IsEnum, IsObject } from 'class-validator';

export class CreateTradeInDto {
  @IsString()
  vehicleMakeModel: string;

  @IsString()
  carDescription: string;

  @IsNumber()
  askingPrice: number;

  @IsString()
  locationId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @IsOptional()
  @IsBoolean()
  financingRequested?: boolean;

  @IsOptional()
  @IsObject()
  vehicleDetails?: any;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  contactCity?: string;
}

export class InspectionUploadDto {
  @IsUUID()
  leadId: string;

  @IsNumber()
  mechanical_score: number;

  @IsNumber()
  exterior_score: number;

  @IsNumber()
  interior_score: number;

  @IsOptional()
  checklist?: any;

  @IsOptional()
  ev_data?: any;

  @IsOptional()
  @IsString()
  final_notes?: string;
}

export class UpdateStatusDto {
  @IsString()
  status: string;
}
