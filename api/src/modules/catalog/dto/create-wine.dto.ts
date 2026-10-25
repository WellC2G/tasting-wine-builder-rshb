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
      'Стабильный внешний идентификатор вина для экспорта. Строчный slug.',
    example: 'ru-wine-krasnostop-zolotovsky-2022',
    maxLength: 120,
  })
  @Transform(trimString)
  @IsString({ message: 'Идентификатор каталога должен быть строкой' })
  @IsNotEmpty({ message: 'Укажите идентификатор каталога' })
  @MaxLength(120, {
    message: 'Идентификатор каталога не должен превышать 120 символов',
  })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Идентификатор каталога должен состоять из строчных латинских букв, цифр и одиночных дефисов',
  })
  externalCatalogId!: string;

  @ApiProperty({
    description: 'Название вина',
    example: 'Красностоп Золотовский',
    maxLength: 255,
  })
  @Transform(trimString)
  @IsString({ message: 'Название вина должно быть строкой' })
  @IsNotEmpty({ message: 'Укажите название вина' })
  @MaxLength(255, {
    message: 'Название вина не должно превышать 255 символов',
  })
  name!: string;

  @ApiProperty({
    description: 'Винодельня или производитель',
    example: 'Винодельня Ведерниковъ',
    maxLength: 255,
  })
  @Transform(trimString)
  @IsString({ message: 'Название винодельни должно быть строкой' })
  @IsNotEmpty({ message: 'Укажите винодельню' })
  @MaxLength(255, {
    message: 'Название винодельни не должно превышать 255 символов',
  })
  winery!: string;

  @ApiProperty({
    description: 'Регион производства',
    example: 'Долина Дона',
    maxLength: 120,
  })
  @Transform(trimString)
  @IsString({ message: 'Регион должен быть строкой' })
  @IsNotEmpty({ message: 'Укажите регион' })
  @MaxLength(120, {
    message: 'Название региона не должно превышать 120 символов',
  })
  region!: string;

  @ApiProperty({
    description: 'Сортовой состав',
    example: 'Красностоп Золотовский 100%',
    maxLength: 255,
  })
  @Transform(trimString)
  @IsString({ message: 'Сортовой состав должен быть строкой' })
  @IsNotEmpty({ message: 'Укажите сортовой состав' })
  @MaxLength(255, {
    message: 'Сортовой состав не должен превышать 255 символов',
  })
  grapeVarieties!: string;

  @ApiProperty({
    description: 'Год урожая',
    example: 2022,
    minimum: 1800,
    maximum: 2100,
  })
  @Type(() => Number)
  @IsInt({ message: 'Год урожая должен быть целым числом' })
  @Min(1800, { message: 'Год урожая должен быть не меньше 1800' })
  @Max(2100, { message: 'Год урожая не должен превышать 2100' })
  vintage!: number;

  @ApiProperty({
    description: 'Тип вина',
    enum: WineType,
    enumName: 'WineType',
    example: WineType.RED,
  })
  @IsEnum(WineType, {
    message:
      'Тип вина должен быть одним из: RED, WHITE, ROSE, SPARKLING, FORTIFIED',
  })
  wineType!: WineType;

  @ApiProperty({
    description: 'Ориентировочная розничная цена в рублях',
    example: 3490,
    minimum: 0,
    maximum: 99999999.99,
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'Цена должна быть числом не более чем с двумя знаками после запятой',
    },
  )
  @Min(0, { message: 'Цена не может быть отрицательной' })
  @Max(99999999.99, {
    message: 'Цена не должна превышать 99 999 999,99 руб.',
  })
  retailPrice!: number;

  @ApiPropertyOptional({
    description: 'Ссылка на изображение вина',
    example: 'https://example.com/wines/krasnostop.jpg',
    maxLength: 500,
    nullable: true,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'Ссылка на изображение должна быть строкой' })
  @MaxLength(500, {
    message: 'Ссылка на изображение не должна превышать 500 символов',
  })
  imageUrl?: string;
}
