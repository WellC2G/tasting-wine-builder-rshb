import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { TastingEvent } from '../../events/entities/tasting-event.entity';

@Entity({ name: 'participants' })
@Index('uq_participants_event_fingerprint', ['eventId', 'fingerprintHash'], {
  unique: true,
})
@Index('uq_participants_guest_session_token', ['guestSessionToken'], {
  unique: true,
})
@Index('idx_participants_event_id', ['eventId'])
@Index('idx_participants_event_client_ip', ['eventId', 'clientIp'])
@Index('idx_participants_event_device_id', ['eventId', 'deviceId'])
export class Participant {
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
    foreignKeyConstraintName: 'fk_participants_event',
  })
  event!: TastingEvent;

  @Column({ name: 'guest_session_token', type: 'varchar', length: 255 })
  guestSessionToken!: string;

  @Column({ name: 'fingerprint_hash', type: 'varchar', length: 64 })
  fingerprintHash!: string;

  @Column({
    name: 'client_ip',
    type: 'varchar',
    length: 64,
    default: 'unknown',
  })
  clientIp!: string;

  @Column({
    name: 'device_id',
    type: 'varchar',
    length: 128,
    default: 'legacy',
  })
  deviceId!: string;

  @Column({
    name: 'environment_hash',
    type: 'varchar',
    length: 64,
    default: 'legacy',
  })
  environmentHash!: string;

  @Column({ type: 'varchar', length: 80 })
  nickname!: string;

  @Column({ name: 'is_online', type: 'boolean', default: true })
  isOnline!: boolean;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt!: Date;
}
