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
import { PayablesService, type PayableStatus } from './purchasing/payables.service';
import { SupplierRetentionService } from './purchasing/supplier-retention.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  VoidInvoiceDto,
  InvoiceResponseDto,
  InvoiceStatsDto,
  InvoiceStatus,
  FiscalJsonDto,
} from './dto/billing.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('v1/billing/invoices')
@RequirePermissions('finance:view')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly payables: PayablesService = new PayablesService(),
    private readonly retentions: SupplierRetentionService = new SupplierRetentionService()
  ) {}

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
  @ApiQuery({ name: 'type', required: false, description: 'SALE o PURCHASE' })
  @ApiQuery({
    name: 'paginated',
    required: false,
    description: 'Con `true` devuelve { data, total, page, limit } (aditivo, no rompe clientes)',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'List of invoices',
    type: [InvoiceResponseDto],
  })
  async findAll(
    @CurrentBranch() branchId: string,
    @Query('status') status?: InvoiceStatus,
    @Query('type') type?: string,
    @Query('paginated') paginated?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<
    | InvoiceResponseDto[]
    | { data: InvoiceResponseDto[]; total: number; page: number; limit: number }
  > {
    if (paginated === 'true') {
      return this.billingService.findPaginated({
        branchId,
        status,
        type,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
    }

    return this.billingService.findAll(branchId, status, type);
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
  async getStats(
    @CurrentBranch() branchId: string,
    @Query('type') type?: string
  ): Promise<InvoiceStatsDto> {
    return this.billingService.getStats(branchId, type);
  }

  // Cuentas por pagar (T-03-05)

  @RequirePermissions('finance:payables:view')
  @Get('payables')
  @ApiOperation({
    summary: 'Cuentas por pagar por factura',
    description: 'Saldo = total ? pagado ? notas de crédito de compra. Sólo compras POSTED/PAID',
  })
  @ApiQuery({ name: 'partnerId', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'],
  })
  @ApiQuery({ name: 'asOf', required: false, example: '2026-10-31' })
  @ApiResponse({
    status: 200,
    description: 'Facturas por pagar con su saldo',
    schema: {
      example: [
        {
          invoiceId: '550e8400-e29b-41d4-a716-446655440000',
          code: 'COM-000045',
          supplierInvoiceNumber: '00012345',
          partnerId: '550e8400-e29b-41d4-a716-446655440001',
          partnerName: 'Suministros del Sur C.A.',
          partnerTaxId: 'J-98765432-1',
          issueDate: '2026-10-20',
          dueDate: '2026-11-19',
          currencyId: '550e8400-e29b-41d4-a716-446655440002',
          currencyCode: 'VES',
          total: 580,
          paid: 200,
          creditNotes: 0,
          retained: 80,
          balance: 300,
          exchangeRate: 1,
          totalBase: 580,
          balanceBase: 300,
          status: 'PARTIAL',
          daysOverdue: 0,
        },
      ],
    },
  })
  async findPayables(
    @CurrentBranch() branchId: string,
    @Query('partnerId') partnerId?: string,
    @Query('status') status?: PayableStatus,
    @Query('asOf') asOf?: string
  ) {
    return this.payables.list(branchId, { partnerId, status, asOf });
  }

  @RequirePermissions('finance:payables:view')
  @Get('payables/aging')
  @ApiOperation({
    summary: 'Antigüedad de saldos (aging)',
    description: 'Buckets: por vencer, 1-30, 31-60, 61-90 y más de 90 días',
  })
  @ApiQuery({ name: 'asOf', required: false, example: '2026-10-31' })
  @ApiResponse({
    status: 200,
    description: 'Antigüedad por bucket y por proveedor',
    schema: {
      example: {
        branchId: '550e8400-e29b-41d4-a716-446655440000',
        asOf: '2026-10-31',
        buckets: [
          { bucket: 'CURRENT', label: 'Por vencer', total: 1200, invoices: 3 },
          { bucket: 'D1_30', label: '1-30 días', total: 500, invoices: 1 },
          { bucket: 'D31_60', label: '31-60 días', total: 0, invoices: 0 },
          { bucket: 'D61_90', label: '61-90 días', total: 0, invoices: 0 },
          { bucket: 'D90_PLUS', label: 'Más de 90 días', total: 250, invoices: 1 },
        ],
        baseCurrencyCode: 'VES',
        byPartner: [
          {
            partnerId: '550e8400-e29b-41d4-a716-446655440001',
            partnerName: 'Suministros del Sur C.A.',
            partnerTaxId: 'J-98765432-1',
            total: 1950,
            overdue: 750,
          },
        ],
        totals: { balance: 1950, overdue: 750 },
      },
    },
  })
  async findPayablesAging(@CurrentBranch() branchId: string, @Query('asOf') asOf?: string) {
    return this.payables.aging(branchId, asOf);
  }

  // Parámetros de retención al proveedor (T-03-03)

  @Get('supplier-retention-settings')
  @ApiOperation({
    summary: 'Parámetros de retención al proveedor de la empresa',
    description:
      'Tasas de IVA (ordinario y especial), ISLR, sustraendo y umbral configurados para la empresa de la sucursal',
  })
  @ApiResponse({
    status: 200,
    description: 'Parámetros vigentes',
    schema: {
      example: {
        companyId: '550e8400-e29b-41d4-a716-446655440000',
        ivaRetentionRate: 75,
        ivaRetentionRateSpecial: 100,
        islrRate: 5,
        islrSustraendo: 0,
        islrThreshold: 1000,
      },
    },
  })
  async getRetentionSettings(@CurrentBranch() branchId: string) {
    return this.retentions.getSettings(await this.retentions.companyOfBranch(branchId));
  }

  @RequirePermissions('finance:invoices:edit')
  @Patch('supplier-retention-settings')
  @ApiOperation({
    summary: 'Actualizar parámetros de retención',
    description: 'IVA (ordinario y especial), ISLR y su umbral. Cambian por decreto: son parámetro',
  })
  @ApiResponse({
    status: 200,
    description: 'Parámetros actualizados',
    schema: {
      example: {
        companyId: '550e8400-e29b-41d4-a716-446655440000',
        ivaRetentionRate: 75,
        ivaRetentionRateSpecial: 100,
        islrRate: 5,
        islrSustraendo: 0,
        islrThreshold: 1000,
      },
    },
  })
  async updateRetentionSettings(
    @CurrentBranch() branchId: string,
    @Body()
    body: Partial<{
      ivaRetentionRate: number;
      ivaRetentionRateSpecial: number;
      islrRate: number;
      islrSustraendo: number;
      islrThreshold: number;
    }>
  ) {
    return this.retentions.updateSettings(await this.retentions.companyOfBranch(branchId), body);
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
    return this.billingService.findOneWithHistory(id, branchId);
  }

  @RequirePermissions('finance:invoices:create')
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

  @RequirePermissions('finance:invoices:edit')
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
    @CurrentBranch() branchId: string,
    @CurrentUser() user: CurrentUserData
  ): Promise<InvoiceResponseDto> {
    return this.billingService.update(id, updateInvoiceDto, branchId, user.id);
  }

  @RequirePermissions('finance:invoices:post')
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
    @CurrentBranch() branchId: string,
    @CurrentUser() user: CurrentUserData
  ): Promise<InvoiceResponseDto> {
    return this.billingService.post(id, branchId, user.id);
  }

  @RequirePermissions('finance:invoices:void')
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
  @ApiBody({ type: VoidInvoiceDto })
  async void(
    @Param('id') id: string,
    @Body() body: VoidInvoiceDto,
    @CurrentBranch() branchId: string,
    @CurrentUser() user: CurrentUserData
  ): Promise<InvoiceResponseDto> {
    return this.billingService.void(id, branchId, user.id, body?.reason);
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
