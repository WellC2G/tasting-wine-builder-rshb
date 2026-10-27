import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TastingSessionPublisherService } from '../realtime/tasting-session-publisher.service';
import {
  TastingRound,
  TastingRoundStatus,
} from '../events/entities/tasting-round.entity';
import { TIMER_EXPIRED_MESSAGE } from './tasting-session.constants';

interface StartRoundTimerParams {
  eventId: string;
  roundId: string;
  durationSeconds: number;
  endsAt: Date;
  onExpire: () => void;
}

interface ActiveRoundTimer {
  eventId: string;
  roundId: string;
  durationSeconds: number;
  endsAt: Date;
  timeout: NodeJS.Timeout;
  onExpire: () => void;
}

@Injectable()
export class RoomStateService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoomStateService.name);
  private readonly timers = new Map<string, ActiveRoundTimer>();

  constructor(
    @InjectRepository(TastingRound)
    private readonly roundsRepository: Repository<TastingRound>,
    private readonly publisher: TastingSessionPublisherService,
  ) {}

  async onModuleInit(): Promise<void> {
    let activeRounds: TastingRound[];

    try {
      activeRounds = await this.roundsRepository.find({
        where: { status: TastingRoundStatus.ACTIVE },
      });
    } catch (error) {
      this.logger.error(
        'Failed to load active rounds for timer restoration',
        error instanceof Error ? error.stack : String(error),
      );
      return;
    }

    for (const round of activeRounds) {
      try {
        const startedAt = round.startedAt ?? new Date();

        if (!round.startedAt) {
          round.startedAt = startedAt;
          await this.roundsRepository.save(round);
        }

        const endsAt = new Date(
          startedAt.getTime() + round.durationSeconds * 1000,
        );

        if (endsAt.getTime() <= Date.now()) {
          const result = await this.roundsRepository.update(
            {
              id: round.id,
              eventId: round.eventId,
              status: TastingRoundStatus.ACTIVE,
            },
            { status: TastingRoundStatus.VOTING_CLOSED },
          );

          if (result.affected && result.affected > 0) {
            this.publisher.emitToEvent(
              round.eventId,
              'voting_closed',
              {
                roundId: round.id,
                message: TIMER_EXPIRED_MESSAGE,
              },
            );
            this.logger.log(
              `Closed expired active round ${round.id} on startup`,
            );
          }

          continue;
        }

        this.startRoundTimer({
          eventId: round.eventId,
          roundId: round.id,
          durationSeconds: round.durationSeconds,
          endsAt,
          onExpire: () => {
            this.publisher.emitToEvent(
              round.eventId,
              'voting_closed',
              {
                roundId: round.id,
                message: TIMER_EXPIRED_MESSAGE,
              },
            );
          },
        });

        const remainingSeconds = Math.max(
          0,
          Math.ceil((endsAt.getTime() - Date.now()) / 1000),
        );
        this.logger.log(
          `Restored timer for active round ${round.id} ` +
            `(event ${round.eventId}, ${remainingSeconds}s remaining)`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to restore timer for round ${round.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  /**
   * Registers the only active timer for an event/round pair and closes voting
   * automatically when the deadline is reached.
   */
  startRoundTimer(params: StartRoundTimerParams): void {
    this.clearRoundTimer(params.eventId, params.roundId);

    const key = this.timerKey(params.eventId, params.roundId);
    const delay = Math.max(0, params.endsAt.getTime() - Date.now());
    const timeout = setTimeout(() => {
      void this.expireRound(key);
    }, delay);

    this.timers.set(key, {
      eventId: params.eventId,
      roundId: params.roundId,
      durationSeconds: params.durationSeconds,
      endsAt: params.endsAt,
      timeout,
      onExpire: params.onExpire,
    });
  }

  clearRoundTimer(eventId: string, roundId: string): void {
    const key = this.timerKey(eventId, roundId);
    const timer = this.timers.get(key);

    if (!timer) {
      return;
    }

    clearTimeout(timer.timeout);
    this.timers.delete(key);
  }

  clearEventTimers(eventId: string): void {
    for (const [key, timer] of this.timers.entries()) {
      if (timer.eventId === eventId) {
        clearTimeout(timer.timeout);
        this.timers.delete(key);
      }
    }
  }

  getEndsAt(eventId: string, roundId: string): Date | null {
    return this.timers.get(this.timerKey(eventId, roundId))?.endsAt ?? null;
  }

  getRemainingSeconds(
    eventId: string,
    roundId: string,
  ): number | null {
    const timer = this.timers.get(this.timerKey(eventId, roundId));

    if (!timer) {
      return null;
    }

    return Math.max(
      0,
      Math.ceil((timer.endsAt.getTime() - Date.now()) / 1000),
    );
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer.timeout);
    }

    this.timers.clear();
  }

  private async expireRound(key: string): Promise<void> {
    const timer = this.timers.get(key);

    if (!timer) {
      return;
    }

    this.timers.delete(key);

    try {
      const result = await this.roundsRepository.update(
        {
          id: timer.roundId,
          eventId: timer.eventId,
          status: TastingRoundStatus.ACTIVE,
        },
        { status: TastingRoundStatus.VOTING_CLOSED },
      );

      if (result.affected && result.affected > 0) {
        timer.onExpire();
      }
    } catch (error) {
      this.logger.error(
        `Failed to close voting for round ${timer.roundId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private timerKey(eventId: string, roundId: string): string {
    return `${eventId}:${roundId}`;
  }
}
