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
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductResponseDto,
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
  ProductCategoryResponseDto,
} from './dto/products.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('products')
@Controller('v1/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all products',
    description: 'Retrieves a list of all products with optional search and category filters',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name, SKU, or description',
    example: 'laptop',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filter by category ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'List of products',
    type: [ProductResponseDto],
  })
  async findAll(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string
  ): Promise<ProductResponseDto[]> {
    return this.productsService.findAll(search, categoryId);
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Get all product categories',
    description: 'Retrieves a list of all product categories',
  })
  @ApiResponse({
    status: 200,
    description: 'List of categories',
    type: [ProductCategoryResponseDto],
  })
  async findAllCategories(): Promise<ProductCategoryResponseDto[]> {
    return this.productsService.findAllCategories();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get product by ID',
    description: 'Retrieves a specific product by its ID with category details',
  })
  @ApiParam({
    name: 'id',
    description: 'Product UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Product details',
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async findOne(@Param('id') id: string): Promise<ProductResponseDto> {
    return this.productsService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new product',
    description: 'Creates a new product with the provided data',
  })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully',
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Product with this SKU already exists',
  })
  async create(@Body() createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    return this.productsService.create(createProductDto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a product',
    description: 'Updates an existing product\'s information',
  })
  @ApiParam({
    name: 'id',
    description: 'Product UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Product updated successfully',
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Product with this SKU already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto
  ): Promise<ProductResponseDto> {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete a product',
    description: 'Marks a product as deleted',
  })
  @ApiParam({
    name: 'id',
    description: 'Product UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Product deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.productsService.remove(id);
  }

  @Post('categories')
  @ApiOperation({
    summary: 'Create a new product category',
    description: 'Creates a new product category with the provided data',
  })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully',
    type: ProductCategoryResponseDto,
  })
  async createCategory(
    @Body() createCategoryDto: CreateProductCategoryDto
  ): Promise<ProductCategoryResponseDto> {
    return this.productsService.createCategory(createCategoryDto);
  }

  @Patch('categories/:id')
  @ApiOperation({
    summary: 'Update a product category',
    description: 'Updates an existing product category\'s information',
  })
  @ApiParam({
    name: 'id',
    description: 'Category UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Category updated successfully',
    type: ProductCategoryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Category not found',
  })
  async updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateProductCategoryDto
  ): Promise<ProductCategoryResponseDto> {
    return this.productsService.updateCategory(id, updateCategoryDto);
  }
}
