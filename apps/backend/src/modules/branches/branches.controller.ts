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
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import type { Request } from 'express';
import { BranchesService } from './branches.service';
import {
  CreateCompanyDto,
  CreateBranchDto,
  UpdateCompanyDto,
  UpdateBranchDto,
  BranchResponseDto,
  CompanyResponseDto,
} from './dto/branches.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SkipBranch } from '../../common/decorators/skip-branch.decorator';

@ApiTags('branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/branches')
// Catálogo de empresa/sucursal: la UI lo necesita para elegir sucursal (regla R5).
@SkipBranch()
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get('companies')
  @RequirePermissions('settings:companies:view')
  @ApiOperation({
    summary: 'List companies and branches accessible to the current user',
    description: 'Returns explicit company records with their assigned active branches',
  })
  @ApiResponse({
    status: 200,
    description: 'List of companies derived from user-accessible branches',
    type: [CompanyResponseDto],
  })
  async findCompanies(@Req() req: Request): Promise<CompanyResponseDto[]> {
    const userId = (req.user as { id?: string } | undefined)?.id;
    return this.branchesService.findCompanies(userId);
  }

  @Get('companies/all')
  @RequirePermissions('settings:companies:manage')
  async findAllCompanies(): Promise<CompanyResponseDto[]> {
    return this.branchesService.findCompanies();
  }

  @Post('companies')
  @RequirePermissions('settings:companies:manage')
  async createCompany(@Body() dto: CreateCompanyDto): Promise<CompanyResponseDto> {
    return this.branchesService.createCompany(dto);
  }

  @Patch('companies/:id')
  @RequirePermissions('settings:companies:manage')
  async updateCompany(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto
  ): Promise<CompanyResponseDto> {
    return this.branchesService.updateCompany(id, dto);
  }

  @Get()
  @RequirePermissions('settings:branches:view')
  @ApiOperation({
    summary: 'Get all branches',
    description: 'Retrieves a list of all branches',
  })
  @ApiResponse({
    status: 200,
    description: 'List of branches',
    type: [BranchResponseDto],
  })
  async findAll(@Req() req: Request): Promise<BranchResponseDto[]> {
    const userId = (req.user as { id?: string } | undefined)?.id;
    return this.branchesService.findAll(userId);
  }

  @Get('all')
  @RequirePermissions('settings:branches:manage')
  async findAllForAdministration(): Promise<BranchResponseDto[]> {
    return this.branchesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('settings:branches:view')
  @ApiOperation({
    summary: 'Get branch by ID',
    description: 'Retrieves a specific branch by its ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Branch UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Branch details',
    type: BranchResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Branch not found',
  })
  async findOne(@Param('id') id: string, @Req() req: Request): Promise<BranchResponseDto> {
    const userId = (req.user as { id?: string } | undefined)?.id;
    return this.branchesService.findOne(id, userId);
  }

  @Post()
  @RequirePermissions('settings:branches:manage')
  @ApiOperation({
    summary: 'Create a new branch',
    description: 'Creates a new branch with the provided data',
  })
  @ApiResponse({
    status: 201,
    description: 'Branch created successfully',
    type: BranchResponseDto,
  })
  async create(@Body() createBranchDto: CreateBranchDto): Promise<BranchResponseDto> {
    return this.branchesService.create(createBranchDto);
  }

  @Patch(':id')
  @RequirePermissions('settings:branches:manage')
  @ApiOperation({
    summary: 'Update a branch',
    description: "Updates an existing branch's information",
  })
  @ApiParam({
    name: 'id',
    description: 'Branch UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Branch updated successfully',
    type: BranchResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Branch not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateBranchDto: UpdateBranchDto
  ): Promise<BranchResponseDto> {
    return this.branchesService.update(id, updateBranchDto);
  }

  @Delete(':id')
  @RequirePermissions('settings:branches:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete a branch',
    description: 'Deactivates a branch by setting isActive to false',
  })
  @ApiParam({
    name: 'id',
    description: 'Branch UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Branch deactivated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Branch not found',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.branchesService.remove(id);
  }
}
