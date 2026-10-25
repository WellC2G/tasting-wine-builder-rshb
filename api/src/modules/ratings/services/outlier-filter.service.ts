import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Rating } from '../entities/rating.entity';
import {
  AromaTagFrequencyDto,
  RoundStatsResponseDto,
} from '../dto/round-stats-response.dto';
import { ParkerScoreCalculator } from './parker-calculator.service';

const MIN_SAMPLE_SIZE = 5;
const OUTLIER_SIGMA_MULTIPLIER = 2;

@Injectable()
export class OutlierFilterService {
  constructor(
    @InjectRepository(Rating)
    private readonly ratingsRepository: Repository<Rating>,
    private readonly calculator: ParkerScoreCalculator,
  ) {}

  /**
   * Applies the 2-sigma rule to all ratings of a round, persists outlier
   * flags and returns aggregate statistics for the valid sample.
   */
  async filterAndAggregate(
    roundId: string,
  ): Promise<RoundStatsResponseDto> {
    const ratings = await this.ratingsRepository.find({
      where: { roundId },
      order: { createdAt: 'ASC' },
    });

    const outlierIds = this.findOutlierIds(ratings);
    const changedRatings = ratings.filter(
      (rating) => rating.isOutlier !== outlierIds.has(rating.id),
    );

    for (const rating of ratings) {
      rating.isOutlier = outlierIds.has(rating.id);
    }

    if (changedRatings.length > 0) {
      await this.ratingsRepository.save(changedRatings);
    }

    const validRatings = ratings.filter(
      (rating) => !rating.isOutlier,
    );
    const validScores = validRatings.map(
      (rating) => rating.totalScore,
    );
    const meanScore = this.average(validScores);
    const qualityCategory =
      meanScore === null
        ? null
        : this.calculator.getQualityCategory(meanScore);

    return {
      roundId,
      totalRatings: ratings.length,
      validVotesCount: validRatings.length,
      outliersRemovedCount: outlierIds.size,
      meanScore: this.roundValue(meanScore, 1),
      medianScore: this.roundValue(
        this.median(validScores),
        1,
      ),
      stdDev: this.roundValue(
        this.standardDeviation(validScores),
        2,
      ),
      qualityCategory,
      qualityLabel:
        qualityCategory === null
          ? null
          : this.calculator.getQualityLabel(qualityCategory),
      criteriaMeans: {
        base: 50,
        appearance: this.roundValue(
          this.average(
            validRatings.map((rating) => rating.appearanceScore),
          ),
          1,
        ),
        aroma: this.roundValue(
          this.average(
            validRatings.map((rating) => rating.aromaScore),
          ),
          1,
        ),
        taste: this.roundValue(
          this.average(
            validRatings.map((rating) => rating.tasteScore),
          ),
          1,
        ),
        potential: this.roundValue(
          this.average(
            validRatings.map((rating) => rating.potentialScore),
          ),
          1,
        ),
      },
      radarProfile: {
        sweetness: this.roundValue(
          this.average(
            validRatings.map((rating) => rating.sweetness),
          ),
          1,
        ),
        acidity: this.roundValue(
          this.average(
            validRatings.map((rating) => rating.acidity),
          ),
          1,
        ),
        tannins: this.roundValue(
          this.average(
            validRatings.map((rating) => rating.tannins),
          ),
          1,
        ),
        body: this.roundValue(
          this.average(
            validRatings.map((rating) => rating.body),
          ),
          1,
        ),
        aromaIntensity: this.roundValue(
          this.average(
            validRatings.map((rating) => rating.aromaIntensity),
          ),
          1,
        ),
      },
      aromaTagFrequency: this.countAromaTags(validRatings),
    };
  }

  private findOutlierIds(ratings: Rating[]): Set<string> {
    if (ratings.length < MIN_SAMPLE_SIZE) {
      return new Set<string>();
    }

    const scores = ratings.map((rating) => rating.totalScore);
    const mean = this.average(scores);

    if (mean === null) {
      return new Set<string>();
    }

    const stdDev = this.standardDeviation(scores);

    if (stdDev === null || stdDev === 0) {
      return new Set<string>();
    }

    const threshold = OUTLIER_SIGMA_MULTIPLIER * stdDev;

    return new Set(
      ratings
        .filter(
          (rating) =>
            Math.abs(rating.totalScore - mean) > threshold,
        )
        .map((rating) => rating.id),
    );
  }

  private countAromaTags(
    ratings: Rating[],
  ): AromaTagFrequencyDto[] {
    const counts = new Map<string, number>();

    for (const rating of ratings) {
      for (const tag of rating.aromaTags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort(
        (left, right) =>
          right.count - left.count ||
          left.tag.localeCompare(right.tag, 'ru'),
      );
  }

  private average(values: Array<number | null>): number | null {
    const numericValues = values.filter(
      (value): value is number => value !== null,
    );

    if (numericValues.length === 0) {
      return null;
    }

    return (
      numericValues.reduce((sum, value) => sum + value, 0) /
      numericValues.length
    );
  }

  private median(values: number[]): number | null {
    if (values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 1) {
      return sorted[middle];
    }

    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  private standardDeviation(values: number[]): number | null {
    if (values.length === 0) {
      return null;
    }

    const mean = this.average(values);

    if (mean === null) {
      return null;
    }

    const variance =
      values.reduce(
        (sum, value) => sum + (value - mean) ** 2,
        0,
      ) / values.length;

    return Math.sqrt(variance);
  }

  private roundValue(
    value: number | null,
    digits: number,
  ): number | null {
    if (value === null) {
      return null;
    }

    const multiplier = 10 ** digits;

    return Math.round(value * multiplier) / multiplier;
  }
}
