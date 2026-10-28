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

export const OS_FAMILIES = [
  'Windows',
  'macOS',
  'iOS',
  'Android',
  'Linux',
  'Other',
] as const;

export type OsFamily = (typeof OS_FAMILIES)[number];

export interface EnvironmentHashInput {
  osFamily: string;
  userAgent?: string;
  screenResolution: string;
  pixelRatio: number;
  colorDepth: number;
  timeZone: string;
  maxTouchPoints: number;
  eventId: string;
}

export function normalizeOsFamily(
  value: string | undefined,
  userAgent = '',
  maxTouchPoints = 0,
): OsFamily {
  const normalizedValue = value?.trim().toLowerCase();
  const aliases: Record<string, OsFamily> = {
    windows: 'Windows',
    macos: 'macOS',
    'mac os': 'macOS',
    ios: 'iOS',
    android: 'Android',
    linux: 'Linux',
    other: 'Other',
  };

  if (normalizedValue && aliases[normalizedValue]) {
    return aliases[normalizedValue];
  }

  const normalizedAgent = userAgent.toLowerCase();

  if (normalizedAgent.includes('android')) {
    return 'Android';
  }

  if (
    normalizedAgent.includes('iphone') ||
    normalizedAgent.includes('ipad') ||
    normalizedAgent.includes('ipod')
  ) {
    return 'iOS';
  }

  if (normalizedAgent.includes('windows')) {
    return 'Windows';
  }

  if (
    normalizedAgent.includes('macintosh') ||
    normalizedAgent.includes('mac os x')
  ) {
    return maxTouchPoints > 1 ? 'iOS' : 'macOS';
  }

  if (normalizedAgent.includes('linux')) {
    return 'Linux';
  }

  return 'Other';
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
   * Browser-agnostic hardware signature. User-Agent is used only as a
   * fallback to normalize the OS family and is not part of the hash.
   */
  calculateEnvironmentHash(input: EnvironmentHashInput): string {
    const serverSalt =
      this.configService.getOrThrow<string>('SERVER_SALT');
    const osFamily = normalizeOsFamily(
      input.osFamily,
      input.userAgent,
      input.maxTouchPoints,
    );
    const normalizedResolution = normalizeScreenResolution(
      input.screenResolution,
    );
    const pixelRatio = Number.isFinite(input.pixelRatio)
      ? Math.round(input.pixelRatio * 100) / 100
      : 1;
    const colorDepth = Number.isFinite(input.colorDepth)
      ? Math.trunc(input.colorDepth)
      : 24;
    const timeZone = input.timeZone.trim() || 'UTC';
    const maxTouchPoints = input.maxTouchPoints > 0 ? 1 : 0;

    return createHash('sha256')
      .update(
        `${osFamily}${normalizedResolution}${pixelRatio}` +
          `${colorDepth}${timeZone}${maxTouchPoints}` +
          `${input.eventId}${serverSalt}`,
      )
      .digest('hex');
  }
}
