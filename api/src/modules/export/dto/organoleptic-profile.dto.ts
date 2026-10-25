import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class OrganolepticProfileDto {
  @ApiProperty({
    example: 1.8,
    description: 'Средняя сладость',
  })
  @IsNumber({}, { message: 'Средняя сладость должна быть числом' })
  @Min(1, { message: 'Средняя сладость должна быть от 1 до 10' })
  @Max(10, { message: 'Средняя сладость должна быть от 1 до 10' })
  sweetness!: number;

  @ApiProperty({
    example: 6.9,
    description: 'Средняя кислотность',
  })
  @IsNumber({}, { message: 'Средняя кислотность должна быть числом' })
  @Min(1, { message: 'Средняя кислотность должна быть от 1 до 10' })
  @Max(10, { message: 'Средняя кислотность должна быть от 1 до 10' })
  acidity!: number;

  @ApiProperty({
    example: 7.8,
    description: 'Средняя танинность',
  })
  @IsNumber({}, { message: 'Средняя танинность должна быть числом' })
  @Min(1, { message: 'Средняя танинность должна быть от 1 до 10' })
  @Max(10, { message: 'Средняя танинность должна быть от 1 до 10' })
  tannins!: number;

  @ApiProperty({
    example: 8.1,
    description: 'Среднее тело вина',
  })
  @IsNumber({}, { message: 'Среднее тело вина должно быть числом' })
  @Min(1, { message: 'Среднее тело вина должно быть от 1 до 10' })
  @Max(10, { message: 'Среднее тело вина должно быть от 1 до 10' })
  body!: number;

  @ApiProperty({
    example: 8.5,
    description: 'Средняя интенсивность аромата',
  })
  @IsNumber(
    {},
    {
      message:
        'Средняя интенсивность аромата должна быть числом',
    },
  )
  @Min(1, {
    message:
      'Средняя интенсивность аромата должна быть от 1 до 10',
  })
  @Max(10, {
    message:
      'Средняя интенсивность аромата должна быть от 1 до 10',
  })
  aromaIntensity!: number;
}
