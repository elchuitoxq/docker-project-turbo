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
@Controller('v1/hr')
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Get('employees')
  @ApiOperation({ summary: 'Get all employees' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({ status: 200, description: 'List of employees', type: [EmployeeResponseDto] })
  async findAllEmployees(@CurrentBranch() branchId: string): Promise<EmployeeResponseDto[]> {
    return this.hrService.findAllEmployees(branchId);
  }

  @Get('employees/:id')
  @ApiOperation({ summary: 'Get employee by ID' })
  @ApiResponse({ status: 200, description: 'Employee details', type: EmployeeResponseDto })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findOneEmployee(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<EmployeeResponseDto> {
    return this.hrService.findOneEmployee(id, branchId);
  }

  @Post('employees')
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiBody({ type: CreateEmployeeDto })
  @ApiResponse({ status: 201, description: 'Employee created', type: EmployeeResponseDto })
  async createEmployee(@Body() createEmployeeDto: CreateEmployeeDto): Promise<EmployeeResponseDto> {
    return this.hrService.createEmployee(createEmployeeDto);
  }

  @Patch('employees/:id')
  @ApiOperation({ summary: 'Update an employee' })
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
  @ApiResponse({ status: 200, description: 'Employee terminated' })
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
  @ApiOperation({ summary: 'Get all departments' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({ status: 200, description: 'List of departments' })
  async findAllDepartments(@CurrentBranch() branchId: string) {
    return this.hrService.findAllDepartments(branchId);
  }

  @Patch('departments/:id')
  @RequirePermissions('hr:departments:manage')
  @ApiOperation({ summary: 'Update a department' })
  @ApiResponse({ status: 200, description: 'Department updated' })
  async updateDepartment(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.hrService.updateDepartment(id, dto);
  }

  @Post('departments')
  @ApiOperation({ summary: 'Create a department' })
  @ApiBody({ type: CreateDepartmentDto })
  @ApiResponse({ status: 201, description: 'Department created' })
  async createDepartment(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.hrService.createDepartment(createDepartmentDto);
  }

  @Get('positions')
  @ApiOperation({ summary: 'Get all job positions' })
  @ApiResponse({ status: 200, description: 'List of positions' })
  async findAllPositions() {
    return this.hrService.findAllPositions();
  }

  @Patch('positions/:id')
  @RequirePermissions('hr:positions:manage')
  @ApiOperation({ summary: 'Update a position' })
  @ApiResponse({ status: 200, description: 'Position updated' })
  async updatePosition(@Param('id') id: string, @Body() dto: UpdatePositionDto) {
    return this.hrService.updatePosition(id, dto);
  }

  @Post('positions')
  @ApiOperation({ summary: 'Create a job position' })
  @ApiBody({ type: CreatePositionDto })
  @ApiResponse({ status: 201, description: 'Position created' })
  async createPosition(@Body() createPositionDto: CreatePositionDto) {
    return this.hrService.createPosition(createPositionDto);
  }

  @Get('payroll')
  @ApiOperation({ summary: 'Get all payroll runs' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({ status: 200, description: 'List of payroll runs', type: [PayrollRunResponseDto] })
  async findAllPayrollRuns(@CurrentBranch() branchId: string): Promise<PayrollRunResponseDto[]> {
    return this.hrService.findAllPayrollRuns(branchId);
  }

  @Get('payroll/:id')
  @ApiOperation({ summary: 'Get payroll run by ID' })
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
  @ApiOperation({ summary: 'Get frozen payroll parameters of a run' })
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
  @ApiOperation({ summary: 'Process payroll run' })
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
  })
  @ApiResponse({ status: 200, description: 'Accounting entry created or reused' })
  @ApiResponse({ status: 400, description: 'Run in draft or concept without accounting map' })
  async postPayrollRun(
    @Param('id') id: string,
    @CurrentBranch() branchId: string,
    @CurrentUser() user: CurrentUserData
  ) {
    return this.hrService.postPayrollRun(id, branchId, user.id);
  }

  @Get('payroll/:runId/payslip/:itemId')
  @ApiOperation({ summary: 'Get payslip for employee' })
  @ApiResponse({ status: 200, description: 'Payslip data', type: PayslipDto })
  async getPayslip(
    @Param('runId') runId: string,
    @Param('itemId') itemId: string
  ): Promise<PayslipDto> {
    return this.hrService.getPayslip(runId, itemId);
  }

  @Get('incidents')
  @ApiOperation({ summary: 'Get payroll incidents' })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiResponse({ status: 200, description: 'List of incidents' })
  async findAllIncidents(@Query('employeeId') employeeId?: string) {
    return this.hrService.findAllIncidents(employeeId);
  }

  @Post('incidents')
  @ApiOperation({ summary: 'Create a payroll incident' })
  @ApiBody({ type: CreateIncidentDto })
  @ApiResponse({ status: 201, description: 'Incident created' })
  async createIncident(@Body() createIncidentDto: CreateIncidentDto) {
    return this.hrService.createIncident(createIncidentDto);
  }

  @Post('incidents/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('hr:incidents:approve')
  @ApiOperation({ summary: 'Approve a pending incident' })
  @ApiResponse({ status: 200, description: 'Incident approved' })
  @ApiResponse({ status: 409, description: 'Incident is not pending' })
  async approveIncident(@Param('id') id: string) {
    return this.hrService.setIncidentStatus(id, 'APPROVED');
  }

  @Post('incidents/:id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('hr:incidents:approve')
  @ApiOperation({ summary: 'Reject a pending incident' })
  @ApiResponse({ status: 200, description: 'Incident rejected' })
  @ApiResponse({ status: 409, description: 'Incident is not pending' })
  async rejectIncident(@Param('id') id: string) {
    return this.hrService.setIncidentStatus(id, 'REJECTED');
  }

  @Get('settings')
  @RequirePermissions('hr:settings:view')
  @ApiOperation({ summary: 'List payroll settings' })
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
  @ApiOperation({ summary: 'Create or update a payroll setting' })
  @ApiResponse({ status: 200, description: 'Payroll setting stored' })
  @ApiResponse({ status: 400, description: 'Invalid value for the parameter type' })
  async updatePayrollSetting(
    @Body() dto: UpdatePayrollSettingDto,
    @CurrentBranch() branchId: string
  ): Promise<PayrollSettingResponseDto> {
    return this.hrService.upsertPayrollSetting(dto, branchId);
  }

  @Get('concept-types')
  @RequirePermissions('hr:concepts:view')
  @ApiOperation({ summary: 'Get payroll concept types' })
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
  @ApiOperation({ summary: 'Create a payroll concept type' })
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
  @ApiOperation({ summary: 'Update a payroll concept type' })
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
  @ApiOperation({ summary: 'Delete a payroll concept type' })
  @ApiResponse({ status: 200, description: 'Concept deleted' })
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
  @ApiOperation({ summary: 'Get vacation entitlement and pending days' })
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
  @ApiOperation({ summary: 'Register a vacation period and compute vacation and bonus pay' })
  @ApiBody({ type: RegisterVacationDto })
  @ApiResponse({ status: 201, description: 'Vacation registered' })
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
  @ApiOperation({ summary: 'Get severance benefits: both modalities and the payable one' })
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
  @ApiOperation({ summary: 'Deposit the quarterly severance guarantee' })
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
  @ApiOperation({ summary: 'Register annual profit sharing (utilidades)' })
  @ApiBody({ type: RegisterProfitSharingDto })
  @ApiResponse({ status: 201, description: 'Profit sharing registered' })
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
  @ApiOperation({ summary: 'Get the registered settlement of an employee' })
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
