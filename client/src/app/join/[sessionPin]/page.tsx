'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  Clock3,
  Grape,
  Hash,
  Hourglass,
  Loader2,
  Lock,
  MapPin,
  Send,
  UserRound,
  Wine as WineIcon,
} from 'lucide-react';

import { ConnectionBanner } from '@/components/connection-banner';
import { CriteriaBars } from '@/components/criteria-bars';
import { Modal } from '@/components/modal';
import { PageLoader } from '@/components/page-loader';
import { RadarProfileChart } from '@/components/radar-profile-chart';
import { Toast } from '@/components/toast';
import { WineDetailsCard } from '@/components/wine-details-card';
import { WineImage } from '@/components/wine-image';
import { useTastingSocket } from '@/hooks/use-tasting-socket';
import {
  ApiError,
  apiClient,
  getApiErrorMessage,
} from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  MODE_LABELS,
  SCALE_LABELS,
  WINE_TYPE_LABELS,
  formatCountdown,
  formatPrice,
  pluralize,
} from '@/lib/format';
import {
  AROMA_TAGS,
  ORGANOLEPTIC_SLIDERS,
  PARKER_SLIDERS,
  calculateParkerTotal,
  formatScoreSummary,
  getQualityCategory,
  qualityTone,
} from '@/lib/rating';
import { probeClientNetwork } from '@/lib/network-probe';
import {
  clearGuestSession,
  clearStoredFormDraft,
  clearStoredRating,
  getGuestSession,
  getHardwareProfile,
  getNormalizedScreenResolution,
  getOrCreateDeviceId,
  getStoredRating,
  restoreFormForRound,
  setGuestSession,
  setStoredFormDraft,
  setStoredRating,
  type GuestRoundFormDraft,
} from '@/lib/session';
import type {
  CreateRatingInput,
  EventStatus,
  GuestCurrentRound,
  GuestEventInfo,
  GuestJoinResponse,
  LiveState,
  Organoleptics,
  ParkerBreakdown,
  RatingResponse,
  RevealedWine,
  RoundStats,
  SummaryRoundItem,
} from '@/types/api';
import type {
  AllBottlesRevealedPayload,
  BottleRevealedPayload,
  EventFinishedPayload,
  EventStatusUpdatedPayload,
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

type GuestPhase =
  | 'loading'
  | 'join'
  | 'waiting'
  | 'voting'
  | 'submitted'
  | 'closed'
  | 'revealed'
  | 'event_finished';

const DEFAULT_GUEST_FORM: GuestRoundFormDraft = {
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

type ToastState = {
  message: string;
  tone: 'info' | 'success' | 'error';
} | null;

interface RangeFieldProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function RangeField({
  label,
  hint,
  value,
  min,
  max,
  onChange,
  disabled = false,
}: RangeFieldProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label className="text-sm font-medium text-stone-200">
          {label}
        </label>
        <span className="rounded-lg border border-wine-400/20 bg-wine-500/10 px-2.5 py-1 font-mono text-xs text-wine-100">
          {value} / {max}
        </span>
      </div>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-stone-500">{hint}</p>
      ) : null}
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="range-wine mt-2 w-full"
        aria-label={label}
      />
    </div>
  );
}

export default function GuestJoinPage() {
  const params = useParams<{ sessionPin: string }>();
  const rawPin = params?.sessionPin;
  const sessionPin = Array.isArray(rawPin)
    ? (rawPin[0] ?? '')
    : (rawPin ?? '');

  const [phase, setPhase] = useState<GuestPhase>('loading');
  const [nickname, setNickname] = useState('');
  const [screenResolution, setScreenResolution] = useState('');
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [sessionEventId, setSessionEventId] = useState<string | null>(
    null,
  );
  const [eventInfo, setEventInfo] = useState<GuestEventInfo | null>(
    null,
  );
  const [currentRound, setCurrentRound] =
    useState<GuestCurrentRound | null>(null);
  const [eventStatus, setEventStatus] =
    useState<EventStatus>('DRAFT');
  const [wine, setWine] = useState<RevealedWine | null>(null);
  const [stats, setStats] = useState<RoundStats | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedRemainingSeconds, setPausedRemainingSeconds] =
    useState(0);
  const [now, setNow] = useState(Date.now());
  const [waitingMessage, setWaitingMessage] = useState<string | null>(
    null,
  );
  const [removedMessage, setRemovedMessage] = useState<string | null>(
    null,
  );
  const [summaryItems, setSummaryItems] = useState<
    SummaryRoundItem[]
  >([]);
  const activeRoundIdRef = useRef<string | null>(null);
  const [ownRating, setOwnRating] =
    useState<RatingResponse | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(
    null,
  );
  const [toast, setToast] = useState<ToastState>(null);
  const autoJoinRef = useRef(false);
  const identityRefreshConnectRef = useRef(-1);

  const [parker, setParker] = useState<ParkerBreakdown>({
    appearance: 3,
    aroma: 9,
    taste: 12,
    potential: 6,
  });
  const [organoleptics, setOrganoleptics] =
    useState<Organoleptics>({
      sweetness: 5,
      acidity: 5,
      tannins: 5,
      body: 5,
      aromaIntensity: 5,
    });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const {
    socket,
    connected,
    hasConnected,
    connectionError,
    connectCount,
  } = useTastingSocket(guestToken);

  useEffect(() => {
    activeRoundIdRef.current = currentRound?.roundId ?? null;
  }, [currentRound?.roundId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const roundId = currentRound?.roundId;

    if (
      !roundId ||
      (phase !== 'voting' && phase !== 'submitted')
    ) {
      return;
    }

    setStoredFormDraft(roundId, {
      parker,
      organoleptics,
      selectedTags,
      notes,
    });
  }, [
    currentRound?.roundId,
    phase,
    parker,
    organoleptics,
    selectedTags,
    notes,
  ]);

  const applyFormDraft = (draft: GuestRoundFormDraft): void => {
    setParker(draft.parker);
    setOrganoleptics(draft.organoleptics);
    setSelectedTags(draft.selectedTags);
    setNotes(draft.notes);
    setSubmitError(null);
  };

  const hydrateStats = async (
    roundId: string,
    token: string,
  ): Promise<RoundStats | null> => {
    return apiClient.ratings
      .stats(roundId, { guestToken: token })
      .catch(() => null);
  };

  const loadGuestSummary = async (
    targetEventId: string,
    token: string,
  ) => {
    const summary = await apiClient.events
      .summary(targetEventId, token)
      .catch(() => null);

    if (summary) {
      setSummaryItems(summary.items);
    }
  };

  const hydrateEvent = async (
    info: GuestEventInfo,
    token: string,
    status?: EventStatus,
  ) => {
    setEventInfo(info);
    setSessionEventId(info.eventId);
    setWine(null);
    setStats(null);
    setSubmitError(null);
    setWaitingMessage(null);

    if (status) {
      setEventStatus(status);
    }

    const round = info.currentRound;

    if (status === 'FINISHED' || status === 'EXPORTED') {
      setCurrentRound(round);
      setOwnRating(round ? getStoredRating(round.roundId) : null);
      setStats(null);
      setEndsAt(null);
      setPausedRemainingSeconds(0);
      setPhase('event_finished');
      return;
    }

    if (!round) {
      setCurrentRound(null);
      setOwnRating(null);
      setEndsAt(null);
      setPausedRemainingSeconds(0);
      setPhase('waiting');
      return;
    }

    setCurrentRound(round);
    setPausedRemainingSeconds(round.remainingSeconds);
    const savedRating = getStoredRating(round.roundId);
    setOwnRating(savedRating);

    if (round.status === 'REVEALED') {
      const roundStats = await hydrateStats(round.roundId, token);
      setStats(roundStats);
      setWine(round.wine ?? null);
      setEndsAt(null);
      setPausedRemainingSeconds(0);
      setPhase('revealed');
      return;
    }

    if (round.status === 'ACTIVE') {
      if (round.wine) {
        setWine(round.wine);
      }
      applyFormDraft(restoreFormForRound(round.roundId));
      setEndsAt(
        new Date(
          Date.now() + round.remainingSeconds * 1000,
        ).getTime(),
      );
      setPhase(savedRating ? 'submitted' : 'voting');
      return;
    }

    if (round.status === 'VOTING_CLOSED') {
      if (round.wine) {
        setWine(round.wine);
      }
      setEndsAt(null);
      setPhase('closed');
      return;
    }

    if (round.status === 'SKIPPED') {
      setWine(null);
      setEndsAt(null);
      setPausedRemainingSeconds(0);
      setWaitingMessage('Образец пропущен. Ожидание следующего раунда…');
      setPhase('waiting');
      return;
    }

    setEndsAt(null);
    setPausedRemainingSeconds(0);
    setPhase('waiting');
  };

  const hydrateLiveState = async (
    live: LiveState,
    token: string,
  ) => {
    const info: GuestEventInfo = {
      eventId: live.eventId,
      title: live.title,
      mode: live.mode,
      scaleType: live.scaleType,
      currentRound: live.currentRound
        ? {
            roundId: live.currentRound.roundId,
            orderNumber: live.currentRound.orderNumber,
            blindLabel: live.currentRound.blindLabel,
            status: live.currentRound.status,
            durationSeconds: live.currentRound.durationSeconds,
            remainingSeconds: live.currentRound.remainingSeconds,
            isWineRevealed: live.currentRound.isWineRevealed,
            wine: live.currentRound.wine,
          }
        : null,
    };

    await hydrateEvent(info, token, live.status);

    if (
      live.status === 'FINISHED' ||
      live.status === 'EXPORTED'
    ) {
      await loadGuestSummary(live.eventId, token);
    }
  };

  const joinSession = async (
    nicknameValue: string,
    preserveOnNetworkError = false,
  ) => {
    const trimmedNickname = nicknameValue.trim();

    if (!trimmedNickname) {
      setJoinError('Укажите имя или номер места');
      setPhase('join');
      return;
    }

    if (!/^\d{6}$/.test(sessionPin)) {
      setJoinError('PIN-код должен состоять из 6 цифр');
      setPhase('join');
      return;
    }

    setJoining(true);
    setJoinError(null);

    try {
      const hardware = getHardwareProfile();
      const network = await probeClientNetwork();
      const response: GuestJoinResponse =
        await apiClient.auth.guestJoin({
          sessionPin,
          nickname: trimmedNickname,
          screenResolution: hardware.screenResolution,
          deviceId: getOrCreateDeviceId(),
          pixelRatio: hardware.pixelRatio,
          colorDepth: hardware.colorDepth,
          timeZone: hardware.timeZone,
          osFamily: hardware.osFamily,
          maxTouchPoints: hardware.maxTouchPoints,
          httpPublicIp: network.httpPublicIp,
          webrtcPublicIp: network.webrtcPublicIp,
          webrtcLocalIps: network.webrtcLocalIps,
          vpnSuspectedByWebrtc: network.vpnSuspectedByWebrtc,
        });

      setNickname(trimmedNickname);
      setGuestToken(response.guestSessionToken);
      setSessionEventId(response.event.eventId);
      setGuestSession(sessionPin, {
        token: response.guestSessionToken,
        nickname: trimmedNickname,
        participantId: response.participantId,
        eventId: response.event.eventId,
      });
      await hydrateEvent(response.event, response.guestSessionToken);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : null;
      const isNetworkError =
        !(error instanceof ApiError) ||
        error.status === 0 ||
        error.status >= 500;
      const hasStoredSession = Boolean(
        getGuestSession(sessionPin),
      );

      if (preserveOnNetworkError && isNetworkError) {
        setJoinError(null);
        setWaitingMessage(
          'Восстанавливаем подключение к дегустации…',
        );
        setPhase('waiting');
        return;
      }

      if (
        (guestToken || hasStoredSession) &&
        (status === 401 || status === 403 || status === 404)
      ) {
        clearGuestSession(sessionPin);
        setGuestToken(null);
        setRemovedMessage(
          'Вы были удалены организатором из текущей дегустации.',
        );
        return;
      }

      setJoinError(getApiErrorMessage(error));
      setPhase('join');
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    if (autoJoinRef.current) {
      return;
    }

    autoJoinRef.current = true;
    const resolution = getNormalizedScreenResolution();

    setScreenResolution(resolution);
    const stored = getGuestSession(sessionPin);

    if (stored) {
      setNickname(stored.nickname);
      setGuestToken(stored.token);
      setSessionEventId(stored.eventId ?? null);
      setPhase('loading');

      if (!stored.eventId) {
        void joinSession(stored.nickname, true);
      }
    } else {
      setPhase('join');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPin]);

  useEffect(() => {
    if (
      !socket ||
      !guestToken ||
      sessionEventId ||
      connectCount === 0 ||
      joining
    ) {
      return;
    }

    const stored = getGuestSession(sessionPin);

    if (!stored) {
      return;
    }

    if (identityRefreshConnectRef.current === connectCount) {
      return;
    }

    identityRefreshConnectRef.current = connectCount;
    void joinSession(stored.nickname, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    socket,
    connectCount,
    guestToken,
    sessionEventId,
    joining,
    sessionPin,
  ]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleRoundStarted = (payload: RoundStartedPayload) => {
      const nextRound: GuestCurrentRound = {
        roundId: payload.roundId,
        orderNumber: payload.orderNumber,
        blindLabel: payload.blindLabel,
        status: 'ACTIVE',
        durationSeconds: payload.durationSeconds,
        remainingSeconds: payload.remainingSeconds,
        isWineRevealed: Boolean(payload.wine),
        wine: payload.wine,
      };

      if (payload.resetRatings) {
        clearStoredRating(payload.roundId);
        clearStoredFormDraft(payload.roundId);
      }

      const savedRating = payload.resetRatings
        ? null
        : getStoredRating(payload.roundId);

      setEventStatus('ACTIVE');
      setCurrentRound(nextRound);
      setWine(payload.wine ?? null);
      setStats(null);
      setSubmitError(null);
      setWaitingMessage(null);
      setOwnRating(savedRating);
      applyFormDraft(
        payload.resetRatings
          ? DEFAULT_GUEST_FORM
          : restoreFormForRound(payload.roundId),
      );
      setEndsAt(new Date(payload.endsAt).getTime());
      setPausedRemainingSeconds(payload.remainingSeconds);
      setPhase(savedRating ? 'submitted' : 'voting');
      setToast({
        message: payload.resetRatings
          ? 'Раунд начат заново. Оценки этого образца сброшены.'
          : payload.isResumed
            ? 'Голосование по образцу продолжено'
            : 'Сомелье запустил новый раунд',
        tone: 'info',
      });
    };

    const handleVotingClosed = (payload: VotingClosedPayload) => {
      setCurrentRound((round) =>
        round && round.roundId === payload.roundId
          ? {
              ...round,
              status: 'VOTING_CLOSED',
              durationSeconds: Math.max(
                1,
                payload.remainingSeconds,
              ),
              remainingSeconds: payload.remainingSeconds,
            }
          : round,
      );
      setEndsAt(null);
      setPausedRemainingSeconds(payload.remainingSeconds);
      setPhase((current) =>
        current === 'voting' || current === 'submitted'
          ? 'closed'
          : current,
      );
      setToast({ message: payload.message, tone: 'info' });
    };

    const handleRoundTimerUpdated = (
      payload: RoundTimerUpdatedPayload,
    ) => {
      if (activeRoundIdRef.current !== payload.roundId) {
        return;
      }

      setCurrentRound((round) =>
        round && round.roundId === payload.roundId
          ? {
              ...round,
              durationSeconds: payload.durationSeconds,
              remainingSeconds: payload.remainingSeconds,
            }
          : round,
      );
      setPausedRemainingSeconds(payload.remainingSeconds);
      setEndsAt(
        payload.status === 'ACTIVE' && payload.endsAt
          ? new Date(payload.endsAt).getTime()
          : null,
      );
      setToast({
        message: 'Сомелье добавил время раунда',
        tone: 'info',
      });
    };

    const handleRoundSkipped = (payload: RoundSkippedPayload) => {
      if (activeRoundIdRef.current !== payload.roundId) {
        return;
      }

      setWine(null);
      setStats(null);
      setEndsAt(null);
      setWaitingMessage(
        'Образец пропущен. Ожидание следующего раунда…',
      );
      setPhase('waiting');
      setCurrentRound((round) =>
        round && round.roundId === payload.roundId
          ? { ...round, status: 'SKIPPED' }
          : round,
      );
      setToast({ message: payload.message, tone: 'info' });
    };

    const handleEventStatusUpdated = (
      payload: EventStatusUpdatedPayload,
    ) => {
      if (payload.eventId !== eventInfo?.eventId) {
        return;
      }

      setEventStatus(payload.status);

      if (
        payload.status === 'FINISHED' ||
        payload.status === 'EXPORTED'
      ) {
        setEndsAt(null);
        setWaitingMessage(null);
        setPhase('event_finished');
      }
    };

    const handleEventFinished = (payload: EventFinishedPayload) => {
      if (payload.eventId !== eventInfo?.eventId) {
        return;
      }

      setEventStatus(payload.status);
      setEndsAt(null);
      setWaitingMessage(null);
      setPhase('event_finished');
      void loadGuestSummary(payload.eventId, guestToken ?? '').catch(
        () => undefined,
      );
      setToast({ message: payload.message, tone: 'success' });
    };

    const applyCompletedRound = (
      payload: BottleRevealedPayload | RoundCompletedPayload,
    ) => {
      setCurrentRound((round) => ({
        roundId: payload.roundId,
        orderNumber:
          payload.orderNumber ?? round?.orderNumber ?? 0,
        blindLabel:
          payload.blindLabel ??
          round?.blindLabel ??
          'Образец',
        status: 'REVEALED',
        durationSeconds: round?.durationSeconds ?? 0,
        remainingSeconds: 0,
        isWineRevealed: payload.isWineRevealed,
        wine: payload.wine ?? undefined,
      }));
      setWine(payload.wine);
      setStats(payload.stats);
      setOwnRating(getStoredRating(payload.roundId));
      setEndsAt(null);
      setPausedRemainingSeconds(0);
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
                stats: {
                  totalRatings: payload.stats.totalRatings,
                  validVotesCount: payload.stats.validVotesCount,
                  outliersRemovedCount:
                    payload.stats.outliersRemovedCount,
                  meanScore: payload.stats.meanScore,
                  medianScore: payload.stats.medianScore,
                  qualityCategory: payload.stats.qualityCategory,
                  qualityLabel: payload.stats.qualityLabel,
                },
              }
            : item,
        ),
      );
      setPhase((current) => {
        if (payload.reason === 'stats') {
          return 'revealed';
        }

        return current === 'event_finished' ? current : 'revealed';
      });
      setToast({
        message: payload.isWineRevealed
          ? 'Карточка образца раскрыта!'
          : 'Раунд завершён. Статистика готова.',
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

    const handleSummaryStatsShown = (
      payload: SummaryStatsShownPayload,
    ) => {
      if (payload.eventId !== eventInfo?.eventId) {
        return;
      }

      setSummaryItems(payload.items);
      setPhase('event_finished');
    };

    const handleSummaryPageChanged = (
      _payload: SummaryPageChangedPayload,
    ) => {
      // Guests always receive the full vertical summary list.
    };

    const handleAllBottlesRevealed = (
      payload: AllBottlesRevealedPayload,
    ) => {
      if (payload.eventId !== eventInfo?.eventId) {
        return;
      }

      setSummaryItems(payload.items);
      setPhase('event_finished');
      setToast({
        message: 'Сомелье раскрыл все вина дегустации',
        tone: 'success',
      });
    };

    const handleRoundStatsUpdated = (
      payload: RoundStatsUpdatedPayload,
    ) => {
      if (
        payload.eventId === eventInfo?.eventId &&
        (activeRoundIdRef.current === payload.roundId ||
          currentRound?.roundId === payload.roundId)
      ) {
        setStats(payload.stats);
      }
    };

    const handleParticipantRemoved = (payload: {
      eventId: string;
      participantId: string;
      message: string;
    }) => {
      if (payload.eventId !== eventInfo?.eventId) {
        return;
      }

      clearGuestSession(sessionPin);
      setGuestToken(null);
      setRemovedMessage(payload.message);
      socket.disconnect();
    };

    const handleError = (payload: SocketMessagePayload) => {
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
    socket.on('participant_removed', handleParticipantRemoved);
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
      socket.off('participant_removed', handleParticipantRemoved);
      socket.off('round_stats_updated', handleRoundStatsUpdated);
      socket.off('summary_stats_shown', handleSummaryStatsShown);
      socket.off('summary_page_changed', handleSummaryPageChanged);
      socket.off('all_bottles_revealed', handleAllBottlesRevealed);
      socket.off('session_error', handleError);
      socket.off('auth_error', handleError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, eventInfo?.eventId, sessionPin]);

  useEffect(() => {
    if (!guestToken || !sessionEventId) {
      return;
    }

    let cancelled = false;

    apiClient.events
      .liveState(sessionEventId, guestToken)
      .then(async (live) => {
        if (!cancelled) {
          await hydrateLiveState(live, guestToken);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (
          error instanceof ApiError &&
          (error.status === 401 ||
            error.status === 403 ||
            error.status === 404)
        ) {
          clearGuestSession(sessionPin);
          setGuestToken(null);
          setRemovedMessage(
            'Вы были удалены организатором из текущей дегустации.',
          );
          socket?.disconnect();
          return;
        }

        setWaitingMessage(
          'Соединение потеряно. Переподключаемся…',
        );
        setPhase((current) =>
          current === 'loading' ? 'waiting' : current,
        );
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    socket,
    connectCount,
    guestToken,
    sessionEventId,
    sessionPin,
  ]);

  const handleJoinSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!screenResolution) {
      setScreenResolution(getNormalizedScreenResolution());
    }

    await joinSession(nickname);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  };

  const handleSubmitRating = async () => {
    if (
      !guestToken ||
      !currentRound ||
      currentRound.status !== 'ACTIVE' ||
      phase !== 'voting' ||
      !eventInfo
    ) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const payload: CreateRatingInput = {
      parkerBreakdown: parker,
      organoleptics,
      aromaTags: selectedTags,
      personalNotes: notes.trim() || undefined,
    };

    setStoredFormDraft(currentRound.roundId, {
      parker,
      organoleptics,
      selectedTags,
      notes,
    });

    try {
      const response = await apiClient.ratings.submit(
        currentRound.roundId,
        payload,
        guestToken,
      );

      setOwnRating(response);
      setStoredRating(currentRound.roundId, response);
      setPhase('submitted');
      setToast({
        message: 'Ваш голос принят!',
        tone: 'success',
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setPhase('submitted');
        } else if (error.status === 423) {
          setCurrentRound((round) =>
            round
              ? { ...round, status: 'VOTING_CLOSED' }
              : round,
          );
          setPhase('closed');
        }
      }

      setSubmitError(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const liveTotal = calculateParkerTotal(parker);
  const liveCategory = getQualityCategory(liveTotal);
  const currentRoundNumber = currentRound?.orderNumber ?? 0;
  const storedPersonalNotes =
    ownRating?.personalNotes?.trim() ?? '';
  const draftPersonalNotes =
    !storedPersonalNotes && currentRound
      ? restoreFormForRound(currentRound.roundId).notes.trim()
      : '';
  const revealedPersonalNotes =
    storedPersonalNotes || draftPersonalNotes;
  const remainingSeconds =
    currentRound?.status === 'ACTIVE' && endsAt
      ? Math.max(0, Math.ceil((endsAt - now) / 1000))
      : pausedRemainingSeconds;

  if (phase === 'loading') {
    return <PageLoader message="Ищем вашу дегустацию…" />;
  }

  if (phase === 'join') {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-stone-950 px-5 py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(159,18,57,0.35),transparent_55%)]"
        />
        <div className="relative w-full max-w-md">
          <Link
            href="/"
            className="mb-6 inline-flex min-h-12 items-center gap-2 rounded-xl px-2 text-sm text-stone-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            На главную
          </Link>

          <div className="rounded-3xl border border-white/10 bg-stone-950/85 p-6 shadow-2xl backdrop-blur sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-wine-400/25 bg-wine-500/10 text-wine-300">
                <WineIcon className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-wine-300">
                  Дегустация
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                  Присоединиться
                </h1>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <span className="inline-flex items-center gap-2 text-sm text-stone-400">
                <Hash className="h-4 w-4" aria-hidden="true" />
                PIN сессии
              </span>
              <span className="font-mono text-2xl font-semibold tracking-[0.25em] text-white">
                {sessionPin}
              </span>
            </div>

            <form onSubmit={handleJoinSubmit} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="guest-nickname"
                  className="mb-2 block text-sm font-medium text-stone-300"
                >
                  Ваше имя или номер места
                </label>
                <div className="relative">
                  <UserRound
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500"
                    aria-hidden="true"
                  />
                  <input
                    id="guest-nickname"
                    data-testid="guest-nickname"
                    value={nickname}
                    onChange={(event) =>
                      setNickname(event.target.value)
                    }
                    placeholder="Алексей (Стол №3)"
                    maxLength={80}
                    className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-base text-white outline-none placeholder:text-stone-500 focus:border-wine-400/60 focus:ring-2 focus:ring-wine-500/20"
                  />
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  Экран устройства: {screenResolution || 'определяется…'}
                </p>
              </div>

              {joinError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
                >
                  {joinError}
                </p>
              ) : null}

              <button
                type="submit"
                data-testid="guest-join-submit"
                disabled={joining}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-wine-600 px-5 text-base font-semibold text-white transition hover:bg-wine-500 disabled:opacity-60"
              >
                {joining ? (
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <WineIcon
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                )}
                {joining ? 'Подключаемся…' : 'Войти в дегустацию'}
              </button>
            </form>

            <p className="mt-5 text-center text-xs leading-5 text-stone-500">
              Имя нужно сомелье, чтобы связать оценки с вашим местом.
              Пароль не требуется.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const eventTitle = eventInfo?.title ?? 'Дегустация';
  const phaseMeta = eventInfo
    ? `${MODE_LABELS[eventInfo.mode]} · ${SCALE_LABELS[eventInfo.scaleType]}`
    : '';

  return (
    <main className="min-h-screen bg-stone-950 pb-16">
      <div className="mx-auto w-full max-w-xl px-4 pt-4 sm:px-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-wine-950/60 via-stone-900/70 to-stone-950 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] text-stone-500">
                <WineIcon
                  className="h-3.5 w-3.5 text-wine-300"
                  aria-hidden="true"
                />
                {phaseMeta}
              </div>
              <h1 className="mt-2 truncate text-xl font-semibold tracking-tight text-white">
                {eventTitle}
              </h1>
              <p className="mt-1 text-xs text-stone-500">
                {nickname}
                {eventStatus === 'FINISHED' ||
                eventStatus === 'EXPORTED'
                  ? ' · дегустация завершена'
                  : ''}
              </p>
            </div>
            <span className="shrink-0 rounded-xl border border-white/10 px-3 py-2 font-mono text-sm tracking-[0.15em] text-stone-300">
              {sessionPin}
            </span>
          </div>

          {currentRound ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-wine-400/25 bg-wine-500/10 px-3 py-1 text-xs text-wine-200">
                {currentRound.blindLabel}
              </span>
              {currentRound.status === 'ACTIVE' ? (
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                  Раунд идёт
                </span>
              ) : currentRound.status === 'VOTING_CLOSED' ? (
                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
                  Голосование закрыто
                </span>
              ) : currentRound.status === 'REVEALED' ? (
                <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-xs text-sky-200">
                  Образец раскрыт
                </span>
              ) : currentRound.status === 'SKIPPED' ? (
                <span className="rounded-full border border-stone-500/30 bg-stone-500/10 px-3 py-1 text-xs text-stone-400">
                  Пропущен
                </span>
              ) : null}
              {currentRound.status === 'ACTIVE' ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 font-mono text-xs text-stone-300">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatCountdown(remainingSeconds)}
                </span>
              ) : null}
            </div>
          ) : null}
        </header>

        <div className="mt-3">
          <ConnectionBanner
            connected={connected}
            hasConnected={hasConnected}
            error={connectionError}
          />
        </div>

        {phase === 'waiting' ? (
          <section className="mt-5 flex min-h-[60vh] flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-wine-400/20 bg-wine-500/10 text-wine-300">
              <Hourglass className="h-10 w-10" aria-hidden="true" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white">
              {waitingMessage ?? 'Ожидание запуска раунда сомелье…'}
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-stone-400">
              Экран обновится автоматически, когда ведущий откроет
              следующий образец. Оставьте эту страницу открытой.
            </p>
            {currentRound ? (
              <p className="mt-5 font-mono text-xs text-stone-500">
                {currentRound.blindLabel}
              </p>
            ) : null}
          </section>
        ) : null}

        {(phase === 'submitted' || phase === 'closed') ? (
          <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
            <div
              className={cn(
                'mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border',
                phase === 'submitted'
                  ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                  : 'border-amber-400/25 bg-amber-400/10 text-amber-300',
              )}
            >
              {phase === 'submitted' ? (
                <CheckCircle2
                  className="h-10 w-10"
                  aria-hidden="true"
                />
              ) : (
                <Lock className="h-10 w-10" aria-hidden="true" />
              )}
            </div>
            <h2
              data-testid={
                phase === 'submitted'
                  ? 'guest-vote-accepted'
                  : undefined
              }
              className="mt-6 text-2xl font-semibold tracking-tight text-white"
            >
              {phase === 'submitted'
                ? 'Ваш голос принят!'
                : 'Приём оценок закрыт'}
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-stone-400">
              {phase === 'submitted'
                ? 'Ожидание раскрытия карты ведущим…'
                : 'Ведущий приостановил приём оценок по этому образцу. Ожидайте продолжения или раскрытия карты.'}
            </p>

            {eventInfo?.mode === 'OPEN' && wine ? (
              <div className="mt-6 text-left">
                <WineDetailsCard wine={wine} />
              </div>
            ) : null}

            {ownRating ? (
              <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-white/10 bg-stone-950/50 p-4 text-left">
                <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">
                  Ваша оценка
                </p>
                <p className="mt-1 text-2xl font-semibold text-wine-200">
                  {ownRating.totalScore.toLocaleString('ru-RU', {
                    maximumFractionDigits: 1,
                  })}{' '}
                  {pluralize(
                    Math.round(ownRating.totalScore),
                    'балл',
                    'балла',
                    'баллов',
                  )}
                </p>
                <p className="mt-1 text-sm text-stone-400">
                  {ownRating.qualityLabel}
                </p>
              </div>
            ) : null}

            {phase === 'submitted' &&
            currentRound?.status === 'ACTIVE' ? (
              <button
                type="button"
                data-testid="guest-edit-rating"
                onClick={() => {
                  if (!currentRound) {
                    return;
                  }

                  applyFormDraft(
                    restoreFormForRound(currentRound.roundId),
                  );
                  setPhase('voting');
                }}
                className="mx-auto mt-5 inline-flex min-h-12 items-center justify-center rounded-xl border border-wine-400/30 bg-wine-500/10 px-5 text-sm font-semibold text-wine-100 transition hover:bg-wine-500/20"
              >
                Изменить оценку
              </button>
            ) : null}

            {submitError ? (
              <p
                role="alert"
                className="mx-auto mt-5 max-w-sm rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
              >
                {submitError}
              </p>
            ) : null}
          </section>
        ) : null}

        {phase === 'voting' && currentRound && eventInfo ? (
          <div className="mt-5 space-y-5">
            {eventInfo.mode === 'OPEN' && wine ? (
              <WineDetailsCard wine={wine} />
            ) : null}
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-wine-300">
                    {currentRound.blindLabel}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white">
                    Оцените образец
                  </h2>
                </div>
                <span className="inline-flex min-h-9 items-center rounded-full border border-white/10 px-3 text-xs text-stone-400">
                  Раунд {currentRoundNumber}
                </span>
              </div>

              <div className="mt-5 rounded-2xl border border-wine-400/20 bg-wine-500/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-wine-300">
                      Базовые баллы
                    </p>
                    <p className="mt-1 text-3xl font-semibold text-wine-100">
                      50
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">
                      Ваш итог
                    </p>
                    <p
                      key={liveTotal}
                      data-testid="guest-total-score"
                      className="mt-1 animate-score-pop text-3xl font-semibold text-white motion-reduce:animate-none"
                    >
                      {liveTotal.toLocaleString('ru-RU', {
                        maximumFractionDigits: 1,
                      })}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'mt-3 inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium',
                    qualityTone(liveCategory),
                  )}
                >
                  {formatScoreSummary(liveTotal)}
                </span>
              </div>

              <div className="mt-6 space-y-6">
                {PARKER_SLIDERS.map((slider) => (
                  <RangeField
                    key={slider.key}
                    label={slider.label}
                    hint={slider.hint}
                    value={parker[slider.key]}
                    min={0}
                    max={slider.max}
                    onChange={(value) =>
                      setParker((current) => ({
                        ...current,
                        [slider.key]: value,
                      }))
                    }
                  />
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold text-white">
                Органолептический профиль
              </h2>
              <div className="mt-5 space-y-6">
                {ORGANOLEPTIC_SLIDERS.map((slider) => (
                  <RangeField
                    key={slider.key}
                    label={slider.label}
                    value={organoleptics[slider.key]}
                    min={1}
                    max={10}
                    onChange={(value) =>
                      setOrganoleptics((current) => ({
                        ...current,
                        [slider.key]: value,
                      }))
                    }
                  />
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold text-white">
                Ароматические дескрипторы
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                Отметьте всё, что чувствуете в бокале.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {AROMA_TAGS.map((tag) => {
                  const selected = selectedTags.includes(tag);

                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        'inline-flex min-h-12 items-center gap-2 rounded-full border px-4 text-sm transition',
                        selected
                          ? 'border-wine-400/50 bg-wine-500/20 text-wine-100'
                          : 'border-white/10 bg-white/[0.03] text-stone-400 hover:bg-white/[0.06]',
                      )}
                    >
                      {selected ? (
                        <Check
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                      ) : null}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <label
                htmlFor="guest-notes"
                className="text-sm font-medium text-stone-200"
              >
                Заметки о вине
              </label>
              <textarea
                id="guest-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Что запомнилось в аромате и вкусе?"
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-stone-950/60 px-4 py-3 text-base text-white outline-none placeholder:text-stone-600 focus:border-wine-400/50"
              />
            </section>

            {submitError ? (
              <p
                role="alert"
                className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
              >
                {submitError}
              </p>
            ) : null}

            <button
              type="button"
              data-testid="guest-submit-rating"
              onClick={() => void handleSubmitRating()}
              disabled={
                submitting || currentRound.status !== 'ACTIVE'
              }
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-wine-600 px-5 text-base font-semibold text-white transition hover:bg-wine-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <Loader2
                  className="h-5 w-5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Send className="h-5 w-5" aria-hidden="true" />
              )}
              {submitting
                ? 'Отправляем оценку…'
                : 'Отправить оценку'}
            </button>
          </div>
        ) : null}

        {phase === 'event_finished' ? (
          <section className="mt-5 overflow-hidden rounded-3xl border border-wine-400/25 bg-gradient-to-br from-wine-950/70 via-stone-900/70 to-stone-950 px-5 py-8 sm:px-6">
            <div className="text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-wine-400/30 bg-wine-500/15 text-wine-200">
                <Award className="h-10 w-10" aria-hidden="true" />
              </div>
              <p className="mt-5 text-xs uppercase tracking-[0.22em] text-wine-300">
                {eventInfo?.title ?? 'Дегустация'}
              </p>
              <h2
                data-testid="guest-event-finished"
                className="mt-2 text-balance text-3xl font-semibold tracking-tight text-white"
              >
                Дегустация завершена!
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-stone-400">
                Итоги всех образцов обновляются в реальном времени.
              </p>
            </div>

            {summaryItems.length === 0 ? (
              <p className="mx-auto mt-6 max-w-sm rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-stone-500">
                Сомелье готовит итоговую статистику…
              </p>
            ) : (
              <div className="mt-6 space-y-3 text-left">
                {summaryItems.map((item) => {
                  const revealed = item.isWineRevealed
                    ? item.wine
                    : null;
                  const storedRating = getStoredRating(
                    item.roundId,
                  );

                  return (
                    <article
                      key={item.roundId}
                      className="rounded-2xl border border-white/10 bg-stone-950/45 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-wine-500/10 text-wine-300">
                          {revealed ? (
                            <WineImage
                              src={revealed.imageUrl}
                              alt={revealed.name}
                              iconClassName="h-7 w-7"
                            />
                          ) : (
                            <WineIcon
                              className="h-8 w-8"
                              strokeWidth={1.2}
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-stone-500">
                            {revealed
                              ? `${WINE_TYPE_LABELS[revealed.wineType]} · ${revealed.vintage}`
                              : 'Слепой образец · не раскрыт'}
                          </p>
                          <h3 className="mt-1 text-lg font-semibold text-white">
                            {revealed?.name ?? item.blindLabel}
                          </h3>
                          {revealed ? (
                            <p className="text-xs text-wine-200">
                              {revealed.winery}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-2xl font-semibold text-wine-200">
                            {item.stats.meanScore !== null
                              ? item.stats.meanScore.toLocaleString(
                                  'ru-RU',
                                  { maximumFractionDigits: 1 },
                                )
                              : '—'}
                          </p>
                          <span
                            className={cn(
                              'mt-1 inline-flex max-w-32 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                              qualityTone(
                                item.stats.qualityCategory,
                              ),
                            )}
                          >
                            {item.stats.qualityLabel ??
                              'Без категории'}
                          </span>
                        </div>
                      </div>

                      {revealed ? (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-stone-400">
                          <p>
                            <span className="text-stone-500">
                              Регион:{' '}
                            </span>
                            {revealed.region}
                          </p>
                          <p>
                            <span className="text-stone-500">
                              Сорта:{' '}
                            </span>
                            {revealed.grapeVarieties}
                          </p>
                          <p>
                            <span className="text-stone-500">
                              Цена:{' '}
                            </span>
                            {formatPrice(revealed.retailPrice)}
                          </p>
                          <p>
                            <span className="text-stone-500">
                              Голосов:{' '}
                            </span>
                            {item.stats.validVotesCount}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs leading-5 text-stone-500">
                          Название появится после раскрытия вина.
                        </p>
                      )}

                      {storedRating ? (
                        <p className="mt-3 rounded-xl border border-wine-400/15 bg-wine-500/[0.07] px-3 py-2 text-xs text-wine-100">
                          Ваша оценка:{' '}
                          {storedRating.totalScore.toLocaleString(
                            'ru-RU',
                            { maximumFractionDigits: 1 },
                          )}{' '}
                          · {storedRating.qualityLabel}
                        </p>
                      ) : null}

                      {(() => {
                        const notes =
                          storedRating?.personalNotes?.trim() ||
                          restoreFormForRound(item.roundId).notes.trim();

                        return notes ? (
                          <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-stone-500">
                              Ваши заметки
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-stone-300">
                              {notes}
                            </p>
                          </div>
                        ) : null;
                      })()}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {phase === 'revealed' ? (
          <div className="mt-5 space-y-5 animate-fade-in">
            {summaryItems.length > 0 &&
            (eventStatus === 'FINISHED' ||
              eventStatus === 'EXPORTED') ? (
              <button
                type="button"
                onClick={() => setPhase('event_finished')}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm text-stone-300 transition hover:bg-white/5 hover:text-white"
              >
                ← Все итоги дегустации
              </button>
            ) : null}
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-wine-300">
                {wine ? 'Образец раскрыт' : 'Статистика раунда'}
              </p>
              <h2
                data-testid="guest-revealed-wine"
                className="mt-2 text-3xl font-semibold tracking-tight text-white"
              >
                {wine?.name ??
                  currentRound?.blindLabel ??
                  'Карточка образца'}
              </h2>
            </div>

            {wine ? (
              <WineDetailsCard wine={wine} />
            ) : (
              <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-wine-400/20 bg-wine-500/10 text-wine-300">
                  <WineIcon
                    className="h-10 w-10"
                    strokeWidth={1.2}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                    Слепой образец
                  </p>
                  <p className="mt-1 text-xl font-semibold text-white">
                    {currentRound?.blindLabel ?? 'Образец'}
                  </p>
                  <p className="mt-1 text-sm text-stone-400">
                    Название и карточка вина ещё не раскрыты.
                  </p>
                </div>
              </div>
            )}

            {stats ? (
              <>
                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                    Средняя оценка гостей
                  </p>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <span className="text-5xl font-semibold tracking-tight text-wine-200">
                      {stats.meanScore !== null
                        ? stats.meanScore.toLocaleString('ru-RU', {
                            maximumFractionDigits: 1,
                          })
                        : '—'}
                    </span>
                    {stats.meanScore !== null ? (
                      <span className="pb-2 text-sm text-stone-500">
                        из 100
                      </span>
                    ) : null}
                  </div>
                  {stats.qualityLabel ? (
                    <span
                      className={cn(
                        'mt-3 inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium',
                        qualityTone(stats.qualityCategory),
                      )}
                    >
                      {stats.qualityLabel}
                    </span>
                  ) : null}
                  <div className="mt-6">
                    <CriteriaBars
                      criteria={stats.criteriaMeans}
                      compact
                    />
                  </div>
                  <div className="mt-6">
                    <RadarProfileChart
                      profile={stats.radarProfile}
                      height={260}
                      compact
                    />
                  </div>
                  <p className="mt-2 text-center text-xs text-stone-500">
                    {stats.validVotesCount} валидных{' '}
                    {pluralize(
                      stats.validVotesCount,
                      'оценка',
                      'оценки',
                      'оценок',
                    )}
                    {stats.outliersRemovedCount > 0
                      ? ` · ${stats.outliersRemovedCount} выбросов отфильтровано`
                      : ''}
                  </p>
                </section>

                <section className="rounded-3xl border border-wine-400/20 bg-wine-500/10 p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-wine-300">
                    Ваша оценка
                  </p>
                  {ownRating ? (
                    <>
                      <p className="mt-2 text-4xl font-semibold text-wine-100">
                        {ownRating.totalScore.toLocaleString('ru-RU', {
                          maximumFractionDigits: 1,
                        })}
                      </p>
                      <p className="mt-1 text-sm text-wine-200/80">
                        {ownRating.qualityLabel}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-wine-200/80">
                      Оценка не найдена на этом устройстве.
                    </p>
                  )}
                </section>

                {revealedPersonalNotes ? (
                  <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
                      Ваши заметки о вине
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-200">
                      {revealedPersonalNotes}
                    </p>
                  </section>
                ) : null}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-stone-500">
                Статистика раунда загружается…
              </div>
            )}

            {wine ? (
              <div className="grid grid-cols-2 gap-3 text-xs text-stone-500">
                <div className="rounded-xl border border-white/10 p-3">
                  <MapPin className="h-4 w-4 text-wine-300" />
                  <p className="mt-2">Регион</p>
                  <p className="mt-1 text-sm text-stone-200">
                    {wine.region}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 p-3">
                  <Grape className="h-4 w-4 text-wine-300" />
                  <p className="mt-2">Сорт</p>
                  <p className="mt-1 text-sm text-stone-200">
                    {wine.grapeVarieties}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 p-3">
                  <Clock3 className="h-4 w-4 text-wine-300" />
                  <p className="mt-2">Винтаж</p>
                  <p className="mt-1 text-sm text-stone-200">
                    {wine.vintage}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 p-3">
                  <WineIcon className="h-4 w-4 text-wine-300" />
                  <p className="mt-2">Тип</p>
                  <p className="mt-1 text-sm text-stone-200">
                    {WINE_TYPE_LABELS[wine.wineType]}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <Modal
        open={removedMessage !== null}
        onClose={() => undefined}
        title="Доступ к сессии прекращён"
        size="sm"
      >
        <p className="text-sm leading-6 text-stone-300">
          {removedMessage}
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-wine-600 px-5 text-sm font-semibold text-white transition hover:bg-wine-500"
        >
          Вернуться на главную
        </Link>
      </Modal>

      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone ?? 'info'}
        onClose={() => setToast(null)}
      />
    </main>
  );
}
