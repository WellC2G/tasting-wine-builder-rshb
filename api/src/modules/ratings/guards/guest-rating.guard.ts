import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Participant } from '../../auth/entities/participant.entity';
import type { RatingsGuestRequest } from '../interfaces/ratings-request.interface';

@Injectable()
export class GuestRatingGuard implements CanActivate {
  constructor(
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RatingsGuestRequest>();
    const guestHeader = request.headers['x-guest-token'];
    const guestSessionToken = Array.isArray(guestHeader)
      ? guestHeader[0]
      : guestHeader;

    if (!guestSessionToken) {
      throw new UnauthorizedException('Требуется гостевой токен');
    }

    const participant = await this.participantsRepository.findOneBy({
      guestSessionToken: guestSessionToken.trim(),
    });

    if (!participant) {
      throw new UnauthorizedException(
        'Недействительный гостевой токен',
      );
    }

    request.ratingParticipant = participant;

    return true;
  }
}
