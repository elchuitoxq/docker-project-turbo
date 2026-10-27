import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { db } from '../../../database';
import {
  employees,
  departments,
  jobPositions,
  payrollRuns,
  payrollItems,
  payrollItemLines,
  payrollSettings,
  payrollPeriodSettings,
  payrollConceptTypes,
  payrollIncidents,
  employeeContracts,
  employeeBenefits,
  employeeVacations,
  employeeProfitSharing,
  employeeSalaryHistory,
  employeeBankAccounts,
  banks,
  branches,
  companies,
  currencies,
} from '../../../schema';
import { eq, and, desc, isNull, like, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import { ConfigService } from '@nestjs/config';
import { extractIdentifiers, validateConceptExpression } from '../payroll/concept-expression';
import { resolvePayrollSettings, validateSettingValue } from '../payroll/settings-resolver';
import {
  ConceptDefinition,
  PayrollCalculator,
  PayrollItemCalculation,
} from '../payroll/payroll.calculator';
import {
  BenefitSettings,
  DEFAULT_BENEFIT_SETTINGS,
  LaborBenefits,
} from '../payroll/labor-benefits';
import { CurrencyConverter, PayrollSettingRow } from '../payroll/payroll.types';
import { ExchangeRateService } from '../../settings/currencies/exchange-rate.service';
import { MoneyService } from '../../../common/money/money.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  EmployeeResponseDto,
  CreateDepartmentDto,
  CreatePositionDto,
  CreatePayrollRunDto,
  PayrollRunResponseDto,
  CreateIncidentDto,
  PayslipDto,
  PayrollRunStatus,
  EmployeeStatus,
  EmployeeBankAccountDto,
  UpdatePayrollSettingDto,
  PayrollSettingResponseDto,
  CreatePayrollConceptDto,
  UpdatePayrollConceptDto,
  PayrollConceptResponseDto,
  PayrollConceptKind,
  VacationSummaryDto,
  BenefitsSummaryDto,
  RegisterVacationDto,
  DepositBenefitDto,
  RegisterProfitSharingDto,
} from '../dto/hr.dto';

@Injectable()
export class HrService {
  constructor(
    private readonly calculator: PayrollCalculator = new PayrollCalculator(),
    private readonly exchangeRate: ExchangeRateService = new ExchangeRateService(
      new ConfigService()
    ),
    private readonly benefits: LaborBenefits = new LaborBenefits()
  ) {}

  async findAllEmployees(branchId?: string): Promise<EmployeeResponseDto[]> {
    const conditions = branchId ? [eq(employees.branchId, branchId)] : [];
    const allEmployees =
      conditions.length > 0
        ? await db
            .select()
            .from(employees)
            .where(and(...conditions))
        : await db.select().from(employees);

    return this.mapEmployeesWithRelations(allEmployees);
  }

  async findOneEmployee(id: string, branchId?: string): Promise<EmployeeResponseDto> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);

    // R2: empleado de otra sucursal -> 404. `employees.branch_id` es nullable, asi que
    // los registros historicos sin sucursal siguen siendo legibles.
    if (!employee || (branchId && employee.branchId && employee.branchId !== branchId)) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return (await this.mapEmployeesWithRelations([employee]))[0];
  }

  /** Egreso del empleado (T-01-01). */
  async terminateEmployee(
    id: string,
    dto: { date: string; reason?: string; cause?: string },
    branchId?: string
  ): Promise<EmployeeResponseDto> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);

    if (!employee || (branchId && employee.branchId && employee.branchId !== branchId)) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    if (employee.status === 'TERMINATED') {
      throw new ConflictException('Employee is already terminated');
    }

    await db
      .update(employees)
      .set({
        status: 'TERMINATED',
        terminationDate: new Date(dto.date),
        terminationReason: dto.cause ?? dto.reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(employees.id, id));

    return this.findOneEmployee(id);
  }

  /** EdiciÃƒÂ³n de departamento (T-01-02). */
  async updateDepartment(
    id: string,
    dto: { name?: string; parentId?: string | null }
  ): Promise<typeof departments.$inferSelect> {
    const [department] = await db.select().from(departments).where(eq(departments.id, id)).limit(1);

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    const [updated] = await db
      .update(departments)
      .set({
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      })
      .where(eq(departments.id, id))
      .returning();

    return updated;
  }

  /** EdiciÃƒÂ³n de cargo (T-01-03). */
  async updatePosition(
    id: string,
    dto: { name?: string; description?: string; baseSalaryMin?: number; baseSalaryMax?: number }
  ): Promise<typeof jobPositions.$inferSelect> {
    const [position] = await db.select().from(jobPositions).where(eq(jobPositions.id, id)).limit(1);

    if (!position) {
      throw new NotFoundException(`Position with ID ${id} not found`);
    }

    const [updated] = await db
      .update(jobPositions)
      .set({
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.baseSalaryMin !== undefined ? { baseSalaryMin: String(dto.baseSalaryMin) } : {}),
        ...(dto.baseSalaryMax !== undefined ? { baseSalaryMax: String(dto.baseSalaryMax) } : {}),
      })
      .where(eq(jobPositions.id, id))
      .returning();

    return updated;
  }

  /** AprobaciÃƒÂ³n o rechazo de una incidencia (T-01-04). SÃƒÂ³lo desde PENDING. */
  async setIncidentStatus(id: string, status: 'APPROVED' | 'REJECTED'): Promise<unknown> {
    const [incident] = await db
      .select()
      .from(payrollIncidents)
      .where(eq(payrollIncidents.id, id))
      .limit(1);

    if (!incident) {
      throw new NotFoundException(`Incident with ID ${id} not found`);
    }

    if (incident.status !== 'PENDING') {
      throw new ConflictException(`Incident is already ${incident.status}`);
    }

    const [updated] = await db
      .update(payrollIncidents)
      .set({ status })
      .where(eq(payrollIncidents.id, id))
      .returning();

    return updated;
  }

  /** ParÃƒÂ¡metros de nÃƒÂ³mina vigentes (T-01-07). */
  async findPayrollSettings(
    branchId?: string,
    asOf?: string
  ): Promise<PayrollSettingResponseDto[]> {
    const companyId = await this.resolveCompanyId(branchId);
    const rows = await db
      .select()
      .from(payrollSettings)
      .where(eq(payrollSettings.companyId, companyId));

    // T-02-01: se devuelve un valor por clave, el vigente a la fecha consultada, resolviendo
    // precedencia sucursal > empresa. Antes se devolvÃ­an todas las filas activas.
    const resolved = resolvePayrollSettings(rows, {
      asOf: asOf ? new Date(asOf) : new Date(),
      branchId,
    });

    return resolved.map(row => this.toSettingResponse(row));
  }

  /** Alta o actualizaciÃƒÂ³n de un parÃƒÂ¡metro de nÃƒÂ³mina (T-01-07). */
  async upsertPayrollSetting(
    dto: UpdatePayrollSettingDto,
    branchId?: string
  ): Promise<PayrollSettingResponseDto> {
    const companyId = await this.resolveCompanyId(branchId);
    const effectiveFrom = this.normalizeEffectiveDate(dto.effectiveFrom);
    const type = dto.type ?? (await this.findSettingType(companyId, dto.key));

    const valueError = validateSettingValue(type, dto.value);
    if (valueError) throw new BadRequestException(valueError);

    // Se busca la vigencia exacta (empresa + clave + fecha + sucursal): reprogramar el mismo dÃ­a
    // actualiza el valor en lugar de acumular filas duplicadas para la misma fecha.
    const [existing] = await db
      .select()
      .from(payrollSettings)
      .where(
        and(
          eq(payrollSettings.companyId, companyId),
          eq(payrollSettings.key, dto.key),
          eq(payrollSettings.effectiveFrom, effectiveFrom),
          branchId ? eq(payrollSettings.branchId, branchId) : isNull(payrollSettings.branchId)
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(payrollSettings)
        .set({
          value: String(dto.value),
          label: dto.label ?? existing.label,
          type,
          updatedAt: new Date(),
        })
        .where(eq(payrollSettings.id, existing.id))
        .returning();

      return this.toSettingResponse(updated);
    }

    const [created] = await db
      .insert(payrollSettings)
      .values({
        id: uuidv4(),
        companyId,
        key: dto.key,
        label: dto.label ?? dto.key,
        value: String(dto.value),
        type,
        branchId: branchId ?? null,
        effectiveFrom,
        isActive: true,
      })
      .returning();

    return this.toSettingResponse(created);
  }

  /** ParÃ¡metros congelados del run: es la prueba de que un perÃ­odo cerrado no cambia (RN-22). */
  async getPayrollRunParameters(runId: string): Promise<PayrollSettingResponseDto[]> {
    const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, runId)).limit(1);
    if (!run) throw new NotFoundException(`Payroll run ${runId} not found`);

    const companyId = await this.resolveCompanyId(run.branchId);
    const rows = await db
      .select()
      .from(payrollPeriodSettings)
      .where(eq(payrollPeriodSettings.runId, runId));

    return rows
      .map(row => ({
        id: row.id,
        companyId,
        key: row.key,
        label: row.label,
        value: Number(row.value),
        type: row.type,
        branchId: row.branchId,
        effectiveFrom: row.effectiveFrom.toISOString(),
        isActive: true,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  /**
   * Congela los parÃ¡metros vigentes al cierre del perÃ­odo dentro del run (`T-02-01`).
   * Si no hay parÃ¡metros cargados el run se crea igual: la validaciÃ³n de parÃ¡metros obligatorios
   * pertenece al motor de cÃ¡lculo (T-02-03), no a la creaciÃ³n del run.
   */
  private async snapshotPayrollSettings(
    runId: string,
    companyId: string,
    branchId: string,
    asOf: Date,
    executor: Pick<typeof db, 'select' | 'insert'> = db
  ): Promise<void> {
    const rows = await executor
      .select()
      .from(payrollSettings)
      .where(eq(payrollSettings.companyId, companyId));

    const resolved = resolvePayrollSettings(rows, { asOf, branchId });
    if (resolved.length === 0) return;

    await executor.insert(payrollPeriodSettings).values(
      resolved.map(row => ({
        id: uuidv4(),
        runId,
        key: row.key,
        label: row.label,
        value: row.value,
        type: row.type,
        branchId: row.branchId,
        effectiveFrom: row.effectiveFrom,
      }))
    );
  }

  /** Siguiente cÃ³digo de nÃ³mina. Global, porque `payroll_runs.code` es Ãºnico a nivel de tabla. */
  private async getNextPayrollRunCode(executor: Pick<typeof db, 'select'> = db): Promise<string> {
    const existing = await executor
      .select({ code: payrollRuns.code })
      .from(payrollRuns)
      .where(like(payrollRuns.code, 'NOM-%'));

    let nextNumber = 1;
    for (const row of existing) {
      const match = row.code.match(/^NOM-(\d+)$/);
      if (match) {
        nextNumber = Math.max(nextNumber, parseInt(match[1], 10) + 1);
      }
    }

    return `NOM-${String(nextNumber).padStart(6, '0')}`;
  }

  private async resolveCompanyId(branchId?: string): Promise<string> {
    if (branchId) {
      const [branch] = await db
        .select({ companyId: branches.companyId })
        .from(branches)
        .where(eq(branches.id, branchId))
        .limit(1);

      if (!branch) throw new NotFoundException(`Branch ${branchId} not found`);
      return branch.companyId;
    }

    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .orderBy(companies.createdAt)
      .limit(1);

    if (!company) throw new NotFoundException('No company configured');
    return company.id;
  }

  private async findSettingType(companyId: string, key: string): Promise<string> {
    const [row] = await db
      .select({ type: payrollSettings.type })
      .from(payrollSettings)
      .where(and(eq(payrollSettings.companyId, companyId), eq(payrollSettings.key, key)))
      .orderBy(desc(payrollSettings.effectiveFrom))
      .limit(1);

    return row?.type ?? 'NUMBER';
  }

  /** Normaliza la vigencia al dÃ­a: dos altas del mismo dÃ­a son la misma vigencia. */
  private normalizeEffectiveDate(value?: string): Date {
    const raw = value ? new Date(value) : new Date();
    if (Number.isNaN(raw.getTime())) {
      throw new BadRequestException('Fecha de vigencia invÃ¡lida');
    }

    return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
  }

  private toSettingResponse(row: typeof payrollSettings.$inferSelect): PayrollSettingResponseDto {
    return {
      id: row.id,
      companyId: row.companyId,
      key: row.key,
      label: row.label,
      value: Number(row.value),
      type: row.type,
      branchId: row.branchId,
      effectiveFrom: row.effectiveFrom.toISOString(),
      isActive: row.isActive ?? true,
    };
  }
  private async mapEmployeesWithRelations(
    emps: (typeof employees.$inferSelect)[]
  ): Promise<EmployeeResponseDto[]> {
    const result: EmployeeResponseDto[] = [];

    for (const emp of emps) {
      let positionName: string | undefined;
      let departmentName: string | undefined;

      if (emp.positionId) {
        const [pos] = await db
          .select()
          .from(jobPositions)
          .where(eq(jobPositions.id, emp.positionId))
          .limit(1);
        positionName = pos?.name;
      }

      if (emp.departmentId) {
        const [dept] = await db
          .select()
          .from(departments)
          .where(eq(departments.id, emp.departmentId))
          .limit(1);
        departmentName = dept?.name;
      }

      const bankAccounts = await db
        .select()
        .from(employeeBankAccounts)
        .where(eq(employeeBankAccounts.employeeId, emp.id));

      const mappedBankAccounts: EmployeeBankAccountDto[] = bankAccounts.map(ba => ({
        id: ba.id,
        bankId: ba.bankId,
        accountNumber: ba.accountNumber,
        accountType: ba.accountType || undefined,
        currencyId: ba.currencyId || undefined,
        isPrimary: ba.isPrimary || false,
        isActive: ba.isActive || false,
      }));

      result.push({
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        identityCard: emp.identityCard,
        email: emp.email || undefined,
        phone: emp.phone || undefined,
        positionId: emp.positionId || undefined,
        departmentId: emp.departmentId || undefined,
        branchId: emp.branchId || undefined,
        hireDate: emp.hireDate,
        terminationDate: emp.terminationDate || undefined,
        terminationReason: emp.terminationReason || undefined,
        baseSalary: parseFloat(String(emp.baseSalary)),
        payFrequency: emp.payFrequency as any,
        paymentMethod: emp.paymentMethod || undefined,
        status: emp.status as any,
        positionName,
        departmentName,
        bankAccounts: mappedBankAccounts.length > 0 ? mappedBankAccounts : undefined,
      });
    }

    return result;
  }

  async createEmployee(createEmployeeDto: CreateEmployeeDto): Promise<EmployeeResponseDto> {
    const [existing] = await db
      .select()
      .from(employees)
      .where(eq(employees.identityCard, createEmployeeDto.identityCard))
      .limit(1);

    if (existing) {
      throw new BadRequestException('Employee with this identity card already exists');
    }

    let salaryCurrencyId = createEmployeeDto.salaryCurrencyId;
    if (!salaryCurrencyId) {
      const [usd] = await db.select().from(currencies).where(eq(currencies.code, 'USD')).limit(1);
      if (usd) salaryCurrencyId = usd.id;
    }

    const [newEmployee] = await db
      .insert(employees)
      .values({
        id: uuidv4(),
        firstName: createEmployeeDto.firstName,
        lastName: createEmployeeDto.lastName,
        identityCard: createEmployeeDto.identityCard,
        email: createEmployeeDto.email,
        phone: createEmployeeDto.phone,
        positionId: createEmployeeDto.positionId,
        departmentId: createEmployeeDto.departmentId,
        branchId: createEmployeeDto.branchId,
        baseSalary: String(createEmployeeDto.baseSalary),
        salaryCurrencyId,
        payFrequency: createEmployeeDto.payFrequency || 'BIWEEKLY',
        paymentMethod: createEmployeeDto.paymentMethod || 'BANK_TRANSFER',
        bankId: createEmployeeDto.bankId,
        accountNumber: createEmployeeDto.accountNumber,
        status: EmployeeStatus.ACTIVE,
        hireDate: new Date(),
      })
      .returning();

    await db.insert(employeeContracts).values({
      id: uuidv4(),
      employeeId: newEmployee.id,
      type: 'INDETERMINADO',
      startDate: new Date(),
      status: 'ACTIVE',
    });

    if (createEmployeeDto.bankId && createEmployeeDto.accountNumber) {
      await db.insert(employeeBankAccounts).values({
        id: uuidv4(),
        employeeId: newEmployee.id,
        bankId: createEmployeeDto.bankId,
        accountNumber: createEmployeeDto.accountNumber,
        accountType: 'CHECKING',
        currencyId: salaryCurrencyId,
        isPrimary: true,
        isActive: true,
      });
    }

    return this.findOneEmployee(newEmployee.id);
  }

  async updateEmployee(
    id: string,
    updateEmployeeDto: UpdateEmployeeDto
  ): Promise<EmployeeResponseDto> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    if (
      updateEmployeeDto.baseSalary &&
      updateEmployeeDto.baseSalary !== parseFloat(String(employee.baseSalary))
    ) {
      await db.insert(employeeSalaryHistory).values({
        id: uuidv4(),
        employeeId: id,
        previousSalary: String(employee.baseSalary),
        newSalary: String(updateEmployeeDto.baseSalary),
        currencyId: employee.salaryCurrencyId,
        reason: 'Salary update',
        effectiveDate: new Date(),
      });
    }

    const updateData: any = {};
    if (updateEmployeeDto.firstName) updateData.firstName = updateEmployeeDto.firstName;
    if (updateEmployeeDto.lastName) updateData.lastName = updateEmployeeDto.lastName;
    if (updateEmployeeDto.phone) updateData.phone = updateEmployeeDto.phone;
    if (updateEmployeeDto.positionId) updateData.positionId = updateEmployeeDto.positionId;
    if (updateEmployeeDto.departmentId) updateData.departmentId = updateEmployeeDto.departmentId;
    if (updateEmployeeDto.baseSalary) updateData.baseSalary = String(updateEmployeeDto.baseSalary);
    if (updateEmployeeDto.status) updateData.status = updateEmployeeDto.status;
    if (updateEmployeeDto.terminationReason)
      updateData.terminationReason = updateEmployeeDto.terminationReason;
    if (updateEmployeeDto.terminationDate)
      updateData.terminationDate = new Date(updateEmployeeDto.terminationDate);
    updateData.updatedAt = new Date();

    await db.update(employees).set(updateData).where(eq(employees.id, id));

    return this.findOneEmployee(id);
  }

  async findAllDepartments(branchId?: string): Promise<any[]> {
    const conditions = branchId ? [eq(departments.branchId, branchId)] : [];
    return conditions.length > 0
      ? await db
          .select()
          .from(departments)
          .where(and(...conditions))
      : await db.select().from(departments);
  }

  async createDepartment(createDepartmentDto: CreateDepartmentDto): Promise<any> {
    const [newDept] = await db
      .insert(departments)
      .values({
        id: uuidv4(),
        name: createDepartmentDto.name,
        parentId: createDepartmentDto.parentId,
        branchId: createDepartmentDto.branchId,
      })
      .returning();
    return newDept;
  }

  async findAllPositions(): Promise<any[]> {
    return await db.select().from(jobPositions);
  }

  async createPosition(createPositionDto: CreatePositionDto): Promise<any> {
    const [newPos] = await db
      .insert(jobPositions)
      .values({
        id: uuidv4(),
        name: createPositionDto.name,
        description: createPositionDto.description,
        currencyId: createPositionDto.currencyId,
        baseSalaryMin: createPositionDto.baseSalaryMin
          ? String(createPositionDto.baseSalaryMin)
          : '0',
        baseSalaryMax: createPositionDto.baseSalaryMax
          ? String(createPositionDto.baseSalaryMax)
          : '0',
      })
      .returning();
    return newPos;
  }

  async generatePayroll(
    createPayrollRunDto: CreatePayrollRunDto,
    userId: string
  ): Promise<PayrollRunResponseDto> {
    const activeEmployees = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.status, EmployeeStatus.ACTIVE),
          eq(employees.branchId, createPayrollRunDto.branchId)
        )
      );

    const periodEnd = new Date(createPayrollRunDto.endDate);
    const companyId = await this.resolveCompanyId(createPayrollRunDto.branchId);

    // El cÃ³digo se asigna dentro de una transacciÃ³n con advisory lock: `payroll_runs.code` es Ãºnico
    // global, asÃ­ que dos sucursales generando a la vez no pueden leer el mismo mÃ¡ximo.
    const newRun = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(42003)`);
      const code = await this.getNextPayrollRunCode(tx);

      const [created] = await tx
        .insert(payrollRuns)
        .values({
          id: uuidv4(),
          code,
          branchId: createPayrollRunDto.branchId,
          frequency: createPayrollRunDto.frequency,
          currencyId: createPayrollRunDto.currencyId,
          startDate: new Date(createPayrollRunDto.startDate),
          endDate: periodEnd,
          status: PayrollRunStatus.DRAFT,
        })
        .returning();

      await this.snapshotPayrollSettings(
        created.id,
        companyId,
        createPayrollRunDto.branchId,
        periodEnd,
        tx
      );

      return created;
    });

    // El cÃ¡lculo se hace una sola vez por run y no por empleado: conceptos, parÃ¡metros congelados
    // y tasas son los mismos para todos los empleados de la sucursal.
    try {
      const companyConcepts = await db
        .select()
        .from(payrollConceptTypes)
        .where(eq(payrollConceptTypes.companyId, companyId));

      const concepts: ConceptDefinition[] = companyConcepts.map(concept => ({
        code: concept.code,
        name: concept.name,
        category: concept.category as ConceptDefinition['category'],
        kind: concept.kind as ConceptDefinition['kind'],
        expression: concept.expression,
        affectsIntegralSalary: concept.affectsIntegralSalary,
        isSalarial: concept.isSalarial,
      }));

      const periodDays = this.periodDays(newRun.startDate, newRun.endDate);
      let totalAmount = 0;
      let employerCost = 0;

      if (activeEmployees.length > 0) {
        const currenciesById = await this.loadCurrencies();
        const runCurrency = currenciesById.get(newRun.currencyId);
        if (!runCurrency) {
          throw new NotFoundException(`Currency ${newRun.currencyId} not found`);
        }

        const frozenSettings = await this.settingsForRun(
          newRun.id,
          companyId,
          createPayrollRunDto.branchId,
          periodEnd
        );
        const usedSettings = this.settingsUsedByConcepts(frozenSettings, concepts);

        const converter = await this.buildCurrencyConverter(
          currenciesById,
          runCurrency.code,
          activeEmployees
            .map(emp => emp.salaryCurrencyId)
            .filter((id): id is string => id !== null),
          usedSettings,
          periodEnd
        );
        const settings = this.toSettingNumbers(usedSettings, converter);

        for (const emp of activeEmployees) {
          const calculation = this.calculator.calculate(
            {
              employeeId: emp.id,
              baseSalary: Number(emp.baseSalary),
              salaryCurrency:
                (emp.salaryCurrencyId
                  ? currenciesById.get(emp.salaryCurrencyId)?.code
                  : undefined) ?? runCurrency.code,
            },
            {
              periodDays,
              monthDays: 30,
              settings,
              concepts,
              convertToRunCurrency: converter.convert,
              runCurrency: runCurrency.code,
            }
          );

          await this.persistPayrollItem(newRun.id, emp.id, calculation);
          totalAmount += calculation.netTotal;
          employerCost += calculation.employerContributions;
        }
      }

      await db
        .update(payrollRuns)
        .set({ totalAmount: String(totalAmount) })
        .where(eq(payrollRuns.id, newRun.id));

      // El costo patronal no entra en `totalAmount` (que es el neto a pagar), pero se informa en el
      // detalle del run para no perderlo de vista (H-63).
      void employerCost;
    } catch (error) {
      // Un run a medio calcular no debe quedar en el historico: se descarta completo (sus
      // parametros congelados caen por la cascada) y se propaga el error original.
      await db.delete(payrollRuns).where(eq(payrollRuns.id, newRun.id));
      throw error;
    }

    return this.findOnePayrollRun(newRun.id);
  }

  /** DÃ­as del perÃ­odo con la convenciÃ³n LOTTT: un mes completo son 30 dÃ­as. */
  private periodDays(start: Date, end: Date): number {
    const inclusive = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (inclusive <= 0) return 1;
    return Math.min(inclusive, 30);
  }

  /** ParÃ¡metros del run: su copia congelada o, en runs anteriores a T-02-01, los vigentes. */
  private async settingsForRun(
    runId: string | undefined,
    companyId: string,
    branchId: string,
    asOf: Date
  ): Promise<PayrollSettingRow[]> {
    const frozen = runId
      ? await db.select().from(payrollPeriodSettings).where(eq(payrollPeriodSettings.runId, runId))
      : [];

    if (frozen.length > 0) {
      return frozen.map(row => ({
        key: row.key,
        value: Number(row.value),
        type: row.type,
      }));
    }

    const live = await db
      .select()
      .from(payrollSettings)
      .where(eq(payrollSettings.companyId, companyId));

    return resolvePayrollSettings(live, { asOf, branchId }).map(row => ({
      key: row.key,
      value: Number(row.value),
      type: row.type,
    }));
  }

  /**
   * Descarta los parámetros que ningún concepto usa.
   *
   * Importa por la moneda: convertir un parámetro en divisa exige una tasa, y no tiene sentido
   * bloquear una nómina (o el cálculo de prestaciones) porque falte la tasa de un parámetro que
   * ninguna fórmula lee.
   */
  private settingsUsedByConcepts(
    rows: PayrollSettingRow[],
    concepts: ConceptDefinition[]
  ): PayrollSettingRow[] {
    const used = new Set(
      concepts.flatMap(concept =>
        concept.expression ? extractIdentifiers(concept.expression) : []
      )
    );

    return rows.filter(row => used.has(row.key));
  }

  /** Convierte los parámetros expresados en divisa (`MONEY_USD`) a la moneda del run (M4). */
  private toSettingNumbers(
    rows: PayrollSettingRow[],
    converter: CurrencyConverter
  ): Record<string, number> {
    const settings: Record<string, number> = {};

    for (const row of rows) {
      // Un parámetro en divisa con valor 0 no necesita tasa: no se convierte nada.
      settings[row.key] =
        this.isForeignMoney(row.type) && row.value !== 0
          ? converter.convert(row.value, row.type.split('_')[1])
          : row.value;
    }

    return settings;
  }

  private isForeignMoney(type: string): boolean {
    return /^MONEY_[A-Z]{3}$/.test(type);
  }

  private async loadCurrencies(): Promise<Map<string, { code: string; isBase: boolean }>> {
    const rows = await db
      .select({ id: currencies.id, code: currencies.code, isBase: currencies.isBase })
      .from(currencies);

    return new Map(rows.map(row => [row.id, { code: row.code, isBase: row.isBase ?? false }]));
  }

  /**
   * Construye el conversor de moneda del perÃ­odo. Pre-resuelve las tasas que el cÃ¡lculo va a
   * necesitar para que el motor sea sÃ­ncrono y para fallar temprano si falta una tasa.
   */
  private async buildCurrencyConverter(
    currenciesById: Map<string, { code: string; isBase: boolean }>,
    runCurrency: string,
    employeeCurrencyIds: string[],
    settings: PayrollSettingRow[],
    date: Date
  ): Promise<CurrencyConverter> {
    const baseCurrency = [...currenciesById.values()].find(currency => currency.isBase);
    if (!baseCurrency) {
      throw new NotFoundException('No base currency configured');
    }

    // Se registra por qué se necesita cada moneda: si falta la tasa, el mensaje dice qué la necesita.
    const needed = new Map<string, string>();
    needed.set(runCurrency, 'la moneda de la nómina');
    needed.set(baseCurrency.code, 'la moneda funcional');

    for (const id of employeeCurrencyIds) {
      const code = currenciesById.get(id)?.code;
      if (code) needed.set(code, 'el sueldo de un empleado');
    }
    for (const row of settings) {
      if (this.isForeignMoney(row.type) && row.value !== 0) {
        needed.set(row.type.split('_')[1], `el parámetro ${row.key}`);
      }
    }

    const rates = new Map<string, number>();
    for (const [code, reason] of needed) {
      rates.set(code, await this.rateForOrExplain(code, baseCurrency.code, date, reason));
    }

    const runRate = rates.get(runCurrency) ?? 1;

    return {
      convert: (amount: number, fromCurrency: string): number => {
        if (fromCurrency === runCurrency) return amount;

        const fromRate = rates.get(fromCurrency);
        if (fromRate === undefined) {
          throw new BadRequestException(
            `No hay tasa de cambio para ${fromCurrency} en la fecha del perÃ­odo`
          );
        }

        return new Decimal(amount).times(fromRate).dividedBy(runRate).toNumber();
      },
    };
  }

  private async rateForOrExplain(
    code: string,
    baseCode: string,
    date: Date,
    reason: string
  ): Promise<number> {
    if (code === baseCode) return 1;

    try {
      const rate = await this.exchangeRate.getRateAt(code, date);
      return rate.rate;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          `Falta la tasa de cambio de ${code} al ${date.toISOString().slice(0, 10)}: ${reason} está expresado en ${code}. Cárguela antes de generar la nómina.`
        );
      }
      throw error;
    }
  }

  private async persistPayrollItem(
    runId: string,
    employeeId: string,
    calculation: PayrollItemCalculation
  ): Promise<void> {
    const [item] = await db
      .insert(payrollItems)
      .values({
        id: uuidv4(),
        runId,
        employeeId,
        baseAmount: String(calculation.baseAmount),
        bonuses: String(calculation.bonuses),
        deductions: String(calculation.deductions),
        netTotal: String(calculation.netTotal),
      })
      .returning();

    for (const line of calculation.lines) {
      await db.insert(payrollItemLines).values({
        id: uuidv4(),
        itemId: item.id,
        conceptCode: line.conceptCode,
        conceptName: line.conceptName,
        category: line.category,
        base: String(line.base),
        rate: String(line.rate),
        amount: String(line.amount),
      });
    }
  }

  async findAllPayrollRuns(branchId?: string): Promise<PayrollRunResponseDto[]> {
    const conditions = branchId ? [eq(payrollRuns.branchId, branchId)] : [];
    const runs =
      conditions.length > 0
        ? await db
            .select()
            .from(payrollRuns)
            .where(and(...conditions))
        : await db.select().from(payrollRuns);

    return runs.map(r => ({
      ...r,
      totalAmount: parseFloat(String(r.totalAmount)),
    }));
  }

  async findOnePayrollRun(id: string, branchId?: string): Promise<PayrollRunResponseDto> {
    const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).limit(1);

    // R2: nomina de otra sucursal -> 404.
    if (!run || (branchId && run.branchId !== branchId)) {
      throw new NotFoundException(`Payroll run with ID ${id} not found`);
    }

    const items = await db.select().from(payrollItems).where(eq(payrollItems.runId, id));

    const itemsWithLines: any[] = [];

    for (const item of items) {
      const [emp] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, item.employeeId))
        .limit(1);

      const lines = await db
        .select()
        .from(payrollItemLines)
        .where(eq(payrollItemLines.itemId, item.id));

      itemsWithLines.push({
        id: item.id,
        employeeId: item.employeeId,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        baseAmount: parseFloat(String(item.baseAmount)),
        bonuses: parseFloat(String(item.bonuses)),
        deductions: parseFloat(String(item.deductions)),
        netTotal: parseFloat(String(item.netTotal)),
        lines: lines.map(l => ({
          conceptCode: l.conceptCode,
          conceptName: l.conceptName,
          category: l.category,
          base: parseFloat(String(l.base)),
          rate: parseFloat(String(l.rate)),
          amount: parseFloat(String(l.amount)),
        })),
      });
    }

    return {
      ...run,
      totalAmount: parseFloat(String(run.totalAmount)),
      items: itemsWithLines,
    };
  }

  async processPayrollRun(id: string): Promise<PayrollRunResponseDto> {
    const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).limit(1);

    if (!run) {
      throw new NotFoundException(`Payroll run with ID ${id} not found`);
    }

    if (run.status !== PayrollRunStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT payroll runs can be processed');
    }

    await db
      .update(payrollRuns)
      .set({ status: PayrollRunStatus.PROCESSED })
      .where(eq(payrollRuns.id, id));

    return this.findOnePayrollRun(id);
  }

  async getPayslip(runId: string, itemId: string): Promise<PayslipDto> {
    const [item] = await db.select().from(payrollItems).where(eq(payrollItems.id, itemId)).limit(1);

    if (!item) {
      throw new NotFoundException(`Payroll item with ID ${itemId} not found`);
    }

    const [emp] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, item.employeeId))
      .limit(1);
    const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, runId)).limit(1);
    const [position] = emp?.positionId
      ? await db.select().from(jobPositions).where(eq(jobPositions.id, emp.positionId)).limit(1)
      : [null];

    const lines = await db
      .select()
      .from(payrollItemLines)
      .where(eq(payrollItemLines.itemId, itemId));

    const incomeConcepts: { code: string; name: string; amount: number }[] = [];
    const deductionConcepts: { code: string; name: string; amount: number }[] = [];
    let totalIncome = 0;
    let totalDeductions = 0;

    for (const line of lines) {
      const amount = parseFloat(String(line.amount));
      if (line.category === 'INCOME') {
        totalIncome += amount;
        incomeConcepts.push({ code: line.conceptCode, name: line.conceptName, amount });
      } else if (line.category === 'DEDUCTION') {
        totalDeductions += amount;
        deductionConcepts.push({ code: line.conceptCode, name: line.conceptName, amount });
      }
    }

    return {
      employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
      position: position?.name || 'N/A',
      periodStart: run?.startDate.toISOString().split('T')[0] || '',
      periodEnd: run?.endDate.toISOString().split('T')[0] || '',
      baseSalary: parseFloat(String(item.baseAmount)),
      incomeConcepts,
      deductionConcepts,
      totalIncome,
      totalDeductions,
      netSalary: parseFloat(String(item.netTotal)),
    };
  }

  async findAllIncidents(employeeId?: string): Promise<any[]> {
    const conditions = employeeId ? [eq(payrollIncidents.employeeId, employeeId)] : [];
    return conditions.length > 0
      ? await db
          .select()
          .from(payrollIncidents)
          .where(and(...conditions))
      : await db.select().from(payrollIncidents);
  }

  async createIncident(createIncidentDto: CreateIncidentDto): Promise<any> {
    const [newIncident] = await db
      .insert(payrollIncidents)
      .values({
        id: uuidv4(),
        employeeId: createIncidentDto.employeeId,
        conceptId: createIncidentDto.conceptId,
        date: new Date(createIncidentDto.date),
        quantity: createIncidentDto.quantity ? String(createIncidentDto.quantity) : '1',
        amount: createIncidentDto.amount ? String(createIncidentDto.amount) : null,
        status: 'PENDING',
        notes: createIncidentDto.notes,
      })
      .returning();

    return newIncident;
  }

  async getPayrollConceptTypes(branchId?: string): Promise<PayrollConceptResponseDto[]> {
    const companyId = await this.resolveCompanyId(branchId);
    const rows = await db
      .select()
      .from(payrollConceptTypes)
      .where(eq(payrollConceptTypes.companyId, companyId))
      .orderBy(payrollConceptTypes.code);

    return rows.map(row => this.toConceptResponse(row));
  }

  async createPayrollConcept(
    dto: CreatePayrollConceptDto,
    branchId?: string
  ): Promise<PayrollConceptResponseDto> {
    const companyId = await this.resolveCompanyId(branchId);
    const kind = dto.kind ?? PayrollConceptKind.FIXED;
    const expression = dto.expression?.trim() || null;

    await this.assertValidConceptExpression(kind, expression, companyId);

    const [existing] = await db
      .select({ id: payrollConceptTypes.id })
      .from(payrollConceptTypes)
      .where(
        and(eq(payrollConceptTypes.companyId, companyId), eq(payrollConceptTypes.code, dto.code))
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(`El concepto ${dto.code} ya existe`);
    }

    const [created] = await db
      .insert(payrollConceptTypes)
      .values({
        id: uuidv4(),
        companyId,
        code: dto.code,
        name: dto.name,
        category: dto.category,
        kind,
        expression,
        affectsIntegralSalary: dto.affectsIntegralSalary ?? false,
        isSalarial: dto.isSalarial ?? true,
        isSystem: false,
        branchId: branchId ?? null,
      })
      .returning();

    return this.toConceptResponse(created);
  }

  async updatePayrollConcept(
    id: string,
    dto: UpdatePayrollConceptDto,
    branchId?: string
  ): Promise<PayrollConceptResponseDto> {
    const companyId = await this.resolveCompanyId(branchId);
    const [concept] = await db
      .select()
      .from(payrollConceptTypes)
      .where(and(eq(payrollConceptTypes.id, id), eq(payrollConceptTypes.companyId, companyId)))
      .limit(1);

    if (!concept) throw new NotFoundException(`Payroll concept ${id} not found`);

    const kind = dto.kind ?? (concept.kind as PayrollConceptKind);
    const expression =
      dto.expression === undefined ? concept.expression : dto.expression.trim() || null;

    await this.assertValidConceptExpression(kind, expression, companyId);

    const [updated] = await db
      .update(payrollConceptTypes)
      .set({
        name: dto.name ?? concept.name,
        category: dto.category ?? concept.category,
        kind,
        expression,
        affectsIntegralSalary: dto.affectsIntegralSalary ?? concept.affectsIntegralSalary,
        isSalarial: dto.isSalarial ?? concept.isSalarial,
      })
      .where(eq(payrollConceptTypes.id, concept.id))
      .returning();

    return this.toConceptResponse(updated);
  }

  async deletePayrollConcept(id: string, branchId?: string): Promise<{ deleted: true }> {
    const companyId = await this.resolveCompanyId(branchId);
    const [concept] = await db
      .select()
      .from(payrollConceptTypes)
      .where(and(eq(payrollConceptTypes.id, id), eq(payrollConceptTypes.companyId, companyId)))
      .limit(1);

    if (!concept) throw new NotFoundException(`Payroll concept ${id} not found`);
    if (concept.isSystem) {
      throw new ConflictException(`El concepto ${concept.code} es del sistema y no se elimina`);
    }

    const [usedLine] = await db
      .select({ id: payrollItemLines.id })
      .from(payrollItemLines)
      .where(eq(payrollItemLines.conceptCode, concept.code))
      .limit(1);

    if (usedLine) {
      throw new ConflictException(
        `El concepto ${concept.code} ya se usÃ³ en una nÃ³mina: desactÃ­velo en lugar de eliminarlo`
      );
    }

    const [usedIncident] = await db
      .select({ id: payrollIncidents.id })
      .from(payrollIncidents)
      .where(eq(payrollIncidents.conceptId, concept.id))
      .limit(1);

    if (usedIncident) {
      throw new ConflictException(
        `El concepto ${concept.code} tiene incidencias asociadas: no se puede eliminar`
      );
    }

    await db.delete(payrollConceptTypes).where(eq(payrollConceptTypes.id, concept.id));
    return { deleted: true };
  }

  /**
   * Una fÃ³rmula sÃ³lo es vÃ¡lida si usa las bases de cÃ¡lculo o las claves de parÃ¡metro de la empresa.
   * Se valida en el alta para que un error de tipeo no aparezca reciÃ©n al correr la nÃ³mina.
   */
  private async assertValidConceptExpression(
    kind: PayrollConceptKind,
    expression: string | null,
    companyId: string
  ): Promise<void> {
    if (kind === PayrollConceptKind.FORMULA && !expression) {
      throw new BadRequestException('Un concepto de tipo FORMULA requiere una expresiÃ³n');
    }

    if (expression) {
      const settingKeys = await db
        .select({ key: payrollSettings.key })
        .from(payrollSettings)
        .where(eq(payrollSettings.companyId, companyId));

      const error = validateConceptExpression(
        expression,
        settingKeys.map(row => row.key)
      );
      if (error) throw new BadRequestException(error);
    }
  }

  private toConceptResponse(
    row: typeof payrollConceptTypes.$inferSelect
  ): PayrollConceptResponseDto {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
      kind: row.kind,
      expression: row.expression,
      affectsIntegralSalary: row.affectsIntegralSalary,
      isSalarial: row.isSalarial,
      isSystem: row.isSystem ?? false,
      branchId: row.branchId,
    };
  }

  /**
   * Resumen de vacaciones (`T-02-04`): días que corresponden por antigüedad y días pendientes.
   */
  async getVacationSummary(
    employeeId: string,
    branchId?: string,
    asOf?: string
  ): Promise<VacationSummaryDto> {
    const employee = await this.findEmployeeOrFail(employeeId, branchId);
    const at = asOf ? new Date(asOf) : new Date();
    const setup = await this.buildBenefitsSetup(employee, branchId, at);
    const years = this.benefits.serviceYears(employee.hireDate ?? at, at);
    const entitlement = this.benefits.vacationEntitlement(years, setup.settings);

    const rows = await db
      .select()
      .from(employeeVacations)
      .where(eq(employeeVacations.employeeId, employeeId));
    const daysTaken = rows.reduce((acc, row) => acc + (row.daysTaken ?? 0), 0);

    return {
      employeeId,
      years,
      vacationDays: entitlement.vacationDays,
      bonusDays: entitlement.bonusDays,
      daysTaken,
      daysPending: Math.max(0, entitlement.vacationDays - daysTaken),
      normalDaily: setup.normalDaily,
    };
  }

  /** Registra un período vacacional y devuelve lo que se paga por vacaciones y bono. */
  async registerVacation(
    employeeId: string,
    dto: RegisterVacationDto,
    branchId?: string
  ): Promise<VacationSummaryDto & { vacationAmount: number; bonusAmount: number }> {
    const employee = await this.findEmployeeOrFail(employeeId, branchId);
    const at = dto.startDate ? new Date(dto.startDate) : new Date();
    const setup = await this.buildBenefitsSetup(employee, branchId, at);
    const years = this.benefits.serviceYears(employee.hireDate ?? at, at);
    const entitlement = this.benefits.vacationEntitlement(years, setup.settings);

    if (dto.days > entitlement.vacationDays) {
      throw new BadRequestException(
        `El empleado tiene ${entitlement.vacationDays} días de vacaciones y se intentan tomar ${dto.days}`
      );
    }

    const [existing] = await db
      .select({ id: employeeVacations.id })
      .from(employeeVacations)
      .where(
        and(eq(employeeVacations.employeeId, employeeId), eq(employeeVacations.year, dto.year))
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(`Ya existe el período vacacional ${dto.year} para este empleado`);
    }

    const pay = this.benefits.vacationPay(setup.normalDaily, years, dto.days, setup.settings);

    await db.insert(employeeVacations).values({
      id: uuidv4(),
      employeeId,
      year: dto.year,
      totalDays: entitlement.vacationDays,
      daysTaken: dto.days,
      daysPending: Math.max(0, entitlement.vacationDays - dto.days),
      status: dto.days >= entitlement.vacationDays ? 'TAKEN' : 'PENDING',
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      amount: String(pay.total),
      notes: dto.notes,
    });

    return {
      employeeId,
      years,
      vacationDays: entitlement.vacationDays,
      bonusDays: entitlement.bonusDays,
      daysTaken: dto.days,
      daysPending: Math.max(0, entitlement.vacationDays - dto.days),
      normalDaily: setup.normalDaily,
      vacationAmount: pay.vacationAmount,
      bonusAmount: pay.bonusAmount,
    };
  }

  /** Prestaciones: garantía acumulada, retroactivo y la modalidad que se paga (RN-11). */
  async getBenefitsSummary(
    employeeId: string,
    branchId?: string,
    asOf?: string
  ): Promise<BenefitsSummaryDto> {
    const employee = await this.findEmployeeOrFail(employeeId, branchId);
    const at = asOf ? new Date(asOf) : new Date();
    const setup = await this.buildBenefitsSetup(employee, branchId, at);
    const years = this.benefits.serviceYears(employee.hireDate ?? at, at);

    const deposits = await db
      .select()
      .from(employeeBenefits)
      .where(eq(employeeBenefits.employeeId, employeeId));

    const quartersDeposited = deposits.length;
    const guaranteeAccumulated = Number(this.moneySum(deposits.map(row => row.amount)));
    const retroactive = this.benefits.retroactiveAmount(setup.integralDaily, years, setup.settings);
    const modality = this.benefits.compareModalities(guaranteeAccumulated, retroactive);

    return {
      employeeId,
      years,
      integralDaily: setup.integralDaily,
      quartersDeposited,
      guaranteeAccumulated,
      retroactive,
      payable: modality.payable,
      modality: modality.modality,
    };
  }

  /** Deposita la garantía de un trimestre (Art. 142 literal “a”). Idempotente por trimestre. */
  async depositBenefitGuarantee(
    employeeId: string,
    dto: DepositBenefitDto,
    branchId?: string
  ): Promise<BenefitsSummaryDto> {
    const employee = await this.findEmployeeOrFail(employeeId, branchId);
    const at = new Date(Date.UTC(dto.year, dto.quarter * 3, 0));
    const setup = await this.buildBenefitsSetup(employee, branchId, at);
    const years = this.benefits.serviceYears(employee.hireDate ?? at, at);

    const [existing] = await db
      .select({ id: employeeBenefits.id })
      .from(employeeBenefits)
      .where(
        and(
          eq(employeeBenefits.employeeId, employeeId),
          eq(employeeBenefits.year, dto.year),
          eq(employeeBenefits.month, dto.quarter * 3)
        )
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(
        `La garantía del trimestre ${dto.quarter} de ${dto.year} ya está depositada`
      );
    }

    const deposit = this.benefits.quarterlyDeposit(
      setup.integralDaily,
      years,
      dto.isAnniversaryQuarter ?? false,
      setup.settings
    );

    const previous = await db
      .select({ amount: employeeBenefits.amount })
      .from(employeeBenefits)
      .where(eq(employeeBenefits.employeeId, employeeId));

    await db.insert(employeeBenefits).values({
      id: uuidv4(),
      employeeId,
      year: dto.year,
      month: dto.quarter * 3,
      monthlySalary: String(setup.monthlySalary),
      integralSalary: String(setup.integralDaily),
      days: deposit.days,
      amount: String(deposit.amount),
      accumulatedAmount: this.moneySum([
        ...previous.map(row => row.amount),
        String(deposit.amount),
      ]),
      type: 'GARANTIA',
      paid: true,
      paymentDate: new Date(),
      notes: dto.notes,
    });

    return this.getBenefitsSummary(employeeId, branchId, at.toISOString());
  }

  /** Utilidades del ejercicio (Art. 131, RN-16). Idempotente por año. */
  async registerProfitSharing(
    employeeId: string,
    dto: RegisterProfitSharingDto,
    branchId?: string
  ): Promise<{ employeeId: string; year: number; days: number; amount: number }> {
    const employee = await this.findEmployeeOrFail(employeeId, branchId);
    const at = new Date(Date.UTC(dto.year, 11, 31));
    const setup = await this.buildBenefitsSetup(employee, branchId, at);

    const [existing] = await db
      .select({ id: employeeProfitSharing.id })
      .from(employeeProfitSharing)
      .where(
        and(
          eq(employeeProfitSharing.employeeId, employeeId),
          eq(employeeProfitSharing.year, dto.year)
        )
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(`Las utilidades de ${dto.year} ya están registradas`);
    }

    const sharing = this.benefits.profitSharing(
      setup.normalDaily,
      dto.monthsWorked,
      setup.settings
    );

    await db.insert(employeeProfitSharing).values({
      id: uuidv4(),
      employeeId,
      year: dto.year,
      daysToPay: sharing.days,
      amount: String(sharing.amount),
      paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : null,
      status: 'PENDING',
      notes: dto.notes,
    });

    return { employeeId, year: dto.year, days: sharing.days, amount: sharing.amount };
  }

  private async findEmployeeOrFail(employeeId: string, branchId?: string) {
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);

    // R2: un empleado de otra sucursal se comporta como inexistente.
    if (!employee || (branchId && employee.branchId && employee.branchId !== branchId)) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }

    return employee;
  }

  /**
   * Contexto para prestaciones y utilidades: parámetros vigentes, catálogo de conceptos y salarios
   * diarios. El integral sale del **mismo motor** de nómina, no de una fórmula paralela.
   */
  private async buildBenefitsSetup(
    employee: typeof employees.$inferSelect,
    branchId: string | undefined,
    asOf: Date
  ): Promise<{
    settings: BenefitSettings;
    normalDaily: number;
    integralDaily: number;
    monthlySalary: number;
  }> {
    const companyId = await this.resolveCompanyId(branchId ?? employee.branchId ?? undefined);
    const frozenSettings = await this.settingsForRun(undefined, companyId, branchId ?? '', asOf);

    const settingValues: Record<string, number> = {};
    for (const row of frozenSettings) settingValues[row.key] = row.value;

    const settings: BenefitSettings = {
      DIAS_VACACIONES_BASE:
        settingValues.DIAS_VACACIONES_BASE ?? DEFAULT_BENEFIT_SETTINGS.DIAS_VACACIONES_BASE,
      TOPE_DIAS_VACACIONES_EXTRA:
        settingValues.TOPE_DIAS_VACACIONES_EXTRA ??
        DEFAULT_BENEFIT_SETTINGS.TOPE_DIAS_VACACIONES_EXTRA,
      DIAS_BONO_VACACIONAL:
        settingValues.DIAS_BONO_VACACIONAL ?? DEFAULT_BENEFIT_SETTINGS.DIAS_BONO_VACACIONAL,
      TOPE_DIAS_BONO_EXTRA:
        settingValues.TOPE_DIAS_BONO_EXTRA ?? DEFAULT_BENEFIT_SETTINGS.TOPE_DIAS_BONO_EXTRA,
      DIAS_GARANTIA_TRIMESTRE:
        settingValues.DIAS_GARANTIA_TRIMESTRE ?? DEFAULT_BENEFIT_SETTINGS.DIAS_GARANTIA_TRIMESTRE,
      DIAS_ADICIONALES_ANIO:
        settingValues.DIAS_ADICIONALES_ANIO ?? DEFAULT_BENEFIT_SETTINGS.DIAS_ADICIONALES_ANIO,
      TOPE_DIAS_ADICIONALES:
        settingValues.TOPE_DIAS_ADICIONALES ?? DEFAULT_BENEFIT_SETTINGS.TOPE_DIAS_ADICIONALES,
      DIAS_UTILIDADES: settingValues.DIAS_UTILIDADES ?? DEFAULT_BENEFIT_SETTINGS.DIAS_UTILIDADES,
      TOPE_UTILIDADES_MESES:
        settingValues.TOPE_UTILIDADES_MESES ?? DEFAULT_BENEFIT_SETTINGS.TOPE_UTILIDADES_MESES,
      DIAS_RETROACTIVO_ANIO:
        settingValues.DIAS_RETROACTIVO_ANIO ?? DEFAULT_BENEFIT_SETTINGS.DIAS_RETROACTIVO_ANIO,
    };

    const companyConcepts = await db
      .select()
      .from(payrollConceptTypes)
      .where(eq(payrollConceptTypes.companyId, companyId));

    const monthlySalary = Number(employee.baseSalary);

    if (companyConcepts.length === 0) {
      return {
        settings,
        normalDaily: this.round6(monthlySalary / 30),
        integralDaily: this.round6(monthlySalary / 30),
        monthlySalary,
      };
    }

    const currenciesById = await this.loadCurrencies();
    const employeeCurrency = employee.salaryCurrencyId
      ? currenciesById.get(employee.salaryCurrencyId)?.code
      : undefined;
    const functional =
      [...currenciesById.values()].find(currency => currency.isBase)?.code ?? 'VES';

    // Sólo los conceptos que pueden mover el salario normal o el integral. El cestaticket y las
    // deducciones no participan: incluirlos obligaría a tener tasas de moneda y alícuotas que no
    // tienen nada que ver con las prestaciones.
    const concepts: ConceptDefinition[] = companyConcepts
      .filter(
        concept =>
          (concept.category === 'ASSIGNMENT' && concept.isSalarial) ||
          (concept.category === 'INFORMATIVE' && concept.affectsIntegralSalary)
      )
      .map(concept => ({
        code: concept.code,
        name: concept.name,
        category: concept.category as ConceptDefinition['category'],
        kind: concept.kind as ConceptDefinition['kind'],
        expression: concept.expression,
        affectsIntegralSalary: concept.affectsIntegralSalary,
        isSalarial: concept.isSalarial,
      }));

    const usedSettings = this.settingsUsedByConcepts(frozenSettings, concepts);

    const converter = await this.buildCurrencyConverter(
      currenciesById,
      functional,
      employeeCurrency ? [employeeCurrency] : [],
      usedSettings,
      asOf
    );

    // Un período completo: el motor entrega SALARY_NORMAL mensual y SALARY_INTEGRAL **diario**
    // (la convención de §9: las alícuotas y el integral se expresan por día).
    const calculation = this.calculator.calculate(
      {
        employeeId: employee.id,
        baseSalary: monthlySalary,
        salaryCurrency: employeeCurrency ?? functional,
      },
      {
        periodDays: 30,
        monthDays: 30,
        settings: this.toSettingNumbers(usedSettings, converter),
        concepts,
        convertToRunCurrency: converter.convert,
        runCurrency: functional,
      }
    );

    return {
      settings,
      normalDaily: this.round6(calculation.variables.SALARY_NORMAL / 30),
      integralDaily: calculation.variables.SALARY_INTEGRAL,
      monthlySalary: calculation.variables.SALARY_BASE,
    };
  }

  private round6(value: number): number {
    return Number(new MoneyService().round(value, 6));
  }

  private moneySum(values: Array<string | number>): string {
    return new MoneyService().sum(values);
  }
}
