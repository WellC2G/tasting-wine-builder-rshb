import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class ParkerCriteriaMeansDto {
  @ApiProperty({
    example: 50,
    description: 'Среднее базовых баллов',
  })
  @IsNumber({}, { message: 'Среднее базовых баллов должно быть числом' })
  @Min(0, { message: 'Среднее базовых баллов не может быть отрицательным' })
  @Max(100, { message: 'Среднее базовых баллов не может превышать 100' })
  base!: number;

  @ApiProperty({
    example: 4.6,
    description: 'Средняя оценка внешнего вида',
  })
  @IsNumber(
    {},
    { message: 'Средняя оценка внешнего вида должна быть числом' },
  )
  @Min(0, { message: 'Средняя оценка внешнего вида не может быть отрицательной' })
  @Max(5, { message: 'Средняя оценка внешнего вида не может превышать 5' })
  appearance!: number;

  @ApiProperty({
    example: 13.8,
    description: 'Средняя оценка аромата',
  })
  @IsNumber({}, { message: 'Средняя оценка аромата должна быть числом' })
  @Min(0, { message: 'Средняя оценка аромата не может быть отрицательной' })
  @Max(15, { message: 'Средняя оценка аромата не может превышать 15' })
  aroma!: number;

  @ApiProperty({
    example: 16.6,
    description: 'Средняя оценка вкуса',
  })
  @IsNumber({}, { message: 'Средняя оценка вкуса должна быть числом' })
  @Min(0, { message: 'Средняя оценка вкуса не может быть отрицательной' })
  @Max(20, { message: 'Средняя оценка вкуса не может превышать 20' })
  taste!: number;

  @ApiProperty({
    example: 7.8,
    description: 'Средняя оценка потенциала',
  })
  @IsNumber({}, { message: 'Средняя оценка потенциала должна быть числом' })
  @Min(0, { message: 'Средняя оценка потенциала не может быть отрицательной' })
  @Max(10, { message: 'Средняя оценка потенциала не может превышать 10' })
  potential!: number;
}
