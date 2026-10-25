import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { OrganolepticsDto } from './organoleptics.dto';
import { ParkerBreakdownDto } from './parker-breakdown.dto';

const trimTags = ({ value }: TransformFnParams): unknown => {
  if (!Array.isArray(value)) {
    return value;
  }

  return value
    .map((tag) => (typeof tag === 'string' ? tag.trim() : tag))
    .filter((tag) => tag !== '');
};

const trimOptionalString = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class CreateRatingDto {
  @ApiPropertyOptional({
    type: ParkerBreakdownDto,
    description:
      'Разбивка оценки по 100-балльной шкале Паркера. Обязательна для PARKER_100.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ParkerBreakdownDto)
  parkerBreakdown?: ParkerBreakdownDto;

  @ApiPropertyOptional({
    description:
      'Оценка по 5-звёздочной шкале. Обязательна для STARS_5.',
    example: 4.5,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 1 },
    {
      message:
        'Оценка в звёздах должна быть числом не более чем с одним знаком после запятой',
    },
  )
  @Min(1, { message: 'Оценка в звёздах должна быть от 1 до 5' })
  @Max(5, { message: 'Оценка в звёздах должна быть от 1 до 5' })
  stars?: number;

  @ApiProperty({
    type: OrganolepticsDto,
    description: 'Органолептический профиль вина',
  })
  @ValidateNested()
  @Type(() => OrganolepticsDto)
  organoleptics!: OrganolepticsDto;

  @ApiPropertyOptional({
    description: 'Ароматические дескрипторы',
    type: [String],
    example: ['вишня', 'черный перец', 'дуб'],
  })
  @IsOptional()
  @IsArray({ message: 'Ароматические дескрипторы должны быть массивом' })
  @ArrayMaxSize(20, {
    message: 'Количество ароматических дескрипторов не должно превышать 20',
  })
  @IsString({
    each: true,
    message: 'Каждый ароматический дескриптор должен быть строкой',
  })
  @MaxLength(50, {
    each: true,
    message:
      'Каждый ароматический дескриптор не должен превышать 50 символов',
  })
  @Transform(trimTags)
  aromaTags?: string[];

  @ApiPropertyOptional({
    description: 'Личные заметки дегустатора',
    example:
      'Глубокий рубиновый цвет, мощная танинная структура, длительное пряное послевкусие.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString({ message: 'Заметки должны быть строкой' })
  @MaxLength(2000, {
    message: 'Заметки не должны превышать 2000 символов',
  })
  @Transform(trimOptionalString)
  personalNotes?: string;
}
