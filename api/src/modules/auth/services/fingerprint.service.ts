import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FingerprintInput {
  clientIp: string;
  deviceId: string;
  userAgent: string;
  screenResolution: string;
  eventId: string;
}

export interface EnvironmentHashInput {
  userAgent: string;
  screenResolution: string;
  eventId: string;
}

export function normalizeScreenResolution(value: string): string {
  const match = /^(\d{3,5})x(\d{3,5})$/i.exec(value.trim());

  if (!match) {
    return value.trim();
  }

  const first = Number(match[1]);
  const second = Number(match[2]);

  return `${Math.min(first, second)}x${Math.max(first, second)}`;
}

@Injectable()
export class FingerprintService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * SHA-256(clientIp + deviceId + userAgent + normalizedScreenResolution +
   * eventId + SERVER_SALT).
   */
  calculate(input: FingerprintInput): string {
    const serverSalt =
      this.configService.getOrThrow<string>('SERVER_SALT');
    const normalizedResolution = normalizeScreenResolution(
      input.screenResolution,
    );

    return createHash('sha256')
      .update(
        `${input.clientIp}${input.deviceId}${input.userAgent}` +
          `${normalizedResolution}${input.eventId}${serverSalt}`,
      )
      .digest('hex');
  }

  /**
   * Stable profile hash used only by the Docker desktop NAT safeguard.
   * It detects a second browser/incognito profile on the same physical device
   * when all LAN clients appear behind the same bridge gateway.
   */
  calculateEnvironmentHash(input: EnvironmentHashInput): string {
    const serverSalt =
      this.configService.getOrThrow<string>('SERVER_SALT');
    const normalizedResolution = normalizeScreenResolution(
      input.screenResolution,
    );

    return createHash('sha256')
      .update(
        `${input.userAgent}${normalizedResolution}${input.eventId}${serverSalt}`,
      )
      .digest('hex');
  }
}
