import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { AggregatedParkerScoreDto } from './aggregated-parker-score.dto';
import { OrganolepticProfileDto } from './organoleptic-profile.dto';

export class ExportSampleDto {
  @ApiProperty({
    example: 'ru-wine-krasnostop-zolotovsky-2022',
    description: 'Внешний идентификатор вина',
  })
  @IsString({
    message: 'Внешний идентификатор вина должен быть строкой',
  })
  @IsNotEmpty({
    message: 'Укажите внешний идентификатор вина',
  })
  @MaxLength(120, {
    message:
      'Внешний идентификатор вина не должен превышать 120 символов',
  })
  externalWineId!: string;

  @ApiProperty({
    example: 18,
    description: 'Количество полученных оценок образца',
  })
  @IsInt({
    message: 'Количество участников должно быть целым числом',
  })
  @Min(0, {
    message: 'Количество участников не может быть отрицательным',
  })
  totalParticipants!: number;

  @ApiProperty({
    example: 16,
    description: 'Количество валидных оценок',
  })
  @IsInt({
    message: 'Количество валидных оценок должно быть целым числом',
  })
  @Min(0, {
    message: 'Количество валидных оценок не может быть отрицательным',
  })
  validVotesCount!: number;

  @ApiProperty({
    example: 2,
    description: 'Количество отфильтрованных выбросов',
  })
  @IsInt({
    message: 'Количество выбросов должно быть целым числом',
  })
  @Min(0, {
    message: 'Количество выбросов не может быть отрицательным',
  })
  outliersRemovedCount!: number;

  @ApiProperty({ type: AggregatedParkerScoreDto })
  @ValidateNested()
  @Type(() => AggregatedParkerScoreDto)
  aggregatedParkerScore!: AggregatedParkerScoreDto;

  @ApiProperty({ type: OrganolepticProfileDto })
  @ValidateNested()
  @Type(() => OrganolepticProfileDto)
  organolepticProfile!: OrganolepticProfileDto;

  @ApiProperty({
    type: [String],
    example: ['черная смородина', 'терн', 'черный перец'],
    description: 'Самые частые ароматические дескрипторы',
  })
  @IsArray({
    message: 'Ароматические дескрипторы должны быть массивом',
  })
  @ArrayMaxSize(20, {
    message:
      'Количество ароматических дескрипторов не должно превышать 20',
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
  topAromaDescriptors!: string[];
}
