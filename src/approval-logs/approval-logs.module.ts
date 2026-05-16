import { Module } from '@nestjs/common';
import { ApprovalLogsController } from './approval-logs.controller';
import { ApprovalLogsService } from './approval-logs.service';

@Module({
  controllers: [ApprovalLogsController],
  providers: [ApprovalLogsService]
})
export class ApprovalLogsModule {}
