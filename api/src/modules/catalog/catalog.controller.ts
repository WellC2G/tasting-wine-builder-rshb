import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CatalogService } from './catalog.service';
import { CreateWineDto } from './dto/create-wine.dto';
import { ListWinesQueryDto } from './dto/list-wines-query.dto';
import { PaginatedWinesResponseDto } from './dto/paginated-wines-response.dto';
import { WineResponseDto } from './dto/wine-response.dto';

const wineIdPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException(
      'Идентификатор вина должен быть корректным UUID',
    ),
});

@ApiTags('Каталог вин')
@Controller('wines')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ApiOperation({
    summary: 'Список вин',
    description:
      'Возвращает постраничный каталог вин с фильтрами по типу, региону, ' +
      'году урожая и поиском по названию вина или винодельне без учёта регистра.',
  })
  @ApiResponse({
    status: 200,
    description: 'Постраничный каталог вин',
    type: PaginatedWinesResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Ошибка валидации параметров запроса',
  })
  findAll(
    @Query() query: ListWinesQueryDto,
  ): Promise<PaginatedWinesResponseDto> {
    return this.catalogService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить вино по идентификатору' })
  @ApiParam({
    name: 'id',
    description: 'Идентификатор вина',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Данные вина',
    type: WineResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Идентификатор должен быть корректным UUID',
  })
  @ApiResponse({ status: 404, description: 'Вино не найдено' })
  findOne(
    @Param('id', wineIdPipe) id: string,
  ): Promise<WineResponseDto> {
    return this.catalogService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Добавить вино в каталог',
    description:
      'Создаёт запись каталога. Внешний идентификатор вина должен быть уникальным.',
  })
  @ApiResponse({
    status: 201,
    description: 'Вино добавлено в каталог',
    type: WineResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({
    status: 409,
    description: 'Вино с таким внешним идентификатором уже существует',
  })
  create(@Body() dto: CreateWineDto): Promise<WineResponseDto> {
    return this.catalogService.create(dto);
  }
}
