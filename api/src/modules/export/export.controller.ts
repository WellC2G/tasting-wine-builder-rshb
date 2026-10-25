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
import { ExportLogResponseDto } from './dto/export-log-response.dto';
import { ExportResponseDto } from './dto/export-response.dto';
import { ExportService } from './export.service';

const eventIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException(
      'Идентификатор мероприятия должен быть корректным UUID',
    ),
});

@ApiTags('Экспорт оценок')
@ApiBearerAuth('host-jwt')
@UseGuards(JwtAuthGuard)
@Controller('events')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post(':eventId/export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Выгрузить результаты в «Народный винный рейтинг»',
    description:
      'Применяет фильтрацию 2 сигм ко всем раундам, формирует OpenAPI-пакет, ' +
      'отправляет его через адаптер и сохраняет полный аудит-снимок.',
  })
  @ApiParam({
    name: 'eventId',
    description: 'Идентификатор мероприятия',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Пакет выгружен',
    type: ExportResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'В мероприятии нет валидных оценок или раундов',
  })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({ status: 404, description: 'Мероприятие не найдено' })
  @ApiResponse({
    status: 502,
    description:
      'Внешний приёмник отклонил пакет или недоступен',
  })
  exportEvent(
    @Param('eventId', eventIdPipe) eventId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExportResponseDto> {
    return this.exportService.exportEvent(
      eventId,
      request.user.sub,
    );
  }

  @Get(':eventId/export-logs')
  @ApiOperation({
    summary: 'История выгрузок мероприятия',
    description:
      'Возвращает все попытки экспорта с полными снимками отправленного JSON.',
  })
  @ApiParam({
    name: 'eventId',
    description: 'Идентификатор мероприятия',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'История выгрузок',
    type: ExportLogResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({ status: 404, description: 'Мероприятие не найдено' })
  findExportLogs(
    @Param('eventId', eventIdPipe) eventId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExportLogResponseDto[]> {
    return this.exportService.findExportLogs(
      eventId,
      request.user.sub,
    );
  }
}
