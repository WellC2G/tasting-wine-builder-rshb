'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { cn } from '@/lib/cn';

interface QrPanelProps {
  sessionPin: string;
  size?: number;
  showPin?: boolean;
  className?: string;
}

export function QrPanel({
  sessionPin,
  size = 220,
  showPin = true,
  className,
}: QrPanelProps) {
  const [joinUrl, setJoinUrl] = useState(`/join/${sessionPin}`);

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/join/${sessionPin}`);
  }, [sessionPin]);

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="rounded-2xl bg-white p-3 shadow-xl">
        <QRCodeSVG
          value={joinUrl}
          size={size}
          level="H"
          marginSize={2}
          bgColor="#ffffff"
          fgColor="#09090b"
          aria-label={`QR-код для входа гостей по PIN ${sessionPin}`}
        />
      </div>
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
    </div>
  );
}
