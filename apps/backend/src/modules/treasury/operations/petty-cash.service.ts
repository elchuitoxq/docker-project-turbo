import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../../database';
import { pettyCashFunds, pettyCashMovements } from '../../../schema';
import type {
  CreatePettyCashFundDto,
  CreatePettyCashMovementDto,
  PettyCashFundResponseDto,
} from '../dto/treasury-operations.dto';
import { DailyCloseService } from './daily-close.service';

/**
 * Caja chica de fondo fijo (`T-05-07`).
 *
 * Reglas de `S-05`: el fondo nunca queda negativo, la reposición se registra como movimiento propio
 * y cerrar el fondo exige devolver el saldo. Los gastos y reposiciones no se pueden registrar en un
 * día cerrado.
 */
@Injectable()
export class PettyCashService {
  constructor(private readonly dailyClose: DailyCloseService = new DailyCloseService()) {}

  async list(branchId: string): Promise<PettyCashFundResponseDto[]> {
    const funds = await db
      .select()
      .from(pettyCashFunds)
      .where(eq(pettyCashFunds.branchId, branchId))
      .orderBy(asc(pettyCashFunds.createdAt));

    const result: PettyCashFundResponseDto[] = [];
    for (const fund of funds) {
      result.push(await this.toDto(fund));
    }

    return result;
  }

  async findOne(branchId: string, fundId: string): Promise<PettyCashFundResponseDto> {
    const [fund] = await db
      .select()
      .from(pettyCashFunds)
      .where(eq(pettyCashFunds.id, fundId))
      .limit(1);

    if (!fund || fund.branchId !== branchId) {
      throw new NotFoundException(`Fondo de caja chica ${fundId} no encontrado`);
    }

    return this.toDto(fund);
  }

  async create(branchId: string, dto: CreatePettyCashFundDto): Promise<PettyCashFundResponseDto> {
    const [fund] = await db
      .insert(pettyCashFunds)
      .values({
        branchId,
        name: dto.name,
        currencyId: dto.currencyId,
        amount: String(dto.amount),
        // El fondo nace con el monto asignado disponible.
        balance: String(dto.amount),
        responsibleUserId: dto.responsibleUserId ?? null,
      })
      .returning();

    return this.toDto(fund);
  }

  /** Registra un gasto o una reposición; valida que el fondo no quede negativo. */
  async addMovement(
    branchId: string,
    fundId: string,
    dto: CreatePettyCashMovementDto,
    userId: string | null
  ): Promise<PettyCashFundResponseDto> {
    const [fund] = await db
      .select()
      .from(pettyCashFunds)
      .where(eq(pettyCashFunds.id, fundId))
      .limit(1);

    if (!fund || fund.branchId !== branchId) {
      throw new NotFoundException(`Fondo de caja chica ${fundId} no encontrado`);
    }
    if (fund.status === 'CLOSED') {
      throw new ConflictException('El fondo está cerrado');
    }

    const key = this.dailyClose.normalizeDate(dto.date);
    await this.dailyClose.assertOpen(branchId, key);

    const current = Number(fund.balance);
    const amount = Number(dto.amount);
    const next = dto.type === 'EXPENSE' ? current - amount : current + amount;

    if (next < -0.001) {
      throw new BadRequestException(
        `El fondo no puede quedar negativo: saldo ${current} y gasto ${amount}`
      );
    }

    await db.transaction(async tx => {
      await tx.insert(pettyCashMovements).values({
        fundId,
        date: key,
        type: dto.type,
        amount: String(amount),
        description: dto.description ?? null,
        receiptNumber: dto.receiptNumber ?? null,
        userId,
      });

      await tx
        .update(pettyCashFunds)
        .set({ balance: String(this.round(next)), updatedAt: new Date() })
        .where(eq(pettyCashFunds.id, fundId));
    });

    return this.findOne(branchId, fundId);
  }

  /** Cierra el fondo: exige saldo cero o devolución registrada. */
  async close(
    branchId: string,
    fundId: string,
    userId: string | null,
    input: { returnedAmount?: number; notes?: string } = {}
  ): Promise<PettyCashFundResponseDto> {
    const [fund] = await db
      .select()
      .from(pettyCashFunds)
      .where(eq(pettyCashFunds.id, fundId))
      .limit(1);

    if (!fund || fund.branchId !== branchId) {
      throw new NotFoundException(`Fondo de caja chica ${fundId} no encontrado`);
    }
    if (fund.status === 'CLOSED') {
      throw new ConflictException('El fondo ya está cerrado');
    }

    const balance = Number(fund.balance);
    const returned = Number(input.returnedAmount ?? 0);

    if (Math.abs(balance - returned) > 0.001) {
      throw new BadRequestException(
        `Para cerrar el fondo hay que devolver el saldo completo (${balance})`
      );
    }

    await db.transaction(async tx => {
      if (returned > 0) {
        await tx.insert(pettyCashMovements).values({
          fundId,
          date: new Date().toISOString().slice(0, 10),
          type: 'RETURN',
          amount: String(returned),
          description: input.notes ?? 'Devolución del saldo al cerrar el fondo',
          userId,
        });
      }

      await tx
        .update(pettyCashFunds)
        .set({ balance: '0', status: 'CLOSED', closedAt: new Date(), updatedAt: new Date() })
        .where(eq(pettyCashFunds.id, fundId));
    });

    return this.findOne(branchId, fundId);
  }

  private async toDto(fund: typeof pettyCashFunds.$inferSelect): Promise<PettyCashFundResponseDto> {
    const movements = await db
      .select()
      .from(pettyCashMovements)
      .where(eq(pettyCashMovements.fundId, fund.id))
      .orderBy(asc(pettyCashMovements.date));

    let spentSinceReplenishment = 0;
    let replenishments = 0;

    for (const movement of movements) {
      if (movement.type === 'EXPENSE') spentSinceReplenishment += Number(movement.amount);
      if (movement.type === 'REPLENISHMENT') {
        replenishments += 1;
        spentSinceReplenishment = 0;
      }
    }

    return {
      id: fund.id,
      name: fund.name,
      currencyId: fund.currencyId,
      amount: Number(fund.amount),
      balance: Number(fund.balance),
      status: fund.status as 'OPEN' | 'CLOSED',
      responsibleUserId: fund.responsibleUserId,
      movements: movements.map(movement => ({
        id: movement.id,
        date: movement.date,
        type: movement.type as 'EXPENSE' | 'REPLENISHMENT',
        amount: Number(movement.amount),
        description: movement.description,
        receiptNumber: movement.receiptNumber,
      })),
      spentSinceReplenishment: this.round(spentSinceReplenishment),
      replenishments,
    };
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
