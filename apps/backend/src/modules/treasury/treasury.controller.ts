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
import { TreasuryService } from './services/treasury.service';
import { DailyCloseService } from './operations/daily-close.service';
import { ReconciliationService } from './operations/reconciliation.service';
import { PettyCashService } from './operations/petty-cash.service';
import {
  CreatePaymentDto,
  PaymentResponseDto,
  PaymentMethodResponseDto,
  BankAccountResponseDto,
  CreatePaymentMethodDto,
  CreateBankAccountDto,
  PartnerStatementDto,
  PaymentStatus,
} from './dto/treasury.dto';
import {
  CloseDailyCloseDto,
  ClosePettyCashFundDto,
  CreatePettyCashFundDto,
  CreatePettyCashMovementDto,
  DailyCloseDetailDto,
  ImportStatementDto,
  MatchStatementLineDto,
  PettyCashFundResponseDto,
  ReconciliationReportDto,
  ReopenDailyCloseDto,
  StatementLineDto,
  UpdateBankAccountDto,
  UpdatePaymentMethodDto,
} from './dto/treasury-operations.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';

@ApiTags('treasury')
@Controller('v1/treasury')
export class TreasuryController {
  constructor(
    private readonly treasuryService: TreasuryService,
    private readonly dailyClose: DailyCloseService = new DailyCloseService(),
    private readonly reconciliation: ReconciliationService = new ReconciliationService(),
    private readonly pettyCash: PettyCashService = new PettyCashService()
  ) {}

  @Get('payments')
  @ApiOperation({
    summary: 'Get all payments',
    description: 'Retrieves a list of all payments with optional filtering',
  })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiResponse({
    status: 200,
    description: 'List of payments',
    type: [PaymentResponseDto],
  })
  async findAllPayments(
    @CurrentBranch() branchId: string,
    @Query('status') status?: PaymentStatus
  ): Promise<PaymentResponseDto[]> {
    return this.treasuryService.findAll(branchId, status);
  }

  @Get('payments/:id')
  @ApiOperation({
    summary: 'Get payment by ID',
    description: 'Retrieves a specific payment',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment details',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async findOnePayment(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<PaymentResponseDto> {
    return this.treasuryService.findOne(id, branchId);
  }

  @Post('payments')
  @ApiOperation({
    summary: 'Create a new payment',
    description: 'Creates a new payment and updates bank balances',
  })
  @ApiBody({ type: CreatePaymentDto })
  @ApiResponse({
    status: 201,
    description: 'Payment created successfully',
    type: PaymentResponseDto,
  })
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @CurrentUser() user: CurrentUserData,
    @CurrentBranch() branchId: string
  ): Promise<PaymentResponseDto> {
    return this.treasuryService.create(createPaymentDto, user.id, branchId);
  }

  @Post('payments/:id/void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Void a payment',
    description:
      'Executes the 8-step void process: validates CN, reverses bank, frees usages, deletes NCs, cleans retentions, removes allocations, cleans links, reopens invoices',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment voided successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Payment already void or has spent child credit notes' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async voidPayment(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentBranch() branchId: string
  ): Promise<PaymentResponseDto> {
    return this.treasuryService.voidPayment(id, userId, branchId);
  }

  @Get('retentions')
  @ApiOperation({
    summary: 'Comprobantes de retención emitidos',
    description: 'Retenciones IVA/ISLR de la sucursal con su factura de origen',
  })
  @ApiQuery({ name: 'partnerId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['IVA', 'ISLR'] })
  @ApiQuery({ name: 'from', required: false, example: '2026-10-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-10-31' })
  @ApiResponse({ status: 200, description: 'Comprobantes de retención' })
  async findRetentions(
    @CurrentBranch() branchId: string,
    @Query('partnerId') partnerId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.treasuryService.findRetentions({ branchId, partnerId, type, from, to });
  }

  @Get('methods')
  @ApiOperation({
    summary: 'Get payment methods',
    description: 'Retrieves all available payment methods',
  })
  @ApiResponse({
    status: 200,
    description: 'List of payment methods',
    type: [PaymentMethodResponseDto],
  })
  async getMethods(@CurrentBranch() branchId: string): Promise<PaymentMethodResponseDto[]> {
    return this.treasuryService.getMethods(branchId);
  }

  @Get('methods/all')
  @ApiOperation({
    summary: 'Métodos de pago incluidos los desactivados',
    description: 'Pantalla de administración: un método desactivado no aparece al cobrar',
  })
  @ApiResponse({ status: 200, type: [PaymentMethodResponseDto] })
  async getAllMethods(@CurrentBranch() branchId: string): Promise<PaymentMethodResponseDto[]> {
    return this.treasuryService.getAllMethods(branchId);
  }

  @Patch('methods/:id')
  @ApiOperation({
    summary: 'Actualizar un método de pago',
    description: 'Nombre, banderas (IGTF, referencia, efectivo) y activación',
  })
  @ApiBody({ type: UpdatePaymentMethodDto })
  @ApiResponse({ status: 200, type: PaymentMethodResponseDto })
  async updateMethod(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto
  ): Promise<PaymentMethodResponseDto> {
    return this.treasuryService.updateMethod(id, dto);
  }

  @Post('methods')
  @ApiOperation({
    summary: 'Create a payment method',
    description: 'Creates a new payment method',
  })
  @ApiBody({ type: CreatePaymentMethodDto })
  @ApiResponse({
    status: 201,
    description: 'Payment method created',
    type: PaymentMethodResponseDto,
  })
  async createMethod(
    @Body() createMethodDto: CreatePaymentMethodDto
  ): Promise<PaymentMethodResponseDto> {
    return this.treasuryService.createMethod(createMethodDto);
  }

  @Get('bank-accounts')
  @ApiOperation({
    summary: 'Get bank accounts',
    description: 'Retrieves all bank accounts with balances',
  })
  @ApiResponse({
    status: 200,
    description: 'List of bank accounts',
    type: [BankAccountResponseDto],
  })
  async getBankAccounts(@CurrentBranch() branchId: string): Promise<BankAccountResponseDto[]> {
    return this.treasuryService.getBankAccounts(branchId);
  }

  @Post('bank-accounts')
  @ApiOperation({
    summary: 'Create a bank account',
    description: 'Creates a new bank account',
  })
  @ApiBody({ type: CreateBankAccountDto })
  @ApiResponse({
    status: 201,
    description: 'Bank account created',
    type: BankAccountResponseDto,
  })
  async createBankAccount(
    @Body() createBankAccountDto: CreateBankAccountDto
  ): Promise<BankAccountResponseDto> {
    return this.treasuryService.createBankAccount(createBankAccountDto);
  }

  @Patch('bank-accounts/:id')
  @ApiOperation({
    summary: 'Actualizar una cuenta bancaria',
    description: 'Nombre, número, banco, saldo inicial, notas y activación (T-05-02)',
  })
  @ApiBody({ type: UpdateBankAccountDto })
  @ApiResponse({ status: 200, type: BankAccountResponseDto })
  async updateBankAccount(
    @Param('id') id: string,
    @CurrentBranch() branchId: string,
    @Body() dto: UpdateBankAccountDto
  ): Promise<BankAccountResponseDto> {
    return this.treasuryService.updateBankAccount(id, branchId, dto);
  }

  @Get('statements/:partnerId')
  @ApiOperation({
    summary: 'Get partner statement',
    description: 'Retrieves payment history and outstanding invoices for a partner',
  })
  @ApiResponse({
    status: 200,
    description: 'Partner statement',
    type: PartnerStatementDto,
  })
  @ApiResponse({ status: 404, description: 'Partner not found' })
  async getPartnerStatement(
    @Param('partnerId') partnerId: string,
    @CurrentBranch() branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ): Promise<PartnerStatementDto> {
    return this.treasuryService.getPartnerStatement(partnerId, branchId, { from, to });
  }

  @Get('daily-close/:date')
  @ApiOperation({
    summary: 'Cierre diario de una fecha',
    description:
      'Totales por método y moneda. Si el día está cerrado devuelve el snapshot guardado (T-05-03)',
  })
  @ApiResponse({ status: 200, type: DailyCloseDetailDto })
  async getDailyCloseByDate(
    @Param('date') date: string,
    @CurrentBranch() branchId: string
  ): Promise<DailyCloseDetailDto> {
    return this.dailyClose.summary(branchId, date);
  }

  @Post('daily-close/:date/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar el día',
    description: 'Guarda el snapshot de totales y bloquea nuevos movimientos con esa fecha',
  })
  @ApiBody({ type: CloseDailyCloseDto })
  @ApiResponse({ status: 200, type: DailyCloseDetailDto })
  @ApiResponse({ status: 409, description: 'El día ya estaba cerrado' })
  async closeDailyClose(
    @Param('date') date: string,
    @CurrentBranch() branchId: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CloseDailyCloseDto
  ): Promise<DailyCloseDetailDto> {
    return this.dailyClose.close(branchId, date, user?.id ?? null, dto);
  }

  @Post('daily-close/:date/reopen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reabrir el día',
    description: 'Exige motivo y queda auditado; recalcula los totales al leer',
  })
  @ApiBody({ type: ReopenDailyCloseDto })
  @ApiResponse({ status: 200, type: DailyCloseDetailDto })
  async reopenDailyClose(
    @Param('date') date: string,
    @CurrentBranch() branchId: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ReopenDailyCloseDto
  ): Promise<DailyCloseDetailDto> {
    return this.dailyClose.reopen(branchId, date, user?.id ?? null, dto.reason);
  }

  @Get('daily-close')
  @ApiOperation({
    summary: 'Cierre diario (compatibilidad)',
    description: 'Igual que `/daily-close/:date` con la fecha por query string',
  })
  @ApiQuery({ name: 'date', required: true, description: 'Date in YYYY-MM-DD format' })
  @ApiResponse({ status: 200, type: DailyCloseDetailDto })
  async getDailyClose(
    @Query('date') date: string,
    @CurrentBranch() branchId: string
  ): Promise<DailyCloseDetailDto> {
    return this.dailyClose.summary(branchId, date);
  }

  // -- Conciliación bancaria (T-05-04, T-05-05)

  @Post('reconciliation/import')
  @ApiOperation({
    summary: 'Importar extracto bancario (CSV)',
    description: 'Formato fecha,monto,referencia,descripción. Es idempotente por hash del archivo',
  })
  @ApiBody({ type: ImportStatementDto })
  @ApiResponse({ status: 201, description: 'Líneas importadas' })
  async importStatement(
    @CurrentBranch() branchId: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ImportStatementDto
  ) {
    return this.reconciliation.importCsv(branchId, user?.id ?? null, dto);
  }

  @Get('reconciliation/:bankAccountId')
  @ApiOperation({
    summary: 'Estado de conciliación de una cuenta',
    description: 'Líneas del extracto, pagos sin conciliar y sugerencias por monto y fecha',
  })
  @ApiResponse({ status: 200, type: ReconciliationReportDto })
  async getReconciliation(
    @Param('bankAccountId') bankAccountId: string,
    @CurrentBranch() branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ): Promise<ReconciliationReportDto> {
    return this.reconciliation.report(branchId, bankAccountId, { from, to });
  }

  @Post('reconciliation/:lineId/match')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Conciliar una línea con un pago',
    description: 'Una línea se concilia con un pago y viceversa (`409` si ya está tomado)',
  })
  @ApiBody({ type: MatchStatementLineDto })
  @ApiResponse({ status: 200, type: StatementLineDto })
  async matchLine(
    @Param('lineId') lineId: string,
    @CurrentBranch() branchId: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: MatchStatementLineDto
  ): Promise<StatementLineDto> {
    return this.reconciliation.match(branchId, lineId, dto.paymentId, user?.id ?? null);
  }

  @Post('reconciliation/:lineId/unmatch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desconciliar una línea' })
  @ApiResponse({ status: 200, type: StatementLineDto })
  async unmatchLine(
    @Param('lineId') lineId: string,
    @CurrentBranch() branchId: string
  ): Promise<StatementLineDto> {
    return this.reconciliation.unmatch(branchId, lineId);
  }

  // -- Caja chica (T-05-07)

  @Get('petty-cash')
  @ApiOperation({ summary: 'Fondos de caja chica de la sucursal' })
  @ApiResponse({ status: 200, type: [PettyCashFundResponseDto] })
  async listPettyCash(@CurrentBranch() branchId: string): Promise<PettyCashFundResponseDto[]> {
    return this.pettyCash.list(branchId);
  }

  @Post('petty-cash')
  @ApiOperation({ summary: 'Crear un fondo de caja chica' })
  @ApiBody({ type: CreatePettyCashFundDto })
  @ApiResponse({ status: 201, type: PettyCashFundResponseDto })
  async createPettyCash(
    @CurrentBranch() branchId: string,
    @Body() dto: CreatePettyCashFundDto
  ): Promise<PettyCashFundResponseDto> {
    return this.pettyCash.create(branchId, dto);
  }

  @Get('petty-cash/:id')
  @ApiOperation({ summary: 'Detalle de un fondo' })
  @ApiResponse({ status: 200, type: PettyCashFundResponseDto })
  async getPettyCash(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<PettyCashFundResponseDto> {
    return this.pettyCash.findOne(branchId, id);
  }

  @Post('petty-cash/:id/movements')
  @ApiOperation({
    summary: 'Registrar gasto o reposición',
    description: 'El fondo nunca queda negativo (regla 5 de S-05)',
  })
  @ApiBody({ type: CreatePettyCashMovementDto })
  @ApiResponse({ status: 201, type: PettyCashFundResponseDto })
  async addPettyCashMovement(
    @Param('id') id: string,
    @CurrentBranch() branchId: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreatePettyCashMovementDto
  ): Promise<PettyCashFundResponseDto> {
    return this.pettyCash.addMovement(branchId, id, dto, user?.id ?? null);
  }

  @Post('petty-cash/:id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar el fondo devolviendo el saldo' })
  @ApiBody({ type: ClosePettyCashFundDto })
  @ApiResponse({ status: 200, type: PettyCashFundResponseDto })
  async closePettyCash(
    @Param('id') id: string,
    @CurrentBranch() branchId: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ClosePettyCashFundDto
  ): Promise<PettyCashFundResponseDto> {
    return this.pettyCash.close(branchId, id, user?.id ?? null, dto);
  }

  @Get('available-credit-notes')
  @ApiOperation({
    summary: 'Get available credit notes',
    description: 'Retrieves credit notes with unused balance for a partner',
  })
  @ApiQuery({ name: 'partnerId', required: true })
  @ApiResponse({ status: 200, description: 'List of available credit notes' })
  async getAvailableCreditNotes(@Query('partnerId') partnerId: string): Promise<any[]> {
    return this.treasuryService.getAvailableCreditNotes(partnerId);
  }
}
