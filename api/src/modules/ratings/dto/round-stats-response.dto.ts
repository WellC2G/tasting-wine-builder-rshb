import { ApiProperty } from '@nestjs/swagger';

import { ParkerQualityCategory } from '../enums/parker-quality-category.enum';

export class ParkerCriteriaMeansDto {
  @ApiProperty({
    example: 50,
    description: 'Базовые баллы шкалы Паркера',
  })
  base!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 4.6,
    description: 'Средняя оценка внешнего вида',
  })
  appearance!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 13.8,
    description: 'Средняя оценка аромата',
  })
  aroma!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 16.6,
    description: 'Средняя оценка вкуса',
  })
  taste!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 7.8,
    description: 'Средняя оценка потенциала',
  })
  potential!: number | null;
}

export class RadarProfileDto {
  @ApiProperty({ type: Number, nullable: true, example: 2.1 })
  sweetness!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 6.9 })
  acidity!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 7.8 })
  tannins!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 8.1 })
  body!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 8.5 })
  aromaIntensity!: number | null;
}

export class AromaTagFrequencyDto {
  @ApiProperty({ example: 'черная смородина' })
  tag!: string;

  @ApiProperty({ example: 12 })
  count!: number;
}

export class RoundStatsResponseDto {
  @ApiProperty({ format: 'uuid' })
  roundId!: string;

  @ApiProperty({
    example: 18,
    description: 'Всего полученных оценок',
  })
  totalRatings!: number;

  @ApiProperty({
    example: 16,
    description: 'Количество валидных оценок после фильтрации',
  })
  validVotesCount!: number;

  @ApiProperty({
    example: 2,
    description: 'Количество отфильтрованных выбросов',
  })
  outliersRemovedCount!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 91.4,
    description: 'Средний балл по валидным оценкам',
  })
  meanScore!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 92,
    description: 'Медианный балл по валидным оценкам',
  })
  medianScore!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 1.8,
    description: 'Среднеквадратическое отклонение валидных оценок',
  })
  stdDev!: number | null;

  @ApiProperty({
    enum: ParkerQualityCategory,
    enumName: 'ParkerQualityCategory',
    nullable: true,
    example: ParkerQualityCategory.OUTSTANDING,
  })
  qualityCategory!: ParkerQualityCategory | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Выдающиеся вина (Outstanding)',
  })
  qualityLabel!: string | null;

  @ApiProperty({ type: ParkerCriteriaMeansDto })
  criteriaMeans!: ParkerCriteriaMeansDto;

  @ApiProperty({ type: RadarProfileDto })
  radarProfile!: RadarProfileDto;

  @ApiProperty({
    type: [AromaTagFrequencyDto],
    description: 'Частота ароматических дескрипторов',
  })
  aromaTagFrequency!: AromaTagFrequencyDto[];
}
