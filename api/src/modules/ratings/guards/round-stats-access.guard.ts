import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Participant } from '../../auth/entities/participant.entity';
import type { JwtPayload } from '../../auth/interfaces/authenticated-request.interface';
import type { SessionViewer } from '../../tasting-session/interfaces/tasting-session.interfaces';
import type { RoundStatsRequest } from '../interfaces/ratings-request.interface';

@Injectable()
export class RoundStatsAccessGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RoundStatsRequest>();
    const authorization = request.headers.authorization;

    if (authorization) {
      request.sessionViewer =
        await this.authenticateHost(authorization);
      return true;
    }

    const guestHeader = request.headers['x-guest-token'];
    const guestSessionToken = Array.isArray(guestHeader)
      ? guestHeader[0]
      : guestHeader;

    if (!guestSessionToken) {
      throw new UnauthorizedException('Требуется авторизация');
    }

    const participant = await this.participantsRepository.findOneBy({
      guestSessionToken: guestSessionToken.trim(),
    });

    if (!participant) {
      throw new UnauthorizedException(
        'Недействительный гостевой токен',
      );
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
        'Недостаточно прав для просмотра статистики',
      );
    }

    return { role: 'HOST', hostId: payload.sub };
  }
}
