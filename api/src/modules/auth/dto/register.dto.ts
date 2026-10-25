import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { normalizeEmail, trimString } from './transformers';

export class RegisterDto {
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
    description:
      'Пароль от 8 до 72 символов, содержащий хотя бы одну букву и одну цифру',
    example: 'Sommelier2026!',
    minLength: 8,
    maxLength: 72,
  })
  @IsString({ message: 'Пароль должен быть строкой' })
  @MinLength(8, { message: 'Пароль должен содержать не менее 8 символов' })
  @MaxLength(72, { message: 'Пароль не должен превышать 72 символа' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Пароль должен содержать хотя бы одну букву и одну цифру',
  })
  password!: string;

  @ApiProperty({
    description: 'Имя организатора',
    example: 'Главный Сомелье',
    maxLength: 120,
  })
  @Transform(trimString)
  @IsString({ message: 'Имя должно быть строкой' })
  @IsNotEmpty({ message: 'Укажите имя' })
  @MaxLength(120, { message: 'Имя не должно превышать 120 символов' })
  name!: string;
}
