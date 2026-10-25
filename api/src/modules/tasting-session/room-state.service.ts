import {
  Injectable,
  Logger,
  OnModuleDestroy,
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
export class RoomStateService implements OnModuleDestroy {
  private readonly logger = new Logger(RoomStateService.name);
  private readonly timers = new Map<string, ActiveRoundTimer>();

  constructor(
    @InjectRepository(TastingRound)
    private readonly roundsRepository: Repository<TastingRound>,
  ) {}

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
