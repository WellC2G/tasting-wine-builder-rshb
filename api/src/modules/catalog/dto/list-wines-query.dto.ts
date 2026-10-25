import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { WineType } from '../entities/wine.entity';

const trimOptionalString = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class ListWinesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by wine type',
    enum: WineType,
    enumName: 'WineType',
  })
  @IsOptional()
  @IsEnum(WineType)
  wineType?: WineType;

  @ApiPropertyOptional({
    description: 'Filter by region (case-insensitive exact match)',
    example: 'Кубань',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @ApiPropertyOptional({
    description: 'Filter by vintage year',
    example: 2022,
    minimum: 1800,
    maximum: 2100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1800)
  @Max(2100)
  vintage?: number;

  @ApiPropertyOptional({
    description: 'Case-insensitive search by wine name or winery',
    example: 'Рислинг',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Page size',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
