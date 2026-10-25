import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { WineType } from '../entities/wine.entity';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimOptionalString = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class CreateWineDto {
  @ApiProperty({
    description:
      'Stable external catalog identifier used for export mapping. Lowercase slug.',
    example: 'ru-wine-krasnostop-zolotovsky-2022',
    maxLength: 120,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'externalCatalogId must be a lowercase slug separated by single hyphens',
  })
  externalCatalogId!: string;

  @ApiProperty({
    description: 'Wine name',
    example: 'Красностоп Золотовский',
    maxLength: 255,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'Winery or producer',
    example: 'Винодельня Ведерниковъ',
    maxLength: 255,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  winery!: string;

  @ApiProperty({
    description: 'Wine region',
    example: 'Долина Дона',
    maxLength: 120,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  region!: string;

  @ApiProperty({
    description: 'Grape varieties',
    example: 'Красностоп Золотовский 100%',
    maxLength: 255,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  grapeVarieties!: string;

  @ApiProperty({
    description: 'Vintage year',
    example: 2022,
    minimum: 1800,
    maximum: 2100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1800)
  @Max(2100)
  vintage!: number;

  @ApiProperty({
    description: 'Wine type',
    enum: WineType,
    enumName: 'WineType',
    example: WineType.RED,
  })
  @IsEnum(WineType)
  wineType!: WineType;

  @ApiProperty({
    description: 'Approximate retail price in RUB',
    example: 3490,
    minimum: 0,
    maximum: 99999999.99,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  retailPrice!: number;

  @ApiPropertyOptional({
    description: 'Optional image URL',
    example: 'https://example.com/wines/krasnostop.jpg',
    maxLength: 500,
    nullable: true,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;
}
