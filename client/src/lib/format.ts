import { getCachedQrOrigin } from './lan-ip';
import type {
  EventStatus,
  ExportExternalStatus,
  RoundStatus,
  ScaleType,
  TastingMode,
  WineType,
} from '@/types/api';

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активна',
  FINISHED: 'Завершена',
  EXPORTED: 'Экспортировано',
};

export const ROUND_STATUS_LABELS: Record<RoundStatus, string> = {
  PENDING: 'Ожидает',
  ACTIVE: 'Идёт',
  VOTING_CLOSED: 'Голосование закрыто',
  REVEALED: 'Раскрыт',
  SKIPPED: 'Пропущен',
};

export const MODE_LABELS: Record<TastingMode, string> = {
  BLIND: 'Слепая',
  OPEN: 'Открытая',
};

export const SCALE_LABELS: Record<ScaleType, string> = {
  PARKER_100: 'Паркер 100',
  STARS_5: '5 звёзд',
};

export const WINE_TYPE_LABELS: Record<WineType, string> = {
  RED: 'Красное',
  WHITE: 'Белое',
  ROSE: 'Розовое',
  SPARKLING: 'Игристое',
  FORTIFIED: 'Креплёное',
};

export const EXPORT_STATUS_LABELS: Record<
  ExportExternalStatus,
  string
> = {
  MOCK_SUCCESS: 'Успешно (mock)',
  WEBHOOK_SUCCESS: 'Успешно',
  FAILED: 'Ошибка',
};

export function formatEventDate(value: string | null): string {
  if (!value) {
    return 'Дата не назначена';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function pluralize(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const absolute = Math.abs(count);
  const lastTwo = absolute % 100;
  const last = absolute % 10;

  if (lastTwo >= 11 && lastTwo <= 14) {
    return many;
  }

  if (last === 1) {
    return one;
  }

  if (last >= 2 && last <= 4) {
    return few;
  }

  return many;
}

export function eventStatusTone(status: EventStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'border-stone-500/30 bg-stone-500/10 text-stone-300';
    case 'ACTIVE':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300';
    case 'FINISHED':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
    case 'EXPORTED':
      return 'border-sky-400/30 bg-sky-400/10 text-sky-200';
  }
}

export function roundStatusTone(status: RoundStatus): string {
  switch (status) {
    case 'PENDING':
      return 'border-stone-500/30 bg-stone-500/10 text-stone-300';
    case 'ACTIVE':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300';
    case 'VOTING_CLOSED':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
    case 'REVEALED':
      return 'border-sky-400/30 bg-sky-400/10 text-sky-200';
    case 'SKIPPED':
      return 'border-stone-500/30 bg-stone-500/10 text-stone-400';
  }
}

export function joinUrlForPin(
  sessionPin: string,
  baseOrigin?: string,
): string {
  if (typeof window === 'undefined') {
    return `/join/${sessionPin}`;
  }

  const origin = baseOrigin ?? getCachedQrOrigin();

  if (!origin) {
    return `/join/${sessionPin}`;
  }

  return `${origin.replace(/\/+$/, '')}/join/${sessionPin}`;
}
