import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { UserRole } from '../entities/user.entity';
import type {
  AuthenticatedRequest,
  JwtPayload,
} from '../interfaces/authenticated-request.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Требуется авторизация');
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
      !payload.email ||
      (payload.role !== UserRole.HOST && payload.role !== UserRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'Недостаточно прав для выполнения операции',
      );
    }

    request.user = payload;

    return true;
  }
}
