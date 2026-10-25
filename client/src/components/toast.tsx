'use client';

import { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

import { cn } from '@/lib/cn';

type ToastTone = 'info' | 'success' | 'error';

interface ToastProps {
  message: string | null;
  tone?: ToastTone;
  onClose: () => void;
  autoDismissMs?: number;
}

const TONE_STYLES: Record<ToastTone, string> = {
  info: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
  success:
    'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
  error: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
};

const TONE_ICONS = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

export function Toast({
  message,
  tone = 'info',
  onClose,
  autoDismissMs = 5000,
}: ToastProps) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!message || autoDismissMs <= 0) {
      return;
    }

    const timeout = setTimeout(
      () => onCloseRef.current(),
      autoDismissMs,
    );

    return () => clearTimeout(timeout);
  }, [message, autoDismissMs]);

  if (!message) {
    return null;
  }

  const Icon = TONE_ICONS[tone];

  return (
    <div
      role="status"
      className={cn(
        'fixed inset-x-4 bottom-4 z-[60] flex min-h-12 items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md',
        TONE_STYLES[tone],
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="flex-1 leading-5">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть уведомление"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
