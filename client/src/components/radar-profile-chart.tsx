'use client';

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import { useMounted } from '@/components/page-loader';
import type { RadarProfile } from '@/types/api';

interface RadarProfileChartProps {
  profile: RadarProfile;
  height?: number;
  compact?: boolean;
}

export function RadarProfileChart({
  profile,
  height = 300,
  compact = false,
}: RadarProfileChartProps) {
  const mounted = useMounted();

  const data = [
    { subject: 'Сладость', value: profile.sweetness ?? 0 },
    { subject: 'Кислотность', value: profile.acidity ?? 0 },
    { subject: 'Танины', value: profile.tannins ?? 0 },
    { subject: 'Тело', value: profile.body ?? 0 },
    {
      subject: 'Аромат',
      value: profile.aromaIntensity ?? 0,
    },
  ];

  if (!mounted) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] text-xs text-stone-500"
        style={{ height }}
      >
        Готовим профиль…
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius={compact ? '70%' : '78%'}>
          <PolarGrid stroke="rgba(255,255,255,0.12)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{
              fill: '#d6d3d1',
              fontSize: compact ? 10 : 12,
            }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 10]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Профиль"
            dataKey="value"
            stroke="#fb7185"
            fill="#f43f5e"
            fillOpacity={0.35}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(value: number) => [
              value.toLocaleString('ru-RU'),
              'Оценка',
            ]}
            contentStyle={{
              backgroundColor: '#0c0a09',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              color: '#f5f5f4',
              fontSize: 12,
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
