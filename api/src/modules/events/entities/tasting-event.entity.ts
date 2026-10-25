import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../auth/entities/user.entity';
import { TastingRound } from './tasting-round.entity';

export enum TastingMode {
  BLIND = 'BLIND',
  OPEN = 'OPEN',
}

export enum ScaleType {
  PARKER_100 = 'PARKER_100',
  STARS_5 = 'STARS_5',
}

export enum TastingEventStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
  EXPORTED = 'EXPORTED',
}

@Entity({ name: 'tasting_events' })
@Index('uq_tasting_events_session_pin', ['sessionPin'], { unique: true })
@Index('idx_tasting_events_host_id', ['hostId'])
@Check('chk_tasting_events_session_pin', `"session_pin" ~ '^[0-9]{6}$'`)
export class TastingEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'host_id', type: 'uuid' })
  hostId!: string;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'host_id',
    foreignKeyConstraintName: 'fk_tasting_events_host',
  })
  host!: User;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ name: 'session_pin', type: 'varchar', length: 6 })
  sessionPin!: string;

  @Column({
    type: 'enum',
    enum: TastingMode,
    enumName: 'tasting_mode_enum',
    default: TastingMode.BLIND,
  })
  mode!: TastingMode;

  @Column({
    name: 'scale_type',
    type: 'enum',
    enum: ScaleType,
    enumName: 'tasting_scale_type_enum',
    default: ScaleType.PARKER_100,
  })
  scaleType!: ScaleType;

  @Column({
    type: 'enum',
    enum: TastingEventStatus,
    enumName: 'tasting_event_status_enum',
    default: TastingEventStatus.DRAFT,
  })
  status!: TastingEventStatus;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => TastingRound, (round) => round.event, { cascade: true })
  rounds!: TastingRound[];
}
