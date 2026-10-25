import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';

import { tastingRoom } from '../tasting-session/tasting-session.constants';
import type { ParticipantCounterPayload } from '../tasting-session/interfaces/tasting-session.interfaces';

@Injectable()
export class TastingSessionPublisherService {
  private server: Namespace | null = null;

  setServer(server: Namespace): void {
    this.server = server;
  }

  emitToEvent(
    eventId: string,
    eventName: string,
    payload: unknown,
  ): void {
    this.server?.to(tastingRoom(eventId)).emit(eventName, payload);
  }

  emitParticipantCounter(
    eventId: string,
    counter: ParticipantCounterPayload,
  ): void {
    this.emitToEvent(
      eventId,
      'participant_counter_updated',
      counter,
    );
  }
}
