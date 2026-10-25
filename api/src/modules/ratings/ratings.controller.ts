import {
  BadRequestException,
  Body,
  Controller,
  Get,
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

import { CreateRatingDto } from './dto/create-rating.dto';
import { RatingResponseDto } from './dto/rating-response.dto';
import { RoundStatsResponseDto } from './dto/round-stats-response.dto';
import { GuestRatingGuard } from './guards/guest-rating.guard';
import { RoundStatsAccessGuard } from './guards/round-stats-access.guard';
import type {
  RatingsGuestRequest,
  RoundStatsRequest,
} from './interfaces/ratings-request.interface';
import { RatingsService } from './ratings.service';

const roundIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException(
      'Идентификатор раунда должен быть корректным UUID',
    ),
});

@ApiTags('Оценки')
@Controller('rounds')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post(':roundId/ratings')
  @UseGuards(GuestRatingGuard)
  @ApiHeader({
    name: 'X-Guest-Token',
    required: true,
    description: 'Токен гостевой сессии',
  })
  @ApiOperation({
    summary: 'Отправить оценку образца',
    description:
      'Принимает оценку по шкале Паркера или 5-звёздочной шкале, ' +
      'рассчитывает итоговый балл и категорию качества.',
  })
  @ApiParam({
    name: 'roundId',
    description: 'Идентификатор раунда',
    format: 'uuid',
  })
  @ApiResponse({
    status: 201,
    description: 'Оценка сохранена',
    type: RatingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({
    status: 401,
    description: 'Требуется гостевой токен',
  })
  @ApiResponse({ status: 404, description: 'Раунд не найден' })
  @ApiResponse({
    status: 409,
    description: 'Вы уже отправили оценку для этого образца',
  })
  @ApiResponse({
    status: 423,
    description: 'Приём оценок по данному образцу закрыт',
  })
  submitRating(
    @Param('roundId', roundIdPipe) roundId: string,
    @Body() dto: CreateRatingDto,
    @Req() request: RatingsGuestRequest,
  ): Promise<RatingResponseDto> {
    const participant = request.ratingParticipant;

    if (!participant) {
      throw new UnauthorizedException('Требуется гостевой токен');
    }

    return this.ratingsService.submitRating(
      roundId,
      dto,
      participant,
    );
  }

  @Get(':roundId/stats')
  @UseGuards(RoundStatsAccessGuard)
  @ApiBearerAuth('host-jwt')
  @ApiHeader({
    name: 'X-Guest-Token',
    required: false,
    description:
      'Токен гостевой сессии. Альтернатива Bearer JWT организатора.',
  })
  @ApiOperation({
    summary: 'Статистика раунда',
    description:
      'Возвращает средний балл, количество валидных оценок и выбросов, ' +
      'средние значения критериев Паркера и органолептический профиль. ' +
      'Гость получает статистику только после раскрытия образца или в режиме OPEN.',
  })
  @ApiParam({
    name: 'roundId',
    description: 'Идентификатор раунда',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Статистика раунда',
    type: RoundStatsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({
    status: 403,
    description:
      'Статистика будет доступна после раскрытия образца',
  })
  @ApiResponse({ status: 404, description: 'Раунд не найден' })
  getRoundStats(
    @Param('roundId', roundIdPipe) roundId: string,
    @Req() request: RoundStatsRequest,
  ): Promise<RoundStatsResponseDto> {
    const viewer = request.sessionViewer;

    if (!viewer) {
      throw new UnauthorizedException('Требуется авторизация');
    }

    return this.ratingsService.getRoundStats(roundId, viewer);
  }
}
