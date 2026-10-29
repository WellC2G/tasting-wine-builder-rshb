import { Injectable } from '@nestjs/common';

import { ParkerQualityCategory } from '../enums/parker-quality-category.enum';

export interface ParkerBreakdown {
  appearance: number;
  aroma: number;
  taste: number;
  potential: number;
}

const QUALITY_LABELS: Record<ParkerQualityCategory, string> = {
  [ParkerQualityCategory.CLASSIC]:
    'Великие вина (Classic / Extraordinary)',
  [ParkerQualityCategory.OUTSTANDING]: 'Выдающиеся вина (Outstanding)',
  [ParkerQualityCategory.VERY_GOOD]:
    'Очень хорошие вина (Very Good)',
  [ParkerQualityCategory.GOOD]:
    'Хорошие вина (Good / Above Average)',
  [ParkerQualityCategory.AVERAGE]: 'Посредственные вина (Average)',
  [ParkerQualityCategory.UNACCEPTABLE]:
    'Неприемлемые / Дефектные (Poor / Appalling)',
};

@Injectable()
export class ParkerScoreCalculator {
  calculateParkerTotal(breakdown: ParkerBreakdown): number {
    const total =
      50 +
      breakdown.appearance +
      breakdown.aroma +
      breakdown.taste +
      breakdown.potential;

    return Math.round(total * 10) / 10;
  }

  getQualityCategory(score: number): ParkerQualityCategory {
    if (!Number.isFinite(score) || score < 50 || score > 100) {
      throw new RangeError(
        'Итоговый балл должен находиться в диапазоне от 50 до 100',
      );
    }

    if (score >= 95) {
      return ParkerQualityCategory.CLASSIC;
    }

    if (score >= 90) {
      return ParkerQualityCategory.OUTSTANDING;
    }

    if (score >= 85) {
      return ParkerQualityCategory.VERY_GOOD;
    }

    if (score >= 80) {
      return ParkerQualityCategory.GOOD;
    }

    if (score >= 70) {
      return ParkerQualityCategory.AVERAGE;
    }

    return ParkerQualityCategory.UNACCEPTABLE;
  }

  getQualityLabel(category: ParkerQualityCategory): string {
    return QUALITY_LABELS[category];
  }

  getQualityLabelForScore(score: number): string {
    return this.getQualityLabel(this.getQualityCategory(score));
  }
}
