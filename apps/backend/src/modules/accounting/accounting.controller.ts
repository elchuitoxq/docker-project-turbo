import {
  Controller,
  Get,
  Post,
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
  AccountResponseDto,
  AccountTreeDto,
  CreateEntryDto,
  EntryResponseDto,
  CreateMapDto,
  MapResponseDto,
  AccountingMapApplyResponseDto,
} from './dto/accounting.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('accounting')
@Controller('v1/accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('accounts')
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
  async createAccount(
    @Body() createAccountDto: CreateAccountDto,
  ): Promise<AccountResponseDto> {
    return this.accountingService.createAccount(createAccountDto);
  }

  @Get('entries')
  @ApiOperation({
    summary: 'Get all entries',
    description: 'Retrieves all accounting entries with optional filters',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Filter entries from this date',
    example: '2026-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'Filter entries up to this date',
    example: '2026-12-31T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'accountId',
    required: false,
    description: 'Filter entries containing this account',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiResponse({
    status: 200,
    description: 'List of entries',
    type: [EntryResponseDto],
  })
  async findAllEntries(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('accountId') accountId?: string,
  ): Promise<EntryResponseDto[]> {
    return this.accountingService.findAllEntries({ dateFrom, dateTo, accountId });
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
  async findOneEntry(@Param('id') id: string): Promise<EntryResponseDto> {
    return this.accountingService.findOneEntry(id);
  }

  @Post('entries')
  @ApiOperation({
    summary: 'Create a new entry',
    description: 'Creates a new accounting entry. Entry lines must sum to zero (debit = credit)',
  })
  @ApiResponse({
    status: 201,
    description: 'Entry created successfully',
    type: EntryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or entry lines do not sum to zero',
  })
  async createEntry(
    @Body() createEntryDto: CreateEntryDto,
  ): Promise<EntryResponseDto> {
    return this.accountingService.createEntry(createEntryDto);
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
  async createEntryFromInvoice(
    @Param('invoiceId') invoiceId: string,
  ): Promise<EntryResponseDto> {
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
  async createEntryFromPayment(
    @Param('paymentId') paymentId: string,
  ): Promise<EntryResponseDto> {
    return this.accountingService.createEntryFromPayment(paymentId);
  }

  @Get('maps')
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
    @Query('module') module?: string,
    @Query('branchId') branchId?: string,
  ): Promise<MapResponseDto[]> {
    return this.accountingService.findAllMaps({ module, branchId });
  }

  @Post('maps')
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
    description: 'Applies an accounting map to a transaction (invoice or payment) to generate an entry',
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
    @Param('transactionId') transactionId: string,
  ): Promise<AccountingMapApplyResponseDto> {
    return this.accountingService.applyMapToTransaction(id, transactionId);
  }
}
