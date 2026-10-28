import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  TastingRound,
  TastingRoundStatus,
} from '../events/entities/tasting-round.entity';

interface StartRoundTimerParams {
  eventId: string;
  roundId: string;
  durationSeconds: number;
  endsAt: Date;
}

interface ActiveRoundTimer {
  eventId: string;
  roundId: string;
  durationSeconds: number;
  endsAt: Date;
  timeout: NodeJS.Timeout;
}

@Injectable()
export class RoomStateService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoomStateService.name);
  private readonly timers = new Map<string, ActiveRoundTimer>();
  private readonly lastViewedRoundIds = new Map<string, string>();

  constructor(
    @InjectRepository(TastingRound)
    private readonly roundsRepository: Repository<TastingRound>,
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
          this.logger.log(
            `Active round ${round.id} timer already elapsed; ` +
              'voting remains open until the host acts',
          );
          continue;
        }

        this.startRoundTimer({
          eventId: round.eventId,
          roundId: round.id,
          durationSeconds: round.durationSeconds,
          endsAt,
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
   * Registers the only active timer for an event/round pair. Reaching zero
   * only stops the countdown; the host explicitly pauses or finalizes voting.
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

  setLastViewedRound(eventId: string, roundId: string): void {
    this.lastViewedRoundIds.set(eventId, roundId);
  }

  getLastViewedRound(eventId: string): string | null {
    return this.lastViewedRoundIds.get(eventId) ?? null;
  }

  clearLastViewedRound(eventId: string): void {
    this.lastViewedRoundIds.delete(eventId);
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
    this.lastViewedRoundIds.clear();
  }

  private async expireRound(key: string): Promise<void> {
    const timer = this.timers.get(key);

    if (!timer) {
      return;
    }

    this.timers.delete(key);
    this.logger.log(
      `Round ${timer.roundId} timer reached zero; voting remains open`,
    );
  }

  private timerKey(eventId: string, roundId: string): string {
    return `${eventId}:${roundId}`;
  }
}
