import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import {
  ScaleType,
  TastingMode,
} from '../../events/entities/tasting-event.entity';
import { ExportSampleDto } from './export-sample.dto';

export class ExportPayloadDto {
  @ApiProperty({
    example: 'tasting-constructor-v1',
    description: 'Система-источник выгрузки',
  })
  @IsString({ message: 'Система-источник должна быть строкой' })
  @IsNotEmpty({ message: 'Укажите систему-источник' })
  @MaxLength(80, {
    message: 'Идентификатор системы-источника не должен превышать 80 символов',
  })
  sourceSystem!: string;

  @ApiProperty({
    example: '1.0.0',
    description: 'Версия схемы выгрузки',
  })
  @IsString({ message: 'Версия схемы должна быть строкой' })
  @Matches(/^\d+\.\d+\.\d+$/, {
    message:
      'Версия схемы должна соответствовать формату X.Y.Z, например 1.0.0',
  })
  schemaVersion!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Идентификатор мероприятия',
  })
  @IsUUID(undefined, {
    message: 'Идентификатор мероприятия должен быть корректным UUID',
  })
  eventId!: string;

  @ApiProperty({
    enum: TastingMode,
    enumName: 'TastingMode',
    example: TastingMode.BLIND,
  })
  @IsEnum(TastingMode, {
    message: 'Режим дегустации должен быть BLIND или OPEN',
  })
  tastingMode!: TastingMode;

  @ApiProperty({
    enum: ScaleType,
    enumName: 'ScaleType',
    example: ScaleType.PARKER_100,
  })
  @IsEnum(ScaleType, {
    message: 'Шкала оценки должна быть PARKER_100 или STARS_5',
  })
  scoringMethodology!: ScaleType;

  @ApiProperty({
    format: 'date-time',
    example: '2026-10-25T14:30:00.000Z',
    description: 'Время формирования выгрузки в ISO 8601',
  })
  @IsISO8601(
    { strict: true },
    {
      message:
        'Время выгрузки должно быть в формате ISO 8601, например 2026-10-25T14:30:00.000Z',
    },
  )
  exportedAt!: string;

  @ApiProperty({
    type: [ExportSampleDto],
    description: 'Агрегированные результаты по образцам',
  })
  @IsArray({ message: 'Образцы должны быть массивом' })
  @ArrayMinSize(1, {
    message: 'Добавьте хотя бы один образец в выгрузку',
  })
  @ValidateNested({ each: true })
  @Type(() => ExportSampleDto)
  samples!: ExportSampleDto[];
}
