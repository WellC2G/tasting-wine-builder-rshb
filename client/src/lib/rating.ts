import type {
  Organoleptics,
  ParkerBreakdown,
  ParkerQualityCategory,
} from '@/types/api';
import { pluralize } from './format';

export const PARKER_SLIDERS: Array<{
  key: keyof ParkerBreakdown;
  label: string;
  hint: string;
  max: number;
}> = [
  {
    key: 'appearance',
    label: 'Цвет и прозрачность',
    hint: 'Прозрачность, блеск и глубина оттенка',
    max: 5,
  },
  {
    key: 'aroma',
    label: 'Аромат и букет',
    hint: 'Чистота, интенсивность и сложность аромата',
    max: 15,
  },
  {
    key: 'taste',
    label: 'Вкус и послевкусие',
    hint: 'Баланс, структура и длительность послевкусия',
    max: 20,
  },
  {
    key: 'potential',
    label: 'Общее качество и потенциал',
    hint: 'Гармоничность, типичность и потенциал выдержки',
    max: 10,
  },
];

export const ORGANOLEPTIC_SLIDERS: Array<{
  key: keyof Organoleptics;
  label: string;
}> = [
  { key: 'sweetness', label: 'Сладость' },
  { key: 'acidity', label: 'Кислотность' },
  { key: 'tannins', label: 'Танины' },
  { key: 'body', label: 'Тельность' },
  { key: 'aromaIntensity', label: 'Интенсивность аромата' },
];

export const AROMA_TAGS = [
  'вишня',
  'смородина',
  'дуб',
  'ваниль',
  'перец',
  'кожа',
  'цветы',
  'цитрус',
  'минералы',
  'ягоды',
] as const;

export const QUALITY_LABELS: Record<
  ParkerQualityCategory,
  string
> = {
  CLASSIC: 'Великие вина (Classic / Extraordinary)',
  OUTSTANDING: 'Выдающиеся вина (Outstanding)',
  VERY_GOOD: 'Очень хорошие вина (Very Good)',
  GOOD: 'Хорошие вина (Good / Above Average)',
  AVERAGE: 'Посредственные вина (Average)',
  UNACCEPTABLE: 'Неприемлемые / Дефектные (Poor / Appalling)',
};

export function calculateParkerTotal(
  breakdown: ParkerBreakdown,
): number {
  return (
    50 +
    breakdown.appearance +
    breakdown.aroma +
    breakdown.taste +
    breakdown.potential
  );
}

export function getQualityCategory(
  score: number,
): ParkerQualityCategory {
  if (score >= 95) {
    return 'CLASSIC';
  }

  if (score >= 90) {
    return 'OUTSTANDING';
  }

  if (score >= 85) {
    return 'VERY_GOOD';
  }

  if (score >= 80) {
    return 'GOOD';
  }

  if (score >= 70) {
    return 'AVERAGE';
  }

  return 'UNACCEPTABLE';
}

export function getQualityLabel(
  category: ParkerQualityCategory,
): string {
  return QUALITY_LABELS[category];
}

export function formatScoreSummary(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  const category = getQualityCategory(rounded);
  const word = pluralize(
    Math.round(rounded),
    'балл',
    'балла',
    'баллов',
  );

  return `${rounded} ${word} — ${QUALITY_LABELS[category]}`;
}

export function qualityTone(
  category: ParkerQualityCategory | null,
): string {
  switch (category) {
    case 'CLASSIC':
      return 'border-amber-300/40 bg-amber-300/10 text-amber-200';
    case 'OUTSTANDING':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300';
    case 'VERY_GOOD':
      return 'border-sky-400/30 bg-sky-400/10 text-sky-200';
    case 'GOOD':
      return 'border-lime-400/30 bg-lime-400/10 text-lime-200';
    case 'AVERAGE':
      return 'border-orange-400/30 bg-orange-400/10 text-orange-200';
    case 'UNACCEPTABLE':
    default:
      return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
  }
}
