import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Participant } from '../auth/entities/participant.entity';
import {
  TastingRound,
  TastingRoundStatus,
} from '../events/entities/tasting-round.entity';
import type { ParticipantCounterPayload } from '../tasting-session/interfaces/tasting-session.interfaces';
import { Rating } from '../ratings/entities/rating.entity';

@Injectable()
export class ParticipantCounterService {
  constructor(
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    @InjectRepository(TastingRound)
    private readonly roundsRepository: Repository<TastingRound>,
    @InjectRepository(Rating)
    private readonly ratingsRepository: Repository<Rating>,
  ) {}

  async getCounter(
    eventId: string,
    roundId?: string,
  ): Promise<ParticipantCounterPayload> {
    const [participantCount, connectedCount] = await Promise.all([
      this.participantsRepository.countBy({ eventId }),
      this.participantsRepository.countBy({
        eventId,
        isOnline: true,
      }),
    ]);
    const targetRoundId =
      roundId ?? (await this.findCurrentRoundId(eventId));
    const votedCount = targetRoundId
      ? await this.ratingsRepository.countBy({
          roundId: targetRoundId,
        })
      : 0;

    return {
      eventId,
      roundId: targetRoundId ?? null,
      participantCount,
      connectedCount,
      votedCount,
    };
  }

  private async findCurrentRoundId(
    eventId: string,
  ): Promise<string | null> {
    const activeRound = await this.roundsRepository.findOne({
      where: {
        eventId,
        status: TastingRoundStatus.ACTIVE,
      },
      order: { orderNumber: 'ASC' },
    });

    if (activeRound) {
      return activeRound.id;
    }

    const closedRound = await this.roundsRepository.findOne({
      where: {
        eventId,
        status: TastingRoundStatus.VOTING_CLOSED,
      },
      order: { orderNumber: 'DESC' },
    });

    if (closedRound) {
      return closedRound.id;
    }

    const latestRound = await this.roundsRepository.findOne({
      where: { eventId },
      order: { orderNumber: 'DESC' },
    });

    return latestRound?.id ?? null;
  }
}
