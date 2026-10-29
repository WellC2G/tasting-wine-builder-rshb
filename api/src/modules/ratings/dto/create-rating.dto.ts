import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsOptional,
  IsString,
  MaxLength,
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
  @ApiProperty({
    type: ParkerBreakdownDto,
    description:
      'Разбивка оценки по 100-балльной шкале Паркера. Обязательное поле.',
  })
  @IsDefined({
    message: 'Заполните оценки по критериям Паркера',
  })
  @ValidateNested()
  @Type(() => ParkerBreakdownDto)
  parkerBreakdown!: ParkerBreakdownDto;

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
