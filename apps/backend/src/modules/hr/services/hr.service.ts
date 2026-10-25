import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
  payrollConceptTypes,
  payrollIncidents,
  employeeContracts,
  employeeBenefits,
  employeeVacations,
  employeeProfitSharing,
  employeeSalaryHistory,
  employeeBankAccounts,
  banks,
  currencies,
} from '../../../schema';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
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
} from '../dto/hr.dto';

const SSO_EMP_RATE = 0.04;
const FAOV_EMP_RATE = 0.01;
const PIE_EMP_RATE = 0.005;
const SSO_PAT_RATE = 0.10;
const FAOV_PAT_RATE = 0.02;
const PIE_PAT_RATE = 0.02;
const CESTATICKET_USD = 40.0;

@Injectable()
export class HrService {
  async findAllEmployees(branchId?: string): Promise<EmployeeResponseDto[]> {
    const conditions = branchId ? [eq(employees.branchId, branchId)] : [];
    const allEmployees = conditions.length > 0
      ? await db.select().from(employees).where(and(...conditions))
      : await db.select().from(employees);

    return this.mapEmployeesWithRelations(allEmployees);
  }

  async findOneEmployee(id: string): Promise<EmployeeResponseDto> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return (await this.mapEmployeesWithRelations([employee]))[0];
  }

  private async mapEmployeesWithRelations(emps: typeof employees.$inferSelect[]): Promise<EmployeeResponseDto[]> {
    const result: EmployeeResponseDto[] = [];

    for (const emp of emps) {
      let positionName: string | undefined;
      let departmentName: string | undefined;

      if (emp.positionId) {
        const [pos] = await db.select().from(jobPositions).where(eq(jobPositions.id, emp.positionId)).limit(1);
        positionName = pos?.name;
      }

      if (emp.departmentId) {
        const [dept] = await db.select().from(departments).where(eq(departments.id, emp.departmentId)).limit(1);
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

  async updateEmployee(id: string, updateEmployeeDto: UpdateEmployeeDto): Promise<EmployeeResponseDto> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    if (updateEmployeeDto.baseSalary && updateEmployeeDto.baseSalary !== parseFloat(String(employee.baseSalary))) {
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
    if (updateEmployeeDto.terminationReason) updateData.terminationReason = updateEmployeeDto.terminationReason;
    if (updateEmployeeDto.terminationDate) updateData.terminationDate = new Date(updateEmployeeDto.terminationDate);
    updateData.updatedAt = new Date();

    await db.update(employees).set(updateData).where(eq(employees.id, id));

    return this.findOneEmployee(id);
  }

  async findAllDepartments(branchId?: string): Promise<any[]> {
    const conditions = branchId ? [eq(departments.branchId, branchId)] : [];
    return conditions.length > 0
      ? await db.select().from(departments).where(and(...conditions))
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
        baseSalaryMin: createPositionDto.baseSalaryMin ? String(createPositionDto.baseSalaryMin) : '0',
        baseSalaryMax: createPositionDto.baseSalaryMax ? String(createPositionDto.baseSalaryMax) : '0',
      })
      .returning();
    return newPos;
  }

  async generatePayroll(createPayrollRunDto: CreatePayrollRunDto, userId: string): Promise<PayrollRunResponseDto> {
    const activeEmployees = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.status, EmployeeStatus.ACTIVE),
          eq(employees.branchId, createPayrollRunDto.branchId)
        )
      );

    const lastRun = await db
      .select({ code: payrollRuns.code })
      .from(payrollRuns)
      .where(eq(payrollRuns.branchId, createPayrollRunDto.branchId))
      .orderBy(desc(payrollRuns.createdAt))
      .limit(1);

    let nextNumber = 1;
    if (lastRun.length > 0) {
      const lastCode = lastRun[0].code;
      const match = lastCode.match(/NOM-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const code = `NOM-${String(nextNumber).padStart(6, '0')}`;

    const [newRun] = await db
      .insert(payrollRuns)
      .values({
        id: uuidv4(),
        code,
        branchId: createPayrollRunDto.branchId,
        frequency: createPayrollRunDto.frequency,
        currencyId: createPayrollRunDto.currencyId,
        startDate: new Date(createPayrollRunDto.startDate),
        endDate: new Date(createPayrollRunDto.endDate),
        status: PayrollRunStatus.DRAFT,
      })
      .returning();

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
      { conceptCode: 'SALARY', conceptName: 'Salario Base', category: 'INCOME', base: baseSalary, rate: 0, amount: baseSalary },
      { conceptCode: 'CESTATICKET', conceptName: 'Cestaticket', category: 'INCOME', base: CESTATICKET_USD, rate: 0, amount: CESTATICKET_USD },
      { conceptCode: 'SSO_EMP', conceptName: 'SSO Empleado', category: 'DEDUCTION', base: baseSalary, rate: SSO_EMP_RATE, amount: ssoEmp },
      { conceptCode: 'FAOV_EMP', conceptName: 'FAOV Empleado', category: 'DEDUCTION', base: baseSalary, rate: FAOV_EMP_RATE, amount: faovEmp },
      { conceptCode: 'PIE_EMP', conceptName: 'PIE Empleado', category: 'DEDUCTION', base: baseSalary, rate: PIE_EMP_RATE, amount: pieEmp },
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

    return { baseAmount: baseSalary, bonuses: CESTATICKET_USD, deductions: totalDeductions, netTotal };
  }

  async findAllPayrollRuns(branchId?: string): Promise<PayrollRunResponseDto[]> {
    const conditions = branchId ? [eq(payrollRuns.branchId, branchId)] : [];
    const runs = conditions.length > 0
      ? await db.select().from(payrollRuns).where(and(...conditions))
      : await db.select().from(payrollRuns);

    return runs.map((r) => ({
      ...r,
      totalAmount: parseFloat(String(r.totalAmount)),
    }));
  }

  async findOnePayrollRun(id: string): Promise<PayrollRunResponseDto> {
    const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, id)).limit(1);

    if (!run) {
      throw new NotFoundException(`Payroll run with ID ${id} not found`);
    }

    const items = await db.select().from(payrollItems).where(eq(payrollItems.runId, id));

    const itemsWithLines: any[] = [];

    for (const item of items) {
      const [emp] = await db.select().from(employees).where(eq(employees.id, item.employeeId)).limit(1);

      const lines = await db.select().from(payrollItemLines).where(eq(payrollItemLines.itemId, item.id));

      itemsWithLines.push({
        id: item.id,
        employeeId: item.employeeId,
        employeeName: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        baseAmount: parseFloat(String(item.baseAmount)),
        bonuses: parseFloat(String(item.bonuses)),
        deductions: parseFloat(String(item.deductions)),
        netTotal: parseFloat(String(item.netTotal)),
        lines: lines.map((l) => ({
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

    await db.update(payrollRuns).set({ status: PayrollRunStatus.PROCESSED }).where(eq(payrollRuns.id, id));

    return this.findOnePayrollRun(id);
  }

  async getPayslip(runId: string, itemId: string): Promise<PayslipDto> {
    const [item] = await db.select().from(payrollItems).where(eq(payrollItems.id, itemId)).limit(1);

    if (!item) {
      throw new NotFoundException(`Payroll item with ID ${itemId} not found`);
    }

    const [emp] = await db.select().from(employees).where(eq(employees.id, item.employeeId)).limit(1);
    const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, runId)).limit(1);
    const [position] = emp?.positionId
      ? await db.select().from(jobPositions).where(eq(jobPositions.id, emp.positionId)).limit(1)
      : [null];

    const lines = await db.select().from(payrollItemLines).where(eq(payrollItemLines.itemId, itemId));

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
      ? await db.select().from(payrollIncidents).where(and(...conditions))
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

  async getPayrollConceptTypes(): Promise<any[]> {
    return await db.select().from(payrollConceptTypes);
  }
}
