import type {
  EventParticipant,
  RevealedWine,
  RoundStats,
  ScaleType,
  SummaryRoundItem,
  TastingMode,
} from './api';

export interface RoundStartedPayload {
  roundId: string;
  orderNumber: number;
  blindLabel: string;
  scaleType: ScaleType;
  durationSeconds: number;
  remainingSeconds: number;
  endsAt: string;
  wine?: RevealedWine;
  isResumed?: boolean;
  resetRatings?: boolean;
}

export interface VotingClosedPayload {
  roundId: string;
  message: string;
  remainingSeconds: number;
  endsAt: null;
}

export interface RoundTimerUpdatedPayload {
  roundId: string;
  status: 'ACTIVE' | 'VOTING_CLOSED';
  durationSeconds: number;
  endsAt: string | null;
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
  title: string;
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
  wine: RevealedWine | null;
  stats: RoundStats;
  isWineRevealed: boolean;
  reason: 'revealed' | 'stats';
  message: string;
}

export interface RoundCompletedPayload {
  roundId: string;
  orderNumber: number;
  blindLabel: string;
  wine: RevealedWine | null;
  stats: RoundStats;
  isWineRevealed: boolean;
  reason: 'completed';
  message: string;
}

export interface SummaryStatsShownPayload {
  eventId: string;
  mode: TastingMode;
  page: number;
  items: SummaryRoundItem[];
}

export interface SummaryPageChangedPayload {
  eventId: string;
  page: number;
}

export interface AllBottlesRevealedPayload {
  eventId: string;
  items: SummaryRoundItem[];
}

export interface ParticipantCounterPayload {
  eventId: string;
  roundId: string | null;
  participantCount: number;
  connectedCount: number;
  votedCount: number;
}

export interface ParticipantsUpdatedPayload {
  eventId: string;
  participants: EventParticipant[];
}

export interface ParticipantRemovedPayload {
  eventId: string;
  participantId: string;
  message: string;
}

export interface RoundStatsUpdatedPayload {
  eventId: string;
  roundId: string;
  stats: RoundStats;
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
  round_completed: (payload: RoundCompletedPayload) => void;
  round_timer_updated: (payload: RoundTimerUpdatedPayload) => void;
  round_skipped: (payload: RoundSkippedPayload) => void;
  voting_closed: (payload: VotingClosedPayload) => void;
  bottle_revealed: (payload: BottleRevealedPayload) => void;
  event_status_updated: (payload: EventStatusUpdatedPayload) => void;
  event_finished: (payload: EventFinishedPayload) => void;
  summary_stats_shown: (payload: SummaryStatsShownPayload) => void;
  summary_page_changed: (payload: SummaryPageChangedPayload) => void;
  all_bottles_revealed: (payload: AllBottlesRevealedPayload) => void;
  participant_counter_updated: (
    payload: ParticipantCounterPayload,
  ) => void;
  participants_updated: (payload: ParticipantsUpdatedPayload) => void;
  participant_removed: (payload: ParticipantRemovedPayload) => void;
  round_stats_updated: (payload: RoundStatsUpdatedPayload) => void;
  auth_error: (payload: SocketMessagePayload) => void;
  session_error: (payload: SocketMessagePayload) => void;
}

export interface ClientToServerEvents {
  'host:join_event': (payload: JoinEventPayload) => void;
  'host:start_event': (payload: JoinEventPayload) => void;
  'host:finish_event': (payload: JoinEventPayload) => void;
  'host:show_summary': (payload: {
    eventId: string;
    page?: number;
  }) => void;
  'host:summary_page_change': (payload: {
    eventId: string;
    page: number;
  }) => void;
  'host:reveal_all_bottles': (payload: JoinEventPayload) => void;
  'host:remove_participant': (payload: {
    eventId: string;
    participantId: string;
    keepRatings?: boolean;
  }) => void;
  'host:start_round': (payload: StartRoundPayload) => void;
  'host:lock_voting': (payload: RoundActionPayload) => void;
  'host:resume_round': (payload: RoundActionPayload) => void;
  'host:add_round_time': (payload: AddRoundTimePayload) => void;
  'host:restart_round': (payload: RestartRoundPayload) => void;
  'host:skip_round': (payload: RoundActionPayload) => void;
  'host:finish_round': (payload: RoundActionPayload) => void;
  'host:reveal_bottle': (payload: RoundActionPayload) => void;
  'host:show_stats': (payload: RoundActionPayload) => void;
}
