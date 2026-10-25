import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class ParkerBreakdownDto {
  @ApiProperty({
    description: 'Оценка внешнего вида',
    example: 4,
    minimum: 0,
    maximum: 5,
  })
  @IsInt({ message: 'Оценка внешнего вида должна быть целым числом' })
  @Min(0, { message: 'Оценка внешнего вида должна быть не меньше 0' })
  @Max(5, { message: 'Оценка внешнего вида не должна превышать 5' })
  appearance!: number;

  @ApiProperty({
    description: 'Оценка аромата и букета',
    example: 14,
    minimum: 0,
    maximum: 15,
  })
  @IsInt({ message: 'Оценка аромата должна быть целым числом' })
  @Min(0, { message: 'Оценка аромата должна быть не меньше 0' })
  @Max(15, { message: 'Оценка аромата не должна превышать 15' })
  aroma!: number;

  @ApiProperty({
    description: 'Оценка вкуса и послевкусия',
    example: 17,
    minimum: 0,
    maximum: 20,
  })
  @IsInt({ message: 'Оценка вкуса должна быть целым числом' })
  @Min(0, { message: 'Оценка вкуса должна быть не меньше 0' })
  @Max(20, { message: 'Оценка вкуса не должна превышать 20' })
  taste!: number;

  @ApiProperty({
    description: 'Оценка общего качества и потенциала',
    example: 9,
    minimum: 0,
    maximum: 10,
  })
  @IsInt({
    message: 'Оценка потенциала должна быть целым числом',
  })
  @Min(0, { message: 'Оценка потенциала должна быть не меньше 0' })
  @Max(10, { message: 'Оценка потенциала не должна превышать 10' })
  potential!: number;
}
