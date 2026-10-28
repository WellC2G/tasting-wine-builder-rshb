'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  Wine,
} from 'lucide-react';

import {
  apiClient,
  getApiErrorMessage,
} from '@/lib/api-client';
import { getHostToken, setHostSession } from '@/lib/session';

export default function HostLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getHostToken()) {
      router.replace('/host/events');
    }
  }, [router]);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await apiClient.auth.login(email, password);
      setHostSession(response.accessToken, response.user);
      router.replace('/host/events');
    } catch (loginError) {
      setError(getApiErrorMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(159,18,57,0.32),transparent_55%)]"
      />
      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex min-h-12 items-center gap-2 rounded-xl px-2 text-sm text-stone-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          На главную
        </Link>

        <div className="rounded-3xl border border-white/10 bg-stone-950/80 p-6 shadow-2xl backdrop-blur sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-wine-400/25 bg-wine-500/10 text-wine-300">
              <Wine className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-wine-300">
                Кабинет организатора
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                Вход для сомелье
              </h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="host-email"
                className="mb-2 block text-sm font-medium text-stone-300"
              >
                Электронная почта
              </label>
              <input
                id="host-email"
                data-testid="host-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-stone-500 focus:border-wine-400/60 focus:ring-2 focus:ring-wine-500/20"
                placeholder="sommelier@tasting.ru"
              />
            </div>

            <div>
              <label
                htmlFor="host-password"
                className="mb-2 block text-sm font-medium text-stone-300"
              >
                Пароль
              </label>
              <div className="relative">
                <input
                  id="host-password"
                  data-testid="host-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 pr-14 text-base text-white outline-none transition placeholder:text-stone-500 focus:border-wine-400/60 focus:ring-2 focus:ring-wine-500/20"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    showPassword ? 'Скрыть пароль' : 'Показать пароль'
                  }
                  className="absolute right-1 top-1 flex h-10 w-12 items-center justify-center rounded-lg text-stone-400 transition hover:bg-white/5 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              data-testid="host-login-submit"
              disabled={submitting}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-wine-600 px-5 text-base font-semibold text-white transition hover:bg-wine-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <Loader2
                  className="h-5 w-5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <LogIn className="h-5 w-5" aria-hidden="true" />
              )}
              {submitting ? 'Входим…' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
