import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { Repository } from 'typeorm';

import { isUniqueViolation } from '../../../common/database/is-unique-violation';
import {
  BCRYPT_SALT_ROUNDS,
  DEMO_HOST_EMAIL,
  DEMO_HOST_NAME,
  DEMO_HOST_PASSWORD,
} from '../auth.constants';
import { User, UserRole } from '../entities/user.entity';

@Injectable()
export class HostSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(HostSeederService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedDemoHost();
  }

  async seedDemoHost(): Promise<void> {
    const email =
      this.configService.get<string>('HOST_EMAIL')?.trim() ||
      DEMO_HOST_EMAIL;
    const configuredPassword =
      this.configService.get<string>('HOST_PASSWORD');
    const password =
      configuredPassword && configuredPassword.length > 0
        ? configuredPassword
        : DEMO_HOST_PASSWORD;
    const name =
      this.configService.get<string>('HOST_NAME')?.trim() ||
      DEMO_HOST_NAME;
    const existingUser = await this.usersRepository.findOneBy({
      email,
    });

    if (existingUser) {
      let changed = false;

      if (existingUser.name !== name) {
        existingUser.name = name;
        changed = true;
      }

      if (!(await compare(password, existingUser.passwordHash))) {
        existingUser.passwordHash = await hash(
          password,
          BCRYPT_SALT_ROUNDS,
        );
        changed = true;
      }

      if (changed) {
        await this.usersRepository.save(existingUser);
        this.logger.log(`Host account updated: ${email}`);
      } else {
        this.logger.log(`Host account already exists: ${email}`);
      }

      return;
    }

    const passwordHash = await hash(password, BCRYPT_SALT_ROUNDS);

    try {
      await this.usersRepository.save(
        this.usersRepository.create({
          email,
          passwordHash,
          name,
          role: UserRole.HOST,
        }),
      );
      this.logger.log(`Host account created: ${email}`);
    } catch (error) {
      if (isUniqueViolation(error, 'uq_users_email')) {
        this.logger.log(
          `Host account was created concurrently: ${email}`,
        );
        return;
      }

      throw error;
    }
  }
}
