import { IsNumber, IsString, IsNotEmpty, IsOptional, Min } from 'class-validator';

export class CreateBudgetRequestDto {
  @IsNumber()
  @Min(0.01, { message: 'Requested amount must be greater than zero.' })
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty({ message: 'Purpose description is required.' })
  purpose: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;
}

export class ApproveBudgetDto {
  @IsNumber()
  @Min(0.01, { message: 'Approved amount must be greater than zero.' })
  @IsNotEmpty()
  amount: number;
}

export class UpdateReceiptDto {
  @IsString()
  @IsNotEmpty()
  receiptUrl: string;
}
