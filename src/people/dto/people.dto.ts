import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, IsUUID } from 'class-validator';
import { Role } from '../../auth/roles.enums';

export class CreatePersonDto {
  @IsString()
  fullName: string;

  @IsString()
  phone: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsNumber()
  commissionTier?: number;

  @IsOptional()
  @IsString()
  date_of_birth?: string;
}

export class UpdatePersonDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  locationId?: string;

  @IsOptional()
  commissionTier?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  date_of_birth?: string;
}
