'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Flag,
  Hash,
  Loader2,
  Lock,
  Monitor,
  Pause,
  Play,
  Plus,
  QrCode,
  Radio,
  RotateCcw,
  Search,
  Send,
  SkipForward,
  Trash2,
  UserRound,
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
  EventParticipant,
  EventRound,
  EventSummaryStats,
  ExportResponse,
  RoundStats,
  RoundStatus,
  SummaryRoundItem,
  SummaryRoundStats,
} from '@/types/api';
import type {
  AllBottlesRevealedPayload,
  BottleRevealedPayload,
  EventFinishedPayload,
  EventStatusUpdatedPayload,
  ParticipantCounterPayload,
  ParticipantsUpdatedPayload,
  RoundCompletedPayload,
  RoundSkippedPayload,
  RoundStartedPayload,
  RoundStatsUpdatedPayload,
  RoundTimerUpdatedPayload,
  SocketMessagePayload,
  SummaryPageChangedPayload,
  SummaryStatsShownPayload,
  VotingClosedPayload,
} from '@/types/realtime';

type ToastState = {
  message: string;
  tone: 'info' | 'success' | 'error';
} | null;

const SUMMARY_PAGE_SIZE = 9;

function toSummaryStats(stats: RoundStats): SummaryRoundStats {
  return {
    totalRatings: stats.totalRatings,
    validVotesCount: stats.validVotesCount,
    outliersRemovedCount: stats.outliersRemovedCount,
    meanScore: stats.meanScore,
    medianScore: stats.medianScore,
    qualityCategory: stats.qualityCategory,
    qualityLabel: stats.qualityLabel,
  };
}

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
    participantCount: 0,
    connectedCount: 0,
    votedCount: 0,
  });
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedRemainingSeconds, setPausedRemainingSeconds] =
    useState(0);
  const [now, setNow] = useState(Date.now());
  const [pendingAction, setPendingAction] = useState<
    | 'event_start'
    | 'event_finish'
    | 'start'
    | 'lock'
    | 'resume'
    | 'time'
    | 'restart'
    | 'skip'
    | 'finish_round'
    | 'reveal_wine'
    | 'summary'
    | 'reveal_all'
    | 'stats'
    | null
  >(null);
  const [restartTarget, setRestartTarget] =
    useState<EventRound | null>(null);
  const [skipTarget, setSkipTarget] = useState<EventRound | null>(
    null,
  );
  const [startEventConfirmOpen, setStartEventConfirmOpen] =
    useState(false);
  const [finishEventConfirmOpen, setFinishEventConfirmOpen] =
    useState(false);
  const [selectedRoundStats, setSelectedRoundStats] =
    useState<RoundStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrTab, setQrTab] = useState<'guest' | 'host'>('guest');
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] =
    useState<ExportResponse | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [lastReveal, setLastReveal] = useState<
    BottleRevealedPayload | RoundCompletedPayload | null
  >(null);
  const [participants, setParticipants] = useState<EventParticipant[]>(
    [],
  );
  const [participantSearch, setParticipantSearch] = useState('');
  const [removeTarget, setRemoveTarget] =
    useState<EventParticipant | null>(null);
  const [keepParticipantRatings, setKeepParticipantRatings] =
    useState(false);
  const [removingParticipant, setRemovingParticipant] =
    useState(false);
  const [summaryItems, setSummaryItems] = useState<
    SummaryRoundItem[]
  >([]);
  const [summaryPage, setSummaryPage] = useState(1);
  const [revealAllConfirmOpen, setRevealAllConfirmOpen] =
    useState(false);
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
        const [detail, live, allEvents, eventParticipants] =
          await Promise.all([
            apiClient.events.get(eventId),
            apiClient.events.liveState(eventId).catch(() => null),
            apiClient.events.list().catch(() => []),
            apiClient.events
              .participants(eventId)
              .catch(() => []),
          ]);

        if (cancelled) {
          return;
        }

        const otherActiveEvent = allEvents.find(
          (candidate) =>
            candidate.id !== eventId &&
            candidate.status === 'ACTIVE',
        );

        if (otherActiveEvent) {
          router.replace(
            `/host/events/${otherActiveEvent.id}/control`,
          );
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

        const summary =
          detail.status === 'FINISHED' ||
          detail.status === 'EXPORTED'
            ? await apiClient.events
                .summary(eventId)
                .catch(() => null)
            : null;

        if (cancelled) {
          return;
        }

        setEvent(mergedEvent);
        setParticipants(eventParticipants);
        setSummaryItems(summary?.items ?? []);
        setSummaryPage(1);
        setSelectedRoundId(initialRoundId);
        setCounts({
          eventId,
          roundId: liveRound?.roundId ?? null,
          participantCount:
            live?.participantCount ?? detail.participantCount,
          connectedCount:
            live?.connectedParticipantCount ??
            detail.connectedParticipantCount,
          votedCount: 0,
        });
        const initialStatus = liveRound?.status ?? initialRound?.status;
        const initialRemaining =
          liveRound?.remainingSeconds ??
          initialRound?.durationSeconds ??
          0;

        setEndsAt(
          initialStatus === 'ACTIVE'
            ? liveRound?.endsAt
              ? new Date(liveRound.endsAt).getTime()
              : computeEndsAt(initialRound)
            : null,
        );
        setPausedRemainingSeconds(initialRemaining);

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
      setPausedRemainingSeconds(payload.remainingSeconds);
      setSelectedRoundStats(null);
      setCounts((current) => ({
        ...current,
        roundId: payload.roundId,
      }));
      setPendingAction(null);
      setToast({
        message: payload.resetRatings
          ? 'Раунд начат заново. Оценки этого образца сброшены.'
          : payload.isResumed
            ? 'Раунд продолжен'
            : 'Раунд запущен',
        tone: 'success',
      });
    };

    const handleVotingClosed = (payload: VotingClosedPayload) => {
      setEvent((current) =>
        current
          ? {
              ...current,
              rounds: current.rounds.map((round) =>
                round.id === payload.roundId
                  ? {
                      ...round,
                      status: 'VOTING_CLOSED',
                      durationSeconds: Math.max(
                        1,
                        payload.remainingSeconds,
                      ),
                    }
                  : round,
              ),
            }
          : current,
      );
      if (payload.roundId === selectedRoundId) {
        setEndsAt(null);
        setPausedRemainingSeconds(payload.remainingSeconds);
      }
      setPendingAction(null);
      setToast({ message: payload.message, tone: 'info' });
    };

    const handleRoundTimerUpdated = (
      payload: RoundTimerUpdatedPayload,
    ) => {
      setEvent((current) =>
        current
          ? {
              ...current,
              rounds: current.rounds.map((round) =>
                round.id === payload.roundId
                  ? {
                      ...round,
                      durationSeconds: payload.durationSeconds,
                    }
                  : round,
              ),
            }
          : current,
      );

      if (payload.roundId === selectedRoundId) {
        setPausedRemainingSeconds(payload.remainingSeconds);
        setEndsAt(
          payload.status === 'ACTIVE' && payload.endsAt
            ? new Date(payload.endsAt).getTime()
            : null,
        );
      }
      setPendingAction(null);
      setToast({
        message: `Добавлено время. Осталось ${formatCountdown(
          payload.remainingSeconds,
        )}`,
        tone: 'success',
      });
    };

    const handleRoundSkipped = (payload: RoundSkippedPayload) => {
      setEvent((current) =>
        current
          ? {
              ...current,
              rounds: current.rounds.map((round) =>
                round.id === payload.roundId
                  ? { ...round, status: 'SKIPPED' }
                  : round,
              ),
            }
          : current,
      );
      setSelectedRoundStats(null);
      setEndsAt(null);
      setPausedRemainingSeconds(0);
      setPendingAction(null);
      setToast({ message: payload.message, tone: 'info' });
    };

    const handleEventStatusUpdated = (
      payload: EventStatusUpdatedPayload,
    ) => {
      if (payload.eventId !== eventId) {
        if (payload.status === 'ACTIVE') {
          setToast({
            message: `Запущена другая дегустация («${payload.title}»). Переходим к её пульту.`,
            tone: 'info',
          });
          router.replace(
            `/host/events/${payload.eventId}/control`,
          );
        }
        return;
      }

      setEvent((current) =>
        current ? { ...current, status: payload.status } : current,
      );
      setPendingAction(null);

      if (payload.status === 'ACTIVE') {
        setToast({
          message: 'Дегустация началась. Пульт заблокирован до завершения.',
          tone: 'success',
        });
      }
    };

    const handleEventFinished = (payload: EventFinishedPayload) => {
      if (payload.eventId !== eventId) {
        return;
      }

      setEvent((current) =>
        current ? { ...current, status: payload.status } : current,
      );
      setEndsAt(null);
      setPendingAction(null);
      void apiClient.events
        .summary(eventId)
        .then((summary) => {
          setSummaryItems(summary.items);
          setSummaryPage(1);
        })
        .catch(() => undefined);
      setToast({ message: payload.message, tone: 'success' });
    };

    const applyCompletedRound = (
      payload: BottleRevealedPayload | RoundCompletedPayload,
    ) => {
      setEvent((current) =>
        current
          ? {
              ...current,
              rounds: current.rounds.map((round) =>
                round.id === payload.roundId
                  ? {
                      ...round,
                      status: 'REVEALED',
                      isWineRevealed:
                        payload.isWineRevealed ||
                        round.isWineRevealed,
                      revealedAt:
                        payload.isWineRevealed &&
                        round.revealedAt === null
                          ? new Date().toISOString()
                          : round.revealedAt,
                    }
                  : round,
              ),
            }
          : current,
      );
      setSelectedRoundId(payload.roundId);
      setSelectedRoundStats(payload.stats);
      setLastReveal(payload);
      setEndsAt(null);
      setPausedRemainingSeconds(0);
      setPendingAction(null);
      setCounts((current) => ({
        ...current,
        eventId,
        roundId: payload.roundId,
        votedCount: payload.stats.totalRatings,
      }));
      setSummaryItems((current) =>
        current.map((item) =>
          item.roundId === payload.roundId
            ? {
                ...item,
                status: 'REVEALED',
                isWineRevealed:
                  payload.isWineRevealed || item.isWineRevealed,
                wine: payload.isWineRevealed
                  ? payload.wine
                  : item.wine,
                stats: toSummaryStats(payload.stats),
              }
            : item,
        ),
      );

      const score =
        payload.stats.meanScore !== null
          ? ` · ${payload.stats.meanScore.toLocaleString('ru-RU', {
              maximumFractionDigits: 1,
            })} балла`
          : '';

      setToast({
        message:
          payload.isWineRevealed && payload.wine
            ? `Карточка раскрыта: ${payload.wine.name}${score}`
            : `Раунд завершён. Статистика готова${score}`,
        tone: 'success',
      });
    };

    const handleRoundCompleted = (
      payload: RoundCompletedPayload,
    ) => {
      applyCompletedRound(payload);
    };

    const handleBottleRevealed = (
      payload: BottleRevealedPayload,
    ) => {
      applyCompletedRound(payload);
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
          participantCount: payload.participantCount,
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

    const handleParticipantsUpdated = (
      payload: ParticipantsUpdatedPayload,
    ) => {
      if (payload.eventId !== eventId) {
        return;
      }

      setParticipants(payload.participants);
    };

    const handleRoundStatsUpdated = (
      payload: RoundStatsUpdatedPayload,
    ) => {
      if (payload.eventId !== eventId) {
        return;
      }

      if (payload.roundId === selectedRoundId) {
        setSelectedRoundStats(payload.stats);
      }

      setLastReveal((current) =>
        current && current.roundId === payload.roundId
          ? { ...current, stats: payload.stats }
          : current,
      );
      setSummaryItems((current) =>
        current.map((item) =>
          item.roundId === payload.roundId
            ? { ...item, stats: toSummaryStats(payload.stats) }
            : item,
        ),
      );
    };

    const handleSummaryStatsShown = (
      payload: SummaryStatsShownPayload,
    ) => {
      if (payload.eventId !== eventId) {
        return;
      }

      setSummaryItems(payload.items);
      setSummaryPage(payload.page);
      setPendingAction(null);
    };

    const handleSummaryPageChanged = (
      payload: SummaryPageChangedPayload,
    ) => {
      if (payload.eventId !== eventId) {
        return;
      }

      setSummaryPage(payload.page);
    };

    const handleAllBottlesRevealed = (
      payload: AllBottlesRevealedPayload,
    ) => {
      if (payload.eventId !== eventId) {
        return;
      }

      setSummaryItems(payload.items);
      setEvent((current) =>
        current
          ? {
              ...current,
              rounds: current.rounds.map((round) => ({
                ...round,
                revealedAt:
                  round.status === 'SKIPPED'
                    ? round.revealedAt
                    : (round.revealedAt ?? new Date().toISOString()),
                isWineRevealed:
                  round.status === 'SKIPPED'
                    ? round.isWineRevealed
                    : true,
              })),
            }
          : current,
      );
      setPendingAction(null);
      setToast({
        message: 'Все вина раскрыты и показаны гостям',
        tone: 'success',
      });
    };

    const handleError = (payload: SocketMessagePayload) => {
      setPendingAction(null);
      setToast({ message: payload.message, tone: 'error' });
    };

    socket.on('round_started', handleRoundStarted);
    socket.on('round_completed', handleRoundCompleted);
    socket.on('voting_closed', handleVotingClosed);
    socket.on('round_timer_updated', handleRoundTimerUpdated);
    socket.on('round_skipped', handleRoundSkipped);
    socket.on('bottle_revealed', handleBottleRevealed);
    socket.on('event_status_updated', handleEventStatusUpdated);
    socket.on('event_finished', handleEventFinished);
    socket.on('participant_counter_updated', handleCounter);
    socket.on(
      'participants_updated',
      handleParticipantsUpdated,
    );
    socket.on('round_stats_updated', handleRoundStatsUpdated);
    socket.on('summary_stats_shown', handleSummaryStatsShown);
    socket.on('summary_page_changed', handleSummaryPageChanged);
    socket.on('all_bottles_revealed', handleAllBottlesRevealed);
    socket.on('session_error', handleError);
    socket.on('auth_error', handleError);

    return () => {
      socket.off('round_started', handleRoundStarted);
      socket.off('round_completed', handleRoundCompleted);
      socket.off('voting_closed', handleVotingClosed);
      socket.off('round_timer_updated', handleRoundTimerUpdated);
      socket.off('round_skipped', handleRoundSkipped);
      socket.off('bottle_revealed', handleBottleRevealed);
      socket.off('event_status_updated', handleEventStatusUpdated);
      socket.off('event_finished', handleEventFinished);
      socket.off('participant_counter_updated', handleCounter);
      socket.off(
        'participants_updated',
        handleParticipantsUpdated,
      );
      socket.off('round_stats_updated', handleRoundStatsUpdated);
      socket.off('summary_stats_shown', handleSummaryStatsShown);
      socket.off('summary_page_changed', handleSummaryPageChanged);
      socket.off('all_bottles_revealed', handleAllBottlesRevealed);
      socket.off('session_error', handleError);
      socket.off('auth_error', handleError);
    };
  }, [socket, selectedRoundId, eventId, router]);

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
          setPausedRemainingSeconds(
            live.currentRound.remainingSeconds,
          );
          setEndsAt(
            live.currentRound.status === 'ACTIVE' &&
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
  const filteredParticipants = useMemo(() => {
    const query = participantSearch.trim().toLocaleLowerCase('ru');

    if (!query) {
      return participants;
    }

    return participants.filter((participant) =>
      participant.nickname.toLocaleLowerCase('ru').includes(query),
    );
  }, [participants, participantSearch]);

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

  const remainingSeconds =
    selectedRound?.status === 'ACTIVE' && endsAt
      ? Math.max(0, Math.ceil((endsAt - now) / 1000))
      : pausedRemainingSeconds;
  const votingProgress =
    counts.connectedCount > 0
      ? Math.min(
          100,
          Math.round(
            (counts.votedCount / counts.connectedCount) * 100,
          ),
        )
      : 0;
  const eventIsActive = event?.status === 'ACTIVE';
  const eventIsFinished =
    event?.status === 'FINISHED' || event?.status === 'EXPORTED';
  const roundInProgress =
    rounds.find(
      (round) =>
        round.status === 'ACTIVE' ||
        round.status === 'VOTING_CLOSED',
    ) ?? null;
  const roundSelectionLocked =
    eventIsActive && roundInProgress !== null;
  const allRoundsFinalized =
    rounds.length > 0 &&
    rounds.every(
      (round) =>
        round.status === 'REVEALED' || round.status === 'SKIPPED',
    );
  const controlsDisabled = !connected || pendingAction !== null;
  const canStartEvent =
    !controlsDisabled && event?.status === 'DRAFT';
  const canFinishEvent =
    !controlsDisabled && eventIsActive && allRoundsFinalized;
  const canStart =
    !controlsDisabled &&
    eventIsActive &&
    (selectedRound?.status === 'PENDING' ||
      selectedRound?.status === 'SKIPPED') &&
    roundInProgress === null;
  const canLock =
    !controlsDisabled &&
    eventIsActive &&
    selectedRound?.status === 'ACTIVE';
  const canResume =
    !controlsDisabled &&
    eventIsActive &&
    selectedRound?.status === 'VOTING_CLOSED' &&
    remainingSeconds > 0;
  const canAddTime =
    !controlsDisabled &&
    eventIsActive &&
    (selectedRound?.status === 'ACTIVE' ||
      selectedRound?.status === 'VOTING_CLOSED');
  const canFinishRound =
    !controlsDisabled &&
    eventIsActive &&
    (selectedRound?.status === 'ACTIVE' ||
      selectedRound?.status === 'VOTING_CLOSED');
  const canRevealWine =
    !controlsDisabled &&
    event?.mode === 'BLIND' &&
    selectedRound?.status === 'REVEALED' &&
    selectedRound.revealedAt === null &&
    (eventIsActive || eventIsFinished);
  const canRestart =
    !controlsDisabled &&
    eventIsActive &&
    selectedRound !== null &&
    selectedRound.status !== 'PENDING' &&
    (roundInProgress === null || roundInProgress.id === selectedRound.id);
  const canSkip =
    !controlsDisabled &&
    eventIsActive &&
    selectedRound !== null &&
    selectedRound.status !== 'SKIPPED' &&
    (roundInProgress === null || roundInProgress.id === selectedRound.id);
  const totalSummaryPages = Math.max(
    1,
    Math.ceil(summaryItems.length / SUMMARY_PAGE_SIZE),
  );
  const allWinesRevealed =
    event?.mode === 'OPEN' ||
    (summaryItems.length > 0
      ? summaryItems.every((item) => item.isWineRevealed)
      : rounds
          .filter((round) => round.status !== 'SKIPPED')
          .every((round) => round.isWineRevealed));
  const currentRoundIndex = selectedRound
    ? rounds.findIndex((round) => round.id === selectedRound.id)
    : -1;
  const roundNavigationDisabled =
    controlsDisabled || roundInProgress !== null;

  const handleSelectRound = (round: EventRound) => {
    if (
      roundSelectionLocked &&
      round.id !== selectedRoundId &&
      roundInProgress !== null
    ) {
      setToast({
        message:
          'Сначала завершите текущий раунд или пропустите вино',
        tone: 'info',
      });
      return;
    }

    setSelectedRoundId(round.id);
    setSelectedRoundStats(null);
    setPausedRemainingSeconds(round.durationSeconds);
    setEndsAt(
      round.status === 'ACTIVE' ? computeEndsAt(round) : null,
    );

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

  const handleStartEvent = () => {
    if (!socket || !canStartEvent) {
      return;
    }

    setPendingAction('event_start');
    socket.emit('host:start_event', { eventId });
  };

  const handleFinishEvent = () => {
    if (!socket || !canFinishEvent) {
      return;
    }

    setPendingAction('event_finish');
    socket.emit('host:finish_event', { eventId });
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

  const handleResumeRound = () => {
    if (!socket || !selectedRound || !canResume) {
      return;
    }

    setPendingAction('resume');
    socket.emit('host:resume_round', {
      eventId,
      roundId: selectedRound.id,
    });
  };

  const handleAddRoundTime = (additionalSeconds: number) => {
    if (!socket || !selectedRound || !canAddTime) {
      return;
    }

    setPendingAction('time');
    socket.emit('host:add_round_time', {
      eventId,
      roundId: selectedRound.id,
      additionalSeconds,
    });
  };

  const handleRestartRound = () => {
    if (!socket || !restartTarget || !canRestart) {
      return;
    }

    setPendingAction('restart');
    socket.emit('host:restart_round', {
      eventId,
      roundId: restartTarget.id,
      durationSeconds: restartTarget.durationSeconds,
    });
    setRestartTarget(null);
  };

  const handleSkipRound = () => {
    if (!socket || !skipTarget || !canSkip) {
      return;
    }

    setPendingAction('skip');
    socket.emit('host:skip_round', {
      eventId,
      roundId: skipTarget.id,
    });
    setSkipTarget(null);
  };

  const handleFinishRound = () => {
    if (!socket || !selectedRound || !canFinishRound) {
      return;
    }

    setPendingAction('finish_round');
    socket.emit('host:finish_round', {
      eventId,
      roundId: selectedRound.id,
    });
  };

  const handleRevealWine = () => {
    if (!socket || !selectedRound || !canRevealWine) {
      return;
    }

    setPendingAction('reveal_wine');
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

  const handleShowSummary = () => {
    if (!socket || !eventIsFinished) {
      return;
    }

    setPendingAction('summary');
    setSummaryPage(1);
    socket.emit('host:show_summary', {
      eventId,
      page: 1,
    });
  };

  const handleSummaryPageChange = (nextPage: number) => {
    if (!socket || !eventIsFinished) {
      return;
    }

    const page = Math.min(
      totalSummaryPages,
      Math.max(1, nextPage),
    );

    setSummaryPage(page);
    socket.emit('host:summary_page_change', {
      eventId,
      page,
    });
  };

  const handleRevealAllBottles = () => {
    if (!socket || event?.mode !== 'BLIND' || allWinesRevealed) {
      return;
    }

    setPendingAction('reveal_all');
    setRevealAllConfirmOpen(false);
    socket.emit('host:reveal_all_bottles', { eventId });
  };

  const handleRevealRoundWine = (round: EventRound) => {
    if (
      !socket ||
      event?.mode !== 'BLIND' ||
      round.status !== 'REVEALED' ||
      round.revealedAt !== null
    ) {
      return;
    }

    setPendingAction('reveal_wine');
    socket.emit('host:reveal_bottle', {
      eventId,
      roundId: round.id,
    });
  };

  const handleRemoveParticipant = async () => {
    if (!removeTarget) {
      return;
    }

    setRemovingParticipant(true);

    try {
      await apiClient.events.removeParticipant(
        eventId,
        removeTarget.id,
        keepParticipantRatings,
      );
      setParticipants((current) =>
        current.filter(
          (participant) => participant.id !== removeTarget.id,
        ),
      );
      setRemoveTarget(null);
      setToast({
        message: keepParticipantRatings
          ? 'Участник отключён, его оценки сохранены'
          : 'Участник удалён, его оценки аннулированы',
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
      setRemovingParticipant(false);
    }
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
            {event.status === 'ACTIVE' ? (
              <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 text-xs font-medium text-amber-100">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                Дегустация идёт · выход после завершения
              </span>
            ) : (
              <Link
                href="/host/events"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl px-2 text-sm text-stone-400 transition hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Мероприятия
              </Link>
            )}
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

        {event.status === 'DRAFT' ? (
          <section className="mt-5 rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 sm:p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">
              Подготовка
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Дегустация ещё не начата
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-stone-400">
              Проверьте программу и подключение гостей. После запуска
              пульт будет заблокирован до завершения дегустации.
            </p>
            <button
              type="button"
              data-testid="control-start-event"
              onClick={() => setStartEventConfirmOpen(true)}
              disabled={!canStartEvent}
              className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 text-base font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              {pendingAction === 'event_start' ? (
                <Loader2
                  className="h-5 w-5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Play className="h-5 w-5" aria-hidden="true" />
              )}
              Начать дегустацию
            </button>
          </section>
        ) : null}

        {eventIsActive ? (
          <section
            className={cn(
              'mt-5 rounded-3xl border p-4 sm:p-6',
              allRoundsFinalized
                ? 'border-wine-400/30 bg-wine-500/10'
                : 'border-white/10 bg-white/[0.03]',
            )}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-wine-300">
                  Ход дегустации
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  {allRoundsFinalized
                    ? 'Все образцы раскрыты или пропущены'
                    : 'Дегустация идёт'}
                </h2>
                <p className="mt-2 text-sm text-stone-400">
                  {rounds.filter(
                    (round) =>
                      round.status === 'REVEALED' ||
                      round.status === 'SKIPPED',
                  ).length}{' '}
                  из {rounds.length}{' '}
                  {pluralize(
                    rounds.length,
                    'образца',
                    'образца',
                    'образцов',
                  )}{' '}
                  обработано
                </p>
              </div>
              <button
                type="button"
                data-testid="control-finish-event"
                onClick={() => setFinishEventConfirmOpen(true)}
                disabled={!canFinishEvent}
                className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-wine-600 px-6 text-base font-semibold text-white transition hover:bg-wine-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pendingAction === 'event_finish' ? (
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Flag className="h-5 w-5" aria-hidden="true" />
                )}
                Завершить дегустацию
              </button>
            </div>
          </section>
        ) : null}

        {eventIsFinished ? (
          <section className="mt-5 rounded-3xl border border-sky-400/20 bg-sky-400/[0.06] p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-sky-200">
                  <Award className="h-4 w-4" aria-hidden="true" />
                  Итоги дегустации
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  Дегустация завершена
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-stone-400">
                  Покажите общую статистику всех вин или откройте
                  детальную карточку выбранного образца.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  data-testid="control-show-summary"
                  onClick={handleShowSummary}
                  disabled={pendingAction !== null}
                  className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white px-4 text-sm font-semibold text-stone-950 transition hover:bg-stone-200 disabled:opacity-50"
                >
                  {pendingAction === 'summary' ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Users className="h-4 w-4" aria-hidden="true" />
                  )}
                  Показать общую статистику
                </button>
                {event.mode === 'BLIND' ? (
                  <button
                    type="button"
                    data-testid="control-reveal-all"
                    onClick={() => setRevealAllConfirmOpen(true)}
                    disabled={
                      allWinesRevealed || pendingAction !== null
                    }
                    className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-wine-400/30 bg-wine-500/10 px-4 text-sm font-semibold text-wine-100 transition hover:bg-wine-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pendingAction === 'reveal_all' ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                    {allWinesRevealed
                      ? 'Все вина раскрыты'
                      : 'Раскрыть все вина'}
                  </button>
                ) : null}
              </div>
            </div>

            {summaryItems.length > 9 ? (
              <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-stone-950/30 px-4 py-3">
                <button
                  type="button"
                  onClick={() =>
                    handleSummaryPageChange(summaryPage - 1)
                  }
                  disabled={summaryPage <= 1}
                  aria-label="Предыдущая страница итогов"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-stone-200 transition hover:bg-white/5 disabled:opacity-40"
                >
                  <ChevronLeft
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                </button>
                <span className="text-sm text-stone-300">
                  Страница {summaryPage} из {totalSummaryPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleSummaryPageChange(summaryPage + 1)
                  }
                  disabled={summaryPage >= totalSummaryPages}
                  aria-label="Следующая страница итогов"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-stone-200 transition hover:bg-white/5 disabled:opacity-40"
                >
                  <ChevronRight
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

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
              <div
                key={round.id}
                className={cn(
                  'flex min-h-14 w-full items-center gap-1 rounded-2xl border px-1 py-1 transition',
                  round.id === selectedRoundId
                    ? 'border-wine-400/50 bg-wine-500/10'
                    : 'border-white/10 bg-stone-950/40',
                )}
              >
                <button
                  type="button"
                  onClick={() => handleSelectRound(round)}
                  disabled={
                    roundSelectionLocked &&
                    round.id !== selectedRoundId
                  }
                  className={cn(
                    'flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left transition',
                    roundSelectionLocked &&
                      round.id !== selectedRoundId
                      ? 'cursor-not-allowed opacity-40'
                      : 'hover:bg-white/[0.04]',
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 font-mono text-xs text-stone-300">
                    {String(round.orderNumber).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">
                      {round.blindLabel}
                    </span>
                    {round.blindLabel.trim().toLowerCase() !==
                    round.wine.name.trim().toLowerCase() ? (
                      <span className="mt-0.5 block truncate text-xs text-stone-500">
                        {round.wine.name}
                      </span>
                    ) : null}
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

                {event?.mode === 'BLIND' &&
                round.status === 'REVEALED' ? (
                  <button
                    type="button"
                    data-testid={`control-reveal-round-${round.id}`}
                    onClick={() => handleRevealRoundWine(round)}
                    disabled={
                      round.revealedAt !== null ||
                      pendingAction !== null
                    }
                    className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1 rounded-xl border border-sky-400/25 px-2 text-[11px] font-medium text-sky-100 transition hover:bg-sky-400/10 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    {round.revealedAt !== null
                      ? 'Раскрыто'
                      : 'Раскрыть'}
                  </button>
                ) : null}
              </div>
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
              {selectedRound &&
              selectedRound.blindLabel.trim().toLowerCase() !==
                selectedRound.wine.name.trim().toLowerCase() ? (
                <p className="mt-1 text-sm text-stone-400">
                  {selectedRound.wine.name}
                </p>
              ) : null}
            </div>
            {selectedRound ? (
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="control-prev-round"
                    onClick={() =>
                      currentRoundIndex > 0 &&
                      handleSelectRound(rounds[currentRoundIndex - 1])
                    }
                    disabled={
                      roundNavigationDisabled ||
                      currentRoundIndex <= 0
                    }
                    aria-label="Предыдущий образец"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-stone-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <ChevronLeft
                      className="h-5 w-5"
                      aria-hidden="true"
                    />
                  </button>
                  <span className="min-w-14 text-center font-mono text-xs text-stone-400">
                    {currentRoundIndex + 1} / {rounds.length}
                  </span>
                  <button
                    type="button"
                    data-testid="control-next-round"
                    onClick={() =>
                      currentRoundIndex >= 0 &&
                      currentRoundIndex < rounds.length - 1 &&
                      handleSelectRound(rounds[currentRoundIndex + 1])
                    }
                    disabled={
                      roundNavigationDisabled ||
                      currentRoundIndex < 0 ||
                      currentRoundIndex >= rounds.length - 1
                    }
                    aria-label="Следующий образец"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-stone-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <ChevronRight
                      className="h-5 w-5"
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <span
                  className={cn(
                    'inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium',
                    roundStatusTone(selectedRound.status),
                  )}
                >
                  {ROUND_STATUS_LABELS[selectedRound.status]}
                </span>
              </div>
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
                  Показать статистику образца
                </button>
                {event.mode === 'BLIND' ? (
                  <button
                    type="button"
                    data-testid="control-reveal-wine"
                    onClick={handleRevealWine}
                    disabled={!canRevealWine}
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {pendingAction === 'reveal_wine' ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                    {selectedRound?.revealedAt !== null
                      ? 'Вино раскрыто'
                      : 'Раскрыть вино'}
                  </button>
                ) : null}
                <button
                  type="button"
                  data-testid="control-restart-round"
                  onClick={() =>
                    selectedRound && setRestartTarget(selectedRound)
                  }
                  disabled={!canRestart}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pendingAction === 'restart' ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  )}
                  Начать заново
                </button>
                <button
                  type="button"
                  data-testid="control-skip-round"
                  onClick={() =>
                    selectedRound && setSkipTarget(selectedRound)
                  }
                  disabled={!canSkip}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <SkipForward className="h-4 w-4" aria-hidden="true" />
                  Пропустить вино
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
          ) : selectedRound?.status === 'SKIPPED' ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-stone-950/60 p-5">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-stone-300">
                <SkipForward className="h-4 w-4" aria-hidden="true" />
                Образец пропущен ведущим
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                Гости и экран проектора вернулись в режим ожидания
                следующего раунда. Оценки этого образца удалены.
              </p>
              {eventIsActive ? (
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    data-testid="control-start-skipped"
                    onClick={handleStartRound}
                    disabled={!canStart}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    Запустить раунд
                  </button>
                  <button
                    type="button"
                    data-testid="control-restart-skipped"
                    onClick={() =>
                      selectedRound && setRestartTarget(selectedRound)
                    }
                    disabled={!canRestart}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-400/25 px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Начать заново
                  </button>
                </div>
              ) : null}
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

              {canAddTime ? (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-stone-500">Время:</span>
                  <button
                    type="button"
                    data-testid="control-add-30"
                    onClick={() => handleAddRoundTime(30)}
                    disabled={pendingAction !== null}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs font-medium text-stone-200 transition hover:bg-white/5 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    30 сек
                  </button>
                  <button
                    type="button"
                    data-testid="control-add-60"
                    onClick={() => handleAddRoundTime(60)}
                    disabled={pendingAction !== null}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs font-medium text-stone-200 transition hover:bg-white/5 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    1 мин
                  </button>
                </div>
              ) : null}

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-wine-600 to-wine-300 transition-all duration-500"
                  style={{ width: `${votingProgress}%` }}
                />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {selectedRound?.status === 'ACTIVE' ? (
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
                      <Pause className="h-4 w-4" aria-hidden="true" />
                    )}
                    Пауза
                  </button>
                ) : selectedRound?.status === 'VOTING_CLOSED' ? (
                  <button
                    type="button"
                    data-testid="control-resume-round"
                    onClick={handleResumeRound}
                    disabled={!canResume}
                    title={
                      remainingSeconds <= 0
                        ? 'Добавьте время перед продолжением раунда'
                        : undefined
                    }
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {pendingAction === 'resume' ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Play className="h-4 w-4" aria-hidden="true" />
                    )}
                    Продолжить раунд
                  </button>
                ) : (
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
                )}

                <button
                  type="button"
                  data-testid="control-finish-round"
                  onClick={handleFinishRound}
                  disabled={!canFinishRound}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-wine-600 px-4 text-sm font-semibold text-white transition hover:bg-wine-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pendingAction === 'finish_round' ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Flag className="h-4 w-4" aria-hidden="true" />
                  )}
                  Завершить раунд
                </button>
              </div>

              {selectedRound?.status === 'VOTING_CLOSED' &&
              remainingSeconds <= 0 ? (
                <p className="mt-2 text-xs leading-5 text-amber-200">
                  Время истекло. Добавьте время, чтобы продолжить
                  раунд.
                </p>
              ) : null}

              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  data-testid="control-restart-round-secondary"
                  onClick={() =>
                    selectedRound && setRestartTarget(selectedRound)
                  }
                  disabled={!canRestart}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-400/25 px-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Начать заново
                </button>
                <button
                  type="button"
                  data-testid="control-skip-round"
                  onClick={() =>
                    selectedRound && setSkipTarget(selectedRound)
                  }
                  disabled={!canSkip}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <SkipForward className="h-4 w-4" aria-hidden="true" />
                  Пропустить вино
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
                        {lastReveal.wine?.name ??
                          lastReveal.blindLabel ??
                          'Раунд завершён'}
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

        {eventIsFinished ? (
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
        ) : null}

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Гости
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                Участники дегустации
              </h2>
            </div>
            <p className="text-sm text-stone-400">
              Участники: {participants.length} · В сети:{' '}
              {counts.connectedCount}
            </p>
          </div>

          <div className="relative mt-4">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500"
              aria-hidden="true"
            />
            <input
              data-testid="control-participant-search"
              value={participantSearch}
              onChange={(event) =>
                setParticipantSearch(event.target.value)
              }
              placeholder="Поиск по имени участника…"
              className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none placeholder:text-stone-500 focus:border-wine-400/60 focus:ring-2 focus:ring-wine-500/20"
            />
          </div>

          <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
            {filteredParticipants.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-stone-500">
                {participants.length === 0
                  ? 'Пока никто не присоединился'
                  : 'Участники не найдены'}
              </p>
            ) : (
              filteredParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-stone-950/40 px-3 py-2"
                >
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-wine-200">
                    <UserRound
                      className="h-5 w-5"
                      aria-hidden="true"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-stone-950',
                        participant.isOnline
                          ? 'bg-emerald-400'
                          : 'bg-stone-600',
                      )}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {participant.nickname}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {participant.isOnline
                        ? 'В сети'
                        : 'Не в сети'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setKeepParticipantRatings(false);
                      setRemoveTarget(participant);
                    }}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-rose-400/20 px-3 text-xs font-medium text-rose-200 transition hover:bg-rose-400/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Удалить
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <Modal
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title="Удалить участника?"
        size="sm"
      >
        <p className="text-sm leading-6 text-stone-300">
          Вы уверены, что хотите удалить участника «
          {removeTarget?.nickname ?? ''}» из дегустации? Выберите, что
          сделать с его оценками.
        </p>

        <div className="mt-5 space-y-2">
          <button
            type="button"
            aria-pressed={keepParticipantRatings}
            onClick={() => setKeepParticipantRatings(true)}
            className={cn(
              'w-full rounded-2xl border p-4 text-left transition',
              keepParticipantRatings
                ? 'border-emerald-400/50 bg-emerald-400/10'
                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]',
            )}
          >
            <p className="text-sm font-semibold text-white">
              Сохранить оценки участника
            </p>
            <p className="mt-1 text-xs leading-5 text-stone-400">
              Участник будет отключён от сессии, но его отправленные
              оценки останутся в статистике дегустации.
            </p>
          </button>
          <button
            type="button"
            aria-pressed={!keepParticipantRatings}
            onClick={() => setKeepParticipantRatings(false)}
            className={cn(
              'w-full rounded-2xl border p-4 text-left transition',
              !keepParticipantRatings
                ? 'border-rose-400/50 bg-rose-400/10'
                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]',
            )}
          >
            <p className="text-sm font-semibold text-white">
              Удалить вместе с оценками
            </p>
            <p className="mt-1 text-xs leading-5 text-stone-400">
              Участник будет удалён, а все его оценки в этом
              мероприятии будут аннулированы.
            </p>
          </button>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setRemoveTarget(null)}
            disabled={removingParticipant}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-5 text-sm text-stone-300 transition hover:bg-white/5"
          >
            Отмена
          </button>
          <button
            type="button"
            data-testid="control-remove-participant-confirm"
            onClick={() => void handleRemoveParticipant()}
            disabled={removingParticipant}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
          >
            {removingParticipant ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            )}
            {keepParticipantRatings
              ? 'Отключить участника'
              : 'Удалить участника'}
          </button>
        </div>
      </Modal>

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

      <Modal
        open={revealAllConfirmOpen}
        onClose={() => setRevealAllConfirmOpen(false)}
        title="Раскрыть все вина?"
        size="sm"
      >
        <p className="text-sm leading-6 text-stone-300">
          Вы уверены, что хотите раскрыть все вина дегустации? Названия
          и карточки всех образцов сразу появятся на экране
          демонстрации и у участников.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setRevealAllConfirmOpen(false)}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-5 text-sm text-stone-300 transition hover:bg-white/5"
          >
            Отмена
          </button>
          <button
            type="button"
            data-testid="control-reveal-all-confirm"
            onClick={handleRevealAllBottles}
            disabled={pendingAction !== null}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-wine-600 px-5 text-sm font-semibold text-white transition hover:bg-wine-500 disabled:opacity-50"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Раскрыть все вина
          </button>
        </div>
      </Modal>

      <Modal
        open={startEventConfirmOpen}
        onClose={() => setStartEventConfirmOpen(false)}
        title="Начать дегустацию?"
        size="sm"
      >
        <p className="text-sm leading-6 text-stone-300">
          Вы уверены, что хотите начать дегустацию «{event.title}»? До
          завершения мероприятия переход к другим дегустациям будет
          заблокирован.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setStartEventConfirmOpen(false)}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-5 text-sm text-stone-300 transition hover:bg-white/5"
          >
            Отмена
          </button>
          <button
            type="button"
            data-testid="control-start-event-confirm"
            onClick={() => {
              setStartEventConfirmOpen(false);
              handleStartEvent();
            }}
            disabled={!canStartEvent}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            Начать дегустацию
          </button>
        </div>
      </Modal>

      <Modal
        open={finishEventConfirmOpen}
        onClose={() => setFinishEventConfirmOpen(false)}
        title="Завершить дегустацию?"
        size="sm"
      >
        <p className="text-sm leading-6 text-stone-300">
          Вы уверены, что хотите завершить дегустацию «{event.title}»?
          После завершения вы перейдёте в режим просмотра статистики и
          выгрузки результатов в Народный рейтинг.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setFinishEventConfirmOpen(false)}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-5 text-sm text-stone-300 transition hover:bg-white/5"
          >
            Отмена
          </button>
          <button
            type="button"
            data-testid="control-finish-event-confirm"
            onClick={() => {
              setFinishEventConfirmOpen(false);
              handleFinishEvent();
            }}
            disabled={!canFinishEvent}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-wine-600 px-5 text-sm font-semibold text-white transition hover:bg-wine-500 disabled:opacity-50"
          >
            <Flag className="h-4 w-4" aria-hidden="true" />
            Завершить дегустацию
          </button>
        </div>
      </Modal>

      <Modal
        open={restartTarget !== null}
        onClose={() => setRestartTarget(null)}
        title="Начать раунд заново"
        size="sm"
      >
        <p className="text-sm leading-6 text-stone-300">
          Начать голосование по этому образцу заново? Все текущие
          оценки этого вина будут сброшены.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setRestartTarget(null)}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-5 text-sm text-stone-300 transition hover:bg-white/5"
          >
            Отмена
          </button>
          <button
            type="button"
            data-testid="control-restart-confirm"
            onClick={handleRestartRound}
            disabled={pendingAction !== null}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Начать заново
          </button>
        </div>
      </Modal>

      <Modal
        open={skipTarget !== null}
        onClose={() => setSkipTarget(null)}
        title="Пропустить вино"
        size="sm"
      >
        <p className="text-sm leading-6 text-stone-300">
          Вы точно уверены, что хотите пропустить это вино?
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setSkipTarget(null)}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-5 text-sm text-stone-300 transition hover:bg-white/5"
          >
            Отмена
          </button>
          <button
            type="button"
            data-testid="control-skip-confirm"
            onClick={handleSkipRound}
            disabled={pendingAction !== null}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-semibold text-stone-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            <SkipForward className="h-4 w-4" aria-hidden="true" />
            Да, пропустить
          </button>
        </div>
      </Modal>

      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone ?? 'info'}
        onClose={() => setToast(null)}
      />
    </main>
  );
}
