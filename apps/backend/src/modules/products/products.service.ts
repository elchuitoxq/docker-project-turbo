import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { db } from '../../database';
import { products, productCategories } from '../../schema';
import { eq, sql, like, or, and } from 'drizzle-orm';
import {
  CreateProductDto,
  UpdateProductDto,
  ProductResponseDto,
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
  ProductCategoryResponseDto,
} from './dto/products.dto';

@Injectable()
export class ProductsService {
  async findAll(search?: string, categoryId?: string): Promise<ProductResponseDto[]> {
    let query = db.select().from(products);

    const conditions = [];

    if (search) {
      const searchLower = `%${search.toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${products.name})`, searchLower),
          like(sql`LOWER(${products.sku})`, searchLower),
          like(sql`LOWER(${products.description})`, searchLower)
        ) as any
      );
    }

    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId) as any);
    }

    if (conditions.length > 0) {
      query = db
        .select()
        .from(products)
        .where(and(...conditions)) as any;
    }

    const allProducts = await query;

    const result: ProductResponseDto[] = [];
    for (const product of allProducts) {
      const response = await this.toResponseDto(product);
      result.push(response);
    }

    return result;
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return this.toResponseDto(product);
  }

  async create(createProductDto: CreateProductDto): Promise<ProductResponseDto> {
    const [existing] = await db
      .select()
      .from(products)
      .where(eq(products.sku, createProductDto.sku))
      .limit(1);

    if (existing) {
      throw new ConflictException('Product with this SKU already exists');
    }

    const [newProduct] = await db
      .insert(products)
      .values({
        sku: createProductDto.sku,
        name: createProductDto.name,
        description: createProductDto.description,
        categoryId: createProductDto.categoryId,
        cost: createProductDto.cost?.toString() || '0',
        price: createProductDto.price?.toString() || '0',
        isExempt: createProductDto.isExempt || false,
        taxRate: createProductDto.taxRate?.toString() || '16.00',
        type: createProductDto.type || 'PHYSICAL',
        minStock: createProductDto.minStock?.toString() || '0',
        hasBatches: createProductDto.hasBatches || false,
        currencyId: createProductDto.currencyId,
      })
      .returning();

    return this.toResponseDto(newProduct);
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<ProductResponseDto> {
    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);

    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    if (updateProductDto.sku && updateProductDto.sku !== existing.sku) {
      const [conflict] = await db
        .select()
        .from(products)
        .where(eq(products.sku, updateProductDto.sku))
        .limit(1);

      if (conflict) {
        throw new ConflictException('Product with this SKU already exists');
      }
    }

    const updateData: Partial<typeof products.$inferInsert> = {};

    if (updateProductDto.sku !== undefined) updateData.sku = updateProductDto.sku;
    if (updateProductDto.name !== undefined) updateData.name = updateProductDto.name;
    if (updateProductDto.description !== undefined)
      updateData.description = updateProductDto.description;
    if (updateProductDto.categoryId !== undefined)
      updateData.categoryId = updateProductDto.categoryId;
    if (updateProductDto.cost !== undefined) updateData.cost = updateProductDto.cost.toString();
    if (updateProductDto.price !== undefined) updateData.price = updateProductDto.price.toString();
    if (updateProductDto.isExempt !== undefined) updateData.isExempt = updateProductDto.isExempt;
    if (updateProductDto.taxRate !== undefined)
      updateData.taxRate = updateProductDto.taxRate.toString();
    if (updateProductDto.type !== undefined) updateData.type = updateProductDto.type;
    if (updateProductDto.minStock !== undefined)
      updateData.minStock = updateProductDto.minStock.toString();
    if (updateProductDto.hasBatches !== undefined)
      updateData.hasBatches = updateProductDto.hasBatches;
    if (updateProductDto.currencyId !== undefined)
      updateData.currencyId = updateProductDto.currencyId;

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      await db.update(products).set(updateData).where(eq(products.id, id));
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<{ message: string }> {
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return { message: `Product ${id} deleted successfully` };
  }

  async findAllCategories(): Promise<ProductCategoryResponseDto[]> {
    const allCategories = await db.select().from(productCategories);
    return allCategories.map(this.toCategoryResponseDto);
  }

  async findOneCategory(id: string): Promise<ProductCategoryResponseDto> {
    const [category] = await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.id, id))
      .limit(1);

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return this.toCategoryResponseDto(category);
  }

  async createCategory(
    createCategoryDto: CreateProductCategoryDto
  ): Promise<ProductCategoryResponseDto> {
    const [newCategory] = await db
      .insert(productCategories)
      .values({
        name: createCategoryDto.name,
        description: createCategoryDto.description,
        parentId: createCategoryDto.parentId,
      })
      .returning();

    return this.toCategoryResponseDto(newCategory);
  }

  async updateCategory(
    id: string,
    updateCategoryDto: UpdateProductCategoryDto
  ): Promise<ProductCategoryResponseDto> {
    const [existing] = await db
      .select()
      .from(productCategories)
      .where(eq(productCategories.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    const updateData: Partial<typeof productCategories.$inferInsert> = {};

    if (updateCategoryDto.name !== undefined) updateData.name = updateCategoryDto.name;
    if (updateCategoryDto.description !== undefined)
      updateData.description = updateCategoryDto.description;
    if (updateCategoryDto.parentId !== undefined) updateData.parentId = updateCategoryDto.parentId;

    if (Object.keys(updateData).length > 0) {
      await db.update(productCategories).set(updateData).where(eq(productCategories.id, id));
    }

    return this.findOneCategory(id);
  }

  private async toResponseDto(product: typeof products.$inferSelect): Promise<ProductResponseDto> {
    let category: ProductCategoryResponseDto | null = null;

    if (product.categoryId) {
      const [cat] = await db
        .select()
        .from(productCategories)
        .where(eq(productCategories.id, product.categoryId))
        .limit(1);
      if (cat) {
        category = this.toCategoryResponseDto(cat);
      }
    }

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      categoryId: product.categoryId,
      cost: product.cost ? Number(product.cost) : 0,
      price: product.price ? Number(product.price) : 0,
      isExempt: product.isExempt || false,
      taxRate: product.taxRate ? Number(product.taxRate) : 16,
      type: product.type as 'PHYSICAL' | 'DIGITAL' | 'SERVICE',
      minStock: product.minStock ? Number(product.minStock) : 0,
      hasBatches: product.hasBatches || false,
      currencyId: product.currencyId,
      category,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private toCategoryResponseDto(
    category: typeof productCategories.$inferSelect
  ): ProductCategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      parentId: category.parentId,
    };
  }
}
