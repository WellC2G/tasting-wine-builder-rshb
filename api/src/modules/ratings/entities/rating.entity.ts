import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

import { Participant } from '../../auth/entities/participant.entity';
import { TastingRound } from '../../events/entities/tasting-round.entity';
import { ParkerQualityCategory } from '../enums/parker-quality-category.enum';

const totalScoreTransformer: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};

@Entity({ name: 'ratings' })
@Index('uq_ratings_round_participant', ['roundId', 'participantId'], {
  unique: true,
})
@Index('idx_ratings_round_valid', ['roundId'], {
  where: '"is_outlier" = false',
})
@Check(
  'chk_parker_subscores_bounds',
  `(appearance_score IS NULL OR (appearance_score BETWEEN 0 AND 5)) AND
   (aroma_score IS NULL OR (aroma_score BETWEEN 0 AND 15)) AND
   (taste_score IS NULL OR (taste_score BETWEEN 0 AND 20)) AND
   (potential_score IS NULL OR (potential_score BETWEEN 0 AND 10))`,
)
@Check(
  'chk_organoleptics_bounds',
  `(sweetness BETWEEN 1 AND 10) AND
   (acidity BETWEEN 1 AND 10) AND
   (tannins BETWEEN 1 AND 10) AND
   (body BETWEEN 1 AND 10) AND
   (aroma_intensity BETWEEN 1 AND 10)`,
)
@Check(
  'chk_total_score_bounds',
  'total_score BETWEEN 50.0 AND 100.0',
)
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'round_id', type: 'uuid' })
  roundId!: string;

  @ManyToOne(() => TastingRound, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'round_id',
    foreignKeyConstraintName: 'fk_ratings_round',
  })
  round!: TastingRound;

  @Column({ name: 'participant_id', type: 'uuid' })
  participantId!: string;

  @ManyToOne(() => Participant, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'participant_id',
    foreignKeyConstraintName: 'fk_ratings_participant',
  })
  participant!: Participant;

  @Column({ name: 'appearance_score', type: 'smallint', nullable: true })
  appearanceScore!: number | null;

  @Column({ name: 'aroma_score', type: 'smallint', nullable: true })
  aromaScore!: number | null;

  @Column({ name: 'taste_score', type: 'smallint', nullable: true })
  tasteScore!: number | null;

  @Column({ name: 'potential_score', type: 'smallint', nullable: true })
  potentialScore!: number | null;

  @Column({
    name: 'total_score',
    type: 'numeric',
    precision: 4,
    scale: 1,
    transformer: totalScoreTransformer,
  })
  totalScore!: number;

  @Column({
    name: 'quality_category',
    type: 'enum',
    enum: ParkerQualityCategory,
    enumName: 'parker_quality_category_enum',
  })
  qualityCategory!: ParkerQualityCategory;

  @Column({ type: 'smallint' })
  sweetness!: number;

  @Column({ type: 'smallint' })
  acidity!: number;

  @Column({ type: 'smallint' })
  tannins!: number;

  @Column({ type: 'smallint' })
  body!: number;

  @Column({ name: 'aroma_intensity', type: 'smallint' })
  aromaIntensity!: number;

  @Column({ name: 'aroma_tags', type: 'jsonb' })
  aromaTags!: string[];

  @Column({ name: 'personal_notes', type: 'text', nullable: true })
  personalNotes!: string | null;

  @Column({ name: 'is_outlier', type: 'boolean', default: false })
  isOutlier!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
