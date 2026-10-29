'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Hash,
  Loader2,
  LogOut,
  Monitor,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  Wine as WineIcon,
  X,
} from 'lucide-react';

import { ExportResultModal } from '@/components/export-result-modal';
import { Modal } from '@/components/modal';
import { WineFormModal } from '@/components/wine-form-modal';
import { WineImage } from '@/components/wine-image';
import { PageLoader } from '@/components/page-loader';
import { Toast } from '@/components/toast';
import { useHostSession } from '@/hooks/use-host-session';
import { useTastingSocket } from '@/hooks/use-tasting-socket';
import {
  ApiError,
  apiClient,
  getApiErrorMessage,
} from '@/lib/api-client';
import { clearHostSession } from '@/lib/session';
import {
  EVENT_STATUS_LABELS,
  MODE_LABELS,
  SCALE_LABELS,
  WINE_TYPE_LABELS,
  eventStatusTone,
  formatEventDate,
  formatPrice,
} from '@/lib/format';
import { cn } from '@/lib/cn';
import type {
  EventSummary,
  ExportResponse,
  ScaleType,
  TastingMode,
  Wine,
} from '@/types/api';
import type { EventStatusUpdatedPayload } from '@/types/realtime';

interface PickedRound {
  key: string;
  wine: Wine;
  blindLabel: string;
  durationSeconds: number;
  labelIsAuto: boolean;
}

function autoRoundLabel(
  wine: Wine,
  index: number,
  mode: TastingMode,
): string {
  return mode === 'OPEN' ? wine.name : `Образец №${index + 1}`;
}

export default function HostEventsPage() {
  const router = useRouter();
  const { token, user, ready, logout } = useHostSession();
  const { socket } = useTastingSocket(token);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(
    null,
  );
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<TastingMode>('BLIND');
  const scaleType: ScaleType = 'PARKER_100';
  const [rounds, setRounds] = useState<PickedRound[]>([]);
  const [wines, setWines] = useState<Wine[]>([]);
  const [winesLoading, setWinesLoading] = useState(false);
  const [winesError, setWinesError] = useState<string | null>(null);
  const [wineSearch, setWineSearch] = useState('');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [wineModalOpen, setWineModalOpen] = useState(false);
  const [editingWine, setEditingWine] = useState<Wine | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [exportingEventId, setExportingEventId] = useState<
    string | null
  >(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportResult, setExportResult] =
    useState<ExportResponse | null>(null);
  const [exportEventId, setExportEventId] = useState<string | null>(
    null,
  );
  const [copyingEventId, setCopyingEventId] = useState<string | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<EventSummary | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const loadEvents = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setLoadError(null);

    try {
      const data = await apiClient.events.list();
      const activeEvent = data.find(
        (event) => event.status === 'ACTIVE',
      );

      if (activeEvent) {
        router.replace(`/host/events/${activeEvent.id}/control`);
        return;
      }

      setEvents(data.filter((event) => event.status !== 'ACTIVE'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearHostSession();
        router.replace('/host/login');
        return;
      }

      setLoadError(getApiErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!ready || !token) {
      return;
    }

    void loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleEventStatus = (
      payload: EventStatusUpdatedPayload,
    ) => {
      if (payload.status !== 'ACTIVE') {
        return;
      }

      setToast(
        `Запущена дегустация «${payload.title}». Открываем пульт…`,
      );
      router.replace(`/host/events/${payload.eventId}/control`);
    };

    socket.on('event_status_updated', handleEventStatus);

    return () => {
      socket.off('event_status_updated', handleEventStatus);
    };
  }, [socket, router]);

  const openCreateModal = () => {
    setEditingEventId(null);
    setTitle('');
    setMode('BLIND');
    setRounds([]);
    setWineSearch('');
    setCreateError(null);
    setCreateOpen(true);
  };

  const openEditEvent = async (event: EventSummary) => {
    setCreateError(null);
    setWineSearch('');

    try {
      const detail = await apiClient.events.get(event.id);

      setEditingEventId(detail.id);
      setTitle(detail.title);
      setMode(detail.mode);
      setRounds(
        detail.rounds.map((round, index) => ({
          key: round.id,
          wine: round.wine,
          blindLabel: round.blindLabel,
          durationSeconds: round.durationSeconds,
          labelIsAuto:
            round.blindLabel ===
            autoRoundLabel(round.wine, index, detail.mode),
        })),
      );
      setCreateOpen(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearHostSession();
        router.replace('/host/login');
        return;
      }

      setToast(getApiErrorMessage(error));
    }
  };

  const handleModeChange = (nextMode: TastingMode) => {
    setMode(nextMode);
    setRounds((current) =>
      current.map((round, index) => ({
        ...round,
        blindLabel: round.labelIsAuto
          ? autoRoundLabel(round.wine, index, nextMode)
          : round.blindLabel,
      })),
    );
  };

  const handleCopy = async (event: EventSummary) => {
    setCopyingEventId(event.id);

    try {
      const copy = await apiClient.events.copy(event.id);
      setEvents((current) => [copy, ...current]);
      setToast('Копия мероприятия создана');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearHostSession();
        router.replace('/host/login');
        return;
      }

      setToast(getApiErrorMessage(error));
    } finally {
      setCopyingEventId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);

    try {
      await apiClient.events.remove(deleteTarget.id);
      setEvents((current) =>
        current.filter((event) => event.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      setToast('Мероприятие удалено');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearHostSession();
        router.replace('/host/login');
        return;
      }

      setToast(getApiErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const openCatalogModal = () => {
    setWineSearch('');
    setCatalogOpen(true);
  };

  const openAddWine = () => {
    setEditingWine(null);
    setWineModalOpen(true);
  };

  const openEditWine = (wine: Wine) => {
    setEditingWine(wine);
    setWineModalOpen(true);
  };

  const handleWineSaved = (savedWine: Wine) => {
    setWines((current) => {
      const exists = current.some((wine) => wine.id === savedWine.id);

      return exists
        ? current.map((wine) =>
            wine.id === savedWine.id ? savedWine : wine,
          )
        : [...current, savedWine];
    });
    setRounds((current) =>
      current.map((round, index) =>
        round.wine.id === savedWine.id
          ? {
              ...round,
              wine: savedWine,
              blindLabel: round.labelIsAuto
                ? autoRoundLabel(savedWine, index, mode)
                : round.blindLabel,
            }
          : round,
      ),
    );
    setToast('Каталог вин обновлён');
  };

  useEffect(() => {
    if ((!createOpen && !catalogOpen) || wines.length > 0) {
      return;
    }

    let cancelled = false;
    setWinesLoading(true);
    setWinesError(null);

    apiClient.catalog
      .list({ limit: 100 })
      .then((response) => {
        if (!cancelled) {
          setWines(response.data);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setWinesError(getApiErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWinesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [createOpen, catalogOpen, wines.length]);

  const filteredWines = useMemo(() => {
    const query = wineSearch.trim().toLocaleLowerCase('ru-RU');

    if (!query) {
      return wines;
    }

    return wines.filter((wine) =>
      `${wine.name} ${wine.winery} ${wine.region}`
        .toLocaleLowerCase('ru-RU')
        .includes(query),
    );
  }, [wineSearch, wines]);

  const selectedWineIds = useMemo(
    () => new Set(rounds.map((round) => round.wine.id)),
    [rounds],
  );

  const addWine = (wine: Wine) => {
    if (selectedWineIds.has(wine.id)) {
      return;
    }

    setRounds((current) => [
      ...current,
      {
        key: `${wine.id}-${Date.now()}`,
        wine,
        blindLabel: autoRoundLabel(wine, current.length, mode),
        durationSeconds: 180,
        labelIsAuto: true,
      },
    ]);
  };

  const updateRound = (
    key: string,
    patch: Partial<
      Pick<
        PickedRound,
        'blindLabel' | 'durationSeconds' | 'labelIsAuto'
      >
    >,
  ) => {
    setRounds((current) =>
      current.map((round) =>
        round.key === key ? { ...round, ...patch } : round,
      ),
    );
  };

  const moveRound = (index: number, direction: -1 | 1) => {
    setRounds((current) => {
      const target = index + direction;

      if (target < 0 || target >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];

      return next.map((round, position) => ({
        ...round,
        blindLabel: round.labelIsAuto
          ? autoRoundLabel(round.wine, position, mode)
          : round.blindLabel,
      }));
    });
  };

  const removeRound = (key: string) => {
    setRounds((current) =>
      current
        .filter((round) => round.key !== key)
        .map((round, position) => ({
          ...round,
          blindLabel: round.labelIsAuto
            ? autoRoundLabel(round.wine, position, mode)
            : round.blindLabel,
        })),
    );
  };

  const handleCreate = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setCreateError(null);

    if (!title.trim()) {
      setCreateError('Укажите название дегустации');
      return;
    }

    if (rounds.length === 0) {
      setCreateError('Добавьте хотя бы один образец');
      return;
    }

    setCreating(true);

    try {
      const input = {
        title: title.trim(),
        mode,
        scaleType,
        rounds: rounds.map((round, index) => ({
          wineId: round.wine.id,
          orderNumber: index + 1,
          blindLabel:
            round.blindLabel.trim() ||
            autoRoundLabel(round.wine, index, mode),
          durationSeconds: Math.min(
            3600,
            Math.max(30, Math.round(round.durationSeconds) || 180),
          ),
        })),
      };
      const saved = editingEventId
        ? await apiClient.events.update(editingEventId, input)
        : await apiClient.events.create(input);

      setEvents((current) =>
        editingEventId
          ? current.map((event) =>
              event.id === saved.id ? saved : event,
            )
          : [saved, ...current],
      );
      setCreateOpen(false);
      setEditingEventId(null);
      setToast(
        editingEventId
          ? 'Мероприятие обновлено'
          : 'Дегустация создана',
      );

      if (!editingEventId) {
        router.push(`/host/events/${saved.id}/control`);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearHostSession();
        router.replace('/host/login');
        return;
      }

      setCreateError(getApiErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const handleExport = async (event: EventSummary) => {
    setExportingEventId(event.id);

    try {
      const result = await apiClient.export.create(event.id);
      setExportResult(result);
      setExportEventId(event.id);
      setExportOpen(true);
      setEvents((current) =>
        current.map((item) =>
          item.id === event.id
            ? { ...item, status: 'EXPORTED' }
            : item,
        ),
      );
      setToast('Результаты выгружены в Народный рейтинг');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearHostSession();
        router.replace('/host/login');
        return;
      }

      setToast(getApiErrorMessage(error));
    } finally {
      setExportingEventId(null);
    }
  };

  if (!ready || !token) {
    return <PageLoader message="Проверяем доступ организатора…" />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-wine-900/30 to-transparent"
      />
      <div className="relative mx-auto w-full max-w-6xl px-5 pb-16 pt-6 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl text-sm font-semibold text-white"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-wine-600/20 text-wine-300">
              <WineIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              Конструктор дегустаций
              <span className="block text-[11px] font-normal text-stone-500">
                Кабинет организатора
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <span className="hidden max-w-48 truncate px-2 text-sm text-stone-400 sm:block">
                {user.name}
              </span>
            ) : null}
            <button
              type="button"
              onClick={logout}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-stone-300 transition hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Выйти
            </button>
          </div>
        </header>

        <section className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-wine-300">
              Дегустации
            </p>
            <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Мои мероприятия
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">
              Управляйте раундами, показывайте QR-код гостям с телефона и
              выводите результаты на большой экран.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadEvents(true)}
              disabled={refreshing}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-stone-300 transition hover:bg-white/5 hover:text-white disabled:opacity-60"
            >
              <RefreshCw
                className={cn('h-4 w-4', refreshing && 'animate-spin')}
                aria-hidden="true"
              />
              Обновить
            </button>
            <button
              type="button"
              data-testid="catalog-open"
              onClick={openCatalogModal}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-stone-300 transition hover:bg-white/5 hover:text-white"
            >
              <WineIcon className="h-4 w-4" aria-hidden="true" />
              Каталог вин
            </button>
            <button
              type="button"
              data-testid="create-event-open"
              onClick={openCreateModal}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-wine-600 px-5 text-sm font-semibold text-white transition hover:bg-wine-500"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Создать дегустацию
            </button>
          </div>
        </section>

        {loadError ? (
          <div className="mt-8 rounded-2xl border border-rose-400/25 bg-rose-400/10 px-5 py-4 text-sm text-rose-200">
            {loadError}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-10 flex items-center gap-3 text-sm text-stone-400">
            <Loader2
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            Загружаем мероприятия…
          </div>
        ) : events.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-wine-400/20 bg-wine-500/10 text-wine-300">
              <WineIcon className="h-8 w-8" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-white">
              Пока нет дегустаций
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-400">
              Создайте первую программу, добавьте образцы и пригласите
              гостей по PIN-коду.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-wine-600 px-5 text-sm font-semibold text-white transition hover:bg-wine-500"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Создать дегустацию
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
              <article
                key={event.id}
                className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-wine-500/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      'inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium',
                      eventStatusTone(event.status),
                    )}
                  >
                    {EVENT_STATUS_LABELS[event.status]}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs text-stone-400">
                    <Hash className="h-3.5 w-3.5" aria-hidden="true" />
                    {event.sessionPin}
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-semibold tracking-tight text-white">
                  {event.title}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-stone-400">
                  <span className="rounded-lg border border-white/10 px-2 py-1">
                    {MODE_LABELS[event.mode]}
                  </span>
                  <span className="rounded-lg border border-white/10 px-2 py-1">
                    {SCALE_LABELS[event.scaleType]}
                  </span>
                  <span className="rounded-lg border border-white/10 px-2 py-1">
                    {event.roundCount} обр.
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    {formatEventDate(event.scheduledAt ?? event.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    />
                    {event.connectedParticipantCount} в сети
                  </span>
                </div>
                <div className="mt-auto pt-5">
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href={`/host/events/${event.id}/control`}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-stone-950 transition hover:bg-stone-200"
                    >
                      <SlidersHorizontal
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                      {event.status === 'DRAFT'
                        ? 'Пульт'
                        : 'Просмотр статистики'}
                    </Link>
                    <Link
                      href={`/host/events/${event.id}/screen`}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-medium text-stone-200 transition hover:bg-white/5"
                    >
                      <Monitor
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                      Экран
                    </Link>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {event.status === 'DRAFT' ? (
                      <button
                        type="button"
                        onClick={() => void openEditEvent(event)}
                        className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 px-2 text-[11px] font-medium text-stone-300 transition hover:bg-white/5 hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Редактировать
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleExport(event)}
                        disabled={exportingEventId === event.id}
                        className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-wine-400/30 bg-wine-500/10 px-2 text-[11px] font-semibold text-wine-100 transition hover:bg-wine-500/20 disabled:opacity-50"
                      >
                        {exportingEventId === event.id ? (
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Download
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        )}
                        Выгрузить в Народный рейтинг
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleCopy(event)}
                      disabled={copyingEventId === event.id}
                      className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 px-2 text-[11px] font-medium text-stone-300 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                    >
                      {copyingEventId === event.id ? (
                        <Loader2
                          className="h-3.5 w-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Копировать
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(event)}
                      className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-400/20 px-2 text-[11px] font-medium text-rose-200 transition hover:bg-rose-400/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Удалить
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setEditingEventId(null);
        }}
        title={
          editingEventId
            ? 'Редактировать дегустацию'
            : 'Новая дегустация'
        }
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label
              htmlFor="event-title"
              className="mb-2 block text-sm font-medium text-stone-300"
            >
              Название
            </label>
            <input
              id="event-title"
              data-testid="event-title-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              placeholder="Слепая дегустация: Автохтоны России"
              className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-stone-500 focus:border-wine-400/60 focus:ring-2 focus:ring-wine-500/20"
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-stone-300">
              Режим
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(['BLIND', 'OPEN'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleModeChange(value)}
                  className={cn(
                    'min-h-12 rounded-xl border px-3 text-sm font-medium transition',
                    mode === value
                      ? 'border-wine-400/60 bg-wine-500/15 text-wine-100'
                      : 'border-white/10 bg-white/[0.03] text-stone-400 hover:bg-white/[0.06]',
                  )}
                >
                  {MODE_LABELS[value]}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-stone-300">
                  Образцы
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Добавьте вина из каталога и задайте порядок подачи.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500">
                  {rounds.length} в программе
                </span>
                <button
                  type="button"
                  onClick={openAddWine}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-wine-400/25 bg-wine-500/10 px-3 text-xs font-medium text-wine-100 transition hover:bg-wine-500/20"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Добавить вино
                </button>
              </div>
            </div>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500"
                aria-hidden="true"
              />
              <input
                value={wineSearch}
                onChange={(event) =>
                  setWineSearch(event.target.value)
                }
                placeholder="Найти вино или винодельню"
                className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none placeholder:text-stone-500 focus:border-wine-400/60"
              />
            </div>

            {winesError ? (
              <p className="mt-3 text-sm text-rose-300">{winesError}</p>
            ) : null}

            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-stone-950/60 p-2">
              {winesLoading ? (
                <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-stone-400">
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Загружаем каталог…
                </div>
              ) : filteredWines.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-stone-500">
                  Вина не найдены
                </p>
              ) : (
                filteredWines.map((wine) => {
                  const selected = selectedWineIds.has(wine.id);

                  return (
                    <div
                      key={wine.id}
                      className="flex items-center gap-1 rounded-xl px-1 py-1 transition hover:bg-white/[0.04]"
                    >
                      <button
                        type="button"
                        data-testid="wine-option"
                        disabled={selected}
                        onClick={() => addWine(wine)}
                        className={cn(
                          'flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left transition',
                          selected
                            ? 'cursor-not-allowed opacity-40'
                            : 'hover:bg-white/[0.06]',
                        )}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/5 bg-wine-500/10 text-wine-300">
                          <WineImage
                            src={wine.imageUrl}
                            alt={wine.name}
                            iconClassName="h-5 w-5"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-white">
                            {wine.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-stone-500">
                            {wine.winery} · {wine.region} ·{' '}
                            {wine.vintage}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-xs text-stone-400">
                            {WINE_TYPE_LABELS[wine.wineType]}
                          </span>
                          <span className="mt-0.5 block text-xs text-stone-500">
                            {formatPrice(wine.retailPrice)}
                          </span>
                        </span>
                        {selected ? (
                          <span className="text-xs text-wine-300">
                            Добавлено
                          </span>
                        ) : (
                          <Plus
                            className="h-4 w-4 shrink-0 text-wine-300"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditWine(wine)}
                        aria-label={`Редактировать ${wine.name}`}
                        className="flex h-12 w-10 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-white/5 hover:text-wine-200"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {rounds.length > 0 ? (
            <div className="space-y-3">
              {rounds.map((round, index) => (
                <div
                  key={round.key}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-wine-500/10 font-mono text-xs text-wine-200">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {round.wine.name}
                      </p>
                      <p className="truncate text-xs text-stone-500">
                        {round.wine.winery}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveRound(index, -1)}
                        disabled={index === 0}
                        aria-label="Поднять образец"
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-400 transition hover:bg-white/5 hover:text-white disabled:opacity-30"
                      >
                        <ChevronUp
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRound(index, 1)}
                        disabled={index === rounds.length - 1}
                        aria-label="Опустить образец"
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-400 transition hover:bg-white/5 hover:text-white disabled:opacity-30"
                      >
                        <ChevronDown
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRound(round.key)}
                        aria-label="Удалить образец"
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <Trash2
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_130px]">
                    <div>
                      <label
                        htmlFor={`blind-${round.key}`}
                        className="mb-1.5 block text-xs text-stone-500"
                      >
                        Подпись образца
                      </label>
                      <input
                        id={`blind-${round.key}`}
                        value={round.blindLabel}
                        maxLength={100}
                        onChange={(event) =>
                          updateRound(round.key, {
                            blindLabel: event.target.value,
                            labelIsAuto: false,
                          })
                        }
                        className="min-h-11 w-full rounded-xl border border-white/10 bg-stone-950/60 px-3 text-sm text-white outline-none focus:border-wine-400/50"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`duration-${round.key}`}
                        className="mb-1.5 block text-xs text-stone-500"
                      >
                        Длительность, сек
                      </label>
                      <input
                        id={`duration-${round.key}`}
                        type="number"
                        min={30}
                        max={3600}
                        value={round.durationSeconds}
                        onChange={(event) =>
                          updateRound(round.key, {
                            durationSeconds: Number(
                              event.target.value,
                            ),
                          })
                        }
                        className="min-h-11 w-full rounded-xl border border-white/10 bg-stone-950/60 px-3 text-sm text-white outline-none focus:border-wine-400/50"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-stone-500">
              Добавьте хотя бы один образец из каталога.
            </div>
          )}

          {createError ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
            >
              {createError}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 px-5 text-sm text-stone-300 transition hover:bg-white/5"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Отмена
            </button>
            <button
              type="submit"
              data-testid="create-event-submit"
              disabled={creating}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-wine-600 px-6 text-sm font-semibold text-white transition hover:bg-wine-500 disabled:opacity-60"
            >
              {creating ? (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              {creating
                ? 'Сохраняем…'
                : editingEventId
                  ? 'Сохранить изменения'
                  : 'Создать и открыть пульт'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        title="Каталог вин"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500"
                aria-hidden="true"
              />
              <input
                value={wineSearch}
                onChange={(event) => setWineSearch(event.target.value)}
                placeholder="Найти вино или винодельню"
                className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none placeholder:text-stone-500 focus:border-wine-400/60"
              />
            </div>
            <button
              type="button"
              onClick={openAddWine}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-wine-600 px-4 text-sm font-semibold text-white transition hover:bg-wine-500"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Добавить вино
            </button>
          </div>

          {winesError ? (
            <p className="text-sm text-rose-300">{winesError}</p>
          ) : null}

          <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
            {winesLoading ? (
              <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-stone-400">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Загружаем каталог…
              </div>
            ) : filteredWines.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-stone-500">
                Вина не найдены
              </p>
            ) : (
              filteredWines.map((wine) => (
                <div
                  key={wine.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-wine-500/10 text-wine-300">
                    <WineImage
                      src={wine.imageUrl}
                      alt={wine.name}
                      iconClassName="h-6 w-6"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {wine.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      {wine.winery} · {wine.region} · {wine.vintage}
                    </p>
                    <p className="mt-1 text-xs text-stone-400">
                      {WINE_TYPE_LABELS[wine.wineType]} ·{' '}
                      {formatPrice(wine.retailPrice)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditWine(wine)}
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-stone-300 transition hover:bg-white/5 hover:text-white"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Редактировать
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Удалить мероприятие"
        size="sm"
      >
        <p className="text-sm leading-6 text-stone-300">
          {'Вы точно уверены, что хотите удалить мероприятие «'}
          {deleteTarget?.title ?? ''}
          {'»?'}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-5 text-sm text-stone-300 transition hover:bg-white/5"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            )}
            Удалить мероприятие
          </button>
        </div>
      </Modal>

      <WineFormModal
        open={wineModalOpen}
        wine={editingWine}
        onClose={() => setWineModalOpen(false)}
        onSaved={handleWineSaved}
      />

      <ExportResultModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        result={exportResult}
        eventId={exportEventId ?? ''}
      />

      <Toast message={toast} onClose={() => setToast(null)} tone="success" />
    </main>
  );
}
