import { ApiProperty } from '@nestjs/swagger';

import { ScaleType } from '../../events/entities/tasting-event.entity';
import { ParkerQualityCategory } from '../enums/parker-quality-category.enum';
import { OrganolepticsDto } from './organoleptics.dto';
import { ParkerBreakdownDto } from './parker-breakdown.dto';

export class RatingResponseDto {
  @ApiProperty({ format: 'uuid' })
  ratingId!: string;

  @ApiProperty({ format: 'uuid' })
  roundId!: string;

  @ApiProperty({ format: 'uuid' })
  participantId!: string;

  @ApiProperty({
    enum: ScaleType,
    enumName: 'ScaleType',
    example: ScaleType.PARKER_100,
  })
  scaleType!: ScaleType;

  @ApiProperty({ example: 50, description: 'Базовые баллы шкалы Паркера' })
  baseScore!: number;

  @ApiProperty({
    type: ParkerBreakdownDto,
    nullable: true,
    description:
      'Разбивка по критериям Паркера. Для STARS_5 равна null.',
  })
  parkerBreakdown!: ParkerBreakdownDto | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 4.5,
    description: 'Исходная оценка в звёздах для STARS_5',
  })
  stars!: number | null;

  @ApiProperty({ example: 94 })
  totalScore!: number;

  @ApiProperty({
    enum: ParkerQualityCategory,
    enumName: 'ParkerQualityCategory',
    example: ParkerQualityCategory.OUTSTANDING,
  })
  qualityCategory!: ParkerQualityCategory;

  @ApiProperty({
    example: 'Выдающиеся вина (Outstanding)',
    description: 'Локализованное название категории качества',
  })
  qualityLabel!: string;

  @ApiProperty({
    type: OrganolepticsDto,
    description: 'Сохранённый органолептический профиль',
  })
  organoleptics!: OrganolepticsDto;

  @ApiProperty({
    type: [String],
    example: ['вишня', 'перец'],
    description: 'Сохранённые ароматические дескрипторы',
  })
  aromaTags!: string[];

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Длительное пряное послевкусие',
    description: 'Личные заметки гостя',
  })
  personalNotes!: string | null;
}
