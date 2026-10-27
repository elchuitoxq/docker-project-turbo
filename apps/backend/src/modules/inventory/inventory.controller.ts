import {
  Controller,
  Get,
  Delete,
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
  ApiParam,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseResponseDto,
  CreateInventoryMoveDto,
  RejectInventoryMoveDto,
  InventoryMoveResponseDto,
  StockResponseDto,
} from './dto/inventory.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('inventory')
@Controller('v1/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('warehouses')
  @ApiOperation({
    summary: 'List all warehouses',
    description: 'Retrieves a list of all warehouses',
  })
  @ApiResponse({
    status: 200,
    description: 'List of warehouses',
    type: [WarehouseResponseDto],
  })
  async findAllWarehouses(@CurrentBranch() branchId: string): Promise<WarehouseResponseDto[]> {
    return this.inventoryService.findAllWarehouses(branchId);
  }

  @Post('warehouses')
  @ApiOperation({
    summary: 'Create a new warehouse',
    description: 'Creates a new warehouse with the provided data',
  })
  @ApiResponse({
    status: 201,
    description: 'Warehouse created successfully',
    type: WarehouseResponseDto,
  })
  async createWarehouse(
    @Body() createWarehouseDto: CreateWarehouseDto
  ): Promise<WarehouseResponseDto> {
    return this.inventoryService.createWarehouse(createWarehouseDto);
  }

  @Get('warehouses/:id')
  @RequirePermissions('inventory:warehouses:view')
  @ApiOperation({ summary: 'Get a warehouse by id' })
  @ApiResponse({ status: 200, description: 'Warehouse detail' })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  async findOneWarehouse(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<WarehouseResponseDto> {
    return this.inventoryService.findOneWarehouse(id, branchId);
  }

  @Delete('warehouses/:id')
  @RequirePermissions('inventory:warehouses:edit')
  @ApiOperation({
    summary: 'Deactivate a warehouse',
    description: 'Logical delete: rejects with 409 when the warehouse still has stock or movements',
  })
  @ApiResponse({ status: 200, description: 'Warehouse deactivated' })
  @ApiResponse({ status: 409, description: 'Warehouse has stock or movements' })
  async deactivateWarehouse(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<WarehouseResponseDto> {
    return this.inventoryService.deactivateWarehouse(id, branchId);
  }
  @Patch('warehouses/:id')
  @ApiOperation({
    summary: 'Update a warehouse',
    description: 'Updates an existing warehouse information',
  })
  @ApiParam({
    name: 'id',
    description: 'Warehouse UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Warehouse updated successfully',
    type: WarehouseResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Warehouse not found',
  })
  async updateWarehouse(
    @Param('id') id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto
  ): Promise<WarehouseResponseDto> {
    return this.inventoryService.updateWarehouse(id, updateWarehouseDto);
  }

  @Get('stock/:warehouseId')
  @ApiOperation({
    summary: 'Get stock by warehouse',
    description: 'Retrieves all stock items for a specific warehouse',
  })
  @ApiParam({
    name: 'warehouseId',
    description: 'Warehouse UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'List of stock items',
    type: [StockResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Warehouse not found',
  })
  async findStockByWarehouse(
    @Param('warehouseId') warehouseId: string,
    @CurrentBranch() branchId: string
  ): Promise<StockResponseDto[]> {
    return this.inventoryService.findStockByWarehouse(warehouseId, branchId);
  }

  @Get('moves')
  @ApiOperation({
    summary: 'List all inventory moves',
    description: 'Retrieves a list of all inventory moves with optional filters',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
    enum: ['EN_TRAMITE', 'APPROVED', 'REJECTED', 'CANCELLED'],
    example: 'EN_TRAMITE',
  })
  @ApiQuery({
    name: 'warehouseId',
    required: false,
    description: 'Filter by warehouse ID (from or to)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'List of inventory moves',
    type: [InventoryMoveResponseDto],
  })
  async findAllMoves(
    @CurrentBranch() branchId: string,
    @Query('status') status?: string,
    @Query('warehouseId') warehouseId?: string
  ): Promise<InventoryMoveResponseDto[]> {
    return this.inventoryService.findAllMoves(status, warehouseId, branchId);
  }

  @Get('moves/:id')
  @ApiOperation({
    summary: 'Get inventory move by ID',
    description: 'Retrieves a specific inventory move with its lines',
  })
  @ApiParam({
    name: 'id',
    description: 'Move UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory move details with lines',
    type: InventoryMoveResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Inventory move not found',
  })
  async findOneMove(
    @Param('id') id: string,
    @CurrentBranch() branchId: string
  ): Promise<InventoryMoveResponseDto> {
    return this.inventoryService.findOneMove(id, branchId);
  }

  @Post('moves')
  @ApiOperation({
    summary: 'Create a new inventory move',
    description: 'Creates a new inventory move with EN_TRAMITE status',
  })
  @ApiResponse({
    status: 201,
    description: 'Inventory move created successfully',
    type: InventoryMoveResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  async createMove(
    @Body() createMoveDto: CreateInventoryMoveDto
  ): Promise<InventoryMoveResponseDto> {
    return this.inventoryService.createMove(createMoveDto);
  }

  @Post('moves/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve an inventory move',
    description: 'Approves an inventory move with EN_TRAMITE status and updates stock accordingly',
  })
  @ApiParam({
    name: 'id',
    description: 'Move UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Move approved and stock updated',
    type: InventoryMoveResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Move cannot be approved (invalid status)',
  })
  @ApiResponse({
    status: 404,
    description: 'Move not found',
  })
  async approveMove(@Param('id') id: string): Promise<InventoryMoveResponseDto> {
    return this.inventoryService.approveMove(id);
  }

  @Post('moves/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject an inventory move',
    description: 'Rejects an inventory move with EN_TRAMITE status',
  })
  @ApiParam({
    name: 'id',
    description: 'Move UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Move rejected',
    type: InventoryMoveResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Move cannot be rejected (invalid status)',
  })
  @ApiResponse({
    status: 404,
    description: 'Move not found',
  })
  async rejectMove(
    @Param('id') id: string,
    @Body() rejectDto: RejectInventoryMoveDto
  ): Promise<InventoryMoveResponseDto> {
    return this.inventoryService.rejectMove(id, rejectDto);
  }
}
