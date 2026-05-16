import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateCustomOrderDto {
  @IsString()
  customerName: string;

  @IsString()
  customerPhone: string;

  @IsString()
  make: string;

  @IsString()
  model: string;

  @IsOptional()
  @IsString()
  yearRange?: string;

  @IsOptional()
  @IsString()
  fuelType?: string;

  @IsOptional()
  @IsString()
  dutyPreference?: string;

  @IsOptional()
  @IsNumber()
  budgetEtb?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCustomOrderStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  staffNotes?: string;
}

export class AssignCustomOrderDto {
  @IsString()
  staffId: string;
}
