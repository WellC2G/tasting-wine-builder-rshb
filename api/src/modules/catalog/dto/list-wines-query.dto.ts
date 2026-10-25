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
    description: 'Фильтр по типу вина',
    enum: WineType,
    enumName: 'WineType',
  })
  @IsOptional()
  @IsEnum(WineType, {
    message:
      'Тип вина должен быть одним из: RED, WHITE, ROSE, SPARKLING, FORTIFIED',
  })
  wineType?: WineType;

  @ApiPropertyOptional({
    description: 'Фильтр по региону без учёта регистра',
    example: 'Кубань',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'Регион должен быть строкой' })
  @MaxLength(120, {
    message: 'Название региона не должно превышать 120 символов',
  })
  region?: string;

  @ApiPropertyOptional({
    description: 'Фильтр по году урожая',
    example: 2022,
    minimum: 1800,
    maximum: 2100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Год урожая должен быть целым числом' })
  @Min(1800, { message: 'Год урожая должен быть не меньше 1800' })
  @Max(2100, { message: 'Год урожая не должен превышать 2100' })
  vintage?: number;

  @ApiPropertyOptional({
    description:
      'Поиск по названию вина или винодельне без учёта регистра',
    example: 'Рислинг',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'Поисковый запрос должен быть строкой' })
  @MaxLength(120, {
    message: 'Поисковый запрос не должен превышать 120 символов',
  })
  search?: string;

  @ApiPropertyOptional({
    description: 'Номер страницы, начиная с 1',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Номер страницы должен быть целым числом' })
  @Min(1, { message: 'Номер страницы должен быть не меньше 1' })
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Количество записей на странице',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({
    message: 'Количество записей на странице должно быть целым числом',
  })
  @Min(1, {
    message: 'Количество записей на странице должно быть не меньше 1',
  })
  @Max(100, {
    message: 'Количество записей на странице не должно превышать 100',
  })
  limit: number = 20;
}
