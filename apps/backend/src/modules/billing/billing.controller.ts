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
import { BillingService } from './services/billing.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceResponseDto,
  InvoiceStatsDto,
  InvoiceStatus,
  FiscalJsonDto,
} from './dto/billing.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';

@ApiTags('billing')
@Controller('v1/billing/invoices')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all invoices',
    description: 'Retrieves a list of all invoices with optional filtering by branch and status',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: InvoiceStatus,
    description: 'Filter by invoice status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of invoices',
    type: [InvoiceResponseDto],
  })
  async findAll(
    @CurrentBranch() branchId: string,
    @Query('status') status?: InvoiceStatus
  ): Promise<InvoiceResponseDto[]> {
    return this.billingService.findAll(branchId, status);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get invoice statistics',
    description: 'Retrieves aggregated statistics for invoices',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice statistics',
    type: InvoiceStatsDto,
  })
  async getStats(@CurrentBranch() branchId: string): Promise<InvoiceStatsDto> {
    return this.billingService.getStats(branchId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get invoice by ID',
    description: 'Retrieves a specific invoice with its items',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice details',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  async findOne(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<InvoiceResponseDto> {
    return this.billingService.findOne(id, branchId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new invoice',
    description: 'Creates a new invoice in DRAFT status with calculated totals (IVA, IGTF)',
  })
  @ApiBody({ type: CreateInvoiceDto })
  @ApiResponse({
    status: 201,
    description: 'Invoice created successfully',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or partner not found',
  })
  async create(
    @Body() createInvoiceDto: CreateInvoiceDto,
    @CurrentUser() user: CurrentUserData,
    @CurrentBranch() branchId: string
  ): Promise<InvoiceResponseDto> {
    return this.billingService.create(createInvoiceDto, user.id, branchId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an invoice',
    description: 'Updates an existing DRAFT invoice. Only DRAFT invoices can be updated.',
  })
  @ApiBody({ type: UpdateInvoiceDto })
  @ApiResponse({
    status: 200,
    description: 'Invoice updated successfully',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Only DRAFT invoices can be updated',
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateInvoiceDto: UpdateInvoiceDto,
    @CurrentBranch() branchId: string
  ): Promise<InvoiceResponseDto> {
    return this.billingService.update(id, updateInvoiceDto, branchId);
  }

  @Post(':id/post')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Post an invoice',
    description: 'Changes invoice status from DRAFT to POSTED and fiscal status to SENT',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice posted successfully',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Only DRAFT invoices can be posted',
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  async post(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<InvoiceResponseDto> {
    return this.billingService.post(id, branchId);
  }

  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Void an invoice',
    description: 'Changes invoice status to VOID. Already void invoices cannot be voided again.',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice voided successfully',
    type: InvoiceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invoice is already void',
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  async void(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<InvoiceResponseDto> {
    return this.billingService.void(id, branchId);
  }

  @Get(':id/fiscal-json')
  @ApiOperation({
    summary: 'Get fiscal JSON',
    description: 'Generates the fiscal JSON data for SENIAT compliance',
  })
  @ApiResponse({
    status: 200,
    description: 'Fiscal JSON data',
    type: FiscalJsonDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  async getFiscalJson(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<FiscalJsonDto> {
    return this.billingService.getFiscalJson(id, branchId);
  }
}
