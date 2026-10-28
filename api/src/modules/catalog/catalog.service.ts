import { randomBytes } from 'node:crypto';

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { isUniqueViolation } from '../../common/database/is-unique-violation';
import { CreateWineDto } from './dto/create-wine.dto';
import { UpdateWineDto } from './dto/update-wine.dto';
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
      throw new NotFoundException(
        `Вино с идентификатором "${id}" не найдено`,
      );
    }

    return WineResponseDto.fromEntity(wine);
  }

  async create(dto: CreateWineDto): Promise<WineResponseDto> {
    const externalCatalogId =
      dto.externalCatalogId ?? this.generateExternalCatalogId();
    const wine = this.winesRepository.create({
      externalCatalogId,
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
        isUniqueViolation(
          error,
          'uq_wines_external_catalog_id',
        )
      ) {
        throw new ConflictException(
          `Вино с внешним идентификатором "${externalCatalogId}" уже существует`,
        );
      }

      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateWineDto,
  ): Promise<WineResponseDto> {
    const wine = await this.winesRepository.findOneBy({ id });

    if (!wine) {
      throw new NotFoundException(
        `Вино с идентификатором "${id}" не найдено`,
      );
    }

    if (dto.name !== undefined) wine.name = dto.name;
    if (dto.winery !== undefined) wine.winery = dto.winery;
    if (dto.region !== undefined) wine.region = dto.region;
    if (dto.grapeVarieties !== undefined) {
      wine.grapeVarieties = dto.grapeVarieties;
    }
    if (dto.vintage !== undefined) wine.vintage = dto.vintage;
    if (dto.wineType !== undefined) wine.wineType = dto.wineType;
    if (dto.retailPrice !== undefined) {
      wine.retailPrice = dto.retailPrice;
    }
    if (dto.imageUrl !== undefined) {
      wine.imageUrl = dto.imageUrl;
    }

    const savedWine = await this.winesRepository.save(wine);
    this.logger.log(`Updated wine ${savedWine.id}`);

    return WineResponseDto.fromEntity(savedWine);
  }

  private generateExternalCatalogId(): string {
    return `wine-${Date.now()}-${randomBytes(3).toString('hex')}`;
  }
}
