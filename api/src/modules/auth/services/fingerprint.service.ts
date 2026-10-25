import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FingerprintInput {
  clientIp: string;
  userAgent: string;
  screenResolution: string;
  eventId: string;
}

@Injectable()
export class FingerprintService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Formula from the architecture specification:
   * SHA-256(clientIp + userAgent + screenResolution + eventId + SERVER_SALT)
   */
  calculate(input: FingerprintInput): string {
    const serverSalt =
      this.configService.getOrThrow<string>('SERVER_SALT');

    return createHash('sha256')
      .update(
        `${input.clientIp}${input.userAgent}${input.screenResolution}${input.eventId}${serverSalt}`,
      )
      .digest('hex');
  }
}
