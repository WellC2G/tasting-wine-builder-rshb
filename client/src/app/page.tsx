'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Award,
  EyeOff,
  KeyRound,
  Loader2,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  Wine,
} from 'lucide-react';

import {
  ApiError,
  apiClient,
  getApiErrorMessage,
} from '@/lib/api-client';
import { clearHostSession, getHostToken } from '@/lib/session';

function normalizePin(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export default function HomePage() {
  const router = useRouter();
  const [guestPin, setGuestPin] = useState('');
  const [sommelierPin, setSommelierPin] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);
  const [sommelierError, setSommelierError] = useState<string | null>(
    null,
  );
  const [openingControl, setOpeningControl] = useState(false);

  const handleGuestSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setGuestError(null);

    if (!/^\d{6}$/.test(guestPin)) {
      setGuestError('Введите 6-значный код сессии');
      return;
    }

    router.push(`/join/${guestPin}`);
  };

  const handleSommelierSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setSommelierError(null);

    const token = getHostToken();
    const pin = sommelierPin.trim();

    if (!token) {
      router.push(pin ? `/host/login?pin=${pin}` : '/host/login');
      return;
    }

    if (!pin) {
      router.push('/host/events');
      return;
    }

    if (!/^\d{6}$/.test(pin)) {
      setSommelierError('Введите 6-значный код сессии');
      return;
    }

    setOpeningControl(true);

    try {
      const tastingEvent = await apiClient.events.getByPin(pin);
      router.push(`/host/events/${tastingEvent.id}/control`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearHostSession();
        router.push(`/host/login?pin=${pin}`);
        return;
      }

      setSommelierError(getApiErrorMessage(error));
    } finally {
      setOpeningControl(false);
    }
  };

  const openHostCabinet = () => {
    router.push(getHostToken() ? '/host/events' : '/host/login');
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-stone-950 text-stone-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[680px] bg-[radial-gradient(circle_at_top,_rgba(159,18,57,0.34),transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-260px] h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-wine-700/20 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 pb-14 pt-6 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/favicon.svg"
              alt=""
              width={42}
              height={42}
              className="h-10 w-10 rounded-xl"
            />
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">
                Конструктор дегустаций
              </p>
              <p className="text-xs text-stone-400">
                Вино, вкус и живые впечатления
              </p>
            </div>
          </div>
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-wine-400/25 bg-wine-500/10 px-3 text-xs font-medium text-wine-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Вечер, который запомнится
          </span>
        </header>

        <section className="mx-auto max-w-4xl pb-12 pt-14 text-center sm:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-wine-300">
            Пространство вкуса
          </p>
          <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Дегустация, в которой
            <span className="block bg-gradient-to-r from-wine-200 via-wine-300 to-wine-500 bg-clip-text text-transparent">
              каждый голос важен.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-stone-300 sm:text-lg">
            Оценивайте вина вслепую или открыто, следите за ходом вечера
            в реальном времени и вместе с гостями формируйте Народный
            винный рейтинг.
          </p>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <form
            onSubmit={handleGuestSubmit}
            className="flex flex-col rounded-3xl border border-wine-400/25 bg-gradient-to-br from-wine-950/60 via-stone-900/80 to-stone-950 p-6 shadow-2xl backdrop-blur sm:p-8"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-wine-400/30 bg-wine-500/15 text-wine-200">
                <UserRound className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-wine-300">
                  Для гостя
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                  Участнику дегустации
                </h2>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-stone-400">
              Введите 6-значный код сессии с экрана или приглашения
              сомелье.
            </p>

            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-medium text-stone-300">
                Код сессии
              </span>
              <input
                data-testid="landing-guest-pin"
                value={guestPin}
                onChange={(event) =>
                  setGuestPin(normalizePin(event.target.value))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="Код сессии, например 482910"
                className="min-h-14 w-full rounded-2xl border border-white/10 bg-stone-950/70 px-4 text-center font-mono text-2xl tracking-[0.28em] text-white outline-none placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-stone-500 focus:border-wine-400/60 focus:ring-2 focus:ring-wine-500/20"
              />
            </label>

            {guestError ? (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
              >
                {guestError}
              </p>
            ) : null}

            <button
              type="submit"
              data-testid="landing-guest-submit"
              className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-wine-600 px-5 text-base font-semibold text-white transition hover:bg-wine-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine-300"
            >
              Присоединиться к сессии
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </form>

          <form
            onSubmit={(event) => void handleSommelierSubmit(event)}
            className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-glow backdrop-blur sm:p-8"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-amber-200">
                <KeyRound className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-amber-200/80">
                  Для сомелье
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                  Вход для сомелье
                </h2>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-stone-400">
              Управляйте раундами с пульта или откройте кабинет
              мероприятий.
            </p>

            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-medium text-stone-300">
                Код сессии
              </span>
              <input
                data-testid="landing-host-pin"
                value={sommelierPin}
                onChange={(event) =>
                  setSommelierPin(normalizePin(event.target.value))
                }
                inputMode="numeric"
                maxLength={6}
                placeholder="Код сессии (необязательно)"
                className="min-h-14 w-full rounded-2xl border border-white/10 bg-stone-950/70 px-4 text-center font-mono text-2xl tracking-[0.28em] text-white outline-none placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-stone-500 focus:border-wine-400/60 focus:ring-2 focus:ring-wine-500/20"
              />
            </label>

            {sommelierError ? (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
              >
                {sommelierError}
              </p>
            ) : null}

            <button
              type="submit"
              data-testid="landing-host-submit"
              disabled={openingControl}
              className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 text-base font-semibold text-stone-950 transition hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {openingControl ? (
                <Loader2
                  className="h-5 w-5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Wine className="h-5 w-5" aria-hidden="true" />
              )}
              {openingControl
                ? 'Открываем пульт…'
                : 'Открыть пульт по коду'}
            </button>

            <button
              type="button"
              onClick={openHostCabinet}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/10 px-5 text-sm font-medium text-stone-300 transition hover:bg-white/5 hover:text-white"
            >
              Войти в кабинет организатора
            </button>
          </form>
        </section>

        <section className="mt-14 border-t border-white/5 pt-12 sm:mt-16">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-wine-300">
                Как проходит вечер
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Продуманно для гостей и сомелье
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-stone-500">
              От первого бокала до итогового рейтинга — всё происходит
              синхронно на ваших устройствах.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <Award
                className="h-6 w-6 text-wine-300"
                aria-hidden="true"
              />
              <h3 className="mt-5 text-lg font-semibold text-white">
                100-балльная шкала Паркера
              </h3>
              <p className="mt-2 text-sm leading-6 text-stone-400">
                Внешний вид, аромат, вкус и потенциал складываются в
                понятную профессиональную оценку.
              </p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <EyeOff
                className="h-6 w-6 text-wine-300"
                aria-hidden="true"
              />
              <h3 className="mt-5 text-lg font-semibold text-white">
                Слепой и открытый формат
              </h3>
              <p className="mt-2 text-sm leading-6 text-stone-400">
                Скрывайте этикетку до раскрытия или знакомьтесь с вином
                сразу — сомелье выбирает формат вечера.
              </p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <Trophy
                className="h-6 w-6 text-wine-300"
                aria-hidden="true"
              />
              <h3 className="mt-5 text-lg font-semibold text-white">
                Народный винный рейтинг
              </h3>
              <p className="mt-2 text-sm leading-6 text-stone-400">
                Оценки гостей проходят статистическую проверку и
                складываются в честный коллективный результат.
              </p>
            </article>
          </div>
        </section>

        <footer className="mt-14 flex flex-col gap-3 border-t border-white/5 pt-7 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2">
            <Users className="h-4 w-4" aria-hidden="true" />
            Конструктор дегустаций
          </p>
          <p>Сделано для тех, кто выбирает вино сердцем и вкусом.</p>
        </footer>
      </div>
    </main>
  );
}
