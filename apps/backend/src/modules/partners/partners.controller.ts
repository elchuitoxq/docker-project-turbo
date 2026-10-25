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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { PartnersService } from './partners.service';
import {
  CreatePartnerDto,
  UpdatePartnerDto,
  PartnerResponseDto,
  PartnerStatsResponseDto,
} from './dto/partners.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('partners')
@Controller('v1/partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all partners',
    description: 'Retrieves a list of all partners with optional search filter',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name, email, or tax ID',
    example: 'acme',
  })
  @ApiResponse({
    status: 200,
    description: 'List of partners',
    type: [PartnerResponseDto],
  })
  async findAll(@Query('search') search?: string): Promise<PartnerResponseDto[]> {
    return this.partnersService.findAll(search);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get partner statistics',
    description: 'Retrieves partner count grouped by type (customer/vendor)',
  })
  @ApiResponse({
    status: 200,
    description: 'Partner statistics',
    type: PartnerStatsResponseDto,
  })
  async getStats(): Promise<PartnerStatsResponseDto> {
    return this.partnersService.getStats();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get partner by ID',
    description: 'Retrieves a specific partner by their ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Partner UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Partner details',
    type: PartnerResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Partner not found',
  })
  async findOne(@Param('id') id: string): Promise<PartnerResponseDto> {
    return this.partnersService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new partner',
    description: 'Creates a new partner with the provided data',
  })
  @ApiResponse({
    status: 201,
    description: 'Partner created successfully',
    type: PartnerResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Partner with this tax ID already exists',
  })
  async create(@Body() createPartnerDto: CreatePartnerDto): Promise<PartnerResponseDto> {
    return this.partnersService.create(createPartnerDto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a partner',
    description: 'Updates an existing partner\'s information',
  })
  @ApiParam({
    name: 'id',
    description: 'Partner UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Partner updated successfully',
    type: PartnerResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Partner not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Partner with this tax ID already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() updatePartnerDto: UpdatePartnerDto,
  ): Promise<PartnerResponseDto> {
    return this.partnersService.update(id, updatePartnerDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete a partner',
    description: 'Deactivates a partner by setting isSpecialTaxpayer to false',
  })
  @ApiParam({
    name: 'id',
    description: 'Partner UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Partner deactivated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Partner not found',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.partnersService.remove(id);
  }
}
