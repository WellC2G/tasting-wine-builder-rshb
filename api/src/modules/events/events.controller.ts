import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { EventRoundResponseDto } from './dto/event-round-response.dto';
import { EventSummaryResponseDto } from './dto/event-summary-response.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
import { EventsService } from './events.service';

const eventIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException(
      'Идентификатор мероприятия должен быть корректным UUID',
    ),
});

@ApiTags('Мероприятия')
@ApiBearerAuth('host-jwt')
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({
    summary: 'Создать дегустацию',
    description:
      'Создаёт мероприятие с раундами и автоматически сгенерированным ' +
      'шестизначным PIN-кодом сессии.',
  })
  @ApiResponse({
    status: 201,
    description: 'Мероприятие создано',
    type: EventResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  create(
    @Body() dto: CreateEventDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<EventResponseDto> {
    return this.eventsService.create(dto, request.user.sub);
  }

  @Get()
  @ApiOperation({
    summary: 'Список мероприятий организатора',
    description:
      'Возвращает мероприятия текущего организатора с количеством раундов и участников.',
  })
  @ApiResponse({
    status: 200,
    description: 'Список мероприятий',
    type: EventSummaryResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  findAll(
    @Req() request: AuthenticatedRequest,
  ): Promise<EventSummaryResponseDto[]> {
    return this.eventsService.findAllForHost(request.user.sub);
  }

  @Get(':id/rounds')
  @ApiOperation({
    summary: 'Раунды мероприятия',
    description:
      'Возвращает раунды с полными данными вин. Доступно только организатору.',
  })
  @ApiParam({
    name: 'id',
    description: 'Идентификатор мероприятия',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Список раундов',
    type: EventRoundResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({ status: 404, description: 'Мероприятие не найдено' })
  findRounds(
    @Param('id', eventIdPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<EventRoundResponseDto[]> {
    return this.eventsService.findRoundsForHost(id, request.user.sub);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Детали мероприятия',
    description:
      'Возвращает мероприятие с раундами, данными вин и количеством участников.',
  })
  @ApiParam({
    name: 'id',
    description: 'Идентификатор мероприятия',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Детали мероприятия',
    type: EventResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({ status: 404, description: 'Мероприятие не найдено' })
  findOne(
    @Param('id', eventIdPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<EventResponseDto> {
    return this.eventsService.findOneForHost(id, request.user.sub);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Изменить статус мероприятия',
    description:
      'Переводит мероприятие в статус DRAFT, ACTIVE или FINISHED.',
  })
  @ApiParam({
    name: 'id',
    description: 'Идентификатор мероприятия',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Статус обновлён',
    type: EventResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Недопустимый статус' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({ status: 404, description: 'Мероприятие не найдено' })
  updateStatus(
    @Param('id', eventIdPipe) id: string,
    @Body() dto: UpdateEventStatusDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<EventResponseDto> {
    return this.eventsService.updateStatus(
      id,
      request.user.sub,
      dto,
    );
  }
}
