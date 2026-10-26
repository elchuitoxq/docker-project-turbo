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
  ApiParam,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  UpdateOrderDto,
  OrderResponseDto,
  OrderStatsResponseDto,
  OrderStatus,
  ConfirmOrderResponseDto,
  CancelOrderResponseDto,
} from './dto/orders.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('orders')
@Controller('v1/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all orders',
    description: 'Retrieves a list of all orders with optional filters',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by order status',
    enum: OrderStatus,
    example: 'DRAFT',
  })
  @ApiQuery({
    name: 'partnerId',
    required: false,
    description: 'Filter by partner ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'List of orders',
    type: [OrderResponseDto],
  })
  async findAll(
    @Query('status') status?: OrderStatus,
    @Query('partnerId') partnerId?: string
  ): Promise<OrderResponseDto[]> {
    return this.ordersService.findAll(status, partnerId);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get order statistics',
    description: 'Retrieves order count and revenue grouped by status',
  })
  @ApiResponse({
    status: 200,
    description: 'Order statistics',
    type: OrderStatsResponseDto,
  })
  async getStats(): Promise<OrderStatsResponseDto> {
    return this.ordersService.getStats();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get order by ID',
    description: 'Retrieves a specific order with its items',
  })
  @ApiParam({
    name: 'id',
    description: 'Order UUID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  @ApiResponse({
    status: 200,
    description: 'Order details with items',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async findOne(@Param('id') id: string): Promise<OrderResponseDto> {
    return this.ordersService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new order',
    description: 'Creates a new order in DRAFT status',
  })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data or order code already exists',
  })
  async create(@Body() createOrderDto: CreateOrderDto): Promise<OrderResponseDto> {
    return this.ordersService.create(createOrderDto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an order',
    description: "Updates an existing order's information",
  })
  @ApiParam({
    name: 'id',
    description: 'Order UUID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  @ApiResponse({
    status: 200,
    description: 'Order updated successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot update order in current status',
  })
  async update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto
  ): Promise<OrderResponseDto> {
    return this.ordersService.update(id, updateOrderDto);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm an order',
    description: 'Changes order status from DRAFT to CONFIRMED',
  })
  @ApiParam({
    name: 'id',
    description: 'Order UUID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  @ApiResponse({
    status: 200,
    description: 'Order confirmed successfully',
    type: ConfirmOrderResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Only draft orders can be confirmed',
  })
  async confirm(@Param('id') id: string): Promise<ConfirmOrderResponseDto> {
    return this.ordersService.confirm(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an order',
    description: 'Changes order status to CANCELLED',
  })
  @ApiParam({
    name: 'id',
    description: 'Order UUID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    type: CancelOrderResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Order cannot be cancelled in current status',
  })
  async cancel(@Param('id') id: string): Promise<CancelOrderResponseDto> {
    return this.ordersService.cancel(id);
  }

  @Post(':id/invoice')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate invoice for an order',
    description: 'Creates an invoice from a confirmed or processing order',
  })
  @ApiParam({
    name: 'id',
    description: 'Order UUID',
    example: '550e8400-e29b-41d4-a716-446655440011',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice generation initiated',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Only confirmed or processing orders can be invoiced',
  })
  async invoice(@Param('id') id: string): Promise<{ message: string; orderId: string }> {
    return this.ordersService.invoice(id);
  }
}
