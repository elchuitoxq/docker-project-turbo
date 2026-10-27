import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { db } from '../../database';
import { MoneyService } from '../../common/money/money.service';
import { AuditService } from '../audit/audit.service';
import {
  accountingAccounts,
  accountingEntries,
  accountingEntryLines,
  accountingMaps,
  accountingPeriods,
  branches,
  companies,
  users,
  invoices,
  payments,
  currencies,
} from '../../schema';
import { eq, and, gte, lte, sql, or, asc } from 'drizzle-orm';
import {
  CreateAccountDto,
  UpdateAccountDto,
  AccountResponseDto,
  AccountTreeDto,
  CreateEntryDto,
  UpdateEntryDto,
  CreateEntryLineDto,
  EntryResponseDto,
  EntryLineResponseDto,
  CreateMapDto,
  MapResponseDto,
  AccountingMapApplyResponseDto,
  AccountType,
  EntryStatus,
  EntrySourceType,
  PeriodResponseDto,
  PeriodStatus,
} from './dto/accounting.dto';

@Injectable()
export class AccountingService {
  constructor(
    private readonly money: MoneyService = new MoneyService(),
    private readonly audit: AuditService = new AuditService()
  ) {}
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
        isPostable: account.isPostable,
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

    const parent = createAccountDto.parentId
      ? await this.findAccountOrFail(createAccountDto.parentId)
      : null;

    if (parent) {
      // Un árbol contable no mezcla naturalezas: la hija hereda el tipo de la madre.
      if (parent.type !== createAccountDto.type) {
        throw new BadRequestException(
          `La cuenta hija debe ser de tipo ${parent.type} como su cuenta madre`
        );
      }
      if (parent.branchId && parent.branchId !== createAccountDto.branchId) {
        throw new BadRequestException('La cuenta madre pertenece a otra sucursal');
      }
    }

    const [newAccount] = await db
      .insert(accountingAccounts)
      .values({
        code: createAccountDto.code,
        name: createAccountDto.name,
        type: createAccountDto.type,
        branchId: createAccountDto.branchId,
        parentId: createAccountDto.parentId,
        isPostable: createAccountDto.isPostable ?? true,
        isActive: true,
      })
      .returning();

    // Una cuenta con hijas deja de ser imputable: si no, el mayor sumaría dos veces el mismo saldo.
    if (parent && parent.isPostable) {
      await db
        .update(accountingAccounts)
        .set({ isPostable: false })
        .where(eq(accountingAccounts.id, parent.id));
    }

    return this.toAccountResponseDto(newAccount);
  }

  async updateAccount(id: string, dto: UpdateAccountDto): Promise<AccountResponseDto> {
    const account = await this.findAccountOrFail(id);
    const children = await this.countChildren(id);
    const movements = await this.countMovements(id);

    if (dto.type && dto.type !== account.type) {
      if (movements > 0) {
        throw new ConflictException(
          'No se puede cambiar el tipo de una cuenta con movimientos (regla 3 de S-04)'
        );
      }
      if (children > 0) {
        throw new ConflictException('No se puede cambiar el tipo de una cuenta con cuentas hijas');
      }
    }

    if (dto.isPostable === true && children > 0) {
      throw new ConflictException('Una cuenta con cuentas hijas no puede ser imputable');
    }

    if (dto.isPostable === false && movements > 0) {
      throw new ConflictException('Una cuenta con movimientos no puede dejar de ser imputable');
    }

    const parent = dto.parentId ? await this.findAccountOrFail(dto.parentId) : null;
    if (parent) {
      if (parent.id === id) {
        throw new BadRequestException('Una cuenta no puede ser su propia madre');
      }
      if (parent.type !== (dto.type ?? account.type)) {
        throw new BadRequestException(
          `La cuenta hija debe ser de tipo ${parent.type} como su cuenta madre`
        );
      }
      await this.assertNotDescendant(id, parent.id);
    }

    const [updated] = await db
      .update(accountingAccounts)
      .set({
        name: dto.name ?? account.name,
        type: dto.type ?? account.type,
        parentId: dto.parentId === undefined ? account.parentId : dto.parentId,
        isPostable: dto.isPostable ?? account.isPostable,
        isActive: dto.isActive ?? account.isActive,
      })
      .where(eq(accountingAccounts.id, id))
      .returning();

    return this.toAccountResponseDto(updated);
  }

  /**
   * Baja de una cuenta: `409` si tiene movimientos o hijas, para no dejar asientos apuntando a una
   * cuenta inexistente (T-04-01). Si está limpia se desactiva, nunca se borra la fila.
   */
  async deleteAccount(id: string): Promise<{ deleted: true; deactivated: true }> {
    await this.findAccountOrFail(id);

    if ((await this.countChildren(id)) > 0) {
      throw new ConflictException('La cuenta tiene cuentas hijas: no se puede eliminar');
    }
    if ((await this.countMovements(id)) > 0) {
      throw new ConflictException('La cuenta tiene movimientos: no se puede eliminar');
    }

    await db
      .update(accountingAccounts)
      .set({ isActive: false })
      .where(eq(accountingAccounts.id, id));

    return { deleted: true, deactivated: true };
  }

  private async findAccountOrFail(id: string) {
    const [account] = await db
      .select()
      .from(accountingAccounts)
      .where(eq(accountingAccounts.id, id))
      .limit(1);

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return account;
  }

  private async countChildren(parentId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountingAccounts)
      .where(eq(accountingAccounts.parentId, parentId));

    return row?.count ?? 0;
  }

  private async countMovements(accountId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(accountingEntryLines)
      .where(eq(accountingEntryLines.accountId, accountId));

    return row?.count ?? 0;
  }

  /** Evita ciclos: la nueva madre no puede ser descendiente de la cuenta que se mueve. */
  private async assertNotDescendant(accountId: string, candidateParentId: string): Promise<void> {
    let current: string | null = candidateParentId;
    const seen = new Set<string>();

    while (current) {
      if (current === accountId) {
        throw new BadRequestException(
          'La jerarquía no puede ser circular: la cuenta madre es descendiente de esta cuenta'
        );
      }
      if (seen.has(current)) break;
      seen.add(current);

      const [parent] = await db
        .select({ parentId: accountingAccounts.parentId })
        .from(accountingAccounts)
        .where(eq(accountingAccounts.id, current))
        .limit(1);

      current = parent?.parentId ?? null;
    }
  }

  async findAllEntries(filters: {
    dateFrom?: string;
    dateTo?: string;
    accountId?: string;
    branchId?: string;
    sourceType?: string;
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

    if (filters.sourceType) {
      conditions.push(eq(accountingEntries.sourceType, filters.sourceType));
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

  /** Moneda funcional del libro (VES, decision D-01). */
  private async getBaseCurrencyId(): Promise<string | null> {
    const [base] = await db
      .select({ id: currencies.id })
      .from(currencies)
      .where(eq(currencies.isBase, true))
      .limit(1);

    return base?.id ?? null;
  }

  // ── Cierre de período (T-04-04) ─────────────────────────────────────────────────────────────

  private async resolveCompanyId(branchId?: string): Promise<string> {
    if (branchId) {
      const [branch] = await db
        .select({ companyId: branches.companyId })
        .from(branches)
        .where(eq(branches.id, branchId))
        .limit(1);

      if (!branch) {
        throw new NotFoundException(`Branch ${branchId} not found`);
      }
      return branch.companyId;
    }

    const [company] = await db.select({ id: companies.id }).from(companies).limit(1);
    if (!company) {
      throw new NotFoundException('No company configured');
    }
    return company.id;
  }

  /**
   * Los períodos son de la **empresa**, no de la sucursal: cerrar octubre cierra octubre para todas
   * las sucursales, que es lo que exige un libro único.
   */
  async listPeriods(year: number, branchId?: string): Promise<PeriodResponseDto[]> {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('El año del período debe estar entre 2000 y 2100');
    }

    const companyId = await this.resolveCompanyId(branchId);
    await this.ensurePeriods(companyId, year);

    const rows = await db
      .select()
      .from(accountingPeriods)
      .where(and(eq(accountingPeriods.companyId, companyId), eq(accountingPeriods.year, year)))
      .orderBy(asc(accountingPeriods.month));

    const summaries = await this.periodSummaries(year, branchId);

    return rows.map(row => ({
      ...this.toPeriodResponse(row),
      ...(summaries.get(row.month) ?? {}),
    }));
  }

  async closePeriod(id: string, userId?: string, branchId?: string): Promise<PeriodResponseDto> {
    const period = await this.findPeriodOrFail(id);

    if (period.status === PeriodStatus.CLOSED) {
      throw new ConflictException(`El período ${period.year}-${period.month} ya está cerrado`);
    }

    const [updated] = await db
      .update(accountingPeriods)
      .set({ status: PeriodStatus.CLOSED, closedAt: new Date(), closedBy: userId ?? null })
      .where(eq(accountingPeriods.id, id))
      .returning();

    await this.audit.record({
      entityTable: 'accounting_periods',
      entityId: id,
      action: 'CLOSE',
      branchId: branchId ?? null,
      userId: userId ?? null,
      description: `Cierre del período ${period.year}-${String(period.month).padStart(2, '0')}`,
    });

    return this.toPeriodResponse(updated);
  }

  async reopenPeriod(
    id: string,
    reason: string,
    userId?: string,
    branchId?: string
  ): Promise<PeriodResponseDto> {
    const cleanReason = (reason ?? '').trim();
    if (!cleanReason) {
      throw new BadRequestException('Reabrir un período exige un motivo');
    }

    const period = await this.findPeriodOrFail(id);

    if (period.status === PeriodStatus.OPEN) {
      throw new ConflictException(`El período ${period.year}-${period.month} ya está abierto`);
    }

    const [updated] = await db
      .update(accountingPeriods)
      .set({
        status: PeriodStatus.OPEN,
        reopenedAt: new Date(),
        reopenedBy: userId ?? null,
        reopenReason: cleanReason,
      })
      .where(eq(accountingPeriods.id, id))
      .returning();

    await this.audit.record({
      entityTable: 'accounting_periods',
      entityId: id,
      action: 'REOPEN',
      branchId: branchId ?? null,
      userId: userId ?? null,
      changes: { reason: cleanReason, closedAt: period.closedAt },
      description: `Reapertura del período ${period.year}-${String(period.month).padStart(2, '0')}`,
    });

    return this.toPeriodResponse(updated);
  }

  /** Materializa los 12 meses del año; los que faltan nacen `OPEN`. Idempotente. */
  private async ensurePeriods(companyId: string, year: number): Promise<void> {
    const rows = await db
      .select({ month: accountingPeriods.month })
      .from(accountingPeriods)
      .where(and(eq(accountingPeriods.companyId, companyId), eq(accountingPeriods.year, year)));

    const existing = new Set(rows.map(row => row.month));
    const missing = Array.from({ length: 12 }, (_, i) => i + 1).filter(m => !existing.has(m));

    if (missing.length === 0) return;

    await db
      .insert(accountingPeriods)
      .values(
        missing.map(month => ({ companyId, year, month, status: PeriodStatus.OPEN as string }))
      )
      .onConflictDoNothing();
  }

  /** Asientos, débitos y créditos posteados por mes (sólo `POSTED`). */
  private async periodSummaries(
    year: number,
    branchId?: string
  ): Promise<Map<number, { entries: number; totalDebit: number; totalCredit: number }>> {
    const conditions = [
      eq(accountingEntries.status, EntryStatus.POSTED),
      sql`extract(year from ${accountingEntries.date}) = ${year}`,
    ];
    if (branchId) {
      conditions.push(eq(accountingEntries.branchId, branchId));
    }

    const rows = await db
      .select({
        month: sql<number>`extract(month from ${accountingEntries.date})::int`,
        entries: sql<number>`count(distinct ${accountingEntries.id})::int`,
        totalDebit: sql<string>`coalesce(sum(${accountingEntryLines.debit}), 0)`,
        totalCredit: sql<string>`coalesce(sum(${accountingEntryLines.credit}), 0)`,
      })
      .from(accountingEntries)
      .leftJoin(accountingEntryLines, eq(accountingEntryLines.entryId, accountingEntries.id))
      .where(and(...conditions))
      .groupBy(sql`extract(month from ${accountingEntries.date})`);

    return new Map(
      rows.map(row => [
        Number(row.month),
        {
          entries: Number(row.entries),
          totalDebit: Number(row.totalDebit),
          totalCredit: Number(row.totalCredit),
        },
      ])
    );
  }

  /** `409` si la fecha cae en un período cerrado. Es la regla 2 de `S-04`. */
  async assertPeriodOpen(date: Date, branchId?: string): Promise<void> {
    const companyId = await this.resolveCompanyId(branchId);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;

    const [period] = await db
      .select({ status: accountingPeriods.status })
      .from(accountingPeriods)
      .where(
        and(
          eq(accountingPeriods.companyId, companyId),
          eq(accountingPeriods.year, year),
          eq(accountingPeriods.month, month)
        )
      )
      .limit(1);

    if (period?.status === PeriodStatus.CLOSED) {
      throw new ConflictException(
        `El período ${year}-${String(month).padStart(2, '0')} está cerrado: no admite asientos`
      );
    }
  }

  private async findPeriodOrFail(id: string) {
    const [period] = await db
      .select()
      .from(accountingPeriods)
      .where(eq(accountingPeriods.id, id))
      .limit(1);

    if (!period) {
      throw new NotFoundException(`Period with ID ${id} not found`);
    }

    return period;
  }

  private toPeriodResponse(row: typeof accountingPeriods.$inferSelect): PeriodResponseDto {
    return {
      id: row.id,
      year: row.year,
      month: row.month,
      status: row.status as PeriodStatus,
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      closedBy: row.closedBy,
      reopenedAt: row.reopenedAt ? row.reopenedAt.toISOString() : null,
      reopenReason: row.reopenReason,
    };
  }

  async createEntry(createEntryDto: CreateEntryDto): Promise<EntryResponseDto> {
    const lines = createEntryDto.lines;
    const status = createEntryDto.status ?? EntryStatus.POSTED;

    this.assertBalanced(lines);
    await this.assertPostableLines(lines);

    // `DRAFT` no toca el libro: se puede guardar descuadrado? No: la partida doble se exige siempre,
    // pero un borrador no entra en reportes ni en el cierre del período (regla 6 de S-04).
    if (status === EntryStatus.POSTED) {
      await this.assertPeriodOpen(new Date(createEntryDto.date), createEntryDto.branchId);
    }

    const [newEntry] = await db
      .insert(accountingEntries)
      .values({
        date: new Date(createEntryDto.date),
        description: createEntryDto.description,
        reference: createEntryDto.reference,
        branchId: createEntryDto.branchId,
        status,
        sourceType: createEntryDto.sourceType ?? null,
        sourceId: createEntryDto.sourceId ?? null,
        postedAt: status === EntryStatus.POSTED ? new Date() : null,
        postedBy: status === EntryStatus.POSTED ? (createEntryDto.userId ?? null) : null,
        baseCurrencyId: await this.getBaseCurrencyId(),
        exchangeRate: '1',
        userId: createEntryDto.userId,
      })
      .returning();

    await this.insertLines(newEntry.id, lines);

    return this.findOneEntry(newEntry.id);
  }

  /** `DRAFT → POSTED`. Un asiento ya posteado no se vuelve a postear (T-04-02). */
  async postEntry(id: string, userId?: string): Promise<EntryResponseDto> {
    const entry = await this.findEntryOrFail(id);

    if (entry.status === EntryStatus.POSTED) {
      throw new ConflictException(`El asiento ${entry.reference ?? id} ya está posteado`);
    }
    if (entry.status === EntryStatus.CANCELLED) {
      throw new ConflictException('Un asiento anulado no se puede postear');
    }

    const lines = await db
      .select()
      .from(accountingEntryLines)
      .where(eq(accountingEntryLines.entryId, id));

    const asLines: CreateEntryLineDto[] = lines.map(line => ({
      accountId: line.accountId,
      debit: Number(line.debit ?? 0),
      credit: Number(line.credit ?? 0),
    }));

    this.assertBalanced(asLines);
    await this.assertPostableLines(asLines);
    await this.assertPeriodOpen(entry.date ?? new Date(), entry.branchId ?? undefined);

    await db
      .update(accountingEntries)
      .set({ status: EntryStatus.POSTED, postedAt: new Date(), postedBy: userId ?? null })
      .where(eq(accountingEntries.id, id));

    return this.findOneEntry(id);
  }

  /** Sólo un borrador se edita; reemplaza cabecera y líneas (T-04-02). */
  async updateEntry(id: string, dto: UpdateEntryDto): Promise<EntryResponseDto> {
    const entry = await this.findEntryOrFail(id);

    if (entry.status !== EntryStatus.DRAFT) {
      throw new ConflictException('Sólo se puede editar un asiento en borrador');
    }

    if (dto.lines) {
      this.assertBalanced(dto.lines);
      await this.assertPostableLines(dto.lines);
    }

    await db
      .update(accountingEntries)
      .set({
        date: dto.date ? new Date(dto.date) : entry.date,
        description: dto.description ?? entry.description,
        reference: dto.reference === undefined ? entry.reference : dto.reference,
      })
      .where(eq(accountingEntries.id, id));

    if (dto.lines) {
      await db.delete(accountingEntryLines).where(eq(accountingEntryLines.entryId, id));
      await this.insertLines(id, dto.lines);
    }

    return this.findOneEntry(id);
  }

  private assertBalanced(lines: CreateEntryLineDto[]): void {
    if (lines.length < 2) {
      throw new BadRequestException('Entry must have at least two lines');
    }

    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException(
        `Entry lines must sum to zero. Total debit: ${totalDebit}, Total credit: ${totalCredit}`
      );
    }
  }

  private async assertPostableLines(lines: CreateEntryLineDto[]): Promise<void> {
    for (const line of lines) {
      if (!line.accountId) {
        throw new BadRequestException('Each entry line must have an accountId');
      }

      const account = await this.findAccountOrFail(line.accountId);

      if (!account.isActive) {
        throw new BadRequestException(`La cuenta ${account.code} está desactivada`);
      }
      if (!account.isPostable) {
        throw new BadRequestException(
          `La cuenta ${account.code} no es imputable: use una de sus cuentas hijas`
        );
      }
    }
  }

  private async insertLines(entryId: string, lines: CreateEntryLineDto[]): Promise<void> {
    for (const line of lines) {
      await db.insert(accountingEntryLines).values({
        entryId,
        accountId: line.accountId,
        debit: line.debit?.toString() || '0',
        credit: line.credit?.toString() || '0',
        originalAmount: line.originalAmount != null ? line.originalAmount.toString() : null,
        originalCurrencyId: line.originalCurrencyId ?? null,
        description: line.description,
      });
    }
  }

  private async findEntryOrFail(id: string) {
    const [entry] = await db
      .select()
      .from(accountingEntries)
      .where(eq(accountingEntries.id, id))
      .limit(1);

    if (!entry) {
      throw new NotFoundException(`Entry with ID ${id} not found`);
    }

    return entry;
  }

  private async findEntryBySource(
    sourceType: string,
    sourceId: string
  ): Promise<EntryResponseDto | null> {
    const [entry] = await db
      .select()
      .from(accountingEntries)
      .where(
        and(eq(accountingEntries.sourceType, sourceType), eq(accountingEntries.sourceId, sourceId))
      )
      .limit(1);

    return entry ? this.toEntryResponseDto(entry, true) : null;
  }

  async createEntryFromInvoice(invoiceId: string, userId?: string): Promise<EntryResponseDto> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);
    }

    // Regla 4 de `S-04`: reintentar la generación no duplica el asiento.
    const existing = await this.findEntryBySource('INVOICE', invoiceId);
    if (existing) return existing;

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

    // El libro va en moneda funcional: se convierte con la tasa del documento (M3).
    const rate = invoice.exchangeRate ? Number(invoice.exchangeRate) : 1;
    const baseTotal = Number(this.money.round(this.money.toBase(invoice.total ?? 0, rate)));
    const originalAmount = Number(invoice.total ?? 0);

    const lines: CreateEntryLineDto[] = [];

    if (map.debitAccountId) {
      lines.push({
        accountId: map.debitAccountId,
        debit: baseTotal,
        credit: 0,
        description: `Invoice ${invoice.code}`,
        originalAmount,
        originalCurrencyId: invoice.currencyId,
      });
    }

    if (map.creditAccountId) {
      lines.push({
        accountId: map.creditAccountId,
        debit: 0,
        credit: baseTotal,
        description: `Invoice ${invoice.code}`,
        originalAmount,
        originalCurrencyId: invoice.currencyId,
      });
    }

    return this.createEntry({
      date: invoice.date ? new Date(invoice.date).toISOString() : new Date().toISOString(),
      description: `Invoice ${invoice.code}`,
      reference: invoice.invoiceNumber || invoice.code,
      branchId: invoice.branchId,
      userId: userId || invoice.userId,
      sourceType: EntrySourceType.INVOICE,
      sourceId: invoice.id,
      lines,
    });
  }

  async createEntryFromPayment(paymentId: string, userId?: string): Promise<EntryResponseDto> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    // Regla 4 de `S-04`: reintentar la generación no duplica el asiento.
    const existing = await this.findEntryBySource('PAYMENT', paymentId);
    if (existing) return existing;

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
    // Se usa el monto ya convertido del pago (amountBase) para no recalcular con otra tasa.
    const rate = payment.exchangeRate ? Number(payment.exchangeRate) : 1;
    const baseTotal = Number(
      this.money.round(payment.amountBase ?? this.money.toBase(payment.amount ?? 0, rate))
    );
    const originalAmount = Number(payment.amount ?? 0);

    const lines: CreateEntryLineDto[] = [];

    if (map.debitAccountId) {
      lines.push({
        accountId: map.debitAccountId,
        debit: baseTotal,
        credit: 0,
        description: `Payment ${payment.code}`,
        originalAmount,
        originalCurrencyId: payment.currencyId,
      });
    }

    if (map.creditAccountId) {
      lines.push({
        accountId: map.creditAccountId,
        debit: 0,
        credit: baseTotal,
        description: `Payment ${payment.code}`,
        originalAmount,
        originalCurrencyId: payment.currencyId,
      });
    }

    return this.createEntry({
      date: payment.date ? new Date(payment.date).toISOString() : new Date().toISOString(),
      description: `Payment ${payment.code}`,
      reference: payment.reference,
      branchId: payment.branchId,
      userId: userId || payment.userId,
      sourceType: EntrySourceType.PAYMENT,
      sourceId: payment.id,
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
      isPostable: account.isPostable,
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
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      postedAt: entry.postedAt,
      baseCurrencyId: entry.baseCurrencyId,
      exchangeRate: entry.exchangeRate ? Number(entry.exchangeRate) : 1,
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
