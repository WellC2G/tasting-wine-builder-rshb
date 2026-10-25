import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TastingEvent } from '../events/entities/tasting-event.entity';
import { TastingRound } from '../events/entities/tasting-round.entity';
import { AuthController } from './auth.controller';
import { JWT_EXPIRES_IN } from './auth.constants';
import { Participant } from './entities/participant.entity';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './services/auth.service';
import { FingerprintService } from './services/fingerprint.service';
import { HostSeederService } from './services/host-seeder.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      User,
      Participant,
      TastingEvent,
      TastingRound,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: JWT_EXPIRES_IN,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    FingerprintService,
    HostSeederService,
    JwtAuthGuard,
  ],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
