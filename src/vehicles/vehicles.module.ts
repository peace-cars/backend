import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { TelegramModule } from '../telegram/telegram.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [TelegramModule, RealtimeModule],
  controllers: [VehiclesController],
  providers: [VehiclesService]
})
export class VehiclesModule {}
