import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  TastingEvent,
  TastingEventStatus,
} from '../events/entities/tasting-event.entity';
import { ParkerQualityCategory } from '../ratings/enums/parker-quality-category.enum';
import { OutlierFilterService } from '../ratings/services/outlier-filter.service';
import { PeoplesRatingClientAdapter } from './adapters/peoples-rating-client.adapter';
import { ExportLogResponseDto } from './dto/export-log-response.dto';
import { ExportPayloadDto } from './dto/export-payload.dto';
import { ExportResponseDto } from './dto/export-response.dto';
import { ExportSampleDto } from './dto/export-sample.dto';
import { ExportLog } from './entities/export-log.entity';

const SOURCE_SYSTEM = 'tasting-constructor-v1';
const SCHEMA_VERSION = '1.0.0';
const MAX_TOP_AROMA_DESCRIPTORS = 5;

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @InjectRepository(ExportLog)
    private readonly exportLogsRepository: Repository<ExportLog>,
    @InjectRepository(TastingEvent)
    private readonly eventsRepository: Repository<TastingEvent>,
    private readonly outlierFilterService: OutlierFilterService,
    private readonly adapter: PeoplesRatingClientAdapter,
  ) {}

  async exportEvent(
    eventId: string,
    hostId: string,
  ): Promise<ExportResponseDto> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId, hostId },
      relations: {
        rounds: {
          wine: true,
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Мероприятие не найдено');
    }

    if (event.rounds.length === 0) {
      throw new BadRequestException(
        'В мероприятии нет раундов для экспорта',
      );
    }

    const sortedRounds = [...event.rounds].sort(
      (left, right) => left.orderNumber - right.orderNumber,
    );
    const samples: ExportSampleDto[] = [];

    for (const round of sortedRounds) {
      const stats = await this.outlierFilterService.filterAndAggregate(
        round.id,
      );
      const meanScore = stats.meanScore;

      if (stats.validVotesCount === 0 || meanScore === null) {
        continue;
      }

      samples.push({
        externalWineId: round.wine.externalCatalogId,
        totalParticipants: stats.totalRatings,
        validVotesCount: stats.validVotesCount,
        outliersRemovedCount: stats.outliersRemovedCount,
        aggregatedParkerScore: {
          mean: meanScore,
          median: stats.medianScore ?? meanScore,
          stdDev: stats.stdDev ?? 0,
          qualityCategory:
            stats.qualityCategory ??
            ParkerQualityCategory.UNACCEPTABLE,
          criteriaMeans: {
            base: 50,
            appearance: stats.criteriaMeans.appearance ?? 0,
            aroma: stats.criteriaMeans.aroma ?? 0,
            taste: stats.criteriaMeans.taste ?? 0,
            potential: stats.criteriaMeans.potential ?? 0,
          },
        },
        organolepticProfile: {
          sweetness: stats.radarProfile.sweetness ?? 1,
          acidity: stats.radarProfile.acidity ?? 1,
          tannins: stats.radarProfile.tannins ?? 1,
          body: stats.radarProfile.body ?? 1,
          aromaIntensity:
            stats.radarProfile.aromaIntensity ?? 1,
        },
        topAromaDescriptors: stats.aromaTagFrequency
          .slice(0, MAX_TOP_AROMA_DESCRIPTORS)
          .map((entry) => entry.tag),
      });
    }

    if (samples.length === 0) {
      throw new BadRequestException(
        'В мероприятии нет валидных оценок для экспорта',
      );
    }

    const dispatchedPayload: ExportPayloadDto = {
      sourceSystem: SOURCE_SYSTEM,
      schemaVersion: SCHEMA_VERSION,
      eventId: event.id,
      tastingMode: event.mode,
      scoringMethodology: event.scaleType,
      exportedAt: new Date().toISOString(),
      samples,
    };
    const validVotesCount = samples.reduce(
      (sum, sample) => sum + sample.validVotesCount,
      0,
    );
    const rejectedOutliersCount = samples.reduce(
      (sum, sample) => sum + sample.outliersRemovedCount,
      0,
    );
    const dispatchResult = await this.adapter.dispatch(
      dispatchedPayload,
    );
    const exportLog = await this.exportLogsRepository.save(
      this.exportLogsRepository.create({
        eventId: event.id,
        targetEndpoint: dispatchResult.targetEndpoint,
        mockReceiptId: dispatchResult.receiptId,
        validVotesCount,
        rejectedOutliersCount,
        payloadSnapshot: dispatchedPayload,
        externalStatus: dispatchResult.externalStatus,
      }),
    );

    if (!dispatchResult.success) {
      this.logger.error(
        `Export failed for event ${event.id}: ` +
          `${dispatchResult.errorMessage ?? 'unknown error'}`,
      );
      throw new BadGatewayException(
        `Не удалось отправить пакет в «Народный винный рейтинг»: ` +
          `${dispatchResult.errorMessage ?? 'неизвестная ошибка'}`,
      );
    }

    event.status = TastingEventStatus.EXPORTED;
    await this.eventsRepository.save(event);

    return {
      exportMeta: {
        exportLogId: exportLog.id,
        simulationMode: dispatchResult.isMockTarget,
        targetEndpoint: dispatchResult.targetEndpoint,
        mockReceiptId: dispatchResult.receiptId,
        status: dispatchResult.externalStatus,
        validVotesCount,
        rejectedOutliersCount,
      },
      dispatchedPayload,
    };
  }

  async findExportLogs(
    eventId: string,
    hostId: string,
  ): Promise<ExportLogResponseDto[]> {
    const event = await this.eventsRepository.findOneBy({
      id: eventId,
      hostId,
    });

    if (!event) {
      throw new NotFoundException('Мероприятие не найдено');
    }

    const logs = await this.exportLogsRepository.find({
      where: { eventId },
      order: { exportedAt: 'DESC' },
    });

    return logs.map((log) => ExportLogResponseDto.fromEntity(log));
  }
}
