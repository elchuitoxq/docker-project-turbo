import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { BanksService } from './banks.service';
import { CreateBankDto, UpdateBankDto, BankResponseDto } from './dto/banks.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

@ApiTags('settings-banks')
@Controller('v1/settings/banks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@RequirePermissions('settings:banks:view')
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all banks',
    description: 'Retrieves a list of all banks',
  })
  @ApiResponse({
    status: 200,
    description: 'List of banks',
    type: [BankResponseDto],
  })
  async findAll(): Promise<BankResponseDto[]> {
    return this.banksService.findAll();
  }

  @RequirePermissions('settings:banks:manage')
  @Post()
  @ApiOperation({
    summary: 'Create a new bank',
    description: 'Creates a new bank with the provided data',
  })
  @ApiResponse({
    status: 201,
    description: 'Bank created successfully',
    type: BankResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Bank with this code already exists',
  })
  async create(@Body() createBankDto: CreateBankDto): Promise<BankResponseDto> {
    return this.banksService.create(createBankDto);
  }

  @RequirePermissions('settings:banks:manage')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a bank',
    description: "Updates an existing bank's information",
  })
  @ApiParam({
    name: 'id',
    description: 'Bank UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Bank updated successfully',
    type: BankResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Bank not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Bank with this code already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() updateBankDto: UpdateBankDto
  ): Promise<BankResponseDto> {
    return this.banksService.update(id, updateBankDto);
  }

  @RequirePermissions('settings:banks:manage')
  @Post(':id/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Toggle bank active status',
    description: 'Toggles the isActive status of a bank',
  })
  @ApiParam({
    name: 'id',
    description: 'Bank UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Bank toggled successfully',
    type: BankResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Bank not found',
  })
  async toggle(@Param('id') id: string): Promise<BankResponseDto> {
    return this.banksService.toggle(id);
  }
}
