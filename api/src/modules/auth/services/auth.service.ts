import { randomBytes } from 'node:crypto';

import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { Repository } from 'typeorm';

import { isUniqueViolation } from '../../../common/database/is-unique-violation';
import type { RequestContext } from '../../../common/http/request-context';
import { WineResponseDto } from '../../catalog/dto/wine-response.dto';
import {
  TastingEvent,
  TastingEventStatus,
  TastingMode,
} from '../../events/entities/tasting-event.entity';
import {
  TastingRound,
  TastingRoundStatus,
} from '../../events/entities/tasting-round.entity';
import {
  BCRYPT_SALT_ROUNDS,
  JWT_EXPIRES_IN_SECONDS,
} from '../auth.constants';
import {
  AuthTokenResponseDto,
} from '../dto/auth-token-response.dto';
import {
  GuestCurrentRoundDto,
  GuestJoinResponseDto,
} from '../dto/guest-join-response.dto';
import { GuestJoinDto } from '../dto/guest-join.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { Participant } from '../entities/participant.entity';
import { User, UserRole } from '../entities/user.entity';
import { FingerprintService } from './fingerprint.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Participant)
    private readonly participantsRepository: Repository<Participant>,
    @InjectRepository(TastingEvent)
    private readonly eventsRepository: Repository<TastingEvent>,
    private readonly jwtService: JwtService,
    private readonly fingerprintService: FingerprintService,
  ) {}

  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const existingUser = await this.usersRepository.findOneBy({
      email: dto.email,
    });

    if (existingUser) {
      throw new ConflictException(
        'Пользователь с таким email уже зарегистрирован',
      );
    }

    const passwordHash = await hash(dto.password, BCRYPT_SALT_ROUNDS);

    try {
      const user = await this.usersRepository.save(
        this.usersRepository.create({
          email: dto.email,
          passwordHash,
          name: dto.name,
          role: UserRole.HOST,
        }),
      );

      return UserResponseDto.fromEntity(user);
    } catch (error) {
      if (isUniqueViolation(error, 'uq_users_email')) {
        throw new ConflictException(
          'Пользователь с таким email уже зарегистрирован',
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthTokenResponseDto> {
    const user = await this.usersRepository.findOneBy({
      email: dto.email,
    });

    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const passwordMatches = await compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: JWT_EXPIRES_IN_SECONDS,
      user: UserResponseDto.fromEntity(user),
    };
  }

  async guestJoin(
    dto: GuestJoinDto,
    context: RequestContext,
  ): Promise<GuestJoinResponseDto> {
    const event = await this.eventsRepository.findOne({
      where: { sessionPin: dto.sessionPin },
      relations: {
        rounds: {
          wine: true,
        },
      },
    });

    if (!event) {
      throw new NotFoundException(
        `Сессия дегустации с PIN-кодом ${dto.sessionPin} не найдена`,
      );
    }

    if (
      event.status === TastingEventStatus.FINISHED ||
      event.status === TastingEventStatus.EXPORTED
    ) {
      throw new ConflictException('Сессия дегустации уже завершена');
    }

    const fingerprintHash = this.fingerprintService.calculate({
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      screenResolution: dto.screenResolution,
      eventId: event.id,
    });

    const participant = await this.findOrCreateParticipant(
      event.id,
      fingerprintHash,
      dto.nickname,
    );

    const currentRound = this.selectCurrentRound(event.rounds);

    return {
      participantId: participant.id,
      guestSessionToken: participant.guestSessionToken,
      event: {
        eventId: event.id,
        title: event.title,
        mode: event.mode,
        scaleType: event.scaleType,
        currentRound: currentRound
          ? this.toGuestRound(currentRound, event.mode)
          : null,
      },
    };
  }

  private async findOrCreateParticipant(
    eventId: string,
    fingerprintHash: string,
    nickname: string,
  ): Promise<Participant> {
    const existingParticipant = await this.participantsRepository.findOneBy({
      eventId,
      fingerprintHash,
    });

    if (existingParticipant) {
      existingParticipant.nickname = nickname;
      existingParticipant.isOnline = true;
      return this.participantsRepository.save(existingParticipant);
    }

    const participant = this.participantsRepository.create({
      eventId,
      fingerprintHash,
      nickname,
      guestSessionToken: this.createGuestSessionToken(),
      isOnline: true,
    });

    try {
      return await this.participantsRepository.save(participant);
    } catch (error) {
      if (
        !isUniqueViolation(
          error,
          'uq_participants_event_fingerprint',
        )
      ) {
        throw error;
      }

      const concurrentlyCreated =
        await this.participantsRepository.findOneBy({
          eventId,
          fingerprintHash,
        });

      if (!concurrentlyCreated) {
        throw error;
      }

      concurrentlyCreated.nickname = nickname;
      concurrentlyCreated.isOnline = true;
      return this.participantsRepository.save(concurrentlyCreated);
    }
  }

  private selectCurrentRound(
    rounds: TastingRound[],
  ): TastingRound | null {
    const sortedRounds = [...rounds].sort(
      (left, right) => left.orderNumber - right.orderNumber,
    );

    return (
      sortedRounds.find(
        (round) => round.status === TastingRoundStatus.ACTIVE,
      ) ??
      sortedRounds.find(
        (round) => round.status === TastingRoundStatus.PENDING,
      ) ??
      null
    );
  }

  private toGuestRound(
    round: TastingRound,
    mode: TastingMode,
  ): GuestCurrentRoundDto {
    const dto: GuestCurrentRoundDto = {
      roundId: round.id,
      orderNumber: round.orderNumber,
      blindLabel: round.blindLabel,
      status: round.status,
      durationSeconds: round.durationSeconds,
      remainingSeconds: this.calculateRemainingSeconds(round),
    };

    if (mode === TastingMode.OPEN && round.wine) {
      dto.wine = WineResponseDto.fromEntity(round.wine);
    }

    return dto;
  }

  private calculateRemainingSeconds(round: TastingRound): number {
    if (
      round.status === TastingRoundStatus.ACTIVE &&
      round.startedAt
    ) {
      const elapsedSeconds = Math.floor(
        (Date.now() - round.startedAt.getTime()) / 1000,
      );

      return Math.max(0, round.durationSeconds - elapsedSeconds);
    }

    if (round.status === TastingRoundStatus.PENDING) {
      return round.durationSeconds;
    }

    return 0;
  }

  private createGuestSessionToken(): string {
    return `gst_${randomBytes(32).toString('base64url')}`;
  }
}
