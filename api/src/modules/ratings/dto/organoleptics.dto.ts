import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class OrganolepticsDto {
  @ApiProperty({
    description: 'Сладость',
    example: 2,
    minimum: 1,
    maximum: 10,
  })
  @IsInt({ message: 'Оценка сладости должна быть целым числом' })
  @Min(1, { message: 'Оценка сладости должна быть от 1 до 10' })
  @Max(10, { message: 'Оценка сладости должна быть от 1 до 10' })
  sweetness!: number;

  @ApiProperty({
    description: 'Кислотность',
    example: 7,
    minimum: 1,
    maximum: 10,
  })
  @IsInt({ message: 'Оценка кислотности должна быть целым числом' })
  @Min(1, { message: 'Оценка кислотности должна быть от 1 до 10' })
  @Max(10, { message: 'Оценка кислотности должна быть от 1 до 10' })
  acidity!: number;

  @ApiProperty({
    description: 'Танинность',
    example: 8,
    minimum: 1,
    maximum: 10,
  })
  @IsInt({ message: 'Оценка танинности должна быть целым числом' })
  @Min(1, { message: 'Оценка танинности должна быть от 1 до 10' })
  @Max(10, { message: 'Оценка танинности должна быть от 1 до 10' })
  tannins!: number;

  @ApiProperty({
    description: 'Тело вина',
    example: 8,
    minimum: 1,
    maximum: 10,
  })
  @IsInt({ message: 'Оценка тела вина должна быть целым числом' })
  @Min(1, { message: 'Оценка тела вина должна быть от 1 до 10' })
  @Max(10, { message: 'Оценка тела вина должна быть от 1 до 10' })
  body!: number;

  @ApiProperty({
    description: 'Интенсивность аромата',
    example: 9,
    minimum: 1,
    maximum: 10,
  })
  @IsInt({
    message: 'Оценка интенсивности аромата должна быть целым числом',
  })
  @Min(1, {
    message: 'Оценка интенсивности аромата должна быть от 1 до 10',
  })
  @Max(10, {
    message: 'Оценка интенсивности аромата должна быть от 1 до 10',
  })
  aromaIntensity!: number;
}
