import {
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

@ApiTags('Catalog')
@Controller('wines')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  @ApiOperation({
    summary: 'List wines',
    description:
      'Returns a paginated wine catalog with optional filters by type, ' +
      'region, vintage and a case-insensitive name or winery search.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated wine catalog',
    type: PaginatedWinesResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  findAll(
    @Query() query: ListWinesQueryDto,
  ): Promise<PaginatedWinesResponseDto> {
    return this.catalogService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a wine by id' })
  @ApiParam({
    name: 'id',
    description: 'Wine UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Wine details',
    type: WineResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid UUID' })
  @ApiResponse({ status: 404, description: 'Wine not found' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<WineResponseDto> {
    return this.catalogService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a wine',
    description:
      'Adds a new wine to the catalog. The external catalog id must be unique.',
  })
  @ApiResponse({
    status: 201,
    description: 'Wine created',
    type: WineResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({
    status: 409,
    description: 'A wine with the same external catalog id already exists',
  })
  create(@Body() dto: CreateWineDto): Promise<WineResponseDto> {
    return this.catalogService.create(dto);
  }
}
