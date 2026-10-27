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
  ApiParam,
} from '@nestjs/swagger';
import { LoansService } from './loans.service';
import {
  CreateLoanDto,
  UpdateLoanDto,
  PayLoanDto,
  LoanResponseDto,
  LoanStatus,
} from './dto/loans.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';

@ApiTags('loans')
@Controller('v1/loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all loans',
    description: 'Retrieves a list of all loans with optional filters by employeeId and status',
  })
  @ApiQuery({
    name: 'employeeId',
    required: false,
    description: 'Filter by partner/employee ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by loan status',
    enum: LoanStatus,
    example: 'ACTIVE',
  })
  @ApiResponse({
    status: 200,
    description: 'List of loans',
    type: [LoanResponseDto],
  })
  async findAll(
    @CurrentBranch() branchId: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string
  ): Promise<LoanResponseDto[]> {
    return this.loansService.findAll({ employeeId, status }, branchId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get loan by ID',
    description: 'Retrieves a specific loan by its ID including its items',
  })
  @ApiParam({
    name: 'id',
    description: 'Loan UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Loan details with items',
    type: LoanResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Loan not found',
  })
  async findOne(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<LoanResponseDto> {
    return this.loansService.findOne(id, branchId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new loan',
    description: 'Creates a new loan with optional items',
  })
  @ApiResponse({
    status: 201,
    description: 'Loan created successfully',
    type: LoanResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Partner not found',
  })
  async create(
    @Body() createLoanDto: CreateLoanDto,
    @CurrentBranch() branchId: string
  ): Promise<LoanResponseDto> {
    return this.loansService.create(createLoanDto, branchId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a loan',
    description: "Updates an existing loan's information",
  })
  @ApiParam({
    name: 'id',
    description: 'Loan UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Loan updated successfully',
    type: LoanResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Loan not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateLoanDto: UpdateLoanDto,
    @CurrentBranch() branchId: string
  ): Promise<LoanResponseDto> {
    return this.loansService.update(id, updateLoanDto, branchId);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a loan',
    description: 'Approves a pending loan, changing its status from PENDING to ACTIVE',
  })
  @ApiParam({
    name: 'id',
    description: 'Loan UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Loan approved successfully',
    type: LoanResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Loan must be PENDING to approve',
  })
  @ApiResponse({
    status: 404,
    description: 'Loan not found',
  })
  async approve(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<LoanResponseDto> {
    return this.loansService.approve(id, branchId);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a loan',
    description: 'Rejects a pending loan, changing its status from PENDING to REJECTED',
  })
  @ApiParam({
    name: 'id',
    description: 'Loan UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Loan rejected successfully',
    type: LoanResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Loan must be PENDING to reject',
  })
  @ApiResponse({
    status: 404,
    description: 'Loan not found',
  })
  async reject(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<LoanResponseDto> {
    return this.loansService.reject(id, branchId);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record loan payment',
    description: 'Records payment items for an active loan by creating loan_items',
  })
  @ApiParam({
    name: 'id',
    description: 'Loan UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment recorded successfully',
    type: LoanResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Loan must be ACTIVE to record payment',
  })
  @ApiResponse({
    status: 404,
    description: 'Loan not found',
  })
  async pay(
    @Param('id') id: string,
    @Body() payLoanDto: PayLoanDto,
    @CurrentBranch() branchId: string
  ): Promise<LoanResponseDto> {
    return this.loansService.pay(id, payLoanDto, branchId);
  }
}
