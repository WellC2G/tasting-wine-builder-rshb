import type { Request } from 'express';

export interface RequestContext {
  clientIp: string;
  userAgent: string;
}

/**
 * Extracts a stable client context for fingerprint calculation.
 * The first X-Forwarded-For address wins when the app is behind a proxy.
 */
export function getRequestContext(request: Request): RequestContext {
  const forwardedFor = request.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor;
  const forwardedIp = forwardedValue?.split(',')[0]?.trim();

  return {
    clientIp:
      forwardedIp ||
      request.ip ||
      request.socket.remoteAddress ||
      'unknown',
    userAgent: request.get('user-agent')?.trim() || 'unknown',
  };
}
