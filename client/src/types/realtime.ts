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
}

export interface VotingClosedPayload {
  roundId: string;
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

export interface ServerToClientEvents {
  round_started: (payload: RoundStartedPayload) => void;
  voting_closed: (payload: VotingClosedPayload) => void;
  bottle_revealed: (payload: BottleRevealedPayload) => void;
  participant_counter_updated: (
    payload: ParticipantCounterPayload,
  ) => void;
  auth_error: (payload: SocketMessagePayload) => void;
  session_error: (payload: SocketMessagePayload) => void;
}

export interface ClientToServerEvents {
  'host:join_event': (payload: JoinEventPayload) => void;
  'host:start_round': (payload: StartRoundPayload) => void;
  'host:lock_voting': (payload: RoundActionPayload) => void;
  'host:reveal_bottle': (payload: RoundActionPayload) => void;
  'host:show_stats': (payload: RoundActionPayload) => void;
}
