import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

export enum WineType {
  RED = 'RED',
  WHITE = 'WHITE',
  ROSE = 'ROSE',
  SPARKLING = 'SPARKLING',
  FORTIFIED = 'FORTIFIED',
}

/**
 * PostgreSQL `numeric` values are returned as strings by the driver.
 * The API contract exposes prices as numbers, so convert at the ORM boundary.
 */
const retailPriceTransformer: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};

@Entity({ name: 'wines' })
@Index('uq_wines_external_catalog_id', ['externalCatalogId'], { unique: true })
@Index('idx_wines_wine_type', ['wineType'])
@Index('idx_wines_region', ['region'])
@Index('idx_wines_vintage', ['vintage'])
@Check('chk_wines_vintage', '"vintage" BETWEEN 1800 AND 2100')
@Check('chk_wines_retail_price', '"retail_price" >= 0')
export class Wine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'external_catalog_id',
    type: 'varchar',
    length: 120,
  })
  externalCatalogId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  winery!: string;

  @Column({ type: 'varchar', length: 120 })
  region!: string;

  @Column({ name: 'grape_varieties', type: 'varchar', length: 255 })
  grapeVarieties!: string;

  @Column({ type: 'integer' })
  vintage!: number;

  @Column({
    name: 'wine_type',
    type: 'enum',
    enum: WineType,
    enumName: 'wine_type_enum',
  })
  wineType!: WineType;

  @Column({
    name: 'retail_price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: retailPriceTransformer,
  })
  retailPrice!: number;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
