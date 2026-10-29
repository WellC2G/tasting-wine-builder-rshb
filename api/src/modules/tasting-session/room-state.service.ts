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
  onExpire: () => void | Promise<void>;
}

interface ActiveRoundTimer {
  eventId: string;
  roundId: string;
  durationSeconds: number;
  endsAt: Date;
  timeout: NodeJS.Timeout;
  onExpire: () => void | Promise<void>;
}

@Injectable()
export class RoomStateService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RoomStateService.name);
  private readonly timers = new Map<string, ActiveRoundTimer>();
  private readonly pausedRemainingSeconds = new Map<string, number>();
  private readonly lastViewedRoundIds = new Map<string, string>();
  private readonly displayModes = new Map<string, 'ROUND' | 'SUMMARY'>();
  private readonly summaryPages = new Map<string, number>();

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
          await this.roundsRepository.update(
            {
              id: round.id,
              eventId: round.eventId,
              status: TastingRoundStatus.ACTIVE,
            },
            { status: TastingRoundStatus.VOTING_CLOSED },
          );
          this.setPausedRemainingSeconds(
            round.eventId,
            round.id,
            0,
          );
          this.logger.log(
            `Active round ${round.id} restored as paused at 00:00`,
          );
          continue;
        }

        const restoreKey = this.timerKey(round.eventId, round.id);
        const timeout = setTimeout(() => {
          void this.expireRound(restoreKey);
        }, Math.max(0, endsAt.getTime() - Date.now()));

        this.timers.set(restoreKey, {
          eventId: round.eventId,
          roundId: round.id,
          durationSeconds: round.durationSeconds,
          endsAt,
          timeout,
          onExpire: () => {
            // No socket emissions before the gateway has initialized.
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
   * Registers the only active timer for an event/round pair. Reaching zero
   * automatically moves the round to VOTING_CLOSED and pauses at 00:00.
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

  setPausedRemainingSeconds(
    eventId: string,
    roundId: string,
    remainingSeconds: number,
  ): void {
    this.pausedRemainingSeconds.set(
      this.timerKey(eventId, roundId),
      Math.max(0, Math.ceil(remainingSeconds)),
    );
  }

  getPausedRemainingSeconds(
    eventId: string,
    roundId: string,
  ): number | null {
    return (
      this.pausedRemainingSeconds.get(
        this.timerKey(eventId, roundId),
      ) ?? null
    );
  }

  clearPausedRemainingSeconds(
    eventId: string,
    roundId: string,
  ): void {
    this.pausedRemainingSeconds.delete(this.timerKey(eventId, roundId));
  }

  clearEventPausedRemainingSeconds(eventId: string): void {
    const prefix = `${eventId}:`;

    for (const key of this.pausedRemainingSeconds.keys()) {
      if (key.startsWith(prefix)) {
        this.pausedRemainingSeconds.delete(key);
      }
    }
  }

  setDisplayMode(
    eventId: string,
    mode: 'ROUND' | 'SUMMARY',
  ): void {
    this.displayModes.set(eventId, mode);
  }

  getDisplayMode(eventId: string): 'ROUND' | 'SUMMARY' | null {
    return this.displayModes.get(eventId) ?? null;
  }

  setSummaryPage(eventId: string, page: number): void {
    this.summaryPages.set(eventId, Math.max(1, page));
  }

  getSummaryPage(eventId: string): number {
    return this.summaryPages.get(eventId) ?? 1;
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
    this.pausedRemainingSeconds.clear();
    this.lastViewedRoundIds.clear();
    this.displayModes.clear();
    this.summaryPages.clear();
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

      this.setPausedRemainingSeconds(
        timer.eventId,
        timer.roundId,
        0,
      );

      if (result.affected && result.affected > 0) {
        this.logger.log(
          `Round ${timer.roundId} timer reached zero; moved to paused`,
        );
        await timer.onExpire();
      }
    } catch (error) {
      this.logger.error(
        `Failed to auto-pause round ${timer.roundId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private timerKey(eventId: string, roundId: string): string {
    return `${eventId}:${roundId}`;
  }
}
