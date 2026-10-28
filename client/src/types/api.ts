export type TastingMode = 'BLIND' | 'OPEN';
export type ScaleType = 'PARKER_100' | 'STARS_5';
export type EventStatus = 'DRAFT' | 'ACTIVE' | 'FINISHED' | 'EXPORTED';
export type RoundStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'VOTING_CLOSED'
  | 'REVEALED';
export type WineType =
  | 'RED'
  | 'WHITE'
  | 'ROSE'
  | 'SPARKLING'
  | 'FORTIFIED';
export type OsFamily =
  | 'Windows'
  | 'macOS'
  | 'iOS'
  | 'Android'
  | 'Linux'
  | 'Other';
export type UserRole = 'HOST' | 'ADMIN';
export type ParkerQualityCategory =
  | 'CLASSIC'
  | 'OUTSTANDING'
  | 'VERY_GOOD'
  | 'GOOD'
  | 'AVERAGE'
  | 'UNACCEPTABLE';
export type ExportExternalStatus =
  | 'MOCK_SUCCESS'
  | 'WEBHOOK_SUCCESS'
  | 'FAILED';

export interface HostUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: HostUser;
}

export interface Wine {
  id: string;
  externalCatalogId: string;
  name: string;
  winery: string;
  region: string;
  grapeVarieties: string;
  vintage: number;
  wineType: WineType;
  retailPrice: number;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedWines {
  data: Wine[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RevealedWine {
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

export interface EventRound {
  id: string;
  orderNumber: number;
  blindLabel: string;
  status: RoundStatus;
  durationSeconds: number;
  startedAt: string | null;
  revealedAt: string | null;
  wine: Wine;
}

export interface EventSummary {
  id: string;
  hostId: string;
  title: string;
  sessionPin: string;
  mode: TastingMode;
  scaleType: ScaleType;
  status: EventStatus;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  roundCount: number;
  participantCount: number;
  connectedParticipantCount: number;
}

export interface EventDetail extends EventSummary {
  rounds: EventRound[];
}

export interface LiveStateRound {
  roundId: string;
  orderNumber: number;
  blindLabel: string;
  status: RoundStatus;
  durationSeconds: number;
  startedAt: string | null;
  endsAt: string | null;
  remainingSeconds: number;
  wine?: Wine;
}

export interface LiveState {
  eventId: string;
  title: string;
  mode: TastingMode;
  scaleType: ScaleType;
  status: EventStatus;
  participantCount: number;
  connectedParticipantCount: number;
  currentRound: LiveStateRound | null;
}

export interface GuestCurrentRound {
  roundId: string;
  orderNumber: number;
  blindLabel: string;
  status: RoundStatus;
  durationSeconds: number;
  remainingSeconds: number;
  wine?: RevealedWine;
}

export interface GuestEventInfo {
  eventId: string;
  title: string;
  mode: TastingMode;
  scaleType: ScaleType;
  currentRound: GuestCurrentRound | null;
}

export interface GuestJoinResponse {
  participantId: string;
  guestSessionToken: string;
  event: GuestEventInfo;
}

export interface CreateRoundInput {
  wineId: string;
  orderNumber: number;
  blindLabel?: string;
  durationSeconds?: number;
}

export interface CreateEventInput {
  title: string;
  mode?: TastingMode;
  scaleType?: ScaleType;
  scheduledAt?: string;
  rounds: CreateRoundInput[];
}

export interface GuestJoinInput {
  sessionPin: string;
  nickname: string;
  screenResolution: string;
  deviceId: string;
  pixelRatio: number;
  colorDepth: number;
  timeZone: string;
  osFamily: OsFamily;
  maxTouchPoints: number;
  httpPublicIp: string | null;
  webrtcPublicIp: string | null;
  webrtcLocalIps: string[];
  vpnSuspectedByWebrtc: boolean;
}

export interface NetworkAddressResponse {
  lanIp: string | null;
}

export interface ParkerBreakdown {
  appearance: number;
  aroma: number;
  taste: number;
  potential: number;
}

export interface Organoleptics {
  sweetness: number;
  acidity: number;
  tannins: number;
  body: number;
  aromaIntensity: number;
}

export interface CreateRatingInput {
  parkerBreakdown?: ParkerBreakdown;
  stars?: number;
  organoleptics: Organoleptics;
  aromaTags?: string[];
  personalNotes?: string;
}

export interface RatingResponse {
  ratingId: string;
  roundId: string;
  participantId: string;
  scaleType: ScaleType;
  baseScore: number;
  parkerBreakdown: ParkerBreakdown | null;
  stars: number | null;
  totalScore: number;
  qualityCategory: ParkerQualityCategory;
  qualityLabel: string;
  organoleptics: Organoleptics;
  aromaTags: string[];
  personalNotes: string | null;
}

export interface CriteriaMeans {
  base: number;
  appearance: number | null;
  aroma: number | null;
  taste: number | null;
  potential: number | null;
}

export interface RadarProfile {
  sweetness: number | null;
  acidity: number | null;
  tannins: number | null;
  body: number | null;
  aromaIntensity: number | null;
}

export interface AromaTagFrequency {
  tag: string;
  count: number;
}

export interface RoundStats {
  roundId: string;
  totalRatings: number;
  validVotesCount: number;
  outliersRemovedCount: number;
  meanScore: number | null;
  medianScore: number | null;
  stdDev: number | null;
  qualityCategory: ParkerQualityCategory | null;
  qualityLabel: string | null;
  criteriaMeans: CriteriaMeans;
  radarProfile: RadarProfile;
  aromaTagFrequency: AromaTagFrequency[];
}

export interface ExportSample {
  externalWineId: string;
  totalParticipants: number;
  validVotesCount: number;
  outliersRemovedCount: number;
  aggregatedParkerScore: {
    mean: number;
    median: number;
    stdDev: number;
    qualityCategory: ParkerQualityCategory;
    criteriaMeans: CriteriaMeans;
  };
  organolepticProfile: {
    sweetness: number;
    acidity: number;
    tannins: number;
    body: number;
    aromaIntensity: number;
  };
  topAromaDescriptors: string[];
}

export interface ExportPayload {
  sourceSystem: string;
  schemaVersion: string;
  eventId: string;
  tastingMode: TastingMode;
  scoringMethodology: ScaleType;
  exportedAt: string;
  samples: ExportSample[];
}

export interface ExportMeta {
  exportLogId: string;
  simulationMode: boolean;
  targetEndpoint: string;
  mockReceiptId: string | null;
  status: ExportExternalStatus;
  validVotesCount: number;
  rejectedOutliersCount: number;
}

export interface ExportResponse {
  exportMeta: ExportMeta;
  dispatchedPayload: ExportPayload;
}

export interface ExportLog {
  id: string;
  eventId: string;
  targetEndpoint: string;
  mockReceiptId: string | null;
  validVotesCount: number;
  rejectedOutliersCount: number;
  payloadSnapshot: ExportPayload;
  externalStatus: ExportExternalStatus;
  exportedAt: string;
}

export interface MockReceipt {
  receiptId: string;
  status: string;
  receivedSamplesCount: number;
  processedAt: string;
}
