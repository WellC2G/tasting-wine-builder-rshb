'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  Grape,
  Hash,
  Hourglass,
  MapPin,
  Radio,
  SkipForward,
  Users,
  Vote,
  Wallet,
  Wine as WineIcon,
} from 'lucide-react';

import { ConnectionBanner } from '@/components/connection-banner';
import { CriteriaBars } from '@/components/criteria-bars';
import { PageLoader } from '@/components/page-loader';
import { QrPanel } from '@/components/qr-panel';
import { RadarProfileChart } from '@/components/radar-profile-chart';
import { Toast } from '@/components/toast';
import { WineDetailsCard } from '@/components/wine-details-card';
import { WineImage } from '@/components/wine-image';
import { useHostSession } from '@/hooks/use-host-session';
import { useTastingSocket } from '@/hooks/use-tasting-socket';
import {
  ApiError,
  apiClient,
  getApiErrorMessage,
} from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  EVENT_STATUS_LABELS,
  MODE_LABELS,
  ROUND_STATUS_LABELS,
  SCALE_LABELS,
  WINE_TYPE_LABELS,
  eventStatusTone,
  formatCountdown,
  formatPrice,
  pluralize,
  roundStatusTone,
} from '@/lib/format';
import { qualityTone } from '@/lib/rating';
import { clearHostSession } from '@/lib/session';
import type {
  EventDetail,
  EventStatus,
  LiveStateRound,
  RevealedWine,
  RoundStats,
} from '@/types/api';
import type {
  BottleRevealedPayload,
  EventFinishedPayload,
  EventStatusUpdatedPayload,
  ParticipantCounterPayload,
  RoundSkippedPayload,
  RoundStartedPayload,
  RoundTimerUpdatedPayload,
  SocketMessagePayload,
  VotingClosedPayload,
} from '@/types/realtime';

type ToastState = {
  message: string;
  tone: 'info' | 'success' | 'error';
} | null;

type Presentation = 'live' | 'stats' | 'finished';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

function useStageScale(): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      setScale(
        Math.min(
          window.innerWidth / STAGE_WIDTH,
          window.innerHeight / STAGE_HEIGHT,
        ),
      );
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);

    const observer = new ResizeObserver(updateScale);
    observer.observe(document.documentElement);

    return () => {
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
      observer.disconnect();
    };
  }, []);

  return scale;
}

interface LiveViewProps {
  event: EventDetail;
  round: LiveStateRound;
  wine: RevealedWine | null;
  remainingSeconds: number;
  votedCount: number;
  connectedCount: number;
  voteProgress: number;
}

function LiveView({
  event,
  round,
  wine,
  remainingSeconds,
  votedCount,
  connectedCount,
  voteProgress,
}: LiveViewProps) {
  if (round.status === 'SKIPPED') {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-wine-950/50 via-stone-900/60 to-stone-950 px-10 text-center">
        <div className="flex h-28 w-28 items-center justify-center rounded-full border border-stone-500/30 bg-stone-500/10 text-stone-400">
          <SkipForward className="h-14 w-14" aria-hidden="true" />
        </div>
        <p className="mt-8 text-[13px] uppercase tracking-[0.24em] text-wine-300">
          {round.blindLabel}
        </p>
        <h2 className="mt-4 text-[68px] font-semibold leading-none tracking-tight text-white">
          Образец пропущен
        </h2>
        <p className="mt-6 text-2xl leading-9 text-stone-400">
          Ожидание следующего раунда…
        </p>
      </div>
    );
  }

  const isOpen = event.mode === 'OPEN' && wine;
  const statusLabel =
    round.status === 'ACTIVE'
      ? 'Идёт приём оценок'
      : round.status === 'VOTING_CLOSED'
        ? 'Голосование приостановлено'
        : 'Ожидание старта раунда';

  if (isOpen && wine) {
    return (
      <div className="grid h-full min-h-0 grid-cols-[1.15fr_0.85fr] gap-6">
        <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-wine-950/60 via-stone-900/70 to-stone-950">
          <div className="relative h-80 shrink-0 overflow-hidden bg-gradient-to-br from-wine-900/50 via-stone-900 to-stone-950">
            <WineImage
              src={wine.imageUrl}
              alt={wine.name}
              className="rounded-none"
              iconClassName="h-36 w-36 text-wine-300/70"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-transparent to-transparent" />
            <div className="absolute left-5 top-5 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium backdrop-blur',
                  roundStatusTone(round.status),
                )}
              >
                {ROUND_STATUS_LABELS[round.status]}
              </span>
              <span className="inline-flex min-h-9 items-center rounded-full border border-white/15 bg-stone-950/60 px-3 text-xs text-stone-200 backdrop-blur">
                {round.blindLabel}
              </span>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col p-6">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-wine-400/25 bg-wine-500/10 px-3 py-1 text-xs font-medium text-wine-100">
                {WINE_TYPE_LABELS[wine.wineType]}
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-stone-300">
                {wine.vintage}
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-stone-400">
                Раунд {round.orderNumber}
              </span>
            </div>

            <h2 className="mt-4 text-balance text-5xl font-semibold leading-[1.02] tracking-tight text-white">
              {wine.name}
            </h2>
            <p className="mt-2 text-2xl text-wine-200">{wine.winery}</p>

            <div className="mt-auto grid grid-cols-3 gap-3 pt-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <MapPin className="h-5 w-5 text-wine-300" aria-hidden="true" />
                <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-stone-500">
                  Регион
                </p>
                <p className="mt-1 text-sm leading-5 text-stone-100">
                  {wine.region}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <Grape className="h-5 w-5 text-wine-300" aria-hidden="true" />
                <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-stone-500">
                  Сортовой состав
                </p>
                <p className="mt-1 text-sm leading-5 text-stone-100">
                  {wine.grapeVarieties}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <Wallet className="h-5 w-5 text-wine-300" aria-hidden="true" />
                <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-stone-500">
                  Розничная цена
                </p>
                <p className="mt-1 text-sm leading-5 text-stone-100">
                  {formatPrice(wine.retailPrice)}
                </p>
              </div>
            </div>
          </div>
        </article>

        <div className="flex h-full min-h-0 flex-col gap-5">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl border border-wine-400/25 bg-wine-500/10 p-6 text-center">
            <p className="text-xs uppercase tracking-[0.22em] text-wine-300">
              Осталось времени
            </p>
            <p className="mt-3 font-mono text-8xl font-semibold leading-none tracking-tighter text-white">
              {formatCountdown(remainingSeconds)}
            </p>
            <p className="mt-5 text-lg text-stone-300">{statusLabel}</p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.03] p-7">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Проголосовало: {votedCount} из {connectedCount}
            </p>
            <p className="mt-3 text-6xl font-semibold tracking-tight text-white">
              {votedCount}
              <span className="text-3xl font-normal text-stone-500">
                {' '}
                / {connectedCount}
              </span>
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-sm text-emerald-200">
                <Users className="h-4 w-4" aria-hidden="true" />
                В сети: {connectedCount}
              </span>
              <span className="text-sm text-stone-500">
                {voteProgress}% оценок
              </span>
            </div>
            <div className="mt-5 h-4 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-wine-600 to-wine-300 transition-all duration-500"
                style={{ width: `${voteProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-wine-950/50 via-stone-900/60 to-stone-950 px-12 text-center">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span
          className={cn(
            'inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium',
            roundStatusTone(round.status),
          )}
        >
          {ROUND_STATUS_LABELS[round.status]}
        </span>
        <span className="text-lg text-stone-500">
          {MODE_LABELS[event.mode]} · {SCALE_LABELS[event.scaleType]}
        </span>
      </div>

      <p className="mt-6 text-sm uppercase tracking-[0.28em] text-wine-300">
        Раунд {round.orderNumber}
      </p>
      <h2
        data-testid="screen-current-label"
        className="mt-3 text-balance text-7xl font-semibold leading-none tracking-tighter text-white"
      >
        {round.blindLabel}
      </h2>

      <p className="mt-7 font-mono text-8xl font-semibold leading-none tracking-tighter text-white">
        {formatCountdown(remainingSeconds)}
      </p>
      <p className="mt-4 text-xl text-stone-400">{statusLabel}</p>

      <div className="mt-8 w-full">
        <div className="flex items-end justify-between gap-4 text-left">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Получено оценок
            </p>
            <p className="mt-1 text-4xl font-semibold text-white">
              {votedCount}
              <span className="text-xl font-normal text-stone-500">
                {' '}
                / {connectedCount}
              </span>
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
            <Users className="h-4 w-4" aria-hidden="true" />
            В сети: {connectedCount}
          </span>
        </div>
        <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-wine-600 to-wine-300 transition-all duration-500"
            style={{ width: `${voteProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

interface StatsViewProps {
  round: LiveStateRound;
  wine: RevealedWine;
  stats: RoundStats;
}

function StatsView({ round, wine, stats }: StatsViewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <p className="shrink-0 text-xs uppercase tracking-[0.24em] text-wine-300">
        Образец раскрыт · {round.blindLabel}
      </p>

      <div className="grid shrink-0 grid-cols-[1.15fr_0.85fr] items-stretch gap-6">
        <div
          data-testid="screen-revealed-wine"
          className="flex h-full min-w-0 items-center"
        >
          <WineDetailsCard wine={wine} large className="h-full w-full" />
        </div>

        <div className="flex h-full flex-col justify-center rounded-3xl border border-wine-400/20 bg-wine-500/10 p-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-wine-300">
            Оценка Роберта Паркера
          </p>
          <div className="mt-1 flex items-end justify-between gap-4">
            <p
              data-testid="screen-score"
              className="text-7xl font-semibold leading-none tracking-tighter text-wine-200"
            >
              {stats.meanScore !== null
                ? stats.meanScore.toLocaleString('ru-RU', {
                    maximumFractionDigits: 1,
                  })
                : '—'}
            </p>
            <span
              className={cn(
                'mb-1 inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium',
                qualityTone(stats.qualityCategory),
              )}
            >
              {stats.qualityLabel ?? 'Категория не определена'}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-white/10 bg-stone-950/40 p-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-stone-500">
                Голосов
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                {stats.totalRatings}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-stone-950/40 p-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-stone-500">
                Валидных
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                {stats.validVotesCount}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-stone-950/40 p-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-stone-500">
                Выбросов
              </p>
              <p className="mt-1 text-xl font-semibold text-white">
                {stats.outliersRemovedCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-5">
        <div className="min-h-0 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-stone-400">
            Критерии Паркера
          </p>
          <div className="mt-5">
            <CriteriaBars criteria={stats.criteriaMeans} compact />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-stone-400">
                Органолептический профиль
              </p>
              <Radio className="h-5 w-5 text-wine-300" aria-hidden="true" />
            </div>
            <div data-testid="screen-radar">
              <RadarProfileChart
                profile={stats.radarProfile}
                height={260}
                compact
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-stone-400">
              Частые ароматические дескрипторы
            </p>
            {stats.aromaTagFrequency.length > 0 ? (
              <div className="mt-3 flex flex-wrap content-start gap-2 overflow-hidden">
                {stats.aromaTagFrequency.slice(0, 12).map((entry) => (
                  <span
                    key={entry.tag}
                    className="inline-flex items-center gap-2 rounded-full border border-wine-400/20 bg-wine-500/10 px-3 py-1.5 text-sm text-wine-100"
                  >
                    {entry.tag}
                    <span className="text-xs text-wine-300/70">
                      {entry.count}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-500">
                Гости пока не отметили ароматические дескрипторы.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface FinishedViewProps {
  event: EventDetail;
  connectedCount: number;
  votedCount: number;
}

function FinishedView({
  event,
  connectedCount,
  votedCount,
}: FinishedViewProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-wine-400/25 bg-gradient-to-br from-wine-950/60 via-stone-900/70 to-stone-950 px-16 text-center">
      <div className="flex h-32 w-32 items-center justify-center rounded-full border border-wine-400/30 bg-wine-500/15 text-wine-200">
        <Award className="h-16 w-16" aria-hidden="true" />
      </div>
      <p className="mt-8 text-sm uppercase tracking-[0.26em] text-wine-300">
        {event.title}
      </p>
      <h2
        data-testid="screen-event-finished"
        className="mt-4 text-[84px] font-semibold leading-none tracking-tighter text-white"
      >
        Дегустация завершена
      </h2>
      <p className="mt-7 max-w-3xl text-2xl leading-9 text-stone-300">
        Спасибо гостям и сомелье! Статистика каждого вина доступна на
        этом экране по команде с пульта.
      </p>
      <div className="mt-9 flex items-center gap-6 text-lg text-stone-400">
        <span className="inline-flex items-center gap-2">
          <Users className="h-5 w-5" aria-hidden="true" />
          {connectedCount}{' '}
          {pluralize(connectedCount, 'участник', 'участника', 'участников')}
        </span>
        <span className="inline-flex items-center gap-2">
          <Vote className="h-5 w-5" aria-hidden="true" />
          {votedCount}{' '}
          {pluralize(votedCount, 'голос', 'голоса', 'голосов')}
        </span>
      </div>
    </div>
  );
}

interface WaitingViewProps {
  title: string;
  subtitle: string;
  label?: string | null;
}

function WaitingView({ title, subtitle, label }: WaitingViewProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-wine-950/50 via-stone-900/60 to-stone-950 px-12 text-center">
      <div className="flex h-28 w-28 items-center justify-center rounded-full border border-wine-400/20 bg-wine-500/10 text-wine-300">
        {label ? (
          <WineIcon className="h-14 w-14" aria-hidden="true" />
        ) : (
          <Hourglass className="h-14 w-14" aria-hidden="true" />
        )}
      </div>
      <p className="mt-8 text-sm uppercase tracking-[0.26em] text-wine-300">
        {label ?? 'Трансляция дегустации'}
      </p>
      <h2 className="mt-4 text-[64px] font-semibold leading-none tracking-tight text-white">
        {title}
      </h2>
      <p className="mt-6 max-w-3xl text-xl leading-8 text-stone-400">
        {subtitle}
      </p>
    </div>
  );
}

export default function PresentationScreenPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const { token, ready } = useHostSession();
  const {
    socket,
    connected,
    hasConnected,
    connectionError,
    connectCount,
  } = useTastingSocket(token);
  const scale = useStageScale();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [status, setStatus] = useState<EventStatus>('DRAFT');
  const [round, setRound] = useState<LiveStateRound | null>(null);
  const [presentation, setPresentation] =
    useState<Presentation>('live');
  const [wine, setWine] = useState<RevealedWine | null>(null);
  const [stats, setStats] = useState<RoundStats | null>(null);
  const [counts, setCounts] = useState<ParticipantCounterPayload>({
    eventId,
    roundId: null,
    connectedCount: 0,
    votedCount: 0,
  });
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedRemainingSeconds, setPausedRemainingSeconds] =
    useState(0);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const roundIdRef = useRef<string | null>(null);

  useEffect(() => {
    roundIdRef.current = round?.roundId ?? null;
  }, [round?.roundId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);

    return () => clearInterval(timer);
  }, []);

  const applyLiveState = async (
    currentEventId: string,
  ): Promise<void> => {
    const live = await apiClient.events.liveState(currentEventId);

    setStatus(live.status);
    setCounts({
      eventId: currentEventId,
      roundId: live.currentRound?.roundId ?? null,
      connectedCount: live.connectedParticipantCount,
      votedCount: 0,
    });

    if (!live.currentRound) {
      setRound(null);
      setWine(null);
      setStats(null);
      setEndsAt(null);
      setPausedRemainingSeconds(0);
      setPresentation(
        live.status === 'FINISHED' || live.status === 'EXPORTED'
          ? 'finished'
          : 'live',
      );
      return;
    }

    setRound(live.currentRound);
    setPausedRemainingSeconds(live.currentRound.remainingSeconds);
    setEndsAt(
      live.currentRound.status === 'ACTIVE' &&
        live.currentRound.endsAt
        ? new Date(live.currentRound.endsAt).getTime()
        : null,
    );

    if (live.currentRound.status === 'REVEALED') {
      setWine(live.currentRound.wine ?? null);
      const roundStats = await apiClient.ratings
        .stats(live.currentRound.roundId)
        .catch(() => null);
      setStats(roundStats);

      if (roundStats) {
        setCounts((current) => ({
          ...current,
          votedCount: roundStats.totalRatings,
        }));
      }
    } else if (live.mode === 'OPEN') {
      setWine(live.currentRound.wine ?? null);
      setStats(null);
    } else {
      setWine(null);
      setStats(null);
    }

    if (live.currentRound.status !== 'REVEALED') {
      const roundStats = await apiClient.ratings
        .stats(live.currentRound.roundId)
        .catch(() => null);

      if (roundStats) {
        setCounts((current) => ({
          ...current,
          votedCount: roundStats.totalRatings,
        }));
      }
    }

    if (live.status === 'FINISHED' || live.status === 'EXPORTED') {
      setPresentation('finished');
    } else if (live.currentRound.status === 'REVEALED') {
      setPresentation('stats');
    } else {
      setPresentation('live');
    }
  };

  useEffect(() => {
    if (!ready || !token) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const [detail] = await Promise.all([
          apiClient.events.get(eventId),
          applyLiveState(eventId),
        ]);

        if (!cancelled) {
          setEvent(detail);
          setStatus(detail.status);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearHostSession();
          window.location.href = '/host/login';
          return;
        }

        if (!cancelled) {
          setLoadError(getApiErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token, eventId]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleRoundStarted = (payload: RoundStartedPayload) => {
      setStatus('ACTIVE');
      setPresentation('live');
      setRound({
        roundId: payload.roundId,
        orderNumber: payload.orderNumber,
        blindLabel: payload.blindLabel,
        status: 'ACTIVE',
        durationSeconds: payload.durationSeconds,
        startedAt: new Date().toISOString(),
        endsAt: payload.endsAt,
        remainingSeconds: payload.remainingSeconds,
      });
      setWine(payload.wine ?? null);
      setStats(null);
      setEndsAt(new Date(payload.endsAt).getTime());
      setPausedRemainingSeconds(payload.remainingSeconds);
      setCounts((current) => ({
        ...current,
        eventId,
        roundId: payload.roundId,
      }));
    };

    const handleVotingClosed = (payload: VotingClosedPayload) => {
      setRound((current) =>
        current && current.roundId === payload.roundId
          ? {
              ...current,
              status: 'VOTING_CLOSED',
              durationSeconds: Math.max(
                1,
                payload.remainingSeconds,
              ),
              remainingSeconds: payload.remainingSeconds,
            }
          : current,
      );
      setEndsAt(null);
      setPausedRemainingSeconds(payload.remainingSeconds);
      setPresentation('live');
    };

    const handleRoundTimerUpdated = (
      payload: RoundTimerUpdatedPayload,
    ) => {
      if (roundIdRef.current !== payload.roundId) {
        return;
      }

      setRound((current) =>
        current && current.roundId === payload.roundId
          ? {
              ...current,
              durationSeconds: payload.durationSeconds,
              remainingSeconds: payload.remainingSeconds,
            }
          : current,
      );
      setPausedRemainingSeconds(payload.remainingSeconds);
      setEndsAt(
        payload.status === 'ACTIVE' && payload.endsAt
          ? new Date(payload.endsAt).getTime()
          : null,
      );
    };

    const handleRoundSkipped = (payload: RoundSkippedPayload) => {
      if (roundIdRef.current !== payload.roundId) {
        return;
      }

      setPresentation('live');
      setRound((current) =>
        current && current.roundId === payload.roundId
          ? { ...current, status: 'SKIPPED' }
          : current,
      );
      setWine(null);
      setStats(null);
      setEndsAt(null);
    };

    const handleBottleRevealed = (
      payload: BottleRevealedPayload,
    ) => {
      setPresentation('stats');
      setRound((current) => ({
        roundId: payload.roundId,
        orderNumber:
          payload.orderNumber ?? current?.orderNumber ?? 0,
        blindLabel:
          payload.blindLabel ??
          current?.blindLabel ??
          'Раскрытый образец',
        status: 'REVEALED',
        durationSeconds: current?.durationSeconds ?? 0,
        startedAt: current?.startedAt ?? null,
        endsAt: null,
        remainingSeconds: 0,
      }));
      setWine(payload.wine);
      setStats(payload.stats);
      setEndsAt(null);
      setCounts((current) => ({
        ...current,
        eventId,
        roundId: payload.roundId,
        votedCount: payload.stats.totalRatings,
      }));
      setToast({
        message: 'Карточка образца раскрыта!',
        tone: 'success',
      });
    };

    const handleEventStatusUpdated = (
      payload: EventStatusUpdatedPayload,
    ) => {
      if (payload.eventId !== eventId) {
        return;
      }

      setStatus(payload.status);

      if (
        payload.status === 'FINISHED' ||
        payload.status === 'EXPORTED'
      ) {
        setEndsAt(null);
        setPresentation('finished');
      }
    };

    const handleEventFinished = (payload: EventFinishedPayload) => {
      if (payload.eventId !== eventId) {
        return;
      }

      setStatus(payload.status);
      setEndsAt(null);
      setPresentation('finished');
      setToast({ message: payload.message, tone: 'success' });
    };

    const handleCounter = (payload: ParticipantCounterPayload) => {
      if (payload.eventId !== eventId) {
        return;
      }

      setCounts((current) => {
        const matchesCurrentRound =
          payload.roundId !== null &&
          payload.roundId === roundIdRef.current;

        return {
          ...current,
          eventId,
          connectedCount: payload.connectedCount,
          ...(matchesCurrentRound
            ? {
                roundId: payload.roundId,
                votedCount: payload.votedCount,
              }
            : {}),
        };
      });
    };

    const handleError = (payload: SocketMessagePayload) => {
      setToast({ message: payload.message, tone: 'error' });
    };

    socket.on('round_started', handleRoundStarted);
    socket.on('voting_closed', handleVotingClosed);
    socket.on('round_timer_updated', handleRoundTimerUpdated);
    socket.on('round_skipped', handleRoundSkipped);
    socket.on('bottle_revealed', handleBottleRevealed);
    socket.on('event_status_updated', handleEventStatusUpdated);
    socket.on('event_finished', handleEventFinished);
    socket.on('participant_counter_updated', handleCounter);
    socket.on('session_error', handleError);
    socket.on('auth_error', handleError);

    return () => {
      socket.off('round_started', handleRoundStarted);
      socket.off('voting_closed', handleVotingClosed);
      socket.off('round_timer_updated', handleRoundTimerUpdated);
      socket.off('round_skipped', handleRoundSkipped);
      socket.off('bottle_revealed', handleBottleRevealed);
      socket.off('event_status_updated', handleEventStatusUpdated);
      socket.off('event_finished', handleEventFinished);
      socket.off('participant_counter_updated', handleCounter);
      socket.off('session_error', handleError);
      socket.off('auth_error', handleError);
    };
  }, [socket, eventId]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const joinEvent = () => {
      socket.emit('host:join_event', { eventId });
    };

    if (socket.connected) {
      joinEvent();
    }

    socket.on('connect', joinEvent);

    return () => {
      socket.off('connect', joinEvent);
    };
  }, [socket, eventId]);

  useEffect(() => {
    if (!socket || connectCount <= 1) {
      return;
    }

    void applyLiveState(eventId).catch(() => {
      // The connection banner reports the lost connection.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, connectCount, eventId]);

  const remainingSeconds =
    round?.status === 'ACTIVE' && endsAt
      ? Math.max(0, Math.ceil((endsAt - now) / 1000))
      : pausedRemainingSeconds;
  const voteProgress =
    counts.connectedCount > 0
      ? Math.min(
          100,
          Math.round(
            (counts.votedCount / counts.connectedCount) * 100,
          ),
        )
      : 0;

  if (!ready || !token || loading) {
    return <PageLoader message="Готовим экран проектора…" />;
  }

  if (!event) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-950 px-6 text-center">
        <p className="text-lg text-white">
          {loadError ?? 'Мероприятие не найдено'}
        </p>
        <Link
          href="/host/events"
          className="inline-flex min-h-12 items-center rounded-xl border border-white/10 px-5 text-sm text-stone-200"
        >
          Вернуться к мероприятиям
        </Link>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 flex h-screen w-screen items-center justify-center overflow-hidden bg-stone-950">
      <div
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
        className="relative flex shrink-0 flex-col overflow-hidden bg-stone-950"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(159,18,57,0.32),transparent_55%)]"
        />

        <div className="relative flex h-full flex-col px-12 py-8">
          <header className="flex h-[92px] shrink-0 items-center justify-between gap-6 rounded-3xl border border-white/10 bg-stone-950/60 px-7">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-wine-400/25 bg-wine-500/10 text-wine-300">
                <WineIcon className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex min-h-7 items-center rounded-full border px-2.5 text-[10px] font-medium uppercase tracking-wide',
                      eventStatusTone(status),
                    )}
                  >
                    {EVENT_STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-stone-500">
                    {MODE_LABELS[event.mode]} ·{' '}
                    {SCALE_LABELS[event.scaleType]}
                  </span>
                </div>
                <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-white">
                  {event.title}
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <Hash
                  className="h-4 w-4 text-stone-400"
                  aria-hidden="true"
                />
                <span className="font-mono text-lg tracking-[0.2em] text-white">
                  {event.sessionPin}
                </span>
              </div>
              <Link
                href={`/host/events/${event.id}/control`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-stone-300 transition hover:bg-white/5 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Пульт
              </Link>
            </div>
          </header>

          <div className="mt-3 flex min-h-8 shrink-0 items-center">
            <ConnectionBanner
              connected={connected}
              hasConnected={hasConnected}
              error={connectionError}
            />
          </div>

          <div className="mt-3 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-7">
            <section className="min-h-0 overflow-hidden">
              {presentation === 'finished' ? (
                <FinishedView
                  event={event}
                  connectedCount={counts.connectedCount}
                  votedCount={counts.votedCount}
                />
              ) : presentation === 'stats' && wine && stats && round ? (
                <StatsView round={round} wine={wine} stats={stats} />
              ) : round ? (
                <LiveView
                  event={event}
                  round={round}
                  wine={wine}
                  remainingSeconds={remainingSeconds}
                  votedCount={counts.votedCount}
                  connectedCount={counts.connectedCount}
                  voteProgress={voteProgress}
                />
              ) : (
                <WaitingView
                  title="Ожидание первого раунда"
                  subtitle="Откройте пульт ведущего, чтобы запустить первый образец. Гости могут присоединиться по QR-коду прямо сейчас."
                />
              )}
            </section>

            <aside className="flex h-full min-h-0 flex-col justify-center">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400">
                  Вход для гостей
                </p>
                <QrPanel
                  sessionPin={event.sessionPin}
                  size={220}
                />
                <p className="mt-4 text-center text-sm leading-6 text-stone-500">
                  Отсканируйте QR-код камерой телефона или введите PIN
                  на главной странице
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone ?? 'info'}
        onClose={() => setToast(null)}
      />
    </main>
  );
}
