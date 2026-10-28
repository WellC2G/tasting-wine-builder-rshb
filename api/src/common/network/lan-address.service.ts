import { existsSync } from 'node:fs';
import { isIP } from 'node:net';
import { networkInterfaces } from 'node:os';

import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

const VIRTUAL_INTERFACE_PATTERN =
  /^(lo|docker|br-|veth|utun|tun|wg|vmnet|vboxnet)/i;
const LINK_LOCAL_PATTERN = /^169\.254\./;

function firstHeaderValue(
  value: string | string[] | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const candidate = Array.isArray(value) ? value[0] : value;

  return candidate?.trim() || null;
}

function hostnameFromHostHeader(value: string | null): string | null {
  if (!value) {
    return null;
  }

  if (value.startsWith('[')) {
    const closingBracket = value.indexOf(']');

    return closingBracket === -1
      ? null
      : value.slice(1, closingBracket);
  }

  return value.split(':')[0]?.trim() || null;
}

function hostnameFromUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
      ? value
      : `http://${value.replace(/^\/+/, '')}`;

    return new URL(candidate).hostname || null;
  } catch {
    return null;
  }
}

function lanIpPriority(ip: string | null): number | null {
  if (!ip || isIP(ip) !== 4) {
    return null;
  }

  const [first, second] = ip.split('.').map(Number);

  if (first === 192 && second === 168) {
    return 1;
  }

  if (first === 10) {
    return 2;
  }

  if (first === 172 && second >= 16 && second <= 31) {
    return second >= 20 ? 3 : 4;
  }

  return null;
}

function isVirtualInterface(name: string): boolean {
  return VIRTUAL_INTERFACE_PATTERN.test(name);
}

@Injectable()
export class LanAddressService {
  private observedLanIp: string | null = null;
  private manualLanIp: string | null = null;

  getLanIp(): string | null {
    return (
      this.manualLanIp ??
      this.resolveConfiguredLanIp() ??
      this.scanNetworkInterfaces() ??
      this.observedLanIp
    );
  }

  setManualLanIp(value: string): string {
    const ip = value.trim();

    if (!lanIpPriority(ip)) {
      throw new BadRequestException(
        'Укажите локальный IP-адрес хоста, например 192.168.0.115',
      );
    }

    this.manualLanIp = ip;

    return ip;
  }

  observeRequest(
    hostHeader: string | string[] | undefined,
    originHeader: string | string[] | undefined,
    refererHeader: string | string[] | undefined,
  ): void {
    const candidates = [
      hostnameFromHostHeader(firstHeaderValue(hostHeader)),
      hostnameFromUrl(firstHeaderValue(originHeader)),
      hostnameFromUrl(firstHeaderValue(refererHeader)),
    ];

    for (const candidate of candidates) {
      if (lanIpPriority(candidate)) {
        this.observedLanIp = candidate;
        return;
      }
    }
  }

  private resolveConfiguredLanIp(): string | null {
    const configured = [
      process.env.HOST_LAN_IP,
      process.env.NEXT_PUBLIC_HOST_IP,
      hostnameFromUrl(process.env.NEXT_PUBLIC_API_URL ?? null),
    ]
      .map((value) => value?.trim() ?? '')
      .filter((value) => lanIpPriority(value))
      .sort(
        (left, right) =>
          (lanIpPriority(left) ?? Number.MAX_SAFE_INTEGER) -
          (lanIpPriority(right) ?? Number.MAX_SAFE_INTEGER),
      );

    return configured[0] ?? null;
  }

  private scanNetworkInterfaces(): string | null {
    // Inside Docker the visible interfaces belong to the container network,
    // not to the organizer's Wi-Fi adapter.
    if (existsSync('/.dockerenv')) {
      return null;
    }

    const candidates: Array<{ ip: string; priority: number }> = [];

    for (const [name, addresses] of Object.entries(
      networkInterfaces(),
    )) {
      if (isVirtualInterface(name)) {
        continue;
      }

      for (const address of addresses ?? []) {
        const isIpv4 =
          address.family === 'IPv4' ||
          String(address.family) === '4';

        if (
          address.internal ||
          !isIpv4 ||
          LINK_LOCAL_PATTERN.test(address.address) ||
          (name === 'eth0' && address.address.startsWith('172.'))
        ) {
          continue;
        }

        const priority = lanIpPriority(address.address);

        if (priority) {
          candidates.push({ ip: address.address, priority });
        }
      }
    }

    return (
      candidates.sort(
        (left, right) => left.priority - right.priority,
      )[0]?.ip ?? null
    );
  }
}
