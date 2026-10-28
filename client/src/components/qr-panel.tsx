'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { joinUrlForPin } from '@/lib/format';
import {
  buildLanOrigin,
  getCachedQrOrigin,
  getStoredHostLanIp,
  isLoopbackHostname,
  resolveHostLanIp,
  setStoredHostLanIp,
} from '@/lib/lan-ip';

interface QrPanelProps {
  sessionPin: string;
  path?: string;
  size?: number;
  showPin?: boolean;
  showUrl?: boolean;
  allowLanIpEdit?: boolean;
  ariaLabel?: string;
  className?: string;
}

function originForLanIp(lanIp: string | null): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!isLoopbackHostname(window.location.hostname)) {
    return window.location.origin;
  }

  return lanIp ? buildLanOrigin(lanIp) : null;
}

export function QrPanel({
  sessionPin,
  path,
  size = 220,
  showPin = true,
  showUrl = true,
  allowLanIpEdit = false,
  ariaLabel,
  className,
}: QrPanelProps) {
  const [origin, setOrigin] = useState<string | null>(() =>
    getCachedQrOrigin(),
  );
  const [lanIp, setLanIp] = useState<string | null>(() =>
    getStoredHostLanIp(),
  );
  const [resolving, setResolving] = useState(true);
  const [editing, setEditing] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void resolveHostLanIp()
      .then((resolvedIp) => {
        if (cancelled) {
          return;
        }

        const nextOrigin = originForLanIp(resolvedIp);

        setLanIp(resolvedIp);
        setOrigin(nextOrigin);
        setResolving(false);

        if (
          !nextOrigin &&
          allowLanIpEdit &&
          typeof window !== 'undefined' &&
          isLoopbackHostname(window.location.hostname)
        ) {
          setManualIp(getStoredHostLanIp() ?? '');
          setEditing(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolving(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [allowLanIpEdit]);

  const qrUrl = origin
    ? path
      ? `${origin.replace(/\/+$/, '')}${
          path.startsWith('/') ? path : `/${path}`
        }`
      : joinUrlForPin(sessionPin, origin)
    : null;

  const startEditing = () => {
    setManualIp(lanIp ?? getStoredHostLanIp() ?? '');
    setEditError(null);
    setEditing(true);
  };

  const saveManualIp = async () => {
    const normalized = setStoredHostLanIp(manualIp);

    if (!normalized) {
      setEditError(
        'Укажите локальный IP-адрес хоста, например 192.168.0.115',
      );
      return;
    }

    setSaving(true);
    setEditError(null);
    setLanIp(normalized);
    setOrigin(buildLanOrigin(normalized));

    try {
      await apiClient.health.setNetworkLanIp(normalized);
    } catch {
      // localStorage still keeps the value for this organizer device.
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const isLoopback =
    typeof window !== 'undefined' &&
    isLoopbackHostname(window.location.hostname);

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {qrUrl ? (
        <div className="rounded-2xl bg-white p-3 shadow-xl">
          <QRCodeSVG
            value={qrUrl}
            size={size}
            level="H"
            marginSize={2}
            bgColor="#ffffff"
            fgColor="#09090b"
            aria-label={
              ariaLabel ??
              `QR-код для входа гостей по PIN ${sessionPin}`
            }
          />
        </div>
      ) : (
        <div
          style={{ width: size, height: size }}
          className="flex items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4 text-center text-xs leading-5 text-stone-400"
        >
          {resolving
            ? 'Определяем локальный адрес сети…'
            : allowLanIpEdit
              ? 'LAN-адрес не определён. Укажите его вручную.'
              : 'LAN-адрес не определён'}
        </div>
      )}

      {showUrl ? (
        <p className="max-w-full break-all text-center font-mono text-xs leading-5 text-stone-500">
          {qrUrl ?? 'Адрес для QR-кода ещё не определён'}
        </p>
      ) : null}

      {showPin ? (
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-stone-400">
            PIN-код сессии
          </p>
          <p className="mt-1 font-mono text-4xl font-semibold tracking-[0.3em] text-white">
            {sessionPin}
          </p>
        </div>
      ) : null}

      {allowLanIpEdit && isLoopback ? (
        <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          {editing ? (
            <div className="space-y-2">
              <label
                htmlFor="host-lan-ip"
                className="block text-xs font-medium text-stone-300"
              >
                Локальный IP хоста для QR-кодов
              </label>
              <input
                id="host-lan-ip"
                data-testid="host-lan-ip"
                value={manualIp}
                onChange={(event) => setManualIp(event.target.value)}
                inputMode="decimal"
                placeholder="192.168.0.115"
                className="min-h-12 w-full rounded-xl border border-white/10 bg-stone-950 px-3 font-mono text-sm text-white outline-none placeholder:text-stone-600 focus:border-wine-400/60 focus:ring-2 focus:ring-wine-500/20"
              />
              {editError ? (
                <p className="text-xs leading-5 text-rose-300">
                  {editError}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveManualIp()}
                  disabled={saving}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-wine-600 px-3 text-sm font-semibold text-white transition hover:bg-wine-500 disabled:opacity-60"
                >
                  {saving ? 'Сохраняем…' : 'Применить'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setEditError(null);
                  }}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-3 text-sm text-stone-300 transition hover:bg-white/5"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-white/10 px-3 text-xs font-medium text-stone-300 transition hover:bg-white/5 hover:text-white"
            >
              {lanIp
                ? `LAN-адрес: ${lanIp} · изменить`
                : 'Указать LAN-адрес вручную'}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
