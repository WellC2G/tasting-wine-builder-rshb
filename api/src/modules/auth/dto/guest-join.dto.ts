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
}
