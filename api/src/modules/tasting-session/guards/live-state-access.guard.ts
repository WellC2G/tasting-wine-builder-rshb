import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import {
  AUTH_REQUIRED_MESSAGE,
  EVENT_NOT_FOUND_MESSAGE,
} from '../tasting-session.constants';
import type { JwtPayload } from '../../auth/interfaces/authenticated-request.interface';
import type {
  LiveStateRequest,
  SessionViewer,
} from '../interfaces/tasting-session.interfaces';
import { TastingSessionService } from '../tasting-session.service';

@Injectable()
export class LiveStateAccessGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly tastingSessionService: TastingSessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<LiveStateRequest>();
    const eventId = request.params.id;

    if (!eventId) {
      throw new UnauthorizedException(AUTH_REQUIRED_MESSAGE);
    }

    const authorization = request.headers.authorization;

    if (authorization) {
      const viewer = await this.authenticateHost(authorization);
      request.sessionViewer = viewer;
      return true;
    }

    const guestHeader = request.headers['x-guest-token'];
    const guestSessionToken = Array.isArray(guestHeader)
      ? guestHeader[0]
      : guestHeader;

    if (!guestSessionToken) {
      throw new UnauthorizedException(AUTH_REQUIRED_MESSAGE);
    }

    const participant =
      await this.tastingSessionService.findParticipantByToken(
        guestSessionToken.trim(),
      );

    if (!participant) {
      throw new UnauthorizedException('Недействительный гостевой токен');
    }

    if (participant.eventId !== eventId) {
      throw new NotFoundException(EVENT_NOT_FOUND_MESSAGE);
    }

    request.sessionViewer = {
      role: 'GUEST',
      participantId: participant.id,
      eventId: participant.eventId,
    };

    return true;
  }

  private async authenticateHost(
    authorization: string,
  ): Promise<SessionViewer> {
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Недействительный токен организатора',
      );
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException(
        'Недействительный или истёкший токен',
      );
    }

    if (
      !payload.sub ||
      (payload.role !== 'HOST' && payload.role !== 'ADMIN')
    ) {
      throw new ForbiddenException(
        'Недостаточно прав для просмотра состояния сессии',
      );
    }

    return { role: 'HOST', hostId: payload.sub };
  }
}
