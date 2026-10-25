import { ApiProperty } from '@nestjs/swagger';

import { Wine, WineType } from '../entities/wine.entity';

export class WineResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    example: 'ru-wine-krasnostop-zolotovsky-2022',
    description: 'Stable external catalog identifier',
  })
  externalCatalogId!: string;

  @ApiProperty({ example: 'Красностоп Золотовский' })
  name!: string;

  @ApiProperty({ example: 'Винодельня Ведерниковъ' })
  winery!: string;

  @ApiProperty({ example: 'Долина Дона' })
  region!: string;

  @ApiProperty({ example: 'Красностоп Золотовский 100%' })
  grapeVarieties!: string;

  @ApiProperty({ example: 2022 })
  vintage!: number;

  @ApiProperty({ enum: WineType, enumName: 'WineType', example: WineType.RED })
  wineType!: WineType;

  @ApiProperty({
    example: 3490,
    description: 'Approximate retail price in RUB',
    type: Number,
  })
  retailPrice!: number;

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
    description: 'Optional label or bottle image URL',
  })
  imageUrl!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;

  static fromEntity(wine: Wine): WineResponseDto {
    return {
      id: wine.id,
      externalCatalogId: wine.externalCatalogId,
      name: wine.name,
      winery: wine.winery,
      region: wine.region,
      grapeVarieties: wine.grapeVarieties,
      vintage: wine.vintage,
      wineType: wine.wineType,
      retailPrice: wine.retailPrice,
      imageUrl: wine.imageUrl,
      createdAt: wine.createdAt,
      updatedAt: wine.updatedAt,
    };
  }
}
