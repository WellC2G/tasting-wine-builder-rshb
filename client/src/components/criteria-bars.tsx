'use client';

import type { CriteriaMeans } from '@/types/api';

interface CriteriaBarsProps {
  criteria: CriteriaMeans;
  compact?: boolean;
}

const CRITERIA = [
  { key: 'appearance', label: 'Внешний вид', max: 5 },
  { key: 'aroma', label: 'Аромат', max: 15 },
  { key: 'taste', label: 'Вкус', max: 20 },
  { key: 'potential', label: 'Потенциал', max: 10 },
] as const;

export function CriteriaBars({
  criteria,
  compact = false,
}: CriteriaBarsProps) {
  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {CRITERIA.map((criterion) => {
        const value = criteria[criterion.key] ?? 0;
        const percent = Math.min(
          100,
          Math.max(0, (value / criterion.max) * 100),
        );

        return (
          <div key={criterion.key}>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-stone-300">
                {criterion.label}
              </span>
              <span className="font-mono text-xs text-stone-400">
                {value.toLocaleString('ru-RU', {
                  maximumFractionDigits: 1,
                })}{' '}
                / {criterion.max}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-wine-600 to-wine-300 transition-all duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
