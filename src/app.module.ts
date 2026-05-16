import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { FinanceModule } from './finance/finance.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { TradeInRequestsModule } from './trade-in-requests/trade-in-requests.module';
import { InspectionsModule } from './inspections/inspections.module';
import { FinancePlansModule } from './finance-plans/finance-plans.module';
import { CommissionsModule } from './commissions/commissions.module';
import { LocationsModule } from './locations/locations.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SupabaseModule,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
