import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

import { normalizeEmail } from './transformers';

export class LoginDto {
  @ApiProperty({
    description: 'Email организатора',
    example: 'sommelier@tasting.ru',
    maxLength: 255,
  })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Введите корректный email' })
  @MaxLength(255, { message: 'Email не должен превышать 255 символов' })
  email!: string;

  @ApiProperty({
    description: 'Пароль организатора',
    example: 'Sommelier2026!',
    maxLength: 72,
  })
  @IsString({ message: 'Пароль должен быть строкой' })
  @IsNotEmpty({ message: 'Укажите пароль' })
  @MaxLength(72, { message: 'Пароль не должен превышать 72 символа' })
  password!: string;
}
