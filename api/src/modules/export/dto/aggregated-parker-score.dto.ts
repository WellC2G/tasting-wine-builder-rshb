import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { ParkerQualityCategory } from '../../ratings/enums/parker-quality-category.enum';
import { ParkerCriteriaMeansDto } from './parker-criteria-means.dto';

export class AggregatedParkerScoreDto {
  @ApiProperty({
    example: 91.4,
    description: 'Средний балл по валидным оценкам',
  })
  @IsNumber({}, { message: 'Средний балл должен быть числом' })
  @Min(50, { message: 'Средний балл должен быть не меньше 50' })
  @Max(100, { message: 'Средний балл не должен превышать 100' })
  mean!: number;

  @ApiProperty({
    example: 92,
    description: 'Медианный балл',
  })
  @IsNumber({}, { message: 'Медианный балл должен быть числом' })
  @Min(50, { message: 'Медианный балл должен быть не меньше 50' })
  @Max(100, { message: 'Медианный балл не должен превышать 100' })
  median!: number;

  @ApiProperty({
    example: 1.8,
    description: 'Среднеквадратическое отклонение',
  })
  @IsNumber({}, { message: 'Отклонение должно быть числом' })
  @Min(0, { message: 'Отклонение не может быть отрицательным' })
  @Max(50, { message: 'Отклонение не должно превышать 50' })
  stdDev!: number;

  @ApiProperty({
    enum: ParkerQualityCategory,
    enumName: 'ParkerQualityCategory',
    example: ParkerQualityCategory.OUTSTANDING,
  })
  @IsEnum(ParkerQualityCategory, {
    message:
      'Категория качества должна быть одним из значений ParkerQualityCategory',
  })
  qualityCategory!: ParkerQualityCategory;

  @ApiProperty({ type: ParkerCriteriaMeansDto })
  @ValidateNested()
  @Type(() => ParkerCriteriaMeansDto)
  criteriaMeans!: ParkerCriteriaMeansDto;
}
