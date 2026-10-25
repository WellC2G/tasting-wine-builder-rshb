import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import type { ExportPayloadDto } from '../dto/export-payload.dto';
import { ExportExternalStatus } from '../enums/export-external-status.enum';
import { TastingEvent } from '../../events/entities/tasting-event.entity';

@Entity({ name: 'export_logs' })
@Index('idx_export_logs_event_id', ['eventId'])
export class ExportLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId!: string;

  @ManyToOne(() => TastingEvent, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'event_id',
    foreignKeyConstraintName: 'fk_export_logs_event',
  })
  event!: TastingEvent;

  @Column({ name: 'target_endpoint', type: 'varchar', length: 500 })
  targetEndpoint!: string;

  @Column({
    name: 'mock_receipt_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  mockReceiptId!: string | null;

  @Column({ name: 'valid_votes_count', type: 'integer' })
  validVotesCount!: number;

  @Column({ name: 'rejected_outliers_count', type: 'integer' })
  rejectedOutliersCount!: number;

  @Column({ name: 'payload_snapshot', type: 'jsonb' })
  payloadSnapshot!: ExportPayloadDto;

  @Column({
    name: 'external_status',
    type: 'enum',
    enum: ExportExternalStatus,
    enumName: 'export_external_status_enum',
  })
  externalStatus!: ExportExternalStatus;

  @CreateDateColumn({ name: 'exported_at', type: 'timestamptz' })
  exportedAt!: Date;
}
