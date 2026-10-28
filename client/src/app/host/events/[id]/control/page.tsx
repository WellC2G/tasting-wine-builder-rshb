'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Eye,
  Hash,
  Loader2,
  Lock,
  Monitor,
  Play,
  QrCode,
  Radio,
  Send,
  Users,
  Vote,
  Wine as WineIcon,
} from 'lucide-react';

import { ConnectionBanner } from '@/components/connection-banner';
import { CriteriaBars } from '@/components/criteria-bars';
import { ExportResultModal } from '@/components/export-result-modal';
import { Modal } from '@/components/modal';
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
  pluralize,
  roundStatusTone,
} from '@/lib/format';
import { qualityTone } from '@/lib/rating';
import { clearHostSession } from '@/lib/session';
import type {
  EventDetail,
  EventRound,
  ExportResponse,
  RoundStats,
  RoundStatus,
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

function computeEndsAt(round: EventRound | null): number | null {
  if (!round || round.status !== 'ACTIVE' || !round.startedAt) {
    return null;
  }

  return (
    new Date(round.startedAt).getTime() +
    round.durationSeconds * 1000
  );
}

export default function HostControlPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const router = useRouter();
  const { token, ready } = useHostSession();
  const {
    socket,
    connected,
    hasConnected,
    connectionError,
    connectCount,
  } = useTastingSocket(token);

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<
    string | null
  >(null);
  const [counts, setCounts] = useState<ParticipantCounterPayload>({
    eventId,
    roundId: null,
    connectedCount: 0,
    votedCount: 0,
  });
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [pendingAction, setPendingAction] = useState<
    'start' | 'lock' | 'reveal' | 'stats' | null
  >(null);
  const [selectedRoundStats, setSelectedRoundStats] =
    useState<RoundStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrTab, setQrTab] = useState<'guest' | 'host'>('guest');
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] =
    useState<ExportResponse | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [lastReveal, setLastReveal] =
    useState<BottleRevealedPayload | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready || !token) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const [detail, live] = await Promise.all([
          apiClient.events.get(eventId),
          apiClient.events.liveState(eventId).catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        const liveRound = live?.currentRound ?? null;
        const mergedRounds = liveRound
          ? detail.rounds.map((round) =>
              round.id === liveRound.roundId
                ? {
                    ...round,
                    status: liveRound.status,
                    startedAt: liveRound.startedAt,
                  }
                : round,
            )
          : detail.rounds;
        const mergedEvent = { ...detail, rounds: mergedRounds };
        const initialRoundId =
          liveRound?.roundId ??
          mergedEvent.rounds.find(
            (round) => round.status === 'ACTIVE',
          )?.id ??
          mergedEvent.rounds[0]?.id ??
          null;
        const initialRound =
          mergedEvent.rounds.find(
            (round) => round.id === initialRoundId,
          ) ?? null;

        setEvent(mergedEvent);
        setSelectedRoundId(initialRoundId);
        setCounts({
          eventId,
          roundId: liveRound?.roundId ?? null,
          connectedCount:
            live?.connectedParticipantCount ??
            detail.connectedParticipantCount,
          votedCount: 0,
        });
        setEndsAt(
          liveRound?.endsAt
            ? new Date(liveRound.endsAt).getTime()
            : computeEndsAt(initialRound),
        );

        if (initialRoundId) {
          const stats = await apiClient.ratings
            .stats(initialRoundId)
            .catch(() => null);

          if (!cancelled && stats) {
            setCounts((current) => ({
              ...current,
              roundId: initialRoundId,
              votedCount: stats.totalRatings,
            }));
          }
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearHostSession();
          router.replace('/host/login');
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
  }, [ready, token, eventId, router]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleRoundStarted = (payload: RoundStartedPayload) => {
      setEvent((current) =>
        current
          ? {
              ...current,
              rounds: current.rounds.map((round) =>
                round.id === payload.roundId
                  ? {
                      ...round,
                      status: 'ACTIVE',
                      startedAt: new Date().toISOString(),
                      durationSeconds: payload.durationSeconds,
                    }
                  : round,
              ),
            }
          : current,
      );
      setSelectedRoundId(payload.roundId);
      setEndsAt(new Date(payload.endsAt).getTime());
      setSelectedRoundStats(null);
      setCounts((current) => ({
        ...current,
        roundId: payload.roundId,
      }));
      setPendingAction(null);
      setToast({ message: 'Раунд запущен', tone: 'success' });
    };

    const handleVotingClosed = (payload: VotingClosedPayload) => {
      setEvent((current) =>
        current
          ? {
              ...current,
              rounds: current.rounds.map((round) =>
                round.id === payload.roundId
                  ? { ...round, status: 'VOTING_CLOSED' }
                  : round,
              ),
            }
          : current,
      );
      setEndsAt((current) =>
        payload.roundId === selectedRoundId ? null : current,
      );
      setPendingAction(null);
      setToast({ message: payload.message, tone: 'info' });
    };

    const handleBottleRevealed = (
      payload: BottleRevealedPayload,
    ) => {
      setEvent((current) =>
        current
          ? {
              ...current,
              rounds: current.rounds.map((round) =>
                round.id === payload.roundId
                  ? { ...round, status: 'REVEALED' }
                  : round,
              ),
            }
          : current,
      );
      setSelectedRoundId(payload.roundId);
      setSelectedRoundStats(payload.stats);
      setLastReveal(payload);
      setEndsAt(null);
      setPendingAction(null);
      setCounts((current) => ({
        ...current,
        eventId,
        roundId: payload.roundId,
        votedCount: payload.stats.totalRatings,
      }));
      const score =
        payload.stats.meanScore !== null
          ? ` · ${payload.stats.meanScore.toLocaleString('ru-RU', {
              maximumFractionDigits: 1,
            })} балла`
          : '';

      setToast({
        message: `Карточка раскрыта: ${payload.wine.name}${score}`,
        tone: 'success',
      });
    };

    const handleCounter = (payload: ParticipantCounterPayload) => {
      if (payload.eventId !== eventId) {
        return;
      }

      setCounts((current) => {
        const matchesSelectedRound =
          payload.roundId !== null &&
          payload.roundId === selectedRoundId;

        return {
          ...current,
          eventId,
          connectedCount: payload.connectedCount,
          ...(matchesSelectedRound
            ? {
                roundId: payload.roundId,
                votedCount: payload.votedCount,
              }
            : {}),
        };
      });
    };

    const handleError = (payload: SocketMessagePayload) => {
      setPendingAction(null);
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
  }, [socket, selectedRoundId, eventId]);

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

    let cancelled = false;
    const refresh = async () => {
      try {
        const live = await apiClient.events.liveState(eventId);

        if (cancelled) {
          return;
        }

        setCounts((current) => ({
          ...current,
          roundId: live.currentRound?.roundId ?? null,
          connectedCount: live.connectedParticipantCount,
        }));

        if (live.currentRound) {
          setSelectedRoundId(live.currentRound.roundId);
          setEndsAt(
            live.currentRound.endsAt
              ? new Date(live.currentRound.endsAt).getTime()
              : null,
          );
          setEvent((current) =>
            current
              ? {
                  ...current,
                  rounds: current.rounds.map((round) =>
                    round.id === live.currentRound?.roundId
                      ? {
                          ...round,
                          status: live.currentRound.status,
                          startedAt: live.currentRound.startedAt,
                        }
                      : round,
                  ),
                }
              : current,
          );

          const stats = await apiClient.ratings
            .stats(live.currentRound.roundId)
            .catch(() => null);

          if (!cancelled && stats) {
            setCounts((current) => ({
              ...current,
              roundId: live.currentRound?.roundId ?? current.roundId,
              votedCount: stats.totalRatings,
            }));
          }
        }
      } catch {
        // The reconnect banner already communicates the lost connection.
      }
    };

    void refresh();

    return () => {
      cancelled = true;
    };
  }, [socket, connectCount, eventId]);

  useEffect(() => {
    if (!pendingAction) {
      return;
    }

    const timeout = setTimeout(() => {
      setPendingAction(null);
      setToast({
        message: 'Сервер не подтвердил действие. Попробуйте снова.',
        tone: 'error',
      });
    }, 8000);

    return () => clearTimeout(timeout);
  }, [pendingAction]);

  const rounds = event?.rounds ?? [];
  const selectedRound = useMemo(
    () =>
      rounds.find((round) => round.id === selectedRoundId) ?? null,
    [rounds, selectedRoundId],
  );

  useEffect(() => {
    if (!selectedRound || selectedRound.status !== 'REVEALED') {
      setSelectedRoundStats(null);
      setStatsLoading(false);
      return;
    }

    let cancelled = false;
    setStatsLoading(true);

    void apiClient.ratings
      .stats(selectedRound.id)
      .then((stats) => {
        if (!cancelled) {
          setSelectedRoundStats(stats);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedRoundStats(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStatsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRound?.id, selectedRound?.status]);

  const remainingSeconds = endsAt
    ? Math.max(0, Math.ceil((endsAt - now) / 1000))
    : 0;
  const votingProgress =
    counts.connectedCount > 0
      ? Math.min(
          100,
          Math.round(
            (counts.votedCount / counts.connectedCount) * 100,
          ),
        )
      : 0;
  const controlsDisabled = !connected || pendingAction !== null;
  const canStart =
    !controlsDisabled &&
    selectedRound !== null &&
    selectedRound.status !== 'ACTIVE';
  const canLock =
    !controlsDisabled && selectedRound?.status === 'ACTIVE';
  const canReveal =
    !controlsDisabled &&
    selectedRound?.status === 'VOTING_CLOSED';

  const handleSelectRound = (round: EventRound) => {
    setSelectedRoundId(round.id);
    setSelectedRoundStats(null);
    setEndsAt(computeEndsAt(round));

    void apiClient.ratings
      .stats(round.id)
      .then((stats) =>
        setCounts((current) => ({
          ...current,
          roundId: round.id,
          votedCount: stats.totalRatings,
        })),
      )
      .catch(() => {
        setCounts((current) => ({
          ...current,
          roundId: round.id,
          votedCount: 0,
        }));
      });
  };

  const handleStartRound = () => {
    if (!socket || !selectedRound || !canStart) {
      return;
    }

    setPendingAction('start');
    socket.emit('host:start_round', {
      eventId,
      roundId: selectedRound.id,
      durationSeconds: selectedRound.durationSeconds,
    });
  };

  const handleLockVoting = () => {
    if (!socket || !selectedRound || !canLock) {
      return;
    }

    setPendingAction('lock');
    socket.emit('host:lock_voting', {
      eventId,
      roundId: selectedRound.id,
    });
  };

  const handleRevealBottle = () => {
    if (!socket || !selectedRound || !canReveal) {
      return;
    }

    setPendingAction('reveal');
    socket.emit('host:reveal_bottle', {
      eventId,
      roundId: selectedRound.id,
    });
  };

  const handleShowStats = () => {
    if (!socket || !selectedRound || !connected) {
      return;
    }

    setPendingAction('stats');
    socket.emit('host:show_stats', {
      eventId,
      roundId: selectedRound.id,
    });
  };

  const handleExport = async () => {
    setExporting(true);

    try {
      const result = await apiClient.export.create(eventId);
      setExportResult(result);
      setExportOpen(true);
      setEvent((current) =>
        current ? { ...current, status: 'EXPORTED' } : current,
      );
      setToast({
        message: 'Результаты выгружены в Народный рейтинг',
        tone: 'success',
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearHostSession();
        router.replace('/host/login');
        return;
      }

      setToast({
        message: getApiErrorMessage(error),
        tone: 'error',
      });
    } finally {
      setExporting(false);
    }
  };

  if (!ready || !token || loading) {
    return <PageLoader message="Загружаем пульт ведущего…" />;
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
    <main className="min-h-screen bg-stone-950 pb-24">
      <div className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6 sm:pt-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-wine-950/60 via-stone-900/70 to-stone-950 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/host/events"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl px-2 text-sm text-stone-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Мероприятия
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href={`/host/events/${event.id}/screen`}
                target="_blank"
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 text-stone-300 transition hover:bg-white/5 hover:text-white"
                aria-label="Открыть экран проектора"
              >
                <Monitor className="h-5 w-5" aria-hidden="true" />
              </Link>
              <button
                type="button"
                data-testid="control-open-qr"
                onClick={() => {
                  setQrTab('guest');
                  setQrOpen(true);
                }}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-stone-950 transition hover:bg-stone-200"
              >
                <QrCode className="h-4 w-4" aria-hidden="true" />
                QR-код
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium',
                eventStatusTone(event.status),
              )}
            >
              {EVENT_STATUS_LABELS[event.status]}
            </span>
            <span
              data-testid="host-pin"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 px-3 font-mono text-xs text-stone-300"
            >
              <Hash className="h-3.5 w-3.5" aria-hidden="true" />
              {event.sessionPin}
            </span>
            <span className="inline-flex min-h-8 items-center rounded-full border border-white/10 px-3 text-xs text-stone-400">
              {MODE_LABELS[event.mode]} ·{' '}
              {SCALE_LABELS[event.scaleType]}
            </span>
          </div>
          <h1 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {event.title}
          </h1>

          <div
            data-testid="host-counter"
            className="mt-4 flex flex-wrap gap-2"
          >
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 text-sm text-emerald-200">
              <Users className="h-4 w-4" aria-hidden="true" />
              В сети: {counts.connectedCount}
            </span>
            <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 text-sm text-sky-200">
              <Vote className="h-4 w-4" aria-hidden="true" />
              Проголосовало: {counts.votedCount}
            </span>
          </div>
        </header>

        <div className="mt-4">
          <ConnectionBanner
            connected={connected}
            hasConnected={hasConnected}
            error={connectionError}
          />
        </div>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Раунды
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                Программа дегустации
              </h2>
            </div>
            <span className="text-xs text-stone-500">
              {rounds.length}{' '}
              {pluralize(rounds.length, 'образец', 'образца', 'образцов')}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {rounds.map((round) => (
              <button
                key={round.id}
                type="button"
                onClick={() => handleSelectRound(round)}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition',
                  round.id === selectedRoundId
                    ? 'border-wine-400/50 bg-wine-500/10'
                    : 'border-white/10 bg-stone-950/40 hover:bg-white/[0.04]',
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 font-mono text-xs text-stone-300">
                  {String(round.orderNumber).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">
                    {round.blindLabel}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-stone-500">
                    {round.wine.name}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium',
                    roundStatusTone(round.status),
                  )}
                >
                  {ROUND_STATUS_LABELS[round.status]}
                </span>
              </button>
            ))}
            {rounds.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-stone-500">
                В мероприятии нет раундов
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                {selectedRound?.status === 'REVEALED'
                  ? 'Статистика раунда'
                  : 'Текущий раунд'}
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                {selectedRound?.blindLabel ?? 'Раунд не выбран'}
              </h2>
              {selectedRound ? (
                <p className="mt-1 text-sm text-stone-400">
                  {selectedRound.wine.name}
                </p>
              ) : null}
            </div>
            {selectedRound ? (
              <span
                className={cn(
                  'inline-flex min-h-9 items-center self-start rounded-full border px-3 text-xs font-medium sm:self-auto',
                  roundStatusTone(selectedRound.status),
                )}
              >
                {ROUND_STATUS_LABELS[selectedRound.status]}
              </span>
            ) : null}
          </div>

          {selectedRound?.status === 'REVEALED' ? (
            <div className="mt-5 space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  data-testid="control-show-stats"
                  onClick={handleShowStats}
                  disabled={!connected || pendingAction !== null}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-wine-600 px-4 text-sm font-semibold text-white transition hover:bg-wine-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pendingAction === 'stats' ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Radio className="h-4 w-4" aria-hidden="true" />
                  )}
                  Показать статистику
                </button>
                <button
                  type="button"
                  data-testid="control-restart-round"
                  onClick={handleStartRound}
                  disabled={!canStart}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pendingAction === 'start' ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Play className="h-4 w-4" aria-hidden="true" />
                  )}
                  Перезапустить голосование
                </button>
              </div>

              <WineDetailsCard wine={selectedRound.wine} />

              {selectedRoundStats ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-stone-950/60 p-5">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">
                          Средний балл Паркера
                        </p>
                        <p className="mt-1 text-5xl font-semibold tracking-tight text-wine-200">
                          {selectedRoundStats.meanScore !== null
                            ? selectedRoundStats.meanScore.toLocaleString(
                                'ru-RU',
                                { maximumFractionDigits: 1 },
                              )
                            : '—'}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium',
                          qualityTone(
                            selectedRoundStats.qualityCategory,
                          ),
                        )}
                      >
                        {selectedRoundStats.qualityLabel ??
                          'Категория не определена'}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2 text-xs text-stone-500">
                      <div className="rounded-xl border border-white/10 p-3">
                        <p>Всего голосов</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {selectedRoundStats.totalRatings}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 p-3">
                        <p>Валидных</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {selectedRoundStats.validVotesCount}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 p-3">
                        <p>Выбросов</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {selectedRoundStats.outliersRemovedCount}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6">
                      <CriteriaBars
                        criteria={selectedRoundStats.criteriaMeans}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-stone-950/60 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-stone-300">
                        Органолептический профиль
                      </p>
                      <Radio
                        className="h-4 w-4 text-wine-300"
                        aria-hidden="true"
                      />
                    </div>
                    <RadarProfileChart
                      profile={selectedRoundStats.radarProfile}
                      height={280}
                      compact
                    />
                  </div>

                  {selectedRoundStats.aromaTagFrequency.length > 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-stone-950/60 p-5">
                      <p className="text-sm font-medium text-stone-300">
                        Частые ароматические дескрипторы
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedRoundStats.aromaTagFrequency
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
              ) : statsLoading ? (
                <div className="flex min-h-24 items-center justify-center gap-2 rounded-2xl border border-white/10 text-sm text-stone-400">
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Загружаем статистику раунда…
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-stone-500">
                  Статистика пока недоступна
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="mt-5 flex items-center gap-4 rounded-2xl border border-white/10 bg-stone-950/60 p-4">
                <Clock3
                  className="h-6 w-6 shrink-0 text-wine-300"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">
                    Таймер раунда
                  </p>
                  <p className="font-mono text-4xl font-semibold tracking-tight text-white">
                    {formatCountdown(remainingSeconds)}
                  </p>
                </div>
                <div className="ml-auto text-right text-xs text-stone-500">
                  <p>
                    {selectedRound?.durationSeconds ?? 0} сек
                  </p>
                  <p className="mt-1">
                    {counts.votedCount} из {counts.connectedCount}
                  </p>
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-wine-600 to-wine-300 transition-all duration-500"
                  style={{ width: `${votingProgress}%` }}
                />
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  data-testid="control-start-round"
                  onClick={handleStartRound}
                  disabled={!canStart}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pendingAction === 'start' ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Play className="h-4 w-4" aria-hidden="true" />
                  )}
                  Запустить раунд
                </button>
                <button
                  type="button"
                  data-testid="control-lock-voting"
                  onClick={handleLockVoting}
                  disabled={!canLock}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pendingAction === 'lock' ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Lock className="h-4 w-4" aria-hidden="true" />
                  )}
                  Остановить голосование
                </button>
                <button
                  type="button"
                  data-testid="control-reveal-bottle"
                  onClick={handleRevealBottle}
                  disabled={!canReveal}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-wine-600 px-4 text-sm font-semibold text-white transition hover:bg-wine-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pendingAction === 'reveal' ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                  Раскрыть карту
                </button>
              </div>

              {lastReveal ? (
                <div className="mt-5 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0 text-sky-300"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-sky-100">
                        {lastReveal.wine.name}
                      </p>
                      <p className="mt-1 text-xs text-sky-200/70">
                        {lastReveal.stats.meanScore !== null
                          ? `${lastReveal.stats.meanScore.toLocaleString(
                              'ru-RU',
                              { maximumFractionDigits: 1 },
                            )} балла · ${
                              lastReveal.stats.qualityLabel ??
                              'без категории'
                            }`
                          : 'Статистика пока недоступна'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Экспорт
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                Народный винный рейтинг
              </h2>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                Пакет формируется из валидных оценок после фильтрации
                выбросов.
              </p>
            </div>
            <button
              type="button"
              data-testid="control-export"
              onClick={() => void handleExport()}
              disabled={exporting}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-wine-400/30 bg-wine-500/10 px-4 text-sm font-semibold text-wine-100 transition hover:bg-wine-500/20 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              {exporting
                ? 'Выгружаем…'
                : 'Выгрузить в Народный рейтинг'}
            </button>
          </div>
        </section>
      </div>

      <Modal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        title="QR-коды подключения"
        size="sm"
      >
        <div className="space-y-5">
          <div
            role="tablist"
            aria-label="Тип QR-кода"
            className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={qrTab === 'guest'}
              data-testid="control-qr-guest-tab"
              onClick={() => setQrTab('guest')}
              className={cn(
                'inline-flex min-h-12 items-center justify-center rounded-lg px-3 text-sm font-medium transition',
                qrTab === 'guest'
                  ? 'bg-white text-stone-950'
                  : 'text-stone-400 hover:text-white',
              )}
            >
              Для гостей
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={qrTab === 'host'}
              data-testid="control-qr-host-tab"
              onClick={() => setQrTab('host')}
              className={cn(
                'inline-flex min-h-12 items-center justify-center rounded-lg px-3 text-sm font-medium transition',
                qrTab === 'host'
                  ? 'bg-white text-stone-950'
                  : 'text-stone-400 hover:text-white',
              )}
            >
              Для сомелье (пульт)
            </button>
          </div>

          {qrTab === 'guest' ? (
            <div className="flex flex-col items-center gap-4">
              <QrPanel
                sessionPin={event.sessionPin}
                size={240}
                allowLanIpEdit
              />
              <p className="max-w-xs text-center text-sm leading-6 text-stone-400">
                Покажите QR-код гостям или продиктуйте шестизначный PIN
                для входа в дегустацию.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-center text-xs leading-5 text-amber-100">
                Только для ведущего и сомелье — мгновенный вход в пульт
                управления без пароля
              </div>
              <QrPanel
                sessionPin={event.sessionPin}
                path={`/host/events/${event.id}/control?hostToken=${encodeURIComponent(
                  token ?? '',
                )}`}
                size={240}
                showPin={false}
                allowLanIpEdit
                ariaLabel="QR-код для входа сомелье в пульт управления"
              />
              <p className="max-w-xs text-center text-sm leading-6 text-stone-400">
                Отсканируйте QR-код на телефоне или планшете сомелье —
                устройство откроет этот пульт уже авторизованным.
              </p>
            </div>
          )}
        </div>
      </Modal>

      <ExportResultModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        result={exportResult}
        eventId={eventId}
      />

      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone ?? 'info'}
        onClose={() => setToast(null)}
      />
    </main>
  );
}
