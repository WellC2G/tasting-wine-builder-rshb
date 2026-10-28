'use client';

import { Grape, MapPin } from 'lucide-react';

import { WineImage } from '@/components/wine-image';
import { cn } from '@/lib/cn';
import { WINE_TYPE_LABELS, formatPrice } from '@/lib/format';
import type { RevealedWine } from '@/types/api';

interface WineDetailsCardProps {
  wine: RevealedWine;
  large?: boolean;
  className?: string;
}

export function WineDetailsCard({
  wine,
  large = false,
  className,
}: WineDetailsCardProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-wine-950/60 via-stone-900/70 to-stone-950',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-5 p-5',
          large ? 'sm:flex-row sm:items-center sm:gap-8 sm:p-8' : '',
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-wine-400/20 bg-wine-500/10 text-wine-300',
            large ? 'h-36 w-full sm:h-44 sm:w-44' : 'h-24 w-24',
          )}
        >
          <WineImage
            src={wine.imageUrl}
            alt={wine.name}
            iconClassName={large ? 'h-16 w-16' : 'h-10 w-10'}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-wine-400/25 bg-wine-500/10 px-2.5 py-1 text-[11px] font-medium text-wine-200">
              {WINE_TYPE_LABELS[wine.wineType]}
            </span>
            <span className="text-xs text-stone-400">
              {wine.vintage} год
            </span>
          </div>
          <h3
            className={cn(
              'mt-3 font-semibold tracking-tight text-white',
              large ? 'text-4xl sm:text-5xl' : 'text-2xl',
            )}
          >
            {wine.name}
          </h3>
          <p
            className={cn(
              'mt-2 text-wine-200',
              large ? 'text-xl' : 'text-sm',
            )}
          >
            {wine.winery}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-400">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {wine.region}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Grape className="h-4 w-4" aria-hidden="true" />
              {wine.grapeVarieties}
            </span>
            <span className="font-medium text-stone-200">
              {formatPrice(wine.retailPrice)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
