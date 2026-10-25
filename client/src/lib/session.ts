import type {
  HostUser,
  RatingResponse,
} from '@/types/api';

const HOST_TOKEN_KEY = 'tasting.host.token';
const HOST_USER_KEY = 'tasting.host.user';
const GUEST_SESSION_PREFIX = 'tasting.guest.';
const RATING_PREFIX = 'tasting.rating.';

export interface GuestSession {
  token: string;
  nickname: string;
  participantId: string;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined';
}

function readJson<T>(key: string): T | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);

    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private mode; the session remains in memory.
  }
}

function removeKey(key: string): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(key);
}

export function getHostToken(): string | null {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(HOST_TOKEN_KEY);
}

export function getHostUser(): HostUser | null {
  return readJson<HostUser>(HOST_USER_KEY);
}

export function setHostSession(
  token: string,
  user: HostUser,
): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(HOST_TOKEN_KEY, token);
  writeJson(HOST_USER_KEY, user);
}

export function clearHostSession(): void {
  removeKey(HOST_TOKEN_KEY);
  removeKey(HOST_USER_KEY);
}

function guestSessionKey(sessionPin: string): string {
  return `${GUEST_SESSION_PREFIX}${sessionPin}`;
}

export function getGuestSession(
  sessionPin: string,
): GuestSession | null {
  return readJson<GuestSession>(guestSessionKey(sessionPin));
}

export function setGuestSession(
  sessionPin: string,
  session: GuestSession,
): void {
  writeJson(guestSessionKey(sessionPin), session);
}

export function clearGuestSession(sessionPin: string): void {
  removeKey(guestSessionKey(sessionPin));
}

export function getStoredRating(
  roundId: string,
): RatingResponse | null {
  return readJson<RatingResponse>(`${RATING_PREFIX}${roundId}`);
}

export function setStoredRating(
  roundId: string,
  rating: RatingResponse,
): void {
  writeJson(`${RATING_PREFIX}${roundId}`, rating);
}
