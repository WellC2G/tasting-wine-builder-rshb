import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { isUniqueViolation } from '../../common/database/is-unique-violation';
import { Participant } from '../auth/entities/participant.entity';
import {
  ScaleType,
  TastingMode,
} from '../events/entities/tasting-event.entity';
import {
  TastingRound,
  TastingRoundStatus,
} from '../events/entities/tasting-round.entity';
import { ParticipantCounterService } from '../realtime/participant-counter.service';
import { TastingSessionPublisherService } from '../realtime/tasting-session-publisher.service';
import type { SessionViewer } from '../tasting-session/interfaces/tasting-session.interfaces';
import { CreateRatingDto } from './dto/create-rating.dto';
import { RatingResponseDto } from './dto/rating-response.dto';
import { RoundStatsResponseDto } from './dto/round-stats-response.dto';
import { Rating } from './entities/rating.entity';
import { ParkerQualityCategory } from './enums/parker-quality-category.enum';
import { OutlierFilterService } from './services/outlier-filter.service';
import { ParkerScoreCalculator } from './services/parker-calculator.service';

const VOTING_CLOSED_MESSAGE =
  'Приём оценок по данному образцу закрыт';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating)
    private readonly ratingsRepository: Repository<Rating>,
    @InjectRepository(TastingRound)
    private readonly roundsRepository: Repository<TastingRound>,
    private readonly calculator: ParkerScoreCalculator,
    private readonly outlierFilterService: OutlierFilterService,
    private readonly participantCounterService: ParticipantCounterService,
    private readonly publisher: TastingSessionPublisherService,
  ) {}

  async submitRating(
    roundId: string,
    dto: CreateRatingDto,
    participant: Participant,
  ): Promise<RatingResponseDto> {
    const round = await this.roundsRepository.findOne({
      where: { id: roundId },
      relations: { event: true },
    });

    if (!round) {
      throw new NotFoundException('Раунд не найден');
    }

    if (participant.eventId !== round.eventId) {
      throw new ForbiddenException(
        'Вы не участвуете в этой дегустации',
      );
    }

    if (round.status !== TastingRoundStatus.ACTIVE) {
      throw new HttpException(VOTING_CLOSED_MESSAGE, 423);
    }

    const existingRating = await this.ratingsRepository.findOneBy({
      roundId,
      participantId: participant.id,
    });

    const scaleType = round.event.scaleType;
    let totalScore: number;
    let appearanceScore: number | null = null;
    let aromaScore: number | null = null;
    let tasteScore: number | null = null;
    let potentialScore: number | null = null;

    if (scaleType === ScaleType.PARKER_100) {
      if (!dto.parkerBreakdown) {
        throw new BadRequestException(
          'Для шкалы PARKER_100 заполните оценки по критериям Паркера',
        );
      }

      totalScore = this.calculator.calculateParkerTotal(
        dto.parkerBreakdown,
      );
      appearanceScore = dto.parkerBreakdown.appearance;
      aromaScore = dto.parkerBreakdown.aroma;
      tasteScore = dto.parkerBreakdown.taste;
      potentialScore = dto.parkerBreakdown.potential;
    } else {
      if (dto.stars === undefined) {
        throw new BadRequestException(
          'Для шкалы STARS_5 укажите оценку от 1 до 5 звёзд',
        );
      }

      totalScore = this.calculator.projectStarsToParker(dto.stars);
    }

    const qualityCategory: ParkerQualityCategory =
      this.calculator.getQualityCategory(totalScore);
    const rating =
      existingRating ??
      this.ratingsRepository.create({
        roundId,
        participantId: participant.id,
      });

    rating.appearanceScore = appearanceScore;
    rating.aromaScore = aromaScore;
    rating.tasteScore = tasteScore;
    rating.potentialScore = potentialScore;
    rating.totalScore = totalScore;
    rating.qualityCategory = qualityCategory;
    rating.sweetness = dto.organoleptics.sweetness;
    rating.acidity = dto.organoleptics.acidity;
    rating.tannins = dto.organoleptics.tannins;
    rating.body = dto.organoleptics.body;
    rating.aromaIntensity = dto.organoleptics.aromaIntensity;
    rating.aromaTags = dto.aromaTags ?? [];
    rating.personalNotes = dto.personalNotes ?? null;
    rating.isOutlier = false;

    let savedRating: Rating;

    try {
      savedRating = await this.ratingsRepository.save(rating);
    } catch (error) {
      if (
        !isUniqueViolation(error, 'uq_ratings_round_participant')
      ) {
        throw error;
      }

      const concurrentRating =
        await this.ratingsRepository.findOneBy({
          roundId,
          participantId: participant.id,
        });

      if (!concurrentRating) {
        throw error;
      }

      concurrentRating.appearanceScore = appearanceScore;
      concurrentRating.aromaScore = aromaScore;
      concurrentRating.tasteScore = tasteScore;
      concurrentRating.potentialScore = potentialScore;
      concurrentRating.totalScore = totalScore;
      concurrentRating.qualityCategory = qualityCategory;
      concurrentRating.sweetness = dto.organoleptics.sweetness;
      concurrentRating.acidity = dto.organoleptics.acidity;
      concurrentRating.tannins = dto.organoleptics.tannins;
      concurrentRating.body = dto.organoleptics.body;
      concurrentRating.aromaIntensity =
        dto.organoleptics.aromaIntensity;
      concurrentRating.aromaTags = dto.aromaTags ?? [];
      concurrentRating.personalNotes = dto.personalNotes ?? null;
      concurrentRating.isOutlier = false;
      savedRating = await this.ratingsRepository.save(concurrentRating);
    }

    const counter = await this.participantCounterService.getCounter(
      round.eventId,
      round.id,
    );
    this.publisher.emitParticipantCounter(round.eventId, counter);

    return {
      ratingId: savedRating.id,
      roundId,
      participantId: participant.id,
      scaleType,
      baseScore: 50,
      parkerBreakdown:
        scaleType === ScaleType.PARKER_100
          ? dto.parkerBreakdown ?? null
          : null,
      stars:
        scaleType === ScaleType.STARS_5
          ? dto.stars ?? null
          : null,
      totalScore,
      qualityCategory,
      qualityLabel:
        this.calculator.getQualityLabel(qualityCategory),
      organoleptics: {
        sweetness: savedRating.sweetness,
        acidity: savedRating.acidity,
        tannins: savedRating.tannins,
        body: savedRating.body,
        aromaIntensity: savedRating.aromaIntensity,
      },
      aromaTags: savedRating.aromaTags,
      personalNotes: savedRating.personalNotes,
    };
  }

  async getRoundStats(
    roundId: string,
    viewer: SessionViewer,
  ): Promise<RoundStatsResponseDto> {
    const round = await this.roundsRepository.findOne({
      where: { id: roundId },
      relations: { event: true },
    });

    if (!round) {
      throw new NotFoundException('Раунд не найден');
    }

    if (viewer.role === 'HOST' && round.event.hostId !== viewer.hostId) {
      throw new NotFoundException('Раунд не найден');
    }

    if (viewer.role === 'GUEST') {
      if (viewer.eventId !== round.eventId) {
        throw new NotFoundException('Раунд не найден');
      }

      if (
        round.event.mode !== TastingMode.OPEN &&
        round.status !== TastingRoundStatus.REVEALED
      ) {
        throw new ForbiddenException(
          'Статистика будет доступна после раскрытия образца',
        );
      }
    }

    return this.outlierFilterService.filterAndAggregate(round.id);
  }
}
