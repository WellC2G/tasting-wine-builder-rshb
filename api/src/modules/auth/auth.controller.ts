import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { getRequestContext } from '../../common/http/request-context';
import { AuthService } from './services/auth.service';
import { AuthTokenResponseDto } from './dto/auth-token-response.dto';
import { GuestJoinResponseDto } from './dto/guest-join-response.dto';
import { GuestJoinDto } from './dto/guest-join.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('Авторизация')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Регистрация организатора',
    description:
      'Создаёт аккаунт организатора дегустаций. Пароль хранится в виде bcrypt-хэша.',
  })
  @ApiResponse({
    status: 201,
    description: 'Организатор успешно зарегистрирован',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({
    status: 409,
    description: 'Пользователь с таким email уже зарегистрирован',
  })
  register(@Body() dto: RegisterDto): Promise<UserResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Вход организатора',
    description: 'Проверяет email и пароль и возвращает Bearer JWT.',
  })
  @ApiResponse({
    status: 200,
    description: 'Успешный вход',
    type: AuthTokenResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({
    status: 401,
    description: 'Неверный email или пароль',
  })
  login(@Body() dto: LoginDto): Promise<AuthTokenResponseDto> {
    return this.authService.login(dto);
  }

  @Post('guest-join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Вход гостя по PIN-коду',
    description:
      'Создаёт или переиспользует анонимную гостевую сессию по SHA-256 ' +
      'отпечатку устройства. В режиме BLIND метаданные вина не возвращаются.',
  })
  @ApiResponse({
    status: 200,
    description: 'Гостевая сессия создана или переиспользована',
    type: GuestJoinResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({
    status: 404,
    description: 'Сессия дегустации с таким PIN-кодом не найдена',
  })
  @ApiResponse({
    status: 409,
    description: 'Сессия дегустации уже завершена',
  })
  guestJoin(
    @Body() dto: GuestJoinDto,
    @Req() request: Request,
  ): Promise<GuestJoinResponseDto> {
    return this.authService.guestJoin(
      dto,
      getRequestContext(request),
    );
  }
}
