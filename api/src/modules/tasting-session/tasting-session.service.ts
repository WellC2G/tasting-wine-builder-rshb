import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  TastingEvent,
  TastingEventStatus,
  TastingMode,
} from '../events/entities/tasting-event.entity';
import {
  TastingRound,
  TastingRoundStatus,
} from '../events/entities/tasting-round.entity';
import { Participant } from '../auth/entities/participant.entity';
import { WineResponseDto } from '../catalog/dto/wine-response.dto';
import { Wine } from '../catalog/entities/wine.entity';
import { ParticipantCounterService } from '../realtime/participant-counter.service';
import {
  EVENT_NOT_FOUND_MESSAGE,
  ROUND_NOT_FOUND_MESSAGE,
} from './tasting-session.constants';
import {
  LiveStateResponseDto,
  LiveStateRoundDto,
} from './dto/live-state-response.dto';
import type {
  ParticipantCounterPayload,
  SessionViewer,
} from './interfaces/tasting-session.interfaces';
import { RoomStateService } from './room-state.service';

interface OwnedRound {
  event: TastingEvent;
  round: TastingRound;
}

interface StartRoundResult extends OwnedRound {
  endsAt: Date;
}

interface RevealBottleResult extends OwnedRound {
  wine: Wine;
}

@Injectable()
export class TastingSessionService {
  constructor(
    @InjectRepository(TastingEvent)
    private readonly eventsRepository: Repository<TastingEvent>,
    @InjectRepository(TastingRound)
    private readonly roundsRepository: Repository<TastingRound>,
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    private readonly roomStateService: RoomStateService,
    private readonly participantCounterService: ParticipantCounterService,
  ) {}

  async findHostEventIds(hostId: string): Promise<string[]> {
    const events = await this.eventsRepository.find({
      where: { hostId },
      select: { id: true },
    });

    return events.map((event) => event.id);
  }

  async findParticipantByToken(
    guestSessionToken: string,
  ): Promise<Participant | null> {
    return this.participantsRepository.findOneBy({
      guestSessionToken,
    });
  }

  async setParticipantOnline(
    participantId: string,
    isOnline: boolean,
  ): Promise<void> {
    await this.participantsRepository.update(
      { id: participantId },
      { isOnline },
    );
  }

  async getParticipantCounter(
    eventId: string,
    roundId?: string,
  ): Promise<ParticipantCounterPayload> {
    return this.participantCounterService.getCounter(eventId, roundId);
  }

  async startRound(
    eventId: string,
    roundId: string,
    hostId: string,
    durationSeconds?: number,
  ): Promise<StartRoundResult> {
    const { event, round } = await this.findOwnedRound(
      eventId,
      roundId,
      hostId,
    );

    const duration = durationSeconds ?? round.durationSeconds;

    if (
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > 3600
    ) {
      throw new BadRequestException(
        'Длительность раунда должна быть от 1 до 3600 секунд',
      );
    }

    for (const otherRound of event.rounds) {
      if (
        otherRound.id !== round.id &&
        otherRound.status === TastingRoundStatus.ACTIVE
      ) {
        otherRound.status = TastingRoundStatus.VOTING_CLOSED;
        await this.roundsRepository.save(otherRound);
        this.roomStateService.clearRoundTimer(
          event.id,
          otherRound.id,
        );
      }
    }

    const startedAt = new Date();

    round.status = TastingRoundStatus.ACTIVE;
    round.startedAt = startedAt;
    round.durationSeconds = duration;
    round.revealedAt = null;

    await this.roundsRepository.save(round);

    if (
      event.status === TastingEventStatus.DRAFT ||
      event.status === TastingEventStatus.FINISHED
    ) {
      event.status = TastingEventStatus.ACTIVE;
      await this.eventsRepository.save(event);
    }

    this.roomStateService.clearLastViewedRound(event.id);

    return {
      event,
      round,
      endsAt: new Date(startedAt.getTime() + duration * 1000),
    };
  }

  async lockVoting(
    eventId: string,
    roundId: string,
    hostId: string,
  ): Promise<OwnedRound> {
    const { event, round } = await this.findOwnedRound(
      eventId,
      roundId,
      hostId,
    );

    if (round.status === TastingRoundStatus.REVEALED) {
      throw new ConflictException(
        'Раунд уже раскрыт, голосование нельзя закрыть повторно',
      );
    }

    round.status = TastingRoundStatus.VOTING_CLOSED;
    await this.roundsRepository.save(round);

    return { event, round };
  }

  async revealBottle(
    eventId: string,
    roundId: string,
    hostId: string,
  ): Promise<RevealBottleResult> {
    const { event, round } = await this.findOwnedRound(
      eventId,
      roundId,
      hostId,
    );

    if (
      round.status !== TastingRoundStatus.ACTIVE &&
      round.status !== TastingRoundStatus.VOTING_CLOSED
    ) {
      throw new BadRequestException(
        'Раскрыть образец можно только после запуска или закрытия голосования',
      );
    }

    round.status = TastingRoundStatus.REVEALED;
    round.revealedAt = new Date();
    await this.roundsRepository.save(round);
    this.roomStateService.setLastViewedRound(event.id, round.id);

    if (
      event.status !== TastingEventStatus.EXPORTED &&
      event.rounds.every(
        (eventRound) =>
          eventRound.status === TastingRoundStatus.REVEALED,
      )
    ) {
      event.status = TastingEventStatus.FINISHED;
      await this.eventsRepository.save(event);
    }

    return { event, round, wine: round.wine };
  }

  async findRoundForStatistics(
    eventId: string,
    roundId: string,
    hostId: string,
  ): Promise<OwnedRound> {
    const ownedRound = await this.findOwnedRound(
      eventId,
      roundId,
      hostId,
    );

    if (
      ownedRound.round.status !== TastingRoundStatus.REVEALED &&
      ownedRound.event.mode !== TastingMode.OPEN
    ) {
      throw new BadRequestException(
        'Статистика доступна только после раскрытия образца',
      );
    }

    return ownedRound;
  }

  async getLiveState(
    eventId: string,
    viewer: SessionViewer,
  ): Promise<LiveStateResponseDto> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: {
        rounds: {
          wine: true,
        },
      },
    });

    if (!event) {
      throw new NotFoundException(EVENT_NOT_FOUND_MESSAGE);
    }

    if (viewer.role === 'HOST' && event.hostId !== viewer.hostId) {
      throw new NotFoundException(EVENT_NOT_FOUND_MESSAGE);
    }

    if (viewer.role === 'GUEST' && viewer.eventId !== event.id) {
      throw new NotFoundException(EVENT_NOT_FOUND_MESSAGE);
    }

    const [participantCount, connectedParticipantCount] =
      await Promise.all([
        this.participantsRepository.countBy({ eventId: event.id }),
        this.participantsRepository.countBy({
          eventId: event.id,
          isOnline: true,
        }),
      ]);

    const currentRound = this.selectLiveRound(event.id, event.rounds);

    return {
      eventId: event.id,
      title: event.title,
      mode: event.mode,
      scaleType: event.scaleType,
      status: event.status,
      participantCount,
      connectedParticipantCount,
      currentRound: currentRound
        ? this.buildLiveRound(event, currentRound, viewer)
        : null,
    };
  }

  private async findOwnedRound(
    eventId: string,
    roundId: string,
    hostId: string,
  ): Promise<OwnedRound> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId, hostId },
      relations: {
        rounds: {
          wine: true,
        },
      },
    });

    if (!event) {
      throw new NotFoundException(EVENT_NOT_FOUND_MESSAGE);
    }

    const round = event.rounds.find(
      (eventRound) => eventRound.id === roundId,
    );

    if (!round) {
      throw new NotFoundException(ROUND_NOT_FOUND_MESSAGE);
    }

    return { event, round };
  }

  private selectLiveRound(
    eventId: string,
    rounds: TastingRound[],
  ): TastingRound | null {
    const sortedRounds = [...rounds].sort(
      (left, right) => left.orderNumber - right.orderNumber,
    );

    const activeRound = sortedRounds.find(
      (round) => round.status === TastingRoundStatus.ACTIVE,
    );

    if (activeRound) {
      return activeRound;
    }

    const lastViewedRoundId =
      this.roomStateService.getLastViewedRound(eventId);
    const lastViewedRound = lastViewedRoundId
      ? sortedRounds.find((round) => round.id === lastViewedRoundId)
      : undefined;

    if (lastViewedRound) {
      return lastViewedRound;
    }

    const lastManagedRound = [...sortedRounds]
      .reverse()
      .find((round) => round.status !== TastingRoundStatus.PENDING);

    if (lastManagedRound) {
      return lastManagedRound;
    }

    return sortedRounds[0] ?? null;
  }

  private buildLiveRound(
    event: TastingEvent,
    round: TastingRound,
    viewer: SessionViewer,
  ): LiveStateRoundDto {
    const timerEndsAt = this.roomStateService.getEndsAt(
      event.id,
      round.id,
    );
    const computedEndsAt = round.startedAt
      ? new Date(
          round.startedAt.getTime() + round.durationSeconds * 1000,
        )
      : null;
    const endsAt = timerEndsAt ?? computedEndsAt;
    const remainingSeconds = this.calculateRemainingSeconds(
      event.id,
      round,
      computedEndsAt,
    );
    const canSeeWine =
      viewer.role === 'HOST' ||
      event.mode === TastingMode.OPEN ||
      round.status === TastingRoundStatus.REVEALED;

    const dto: LiveStateRoundDto = {
      roundId: round.id,
      orderNumber: round.orderNumber,
      blindLabel: round.blindLabel,
      status: round.status,
      durationSeconds: round.durationSeconds,
      startedAt: round.startedAt,
      endsAt,
      remainingSeconds,
    };

    if (canSeeWine) {
      dto.wine = WineResponseDto.fromEntity(round.wine);
    }

    return dto;
  }

  private calculateRemainingSeconds(
    eventId: string,
    round: TastingRound,
    computedEndsAt: Date | null,
  ): number {
    if (round.status === TastingRoundStatus.ACTIVE) {
      const timerRemaining = this.roomStateService.getRemainingSeconds(
        eventId,
        round.id,
      );

      if (timerRemaining !== null) {
        return timerRemaining;
      }

      if (computedEndsAt) {
        return Math.max(
          0,
          Math.ceil((computedEndsAt.getTime() - Date.now()) / 1000),
        );
      }

      return round.durationSeconds;
    }

    if (round.status === TastingRoundStatus.PENDING) {
      return round.durationSeconds;
    }

    return 0;
  }
}
