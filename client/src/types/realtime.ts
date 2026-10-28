import type {
  RevealedWine,
  RoundStats,
  ScaleType,
} from './api';

export interface RoundStartedPayload {
  roundId: string;
  orderNumber: number;
  blindLabel: string;
  scaleType: ScaleType;
  durationSeconds: number;
  endsAt: string;
  wine?: RevealedWine;
  isResumed?: boolean;
  resetRatings?: boolean;
}

export interface VotingClosedPayload {
  roundId: string;
  message: string;
  durationSeconds?: number;
}

export interface RoundTimerUpdatedPayload {
  roundId: string;
  durationSeconds: number;
  endsAt: string;
  remainingSeconds: number;
}

export interface RoundSkippedPayload {
  roundId: string;
  blindLabel: string;
  message: string;
}

export interface EventStatusUpdatedPayload {
  eventId: string;
  status: 'DRAFT' | 'ACTIVE' | 'FINISHED' | 'EXPORTED';
}

export interface EventFinishedPayload {
  eventId: string;
  status: 'FINISHED';
  message: string;
}

export interface BottleRevealedPayload {
  roundId: string;
  orderNumber?: number;
  blindLabel?: string;
  wine: RevealedWine;
  stats: RoundStats;
  message: string;
}

export interface ParticipantCounterPayload {
  eventId: string;
  roundId: string | null;
  connectedCount: number;
  votedCount: number;
}

export interface JoinEventPayload {
  eventId: string;
}

export interface SocketMessagePayload {
  message: string;
}

export interface StartRoundPayload {
  eventId: string;
  roundId: string;
  durationSeconds?: number;
}

export interface RoundActionPayload {
  eventId: string;
  roundId: string;
}

export interface AddRoundTimePayload extends RoundActionPayload {
  additionalSeconds: number;
}

export interface RestartRoundPayload extends RoundActionPayload {
  durationSeconds?: number;
}

export interface ServerToClientEvents {
  round_started: (payload: RoundStartedPayload) => void;
  round_timer_updated: (payload: RoundTimerUpdatedPayload) => void;
  round_skipped: (payload: RoundSkippedPayload) => void;
  voting_closed: (payload: VotingClosedPayload) => void;
  bottle_revealed: (payload: BottleRevealedPayload) => void;
  event_status_updated: (payload: EventStatusUpdatedPayload) => void;
  event_finished: (payload: EventFinishedPayload) => void;
  participant_counter_updated: (
    payload: ParticipantCounterPayload,
  ) => void;
  auth_error: (payload: SocketMessagePayload) => void;
  session_error: (payload: SocketMessagePayload) => void;
}

export interface ClientToServerEvents {
  'host:join_event': (payload: JoinEventPayload) => void;
  'host:start_event': (payload: JoinEventPayload) => void;
  'host:finish_event': (payload: JoinEventPayload) => void;
  'host:start_round': (payload: StartRoundPayload) => void;
  'host:lock_voting': (payload: RoundActionPayload) => void;
  'host:resume_round': (payload: RoundActionPayload) => void;
  'host:add_round_time': (payload: AddRoundTimePayload) => void;
  'host:restart_round': (payload: RestartRoundPayload) => void;
  'host:skip_round': (payload: RoundActionPayload) => void;
  'host:reveal_bottle': (payload: RoundActionPayload) => void;
  'host:show_stats': (payload: RoundActionPayload) => void;
}
