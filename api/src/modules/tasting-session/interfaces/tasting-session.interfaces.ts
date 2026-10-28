import type { Request } from 'express';

import type { WineType } from '../../catalog/entities/wine.entity';

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

export interface ParticipantCounterPayload {
  eventId: string;
  roundId: string | null;
  connectedCount: number;
  votedCount: number;
}

export interface JoinEventPayload {
  eventId: string;
}

export interface WineDetails {
  id: string;
  name: string;
  winery: string;
  region: string;
  grapeVarieties: string;
  vintage: number;
  wineType: WineType;
  retailPrice: number;
  imageUrl: string | null;
}

export type SessionViewer =
  | { role: 'HOST'; hostId: string }
  | { role: 'GUEST'; participantId: string; eventId: string };

export interface LiveStateRequest extends Request {
  sessionViewer?: SessionViewer;
}

export type SocketAuthContext =
  | { role: 'HOST'; hostId: string; email: string }
  | { role: 'GUEST'; participantId: string; eventId: string };

export interface TastingSocketData {
  auth?: SocketAuthContext;
}
