import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import {
  ScaleType,
  TastingMode,
} from '../entities/tasting-event.entity';
import { CreateRoundDto } from './create-round.dto';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateEventDto {
  @ApiProperty({
    description: 'Название дегустации',
    example: 'Слепая дегустация: Автохтоны России',
    maxLength: 200,
  })
  @Transform(trimString)
  @IsString({ message: 'Название должно быть строкой' })
  @IsNotEmpty({ message: 'Укажите название дегустации' })
  @MaxLength(200, {
    message: 'Название не должно превышать 200 символов',
  })
  title!: string;

  @ApiPropertyOptional({
    description: 'Режим дегустации',
    enum: TastingMode,
    enumName: 'TastingMode',
    default: TastingMode.BLIND,
    example: TastingMode.BLIND,
  })
  @IsOptional()
  @IsEnum(TastingMode, {
    message: 'Режим должен быть одним из: BLIND, OPEN',
  })
  mode?: TastingMode;

  @ApiPropertyOptional({
    description: 'Шкала оценки',
    enum: ScaleType,
    enumName: 'ScaleType',
    default: ScaleType.PARKER_100,
    example: ScaleType.PARKER_100,
  })
  @IsOptional()
  @IsEnum(ScaleType, {
    message: 'Шкала должна быть PARKER_100',
  })
  scaleType?: ScaleType;

  @ApiPropertyOptional({
    description: 'Запланированные дата и время дегустации (ISO 8601)',
    example: '2026-11-14T18:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601(
    { strict: true },
    {
      message:
        'Дата дегустации должна быть в формате ISO 8601, например 2026-11-14T18:00:00.000Z',
    },
  )
  scheduledAt?: string;

  @ApiProperty({
    description: 'Список раундов дегустации',
    type: [CreateRoundDto],
  })
  @IsArray({ message: 'Раунды должны быть массивом' })
  @ArrayMinSize(1, {
    message: 'Добавьте хотя бы один раунд дегустации',
  })
  @ArrayMaxSize(50, {
    message: 'Количество раундов не должно превышать 50',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateRoundDto)
  rounds!: CreateRoundDto[];
}
