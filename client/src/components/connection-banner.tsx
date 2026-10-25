'use client';

import { WifiOff } from 'lucide-react';

interface ConnectionBannerProps {
  connected: boolean;
  hasConnected: boolean;
  error?: string | null;
}

export function ConnectionBanner({
  connected,
  hasConnected,
  error,
}: ConnectionBannerProps) {
  if (connected) {
    return null;
  }

  const message = error
    ? error
    : hasConnected
      ? 'Соединение потеряно. Переподключаемся…'
      : 'Подключение к сессии дегустации…';

  return (
    <div className="flex min-h-12 items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 text-sm text-amber-200">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
