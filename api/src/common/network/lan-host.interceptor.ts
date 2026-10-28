import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';

import { LanAddressService } from './lan-address.service';

@Injectable()
export class LanHostInterceptor implements NestInterceptor {
  constructor(
    private readonly lanAddressService: LanAddressService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<Request>();

      this.lanAddressService.observeRequest(
        request.headers.host,
        request.headers.origin,
        request.headers.referer,
      );
    }

    return next.handle();
  }
}
