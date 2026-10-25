import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DatabaseModule } from './modules/database/database.module';
import { BillingModule } from './modules/billing/billing.module';
import { TreasuryModule } from './modules/treasury/treasury.module';
import { HrModule } from './modules/hr/hr.module';
import { PartnersModule } from './modules/partners/partners.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CreditNotesModule } from './modules/credit-notes/credit-notes.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { BranchesModule } from './modules/branches/branches.module';
import { ReportsModule } from './modules/reports/reports.module';
import { BiModule } from './modules/bi/bi.module';
import { CronModule } from './modules/cron/cron.module';
import { LoansModule } from './modules/loans/loans.module';
import { AuditModule } from './modules/audit/audit.module';
import { CurrenciesModule } from './modules/settings/currencies/currencies.module';
import { BanksModule } from './modules/settings/banks/banks.module';
import { TaxConceptsModule } from './modules/settings/tax-concepts/tax-concepts.module';
import { RolesModule } from './modules/roles/roles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    BillingModule,
    TreasuryModule,
    HrModule,
    PartnersModule,
    ProductsModule,
    OrdersModule,
    InventoryModule,
    CreditNotesModule,
    AccountingModule,
    BranchesModule,
    ReportsModule,
    BiModule,
    CronModule,
    LoansModule,
    AuditModule,
    CurrenciesModule,
    BanksModule,
    TaxConceptsModule,
    RolesModule,
  ],
})
export class AppModule {}
