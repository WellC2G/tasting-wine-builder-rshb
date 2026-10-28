import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsIP,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { OS_FAMILIES } from '../services/fingerprint.service';
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

  @ApiPropertyOptional({
    description:
      'Плотность пикселей устройства с точностью до двух знаков',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Плотность пикселей должна быть числом' })
  @Min(0.5, {
    message: 'Плотность пикселей должна быть не меньше 0.5',
  })
  @Max(10, {
    message: 'Плотность пикселей не должна превышать 10',
  })
  pixelRatio?: number;

  @ApiPropertyOptional({
    description: 'Глубина цвета экрана устройства в битах',
    example: 24,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Глубина цвета должна быть целым числом' })
  @Min(1, { message: 'Глубина цвета должна быть не меньше 1' })
  @Max(64, { message: 'Глубина цвета не должна превышать 64' })
  colorDepth?: number;

  @ApiPropertyOptional({
    description: 'Часовой пояс устройства в формате IANA',
    example: 'Europe/Moscow',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'Часовой пояс должен быть строкой' })
  @IsNotEmpty({ message: 'Укажите часовой пояс устройства' })
  @MaxLength(100, {
    message: 'Часовой пояс не должен превышать 100 символов',
  })
  timeZone?: string;

  @ApiPropertyOptional({
    description: 'Семейство операционной системы устройства',
    enum: OS_FAMILIES,
    enumName: 'OsFamily',
    example: 'Windows',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: 'Семейство ОС должно быть строкой' })
  @IsIn([...OS_FAMILIES], {
    message:
      'Семейство ОС должно быть одним из: Windows, macOS, iOS, Android, Linux, Other',
  })
  osFamily?: string;

  @ApiPropertyOptional({
    description:
      'Признак сенсорного устройства: 1 — есть сенсор, 0 — нет',
    enum: [0, 1],
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Признак сенсорного устройства должен быть числом' })
  @IsIn([0, 1], {
    message: 'Признак сенсорного устройства должен быть 0 или 1',
  })
  maxTouchPoints?: number;

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

  @ApiPropertyOptional({
    description:
      'Публичный IP-адрес, определённый браузером через HTTP-запрос',
    example: '203.0.113.10',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'HTTP-адрес должен быть строкой' })
  @MaxLength(64, {
    message: 'HTTP-адрес не должен превышать 64 символа',
  })
  @IsIP(undefined, {
    message: 'HTTP-адрес должен быть корректным IP-адресом',
  })
  httpPublicIp?: string | null;

  @ApiPropertyOptional({
    description:
      'Публичный IP-адрес, определённый через WebRTC STUN',
    example: '203.0.113.10',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'WebRTC-адрес должен быть строкой' })
  @MaxLength(64, {
    message: 'WebRTC-адрес не должен превышать 64 символа',
  })
  @IsIP(undefined, {
    message: 'WebRTC-адрес должен быть корректным IP-адресом',
  })
  webrtcPublicIp?: string | null;

  @ApiPropertyOptional({
    description:
      'Локальные IPv4-адреса устройства, полученные из WebRTC host-кандидатов',
    type: [String],
    example: ['192.168.0.42'],
  })
  @IsOptional()
  @IsArray({
    message: 'Локальные адреса WebRTC должны быть массивом',
  })
  @ArrayMaxSize(20, {
    message: 'Количество локальных адресов WebRTC не должно превышать 20',
  })
  @IsIP(undefined, {
    each: true,
    message: 'Каждый локальный адрес WebRTC должен быть корректным IP',
  })
  webrtcLocalIps?: string[];

  @ApiPropertyOptional({
    description:
      'Клиентский признак подозрения на VPN по диапазонам WebRTC',
    example: false,
  })
  @IsOptional()
  @IsBoolean({
    message: 'Признак VPN через WebRTC должен быть логическим значением',
  })
  vpnSuspectedByWebrtc?: boolean;
}
