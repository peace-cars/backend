import { Module } from '@nestjs/common';
import { SourcingRequestsService } from './sourcing-requests.service';
import { SourcingRequestsController } from './sourcing-requests.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [SourcingRequestsService],
  controllers: [SourcingRequestsController]
})
export class SourcingRequestsModule {}
