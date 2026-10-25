import { randomInt } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { isUniqueViolation } from '../../common/database/is-unique-violation';
import { Wine } from '../catalog/entities/wine.entity';
import { Participant } from '../auth/entities/participant.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { EventRoundResponseDto } from './dto/event-round-response.dto';
import { EventSummaryResponseDto } from './dto/event-summary-response.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
import {
  ScaleType,
  TastingEvent,
  TastingEventStatus,
  TastingMode,
} from './entities/tasting-event.entity';
import {
  TastingRound,
  TastingRoundStatus,
} from './entities/tasting-round.entity';

interface CountRow {
  eventId: string;
  count: string;
}

interface ParticipantCountRow {
  eventId: string;
  total: string;
  online: string;
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(TastingEvent)
    private readonly eventsRepository: Repository<TastingEvent>,
    @InjectRepository(TastingRound)
    private readonly roundsRepository: Repository<TastingRound>,
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    @InjectRepository(Wine)
    private readonly winesRepository: Repository<Wine>,
  ) {}

  async create(
    dto: CreateEventDto,
    hostId: string,
  ): Promise<EventResponseDto> {
    this.assertUniqueOrderNumbers(dto);
    await this.assertWinesExist(dto.rounds.map((round) => round.wineId));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const sessionPin = await this.generateUniqueSessionPin();

      const event = this.eventsRepository.create({
        hostId,
        title: dto.title,
        sessionPin,
        mode: dto.mode ?? TastingMode.BLIND,
        scaleType: dto.scaleType ?? ScaleType.PARKER_100,
        status: TastingEventStatus.DRAFT,
        scheduledAt: dto.scheduledAt
          ? new Date(dto.scheduledAt)
          : null,
        rounds: dto.rounds.map((round) =>
          this.roundsRepository.create({
            wineId: round.wineId,
            orderNumber: round.orderNumber,
            blindLabel:
              round.blindLabel ?? `Образец №${round.orderNumber}`,
            durationSeconds: round.durationSeconds ?? 180,
            status: TastingRoundStatus.PENDING,
          }),
        ),
      });

      try {
        const savedEvent = await this.eventsRepository.save(event);
        return this.findOneForHost(savedEvent.id, hostId);
      } catch (error) {
        if (
          isUniqueViolation(
            error,
            'uq_tasting_events_session_pin',
          ) &&
          attempt < 2
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException(
      'Не удалось сгенерировать уникальный PIN-код сессии. Попробуйте ещё раз.',
    );
  }

  async findAllForHost(
    hostId: string,
  ): Promise<EventSummaryResponseDto[]> {
    const events = await this.eventsRepository.find({
      where: { hostId },
      order: { createdAt: 'DESC' },
    });

    if (events.length === 0) {
      return [];
    }

    const eventIds = events.map((event) => event.id);

    const [roundRows, participantRows] = await Promise.all([
      this.roundsRepository
        .createQueryBuilder('round')
        .select('round.event_id', 'eventId')
        .addSelect('COUNT(*)', 'count')
        .where('round.event_id IN (:...eventIds)', { eventIds })
        .groupBy('round.event_id')
        .getRawMany<CountRow>(),
      this.participantsRepository
        .createQueryBuilder('participant')
        .select('participant.event_id', 'eventId')
        .addSelect('COUNT(*)', 'total')
        .addSelect(
          'COUNT(*) FILTER (WHERE participant.is_online = TRUE)',
          'online',
        )
        .where('participant.event_id IN (:...eventIds)', {
          eventIds,
        })
        .groupBy('participant.event_id')
        .getRawMany<ParticipantCountRow>(),
    ]);

    const roundsByEvent = new Map(
      roundRows.map((row) => [row.eventId, Number(row.count)]),
    );
    const participantsByEvent = new Map(
      participantRows.map((row) => [row.eventId, row]),
    );

    return events.map((event) => {
      const participantRow = participantsByEvent.get(event.id);

      return EventSummaryResponseDto.fromEntity(
        event,
        roundsByEvent.get(event.id) ?? 0,
        participantRow ? Number(participantRow.total) : 0,
        participantRow ? Number(participantRow.online) : 0,
      );
    });
  }

  async findOneForHost(
    id: string,
    hostId: string,
  ): Promise<EventResponseDto> {
    const event = await this.eventsRepository.findOne({
      where: { id, hostId },
      relations: {
        rounds: {
          wine: true,
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Мероприятие не найдено');
    }

    const [participantCount, connectedParticipantCount] =
      await Promise.all([
        this.participantsRepository.countBy({ eventId: event.id }),
        this.participantsRepository.countBy({
          eventId: event.id,
          isOnline: true,
        }),
      ]);

    return EventResponseDto.fromDetail(
      event,
      participantCount,
      connectedParticipantCount,
    );
  }

  async updateStatus(
    id: string,
    hostId: string,
    dto: UpdateEventStatusDto,
  ): Promise<EventResponseDto> {
    const event = await this.eventsRepository.findOneBy({
      id,
      hostId,
    });

    if (!event) {
      throw new NotFoundException('Мероприятие не найдено');
    }

    event.status = dto.status;
    await this.eventsRepository.save(event);

    return this.findOneForHost(event.id, hostId);
  }

  async findRoundsForHost(
    id: string,
    hostId: string,
  ): Promise<EventRoundResponseDto[]> {
    const event = await this.eventsRepository.findOne({
      where: { id, hostId },
      relations: {
        rounds: {
          wine: true,
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Мероприятие не найдено');
    }

    return [...event.rounds]
      .sort((left, right) => left.orderNumber - right.orderNumber)
      .map((round) => EventRoundResponseDto.fromEntity(round));
  }

  private assertUniqueOrderNumbers(dto: CreateEventDto): void {
    const orderNumbers = dto.rounds.map((round) => round.orderNumber);

    if (new Set(orderNumbers).size !== orderNumbers.length) {
      throw new BadRequestException(
        'Порядковые номера раундов не должны повторяться',
      );
    }
  }

  private async assertWinesExist(wineIds: string[]): Promise<void> {
    const uniqueWineIds = [...new Set(wineIds)];
    const wines = await this.winesRepository.findBy({
      id: In(uniqueWineIds),
    });

    if (wines.length === uniqueWineIds.length) {
      return;
    }

    const foundIds = new Set(wines.map((wine) => wine.id));
    const missingIds = uniqueWineIds.filter(
      (wineId) => !foundIds.has(wineId),
    );

    throw new BadRequestException(
      `Не найдены вина с идентификаторами: ${missingIds.join(', ')}`,
    );
  }

  private async generateUniqueSessionPin(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const sessionPin = randomInt(100000, 1000000).toString();
      const exists = await this.eventsRepository.existsBy({
        sessionPin,
      });

      if (!exists) {
        return sessionPin;
      }
    }

    throw new ServiceUnavailableException(
      'Не удалось сгенерировать уникальный PIN-код сессии',
    );
  }
}
