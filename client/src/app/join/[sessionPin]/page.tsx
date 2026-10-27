'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
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
  Star,
  UserRound,
  Wine as WineIcon,
} from 'lucide-react';

import { ConnectionBanner } from '@/components/connection-banner';
import { CriteriaBars } from '@/components/criteria-bars';
import { PageLoader } from '@/components/page-loader';
import { RadarProfileChart } from '@/components/radar-profile-chart';
import { Toast } from '@/components/toast';
import { WineDetailsCard } from '@/components/wine-details-card';
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
import {
  getGuestSession,
  getNormalizedScreenResolution,
  getOrCreateDeviceId,
  getStoredRating,
  setGuestSession,
  setStoredRating,
} from '@/lib/session';
import type {
  CreateRatingInput,
  GuestCurrentRound,
  GuestEventInfo,
  GuestJoinResponse,
  LiveState,
  Organoleptics,
  ParkerBreakdown,
  RatingResponse,
  RevealedWine,
  RoundStats,
} from '@/types/api';
import type {
  BottleRevealedPayload,
  RoundStartedPayload,
  SocketMessagePayload,
  VotingClosedPayload,
} from '@/types/realtime';

type GuestPhase =
  | 'loading'
  | 'join'
  | 'waiting'
  | 'voting'
  | 'submitted'
  | 'closed'
  | 'revealed';

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
  const [eventInfo, setEventInfo] = useState<GuestEventInfo | null>(
    null,
  );
  const [currentRound, setCurrentRound] =
    useState<GuestCurrentRound | null>(null);
  const [wine, setWine] = useState<RevealedWine | null>(null);
  const [stats, setStats] = useState<RoundStats | null>(null);
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
  const [stars, setStars] = useState(3);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const {
    socket,
    connected,
    hasConnected,
    connectionError,
    connectCount,
  } = useTastingSocket(guestToken);

  const resetForm = () => {
    setParker({
      appearance: 3,
      aroma: 9,
      taste: 12,
      potential: 6,
    });
    setOrganoleptics({
      sweetness: 5,
      acidity: 5,
      tannins: 5,
      body: 5,
      aromaIntensity: 5,
    });
    setStars(3);
    setSelectedTags([]);
    setNotes('');
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

  const hydrateEvent = async (
    info: GuestEventInfo,
    token: string,
  ) => {
    setEventInfo(info);
    setWine(null);
    setStats(null);
    setSubmitError(null);

    const round = info.currentRound;

    if (!round) {
      setCurrentRound(null);
      setOwnRating(null);
      setPhase('waiting');
      return;
    }

    setCurrentRound(round);
    const savedRating = getStoredRating(round.roundId);
    setOwnRating(savedRating);

    if (round.status === 'REVEALED') {
      const roundStats = await hydrateStats(round.roundId, token);
      setStats(roundStats);
      setWine(round.wine ?? null);
      setPhase('revealed');
      return;
    }

    if (round.status === 'ACTIVE') {
      if (round.wine) {
        setWine(round.wine);
      }
      setPhase(savedRating ? 'submitted' : 'voting');
      return;
    }

    if (round.status === 'VOTING_CLOSED') {
      setPhase(savedRating ? 'submitted' : 'closed');
      return;
    }

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
            wine: live.currentRound.wine,
          }
        : null,
    };

    await hydrateEvent(info, token);
  };

  const joinSession = async (
    nicknameValue: string,
    resolutionValue: string,
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
      const response: GuestJoinResponse =
        await apiClient.auth.guestJoin({
          sessionPin,
          nickname: trimmedNickname,
          screenResolution: resolutionValue,
          deviceId: getOrCreateDeviceId(),
        });

      setNickname(trimmedNickname);
      setGuestToken(response.guestSessionToken);
      setGuestSession(sessionPin, {
        token: response.guestSessionToken,
        nickname: trimmedNickname,
        participantId: response.participantId,
      });
      await hydrateEvent(response.event, response.guestSessionToken);
    } catch (error) {
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
      void joinSession(stored.nickname, resolution);
    } else {
      setPhase('join');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPin]);

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
        remainingSeconds: payload.durationSeconds,
        wine: payload.wine,
      };

      setCurrentRound(nextRound);
      setWine(payload.wine ?? null);
      setStats(null);
      setSubmitError(null);
      resetForm();
      const savedRating = getStoredRating(payload.roundId);
      setOwnRating(savedRating);
      setPhase(savedRating ? 'submitted' : 'voting');
      setToast({
        message: 'Сомелье запустил новый раунд',
        tone: 'info',
      });
    };

    const handleVotingClosed = (payload: VotingClosedPayload) => {
      setCurrentRound((round) =>
        round && round.roundId === payload.roundId
          ? { ...round, status: 'VOTING_CLOSED' }
          : round,
      );
      setPhase((current) =>
        current === 'voting' ? 'closed' : current,
      );
      setToast({ message: payload.message, tone: 'info' });
    };

    const handleBottleRevealed = (
      payload: BottleRevealedPayload,
    ) => {
      setCurrentRound((round) =>
        round && round.roundId === payload.roundId
          ? { ...round, status: 'REVEALED' }
          : round,
      );
      setWine(payload.wine);
      setStats(payload.stats);
      setOwnRating(getStoredRating(payload.roundId));
      setPhase('revealed');
      setToast({
        message: 'Карточка образца раскрыта!',
        tone: 'success',
      });
    };

    const handleError = (payload: SocketMessagePayload) => {
      setToast({ message: payload.message, tone: 'error' });
    };

    socket.on('round_started', handleRoundStarted);
    socket.on('voting_closed', handleVotingClosed);
    socket.on('bottle_revealed', handleBottleRevealed);
    socket.on('session_error', handleError);
    socket.on('auth_error', handleError);

    return () => {
      socket.off('round_started', handleRoundStarted);
      socket.off('voting_closed', handleVotingClosed);
      socket.off('bottle_revealed', handleBottleRevealed);
      socket.off('session_error', handleError);
      socket.off('auth_error', handleError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  useEffect(() => {
    if (
      !socket ||
      !guestToken ||
      !eventInfo?.eventId ||
      connectCount === 0
    ) {
      return;
    }

    let cancelled = false;

    apiClient.events
      .liveState(eventInfo.eventId, guestToken)
      .then(async (live) => {
        if (!cancelled) {
          await hydrateLiveState(live, guestToken);
        }
      })
      .catch(() => {
        // The connection banner already reports transport problems.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, connectCount, guestToken, eventInfo?.eventId]);

  const handleJoinSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const resolution =
      screenResolution || getNormalizedScreenResolution();

    await joinSession(nickname, resolution);
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
      organoleptics,
      aromaTags: selectedTags,
      personalNotes: notes.trim() || undefined,
    };

    if (eventInfo.scaleType === 'STARS_5') {
      payload.stars = stars;
    } else {
      payload.parkerBreakdown = parker;
    }

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

  const isParker = eventInfo?.scaleType !== 'STARS_5';
  const liveTotal = isParker
    ? calculateParkerTotal(parker)
    : Math.round((50 + 12.5 * (stars - 1)) * 10) / 10;
  const liveCategory = getQualityCategory(liveTotal);
  const currentRoundNumber = currentRound?.orderNumber ?? 0;

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
              <p className="mt-1 text-xs text-stone-500">{nickname}</p>
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
              Ожидание запуска раунда сомелье…
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
                : 'Ведущий закрыл голосование по этому образцу. Ожидайте раскрытия карты.'}
            </p>

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

              {isParker ? (
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
              ) : (
                <div className="mt-6">
                  <p className="text-sm font-medium text-stone-200">
                    Оценка по 5-звёздочной шкале
                  </p>
                  <div className="mt-3 flex gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setStars(value)}
                        aria-label={`${value} звёзд`}
                        className={cn(
                          'flex min-h-12 flex-1 items-center justify-center rounded-xl border text-lg transition',
                          stars >= value
                            ? 'border-amber-300/50 bg-amber-300/15 text-amber-200'
                            : 'border-white/10 bg-white/[0.03] text-stone-500',
                        )}
                      >
                        <Star
                          className={cn(
                            'h-6 w-6',
                            stars >= value && 'fill-current',
                          )}
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-stone-500">
                    {stars.toLocaleString('ru-RU')} из 5 звёзд
                  </p>
                </div>
              )}
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

        {phase === 'revealed' ? (
          <div className="mt-5 space-y-5 animate-fade-in">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-wine-300">
                Образец раскрыт
              </p>
              <h2
                data-testid="guest-revealed-wine"
                className="mt-2 text-3xl font-semibold tracking-tight text-white"
              >
                {wine?.name ?? 'Карточка образца'}
              </h2>
            </div>

            {wine ? <WineDetailsCard wine={wine} /> : null}

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

      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone ?? 'info'}
        onClose={() => setToast(null)}
      />
    </main>
  );
}
