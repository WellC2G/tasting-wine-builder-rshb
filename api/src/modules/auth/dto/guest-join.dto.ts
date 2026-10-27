import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { trimString } from './transformers';

export class GuestJoinDto {
  @ApiProperty({
    description: 'Шестизначный PIN-код сессии дегустации',
    example: '482910',
    minLength: 6,
    maxLength: 6,
  })
  @Transform(trimString)
  @IsString({ message: 'PIN-код должен быть строкой' })
  @Matches(/^\d{6}$/, { message: 'PIN-код должен состоять из 6 цифр' })
  sessionPin!: string;

  @ApiProperty({
    description: 'Отображаемое имя гостя или номер его места',
    example: 'Алексей (Стол №3)',
    maxLength: 80,
  })
  @Transform(trimString)
  @IsString({ message: 'Имя гостя должно быть строкой' })
  @IsNotEmpty({ message: 'Укажите имя или номер места' })
  @MaxLength(80, { message: 'Имя гостя не должно превышать 80 символов' })
  nickname!: string;

  @ApiProperty({
    description: 'Разрешение экрана гостя в формате ШxВ',
    example: '390x844',
  })
  @Transform(trimString)
  @IsString({ message: 'Разрешение экрана должно быть строкой' })
  @Matches(/^\d{3,5}x\d{3,5}$/, {
    message: 'Разрешение экрана должно быть в формате ШxВ, например 390x844',
  })
  screenResolution!: string;

  @ApiProperty({
    description:
      'Постоянный идентификатор устройства гостя, сохраняемый браузером',
    example: '8f14e45f-ceea-467a-8f1e-2c7a8f6f1a11',
    minLength: 8,
    maxLength: 128,
  })
  @Transform(trimString)
  @IsString({ message: 'Идентификатор устройства должен быть строкой' })
  @IsNotEmpty({ message: 'Идентификатор устройства обязателен' })
  @MaxLength(128, {
    message: 'Идентификатор устройства не должен превышать 128 символов',
  })
  @Matches(/^[a-zA-Z0-9_-]{8,128}$/, {
    message:
      'Идентификатор устройства должен содержать от 8 до 128 символов: ' +
      'латинские буквы, цифры, дефис или подчёркивание',
  })
  deviceId!: string;
}
