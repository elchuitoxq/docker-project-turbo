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
import { validateConceptExpression } from '../payroll/concept-expression';
import { resolvePayrollSettings, validateSettingValue } from '../payroll/settings-resolver';
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
} from '../dto/hr.dto';

const SSO_EMP_RATE = 0.04;
const FAOV_EMP_RATE = 0.01;
const PIE_EMP_RATE = 0.005;
const SSO_PAT_RATE = 0.1;
const FAOV_PAT_RATE = 0.02;
const PIE_PAT_RATE = 0.02;
const CESTATICKET_USD = 40.0;

@Injectable()
export class HrService {
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

  /** EdiciÃ³n de departamento (T-01-02). */
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

  /** EdiciÃ³n de cargo (T-01-03). */
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

  /** AprobaciÃ³n o rechazo de una incidencia (T-01-04). SÃ³lo desde PENDING. */
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

  /** ParÃ¡metros de nÃ³mina vigentes (T-01-07). */
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
    // precedencia sucursal > empresa. Antes se devolvían todas las filas activas.
    const resolved = resolvePayrollSettings(rows, {
      asOf: asOf ? new Date(asOf) : new Date(),
      branchId,
    });

    return resolved.map(row => this.toSettingResponse(row));
  }

  /** Alta o actualizaciÃ³n de un parÃ¡metro de nÃ³mina (T-01-07). */
  async upsertPayrollSetting(
    dto: UpdatePayrollSettingDto,
    branchId?: string
  ): Promise<PayrollSettingResponseDto> {
    const companyId = await this.resolveCompanyId(branchId);
    const effectiveFrom = this.normalizeEffectiveDate(dto.effectiveFrom);
    const type = dto.type ?? (await this.findSettingType(companyId, dto.key));

    const valueError = validateSettingValue(type, dto.value);
    if (valueError) throw new BadRequestException(valueError);

    // Se busca la vigencia exacta (empresa + clave + fecha + sucursal): reprogramar el mismo día
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

  /** Parámetros congelados del run: es la prueba de que un período cerrado no cambia (RN-22). */
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
   * Congela los parámetros vigentes al cierre del período dentro del run (`T-02-01`).
   * Si no hay parámetros cargados el run se crea igual: la validación de parámetros obligatorios
   * pertenece al motor de cálculo (T-02-03), no a la creación del run.
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

  /** Siguiente código de nómina. Global, porque `payroll_runs.code` es único a nivel de tabla. */
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

  /** Normaliza la vigencia al día: dos altas del mismo día son la misma vigencia. */
  private normalizeEffectiveDate(value?: string): Date {
    const raw = value ? new Date(value) : new Date();
    if (Number.isNaN(raw.getTime())) {
      throw new BadRequestException('Fecha de vigencia inválida');
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

    // El código se asigna dentro de una transacción con advisory lock: `payroll_runs.code` es único
    // global, así que dos sucursales generando a la vez no pueden leer el mismo máximo.
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

    let totalAmount = 0;

    for (const emp of activeEmployees) {
      const itemResult = await this.calculatePayrollItem(newRun.id, emp, createPayrollRunDto);
      totalAmount += itemResult.netTotal;
    }

    await db
      .update(payrollRuns)
      .set({ totalAmount: String(totalAmount) })
      .where(eq(payrollRuns.id, newRun.id));

    return this.findOnePayrollRun(newRun.id);
  }

  private async calculatePayrollItem(
    runId: string,
    emp: typeof employees.$inferSelect,
    runDto: CreatePayrollRunDto
  ): Promise<{ baseAmount: number; bonuses: number; deductions: number; netTotal: number }> {
    const baseSalary = parseFloat(String(emp.baseSalary));

    const integralSalary = baseSalary * 1.17;

    const ssoEmp = baseSalary * SSO_EMP_RATE;
    const faovEmp = baseSalary * FAOV_EMP_RATE;
    const pieEmp = baseSalary * PIE_EMP_RATE;

    const totalDeductions = ssoEmp + faovEmp + pieEmp;
    const netTotal = baseSalary - totalDeductions + CESTATICKET_USD;

    const [payrollItem] = await db
      .insert(payrollItems)
      .values({
        id: uuidv4(),
        runId,
        employeeId: emp.id,
        baseAmount: String(baseSalary),
        bonuses: String(CESTATICKET_USD),
        deductions: String(totalDeductions),
        netTotal: String(netTotal),
      })
      .returning();

    const lines = [
      {
        conceptCode: 'SALARY',
        conceptName: 'Salario Base',
        category: 'INCOME',
        base: baseSalary,
        rate: 0,
        amount: baseSalary,
      },
      {
        conceptCode: 'CESTATICKET',
        conceptName: 'Cestaticket',
        category: 'INCOME',
        base: CESTATICKET_USD,
        rate: 0,
        amount: CESTATICKET_USD,
      },
      {
        conceptCode: 'SSO_EMP',
        conceptName: 'SSO Empleado',
        category: 'DEDUCTION',
        base: baseSalary,
        rate: SSO_EMP_RATE,
        amount: ssoEmp,
      },
      {
        conceptCode: 'FAOV_EMP',
        conceptName: 'FAOV Empleado',
        category: 'DEDUCTION',
        base: baseSalary,
        rate: FAOV_EMP_RATE,
        amount: faovEmp,
      },
      {
        conceptCode: 'PIE_EMP',
        conceptName: 'PIE Empleado',
        category: 'DEDUCTION',
        base: baseSalary,
        rate: PIE_EMP_RATE,
        amount: pieEmp,
      },
    ];

    for (const line of lines) {
      await db.insert(payrollItemLines).values({
        id: uuidv4(),
        itemId: payrollItem.id,
        conceptCode: line.conceptCode,
        conceptName: line.conceptName,
        category: line.category,
        base: String(line.base),
        rate: String(line.rate),
        amount: String(line.amount),
      });
    }

    return {
      baseAmount: baseSalary,
      bonuses: CESTATICKET_USD,
      deductions: totalDeductions,
      netTotal,
    };
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
        `El concepto ${concept.code} ya se usó en una nómina: desactívelo en lugar de eliminarlo`
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
   * Una fórmula sólo es válida si usa las bases de cálculo o las claves de parámetro de la empresa.
   * Se valida en el alta para que un error de tipeo no aparezca recién al correr la nómina.
   */
  private async assertValidConceptExpression(
    kind: PayrollConceptKind,
    expression: string | null,
    companyId: string
  ): Promise<void> {
    if (kind === PayrollConceptKind.FORMULA && !expression) {
      throw new BadRequestException('Un concepto de tipo FORMULA requiere una expresión');
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
}
