import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCooperativeCategoryDto } from '../presentation/dto/create-cooperative-category.dto';
import { UpdateCooperativeCategoryDto } from '../presentation/dto/update-cooperative-category.dto';
import {
  CooperativeCategoryFilterDto,
  CooperativeCategorySortBy,
} from '../presentation/dto/cooperative-category-filter.dto';
import { CooperativeCategoryResponseDto } from '../presentation/dto/cooperative-category-response.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';

@Injectable()
export class CooperativeCategoryService {
  constructor(private prismaService: PrismaService) {}

  async createCategory(
    createDto: CreateCooperativeCategoryDto,
  ): Promise<CooperativeCategoryResponseDto> {
    // Check if category name already exists
    const existingCategory =
      await this.prismaService.cooperativeCategory.findUnique({
        where: { name: createDto.name },
      });

    if (existingCategory) {
      throw new ConflictException('Category with this name already exists');
    }

    // If no sortOrder provided, set it to the next available number
    let sortOrder = createDto.sortOrder;
    if (!sortOrder) {
      const lastCategory =
        await this.prismaService.cooperativeCategory.findFirst({
          orderBy: { sortOrder: 'desc' },
          select: { sortOrder: true },
        });
      sortOrder = (lastCategory?.sortOrder || 0) + 1;
    }

    const category = await this.prismaService.cooperativeCategory.create({
      data: {
        name: createDto.name,
        description: createDto.description,
        icon: createDto.icon,
        color: createDto.color,
        isActive: createDto.isActive ?? true,
        sortOrder,
      },
      include: {
        _count: {
          select: {
            cooperatives: true,
          },
        },
      },
    });

    return this.mapToResponseDto(category);
  }

  async findAllCategories(
    filterDto: CooperativeCategoryFilterDto,
  ): Promise<PaginatedResponseDto<CooperativeCategoryResponseDto>> {
    const { page, limit, skip, sortBy, sortOrder, search, isActive } =
      filterDto;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Build order by clause
    const orderBy: any = {};
    switch (sortBy) {
      case CooperativeCategorySortBy.NAME:
        orderBy.name = sortOrder;
        break;
      case CooperativeCategorySortBy.CREATED_AT:
        orderBy.createdAt = sortOrder;
        break;
      case CooperativeCategorySortBy.UPDATED_AT:
        orderBy.updatedAt = sortOrder;
        break;
      case CooperativeCategorySortBy.SORT_ORDER:
        orderBy.sortOrder = 'asc'; // Always ascending for sort order
        break;
      case CooperativeCategorySortBy.COOPERATIVE_COUNT:
        // We'll handle this differently since it's a computed field
        orderBy.createdAt = sortOrder; // Fallback to createdAt for now
        break;
      default:
        orderBy.sortOrder = 'asc';
    }

    // Execute queries
    const [categories, total] = await Promise.all([
      this.prismaService.cooperativeCategory.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              cooperatives: true,
            },
          },
        },
      }),
      this.prismaService.cooperativeCategory.count({ where }),
    ]);

    // If sorting by cooperative count, sort the results manually
    if (sortBy === CooperativeCategorySortBy.COOPERATIVE_COUNT) {
      categories.sort((a, b) => {
        const countA = a._count.cooperatives;
        const countB = b._count.cooperatives;
        return sortOrder === 'desc' ? countB - countA : countA - countB;
      });
    }

    const categoryResponses = categories.map((category) =>
      this.mapToResponseDto(category),
    );

    return new PaginatedResponseDto(
      categoryResponses,
      total,
      page || 1,
      limit || 10,
    );
  }

  async findCategoryById(id: string): Promise<CooperativeCategoryResponseDto> {
    const category = await this.prismaService.cooperativeCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            cooperatives: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Cooperative category not found');
    }

    return this.mapToResponseDto(category);
  }

  async updateCategory(
    id: string,
    updateDto: UpdateCooperativeCategoryDto,
  ): Promise<CooperativeCategoryResponseDto> {
    const existingCategory =
      await this.prismaService.cooperativeCategory.findUnique({
        where: { id },
      });

    if (!existingCategory) {
      throw new NotFoundException('Cooperative category not found');
    }

    // Check if name is being changed and if it conflicts
    if (updateDto.name && updateDto.name !== existingCategory.name) {
      const conflictingCategory =
        await this.prismaService.cooperativeCategory.findUnique({
          where: { name: updateDto.name },
        });

      if (conflictingCategory) {
        throw new ConflictException('Category with this name already exists');
      }
    }

    const updatedCategory = await this.prismaService.cooperativeCategory.update(
      {
        where: { id },
        data: {
          ...updateDto,
          updatedAt: new Date(),
        },
        include: {
          _count: {
            select: {
              cooperatives: true,
            },
          },
        },
      },
    );

    return this.mapToResponseDto(updatedCategory);
  }

  async deleteCategory(id: string): Promise<{ message: string }> {
    const category = await this.prismaService.cooperativeCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            cooperatives: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Cooperative category not found');
    }

    // Check if category has cooperatives assigned
    if (category._count.cooperatives > 0) {
      throw new BadRequestException(
        `Cannot delete category. ${category._count.cooperatives} cooperative(s) are assigned to this category. ` +
          'Please reassign or remove cooperatives before deleting the category.',
      );
    }

    await this.prismaService.cooperativeCategory.delete({
      where: { id },
    });

    return {
      message: `Category "${category.name}" has been successfully deleted`,
    };
  }

  async getCategoryStats(): Promise<{
    totalCategories: number;
    activeCategories: number;
    inactiveCategories: number;
    totalCooperatives: number;
    categoriesWithCooperatives: number;
    topCategories: Array<{
      id: string;
      name: string;
      cooperativeCount: number;
    }>;
  }> {
    const [
      totalCategories,
      activeCategories,
      inactiveCategories,
      totalCooperatives,
      topCategories,
    ] = await Promise.all([
      // Total categories
      this.prismaService.cooperativeCategory.count(),

      // Active categories
      this.prismaService.cooperativeCategory.count({
        where: { isActive: true },
      }),

      // Inactive categories
      this.prismaService.cooperativeCategory.count({
        where: { isActive: false },
      }),

      // Total cooperatives
      this.prismaService.cooperative.count(),

      // Top 5 categories by cooperative count
      this.prismaService.cooperativeCategory.findMany({
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              cooperatives: true,
            },
          },
        },
        orderBy: {
          cooperatives: {
            _count: 'desc',
          },
        },
        take: 5,
      }),
    ]);

    const categoriesWithCooperatives = topCategories.filter(
      (cat) => cat._count.cooperatives > 0,
    ).length;

    return {
      totalCategories,
      activeCategories,
      inactiveCategories,
      totalCooperatives,
      categoriesWithCooperatives,
      topCategories: topCategories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        cooperativeCount: cat._count.cooperatives,
      })),
    };
  }

  async reorderCategories(
    categoryOrders: Array<{ id: string; sortOrder: number }>,
  ): Promise<{ message: string }> {
    // Validate all category IDs exist
    const categoryIds = categoryOrders.map((item) => item.id);
    const existingCategories =
      await this.prismaService.cooperativeCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true },
      });

    if (existingCategories.length !== categoryIds.length) {
      throw new BadRequestException('One or more categories do not exist');
    }

    // Update sort orders in a transaction
    await this.prismaService.$transaction(
      categoryOrders.map((item) =>
        this.prismaService.cooperativeCategory.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    return {
      message: 'Category order updated successfully',
    };
  }

  private mapToResponseDto(category: any): CooperativeCategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      color: category.color,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      cooperativeCount: category._count?.cooperatives || 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }
}
