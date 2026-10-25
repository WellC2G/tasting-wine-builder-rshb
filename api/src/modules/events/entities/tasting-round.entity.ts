import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Wine } from '../../catalog/entities/wine.entity';
import { TastingEvent } from './tasting-event.entity';

export enum TastingRoundStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  VOTING_CLOSED = 'VOTING_CLOSED',
  REVEALED = 'REVEALED',
}

@Entity({ name: 'tasting_rounds' })
@Index('idx_tasting_rounds_event_id', ['eventId'])
@Index('uq_tasting_rounds_event_order', ['eventId', 'orderNumber'], {
  unique: true,
})
@Check('chk_tasting_rounds_order_number', '"order_number" > 0')
@Check('chk_tasting_rounds_duration', '"duration_seconds" > 0')
export class TastingRound {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @ManyToOne(() => TastingEvent, (event) => event.rounds, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'event_id',
    foreignKeyConstraintName: 'fk_tasting_rounds_event',
  })
  event!: TastingEvent;

  @Column({ name: 'wine_id', type: 'uuid' })
  wineId!: string;

  @ManyToOne(() => Wine, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'wine_id',
    foreignKeyConstraintName: 'fk_tasting_rounds_wine',
  })
  wine!: Wine;

  @Column({ name: 'order_number', type: 'integer' })
  orderNumber!: number;

  @Column({ name: 'blind_label', type: 'varchar', length: 100 })
  blindLabel!: string;

  @Column({
    type: 'enum',
    enum: TastingRoundStatus,
    enumName: 'tasting_round_status_enum',
    default: TastingRoundStatus.PENDING,
  })
  status!: TastingRoundStatus;

  @Column({ name: 'duration_seconds', type: 'integer', default: 180 })
  durationSeconds!: number;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'revealed_at', type: 'timestamptz', nullable: true })
  revealedAt!: Date | null;
}
