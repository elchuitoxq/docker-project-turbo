import {
  Controller,
  Get,
  Post,
  Patch,
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
    @CurrentBranch() branchId: string
  ): Promise<PayrollSettingResponseDto[]> {
    return this.hrService.findPayrollSettings(branchId) as never;
  }

  @Patch('settings')
  @RequirePermissions('hr:settings:manage')
  @ApiOperation({ summary: 'Create or update a payroll setting' })
  @ApiResponse({ status: 200, description: 'Payroll setting stored' })
  async updatePayrollSetting(
    @Body() dto: UpdatePayrollSettingDto,
    @CurrentBranch() branchId: string
  ): Promise<PayrollSettingResponseDto> {
    return this.hrService.upsertPayrollSetting(dto, branchId) as never;
  }
  @Get('concept-types')
  @ApiOperation({ summary: 'Get payroll concept types' })
  @ApiResponse({ status: 200, description: 'List of concept types' })
  async getPayrollConceptTypes() {
    return this.hrService.getPayrollConceptTypes();
  }
}
