import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
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
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedDemoHost();
  }

  async seedDemoHost(): Promise<void> {
    const existingUser = await this.usersRepository.findOneBy({
      email: DEMO_HOST_EMAIL,
    });

    if (existingUser) {
      this.logger.log(
        `Demo host account already exists: ${DEMO_HOST_EMAIL}`,
      );
      return;
    }

    const passwordHash = await hash(DEMO_HOST_PASSWORD, BCRYPT_SALT_ROUNDS);

    try {
      await this.usersRepository.save(
        this.usersRepository.create({
          email: DEMO_HOST_EMAIL,
          passwordHash,
          name: DEMO_HOST_NAME,
          role: UserRole.HOST,
        }),
      );
      this.logger.log(`Demo host account created: ${DEMO_HOST_EMAIL}`);
    } catch (error) {
      if (isUniqueViolation(error, 'uq_users_email')) {
        this.logger.log(
          `Demo host account was created concurrently: ${DEMO_HOST_EMAIL}`,
        );
        return;
      }

      throw error;
    }
  }
}
