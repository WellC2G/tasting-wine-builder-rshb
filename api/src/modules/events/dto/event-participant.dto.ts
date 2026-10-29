import { ApiProperty } from '@nestjs/swagger';

import { Participant } from '../../auth/entities/participant.entity';

export class EventParticipantDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Алексей (Стол №3)' })
  nickname!: string;

  @ApiProperty({ example: true })
  isOnline!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-11-14T18:00:00.000Z',
  })
  joinedAt!: string;

  static fromEntity(participant: Participant): EventParticipantDto {
    return {
      id: participant.id,
      nickname: participant.nickname,
      isOnline: participant.isOnline,
      joinedAt: participant.joinedAt.toISOString(),
    };
  }
}
