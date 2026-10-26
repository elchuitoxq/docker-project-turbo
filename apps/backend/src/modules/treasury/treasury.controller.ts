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
import {
  CreatePaymentDto,
  PaymentResponseDto,
  PaymentMethodResponseDto,
  BankAccountResponseDto,
  CreatePaymentMethodDto,
  CreateBankAccountDto,
  PartnerStatementDto,
  DailyCloseDto,
  PaymentStatus,
} from './dto/treasury.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('treasury')
@Controller('v1/treasury')
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Get('payments')
  @ApiOperation({
    summary: 'Get all payments',
    description: 'Retrieves a list of all payments with optional filtering',
  })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiResponse({
    status: 200,
    description: 'List of payments',
    type: [PaymentResponseDto],
  })
  async findAllPayments(
    @Query('branchId') branchId?: string,
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
  async findOnePayment(@Param('id') id: string): Promise<PaymentResponseDto> {
    return this.treasuryService.findOne(id);
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
    @CurrentUser() user: CurrentUserData
  ): Promise<PaymentResponseDto> {
    return this.treasuryService.create(createPaymentDto, user.id);
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
  async voidPayment(@Param('id') id: string): Promise<PaymentResponseDto> {
    return this.treasuryService.voidPayment(id);
  }

  @Get('methods')
  @ApiOperation({
    summary: 'Get payment methods',
    description: 'Retrieves all available payment methods',
  })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({
    status: 200,
    description: 'List of payment methods',
    type: [PaymentMethodResponseDto],
  })
  async getMethods(@Query('branchId') branchId?: string): Promise<PaymentMethodResponseDto[]> {
    return this.treasuryService.getMethods(branchId);
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
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({
    status: 200,
    description: 'List of bank accounts',
    type: [BankAccountResponseDto],
  })
  async getBankAccounts(@Query('branchId') branchId?: string): Promise<BankAccountResponseDto[]> {
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
  async getPartnerStatement(@Param('partnerId') partnerId: string): Promise<PartnerStatementDto> {
    return this.treasuryService.getPartnerStatement(partnerId);
  }

  @Get('daily-close')
  @ApiOperation({
    summary: 'Get daily close',
    description: 'Retrieves daily payment summary grouped by method and currency',
  })
  @ApiQuery({ name: 'date', required: true, description: 'Date in YYYY-MM-DD format' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiResponse({
    status: 200,
    description: 'Daily close summary',
    type: DailyCloseDto,
  })
  async getDailyClose(
    @Query('date') date: string,
    @Query('branchId') branchId?: string
  ): Promise<DailyCloseDto> {
    return this.treasuryService.getDailyClose(date, branchId);
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
