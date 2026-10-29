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
import { FindOptionsWhere, Repository } from 'typeorm';

import { isUniqueViolation } from '../../../common/database/is-unique-violation';
import {
  isSharedDockerGatewayIp,
  normalizeIp,
  type RequestContext,
} from '../../../common/http/request-context';
import { WineResponseDto } from '../../catalog/dto/wine-response.dto';
import { ParticipantRosterService } from '../../realtime/participant-roster.service';
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

interface FindOrCreateParticipantParams {
  eventId: string;
  nickname: string;
  deviceId: string;
  clientIp: string;
  fingerprintHash: string;
  environmentHash: string;
}

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
    private readonly participantRosterService: ParticipantRosterService,
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

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findOneBy({ id: userId });

    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    return UserResponseDto.fromEntity(user);
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

    const clientIp = this.resolveEffectiveClientIp(
      context.clientIp,
      dto.webrtcLocalIps,
    );

    const environmentHash =
      this.fingerprintService.calculateEnvironmentHash({
        osFamily: dto.osFamily ?? '',
        userAgent: context.userAgent,
        screenResolution: dto.screenResolution,
        pixelRatio: dto.pixelRatio ?? 1,
        colorDepth: dto.colorDepth ?? 24,
        timeZone: dto.timeZone ?? 'UTC',
        maxTouchPoints: dto.maxTouchPoints ?? 0,
        eventId: event.id,
      });
    const fingerprintHash = this.fingerprintService.calculate({
      clientIp,
      deviceId: dto.deviceId,
      userAgent: context.userAgent,
      screenResolution: dto.screenResolution,
      eventId: event.id,
    });

    const participant = await this.findOrCreateParticipant({
      eventId: event.id,
      nickname: dto.nickname,
      deviceId: dto.deviceId,
      clientIp,
      fingerprintHash,
      environmentHash,
    });

    const currentRound = this.selectCurrentRound(event.rounds);

    await this.participantRosterService.broadcastRosterAndCounter(
      event.id,
      currentRound?.id,
    );

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
    params: FindOrCreateParticipantParams,
  ): Promise<Participant> {
    const {
      eventId,
      nickname,
      deviceId,
      clientIp,
      fingerprintHash,
      environmentHash,
    } = params;
    const candidates = await this.findParticipantCandidates(
      eventId,
      deviceId,
      fingerprintHash,
      environmentHash,
    );
    const existingParticipant =
      candidates.find(
        (participant) => participant.deviceId === deviceId,
      ) ??
      candidates.find(
        (participant) =>
          participant.environmentHash === environmentHash,
      ) ??
      candidates.find(
        (participant) =>
          participant.fingerprintHash === fingerprintHash,
      );

    if (existingParticipant) {
      return this.resumeParticipant(
        existingParticipant,
        nickname,
        environmentHash,
        clientIp,
      );
    }

    const participant = this.participantsRepository.create({
      eventId,
      clientIp,
      deviceId,
      environmentHash,
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

      return this.resumeParticipant(
        concurrentlyCreated,
        nickname,
        environmentHash,
        clientIp,
      );
    }
  }

  private async findParticipantCandidates(
    eventId: string,
    deviceId: string,
    fingerprintHash: string,
    environmentHash: string,
  ): Promise<Participant[]> {
    return this.participantsRepository.find({
      where: [
        { eventId, deviceId },
        { eventId, environmentHash },
        { eventId, fingerprintHash },
      ],
      order: { joinedAt: 'ASC' },
    });
  }

  private resumeParticipant(
    participant: Participant,
    nickname: string,
    environmentHash: string,
    clientIp: string,
  ): Promise<Participant> {
    participant.nickname = nickname;
    participant.isOnline = true;
    participant.environmentHash = environmentHash;

    if (clientIp !== 'unknown') {
      participant.clientIp = clientIp;
    }

    return this.participantsRepository.save(participant);
  }

  private resolveEffectiveClientIp(
    currentIp: string,
    webrtcLocalIps: string[] | undefined,
  ): string {
    const needsLanIp =
      currentIp === 'unknown' ||
      currentIp === '127.0.0.1' ||
      isSharedDockerGatewayIp(currentIp);

    if (!needsLanIp) {
      return currentIp;
    }

    const lanIp = (webrtcLocalIps ?? [])
      .map((value) => normalizeIp(value))
      .find(
        (value): value is string =>
          value !== null && this.isClientLanIp(value),
      );

    return lanIp ?? currentIp;
  }

  private isClientLanIp(ip: string): boolean {
    if (normalizeIp(ip) !== ip) {
      return false;
    }

    const parts = ip.split('.').map(Number);

    if (
      parts.length !== 4 ||
      parts.some((part) => !Number.isInteger(part))
    ) {
      return false;
    }

    return (
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 20 && parts[1] <= 31)
    );
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
    const isWineRevealed =
      mode === TastingMode.OPEN || round.revealedAt !== null;
    const dto: GuestCurrentRoundDto = {
      roundId: round.id,
      orderNumber: round.orderNumber,
      blindLabel: round.blindLabel,
      status: round.status,
      durationSeconds: round.durationSeconds,
      remainingSeconds: this.calculateRemainingSeconds(round),
      isWineRevealed,
    };

    if (isWineRevealed && round.wine) {
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
