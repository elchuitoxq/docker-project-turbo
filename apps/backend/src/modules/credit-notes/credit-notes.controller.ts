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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { CreditNotesService } from './credit-notes.service';
import {
  CreateCreditNoteDto,
  UpdateCreditNoteDto,
  ApplyCreditNoteDto,
  CreditNoteResponseDto,
  CreditNoteListResponseDto,
  PostCreditNoteResponseDto,
  VoidCreditNoteResponseDto,
  ApplyCreditNoteResponseDto,
} from './dto/credit-notes.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('credit-notes')
@Controller('v1/credit-notes')
export class CreditNotesController {
  constructor(private readonly creditNotesService: CreditNotesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all credit notes',
    description: 'Retrieves a list of all credit notes with optional filters',
  })
  @ApiQuery({
    name: 'partnerId',
    required: false,
    description: 'Filter by partner ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
    enum: ['DRAFT', 'POSTED', 'VOIDED', 'APPLIED'],
    example: 'DRAFT',
  })
  @ApiResponse({
    status: 200,
    description: 'List of credit notes',
    type: [CreditNoteListResponseDto],
  })
  async findAll(
    @Query('partnerId') partnerId?: string,
    @Query('status') status?: string,
  ): Promise<CreditNoteListResponseDto[]> {
    return this.creditNotesService.findAll(partnerId, status);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get credit note by ID',
    description: 'Retrieves a specific credit note with items and usages',
  })
  @ApiParam({
    name: 'id',
    description: 'Credit note UUID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  @ApiResponse({
    status: 200,
    description: 'Credit note details',
    type: CreditNoteResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Credit note not found',
  })
  async findOne(@Param('id') id: string): Promise<CreditNoteResponseDto> {
    return this.creditNotesService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new credit note',
    description: 'Creates a new credit note in DRAFT status',
  })
  @ApiResponse({
    status: 201,
    description: 'Credit note created successfully',
    type: CreditNoteResponseDto,
  })
  async create(
    @Body() createCreditNoteDto: CreateCreditNoteDto,
    @CurrentUser() user?: { userId: string },
  ): Promise<CreditNoteResponseDto> {
    return this.creditNotesService.create(
      createCreditNoteDto,
      user?.userId,
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a credit note',
    description: 'Updates an existing DRAFT credit note',
  })
  @ApiParam({
    name: 'id',
    description: 'Credit note UUID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  @ApiResponse({
    status: 200,
    description: 'Credit note updated successfully',
    type: CreditNoteResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Only DRAFT credit notes can be updated',
  })
  @ApiResponse({
    status: 404,
    description: 'Credit note not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateCreditNoteDto: UpdateCreditNoteDto,
  ): Promise<CreditNoteResponseDto> {
    return this.creditNotesService.update(id, updateCreditNoteDto);
  }

  @Post(':id/post')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Post a credit note',
    description: 'Posts a DRAFT credit note (changes status from DRAFT to POSTED)',
  })
  @ApiParam({
    name: 'id',
    description: 'Credit note UUID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  @ApiResponse({
    status: 200,
    description: 'Credit note posted successfully',
    type: PostCreditNoteResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Only DRAFT credit notes can be posted',
  })
  @ApiResponse({
    status: 404,
    description: 'Credit note not found',
  })
  async post(@Param('id') id: string): Promise<PostCreditNoteResponseDto> {
    return this.creditNotesService.post(id);
  }

  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Void a credit note',
    description: 'Voids a POSTED credit note (changes status from POSTED to VOIDED)',
  })
  @ApiParam({
    name: 'id',
    description: 'Credit note UUID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  @ApiResponse({
    status: 200,
    description: 'Credit note voided successfully',
    type: VoidCreditNoteResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot void an already voided or APPLIED credit note',
  })
  @ApiResponse({
    status: 404,
    description: 'Credit note not found',
  })
  async void(@Param('id') id: string): Promise<VoidCreditNoteResponseDto> {
    return this.creditNotesService.void(id);
  }

  @Post(':id/apply/:invoiceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Apply credit note to invoice',
    description: 'Applies a credit note to an invoice, creating a payment allocation',
  })
  @ApiParam({
    name: 'id',
    description: 'Credit note UUID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  @ApiParam({
    name: 'invoiceId',
    description: 'Invoice UUID to apply credit note to',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @ApiResponse({
    status: 200,
    description: 'Credit note applied to invoice successfully',
    type: ApplyCreditNoteResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot apply credit note (e.g., DRAFT, voided, or exceeds available amount)',
  })
  @ApiResponse({
    status: 404,
    description: 'Credit note or invoice not found',
  })
  async apply(
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
    @Body() applyDto: ApplyCreditNoteDto,
  ): Promise<ApplyCreditNoteResponseDto> {
    return this.creditNotesService.apply(id, invoiceId, applyDto);
  }
}
