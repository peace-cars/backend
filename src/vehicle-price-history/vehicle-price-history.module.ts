import { Module } from '@nestjs/common';
import { VehiclePriceHistoryController } from './vehicle-price-history.controller';
import { VehiclePriceHistoryService } from './vehicle-price-history.service';

@Module({
  controllers: [VehiclePriceHistoryController],
  providers: [VehiclePriceHistoryService]
})
export class VehiclePriceHistoryModule {}
