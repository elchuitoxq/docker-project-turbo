import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { HrService } from './services/hr.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  EmployeeResponseDto,
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreatePositionDto,
  UpdatePositionDto,
  CreatePayrollRunDto,
  PayrollRunResponseDto,
  VoidPayrollRunDto,
  CreateIncidentDto,
  PayslipDto,
  TerminateEmployeeDto,
  UpdatePayrollSettingDto,
  PayrollSettingResponseDto,
  CreatePayrollConceptDto,
  UpdatePayrollConceptDto,
  PayrollConceptResponseDto,
  VacationSummaryDto,
  BenefitsSummaryDto,
  RegisterVacationDto,
  DepositBenefitDto,
  RegisterProfitSharingDto,
  SettleEmployeeDto,
  SettlementResponseDto,
  PayPayrollRunDto,
  PayrollPaymentResponseDto,
} from './dto/hr.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('hr')
@ApiBearerAuth()
@Controller('v1/hr')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Get('employees')
  @RequirePermissions('hr:employees:view')
  @ApiOperation({
    summary: 'Get all employees',
    description: 'Empleados de la sucursal activa (o de `branchId` si se indica)',
  })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({ status: 200, description: 'List of employees', type: [EmployeeResponseDto] })
  async findAllEmployees(@CurrentBranch() branchId: string): Promise<EmployeeResponseDto[]> {
    return this.hrService.findAllEmployees(branchId);
  }

  @Get('employees/:id')
  @RequirePermissions('hr:employees:view')
  @ApiOperation({
    summary: 'Get employee by ID',
    description: 'Ficha del empleado con su cargo, departamento y datos laborales',
  })
  @ApiResponse({ status: 200, description: 'Employee details', type: EmployeeResponseDto })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findOneEmployee(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<EmployeeResponseDto> {
    return this.hrService.findOneEmployee(id, branchId);
  }

  @Post('employees')
  @RequirePermissions('hr:employees:create')
  @ApiOperation({
    summary: 'Create a new employee',
    description: 'Alta del empleado con sus datos personales, salario y fecha de ingreso',
  })
  @ApiBody({ type: CreateEmployeeDto })
  @ApiResponse({ status: 201, description: 'Employee created', type: EmployeeResponseDto })
  async createEmployee(@Body() createEmployeeDto: CreateEmployeeDto): Promise<EmployeeResponseDto> {
    return this.hrService.createEmployee(createEmployeeDto);
  }

  @Patch('employees/:id')
  @RequirePermissions('hr:employees:edit')
  @ApiOperation({
    summary: 'Update an employee',
    description: 'Actualiza los datos del empleado; no cambia su estado laboral',
  })
  @ApiBody({ type: UpdateEmployeeDto })
  @ApiResponse({ status: 200, description: 'Employee updated', type: EmployeeResponseDto })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async updateEmployee(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto
  ): Promise<EmployeeResponseDto> {
    return this.hrService.updateEmployee(id, updateEmployeeDto);
  }

  @Post('employees/:id/terminate')
  @RequirePermissions('hr:employees:edit')
  @ApiOperation({
    summary: 'Terminate an employee',
    description: 'Sets status TERMINATED and the termination date',
  })
  @ApiResponse({ status: 200, description: 'Employee terminated', type: EmployeeResponseDto })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({ status: 409, description: 'Employee already terminated' })
  async terminateEmployee(
    @Param('id') id: string,
    @Body() dto: TerminateEmployeeDto,
    @CurrentBranch() branchId: string
  ): Promise<EmployeeResponseDto> {
    return this.hrService.terminateEmployee(id, dto, branchId);
  }
  @Get('departments')
  @RequirePermissions('hr:view')
  @ApiOperation({
    summary: 'Get all departments',
    description: 'Departamentos de la sucursal, con su jerarquía mediante `parentId`',
  })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({
    status: 200,
    description: 'List of departments',
    schema: {
      example: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Administración',
          parentId: null,
          branchId: '550e8400-e29b-41d4-a716-446655440001',
        },
      ],
    },
  })
  async findAllDepartments(@CurrentBranch() branchId: string) {
    return this.hrService.findAllDepartments(branchId);
  }

  @Patch('departments/:id')
  @RequirePermissions('hr:departments:manage')
  @ApiOperation({
    summary: 'Update a department',
    description: 'Actualiza nombre o departamento padre',
  })
  @ApiResponse({
    status: 200,
    description: 'Department updated',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Administración',
        parentId: null,
        branchId: '550e8400-e29b-41d4-a716-446655440001',
      },
    },
  })
  async updateDepartment(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.hrService.updateDepartment(id, dto);
  }

  @Post('departments')
  @RequirePermissions('hr:departments:manage')
  @ApiOperation({
    summary: 'Create a department',
    description: 'Crea un departamento en la sucursal, opcionalmente dentro de otro',
  })
  @ApiBody({ type: CreateDepartmentDto })
  @ApiResponse({
    status: 201,
    description: 'Department created',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Administración',
        parentId: null,
        branchId: '550e8400-e29b-41d4-a716-446655440001',
      },
    },
  })
  async createDepartment(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.hrService.createDepartment(createDepartmentDto);
  }

  @Get('positions')
  @RequirePermissions('hr:view')
  @ApiOperation({
    summary: 'Get all job positions',
    description: 'Cargos disponibles con su rango salarial de referencia',
  })
  @ApiResponse({
    status: 200,
    description: 'List of positions',
    schema: {
      example: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Analista de nómina',
          description: 'Cálculo y control de la nómina mensual',
          currencyId: '550e8400-e29b-41d4-a716-446655440001',
          baseSalaryMin: '400.00',
          baseSalaryMax: '800.00',
        },
      ],
    },
  })
  async findAllPositions() {
    return this.hrService.findAllPositions();
  }

  @Patch('positions/:id')
  @RequirePermissions('hr:positions:manage')
  @ApiOperation({
    summary: 'Update a position',
    description: 'Actualiza la descripción o el rango salarial del cargo',
  })
  @ApiResponse({
    status: 200,
    description: 'Position updated',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Analista de nómina',
        description: 'Cálculo y control de la nómina mensual',
        currencyId: '550e8400-e29b-41d4-a716-446655440001',
        baseSalaryMin: '400.00',
        baseSalaryMax: '800.00',
      },
    },
  })
  async updatePosition(@Param('id') id: string, @Body() dto: UpdatePositionDto) {
    return this.hrService.updatePosition(id, dto);
  }

  @Post('positions')
  @RequirePermissions('hr:positions:manage')
  @ApiOperation({
    summary: 'Create a job position',
    description: 'Crea un cargo con su rango salarial y moneda',
  })
  @ApiBody({ type: CreatePositionDto })
  @ApiResponse({
    status: 201,
    description: 'Position created',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Analista de nómina',
        description: 'Cálculo y control de la nómina mensual',
        currencyId: '550e8400-e29b-41d4-a716-446655440001',
        baseSalaryMin: '400.00',
        baseSalaryMax: '800.00',
      },
    },
  })
  async createPosition(@Body() createPositionDto: CreatePositionDto) {
    return this.hrService.createPosition(createPositionDto);
  }

  @Get('payroll')
  @RequirePermissions('hr:payroll:view')
  @ApiOperation({
    summary: 'Get all payroll runs',
    description: 'Runs de nómina de la sucursal con su estado y totales',
  })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({ status: 200, description: 'List of payroll runs', type: [PayrollRunResponseDto] })
  async findAllPayrollRuns(@CurrentBranch() branchId: string): Promise<PayrollRunResponseDto[]> {
    return this.hrService.findAllPayrollRuns(branchId);
  }

  @Get('payroll/:id')
  @RequirePermissions('hr:payroll:view')
  @ApiOperation({
    summary: 'Get payroll run by ID',
    description: 'Detalle del run con sus conceptos, deducciones y aportes patronales',
  })
  @ApiResponse({ status: 200, description: 'Payroll run details', type: PayrollRunResponseDto })
  @ApiResponse({ status: 404, description: 'Payroll run not found' })
  async findOnePayrollRun(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<PayrollRunResponseDto> {
    return this.hrService.findOnePayrollRun(id, branchId);
  }

  @Get('payroll/:id/parameters')
  @RequirePermissions('hr:payroll:view')
  @ApiOperation({
    summary: 'Get frozen payroll parameters of a run',
    description: 'Parámetros legales congelados al generar el run (salario mínimo, UT, tasas)',
  })
  @ApiResponse({
    status: 200,
    description: 'Parameters snapshot taken when the run was created',
    type: [PayrollSettingResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Payroll run not found' })
  async getPayrollRunParameters(@Param('id') id: string): Promise<PayrollSettingResponseDto[]> {
    return this.hrService.getPayrollRunParameters(id);
  }

  @Post('payroll/generate')
  @RequirePermissions('hr:payroll:process')
  @ApiOperation({
    summary: 'Generate payroll',
    description:
      'Creates a new payroll run with calculated deductions (SSO, FAOV, PIE) per Venezuela LOTTT',
  })
  @ApiBody({ type: CreatePayrollRunDto })
  @ApiResponse({ status: 201, description: 'Payroll generated', type: PayrollRunResponseDto })
  async generatePayroll(
    @Body() createPayrollRunDto: CreatePayrollRunDto,
    @CurrentUser() user: CurrentUserData
  ): Promise<PayrollRunResponseDto> {
    return this.hrService.generatePayroll(createPayrollRunDto, user.id);
  }

  @Post('payroll/:id/process')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('hr:payroll:process')
  @ApiOperation({
    summary: 'Process payroll run',
    description: 'Recalcula y fija los importes del run en borrador dejándolo listo para pagar',
  })
  @ApiResponse({ status: 200, description: 'Payroll processed', type: PayrollRunResponseDto })
  @ApiResponse({ status: 400, description: 'Already processed' })
  async processPayrollRun(@Param('id') id: string): Promise<PayrollRunResponseDto> {
    return this.hrService.processPayrollRun(id);
  }

  @Post('payroll/:id/pay')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('hr:payroll:process')
  @ApiOperation({
    summary: 'Pay the payroll run through treasury (idempotent: one payment per run)',
    description:
      'Registra el pago en tesorería desde la cuenta bancaria indicada; sólo un pago por run',
  })
  @ApiBody({ type: PayPayrollRunDto })
  @ApiResponse({ status: 200, description: 'Payment registered', type: PayrollPaymentResponseDto })
  @ApiResponse({ status: 400, description: 'Nothing to pay or missing exchange rate' })
  @ApiResponse({ status: 409, description: 'Run marked as paid without a registered payment' })
  async payPayrollRun(
    @Param('id') id: string,
    @Body() dto: PayPayrollRunDto,
    @CurrentBranch() branchId: string,
    @CurrentUser() user: CurrentUserData
  ): Promise<PayrollPaymentResponseDto> {
    return this.hrService.payPayrollRun(id, dto, branchId, user.id);
  }

  @Post('payroll/:id/post')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('hr:payroll:process')
  @ApiOperation({
    summary: 'Post the payroll run to accounting by concept (RN-25, idempotent per run)',
    description:
      'Genera el asiento contable agrupado por concepto usando los mapas contables configurados',
  })
  @ApiResponse({
    status: 200,
    description: 'Accounting entry created or reused',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        code: 'ASI-000123',
        status: 'POSTED',
        totalDebit: 15000,
        totalCredit: 15000,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Run in draft or concept without accounting map' })
  async postPayrollRun(
    @Param('id') id: string,
    @CurrentBranch() branchId: string,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.hrService.postPayrollRun(id, branchId, user.id);
  }

  @Get('payroll/:runId/payslip/:itemId')
  @RequirePermissions('hr:payroll:view')
  @ApiOperation({
    summary: 'Get payslip for employee',
    description: 'Recibo de pago con conceptos, deducciones y neto a pagar',
  })
  @ApiResponse({ status: 200, description: 'Payslip data', type: PayslipDto })
  async getPayslip(
    @Param('runId') runId: string,
    @Param('itemId') itemId: string
  ): Promise<PayslipDto> {
    return this.hrService.getPayslip(runId, itemId);
  }

  @Get('incidents')
  @RequirePermissions('hr:incidents:view')
  @ApiOperation({
    summary: 'Get payroll incidents',
    description: 'Incidencias de nómina (horas extra, ausencias, bonos) y su estado',
  })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiResponse({
    status: 200,
    description: 'List of incidents',
    schema: {
      example: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          employeeId: '550e8400-e29b-41d4-a716-446655440001',
          conceptId: '550e8400-e29b-41d4-a716-446655440002',
          date: '2026-10-15',
          quantity: '1',
          amount: '150.00',
          status: 'PENDING',
          notes: null,
        },
      ],
    },
  })
  async findAllIncidents(@Query('employeeId') employeeId?: string) {
    return this.hrService.findAllIncidents(employeeId);
  }

  @Post('incidents')
  @RequirePermissions('hr:incidents:create')
  @ApiOperation({
    summary: 'Create a payroll incident',
    description: 'Registra una incidencia pendiente de aprobación para el empleado',
  })
  @ApiBody({ type: CreateIncidentDto })
  @ApiResponse({
    status: 201,
    description: 'Incident created',
    schema: {
      example: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        employeeId: '550e8400-e29b-41d4-a716-446655440001',
        conceptId: '550e8400-e29b-41d4-a716-446655440002',
        date: '2026-10-15',
        quantity: '1',
        amount: '150.00',
        status: 'PENDING',
        notes: null,
      },
    },
  })
  async createIncident(@Body() createIncidentDto: CreateIncidentDto) {
    return this.hrService.createIncident(createIncidentDto);
  }

  @Post('incidents/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('hr:incidents:approve')
  @ApiOperation({
    summary: 'Approve a pending incident',
    description: 'Aprueba la incidencia para que entre en el próximo run de nómina',
  })
  @ApiResponse({
    status: 200,
    description: 'Incident approved',
    schema: { example: { id: '550e8400-e29b-41d4-a716-446655440000', status: 'APPROVED' } },
  })
  @ApiResponse({ status: 409, description: 'Incident is not pending' })
  async approveIncident(@Param('id') id: string) {
    return this.hrService.setIncidentStatus(id, 'APPROVED');
  }

  @Post('incidents/:id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('hr:incidents:approve')
  @ApiOperation({
    summary: 'Reject a pending incident',
    description: 'Rechaza la incidencia; no se incluirá en la nómina',
  })
  @ApiResponse({
    status: 200,
    description: 'Incident rejected',
    schema: { example: { id: '550e8400-e29b-41d4-a716-446655440000', status: 'REJECTED' } },
  })
  @ApiResponse({ status: 409, description: 'Incident is not pending' })
  async rejectIncident(@Param('id') id: string) {
    return this.hrService.setIncidentStatus(id, 'REJECTED');
  }

  @Get('settings')
  @RequirePermissions('hr:settings:view')
  @ApiOperation({
    summary: 'List payroll settings',
    description:
      'Parámetros legales vigentes a la fecha indicada (salario mínimo, UT, IVSS, FAOV, PIE)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payroll settings',
    type: [PayrollSettingResponseDto],
  })
  async findPayrollSettings(
    @CurrentBranch() branchId: string,
    @Query('asOf') asOf?: string
  ): Promise<PayrollSettingResponseDto[]> {
    return this.hrService.findPayrollSettings(branchId, asOf);
  }

  @Patch('settings')
  @RequirePermissions('hr:settings:manage')
  @ApiOperation({
    summary: 'Create or update a payroll setting',
    description: 'Alta o actualización de un parámetro legal con su fecha de vigencia',
  })
  @ApiResponse({
    status: 200,
    description: 'Payroll setting stored',
    type: PayrollSettingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid value for the parameter type' })
  async updatePayrollSetting(
    @Body() dto: UpdatePayrollSettingDto,
    @CurrentBranch() branchId: string
  ): Promise<PayrollSettingResponseDto> {
    return this.hrService.upsertPayrollSetting(dto, branchId);
  }

  @Post('payroll/:id/void')
  @RequirePermissions('hr:payroll:process')
  @ApiOperation({
    summary: 'Anula un run de nómina (RN-21)',
    description:
      'El run pasa a VOID y, si ya estaba contabilizado, se crea el asiento de reversión. Un borrador no se anula y un run con pago vivo exige anular antes el pago en Tesorería.',
  })
  @ApiBody({ type: VoidPayrollRunDto })
  @ApiResponse({ status: 201, type: PayrollRunResponseDto })
  @ApiResponse({ status: 409, description: 'Ya está anulada o tiene un pago vivo' })
  async voidPayrollRun(
    @Param('id') id: string,
    @Body() dto: VoidPayrollRunDto,
    @CurrentUser() user: CurrentUserData,
    @CurrentBranch() branchId: string
  ): Promise<PayrollRunResponseDto> {
    return this.hrService.voidPayrollRun(id, dto.reason, user.id, branchId);
  }

  @Get('income-tax-table')
  @RequirePermissions('hr:settings:view')
  @ApiOperation({
    summary: 'Current ISLR bracket table and tax unit value (RN-09)',
    description: 'Tramos de ISLR vigentes, valor de la unidad tributaria y descuento único',
  })
  @ApiResponse({
    status: 200,
    description: 'Brackets effective today',
    schema: {
      example: {
        effectiveFrom: '2026-01-01',
        utValue: 9,
        singleDiscount: 774,
        brackets: [
          { fromUt: 0, toUt: 1000, rate: 6, discountUt: 0 },
          { fromUt: 1000.01, toUt: 1500, rate: 9, discountUt: 30 },
        ],
      },
    },
  })
  async getIncomeTaxTable(@Query('asOf') asOf?: string) {
    return this.hrService.getIncomeTaxTable(asOf ? new Date(asOf) : new Date());
  }

  @Get('concept-types')
  @RequirePermissions('hr:concepts:view')
  @ApiOperation({
    summary: 'Get payroll concept types',
    description: 'Conceptos de nómina (asignaciones y deducciones) con su expresión de cálculo',
  })
  @ApiResponse({
    status: 200,
    description: 'List of concept types',
    type: [PayrollConceptResponseDto],
  })
  async getPayrollConceptTypes(
    @CurrentBranch() branchId: string
  ): Promise<PayrollConceptResponseDto[]> {
    return this.hrService.getPayrollConceptTypes(branchId);
  }

  @Post('concept-types')
  @RequirePermissions('hr:concepts:manage')
  @ApiOperation({
    summary: 'Create a payroll concept type',
    description: 'Crea un concepto con su expresión de cálculo y mapa contable',
  })
  @ApiBody({ type: CreatePayrollConceptDto })
  @ApiResponse({ status: 201, description: 'Concept created', type: PayrollConceptResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid expression' })
  @ApiResponse({ status: 409, description: 'Concept code already exists' })
  async createPayrollConcept(
    @Body() dto: CreatePayrollConceptDto,
    @CurrentBranch() branchId: string
  ): Promise<PayrollConceptResponseDto> {
    return this.hrService.createPayrollConcept(dto, branchId);
  }

  @Patch('concept-types/:id')
  @RequirePermissions('hr:concepts:manage')
  @ApiOperation({
    summary: 'Update a payroll concept type',
    description: 'Actualiza el concepto; los runs ya procesados conservan sus importes',
  })
  @ApiBody({ type: UpdatePayrollConceptDto })
  @ApiResponse({ status: 200, description: 'Concept updated', type: PayrollConceptResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid expression' })
  @ApiResponse({ status: 404, description: 'Concept not found' })
  async updatePayrollConcept(
    @Param('id') id: string,
    @Body() dto: UpdatePayrollConceptDto,
    @CurrentBranch() branchId: string
  ): Promise<PayrollConceptResponseDto> {
    return this.hrService.updatePayrollConcept(id, dto, branchId);
  }

  @Delete('concept-types/:id')
  @RequirePermissions('hr:concepts:manage')
  @ApiOperation({
    summary: 'Delete a payroll concept type',
    description: 'Elimina el concepto si no es de sistema ni se usó en una nómina',
  })
  @ApiResponse({
    status: 200,
    description: 'Concept deleted',
    schema: { example: { deleted: true } },
  })
  @ApiResponse({ status: 404, description: 'Concept not found' })
  @ApiResponse({ status: 409, description: 'System concept or already used in a payroll' })
  async deletePayrollConcept(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<{ deleted: true }> {
    return this.hrService.deletePayrollConcept(id, branchId);
  }

  @Get('employees/:id/vacations')
  @RequirePermissions('hr:employees:view')
  @ApiOperation({
    summary: 'Get vacation entitlement and pending days',
    description: 'Días de vacaciones causados, disfrutados y pendientes según LOTTT',
  })
  @ApiQuery({ name: 'asOf', required: false })
  @ApiResponse({ status: 200, description: 'Vacation summary', type: VacationSummaryDto })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async getVacationSummary(
    @Param('id') id: string,
    @CurrentBranch() branchId: string,
    @Query('asOf') asOf?: string
  ): Promise<VacationSummaryDto> {
    return this.hrService.getVacationSummary(id, branchId, asOf);
  }

  @Post('employees/:id/vacations')
  @RequirePermissions('hr:payroll:process')
  @ApiOperation({
    summary: 'Register a vacation period and compute vacation and bonus pay',
    description:
      'Registra el período disfrutado y calcula el pago de vacaciones y el bono vacacional',
  })
  @ApiBody({ type: RegisterVacationDto })
  @ApiResponse({
    status: 201,
    description: 'Vacation registered',
    type: VacationSummaryDto,
  })
  @ApiResponse({ status: 400, description: 'More days than entitled' })
  @ApiResponse({ status: 409, description: 'Vacation period already registered for that year' })
  async registerVacation(
    @Param('id') id: string,
    @Body() dto: RegisterVacationDto,
    @CurrentBranch() branchId: string
  ): Promise<VacationSummaryDto & { vacationAmount: number; bonusAmount: number }> {
    return this.hrService.registerVacation(id, dto, branchId);
  }

  @Get('employees/:id/benefits')
  @RequirePermissions('hr:payroll:view')
  @ApiOperation({
    summary: 'Get severance benefits: both modalities and the payable one',
    description:
      'Prestaciones acumuladas en ambas modalidades (garantía y retroactivo) e indica la pagadera',
  })
  @ApiQuery({ name: 'asOf', required: false })
  @ApiResponse({ status: 200, description: 'Benefits summary', type: BenefitsSummaryDto })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async getBenefitsSummary(
    @Param('id') id: string,
    @CurrentBranch() branchId: string,
    @Query('asOf') asOf?: string
  ): Promise<BenefitsSummaryDto> {
    return this.hrService.getBenefitsSummary(id, branchId, asOf);
  }

  @Post('employees/:id/benefits/deposit')
  @RequirePermissions('hr:payroll:process')
  @ApiOperation({
    summary: 'Deposit the quarterly severance guarantee',
    description: 'Registra el depósito trimestral de la garantía de prestaciones',
  })
  @ApiBody({ type: DepositBenefitDto })
  @ApiResponse({ status: 201, description: 'Deposit registered', type: BenefitsSummaryDto })
  @ApiResponse({ status: 409, description: 'Quarter already deposited' })
  async depositBenefitGuarantee(
    @Param('id') id: string,
    @Body() dto: DepositBenefitDto,
    @CurrentBranch() branchId: string
  ): Promise<BenefitsSummaryDto> {
    return this.hrService.depositBenefitGuarantee(id, dto, branchId);
  }

  @Post('employees/:id/profit-sharing')
  @RequirePermissions('hr:payroll:process')
  @ApiOperation({
    summary: 'Register annual profit sharing (utilidades)',
    description: 'Registra las utilidades del ejercicio con los días a pagar',
  })
  @ApiBody({ type: RegisterProfitSharingDto })
  @ApiResponse({
    status: 201,
    description: 'Profit sharing registered',
    schema: {
      example: {
        employeeId: '550e8400-e29b-41d4-a716-446655440000',
        year: 2025,
        days: 30,
        amount: 1200.5,
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Profit sharing already registered for that year' })
  async registerProfitSharing(
    @Param('id') id: string,
    @Body() dto: RegisterProfitSharingDto,
    @CurrentBranch() branchId: string
  ): Promise<{ employeeId: string; year: number; days: number; amount: number }> {
    return this.hrService.registerProfitSharing(id, dto, branchId);
  }

  @Get('employees/:id/settlement')
  @RequirePermissions('hr:payroll:view')
  @ApiOperation({
    summary: 'Get the registered settlement of an employee',
    description: 'Liquidación registrada: prestaciones, vacaciones, utilidades e indemnización',
  })
  @ApiResponse({ status: 200, description: 'Settlement', type: SettlementResponseDto })
  @ApiResponse({ status: 404, description: 'Employee not found or not settled' })
  async getSettlement(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<SettlementResponseDto> {
    return this.hrService.getSettlement(id, branchId);
  }

  @Post('employees/:id/settle')
  @RequirePermissions('hr:payroll:process')
  @ApiOperation({
    summary: 'Settle the employee termination: benefits, vacations, profit sharing and indemnity',
    description:
      'Calcula y registra la liquidación final según el motivo de terminación, y la contabiliza',
  })
  @ApiBody({ type: SettleEmployeeDto })
  @ApiResponse({ status: 201, description: 'Settlement registered', type: SettlementResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid termination cause' })
  @ApiResponse({ status: 409, description: 'Employee already settled' })
  async settleEmployee(
    @Param('id') id: string,
    @Body() dto: SettleEmployeeDto,
    @CurrentBranch() branchId: string,
    @CurrentUser() user: CurrentUserData
  ): Promise<SettlementResponseDto> {
    return this.hrService.settleEmployee(id, dto, branchId, user.id);
  }
}
