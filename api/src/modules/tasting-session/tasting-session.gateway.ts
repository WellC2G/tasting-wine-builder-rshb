import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { HttpException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import type { Namespace, Socket } from 'socket.io';

import type { JwtPayload } from '../auth/interfaces/authenticated-request.interface';
import { TastingMode } from '../events/entities/tasting-event.entity';
import { TastingRoundStatus } from '../events/entities/tasting-round.entity';
import { OutlierFilterService } from '../ratings/services/outlier-filter.service';
import { TastingSessionPublisherService } from '../realtime/tasting-session-publisher.service';
import {
  AUTH_ERROR_MESSAGE,
  BOTTLE_REVEALED_MESSAGE,
  INVALID_ACTION_PAYLOAD_MESSAGE,
  SESSION_ACCESS_DENIED_MESSAGE,
  SESSION_ACTION_ERROR_MESSAGE,
  SESSION_CONNECTION_ERROR_MESSAGE,
  STATS_OPENED_MESSAGE,
  TASTING_NAMESPACE,
  TIMER_EXPIRED_MESSAGE,
  VOTING_CLOSED_BY_HOST_MESSAGE,
  tastingRoom,
} from './tasting-session.constants';
import { TastingSessionService } from './tasting-session.service';
import { RoomStateService } from './room-state.service';
import type {
  AddRoundTimePayload,
  JoinEventPayload,
  ParticipantCounterPayload,
  RestartRoundPayload,
  RoundActionPayload,
  SocketAuthContext,
  StartRoundPayload,
  TastingSocketData,
  WineDetails,
} from './interfaces/tasting-session.interfaces';
import type { Wine } from '../catalog/entities/wine.entity';

type TastingSocket = Socket & { data: TastingSocketData };

@WebSocketGateway({
  namespace: TASTING_NAMESPACE,
  cors: {
    origin: true,
    credentials: true,
  },
})
export class TastingSessionGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TastingSessionGateway.name);
  private readonly participantSockets = new Map<string, Set<string>>();

  @WebSocketServer()
  private server!: Namespace;

  constructor(
    private readonly jwtService: JwtService,
    private readonly tastingSessionService: TastingSessionService,
    private readonly roomStateService: RoomStateService,
    private readonly outlierFilterService: OutlierFilterService,
    private readonly publisher: TastingSessionPublisherService,
  ) {}

  afterInit(server: Namespace): void {
    this.publisher.setServer(server);

    server.use((socket, next) => {
      const tastingSocket = socket as TastingSocket;

      this.authenticateSocket(tastingSocket)
        .then((auth) => {
          tastingSocket.data.auth = auth;
          next();
        })
        .catch(() => {
          next(new Error(AUTH_ERROR_MESSAGE));
        });
    });
  }

  async handleConnection(socket: TastingSocket): Promise<void> {
    const auth = socket.data.auth;

    if (!auth) {
      this.rejectSocket(socket, AUTH_ERROR_MESSAGE);
      return;
    }

    try {
      if (auth.role === 'HOST') {
        await this.attachHost(socket, auth);
      } else {
        await this.attachGuest(socket, auth);
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize socket ${socket.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      this.rejectSocket(socket, SESSION_CONNECTION_ERROR_MESSAGE);
    }
  }

  async handleDisconnect(socket: TastingSocket): Promise<void> {
    const auth = socket.data.auth;

    if (!auth || auth.role !== 'GUEST') {
      return;
    }

    const hasOtherSockets = this.unregisterParticipantSocket(
      auth.participantId,
      socket.id,
    );

    if (hasOtherSockets) {
      return;
    }

    try {
      await this.tastingSessionService.setParticipantOnline(
        auth.participantId,
        false,
      );
      await this.broadcastParticipantCounter(auth.eventId);
    } catch (error) {
      this.logger.error(
        `Failed to update participant ${auth.participantId} on disconnect`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @SubscribeMessage('host:join_event')
  async handleJoinEvent(
    @ConnectedSocket() socket: TastingSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    await this.runHostAction(socket, async (hostId) => {
      if (!this.isJoinEventPayload(payload)) {
        this.emitSessionError(socket, INVALID_ACTION_PAYLOAD_MESSAGE);
        return;
      }

      const eventIds =
        await this.tastingSessionService.findHostEventIds(hostId);

      if (!eventIds.includes(payload.eventId)) {
        this.emitSessionError(socket, SESSION_ACCESS_DENIED_MESSAGE);
        return;
      }

      await socket.join(tastingRoom(payload.eventId));
      const counter =
        await this.tastingSessionService.getParticipantCounter(
          payload.eventId,
        );

      socket.emit('participant_counter_updated', counter);
    });
  }

  @SubscribeMessage('host:start_event')
  async handleStartEvent(
    @ConnectedSocket() socket: TastingSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    await this.runHostAction(socket, async (hostId) => {
      if (!this.isJoinEventPayload(payload)) {
        this.emitSessionError(socket, INVALID_ACTION_PAYLOAD_MESSAGE);
        return;
      }

      const event = await this.tastingSessionService.startEvent(
        payload.eventId,
        hostId,
      );
      const room = tastingRoom(event.id);

      await socket.join(room);
      await this.broadcastParticipantCounter(event.id);
    });
  }

  @SubscribeMessage('host:finish_event')
  async handleFinishEvent(
    @ConnectedSocket() socket: TastingSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    await this.runHostAction(socket, async (hostId) => {
      if (!this.isJoinEventPayload(payload)) {
        this.emitSessionError(socket, INVALID_ACTION_PAYLOAD_MESSAGE);
        return;
      }

      const event = await this.tastingSessionService.finishEvent(
        payload.eventId,
        hostId,
      );
      const room = tastingRoom(event.id);

      await socket.join(room);
      await this.broadcastParticipantCounter(event.id);
    });
  }

  @SubscribeMessage('host:start_round')
  async handleStartRound(
    @ConnectedSocket() socket: TastingSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    await this.runHostAction(socket, async (hostId) => {
      if (!this.isStartRoundPayload(payload)) {
        this.emitSessionError(socket, INVALID_ACTION_PAYLOAD_MESSAGE);
        return;
      }

      const { event, round, endsAt } =
        await this.tastingSessionService.startRound(
          payload.eventId,
          payload.roundId,
          hostId,
          payload.durationSeconds,
        );

      const room = tastingRoom(event.id);
      await socket.join(room);

      this.startTimerForRound(
        event.id,
        round.id,
        round.durationSeconds,
        endsAt,
      );

      const basePayload = {
        roundId: round.id,
        orderNumber: round.orderNumber,
        blindLabel: round.blindLabel,
        scaleType: event.scaleType,
        durationSeconds: round.durationSeconds,
        remainingSeconds: round.durationSeconds,
        endsAt: endsAt.toISOString(),
      };

      if (event.mode === TastingMode.OPEN) {
        this.server.to(room).emit('round_started', {
          ...basePayload,
          wine: this.toWineDetails(round.wine),
        });
      } else {
        this.server.to(room).emit('round_started', basePayload);
      }

      const counter =
        await this.tastingSessionService.getParticipantCounter(
          event.id,
          round.id,
        );

      this.server
        .to(room)
        .emit('participant_counter_updated', counter);
    });
  }

  @SubscribeMessage('host:lock_voting')
  async handleLockVoting(
    @ConnectedSocket() socket: TastingSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    await this.runHostAction(socket, async (hostId) => {
      if (!this.isRoundActionPayload(payload)) {
        this.emitSessionError(socket, INVALID_ACTION_PAYLOAD_MESSAGE);
        return;
      }

      const { event, round, remainingSeconds } =
        await this.tastingSessionService.lockVoting(
          payload.eventId,
          payload.roundId,
          hostId,
        );

      const room = tastingRoom(event.id);
      await socket.join(room);

      this.server.to(room).emit('voting_closed', {
        roundId: round.id,
        remainingSeconds,
        endsAt: null,
        message: VOTING_CLOSED_BY_HOST_MESSAGE,
      });

      const counter =
        await this.tastingSessionService.getParticipantCounter(
          event.id,
          round.id,
        );

      this.server
        .to(room)
        .emit('participant_counter_updated', counter);
    });
  }

  @SubscribeMessage('host:resume_round')
  async handleResumeRound(
    @ConnectedSocket() socket: TastingSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    await this.runHostAction(socket, async (hostId) => {
      if (!this.isRoundActionPayload(payload)) {
        this.emitSessionError(socket, INVALID_ACTION_PAYLOAD_MESSAGE);
        return;
      }

      const { event, round, endsAt } =
        await this.tastingSessionService.resumeRound(
          payload.eventId,
          payload.roundId,
          hostId,
        );

      const room = tastingRoom(event.id);
      await socket.join(room);
      this.startTimerForRound(
        event.id,
        round.id,
        round.durationSeconds,
        endsAt,
      );

      const basePayload = {
        roundId: round.id,
        orderNumber: round.orderNumber,
        blindLabel: round.blindLabel,
        scaleType: event.scaleType,
        durationSeconds: round.durationSeconds,
        remainingSeconds: round.durationSeconds,
        endsAt: endsAt.toISOString(),
        isResumed: true,
      };

      if (event.mode === TastingMode.OPEN) {
        this.server.to(room).emit('round_started', {
          ...basePayload,
          wine: this.toWineDetails(round.wine),
        });
      } else {
        this.server.to(room).emit('round_started', basePayload);
      }

      const counter =
        await this.tastingSessionService.getParticipantCounter(
          event.id,
          round.id,
        );

      this.server
        .to(room)
        .emit('participant_counter_updated', counter);
    });
  }

  @SubscribeMessage('host:add_round_time')
  async handleAddRoundTime(
    @ConnectedSocket() socket: TastingSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    await this.runHostAction(socket, async (hostId) => {
      if (!this.isAddRoundTimePayload(payload)) {
        this.emitSessionError(socket, INVALID_ACTION_PAYLOAD_MESSAGE);
        return;
      }

      const { event, round, endsAt, remainingSeconds } =
        await this.tastingSessionService.addRoundTime(
          payload.eventId,
          payload.roundId,
          hostId,
          payload.additionalSeconds,
        );

      const room = tastingRoom(event.id);
      await socket.join(room);

      if (round.status === TastingRoundStatus.ACTIVE && endsAt) {
        this.startTimerForRound(
          event.id,
          round.id,
          round.durationSeconds,
          endsAt,
        );
      }

      this.server.to(room).emit('round_timer_updated', {
        roundId: round.id,
        status: round.status,
        durationSeconds: round.durationSeconds,
        endsAt: endsAt ? endsAt.toISOString() : null,
        remainingSeconds,
      });
    });
  }

  @SubscribeMessage('host:restart_round')
  async handleRestartRound(
    @ConnectedSocket() socket: TastingSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    await this.runHostAction(socket, async (hostId) => {
      if (!this.isRestartRoundPayload(payload)) {
        this.emitSessionError(socket, INVALID_ACTION_PAYLOAD_MESSAGE);
        return;
      }

      const { event, round, endsAt } =
        await this.tastingSessionService.restartRound(
          payload.eventId,
          payload.roundId,
          hostId,
          payload.durationSeconds,
        );

      const room = tastingRoom(event.id);
      await socket.join(room);
      this.startTimerForRound(
        event.id,
        round.id,
        round.durationSeconds,
        endsAt,
      );

      const basePayload = {
        roundId: round.id,
        orderNumber: round.orderNumber,
        blindLabel: round.blindLabel,
        scaleType: event.scaleType,
        durationSeconds: round.durationSeconds,
        remainingSeconds: round.durationSeconds,
        endsAt: endsAt.toISOString(),
        resetRatings: true,
      };

      if (event.mode === TastingMode.OPEN) {
        this.server.to(room).emit('round_started', {
          ...basePayload,
          wine: this.toWineDetails(round.wine),
        });
      } else {
        this.server.to(room).emit('round_started', basePayload);
      }

      const counter =
        await this.tastingSessionService.getParticipantCounter(
          event.id,
          round.id,
        );

      this.server
        .to(room)
        .emit('participant_counter_updated', counter);
    });
  }

  @SubscribeMessage('host:skip_round')
  async handleSkipRound(
    @ConnectedSocket() socket: TastingSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    await this.runHostAction(socket, async (hostId) => {
      if (!this.isRoundActionPayload(payload)) {
        this.emitSessionError(socket, INVALID_ACTION_PAYLOAD_MESSAGE);
        return;
      }

      const { event, round } =
        await this.tastingSessionService.skipRound(
          payload.eventId,
          payload.roundId,
          hostId,
        );

      const room = tastingRoom(event.id);
      await socket.join(room);

      this.server.to(room).emit('round_skipped', {
        roundId: round.id,
        blindLabel: round.blindLabel,
        message: 'Образец пропущен ведущим',
      });

      const counter =
        await this.tastingSessionService.getParticipantCounter(
          event.id,
          round.id,
        );

      this.server
        .to(room)
        .emit('participant_counter_updated', counter);
    });
  }

  @SubscribeMessage('host:reveal_bottle')
  async handleRevealBottle(
    @ConnectedSocket() socket: TastingSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    await this.runHostAction(socket, async (hostId) => {
      if (!this.isRoundActionPayload(payload)) {
        this.emitSessionError(socket, INVALID_ACTION_PAYLOAD_MESSAGE);
        return;
      }

      const { event, round, wine } =
        await this.tastingSessionService.revealBottle(
          payload.eventId,
          payload.roundId,
          hostId,
        );

      const room = tastingRoom(event.id);
      this.roomStateService.clearRoundTimer(event.id, round.id);
      await socket.join(room);

      const stats =
        await this.outlierFilterService.filterAndAggregate(round.id);

      this.server.to(room).emit('bottle_revealed', {
        roundId: round.id,
        orderNumber: round.orderNumber,
        blindLabel: round.blindLabel,
        wine: this.toWineDetails(wine),
        stats,
        message: BOTTLE_REVEALED_MESSAGE,
      });

      const counter =
        await this.tastingSessionService.getParticipantCounter(
          event.id,
          round.id,
        );

      this.server
        .to(room)
        .emit('participant_counter_updated', counter);
    });
  }

  @SubscribeMessage('host:show_stats')
  async handleShowStats(
    @ConnectedSocket() socket: TastingSocket,
    @MessageBody() payload: unknown,
  ): Promise<void> {
    await this.runHostAction(socket, async (hostId) => {
      if (!this.isRoundActionPayload(payload)) {
        this.emitSessionError(socket, INVALID_ACTION_PAYLOAD_MESSAGE);
        return;
      }

      const { event, round } =
        await this.tastingSessionService.findRoundForStatistics(
          payload.eventId,
          payload.roundId,
          hostId,
        );
      const stats =
        await this.outlierFilterService.filterAndAggregate(round.id);

      if (
        round.status !== TastingRoundStatus.REVEALED &&
        stats.totalRatings === 0
      ) {
        this.emitSessionError(
          socket,
          'Для этого раунда пока нет оценок',
        );
        return;
      }

      const room = tastingRoom(event.id);
      await socket.join(room);
      this.roomStateService.setLastViewedRound(event.id, round.id);

      this.server.to(room).emit('bottle_revealed', {
        roundId: round.id,
        orderNumber: round.orderNumber,
        blindLabel: round.blindLabel,
        wine: this.toWineDetails(round.wine),
        stats,
        message: STATS_OPENED_MESSAGE,
      });

      const counter =
        await this.tastingSessionService.getParticipantCounter(
          event.id,
          round.id,
        );

      this.server
        .to(room)
        .emit('participant_counter_updated', counter);
    });
  }

  private async authenticateSocket(
    socket: TastingSocket,
  ): Promise<SocketAuthContext> {
    const rawToken = socket.handshake.auth?.token;

    if (typeof rawToken !== 'string' || rawToken.trim().length === 0) {
      throw new Error(AUTH_ERROR_MESSAGE);
    }

    const token = rawToken.trim();

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      if (
        payload.sub &&
        payload.email &&
        (payload.role === 'HOST' || payload.role === 'ADMIN')
      ) {
        return {
          role: 'HOST',
          hostId: payload.sub,
          email: payload.email,
        };
      }
    } catch {
      // A guest token is not a JWT; fall through to the participant lookup.
    }

    const participant =
      await this.tastingSessionService.findParticipantByToken(token);

    if (!participant) {
      throw new Error(AUTH_ERROR_MESSAGE);
    }

    return {
      role: 'GUEST',
      participantId: participant.id,
      eventId: participant.eventId,
    };
  }

  private async attachHost(
    socket: TastingSocket,
    auth: Extract<SocketAuthContext, { role: 'HOST' }>,
  ): Promise<void> {
    const eventIds = await this.tastingSessionService.findHostEventIds(
      auth.hostId,
    );

    for (const eventId of eventIds) {
      await socket.join(tastingRoom(eventId));
      const counter = await this.tastingSessionService.getParticipantCounter(
        eventId,
      );
      socket.emit('participant_counter_updated', counter);
    }
  }

  private async attachGuest(
    socket: TastingSocket,
    auth: Extract<SocketAuthContext, { role: 'GUEST' }>,
  ): Promise<void> {
    this.registerParticipantSocket(auth.participantId, socket.id);
    await this.tastingSessionService.setParticipantOnline(
      auth.participantId,
      true,
    );
    await socket.join(tastingRoom(auth.eventId));
    await this.broadcastParticipantCounter(auth.eventId);
  }

  private async runHostAction(
    socket: TastingSocket,
    action: (hostId: string) => Promise<void>,
  ): Promise<void> {
    const auth = socket.data.auth;

    if (!auth || auth.role !== 'HOST') {
      this.emitSessionError(socket, SESSION_ACCESS_DENIED_MESSAGE);
      return;
    }

    try {
      await action(auth.hostId);
    } catch (error) {
      if (error instanceof HttpException) {
        this.emitSessionError(socket, error.message);
        return;
      }

      this.logger.error(
        'Host WebSocket action failed',
        error instanceof Error ? error.stack : String(error),
      );
      this.emitSessionError(socket, SESSION_ACTION_ERROR_MESSAGE);
    }
  }

  private startTimerForRound(
    eventId: string,
    roundId: string,
    durationSeconds: number,
    endsAt: Date,
  ): void {
    this.roomStateService.startRoundTimer({
      eventId,
      roundId,
      durationSeconds,
      endsAt,
      onExpire: () => this.handleRoundTimerExpired(eventId, roundId),
    });
  }

  private async handleRoundTimerExpired(
    eventId: string,
    roundId: string,
  ): Promise<void> {
    const room = tastingRoom(eventId);

    this.server.to(room).emit('voting_closed', {
      roundId,
      remainingSeconds: 0,
      endsAt: null,
      message: TIMER_EXPIRED_MESSAGE,
    });

    try {
      const counter =
        await this.tastingSessionService.getParticipantCounter(
          eventId,
          roundId,
        );

      this.server
        .to(room)
        .emit('participant_counter_updated', counter);
    } catch (error) {
      this.logger.error(
        `Failed to broadcast counter after round ${roundId} expiry`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async broadcastParticipantCounter(
    eventId: string,
    roundId?: string,
  ): Promise<void> {
    const counter: ParticipantCounterPayload =
      await this.tastingSessionService.getParticipantCounter(
        eventId,
        roundId,
      );

    this.server
      .to(tastingRoom(eventId))
      .emit('participant_counter_updated', counter);
  }

  private registerParticipantSocket(
    participantId: string,
    socketId: string,
  ): void {
    const sockets = this.participantSockets.get(participantId) ?? new Set();

    sockets.add(socketId);
    this.participantSockets.set(participantId, sockets);
  }

  private unregisterParticipantSocket(
    participantId: string,
    socketId: string,
  ): boolean {
    const sockets = this.participantSockets.get(participantId);

    if (!sockets) {
      return false;
    }

    sockets.delete(socketId);

    if (sockets.size === 0) {
      this.participantSockets.delete(participantId);
      return false;
    }

    return true;
  }

  private rejectSocket(socket: TastingSocket, message: string): void {
    socket.emit('auth_error', { message });
    const timeout = setTimeout(() => socket.disconnect(true), 50);

    if (typeof timeout.unref === 'function') {
      timeout.unref();
    }
  }

  private emitSessionError(
    socket: TastingSocket,
    message: string,
  ): void {
    socket.emit('session_error', { message });
  }

  private isJoinEventPayload(
    payload: unknown,
  ): payload is JoinEventPayload {
    if (typeof payload !== 'object' || payload === null) {
      return false;
    }

    const candidate = payload as Partial<JoinEventPayload>;

    return (
      typeof candidate.eventId === 'string' &&
      isUUID(candidate.eventId)
    );
  }

  private isStartRoundPayload(
    payload: unknown,
  ): payload is StartRoundPayload {
    if (typeof payload !== 'object' || payload === null) {
      return false;
    }

    const candidate = payload as Partial<StartRoundPayload>;

    return (
      typeof candidate.eventId === 'string' &&
      isUUID(candidate.eventId) &&
      typeof candidate.roundId === 'string' &&
      isUUID(candidate.roundId) &&
      (candidate.durationSeconds === undefined ||
        (Number.isInteger(candidate.durationSeconds) &&
          candidate.durationSeconds >= 1 &&
          candidate.durationSeconds <= 3600))
    );
  }

  private isRoundActionPayload(
    payload: unknown,
  ): payload is RoundActionPayload {
    if (typeof payload !== 'object' || payload === null) {
      return false;
    }

    const candidate = payload as Partial<RoundActionPayload>;

    return (
      typeof candidate.eventId === 'string' &&
      isUUID(candidate.eventId) &&
      typeof candidate.roundId === 'string' &&
      isUUID(candidate.roundId)
    );
  }

  private isAddRoundTimePayload(
    payload: unknown,
  ): payload is AddRoundTimePayload {
    if (!this.isRoundActionPayload(payload)) {
      return false;
    }

    const candidate = payload as Partial<AddRoundTimePayload>;

    return (
      Number.isInteger(candidate.additionalSeconds) &&
      (candidate.additionalSeconds ?? 0) >= 1 &&
      (candidate.additionalSeconds ?? 0) <= 3600
    );
  }

  private isRestartRoundPayload(
    payload: unknown,
  ): payload is RestartRoundPayload {
    if (!this.isRoundActionPayload(payload)) {
      return false;
    }

    const candidate = payload as Partial<RestartRoundPayload>;

    return (
      candidate.durationSeconds === undefined ||
      (Number.isInteger(candidate.durationSeconds) &&
        candidate.durationSeconds >= 1 &&
        candidate.durationSeconds <= 3600)
    );
  }

  private toWineDetails(wine: Wine): WineDetails {
    return {
      id: wine.id,
      name: wine.name,
      winery: wine.winery,
      region: wine.region,
      grapeVarieties: wine.grapeVarieties,
      vintage: wine.vintage,
      wineType: wine.wineType,
      retailPrice: wine.retailPrice,
      imageUrl: wine.imageUrl,
    };
  }
}
