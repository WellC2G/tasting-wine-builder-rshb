import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { isUniqueViolation } from '../../common/database/is-unique-violation';

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
import { EventParticipantDto } from '../events/dto/event-participant.dto';
import { ParticipantCounterService } from '../realtime/participant-counter.service';
import { Rating } from '../ratings/entities/rating.entity';
import { RoundStatsResponseDto } from '../ratings/dto/round-stats-response.dto';
import { OutlierFilterService } from '../ratings/services/outlier-filter.service';
import { TastingSessionPublisherService } from '../realtime/tasting-session-publisher.service';
import {
  EVENT_NOT_FOUND_MESSAGE,
  ROUND_NOT_FOUND_MESSAGE,
} from './tasting-session.constants';
import {
  EventSummaryStatsDto,
  SummaryRoundItemDto,
} from './dto/event-summary-stats.dto';
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

interface PauseRoundResult extends OwnedRound {
  remainingSeconds: number;
}

interface RoundTimerUpdateResult extends OwnedRound {
  endsAt: Date | null;
  remainingSeconds: number;
}

export interface RemovedParticipantResult {
  event: TastingEvent;
  participant: Participant;
  participants: EventParticipantDto[];
  counter: ParticipantCounterPayload;
  updatedRounds: Array<{
    round: TastingRound;
    stats: RoundStatsResponseDto;
  }>;
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
    @InjectRepository(Rating)
    private readonly ratingsRepository: Repository<Rating>,
    private readonly roomStateService: RoomStateService,
    private readonly participantCounterService: ParticipantCounterService,
    private readonly publisher: TastingSessionPublisherService,
    private readonly outlierFilterService: OutlierFilterService,
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

  async startEvent(
    eventId: string,
    hostId: string,
  ): Promise<TastingEvent> {
    const event = await this.eventsRepository.findOneBy({
      id: eventId,
      hostId,
    });

    if (!event) {
      throw new NotFoundException(EVENT_NOT_FOUND_MESSAGE);
    }

    if (event.status === TastingEventStatus.ACTIVE) {
      return event;
    }

    if (event.status !== TastingEventStatus.DRAFT) {
      throw new ConflictException(
        'Начать дегустацию можно только из черновика мероприятия',
      );
    }

    await this.assertNoOtherActiveEvent(event.id);

    event.status = TastingEventStatus.ACTIVE;

    try {
      await this.eventsRepository.save(event);
    } catch (error) {
      if (
        isUniqueViolation(
          error,
          'uq_tasting_events_single_active',
        )
      ) {
        await this.throwOtherActiveEventConflict(event.id);
      }

      throw error;
    }

    this.publisher.emitEventStateToAll(
      event.id,
      'event_status_updated',
      {
        eventId: event.id,
        status: TastingEventStatus.ACTIVE,
        title: event.title,
      },
    );

    return event;
  }

  async finishEvent(
    eventId: string,
    hostId: string,
  ): Promise<TastingEvent> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId, hostId },
      relations: { rounds: true },
    });

    if (!event) {
      throw new NotFoundException(EVENT_NOT_FOUND_MESSAGE);
    }

    if (
      event.status === TastingEventStatus.FINISHED ||
      event.status === TastingEventStatus.EXPORTED
    ) {
      return event;
    }

    if (event.status !== TastingEventStatus.ACTIVE) {
      throw new ConflictException(
        'Завершить можно только активную дегустацию',
      );
    }

    const allRoundsFinalized =
      event.rounds.length > 0 &&
      event.rounds.every(
        (round) =>
          round.status === TastingRoundStatus.REVEALED ||
          round.status === TastingRoundStatus.SKIPPED,
      );

    if (!allRoundsFinalized) {
      throw new ConflictException(
        'Завершить дегустацию можно после раскрытия или пропуска всех образцов',
      );
    }

    event.status = TastingEventStatus.FINISHED;
    await this.eventsRepository.save(event);
    this.roomStateService.clearEventTimers(event.id);
    this.roomStateService.clearEventPausedRemainingSeconds(event.id);
    this.publisher.emitEventStateToAll(
      event.id,
      'event_status_updated',
      {
        eventId: event.id,
        status: TastingEventStatus.FINISHED,
        title: event.title,
      },
    );
    this.publisher.emitToEvent(event.id, 'event_finished', {
      eventId: event.id,
      status: TastingEventStatus.FINISHED,
      message: 'Дегустация завершена сомелье!',
    });

    return event;
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

    if (event.status !== TastingEventStatus.ACTIVE) {
      throw new ConflictException(
        'Сначала начните дегустацию, затем запускайте раунды',
      );
    }

    if (
      round.status !== TastingRoundStatus.PENDING &&
      round.status !== TastingRoundStatus.SKIPPED
    ) {
      throw new ConflictException(
        'Этот раунд уже запускался. Используйте продолжение или перезапуск раунда',
      );
    }

    const roundInProgress = event.rounds.find(
      (eventRound) =>
        eventRound.id !== round.id &&
        (eventRound.status === TastingRoundStatus.ACTIVE ||
          eventRound.status === TastingRoundStatus.VOTING_CLOSED),
    );

    if (roundInProgress) {
      throw new ConflictException(
        'Сначала завершите текущий раунд или пропустите вино',
      );
    }

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

    const startedAt = new Date();

    round.status = TastingRoundStatus.ACTIVE;
    round.startedAt = startedAt;
    round.durationSeconds = duration;
    round.revealedAt = null;

    await this.roundsRepository.save(round);
    this.roomStateService.clearPausedRemainingSeconds(
      event.id,
      round.id,
    );
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
  ): Promise<PauseRoundResult> {
    const { event, round } = await this.findOwnedRound(
      eventId,
      roundId,
      hostId,
    );

    if (event.status !== TastingEventStatus.ACTIVE) {
      throw new ConflictException('Дегустация ещё не начата');
    }

    if (round.status === TastingRoundStatus.VOTING_CLOSED) {
      return {
        event,
        round,
        remainingSeconds:
          this.roomStateService.getPausedRemainingSeconds(
            event.id,
            round.id,
          ) ?? round.durationSeconds,
      };
    }

    if (round.status !== TastingRoundStatus.ACTIVE) {
      throw new ConflictException(
        'Остановить можно только активный раунд',
      );
    }

    const remainingSeconds = Math.max(
      0,
      Math.ceil(
        this.getRemainingSecondsForRound(event.id, round),
      ),
    );

    this.roomStateService.clearRoundTimer(event.id, round.id);
    this.roomStateService.setPausedRemainingSeconds(
      event.id,
      round.id,
      remainingSeconds,
    );

    round.status = TastingRoundStatus.VOTING_CLOSED;
    round.durationSeconds = Math.max(1, remainingSeconds);
    await this.roundsRepository.save(round);

    return { event, round, remainingSeconds };
  }

  async finishRound(
    eventId: string,
    roundId: string,
    hostId: string,
  ): Promise<RevealBottleResult> {
    const { event, round } = await this.findOwnedRound(
      eventId,
      roundId,
      hostId,
    );

    if (event.status !== TastingEventStatus.ACTIVE) {
      throw new ConflictException(
        'Завершать раунды можно только во время активной дегустации',
      );
    }

    if (
      round.status !== TastingRoundStatus.ACTIVE &&
      round.status !== TastingRoundStatus.VOTING_CLOSED
    ) {
      throw new ConflictException(
        'Завершить можно только активный или приостановленный раунд',
      );
    }

    round.status = TastingRoundStatus.REVEALED;
    round.revealedAt =
      event.mode === TastingMode.OPEN ? new Date() : null;
    await this.roundsRepository.save(round);
    this.roomStateService.clearRoundTimer(event.id, round.id);
    this.roomStateService.clearPausedRemainingSeconds(
      event.id,
      round.id,
    );
    this.roomStateService.setLastViewedRound(event.id, round.id);

    return { event, round, wine: round.wine };
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

    if (event.status === TastingEventStatus.DRAFT) {
      throw new ConflictException(
        'Сначала завершите раунд, затем раскрывайте вино',
      );
    }

    if (round.status !== TastingRoundStatus.REVEALED) {
      throw new ConflictException(
        'Сначала завершите раунд, затем раскрывайте вино',
      );
    }

    if (event.mode === TastingMode.OPEN) {
      if (!round.revealedAt) {
        round.revealedAt = new Date();
        await this.roundsRepository.save(round);
      }

      return { event, round, wine: round.wine };
    }

    if (round.revealedAt !== null) {
      throw new ConflictException('Вино уже раскрыто');
    }

    round.revealedAt = new Date();
    await this.roundsRepository.save(round);
    this.roomStateService.setLastViewedRound(event.id, round.id);

    return { event, round, wine: round.wine };
  }

  async resumeRound(
    eventId: string,
    roundId: string,
    hostId: string,
  ): Promise<StartRoundResult> {
    const { event, round } = await this.findOwnedRound(
      eventId,
      roundId,
      hostId,
    );

    if (event.status !== TastingEventStatus.ACTIVE) {
      throw new ConflictException('Дегустация ещё не начата');
    }

    if (round.status !== TastingRoundStatus.VOTING_CLOSED) {
      throw new ConflictException(
        'Продолжить можно только приостановленный раунд',
      );
    }

    const remainingSeconds =
      this.roomStateService.getPausedRemainingSeconds(
        event.id,
        round.id,
      ) ?? round.durationSeconds;

    if (remainingSeconds <= 0) {
      throw new BadRequestException(
        'Время раунда истекло (00:00). Добавьте время перед продолжением раунда.',
      );
    }

    const duration = Math.max(1, Math.ceil(remainingSeconds));
    const startedAt = new Date();

    this.roomStateService.clearPausedRemainingSeconds(
      event.id,
      round.id,
    );

    round.status = TastingRoundStatus.ACTIVE;
    round.startedAt = startedAt;
    round.durationSeconds = duration;
    round.revealedAt = null;
    await this.roundsRepository.save(round);

    return {
      event,
      round,
      endsAt: new Date(startedAt.getTime() + duration * 1000),
    };
  }

  async addRoundTime(
    eventId: string,
    roundId: string,
    hostId: string,
    additionalSeconds: number,
  ): Promise<RoundTimerUpdateResult> {
    if (
      !Number.isInteger(additionalSeconds) ||
      additionalSeconds < 1 ||
      additionalSeconds > 3600
    ) {
      throw new BadRequestException(
        'Добавить можно от 1 до 3600 секунд',
      );
    }

    const { event, round } = await this.findOwnedRound(
      eventId,
      roundId,
      hostId,
    );

    if (event.status !== TastingEventStatus.ACTIVE) {
      throw new ConflictException('Дегустация ещё не начата');
    }

    if (
      round.status !== TastingRoundStatus.ACTIVE &&
      round.status !== TastingRoundStatus.VOTING_CLOSED
    ) {
      throw new ConflictException(
        'Добавить время можно только активному или приостановленному раунду',
      );
    }

    const now = new Date();

    if (round.status === TastingRoundStatus.VOTING_CLOSED) {
      const currentRemaining =
        this.roomStateService.getPausedRemainingSeconds(
          event.id,
          round.id,
        ) ?? round.durationSeconds;
      const remainingSeconds = Math.max(
        1,
        Math.ceil(currentRemaining + additionalSeconds),
      );

      this.roomStateService.setPausedRemainingSeconds(
        event.id,
        round.id,
        remainingSeconds,
      );
      round.durationSeconds = remainingSeconds;
      await this.roundsRepository.save(round);

      return {
        event,
        round,
        endsAt: null,
        remainingSeconds,
      };
    }

    const currentEndsAt = this.roomStateService.getEndsAt(
      event.id,
      round.id,
    );
    const baseTime =
      currentEndsAt && currentEndsAt.getTime() > now.getTime()
        ? currentEndsAt.getTime()
        : now.getTime();
    const endsAt = new Date(
      baseTime + additionalSeconds * 1000,
    );
    const remainingSeconds = Math.max(
      1,
      Math.ceil((endsAt.getTime() - now.getTime()) / 1000),
    );

    this.roomStateService.clearPausedRemainingSeconds(
      event.id,
      round.id,
    );

    round.startedAt = now;
    round.durationSeconds = remainingSeconds;
    await this.roundsRepository.save(round);

    return {
      event,
      round,
      endsAt,
      remainingSeconds,
    };
  }

  async restartRound(
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

    if (event.status !== TastingEventStatus.ACTIVE) {
      throw new ConflictException(
        'Перезапускать раунды можно только во время активной дегустации',
      );
    }

    const otherRoundInProgress = event.rounds.find(
      (eventRound) =>
        eventRound.id !== round.id &&
        (eventRound.status === TastingRoundStatus.ACTIVE ||
          eventRound.status === TastingRoundStatus.VOTING_CLOSED),
    );

    if (otherRoundInProgress) {
      throw new ConflictException(
        'Сначала завершите текущий раунд или пропустите вино',
      );
    }

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

    await this.ratingsRepository.delete({ roundId: round.id });

    const startedAt = new Date();
    round.status = TastingRoundStatus.ACTIVE;
    round.startedAt = startedAt;
    round.durationSeconds = duration;
    round.revealedAt = null;
    await this.roundsRepository.save(round);
    this.roomStateService.clearPausedRemainingSeconds(
      event.id,
      round.id,
    );
    this.roomStateService.clearLastViewedRound(event.id);

    return {
      event,
      round,
      endsAt: new Date(startedAt.getTime() + duration * 1000),
    };
  }

  async skipRound(
    eventId: string,
    roundId: string,
    hostId: string,
  ): Promise<OwnedRound> {
    const { event, round } = await this.findOwnedRound(
      eventId,
      roundId,
      hostId,
    );

    if (event.status !== TastingEventStatus.ACTIVE) {
      throw new ConflictException(
        'Пропускать образцы можно только во время активной дегустации',
      );
    }

    if (round.status === TastingRoundStatus.SKIPPED) {
      return { event, round };
    }

    await this.ratingsRepository.delete({ roundId: round.id });
    round.status = TastingRoundStatus.SKIPPED;
    await this.roundsRepository.save(round);
    this.roomStateService.clearRoundTimer(event.id, round.id);
    this.roomStateService.clearPausedRemainingSeconds(
      event.id,
      round.id,
    );

    if (this.roomStateService.getLastViewedRound(event.id) === round.id) {
      this.roomStateService.clearLastViewedRound(event.id);
    }

    return { event, round };
  }

  async getSummaryStats(
    eventId: string,
    viewer: SessionViewer,
  ): Promise<EventSummaryStatsDto> {
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

    return this.buildSummaryStats(event);
  }

  async getSummaryForHostFinished(
    eventId: string,
    hostId: string,
  ): Promise<{
    event: TastingEvent;
    summary: EventSummaryStatsDto;
  }> {
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

    if (
      event.status !== TastingEventStatus.FINISHED &&
      event.status !== TastingEventStatus.EXPORTED
    ) {
      throw new ConflictException(
        'Общая статистика доступна после завершения дегустации',
      );
    }

    return {
      event,
      summary: await this.buildSummaryStats(event),
    };
  }

  async revealAllBottles(
    eventId: string,
    hostId: string,
  ): Promise<{
    event: TastingEvent;
    summary: EventSummaryStatsDto;
  }> {
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

    if (event.mode !== TastingMode.BLIND) {
      return {
        event,
        summary: await this.buildSummaryStats(event),
      };
    }

    const allRoundsFinalized =
      event.rounds.length > 0 &&
      event.rounds.every(
        (round) =>
          round.status === TastingRoundStatus.REVEALED ||
          round.status === TastingRoundStatus.SKIPPED,
      );
    const eventFinalized =
      event.status === TastingEventStatus.FINISHED ||
      event.status === TastingEventStatus.EXPORTED;

    if (!eventFinalized && !allRoundsFinalized) {
      throw new ConflictException(
        'Раскрыть все вина можно после завершения всех раундов',
      );
    }

    const roundsToReveal = event.rounds.filter(
      (round) =>
        round.status !== TastingRoundStatus.SKIPPED &&
        round.revealedAt === null,
    );

    if (roundsToReveal.length > 0) {
      const revealedAt = new Date();

      for (const round of roundsToReveal) {
        round.revealedAt = revealedAt;
      }

      await this.roundsRepository.save(roundsToReveal);
    }

    return {
      event,
      summary: await this.buildSummaryStats(event),
    };
  }

  async removeParticipant(
    eventId: string,
    participantId: string,
    hostId: string,
    keepRatings = false,
  ): Promise<RemovedParticipantResult> {
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

    const participant = await this.participantsRepository.findOneBy({
      id: participantId,
      eventId,
    });

    if (!participant) {
      throw new NotFoundException('Участник не найден');
    }

    if (keepRatings) {
      await this.ratingsRepository.update(
        { participantId: participant.id },
        { participantId: null },
      );
    } else {
      await this.ratingsRepository.delete({
        participantId: participant.id,
      });
    }

    await this.participantsRepository.delete({
      id: participant.id,
      eventId,
    });

    const roundsToRecalculate = event.rounds.filter(
      (round) =>
        round.status !== TastingRoundStatus.PENDING &&
        round.status !== TastingRoundStatus.SKIPPED,
    );
    const updatedRounds = await Promise.all(
      roundsToRecalculate.map(async (round) => ({
        round,
        stats: await this.outlierFilterService.filterAndAggregate(
          round.id,
        ),
      })),
    );
    const participants = await this.participantsRepository.find({
      where: { eventId },
      order: { joinedAt: 'ASC' },
    });
    const counter = await this.participantCounterService.getCounter(
      eventId,
    );

    return {
      event,
      participant,
      participants: participants.map((item) =>
        EventParticipantDto.fromEntity(item),
      ),
      counter,
      updatedRounds,
    };
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

  private async assertNoOtherActiveEvent(
    eventId: string,
  ): Promise<void> {
    const otherActiveEvent = await this.eventsRepository.findOne({
      where: { status: TastingEventStatus.ACTIVE },
      select: { id: true, title: true },
    });

    if (otherActiveEvent && otherActiveEvent.id !== eventId) {
      throw new ConflictException(
        `Уже запущена другая дегустация («${otherActiveEvent.title}»). Сначала завершите её.`,
      );
    }
  }

  private async throwOtherActiveEventConflict(
    eventId: string,
  ): Promise<never> {
    const otherActiveEvent = await this.eventsRepository.findOne({
      where: { status: TastingEventStatus.ACTIVE },
      select: { id: true, title: true },
    });

    if (otherActiveEvent && otherActiveEvent.id !== eventId) {
      throw new ConflictException(
        `Уже запущена другая дегустация («${otherActiveEvent.title}»). Сначала завершите её.`,
      );
    }

    throw new ConflictException(
      'Не удалось запустить дегустацию. Обновите страницу и попробуйте снова.',
    );
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

  private async buildSummaryStats(
    event: TastingEvent,
  ): Promise<EventSummaryStatsDto> {
    const rounds = [...event.rounds]
      .filter(
        (round) => round.status !== TastingRoundStatus.SKIPPED,
      )
      .sort((left, right) => left.orderNumber - right.orderNumber);

    const items: SummaryRoundItemDto[] = await Promise.all(
      rounds.map(async (round) => {
        const stats =
          await this.outlierFilterService.filterAndAggregate(
            round.id,
          );
        const isWineRevealed =
          event.mode === TastingMode.OPEN ||
          round.revealedAt !== null;

        return {
          roundId: round.id,
          orderNumber: round.orderNumber,
          blindLabel: round.blindLabel,
          status: round.status,
          isWineRevealed,
          wine: isWineRevealed
            ? WineResponseDto.fromEntity(round.wine)
            : null,
          stats: {
            totalRatings: stats.totalRatings,
            validVotesCount: stats.validVotesCount,
            outliersRemovedCount: stats.outliersRemovedCount,
            meanScore: stats.meanScore,
            medianScore: stats.medianScore,
            qualityCategory: stats.qualityCategory,
            qualityLabel: stats.qualityLabel,
          },
        };
      }),
    );

    return {
      eventId: event.id,
      mode: event.mode,
      items,
    };
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
    const endsAt =
      round.status === TastingRoundStatus.ACTIVE
        ? timerEndsAt ?? computedEndsAt
        : null;
    const remainingSeconds = this.calculateRemainingSeconds(
      event.id,
      round,
      computedEndsAt,
    );
    const isWineRevealed =
      event.mode === TastingMode.OPEN || round.revealedAt !== null;
    const canSeeWine =
      viewer.role === 'HOST' ||
      event.mode === TastingMode.OPEN ||
      round.revealedAt !== null;

    const dto: LiveStateRoundDto = {
      roundId: round.id,
      orderNumber: round.orderNumber,
      blindLabel: round.blindLabel,
      status: round.status,
      durationSeconds: round.durationSeconds,
      startedAt: round.startedAt,
      endsAt,
      remainingSeconds,
      isWineRevealed,
    };

    if (canSeeWine) {
      dto.wine = WineResponseDto.fromEntity(round.wine);
    }

    return dto;
  }

  private getRemainingSecondsForRound(
    eventId: string,
    round: TastingRound,
  ): number {
    const pausedRemaining =
      this.roomStateService.getPausedRemainingSeconds(
        eventId,
        round.id,
      );

    if (pausedRemaining !== null) {
      return pausedRemaining;
    }

    const timerRemaining = this.roomStateService.getRemainingSeconds(
      eventId,
      round.id,
    );

    if (timerRemaining !== null) {
      return timerRemaining;
    }

    if (round.startedAt) {
      const endsAt =
        round.startedAt.getTime() + round.durationSeconds * 1000;

      return Math.max(0, (endsAt - Date.now()) / 1000);
    }

    return round.durationSeconds;
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

    if (round.status === TastingRoundStatus.VOTING_CLOSED) {
      const pausedRemaining =
        this.roomStateService.getPausedRemainingSeconds(
          eventId,
          round.id,
        );

      return pausedRemaining ?? round.durationSeconds;
    }

    return 0;
  }
}
