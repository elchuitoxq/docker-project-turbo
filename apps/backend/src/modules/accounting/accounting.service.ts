import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { db } from '../../database';
import {
  accountingAccounts,
  accountingEntries,
  accountingEntryLines,
  accountingMaps,
  branches,
  users,
  invoices,
  payments,
} from '../../schema';
import { eq, and, gte, lte, sql, or } from 'drizzle-orm';
import {
  CreateAccountDto,
  AccountResponseDto,
  AccountTreeDto,
  CreateEntryDto,
  CreateEntryLineDto,
  EntryResponseDto,
  EntryLineResponseDto,
  CreateMapDto,
  MapResponseDto,
  AccountingMapApplyResponseDto,
  AccountType,
  EntryStatus,
} from './dto/accounting.dto';

@Injectable()
export class AccountingService {
  async findAllAccounts(): Promise<AccountTreeDto[]> {
    const accounts = await db
      .select()
      .from(accountingAccounts)
      .where(eq(accountingAccounts.isActive, true))
      .orderBy(accountingAccounts.code);

    return this.buildTree(accounts);
  }

  private buildTree(accounts: (typeof accountingAccounts.$inferSelect)[]): AccountTreeDto[] {
    const accountMap = new Map<string, AccountTreeDto>();
    const roots: AccountTreeDto[] = [];

    for (const account of accounts) {
      accountMap.set(account.id, {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type as AccountType,
        branchId: account.branchId,
        parentId: account.parentId,
        isActive: account.isActive ?? true,
        children: [],
      });
    }

    for (const account of accounts) {
      const node = accountMap.get(account.id)!;
      if (account.parentId && accountMap.has(account.parentId)) {
        accountMap.get(account.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async findOneAccount(id: string): Promise<AccountResponseDto> {
    const [account] = await db
      .select()
      .from(accountingAccounts)
      .where(eq(accountingAccounts.id, id))
      .limit(1);

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return this.toAccountResponseDto(account);
  }

  async createAccount(createAccountDto: CreateAccountDto): Promise<AccountResponseDto> {
    const [existingAccount] = await db
      .select()
      .from(accountingAccounts)
      .where(
        and(
          eq(accountingAccounts.code, createAccountDto.code),
          createAccountDto.branchId
            ? eq(accountingAccounts.branchId, createAccountDto.branchId)
            : sql`1=1`
        )
      )
      .limit(1);

    if (existingAccount) {
      throw new BadRequestException(`Account with code ${createAccountDto.code} already exists`);
    }

    const [newAccount] = await db
      .insert(accountingAccounts)
      .values({
        code: createAccountDto.code,
        name: createAccountDto.name,
        type: createAccountDto.type,
        branchId: createAccountDto.branchId,
        parentId: createAccountDto.parentId,
        isActive: true,
      })
      .returning();

    return this.toAccountResponseDto(newAccount);
  }

  async findAllEntries(filters: {
    dateFrom?: string;
    dateTo?: string;
    accountId?: string;
    branchId?: string;
  }): Promise<EntryResponseDto[]> {
    const conditions = [];

    if (filters.branchId) {
      conditions.push(eq(accountingEntries.branchId, filters.branchId));
    }

    if (filters.dateFrom) {
      conditions.push(gte(accountingEntries.date, new Date(filters.dateFrom)));
    }

    if (filters.dateTo) {
      conditions.push(lte(accountingEntries.date, new Date(filters.dateTo)));
    }

    let query = db.select().from(accountingEntries);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const entries = await query.orderBy(sql`${accountingEntries.date} desc`);

    const result: EntryResponseDto[] = [];

    for (const entry of entries) {
      const response = await this.toEntryResponseDto(entry);

      if (filters.accountId) {
        const hasAccount = response.lines.some(line => line.accountId === filters.accountId);
        if (hasAccount) {
          result.push(response);
        }
      } else {
        result.push(response);
      }
    }

    return result;
  }

  async findOneEntry(id: string, branchId?: string): Promise<EntryResponseDto> {
    if (branchId) {
      const [entry] = await db
        .select({ branchId: accountingEntries.branchId })
        .from(accountingEntries)
        .where(eq(accountingEntries.id, id))
        .limit(1);

      if (!entry || (entry.branchId && entry.branchId !== branchId)) {
        throw new NotFoundException(`Entry with ID ${id} not found`);
      }
    }

    const [entry] = await db
      .select()
      .from(accountingEntries)
      .where(eq(accountingEntries.id, id))
      .limit(1);

    if (!entry) {
      throw new NotFoundException(`Entry with ID ${id} not found`);
    }

    return this.toEntryResponseDto(entry, true);
  }

  async createEntry(createEntryDto: CreateEntryDto): Promise<EntryResponseDto> {
    const lines = createEntryDto.lines;

    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException(
        `Entry lines must sum to zero. Total debit: ${totalDebit}, Total credit: ${totalCredit}`
      );
    }

    if (lines.length < 2) {
      throw new BadRequestException('Entry must have at least two lines');
    }

    for (const line of lines) {
      if (!line.accountId) {
        throw new BadRequestException('Each entry line must have an accountId');
      }

      const [account] = await db
        .select()
        .from(accountingAccounts)
        .where(eq(accountingAccounts.id, line.accountId))
        .limit(1);

      if (!account) {
        throw new BadRequestException(`Account with ID ${line.accountId} not found`);
      }
    }

    const [newEntry] = await db
      .insert(accountingEntries)
      .values({
        date: new Date(createEntryDto.date),
        description: createEntryDto.description,
        reference: createEntryDto.reference,
        branchId: createEntryDto.branchId,
        status: EntryStatus.POSTED,
        userId: createEntryDto.userId,
      })
      .returning();

    for (const line of lines) {
      await db.insert(accountingEntryLines).values({
        entryId: newEntry.id,
        accountId: line.accountId,
        debit: line.debit?.toString() || '0',
        credit: line.credit?.toString() || '0',
        description: line.description,
      });
    }

    return this.findOneEntry(newEntry.id);
  }

  async createEntryFromInvoice(invoiceId: string, userId?: string): Promise<EntryResponseDto> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    const map = await this.findBestAccountingMap(
      'INVOICE',
      invoice.type || 'SALE',
      invoice.branchId
    );

    if (!map) {
      throw new BadRequestException(
        `No accounting map found for invoice type ${invoice.type} in branch ${invoice.branchId}`
      );
    }

    const lines: CreateEntryLineDto[] = [];

    if (map.debitAccountId) {
      lines.push({
        accountId: map.debitAccountId,
        debit: Number(invoice.total),
        credit: 0,
        description: `Invoice ${invoice.code}`,
      });
    }

    if (map.creditAccountId) {
      lines.push({
        accountId: map.creditAccountId,
        debit: 0,
        credit: Number(invoice.total),
        description: `Invoice ${invoice.code}`,
      });
    }

    return this.createEntry({
      date: invoice.date ? new Date(invoice.date).toISOString() : new Date().toISOString(),
      description: `Invoice ${invoice.code}`,
      reference: invoice.invoiceNumber || invoice.code,
      branchId: invoice.branchId,
      userId: userId || invoice.userId,
      lines,
    });
  }

  async createEntryFromPayment(paymentId: string, userId?: string): Promise<EntryResponseDto> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    const map = await this.findBestAccountingMap(
      'PAYMENT',
      payment.type || 'INCOME',
      payment.branchId,
      payment.methodId
    );

    if (!map) {
      throw new BadRequestException(
        `No accounting map found for payment type ${payment.type} in branch ${payment.branchId}`
      );
    }

    return this.applyMapToPayment(map, payment, userId);
  }

  private async applyMapToPayment(
    map: typeof accountingMaps.$inferSelect,
    payment: typeof payments.$inferSelect,
    userId?: string
  ): Promise<EntryResponseDto> {
    const lines: CreateEntryLineDto[] = [];

    if (map.debitAccountId) {
      lines.push({
        accountId: map.debitAccountId,
        debit: Number(payment.amount),
        credit: 0,
        description: `Payment ${payment.code}`,
      });
    }

    if (map.creditAccountId) {
      lines.push({
        accountId: map.creditAccountId,
        debit: 0,
        credit: Number(payment.amount),
        description: `Payment ${payment.code}`,
      });
    }

    return this.createEntry({
      date: payment.date ? new Date(payment.date).toISOString() : new Date().toISOString(),
      description: `Payment ${payment.code}`,
      reference: payment.reference,
      branchId: payment.branchId,
      userId: userId || payment.userId,
      lines,
    });
  }

  private async findBestAccountingMap(
    module: string,
    transactionType: string,
    branchId: string,
    paymentMethodId?: string
  ): Promise<typeof accountingMaps.$inferSelect | null> {
    const isActive = eq(accountingMaps.isActive, true);
    const eqModule = eq(accountingMaps.module, module);
    const eqTransactionType = eq(accountingMaps.transactionType, transactionType);

    let maps = await db
      .select()
      .from(accountingMaps)
      .where(and(isActive, eqModule, eqTransactionType, eq(accountingMaps.branchId, branchId)));

    if (maps.length > 0) {
      return maps[0];
    }

    maps = await db
      .select()
      .from(accountingMaps)
      .where(and(isActive, eqModule, eqTransactionType, sql`${accountingMaps.branchId} is null`));

    if (maps.length > 0) {
      return maps[0];
    }

    if (paymentMethodId) {
      maps = await db
        .select()
        .from(accountingMaps)
        .where(
          and(
            isActive,
            eqModule,
            eqTransactionType,
            eq(accountingMaps.paymentMethodId, paymentMethodId)
          )
        );

      if (maps.length > 0) {
        return maps[0];
      }

      maps = await db
        .select()
        .from(accountingMaps)
        .where(
          and(isActive, eqModule, eqTransactionType, sql`${accountingMaps.paymentMethodId} is null`)
        );

      if (maps.length > 0) {
        return maps[0];
      }
    }

    return null;
  }

  async findAllMaps(filters?: { module?: string; branchId?: string }): Promise<MapResponseDto[]> {
    const conditions = [eq(accountingMaps.isActive, true)];

    if (filters?.module) {
      conditions.push(eq(accountingMaps.module, filters.module));
    }

    if (filters?.branchId) {
      conditions.push(eq(accountingMaps.branchId, filters.branchId));
    }

    const maps = await db
      .select()
      .from(accountingMaps)
      .where(and(...conditions));

    return Promise.all(maps.map(map => this.toMapResponseDto(map)));
  }

  async createMap(createMapDto: CreateMapDto): Promise<MapResponseDto> {
    const [newMap] = await db
      .insert(accountingMaps)
      .values({
        branchId: createMapDto.branchId,
        module: createMapDto.module,
        transactionType: createMapDto.transactionType,
        categoryId: createMapDto.categoryId,
        productId: createMapDto.productId,
        paymentMethodId: createMapDto.paymentMethodId,
        debitAccountId: createMapDto.debitAccountId,
        creditAccountId: createMapDto.creditAccountId,
        isActive: true,
      })
      .returning();

    return this.toMapResponseDto(newMap);
  }

  async applyMapToTransaction(
    mapId: string,
    transactionId: string
  ): Promise<AccountingMapApplyResponseDto> {
    const [map] = await db
      .select()
      .from(accountingMaps)
      .where(eq(accountingMaps.id, mapId))
      .limit(1);

    if (!map) {
      throw new NotFoundException(`Map with ID ${mapId} not found`);
    }

    let entry: EntryResponseDto;

    switch (map.module) {
      case 'INVOICE':
        entry = await this.createEntryFromInvoice(transactionId);
        break;
      case 'PAYMENT':
        entry = await this.createEntryFromPayment(transactionId);
        break;
      default:
        throw new BadRequestException(`Unsupported module: ${map.module}`);
    }

    return {
      success: true,
      entryId: entry.id,
      message: `Map applied successfully. Entry ${entry.id} created.`,
    };
  }

  private async toAccountResponseDto(
    account: typeof accountingAccounts.$inferSelect
  ): Promise<AccountResponseDto> {
    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type as AccountType,
      branchId: account.branchId,
      parentId: account.parentId,
      isActive: account.isActive ?? true,
    };
  }

  private async toEntryResponseDto(
    entry: typeof accountingEntries.$inferSelect,
    includeLines = false
  ): Promise<EntryResponseDto> {
    let branchName: string | null = null;
    let userName: string | null = null;

    if (entry.branchId) {
      const [branch] = await db
        .select()
        .from(branches)
        .where(eq(branches.id, entry.branchId))
        .limit(1);
      branchName = branch?.name || null;
    }

    if (entry.userId) {
      const [user] = await db.select().from(users).where(eq(users.id, entry.userId)).limit(1);
      userName = user?.name || null;
    }

    const lines = await db
      .select()
      .from(accountingEntryLines)
      .where(eq(accountingEntryLines.entryId, entry.id));

    const response: EntryResponseDto = {
      id: entry.id,
      date: entry.date,
      description: entry.description,
      reference: entry.reference,
      branchId: entry.branchId,
      branchName,
      status: entry.status as EntryStatus,
      userId: entry.userId,
      userName,
      createdAt: entry.createdAt,
      lines: [],
    };

    if (includeLines) {
      response.lines = await Promise.all(lines.map(line => this.toEntryLineResponseDto(line)));
    }

    return response;
  }

  private async toEntryLineResponseDto(
    line: typeof accountingEntryLines.$inferSelect
  ): Promise<EntryLineResponseDto> {
    let accountCode: string | null = null;
    let accountName: string | null = null;

    const [account] = await db
      .select()
      .from(accountingAccounts)
      .where(eq(accountingAccounts.id, line.accountId))
      .limit(1);

    if (account) {
      accountCode = account.code;
      accountName = account.name;
    }

    return {
      id: line.id,
      entryId: line.entryId,
      accountId: line.accountId,
      accountCode,
      accountName,
      debit: line.debit ? Number(line.debit) : 0,
      credit: line.credit ? Number(line.credit) : 0,
      description: line.description,
    };
  }

  private async toMapResponseDto(map: typeof accountingMaps.$inferSelect): Promise<MapResponseDto> {
    let debitAccountCode: string | null = null;
    let debitAccountName: string | null = null;
    let creditAccountCode: string | null = null;
    let creditAccountName: string | null = null;

    if (map.debitAccountId) {
      const [debitAccount] = await db
        .select()
        .from(accountingAccounts)
        .where(eq(accountingAccounts.id, map.debitAccountId))
        .limit(1);
      if (debitAccount) {
        debitAccountCode = debitAccount.code;
        debitAccountName = debitAccount.name;
      }
    }

    if (map.creditAccountId) {
      const [creditAccount] = await db
        .select()
        .from(accountingAccounts)
        .where(eq(accountingAccounts.id, map.creditAccountId))
        .limit(1);
      if (creditAccount) {
        creditAccountCode = creditAccount.code;
        creditAccountName = creditAccount.name;
      }
    }

    return {
      id: map.id,
      branchId: map.branchId,
      module: map.module,
      transactionType: map.transactionType,
      categoryId: map.categoryId,
      productId: map.productId,
      paymentMethodId: map.paymentMethodId,
      debitAccountId: map.debitAccountId,
      debitAccountCode,
      debitAccountName,
      creditAccountId: map.creditAccountId,
      creditAccountCode,
      creditAccountName,
      isActive: map.isActive ?? true,
      createdAt: map.createdAt,
    };
  }
}
