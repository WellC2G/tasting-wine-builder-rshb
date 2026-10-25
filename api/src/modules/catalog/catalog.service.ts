import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { CreateWineDto } from './dto/create-wine.dto';
import { ListWinesQueryDto } from './dto/list-wines-query.dto';
import { PaginatedWinesResponseDto } from './dto/paginated-wines-response.dto';
import { WineResponseDto } from './dto/wine-response.dto';
import { Wine } from './entities/wine.entity';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @InjectRepository(Wine)
    private readonly winesRepository: Repository<Wine>,
  ) {}

  async findAll(query: ListWinesQueryDto): Promise<PaginatedWinesResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const queryBuilder = this.winesRepository.createQueryBuilder('wine');

    if (query.wineType) {
      queryBuilder.andWhere('wine.wineType = :wineType', {
        wineType: query.wineType,
      });
    }

    if (query.region) {
      queryBuilder.andWhere('LOWER(wine.region) = LOWER(:region)', {
        region: query.region,
      });
    }

    if (query.vintage !== undefined) {
      queryBuilder.andWhere('wine.vintage = :vintage', {
        vintage: query.vintage,
      });
    }

    if (query.search) {
      queryBuilder.andWhere(
        '(wine.name ILIKE :search OR wine.winery ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    queryBuilder
      .orderBy('wine.name', 'ASC')
      .addOrderBy('wine.vintage', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [wines, total] = await queryBuilder.getManyAndCount();

    return {
      data: wines.map((wine) => WineResponseDto.fromEntity(wine)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<WineResponseDto> {
    const wine = await this.winesRepository.findOneBy({ id });

    if (!wine) {
      throw new NotFoundException(`Wine with id "${id}" was not found`);
    }

    return WineResponseDto.fromEntity(wine);
  }

  async create(dto: CreateWineDto): Promise<WineResponseDto> {
    const wine = this.winesRepository.create({
      externalCatalogId: dto.externalCatalogId,
      name: dto.name,
      winery: dto.winery,
      region: dto.region,
      grapeVarieties: dto.grapeVarieties,
      vintage: dto.vintage,
      wineType: dto.wineType,
      retailPrice: dto.retailPrice,
      imageUrl: dto.imageUrl ?? null,
    });

    try {
      const savedWine = await this.winesRepository.save(wine);
      this.logger.log(
        `Created wine ${savedWine.externalCatalogId} (${savedWine.id})`,
      );
      return WineResponseDto.fromEntity(savedWine);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          `A wine with external catalog id "${dto.externalCatalogId}" already exists`,
        );
      }

      throw error;
    }
  }
}
