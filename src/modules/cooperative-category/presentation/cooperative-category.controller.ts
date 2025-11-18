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
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CooperativeCategoryService } from '../application/cooperative-category.service';
import { CreateCooperativeCategoryDto } from './dto/create-cooperative-category.dto';
import { UpdateCooperativeCategoryDto } from './dto/update-cooperative-category.dto';
import { CooperativeCategoryFilterDto } from './dto/cooperative-category-filter.dto';
import { CooperativeCategoryResponseDto } from './dto/cooperative-category-response.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles } from '../../../shared/decorators/auth.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Cooperative Categories')
@ApiBearerAuth()
@Controller('cooperative-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CooperativeCategoryController {
  constructor(
    private readonly cooperativeCategoryService: CooperativeCategoryService,
  ) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create a new cooperative category',
    description:
      'Create a new cooperative category. Only super admins can create categories.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Category created successfully',
    type: CooperativeCategoryResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Category with this name already exists',
  })
  async createCategory(
    @Body() createDto: CreateCooperativeCategoryDto,
  ): Promise<CooperativeCategoryResponseDto> {
    return this.cooperativeCategoryService.createCategory(createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all cooperative categories',
    description:
      'Retrieve a paginated list of cooperative categories with filtering options.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Categories retrieved successfully',
    type: PaginatedResponseDto<CooperativeCategoryResponseDto>,
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false, example: 'apartment' })
  @ApiQuery({ name: 'isActive', required: false, example: true })
  @ApiQuery({ name: 'sortBy', required: false, example: 'name' })
  @ApiQuery({ name: 'sortOrder', required: false, example: 'asc' })
  async findAllCategories(
    @Query() filterDto: CooperativeCategoryFilterDto,
  ): Promise<PaginatedResponseDto<CooperativeCategoryResponseDto>> {
    return this.cooperativeCategoryService.findAllCategories(filterDto);
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get cooperative category statistics',
    description:
      'Get comprehensive statistics about cooperative categories and their usage.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category statistics retrieved successfully',
  })
  async getCategoryStats() {
    return this.cooperativeCategoryService.getCategoryStats();
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN)
  @ApiOperation({
    summary: 'Get cooperative category by ID',
    description:
      'Retrieve detailed information about a specific cooperative category.',
  })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category retrieved successfully',
    type: CooperativeCategoryResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found',
  })
  async findCategoryById(
    @Param('id') id: string,
  ): Promise<CooperativeCategoryResponseDto> {
    return this.cooperativeCategoryService.findCategoryById(id);
  }

  @Patch('reorder')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Reorder cooperative categories',
    description: 'Update the sort order of multiple categories at once.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category order updated successfully',
  })
  async reorderCategories(
    @Body() categoryOrders: Array<{ id: string; sortOrder: number }>,
  ) {
    return this.cooperativeCategoryService.reorderCategories(categoryOrders);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update cooperative category',
    description:
      'Update an existing cooperative category. Only super admins can update categories.',
  })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category updated successfully',
    type: CooperativeCategoryResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Category with this name already exists',
  })
  async updateCategory(
    @Param('id') id: string,
    @Body() updateDto: UpdateCooperativeCategoryDto,
  ): Promise<CooperativeCategoryResponseDto> {
    return this.cooperativeCategoryService.updateCategory(id, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Delete cooperative category',
    description:
      'Delete a cooperative category. Cannot delete categories that have cooperatives assigned.',
  })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Category not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot delete category with assigned cooperatives',
  })
  async deleteCategory(@Param('id') id: string) {
    return this.cooperativeCategoryService.deleteCategory(id);
  }
}
