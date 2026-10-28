import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { LiveStateAccessGuard } from './guards/live-state-access.guard';
import type { LiveStateRequest } from './interfaces/tasting-session.interfaces';
import { LiveStateResponseDto } from './dto/live-state-response.dto';
import { TastingSessionService } from './tasting-session.service';
import { AUTH_REQUIRED_MESSAGE } from './tasting-session.constants';

const eventIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException(
      'Идентификатор мероприятия должен быть корректным UUID',
    ),
});

@ApiTags('Состояние сессии')
@Controller('events')
export class TastingSessionController {
  constructor(
    private readonly tastingSessionService: TastingSessionService,
  ) {}

  @Get(':id/live-state')
  @UseGuards(LiveStateAccessGuard)
  @ApiBearerAuth('host-jwt')
  @ApiHeader({
    name: 'X-Guest-Token',
    required: false,
    description:
      'Токен гостевой сессии. Альтернатива Bearer JWT организатора.',
  })
  @ApiOperation({
    summary: 'Состояние сессии для переподключения',
    description:
      'Возвращает текущий раунд, оставшееся время, статус и количество участников. ' +
      'Организатор получает полные данные вина; гость — без метаданных вина в слепом режиме.',
  })
  @ApiParam({
    name: 'id',
    description: 'Идентификатор мероприятия',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Состояние сессии',
    type: LiveStateResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Требуется авторизация',
  })
  @ApiResponse({
    status: 404,
    description: 'Мероприятие не найдено',
  })
  getLiveState(
    @Param('id', eventIdPipe) id: string,
    @Req() request: LiveStateRequest,
  ): Promise<LiveStateResponseDto> {
    const viewer = request.sessionViewer;

    if (!viewer) {
      throw new UnauthorizedException(AUTH_REQUIRED_MESSAGE);
    }

    return this.tastingSessionService.getLiveState(id, viewer);
  }

  @Post(':id/finish')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('host-jwt')
  @ApiOperation({
    summary: 'Завершить дегустацию',
    description:
      'Доступно после того, как все раунды раскрыты или пропущены. ' +
      'Освобождает организатора и синхронизирует экран завершения.',
  })
  @ApiParam({
    name: 'id',
    description: 'Идентификатор мероприятия',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Дегустация завершена',
  })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({ status: 404, description: 'Мероприятие не найдено' })
  @ApiResponse({
    status: 409,
    description: 'Не все раунды раскрыты или пропущены',
  })
  async finish(
    @Param('id', eventIdPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ eventId: string; status: string }> {
    const event = await this.tastingSessionService.finishEvent(
      id,
      request.user.sub,
    );

    return { eventId: event.id, status: event.status };
  }
}
