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
import { TastingSessionService } from '../tasting-session/tasting-session.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { EventRoundResponseDto } from './dto/event-round-response.dto';
import { EventSummaryResponseDto } from './dto/event-summary-response.dto';
import { UpdateEventDto } from './dto/update-event.dto';
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
    private readonly tastingSessionService: TastingSessionService,
  ) {}

  async create(
    dto: CreateEventDto,
    hostId: string,
  ): Promise<EventResponseDto> {
    this.assertUniqueOrderNumbers(dto.rounds);
    const wines = await this.assertWinesExist(
      dto.rounds.map((round) => round.wineId),
    );
    const mode = dto.mode ?? TastingMode.BLIND;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const sessionPin = await this.generateUniqueSessionPin();

      const event = this.eventsRepository.create({
        hostId,
        title: dto.title,
        sessionPin,
        mode,
        scaleType: dto.scaleType ?? ScaleType.PARKER_100,
        status: TastingEventStatus.DRAFT,
        scheduledAt: dto.scheduledAt
          ? new Date(dto.scheduledAt)
          : null,
        rounds: dto.rounds.map((round) =>
          this.roundsRepository.create({
            wineId: round.wineId,
            orderNumber: round.orderNumber,
            blindLabel: this.resolveBlindLabel(
              round.blindLabel,
              round.orderNumber,
              mode,
              wines.get(round.wineId),
            ),
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

    if (dto.status === TastingEventStatus.ACTIVE) {
      await this.tastingSessionService.startEvent(id, hostId);
      return this.findOneForHost(id, hostId);
    }

    if (dto.status === TastingEventStatus.FINISHED) {
      await this.tastingSessionService.finishEvent(id, hostId);
      return this.findOneForHost(id, hostId);
    }

    event.status = dto.status;
    await this.eventsRepository.save(event);

    return this.findOneForHost(event.id, hostId);
  }

  async update(
    id: string,
    hostId: string,
    dto: UpdateEventDto,
  ): Promise<EventResponseDto> {
    const existing = await this.eventsRepository.findOneBy({
      id,
      hostId,
    });

    if (!existing) {
      throw new NotFoundException('Мероприятие не найдено');
    }

    if (existing.status !== TastingEventStatus.DRAFT) {
      throw new ConflictException(
        'Редактировать можно только черновики мероприятий',
      );
    }

    if (dto.rounds) {
      this.assertUniqueOrderNumbers(dto.rounds);
    }

    const wines = dto.rounds
      ? await this.assertWinesExist(
          dto.rounds.map((round) => round.wineId),
        )
      : new Map<string, Wine>();

    await this.eventsRepository.manager.transaction(
      async (manager) => {
        const event = await manager.findOne(TastingEvent, {
          where: { id, hostId },
          relations: { rounds: true },
        });

        if (!event) {
          throw new NotFoundException('Мероприятие не найдено');
        }

        if (event.status !== TastingEventStatus.DRAFT) {
          throw new ConflictException(
            'Редактировать можно только черновики мероприятий',
          );
        }

        const nextMode = dto.mode ?? event.mode;
        const updates: Partial<TastingEvent> = {};

        if (dto.title !== undefined) {
          updates.title = dto.title;
        }
        if (dto.mode !== undefined) {
          updates.mode = dto.mode;
        }
        if (dto.scaleType !== undefined) {
          updates.scaleType = dto.scaleType;
        }
        if (dto.scheduledAt !== undefined) {
          updates.scheduledAt = dto.scheduledAt
            ? new Date(dto.scheduledAt)
            : null;
        }

        if (Object.keys(updates).length > 0) {
          await manager.update(TastingEvent, { id }, updates);
        }

        if (dto.rounds) {
          await manager.delete(TastingRound, { eventId: id });
          const rounds = dto.rounds.map((round) =>
            manager.create(TastingRound, {
              eventId: id,
              wineId: round.wineId,
              orderNumber: round.orderNumber,
              blindLabel: this.resolveBlindLabel(
                round.blindLabel,
                round.orderNumber,
                nextMode,
                wines.get(round.wineId),
              ),
              durationSeconds: round.durationSeconds ?? 180,
              status: TastingRoundStatus.PENDING,
              startedAt: null,
              revealedAt: null,
            }),
          );
          await manager.save(rounds);
        }
      },
    );

    return this.findOneForHost(id, hostId);
  }

  async copy(id: string, hostId: string): Promise<EventResponseDto> {
    const source = await this.eventsRepository.findOne({
      where: { id, hostId },
      relations: { rounds: true },
    });

    if (!source) {
      throw new NotFoundException('Мероприятие не найдено');
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const sessionPin = await this.generateUniqueSessionPin();
      const copy = this.eventsRepository.create({
        hostId,
        title: `${source.title} (копия)`,
        sessionPin,
        mode: source.mode,
        scaleType: source.scaleType,
        status: TastingEventStatus.DRAFT,
        scheduledAt: source.scheduledAt,
        rounds: source.rounds.map((round) =>
          this.roundsRepository.create({
            wineId: round.wineId,
            orderNumber: round.orderNumber,
            blindLabel: round.blindLabel,
            durationSeconds: round.durationSeconds,
            status: TastingRoundStatus.PENDING,
            startedAt: null,
            revealedAt: null,
          }),
        ),
      });

      try {
        const saved = await this.eventsRepository.save(copy);
        return this.findOneForHost(saved.id, hostId);
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

  async remove(id: string, hostId: string): Promise<void> {
    const event = await this.eventsRepository.findOneBy({
      id,
      hostId,
    });

    if (!event) {
      throw new NotFoundException('Мероприятие не найдено');
    }

    if (event.status === TastingEventStatus.ACTIVE) {
      throw new ConflictException(
        'Нельзя удалить запущенную дегустацию. Сначала завершите её.',
      );
    }

    await this.eventsRepository.delete({ id, hostId });
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

  private assertUniqueOrderNumbers(
    rounds: Array<{ orderNumber: number }>,
  ): void {
    const orderNumbers = rounds.map((round) => round.orderNumber);

    if (new Set(orderNumbers).size !== orderNumbers.length) {
      throw new BadRequestException(
        'Порядковые номера раундов не должны повторяться',
      );
    }
  }

  private resolveBlindLabel(
    requestedLabel: string | undefined,
    orderNumber: number,
    mode: TastingMode,
    wine: Wine | undefined,
  ): string {
    const explicitLabel = requestedLabel?.trim();

    if (explicitLabel) {
      return explicitLabel;
    }

    if (mode === TastingMode.OPEN && wine) {
      return wine.name;
    }

    return `Образец №${orderNumber}`;
  }

  private async assertWinesExist(
    wineIds: string[],
  ): Promise<Map<string, Wine>> {
    const uniqueWineIds = [...new Set(wineIds)];
    const wines = await this.winesRepository.findBy({
      id: In(uniqueWineIds),
    });

    if (wines.length !== uniqueWineIds.length) {
      const foundIds = new Set(wines.map((wine) => wine.id));
      const missingIds = uniqueWineIds.filter(
        (wineId) => !foundIds.has(wineId),
      );

      throw new BadRequestException(
        `Не найдены вина с идентификаторами: ${missingIds.join(', ')}`,
      );
    }

    return new Map(wines.map((wine) => [wine.id, wine]));
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
