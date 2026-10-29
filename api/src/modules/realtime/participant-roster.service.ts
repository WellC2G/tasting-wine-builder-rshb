import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Participant } from '../auth/entities/participant.entity';
import { EventParticipantDto } from '../events/dto/event-participant.dto';
import { ParticipantCounterService } from './participant-counter.service';
import { TastingSessionPublisherService } from './tasting-session-publisher.service';

interface ParticipantsUpdatedPayload {
  eventId: string;
  participants: EventParticipantDto[];
}

@Injectable()
export class ParticipantRosterService {
  constructor(
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    private readonly participantCounterService: ParticipantCounterService,
    private readonly publisher: TastingSessionPublisherService,
  ) {}

  async listParticipants(
    eventId: string,
  ): Promise<EventParticipantDto[]> {
    const participants = await this.participantsRepository.find({
      where: { eventId },
      order: { joinedAt: 'ASC' },
    });

    return participants.map((participant) =>
      EventParticipantDto.fromEntity(participant),
    );
  }

  async broadcastParticipantsUpdated(
    eventId: string,
  ): Promise<EventParticipantDto[]> {
    const participants = await this.listParticipants(eventId);
    const payload: ParticipantsUpdatedPayload = {
      eventId,
      participants,
    };

    this.publisher.emitToEvent(
      eventId,
      'participants_updated',
      payload,
    );

    return participants;
  }

  async broadcastCounter(
    eventId: string,
    roundId?: string,
  ): Promise<void> {
    const counter = await this.participantCounterService.getCounter(
      eventId,
      roundId,
    );

    this.publisher.emitParticipantCounter(eventId, counter);
  }

  async broadcastRosterAndCounter(
    eventId: string,
    roundId?: string,
  ): Promise<EventParticipantDto[]> {
    const participants =
      await this.broadcastParticipantsUpdated(eventId);

    await this.broadcastCounter(eventId, roundId);

    return participants;
  }
}
