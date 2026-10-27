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
  ApiParam,
} from '@nestjs/swagger';
import { AccountingService } from './accounting.service';
import {
  CreateAccountDto,
  UpdateAccountDto,
  AccountResponseDto,
  AccountTreeDto,
  CreateEntryDto,
  UpdateEntryDto,
  EntryResponseDto,
  CreateMapDto,
  MapResponseDto,
  AccountingMapApplyResponseDto,
  PeriodResponseDto,
  ReopenPeriodDto,
} from './dto/accounting.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('accounting')
@Controller('v1/accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('accounts')
  @RequirePermissions('finance:accounts:view')
  @ApiOperation({
    summary: 'Get all accounts',
    description: 'Retrieves all accounts in a tree structure grouped by account type',
  })
  @ApiResponse({
    status: 200,
    description: 'List of accounts in tree structure',
    type: [AccountTreeDto],
  })
  async findAllAccounts(): Promise<AccountTreeDto[]> {
    return this.accountingService.findAllAccounts();
  }

  @Get('accounts/:id')
  @RequirePermissions('finance:accounts:view')
  @ApiOperation({
    summary: 'Get account by ID',
    description: 'Retrieves a specific account',
  })
  @ApiParam({
    name: 'id',
    description: 'Account UUID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiResponse({
    status: 200,
    description: 'Account details',
    type: AccountResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Account not found',
  })
  async findOneAccount(@Param('id') id: string): Promise<AccountResponseDto> {
    return this.accountingService.findOneAccount(id);
  }

  @Post('accounts')
  @RequirePermissions('finance:accounts:manage')
  @ApiOperation({
    summary: 'Create a new account',
    description: 'Creates a new accounting account',
  })
  @ApiResponse({
    status: 201,
    description: 'Account created successfully',
    type: AccountResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or account code already exists',
  })
  async createAccount(@Body() createAccountDto: CreateAccountDto): Promise<AccountResponseDto> {
    return this.accountingService.createAccount(createAccountDto);
  }

  @Patch('accounts/:id')
  @RequirePermissions('finance:accounts:manage')
  @ApiOperation({
    summary: 'Update an account',
    description:
      'No permite cambiar el tipo de una cuenta con movimientos ni volver imputable una cuenta con hijas',
  })
  @ApiResponse({ status: 200, description: 'Account updated', type: AccountResponseDto })
  @ApiResponse({ status: 409, description: 'La cuenta tiene movimientos o cuentas hijas' })
  async updateAccount(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto
  ): Promise<AccountResponseDto> {
    return this.accountingService.updateAccount(id, dto);
  }

  @Delete('accounts/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('finance:accounts:manage')
  @ApiOperation({
    summary: 'Delete an account',
    description: 'Desactiva la cuenta. Responde 409 si tiene movimientos o cuentas hijas (T-04-01)',
  })
  @ApiResponse({ status: 200, description: 'Account deactivated' })
  @ApiResponse({ status: 409, description: 'La cuenta tiene movimientos o cuentas hijas' })
  async deleteAccount(@Param('id') id: string): Promise<{ deleted: true; deactivated: true }> {
    return this.accountingService.deleteAccount(id);
  }

  @Get('entries')
  @RequirePermissions('finance:entries:view')
  @ApiOperation({
    summary: 'Get all entries',
    description: 'Retrieves all accounting entries with optional filters',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Desde (YYYY-MM-DD). Alias de `dateFrom`',
    example: '2026-10-01',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Hasta (YYYY-MM-DD). Alias de `dateTo`',
    example: '2026-10-31',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Filter entries from this date (compatibilidad)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'Filter entries up to this date (compatibilidad)',
    example: '2026-12-31T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'accountId',
    required: false,
    description: 'Filter entries containing this account',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiQuery({
    name: 'sourceType',
    required: false,
    description: 'Filtra por documento de origen',
    enum: ['INVOICE', 'PAYMENT', 'CREDIT_NOTE', 'PAYROLL', 'INVENTORY', 'MANUAL'],
  })
  @ApiResponse({
    status: 200,
    description: 'List of entries',
    type: [EntryResponseDto],
  })
  async findAllEntries(
    @CurrentBranch() branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('accountId') accountId?: string,
    @Query('sourceType') sourceType?: string
  ): Promise<EntryResponseDto[]> {
    return this.accountingService.findAllEntries({
      dateFrom: this.toStartOfDay(from ?? dateFrom),
      dateTo: this.toEndOfDay(to ?? dateTo),
      accountId,
      sourceType,
      branchId,
    });
  }

  /**
   * `from`/`to` llegan como fecha simple; sin hora, `new Date('2026-10-31')` es medianoche UTC y
   * dejaría fuera los asientos del propio día. Se normaliza el extremo.
   */
  private toStartOfDay(value?: string): string | undefined {
    if (!value) return undefined;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  }

  private toEndOfDay(value?: string): string | undefined {
    if (!value) return undefined;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value;
  }

  @Get('entries/:id')
  @ApiOperation({
    summary: 'Get entry by ID',
    description: 'Retrieves a specific entry with its lines',
  })
  @ApiParam({
    name: 'id',
    description: 'Entry UUID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @ApiResponse({
    status: 200,
    description: 'Entry details with lines',
    type: EntryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Entry not found',
  })
  async findOneEntry(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<EntryResponseDto> {
    return this.accountingService.findOneEntry(id, branchId);
  }

  @Post('entries')
  @RequirePermissions('finance:entries:create')
  @ApiOperation({
    summary: 'Create a new entry',
    description:
      'Crea un asiento. Las líneas deben sumar cero; `status: DRAFT` lo deja editable sin afectar el libro',
  })
  @ApiResponse({
    status: 201,
    description: 'Entry created successfully',
    type: EntryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data, entry lines do not sum to zero or account not postable',
  })
  @ApiResponse({ status: 409, description: 'El período está cerrado' })
  async createEntry(
    @Body() createEntryDto: CreateEntryDto,
    @CurrentUser('id') userId?: string
  ): Promise<EntryResponseDto> {
    return this.accountingService.createEntry({
      ...createEntryDto,
      userId: createEntryDto.userId ?? userId,
    });
  }

  @Patch('entries/:id')
  @RequirePermissions('finance:entries:create')
  @ApiOperation({
    summary: 'Update a draft entry',
    description: 'Sólo se puede editar un asiento en borrador (T-04-02)',
  })
  @ApiResponse({ status: 200, description: 'Entry updated', type: EntryResponseDto })
  @ApiResponse({ status: 409, description: 'El asiento ya está posteado' })
  async updateEntry(
    @Param('id') id: string,
    @Body() dto: UpdateEntryDto
  ): Promise<EntryResponseDto> {
    return this.accountingService.updateEntry(id, dto);
  }

  @Post('entries/:id/post')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('finance:entries:post')
  @ApiOperation({
    summary: 'Post a draft entry',
    description: 'DRAFT → POSTED. Valida partida doble, cuentas imputables y período abierto',
  })
  @ApiResponse({ status: 200, description: 'Entry posted', type: EntryResponseDto })
  @ApiResponse({ status: 409, description: 'Ya está posteado o el período está cerrado' })
  async postEntry(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string
  ): Promise<EntryResponseDto> {
    return this.accountingService.postEntry(id, userId);
  }

  @Post('entries/from-invoice/:invoiceId')
  @ApiOperation({
    summary: 'Create entry from invoice',
    description: 'Creates an accounting entry automatically from an invoice using accounting maps',
  })
  @ApiParam({
    name: 'invoiceId',
    description: 'Invoice UUID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @ApiResponse({
    status: 201,
    description: 'Entry created successfully',
    type: EntryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  @ApiResponse({
    status: 400,
    description: 'No accounting map found for this invoice type',
  })
  async createEntryFromInvoice(@Param('invoiceId') invoiceId: string): Promise<EntryResponseDto> {
    return this.accountingService.createEntryFromInvoice(invoiceId);
  }

  @Post('entries/from-payment/:paymentId')
  @ApiOperation({
    summary: 'Create entry from payment',
    description: 'Creates an accounting entry automatically from a payment using accounting maps',
  })
  @ApiParam({
    name: 'paymentId',
    description: 'Payment UUID',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  @ApiResponse({
    status: 201,
    description: 'Entry created successfully',
    type: EntryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Payment not found',
  })
  @ApiResponse({
    status: 400,
    description: 'No accounting map found for this payment type',
  })
  async createEntryFromPayment(@Param('paymentId') paymentId: string): Promise<EntryResponseDto> {
    return this.accountingService.createEntryFromPayment(paymentId);
  }

  @Get('maps')
  @RequirePermissions('finance:accounts:view')
  @ApiOperation({
    summary: 'Get all maps',
    description: 'Retrieves all accounting maps with optional filters',
  })
  @ApiQuery({
    name: 'module',
    required: false,
    description: 'Filter by module',
    example: 'INVOICE',
  })
  @ApiQuery({
    name: 'branchId',
    required: false,
    description: 'Filter by branch ID',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  @ApiResponse({
    status: 200,
    description: 'List of accounting maps',
    type: [MapResponseDto],
  })
  async findAllMaps(
    @CurrentBranch() branchId: string,
    @Query('module') module?: string
  ): Promise<MapResponseDto[]> {
    return this.accountingService.findAllMaps({ module, branchId });
  }

  @Post('maps')
  @RequirePermissions('finance:accounts:manage')
  @ApiOperation({
    summary: 'Create a new map',
    description: 'Creates a new accounting map for automatic entry generation',
  })
  @ApiResponse({
    status: 201,
    description: 'Map created successfully',
    type: MapResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  async createMap(@Body() createMapDto: CreateMapDto): Promise<MapResponseDto> {
    return this.accountingService.createMap(createMapDto);
  }

  @Post('maps/:id/apply/:transactionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Apply map to transaction',
    description:
      'Applies an accounting map to a transaction (invoice or payment) to generate an entry',
  })
  @ApiParam({
    name: 'id',
    description: 'Map UUID',
    example: '550e8400-e29b-41d4-a716-446655440006',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Transaction UUID (invoice or payment ID)',
    example: '550e8400-e29b-41d4-a716-446655440007',
  })
  @ApiResponse({
    status: 200,
    description: 'Map applied successfully',
    type: AccountingMapApplyResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Map or transaction not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Unsupported module or no map found for transaction type',
  })
  async applyMapToTransaction(
    @Param('id') id: string,
    @Param('transactionId') transactionId: string
  ): Promise<AccountingMapApplyResponseDto> {
    return this.accountingService.applyMapToTransaction(id, transactionId);
  }

  // ── Cierre de período (T-04-04) ─────────────────────────────────────────────────────────────

  @Get('periods')
  @RequirePermissions('finance:close:view')
  @ApiOperation({
    summary: 'List the accounting periods of a year',
    description: 'Materializa los 12 meses (los que faltan nacen OPEN) y resume asientos y totales',
  })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  @ApiResponse({ status: 200, description: 'Períodos del año', type: [PeriodResponseDto] })
  async findPeriods(
    @CurrentBranch() branchId: string,
    @Query('year') year?: string
  ): Promise<PeriodResponseDto[]> {
    const target = year ? Number(year) : new Date().getUTCFullYear();
    return this.accountingService.listPeriods(target, branchId);
  }

  @Post('periods/:id/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('finance:close:manage')
  @ApiOperation({
    summary: 'Close an accounting period',
    description: 'Un período cerrado rechaza asientos con 409. Queda auditado con usuario y fecha',
  })
  @ApiResponse({ status: 200, description: 'Período cerrado', type: PeriodResponseDto })
  @ApiResponse({ status: 409, description: 'El período ya está cerrado' })
  async closePeriod(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentBranch() branchId: string
  ): Promise<PeriodResponseDto> {
    return this.accountingService.closePeriod(id, userId, branchId);
  }

  @Post('periods/:id/reopen')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('finance:close:manage')
  @ApiOperation({
    summary: 'Reopen an accounting period',
    description: 'Exige motivo; el motivo y el usuario quedan en la auditoría',
  })
  @ApiResponse({ status: 200, description: 'Período reabierto', type: PeriodResponseDto })
  @ApiResponse({ status: 400, description: 'Falta el motivo' })
  @ApiResponse({ status: 409, description: 'El período ya está abierto' })
  async reopenPeriod(
    @Param('id') id: string,
    @Body() dto: ReopenPeriodDto,
    @CurrentUser('id') userId: string,
    @CurrentBranch() branchId: string
  ): Promise<PeriodResponseDto> {
    return this.accountingService.reopenPeriod(id, dto.reason, userId, branchId);
  }
}
