import { Injectable, BadRequestException } from '@nestjs/common';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../database';
import { MoneyService } from '../../common/money/money.service';
import { accountingAccounts, accountingEntries, accountingEntryLines } from '../../schema';
import { AccountType, EntryStatus } from '../accounting/dto/accounting.dto';

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceReport {
  from: string | null;
  to: string | null;
  branchId: string | null;
  rows: TrialBalanceRow[];
  totals: { debit: number; credit: number; difference: number };
  balanced: boolean;
}

export interface StatementLine {
  accountId: string;
  code: string;
  name: string;
  balance: number;
}

export interface BalanceSheetReport {
  date: string;
  branchId: string | null;
  assets: StatementLine[];
  liabilities: StatementLine[];
  equity: StatementLine[];
  totals: {
    assets: number;
    liabilities: number;
    equity: number;
    result: number;
    liabilitiesAndEquity: number;
    difference: number;
  };
  balanced: boolean;
}

export interface IncomeStatementReport {
  from: string | null;
  to: string | null;
  branchId: string | null;
  revenue: StatementLine[];
  costs: StatementLine[];
  expenses: StatementLine[];
  totals: {
    revenue: number;
    costs: number;
    grossProfit: number;
    expenses: number;
    result: number;
  };
}

/** Signo natural de cada naturaleza: los pasivos y el patrimonio crecen por el haber. */
const CREDIT_NATURE = new Set<string>([AccountType.LIABILITY, AccountType.EQUITY]);
const EXPENSE_NATURE = new Set<string>([AccountType.EXPENSE, AccountType.COST]);

/**
 * Estados financieros sobre el libro (`T-04-05` … `T-04-07`).
 *
 * Regla que se respeta en las tres consultas: **sólo asientos `POSTED`** (regla 6 de `S-04`). Un
 * borrador es papelería, no contabilidad. Y siempre por sucursal: el libro de una sucursal no ve los
 * asientos de otra (R5 de `S-00`).
 */
@Injectable()
export class FinancialReportsService {
  constructor(private readonly money: MoneyService = new MoneyService()) {}

  async trialBalance(branchId: string, from?: string, to?: string): Promise<TrialBalanceReport> {
    const rows = await this.aggregate(branchId, from, to);

    const mapped: TrialBalanceRow[] = rows.map(row => {
      const debit = this.round(row.debit);
      const credit = this.round(row.credit);

      return {
        accountId: row.accountId,
        code: row.code,
        name: row.name,
        type: row.type as AccountType,
        debit,
        credit,
        balance: this.round(debit - credit),
      };
    });

    const totalDebit = this.round(mapped.reduce((sum, row) => sum + row.debit, 0));
    const totalCredit = this.round(mapped.reduce((sum, row) => sum + row.credit, 0));
    const difference = this.round(totalDebit - totalCredit);

    return {
      from: from ?? null,
      to: to ?? null,
      branchId,
      rows: mapped,
      totals: { debit: totalDebit, credit: totalCredit, difference },
      balanced: Math.abs(difference) <= 0.01,
    };
  }

  /**
   * Activo = Pasivo + Patrimonio **+ resultado del ejercicio**. El resultado no se inventa: sale de
   * las cuentas de ingreso, costo y gasto acumuladas hasta la fecha, que es lo que hace que el
   * balance cuadre antes de practicar el asiento de cierre.
   */
  async balanceSheet(branchId: string, date?: string): Promise<BalanceSheetReport> {
    const asOf = date ?? new Date().toISOString();
    const rows = await this.aggregate(branchId, undefined, asOf);

    const assets: StatementLine[] = [];
    const liabilities: StatementLine[] = [];
    const equity: StatementLine[] = [];

    let revenue = 0;
    let costs = 0;
    let expenses = 0;

    for (const row of rows) {
      const debit = this.round(row.debit);
      const credit = this.round(row.credit);
      const line: StatementLine = {
        accountId: row.accountId,
        code: row.code,
        name: row.name,
        balance: this.round(CREDIT_NATURE.has(row.type) ? credit - debit : debit - credit),
      };

      switch (row.type) {
        case AccountType.ASSET:
          assets.push(line);
          break;
        case AccountType.LIABILITY:
          liabilities.push(line);
          break;
        case AccountType.EQUITY:
          equity.push(line);
          break;
        case AccountType.REVENUE:
          revenue += credit - debit;
          break;
        case AccountType.COST:
          costs += debit - credit;
          break;
        case AccountType.EXPENSE:
          expenses += debit - credit;
          break;
        default:
          // Las cuentas de orden no forman parte del balance.
          break;
      }
    }

    const result = this.round(revenue - costs - expenses);
    const totalAssets = this.round(assets.reduce((sum, line) => sum + line.balance, 0));
    const totalLiabilities = this.round(liabilities.reduce((sum, line) => sum + line.balance, 0));
    const totalEquity = this.round(equity.reduce((sum, line) => sum + line.balance, 0));
    const liabilitiesAndEquity = this.round(totalLiabilities + totalEquity + result);

    return {
      date: asOf,
      branchId,
      assets,
      liabilities,
      equity,
      totals: {
        assets: totalAssets,
        liabilities: totalLiabilities,
        equity: totalEquity,
        result,
        liabilitiesAndEquity,
        difference: this.round(totalAssets - liabilitiesAndEquity),
      },
      balanced: Math.abs(totalAssets - liabilitiesAndEquity) <= 0.01,
    };
  }

  async incomeStatement(
    branchId: string,
    from?: string,
    to?: string
  ): Promise<IncomeStatementReport> {
    if (from && to && from > to) {
      throw new BadRequestException('El rango de fechas está invertido');
    }

    const rows = await this.aggregate(branchId, from, to);

    const revenue: StatementLine[] = [];
    const costs: StatementLine[] = [];
    const expenses: StatementLine[] = [];

    let revenueTotal = 0;
    let costTotal = 0;
    let expenseTotal = 0;

    for (const row of rows) {
      if (!EXPENSE_NATURE.has(row.type) && row.type !== AccountType.REVENUE) continue;

      const debit = this.round(row.debit);
      const credit = this.round(row.credit);
      const balance = this.round(
        row.type === AccountType.REVENUE ? credit - debit : debit - credit
      );
      const line: StatementLine = {
        accountId: row.accountId,
        code: row.code,
        name: row.name,
        balance,
      };

      if (row.type === AccountType.REVENUE) {
        revenue.push(line);
        revenueTotal += balance;
      } else if (row.type === AccountType.COST) {
        costs.push(line);
        costTotal += balance;
      } else {
        expenses.push(line);
        expenseTotal += balance;
      }
    }

    const totalRevenue = this.round(revenueTotal);
    const totalCosts = this.round(costTotal);
    const totalExpenses = this.round(expenseTotal);
    const grossProfit = this.round(totalRevenue - totalCosts);

    return {
      from: from ?? null,
      to: to ?? null,
      branchId,
      revenue,
      costs,
      expenses,
      totals: {
        revenue: totalRevenue,
        costs: totalCosts,
        grossProfit,
        expenses: totalExpenses,
        result: this.round(grossProfit - totalExpenses),
      },
    };
  }

  /** Movimientos posteados agrupados por cuenta en el rango pedido. */
  private async aggregate(
    branchId: string,
    from?: string,
    to?: string
  ): Promise<
    Array<{
      accountId: string;
      code: string;
      name: string;
      type: string;
      debit: number;
      credit: number;
    }>
  > {
    const conditions = [
      eq(accountingEntries.status, EntryStatus.POSTED),
      eq(accountingEntries.branchId, branchId),
    ];

    if (from) conditions.push(gte(accountingEntries.date, new Date(from)));
    if (to) conditions.push(lte(accountingEntries.date, new Date(to)));

    const rows = await db
      .select({
        accountId: accountingAccounts.id,
        code: accountingAccounts.code,
        name: accountingAccounts.name,
        type: accountingAccounts.type,
        debit: sql<string>`coalesce(sum(${accountingEntryLines.debit}), 0)`,
        credit: sql<string>`coalesce(sum(${accountingEntryLines.credit}), 0)`,
      })
      .from(accountingEntryLines)
      .innerJoin(accountingEntries, eq(accountingEntryLines.entryId, accountingEntries.id))
      .innerJoin(accountingAccounts, eq(accountingEntryLines.accountId, accountingAccounts.id))
      .where(and(...conditions))
      .groupBy(
        accountingAccounts.id,
        accountingAccounts.code,
        accountingAccounts.name,
        accountingAccounts.type
      )
      .orderBy(accountingAccounts.code);

    return rows.map(row => ({
      accountId: row.accountId,
      code: row.code,
      name: row.name,
      type: row.type,
      debit: Number(row.debit),
      credit: Number(row.credit),
    }));
  }

  private round(value: number): number {
    return Number(this.money.round(value));
  }
}
