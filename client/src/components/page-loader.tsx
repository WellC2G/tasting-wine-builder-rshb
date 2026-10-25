'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({
  message = 'Загружаем данные…',
}: PageLoaderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950 px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2
          className="h-8 w-8 animate-spin text-wine-400"
          aria-hidden="true"
        />
        <p className="text-sm text-stone-400">{message}</p>
      </div>
    </div>
  );
}

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
