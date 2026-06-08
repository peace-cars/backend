import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { QueueModule } from './queues/queue.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AuthModule } from './auth/auth.module';
import { FinanceModule } from './finance/finance.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { TradeInRequestsModule } from './trade-in-requests/trade-in-requests.module';
import { InspectionsModule } from './inspections/inspections.module';
import { FinancePlansModule } from './finance-plans/finance-plans.module';
import { CommissionsModule } from './commissions/commissions.module';
import { LocationsModule } from './locations/locations.module';
import { ProfilesModule } from './profiles/profiles.module';
import { BankPartnersModule } from './bank-partners/bank-partners.module';
import { VehicleExpensesModule } from './vehicle-expenses/vehicle-expenses.module';
import { VehiclePriceHistoryModule } from './vehicle-price-history/vehicle-price-history.module';
import { ApprovalLogsModule } from './approval-logs/approval-logs.module';
import { MessagesModule } from './messages/messages.module';
import { DocumentsModule } from './documents/documents.module';
import { StaffPerformanceModule } from './staff-performance/staff-performance.module';
import { PeopleModule } from './people/people.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SettingsModule } from './settings/settings.module';
import { CommissionWorkflowModule } from './commission-workflow/commission-workflow.module';
import { StaffBudgetsModule } from './staff-budgets/staff-budgets.module';
import { StaffTasksModule } from './staff-tasks/staff-tasks.module';
import { OfficialStampsModule } from './official-stamps/official-stamps.module';
import { TelegramModule } from './telegram/telegram.module';
import { CustomOrdersModule } from './custom-orders/custom-orders.module';
import { CommunityModule } from './community/community.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { UploadModule } from './upload/upload.module';

import { HealthController } from './common/health.controller';
import { SourcingRequestsModule } from './sourcing-requests/sourcing-requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Distributed rate limiting (in-memory; Redis throttler requires TCP which Upstash REST doesn't expose)
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    // Global Redis via Upstash REST SDK — provides caching across all modules
    RedisModule,
    SupabaseModule,
    PrismaModule,
    // Background queue and realtime
    QueueModule,
    RealtimeModule,
    AuthModule,
    FinanceModule,
    VehiclesModule,
    TradeInRequestsModule,
    InspectionsModule,
    FinancePlansModule,
    CommissionsModule,
    LocationsModule,
    BankPartnersModule,
    VehicleExpensesModule,
    VehiclePriceHistoryModule,
    ApprovalLogsModule,
    MessagesModule,
    DocumentsModule,
    StaffPerformanceModule,
    PeopleModule,
    NotificationsModule,
    SettingsModule,
    CommissionWorkflowModule,
    StaffBudgetsModule,
    StaffTasksModule,
    OfficialStampsModule,
    TelegramModule,
    CustomOrdersModule,
    CommunityModule,
    ProfilesModule,
    SourcingRequestsModule,
    UploadModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
