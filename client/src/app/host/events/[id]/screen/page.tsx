'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Hash,
  Radio,
  Users,
  Vote,
  Wine as WineIcon,
} from 'lucide-react';

import { ConnectionBanner } from '@/components/connection-banner';
import { CriteriaBars } from '@/components/criteria-bars';
import { PageLoader } from '@/components/page-loader';
import { QrPanel } from '@/components/qr-panel';
import { RadarProfileChart } from '@/components/radar-profile-chart';
import { Toast } from '@/components/toast';
import { WineDetailsCard } from '@/components/wine-details-card';
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
  eventStatusTone,
  formatCountdown,
  roundStatusTone,
} from '@/lib/format';
import { clearHostSession } from '@/lib/session';
import { qualityTone } from '@/lib/rating';
import type {
  EventDetail,
  LiveStateRound,
  RevealedWine,
  RoundStats,
} from '@/types/api';
import type {
  BottleRevealedPayload,
  ParticipantCounterPayload,
  RoundStartedPayload,
  SocketMessagePayload,
  VotingClosedPayload,
} from '@/types/realtime';

type ToastState = {
  message: string;
  tone: 'info' | 'success' | 'error';
} | null;

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

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [round, setRound] = useState<LiveStateRound | null>(null);
  const [wine, setWine] = useState<RevealedWine | null>(null);
  const [stats, setStats] = useState<RoundStats | null>(null);
  const [counts, setCounts] = useState<ParticipantCounterPayload>({
    eventId,
    roundId: null,
    connectedCount: 0,
    votedCount: 0,
  });
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);

    return () => clearInterval(timer);
  }, []);

  const applyLiveState = async (
    currentEventId: string,
  ): Promise<void> => {
    const live = await apiClient.events.liveState(currentEventId);
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
      return;
    }

    setRound(live.currentRound);
    setEndsAt(
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
    } else {
      setWine(null);
      setStats(null);
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
      setRound({
        roundId: payload.roundId,
        orderNumber: payload.orderNumber,
        blindLabel: payload.blindLabel,
        status: 'ACTIVE',
        durationSeconds: payload.durationSeconds,
        startedAt: new Date().toISOString(),
        endsAt: payload.endsAt,
        remainingSeconds: payload.durationSeconds,
      });
      setWine(payload.wine ?? null);
      setStats(null);
      setEndsAt(new Date(payload.endsAt).getTime());
      setCounts((current) => ({
        ...current,
        eventId,
        roundId: payload.roundId,
      }));
    };

    const handleVotingClosed = (payload: VotingClosedPayload) => {
      setRound((current) =>
        current && current.roundId === payload.roundId
          ? { ...current, status: 'VOTING_CLOSED' }
          : current,
      );
      setEndsAt(null);
    };

    const handleBottleRevealed = (
      payload: BottleRevealedPayload,
    ) => {
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

    const handleCounter = (payload: ParticipantCounterPayload) => {
      if (payload.eventId !== eventId) {
        return;
      }

      setCounts((current) => {
        const matchesCurrentRound =
          payload.roundId !== null &&
          payload.roundId === round?.roundId;

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
    socket.on('bottle_revealed', handleBottleRevealed);
    socket.on('participant_counter_updated', handleCounter);
    socket.on('session_error', handleError);
    socket.on('auth_error', handleError);

    return () => {
      socket.off('round_started', handleRoundStarted);
      socket.off('voting_closed', handleVotingClosed);
      socket.off('bottle_revealed', handleBottleRevealed);
      socket.off('participant_counter_updated', handleCounter);
      socket.off('session_error', handleError);
      socket.off('auth_error', handleError);
    };
  }, [socket, eventId, round?.roundId]);

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

  const remainingSeconds = endsAt
    ? Math.max(0, Math.ceil((endsAt - now) / 1000))
    : 0;
  const voteProgress =
    counts.connectedCount > 0
      ? Math.min(
          100,
          Math.round(
            (counts.votedCount / counts.connectedCount) * 100,
          ),
        )
      : 0;
  const isRevealed = round?.status === 'REVEALED' && wine;

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
    <main className="relative min-h-screen overflow-hidden bg-stone-950 pb-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(159,18,57,0.28),transparent_55%)]"
      />

      <div className="relative mx-auto w-full max-w-[1600px] px-5 pb-16 pt-5 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-stone-950/60 px-5 py-4 backdrop-blur sm:px-7">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-wine-400/25 bg-wine-500/10 text-wine-300">
              <WineIcon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex min-h-7 items-center rounded-full border px-2.5 text-[10px] font-medium uppercase tracking-wide',
                    eventStatusTone(event.status),
                  )}
                >
                  {EVENT_STATUS_LABELS[event.status]}
                </span>
                <span className="text-[11px] text-stone-500">
                  {MODE_LABELS[event.mode]} ·{' '}
                  {SCALE_LABELS[event.scaleType]}
                </span>
              </div>
              <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {event.title}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {round ? (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <Clock3
                  className="h-4 w-4 text-wine-300"
                  aria-hidden="true"
                />
                <span className="font-mono text-xl font-semibold text-white">
                  {round.status === 'ACTIVE'
                    ? formatCountdown(remainingSeconds)
                    : '—:—'}
                </span>
              </div>
            ) : null}
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <Hash className="h-4 w-4 text-stone-400" aria-hidden="true" />
              <span className="font-mono text-lg tracking-[0.2em] text-white">
                {event.sessionPin}
              </span>
            </div>
            <Link
              href={`/host/events/${event.id}/control`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-stone-300 transition hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Пульт
            </Link>
          </div>
        </header>

        <div className="mt-4">
          <ConnectionBanner
            connected={connected}
            hasConnected={hasConnected}
            error={connectionError}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto]">
          <section className="min-w-0">
            {isRevealed && wine ? (
              <div className="animate-fade-in space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-wine-300">
                      Образец раскрыт
                    </p>
                    <h2
                      data-testid="screen-revealed-wine"
                      className="mt-2 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl"
                    >
                      {wine.name}
                    </h2>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-xs text-stone-400">
                    {round?.blindLabel}
                  </span>
                </div>

                <WineDetailsCard wine={wine} large />

                <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
                      Оценка Роберта Паркера
                    </p>
                    {stats && stats.meanScore !== null ? (
                      <>
                        <div className="mt-3 flex flex-wrap items-end gap-3">
                          <span
                            data-testid="screen-score"
                            className="text-7xl font-semibold tracking-tighter text-wine-200 sm:text-8xl"
                          >
                            {stats.meanScore.toLocaleString('ru-RU', {
                              maximumFractionDigits: 1,
                            })}
                          </span>
                          <span className="pb-3 text-sm text-stone-500">
                            из 100
                          </span>
                        </div>
                        <span
                          className={cn(
                            'mt-3 inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium',
                            qualityTone(stats.qualityCategory),
                          )}
                        >
                          {stats.qualityLabel ??
                            'Категория не определена'}
                        </span>
                        <div className="mt-7">
                          <CriteriaBars criteria={stats.criteriaMeans} />
                        </div>
                        <div className="mt-6 grid grid-cols-3 gap-3 text-xs text-stone-500">
                          <div className="rounded-xl border border-white/10 p-3">
                            <p>Всего голосов</p>
                            <p className="mt-1 text-lg font-semibold text-white">
                              {stats.totalRatings}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 p-3">
                            <p>Валидных оценок</p>
                            <p className="mt-1 text-lg font-semibold text-white">
                              {stats.validVotesCount}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 p-3">
                            <p>Выбросов</p>
                            <p className="mt-1 text-lg font-semibold text-white">
                              {stats.outliersRemovedCount}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-sm text-stone-500">
                        Статистика пока недоступна
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
                          Органолептический профиль
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-white">
                          Структура вина
                        </h3>
                      </div>
                      <Radio
                        className="h-5 w-5 text-wine-300"
                        aria-hidden="true"
                      />
                    </div>
                    {stats ? (
                      <div data-testid="screen-radar">
                        <RadarProfileChart
                          profile={stats.radarProfile}
                          height={340}
                        />
                      </div>
                    ) : (
                      <div className="mt-5 flex h-72 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-stone-500">
                        Радар строится по оценкам гостей
                      </div>
                    )}
                  </div>
                </div>

                {stats && stats.aromaTagFrequency.length > 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
                      Частые дескрипторы
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {stats.aromaTagFrequency
                        .slice(0, 12)
                        .map((entry) => (
                          <span
                            key={entry.tag}
                            className="rounded-full border border-wine-400/20 bg-wine-500/10 px-3 py-1.5 text-sm text-wine-100"
                          >
                            {entry.tag}
                            <span className="ml-2 text-xs text-wine-300/70">
                              {entry.count}
                            </span>
                          </span>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex min-h-[68vh] flex-col justify-center rounded-3xl border border-white/10 bg-gradient-to-br from-wine-950/50 via-stone-900/60 to-stone-950 p-6 sm:p-12">
                {round ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={cn(
                          'inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium',
                          roundStatusTone(round.status),
                        )}
                      >
                        {ROUND_STATUS_LABELS[round.status]}
                      </span>
                      <span className="text-xs text-stone-500">
                        {MODE_LABELS[event.mode]} ·{' '}
                        {SCALE_LABELS[event.scaleType]}
                      </span>
                    </div>
                    <p className="mt-8 text-xs uppercase tracking-[0.24em] text-wine-300">
                      Раунд {round.orderNumber}
                    </p>
                    <h2
                      data-testid="screen-current-label"
                      className="mt-3 text-balance text-6xl font-semibold tracking-tight text-white sm:text-7xl lg:text-8xl"
                    >
                      {round.blindLabel}
                    </h2>
                    <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-300">
                      {round.status === 'ACTIVE'
                        ? 'Гости оценивают образец. Дождитесь завершения голосования.'
                        : round.status === 'VOTING_CLOSED'
                          ? 'Голосование закрыто. Ведущий готовит раскрытие карточки.'
                          : round.status === 'REVEALED'
                            ? 'Карточка образца раскрыта.'
                            : 'Ожидание запуска раунда сомелье…'}
                    </p>

                    <div className="mt-10 max-w-2xl">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                            Получено оценок
                          </p>
                          <p className="mt-2 text-4xl font-semibold text-white">
                            {counts.votedCount}
                            <span className="text-lg font-normal text-stone-500">
                              {' '}
                              / {counts.connectedCount}
                            </span>
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200">
                          <Users
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                          В сети: {counts.connectedCount}
                        </span>
                      </div>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-wine-600 to-wine-300 transition-all duration-500"
                          style={{ width: `${voteProgress}%` }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs uppercase tracking-[0.24em] text-wine-300">
                      Трансляция дегустации
                    </p>
                    <h2 className="mt-4 text-5xl font-semibold tracking-tight text-white sm:text-7xl">
                      Ожидание первого раунда
                    </h2>
                    <p className="mt-6 max-w-xl text-lg leading-8 text-stone-400">
                      Откройте пульт ведущего, чтобы запустить первый
                      образец. Гости могут присоединиться по QR-коду
                      прямо сейчас.
                    </p>
                  </>
                )}

                <div className="mt-10 flex flex-wrap items-center gap-5 text-sm text-stone-400">
                  <span className="inline-flex items-center gap-2">
                    <Vote className="h-4 w-4" aria-hidden="true" />
                    {counts.votedCount} оценок
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    {counts.connectedCount} участников в сети
                  </span>
                </div>
              </div>
            )}
          </section>

          <aside className="hidden w-[210px] shrink-0 lg:block">
            <div className="sticky top-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
              <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-stone-400">
                Вход для гостей
              </p>
              <QrPanel
                sessionPin={event.sessionPin}
                size={150}
                showPin={false}
              />
              <p className="mt-4 text-center font-mono text-2xl font-semibold tracking-[0.22em] text-white">
                {event.sessionPin}
              </p>
              <p className="mt-2 text-center text-[11px] leading-5 text-stone-500">
                Отсканируйте QR-код или введите PIN на телефоне
              </p>
            </div>

            {round ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
                <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                  Раунд
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {round.orderNumber}
                </p>
                <p className="mt-1 text-xs text-stone-400">
                  {ROUND_STATUS_LABELS[round.status]}
                </p>
              </div>
            ) : null}

            {isRevealed && round ? (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-center text-xs text-emerald-200">
                <CheckCircle2
                  className="h-4 w-4"
                  aria-hidden="true"
                />
                Образец раскрыт
              </div>
            ) : null}
          </aside>
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
