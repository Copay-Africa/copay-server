import { PartialType } from '@nestjs/swagger';
import { CreateCooperativeCategoryDto } from './create-cooperative-category.dto';

export class UpdateCooperativeCategoryDto extends PartialType(CreateCooperativeCategoryDto) {}