import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CooperativeService } from '../application/cooperative.service';
import { CreateCooperativeDto } from './dto/create-cooperative.dto';
import { CooperativeResponseDto } from './dto/cooperative-response.dto';
import { CooperativeSearchDto } from './dto/cooperative-search.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { PaginatedResponseDto } from '../../../shared/dto/paginated-response.dto';
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { Roles, Public } from '../../../shared/decorators/auth.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../shared/decorators/current-user.decorator';
import { CooperativeStatus, UserRole } from '@prisma/client';

@ApiTags('Cooperatives')
@Controller('cooperatives')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CooperativeController {
  constructor(private cooperativeService: CooperativeService) {}

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new cooperative' })
  @ApiResponse({
    status: 201,
    description: 'Cooperative created successfully',
    type: CooperativeResponseDto,
  })
  async create(
    @Body() createCooperativeDto: CreateCooperativeDto,
  ): Promise<CooperativeResponseDto> {
    return this.cooperativeService.create(createCooperativeDto);
  }

  @Get('search')
  @Roles(UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Search cooperatives with advanced filtering',
    description:
      'Search cooperatives with comprehensive filtering options including name, code, status, and date range. Role-based access applies.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cooperatives search results retrieved successfully',
    type: PaginatedResponseDto<CooperativeResponseDto>,
  })
  async searchCooperatives(
    @Query() searchDto: CooperativeSearchDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<CooperativeResponseDto>> {
    return this.cooperativeService.searchCooperatives(
      searchDto,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all cooperatives with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Cooperatives retrieved successfully',
    type: PaginatedResponseDto<CooperativeResponseDto>,
  })
  async findAll(
    @Query() paginationDto: PaginationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<PaginatedResponseDto<CooperativeResponseDto>> {
    return this.cooperativeService.findAll(
      paginationDto,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get cooperative by ID' })
  @ApiResponse({
    status: 200,
    description: 'Cooperative retrieved successfully',
    type: CooperativeResponseDto,
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<CooperativeResponseDto> {
    return this.cooperativeService.findOne(
      id,
      currentUser.role as UserRole,
      currentUser.cooperativeId,
    );
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update cooperative status' })
  @ApiResponse({
    status: 200,
    description: 'Cooperative status updated successfully',
    type: CooperativeResponseDto,
  })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: CooperativeStatus,
  ): Promise<CooperativeResponseDto> {
    return this.cooperativeService.updateStatus(id, status);
  }
}

@ApiTags('Public - Cooperatives')
@Controller('public/cooperatives')
@Public()
export class PublicCooperativeController {
  constructor(private cooperativeService: CooperativeService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all active cooperatives (public endpoint)',
    description:
      'Returns a list of all active cooperatives without requiring authentication',
  })
  @ApiResponse({
    status: 200,
    description: 'Cooperatives retrieved successfully',
    type: PaginatedResponseDto<CooperativeResponseDto>,
  })
  async findAllPublic(
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<CooperativeResponseDto>> {
    return this.cooperativeService.findAllPublic(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get cooperative by ID (public endpoint)',
    description:
      'Returns cooperative details by ID without requiring authentication',
  })
  @ApiResponse({
    status: 200,
    description: 'Cooperative retrieved successfully',
    type: CooperativeResponseDto,
  })
  async findOnePublic(
    @Param('id') id: string,
  ): Promise<CooperativeResponseDto> {
    return this.cooperativeService.findOnePublic(id);
  }
}
