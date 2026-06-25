import { IsEmail, IsString, IsOptional, IsEnum, MinLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../roles.enums';

/**
 * Public registration DTO — only allows USER and BROKER roles.
 */
export class RegisterDto {
  @ApiProperty({ example: 'customer@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Abebe Kebede' })
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ enum: [Role.USER, Role.BROKER], default: Role.USER })
  @IsOptional()
  @IsEnum([Role.USER, Role.BROKER], { message: 'Self-registration only allows USER or BROKER roles.' })
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Branch UUID for location association' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

/**
 * GM-only staff provisioning DTO — allows privileged roles.
 */
export class CreateStaffDto {
  @ApiProperty({ example: 'staff@peacecars.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StaffPass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Dawit Mekonnen' })
  @IsString()
  fullName: string;

  @ApiProperty({ enum: [Role.STAFF, Role.DISTRICT_MANAGER, Role.GENERAL_MANAGER, Role.FINANCE_AUDITOR] })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ description: 'Branch UUID to assign the staff member to' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

/**
 * One-time bootstrap DTO — creates the first GENERAL_MANAGER account.
 * Only succeeds when the profiles table is completely empty.
 */
export class BootstrapDto {
  @ApiProperty({ example: 'admin@peacecars.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'System Administrator' })
  @IsString()
  fullName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
