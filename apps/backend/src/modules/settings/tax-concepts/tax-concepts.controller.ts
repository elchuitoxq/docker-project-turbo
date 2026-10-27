import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { TaxConceptsService } from './tax-concepts.service';
import {
  CreateTaxConceptDto,
  UpdateTaxConceptDto,
  TaxConceptResponseDto,
} from './dto/tax-concepts.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

@ApiTags('settings-tax-concepts')
@Controller('v1/settings/tax-concepts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@RequirePermissions('settings:taxes:view')
export class TaxConceptsController {
  constructor(private readonly taxConceptsService: TaxConceptsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all tax concepts',
    description: 'Retrieves a list of all tax concepts',
  })
  @ApiResponse({
    status: 200,
    description: 'List of tax concepts',
    type: [TaxConceptResponseDto],
  })
  async findAll(): Promise<TaxConceptResponseDto[]> {
    return this.taxConceptsService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get tax concept by ID',
    description: 'Retrieves a specific tax concept by its ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Tax Concept UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Tax concept details',
    type: TaxConceptResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Tax concept not found',
  })
  async findOne(@Param('id') id: string): Promise<TaxConceptResponseDto> {
    return this.taxConceptsService.findOne(id);
  }

  @RequirePermissions('settings:taxes:manage')
  @Post()
  @ApiOperation({
    summary: 'Create a new tax concept',
    description: 'Creates a new tax concept with the provided data',
  })
  @ApiResponse({
    status: 201,
    description: 'Tax concept created successfully',
    type: TaxConceptResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Tax concept with this code already exists',
  })
  async create(@Body() createTaxConceptDto: CreateTaxConceptDto): Promise<TaxConceptResponseDto> {
    return this.taxConceptsService.create(createTaxConceptDto);
  }

  @RequirePermissions('settings:taxes:manage')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a tax concept',
    description: "Updates an existing tax concept's information",
  })
  @ApiParam({
    name: 'id',
    description: 'Tax Concept UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Tax concept updated successfully',
    type: TaxConceptResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Tax concept not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Tax concept with this code already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() updateTaxConceptDto: UpdateTaxConceptDto
  ): Promise<TaxConceptResponseDto> {
    return this.taxConceptsService.update(id, updateTaxConceptDto);
  }

  @RequirePermissions('settings:taxes:manage')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a tax concept',
    description: 'Deletes a tax concept by its ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Tax Concept UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Tax concept deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Tax concept not found',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.taxConceptsService.remove(id);
  }
}
