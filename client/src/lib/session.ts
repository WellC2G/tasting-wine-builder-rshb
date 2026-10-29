import type {
  HostUser,
  Organoleptics,
  OsFamily,
  ParkerBreakdown,
  RatingResponse,
} from '@/types/api';

const HOST_TOKEN_KEY = 'tasting.host.token';
const HOST_USER_KEY = 'tasting.host.user';
const GUEST_SESSION_PREFIX = 'tasting.guest.';
const RATING_PREFIX = 'tasting.rating.';
const FORM_DRAFT_PREFIX = 'tasting.form.';
const DEVICE_ID_STORAGE_KEY = 'tasting.device.id';
const DEVICE_ID_COOKIE_NAME = 'tasting_device_id';
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
const DEVICE_ID_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const FALLBACK_SCREEN_RESOLUTION = '390x844';

export interface GuestSession {
  token: string;
  nickname: string;
  participantId: string;
  eventId?: string;
}

export interface HardwareProfile {
  screenResolution: string;
  pixelRatio: number;
  colorDepth: number;
  timeZone: string;
  osFamily: OsFamily;
  maxTouchPoints: number;
}

export interface GuestRoundFormDraft {
  parker: ParkerBreakdown;
  organoleptics: Organoleptics;
  selectedTags: string[];
  notes: string;
}

const DEFAULT_GUEST_FORM_DRAFT: GuestRoundFormDraft = {
  parker: {
    appearance: 3,
    aroma: 9,
    taste: 12,
    potential: 6,
  },
  organoleptics: {
    sweetness: 5,
    acidity: 5,
    tannins: 5,
    body: 5,
    aromaIntensity: 5,
  },
  selectedTags: [],
  notes: '',
};

function cloneDefaultFormDraft(): GuestRoundFormDraft {
  return {
    parker: { ...DEFAULT_GUEST_FORM_DRAFT.parker },
    organoleptics: { ...DEFAULT_GUEST_FORM_DRAFT.organoleptics },
    selectedTags: [],
    notes: '',
  };
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined';
}

function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' && typeof document !== 'undefined'
  );
}

function generateDeviceId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');

  return `dev-${hex}`;
}

function readStoredDeviceId(): string | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const value = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);

    return value && DEVICE_ID_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

function readDeviceIdCookie(): string | null {
  if (!isBrowser()) {
    return null;
  }

  const prefix = `${DEVICE_ID_COOKIE_NAME}=`;
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!cookie) {
    return null;
  }

  try {
    const value = decodeURIComponent(cookie.slice(prefix.length));

    return DEVICE_ID_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

function persistDeviceId(deviceId: string): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  } catch {
    // Cookies remain available when localStorage is blocked.
  }

  const secure =
    window.location.protocol === 'https:' ? '; Secure' : '';

  document.cookie =
    `${DEVICE_ID_COOKIE_NAME}=${encodeURIComponent(deviceId)}` +
    `; Path=/; Max-Age=${DEVICE_ID_COOKIE_MAX_AGE_SECONDS}` +
    `; SameSite=Lax${secure}`;
}

/**
 * Returns a persistent identifier shared by the browser's tabs and windows.
 * The cookie keeps the identity even if localStorage is cleared or blocked.
 */
export function getOrCreateDeviceId(): string {
  if (!isBrowser()) {
    return generateDeviceId();
  }

  const existing = readStoredDeviceId() ?? readDeviceIdCookie();

  if (existing) {
    persistDeviceId(existing);
    return existing;
  }

  const deviceId = generateDeviceId();
  persistDeviceId(deviceId);

  return deviceId;
}

/**
 * Screen rotation must not change the device profile, so the shorter side
 * always comes first.
 */
export function getNormalizedScreenResolution(): string {
  if (typeof window === 'undefined' || !window.screen) {
    return FALLBACK_SCREEN_RESOLUTION;
  }

  const width = Math.round(window.screen.width);
  const height = Math.round(window.screen.height);

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return FALLBACK_SCREEN_RESOLUTION;
  }

  return `${Math.min(width, height)}x${Math.max(width, height)}`;
}

export function detectOsFamily(): OsFamily {
  if (typeof navigator === 'undefined') {
    return 'Other';
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;

  if (userAgent.includes('android')) {
    return 'Android';
  }

  if (
    userAgent.includes('iphone') ||
    userAgent.includes('ipad') ||
    userAgent.includes('ipod')
  ) {
    return 'iOS';
  }

  if (userAgent.includes('windows')) {
    return 'Windows';
  }

  if (
    userAgent.includes('macintosh') ||
    userAgent.includes('mac os x')
  ) {
    return maxTouchPoints > 1 ? 'iOS' : 'macOS';
  }

  if (userAgent.includes('linux')) {
    return 'Linux';
  }

  return 'Other';
}

export function getHardwareProfile(): HardwareProfile {
  if (typeof window === 'undefined') {
    return {
      screenResolution: FALLBACK_SCREEN_RESOLUTION,
      pixelRatio: 1,
      colorDepth: 24,
      timeZone: 'UTC',
      osFamily: 'Other',
      maxTouchPoints: 0,
    };
  }

  let timeZone = 'UTC';

  try {
    timeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    timeZone = 'UTC';
  }

  return {
    screenResolution: getNormalizedScreenResolution(),
    pixelRatio:
      Math.round((window.devicePixelRatio || 1) * 100) / 100,
    colorDepth: window.screen?.colorDepth || 24,
    timeZone,
    osFamily: detectOsFamily(),
    maxTouchPoints:
      (navigator.maxTouchPoints ?? 0) > 0 ? 1 : 0,
  };
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

export function setHostToken(token: string): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(HOST_TOKEN_KEY, token);
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

export function clearStoredRating(roundId: string): void {
  removeKey(`${RATING_PREFIX}${roundId}`);
}

export function getStoredFormDraft(
  roundId: string,
): GuestRoundFormDraft | null {
  const draft = readJson<GuestRoundFormDraft>(
    `${FORM_DRAFT_PREFIX}${roundId}`,
  );

  if (
    !draft ||
    typeof draft !== 'object' ||
    !draft.parker ||
    !draft.organoleptics ||
    !Array.isArray(draft.selectedTags) ||
    typeof draft.notes !== 'string'
  ) {
    return null;
  }

  return draft;
}

export function setStoredFormDraft(
  roundId: string,
  draft: GuestRoundFormDraft,
): void {
  writeJson(`${FORM_DRAFT_PREFIX}${roundId}`, draft);
}

export function clearStoredFormDraft(roundId: string): void {
  removeKey(`${FORM_DRAFT_PREFIX}${roundId}`);
}

export function restoreFormForRound(
  roundId: string,
): GuestRoundFormDraft {
  const draft = getStoredFormDraft(roundId);

  if (draft) {
    return draft;
  }

  const rating = getStoredRating(roundId);

  if (rating) {
    const defaults = cloneDefaultFormDraft();

    return {
      parker: rating.parkerBreakdown ?? defaults.parker,
      organoleptics:
        rating.organoleptics ?? defaults.organoleptics,
      selectedTags: rating.aromaTags ?? [],
      notes: rating.personalNotes ?? '',
    };
  }

  return cloneDefaultFormDraft();
}
