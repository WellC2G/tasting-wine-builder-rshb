import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
}
