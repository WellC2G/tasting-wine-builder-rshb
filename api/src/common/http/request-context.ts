import { isIP } from 'node:net';

import type { Request } from 'express';

export interface RequestContext {
  clientIp: string;
  userAgent: string;
  hasProxyHeaders: boolean;
  hasForwardedClientIp: boolean;
}

function headerValues(
  value: string | string[] | undefined,
): string[] {
  if (!value) {
    return [];
  }

  return (Array.isArray(value) ? value : [value])
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Normalizes IPv4-mapped IPv6, loopback aliases and bracketed addresses.
 */
export function normalizeIp(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  let ip = value.trim();

  if (!ip) {
    return null;
  }

  if (ip.startsWith('[')) {
    const closingBracket = ip.indexOf(']');

    if (closingBracket !== -1) {
      ip = ip.slice(1, closingBracket);
    }
  }

  ip = ip.replace(/^::ffff:/i, '');

  if (ip === '::1') {
    return '127.0.0.1';
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.split(':')[0];
  }

  return isIP(ip) ? ip : null;
}

function isPublicIpv4(ip: string): boolean {
  const [first, second] = ip.split('.').map(Number);

  if (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127)
  ) {
    return false;
  }

  return true;
}

function isPublicIp(ip: string): boolean {
  const version = isIP(ip);

  if (version === 4) {
    return isPublicIpv4(ip);
  }

  if (version === 6) {
    const normalized = ip.toLowerCase();

    return (
      normalized !== '::' &&
      normalized !== '::1' &&
      !normalized.startsWith('fe80:') &&
      !normalized.startsWith('fc') &&
      !normalized.startsWith('fd')
    );
  }

  return false;
}

/**
 * Docker Desktop can hide the real LAN address behind its bridge gateway
 * when no client IP header is forwarded.
 */
export function isSharedDockerGatewayIp(ip: string): boolean {
  if (ip.startsWith('192.168.65.')) {
    return true;
  }

  if (isIP(ip) === 4) {
    const [first, second] = ip.split('.').map(Number);

    return first === 172 && second >= 16 && second <= 31;
  }

  return false;
}

/**
 * Extracts a stable client context for fingerprint calculation.
 * X-Real-IP wins, otherwise the first valid X-Forwarded-For address.
 */
export function getRequestContext(request: Request): RequestContext {
  const realIpCandidates = headerValues(
    request.headers['x-real-ip'],
  )
    .map((value) => normalizeIp(value))
    .filter((value): value is string => value !== null);
  const forwardedCandidates = headerValues(
    request.headers['x-forwarded-for'],
  )
    .map((value) => normalizeIp(value))
    .filter((value): value is string => value !== null);
  const socketIp = normalizeIp(
    request.ip ?? request.socket.remoteAddress,
  );
  const clientIp =
    realIpCandidates[0] ??
    forwardedCandidates[0] ??
    socketIp ??
    'unknown';
  const publicForwardedIps = new Set(
    forwardedCandidates.filter((ip) => isPublicIp(ip)),
  );
  const hasProxyHeaders =
    headerValues(request.headers.via).length > 0 ||
    headerValues(request.headers.forwarded).length > 0 ||
    publicForwardedIps.size > 1;

  return {
    clientIp,
    userAgent: request.get('user-agent')?.trim() || 'unknown',
    hasProxyHeaders,
    hasForwardedClientIp:
      realIpCandidates.length > 0 || forwardedCandidates.length > 0,
  };
}
