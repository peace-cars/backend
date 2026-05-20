import { Module } from '@nestjs/common';
import { VehicleExpensesController } from './vehicle-expenses.controller';
import { VehicleExpensesService } from './vehicle-expenses.service';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [FinanceModule],
  controllers: [VehicleExpensesController],
  providers: [VehicleExpensesService]
})
export class VehicleExpensesModule {}
