import { isIP } from 'node:net';

import { Injectable, Logger } from '@nestjs/common';

const PUBLIC_IP_ENDPOINTS = [
  'https://api.ipify.org?format=json',
  'https://icanhazip.com',
  'https://ident.me',
] as const;
const REQUEST_TIMEOUT_MS = 2000;
const CACHE_TTL_MS = 60_000;

interface PublicIpCacheEntry {
  value: string | null;
  expiresAt: number;
}

@Injectable()
export class ServerPublicIpService {
  private readonly logger = new Logger(ServerPublicIpService.name);
  private cache: PublicIpCacheEntry | null = null;
  private pendingLookup: Promise<string | null> | null = null;

  /**
   * Returns the host machine's public egress IPv4 address. A null value is
   * cached too, so an offline LAN does not wait for the timeout on every
   * guest join.
   */
  async getPublicIp(): Promise<string | null> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.value;
    }

    if (this.pendingLookup) {
      return this.pendingLookup;
    }

    this.pendingLookup = this.lookupPublicIp()
      .then((value) => {
        this.cache = {
          value,
          expiresAt: Date.now() + CACHE_TTL_MS,
        };

        return value;
      })
      .finally(() => {
        this.pendingLookup = null;
      });

    return this.pendingLookup;
  }

  private async lookupPublicIp(): Promise<string | null> {
    const deadline = Date.now() + REQUEST_TIMEOUT_MS;

    for (const endpoint of PUBLIC_IP_ENDPOINTS) {
      const remaining = deadline - Date.now();

      if (remaining <= 0) {
        break;
      }

      const body = await this.fetchText(
        endpoint,
        Math.min(remaining, 1000),
      );

      if (!body) {
        continue;
      }

      let candidate = body.trim();

      if (endpoint.includes('ipify.org')) {
        try {
          const payload = JSON.parse(candidate) as { ip?: unknown };
          candidate =
            typeof payload.ip === 'string' ? payload.ip.trim() : '';
        } catch {
          candidate = '';
        }
      } else {
        candidate = candidate.split(/\s+/)[0] ?? '';
      }

      if (isIP(candidate) === 4) {
        return candidate;
      }
    }

    return null;
  }

  private async fetchText(
    url: string,
    timeoutMs: number,
  ): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      timeoutMs,
    );

    try {
      const response = await fetch(url, {
        headers: { Accept: 'text/plain, application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        return null;
      }

      return await response.text();
    } catch {
      this.logger.debug(`Public IP lookup failed for ${url}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
