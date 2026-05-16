import { Module } from '@nestjs/common';
import { VehicleExpensesController } from './vehicle-expenses.controller';
import { VehicleExpensesService } from './vehicle-expenses.service';

@Module({
  controllers: [VehicleExpensesController],
  providers: [VehicleExpensesService]
})
export class VehicleExpensesModule {}
