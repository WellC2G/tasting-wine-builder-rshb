import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trimOptionalString = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class CreateRoundDto {
  @ApiProperty({
    description: 'Идентификатор вина из каталога',
    format: 'uuid',
  })
  @IsUUID(undefined, {
    message: 'Идентификатор вина должен быть корректным UUID',
  })
  wineId!: string;

  @ApiProperty({
    description: 'Порядковый номер подачи образца',
    example: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'Порядковый номер должен быть целым числом' })
  @Min(1, {
    message: 'Порядковый номер должен быть не меньше 1',
  })
  orderNumber!: number;

  @ApiPropertyOptional({
    description:
      'Обезличенная подпись образца. Если не указана, формируется автоматически',
    example: 'Образец №1',
    maxLength: 100,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString({ message: 'Подпись образца должна быть строкой' })
  @MaxLength(100, {
    message: 'Подпись образца не должна превышать 100 символов',
  })
  blindLabel?: string;

  @ApiPropertyOptional({
    description: 'Длительность раунда в секундах',
    example: 180,
    default: 180,
    minimum: 30,
    maximum: 3600,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Длительность раунда должна быть целым числом' })
  @Min(30, {
    message: 'Длительность раунда должна быть не меньше 30 секунд',
  })
  @Max(3600, {
    message: 'Длительность раунда не должна превышать 3600 секунд',
  })
  durationSeconds?: number;
}
