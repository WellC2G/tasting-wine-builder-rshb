import { getHostToken } from './session';
import type {
  AuthResponse,
  CreateEventInput,
  CreateRatingInput,
  EventDetail,
  EventParticipant,
  EventRound,
  EventSummary,
  EventSummaryStats,
  ExportLog,
  ExportResponse,
  GuestJoinInput,
  GuestJoinResponse,
  HostUser,
  LiveState,
  NetworkAddressResponse,
  PaginatedWines,
  RatingResponse,
  RoundStats,
  UpdateEventInput,
  Wine,
  WineInput,
  WineType,
} from '@/types/api';

const DEFAULT_API_PORT = 4000;
const LOOPBACK_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

function normalizeConfiguredApiUrl(
  value: string | undefined,
): URL | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed.replace(/^\/+/, '')}`;

  try {
    const url = new URL(candidate);

    return url.hostname ? url : null;
  } catch {
    return null;
  }
}

function formatHostname(hostname: string): string {
  if (!hostname) {
    return 'localhost';
  }

  return hostname.includes(':') && !hostname.startsWith('[')
    ? `[${hostname}]`
    : hostname;
}

function buildBaseUrl(
  protocol: string,
  hostname: string,
  port: string,
): string {
  const safeProtocol = protocol === 'https:' ? 'https:' : 'http:';

  return `${safeProtocol}//${formatHostname(hostname)}:${port}`;
}

/**
 * Resolves the API address at runtime so the same build works from the
 * organizer's machine and from any phone or tablet on the local Wi-Fi.
 * NEXT_PUBLIC_API_URL is treated only as an optional port/protocol hint:
 * its hostname is replaced with the current browser hostname on the LAN.
 * Malformed values such as `192.168.1.50:4000` are normalized safely.
 */
export function getApiBaseUrl(): string {
  const configured = normalizeConfiguredApiUrl(
    process.env.NEXT_PUBLIC_API_URL,
  );
  const configuredPort = configured?.port || String(DEFAULT_API_PORT);

  if (typeof window === 'undefined') {
    return configured
      ? buildBaseUrl(
          configured.protocol,
          configured.hostname,
          configuredPort,
        )
      : buildBaseUrl('http:', 'localhost', configuredPort);
  }

  const browserHostname = window.location.hostname || 'localhost';
  const browserProtocol = window.location.protocol;
  const browserIsLoopback = LOOPBACK_HOSTNAMES.has(
    browserHostname.toLowerCase(),
  );

  if (!browserIsLoopback) {
    return buildBaseUrl(
      browserProtocol,
      browserHostname,
      configuredPort,
    );
  }

  if (configured) {
    return buildBaseUrl(
      configured.protocol,
      configured.hostname,
      configuredPort,
    );
  }

  return buildBaseUrl(
    browserProtocol,
    browserHostname,
    String(DEFAULT_API_PORT),
  );
}

interface ApiErrorPayload {
  message?: string | string[];
  error?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];

  constructor(status: number, messages: string[]) {
    super(messages[0] ?? 'Не удалось выполнить запрос');
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  guestToken?: string;
  hostToken?: string;
  publicRequest?: boolean;
}

async function parseErrorResponse(
  response: Response,
): Promise<ApiError> {
  let payload: ApiErrorPayload | null = null;

  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    payload = null;
  }

  const messages = Array.isArray(payload?.message)
    ? payload.message
    : typeof payload?.message === 'string'
      ? [payload.message]
      : ['Не удалось выполнить запрос'];

  return new ApiError(response.status, messages);
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers();
  const method = options.method ?? 'GET';

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.guestToken) {
    headers.set('X-Guest-Token', options.guestToken);
  } else if (!options.publicRequest) {
    const hostToken = options.hostToken ?? getHostToken();

    if (hostToken) {
      headers.set('Authorization', `Bearer ${hostToken}`);
    }
  }

  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers,
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
      cache: method === 'GET' ? 'no-store' : undefined,
    });
  } catch {
    throw new ApiError(0, [
      'Не удалось подключиться к серверу. Проверьте соединение и повторите попытку.',
    ]);
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface WineFilters {
  wineType?: WineType;
  region?: string;
  vintage?: number;
  search?: string;
  page?: number;
  limit?: number;
}

function catalogQuery(filters: WineFilters): string {
  const params = new URLSearchParams();

  if (filters.wineType) {
    params.set('wineType', filters.wineType);
  }

  if (filters.region) {
    params.set('region', filters.region);
  }

  if (filters.vintage) {
    params.set('vintage', String(filters.vintage));
  }

  if (filters.search) {
    params.set('search', filters.search);
  }

  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 100));

  return params.toString();
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface UpdateEventStatusInput {
  status: 'DRAFT' | 'ACTIVE' | 'FINISHED';
}

export interface RatingStatsViewer {
  guestToken?: string;
}

export const apiClient = {
  auth: {
    login(email: string, password: string): Promise<AuthResponse> {
      return request<AuthResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: { email, password },
        publicRequest: true,
      });
    },

    register(input: RegisterInput): Promise<HostUser> {
      return request<HostUser>('/api/v1/auth/register', {
        method: 'POST',
        body: input,
        publicRequest: true,
      });
    },

    me(accessToken?: string): Promise<HostUser> {
      return request<HostUser>('/api/v1/auth/me', {
        hostToken: accessToken,
      });
    },

    guestJoin(
      input: GuestJoinInput,
    ): Promise<GuestJoinResponse> {
      return request<GuestJoinResponse>('/api/v1/auth/guest-join', {
        method: 'POST',
        body: input,
        publicRequest: true,
      });
    },
  },

  catalog: {
    async list(filters: WineFilters = {}): Promise<PaginatedWines> {
      return request<PaginatedWines>(
        `/api/v1/wines?${catalogQuery(filters)}`,
      );
    },

    create(input: WineInput): Promise<Wine> {
      return request<Wine>('/api/v1/wines', {
        method: 'POST',
        body: input,
      });
    },

    update(id: string, input: Partial<WineInput>): Promise<Wine> {
      return request<Wine>(`/api/v1/wines/${id}`, {
        method: 'PATCH',
        body: input,
      });
    },
  },

  health: {
    network(): Promise<NetworkAddressResponse> {
      return request<NetworkAddressResponse>('/api/v1/health/network', {
        publicRequest: true,
      });
    },

    setNetworkLanIp(
      lanIp: string,
    ): Promise<NetworkAddressResponse> {
      return request<NetworkAddressResponse>('/api/v1/health/network', {
        method: 'PUT',
        body: { lanIp },
      });
    },
  },

  events: {
    list(): Promise<EventSummary[]> {
      return request<EventSummary[]>('/api/v1/events');
    },

    create(input: CreateEventInput): Promise<EventDetail> {
      return request<EventDetail>('/api/v1/events', {
        method: 'POST',
        body: input,
      });
    },

    update(
      eventId: string,
      input: UpdateEventInput,
    ): Promise<EventDetail> {
      return request<EventDetail>(`/api/v1/events/${eventId}`, {
        method: 'PATCH',
        body: input,
      });
    },

    copy(eventId: string): Promise<EventDetail> {
      return request<EventDetail>(`/api/v1/events/${eventId}/copy`, {
        method: 'POST',
      });
    },

    finish(
      eventId: string,
    ): Promise<{ eventId: string; status: string }> {
      return request<{ eventId: string; status: string }>(
        `/api/v1/events/${eventId}/finish`,
        {
          method: 'POST',
        },
      );
    },

    remove(eventId: string): Promise<void> {
      return request<void>(`/api/v1/events/${eventId}`, {
        method: 'DELETE',
      });
    },

    summary(
      eventId: string,
      guestToken?: string,
    ): Promise<EventSummaryStats> {
      return request<EventSummaryStats>(
        `/api/v1/events/${eventId}/summary`,
        { guestToken },
      );
    },

    participants(eventId: string): Promise<EventParticipant[]> {
      return request<EventParticipant[]>(
        `/api/v1/events/${eventId}/participants`,
      );
    },

    removeParticipant(
      eventId: string,
      participantId: string,
      keepRatings: boolean,
    ): Promise<void> {
      return request<void>(
        `/api/v1/events/${eventId}/participants/${participantId}?keepRatings=${keepRatings}`,
        { method: 'DELETE' },
      );
    },

    getByPin(sessionPin: string): Promise<EventDetail> {
      return request<EventDetail>(
        `/api/v1/events/by-pin/${encodeURIComponent(sessionPin)}`,
      );
    },

    get(eventId: string): Promise<EventDetail> {
      return request<EventDetail>(`/api/v1/events/${eventId}`);
    },

    rounds(eventId: string): Promise<EventRound[]> {
      return request<EventRound[]>(
        `/api/v1/events/${eventId}/rounds`,
      );
    },

    updateStatus(
      eventId: string,
      status: UpdateEventStatusInput['status'],
    ): Promise<EventDetail> {
      return request<EventDetail>(
        `/api/v1/events/${eventId}/status`,
        {
          method: 'PATCH',
          body: { status },
        },
      );
    },

    liveState(
      eventId: string,
      guestToken?: string,
    ): Promise<LiveState> {
      return request<LiveState>(
        `/api/v1/events/${eventId}/live-state`,
        { guestToken },
      );
    },
  },

  ratings: {
    submit(
      roundId: string,
      input: CreateRatingInput,
      guestToken: string,
    ): Promise<RatingResponse> {
      return request<RatingResponse>(
        `/api/v1/rounds/${roundId}/ratings`,
        {
          method: 'POST',
          body: input,
          guestToken,
        },
      );
    },

    stats(
      roundId: string,
      viewer: RatingStatsViewer = {},
    ): Promise<RoundStats> {
      return request<RoundStats>(
        `/api/v1/rounds/${roundId}/stats`,
        { guestToken: viewer.guestToken },
      );
    },
  },

  export: {
    create(eventId: string): Promise<ExportResponse> {
      return request<ExportResponse>(
        `/api/v1/events/${eventId}/export`,
        { method: 'POST' },
      );
    },

    logs(eventId: string): Promise<ExportLog[]> {
      return request<ExportLog[]>(
        `/api/v1/events/${eventId}/export-logs`,
      );
    },
  },
};

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.messages.join(' ');
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Неизвестная ошибка';
}
