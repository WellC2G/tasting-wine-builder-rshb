import { getApiBaseUrl } from './api-client';
import { probeWebRtcNetwork } from './network-probe';

const HOST_LAN_IP_KEY = 'tasting.host.lanIp';
const LOOPBACK_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

let cachedLanIp: string | null = null;

export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname.trim().toLowerCase());
}

export function isPrivateLanIpv4(value: string): boolean {
  const ip = value.trim();

  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) {
    return false;
  }

  const parts = ip.split('.').map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (part) => !Number.isInteger(part) || part < 0 || part > 255,
    )
  ) {
    return false;
  }

  return (
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
  );
}

function normalizeConfiguredHostname(
  value: string | undefined,
): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `http://${trimmed.replace(/^\/+/, '')}`;

    return new URL(candidate).hostname || null;
  } catch {
    return null;
  }
}

function preferredLanIp(values: string[]): string | null {
  const unique = [...new Set(values.filter(isPrivateLanIpv4))];
  const isLate172 = (ip: string): boolean => {
    const [, second] = ip.split('.').map(Number);

    return ip.startsWith('172.') && second >= 20;
  };

  return (
    unique.find((ip) => ip.startsWith('192.168.')) ??
    unique.find((ip) => ip.startsWith('10.')) ??
    unique.find(isLate172) ??
    unique[0] ??
    null
  );
}

function configuredClientLanIp(): string | null {
  const candidates = [
    process.env.NEXT_PUBLIC_HOST_IP,
    normalizeConfiguredHostname(process.env.NEXT_PUBLIC_API_URL),
  ];

  for (const candidate of candidates) {
    if (candidate && isPrivateLanIpv4(candidate)) {
      return candidate.trim();
    }
  }

  return null;
}

export function getStoredHostLanIp(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = window.localStorage.getItem(HOST_LAN_IP_KEY);

    return value && isPrivateLanIpv4(value) ? value : null;
  } catch {
    return null;
  }
}

export function setStoredHostLanIp(value: string): string | null {
  const ip = value.trim();

  if (!isPrivateLanIpv4(ip)) {
    return null;
  }

  cachedLanIp = ip;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(HOST_LAN_IP_KEY, ip);
    } catch {
      // The QR still works for the current page with the in-memory value.
    }
  }

  return ip;
}

export function buildLanOrigin(lanIp: string): string {
  if (typeof window === 'undefined') {
    return `http://${lanIp}:3000`;
  }

  return `http://${lanIp}:${window.location.port || '3000'}`;
}

export function getCachedQrOrigin(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!isLoopbackHostname(window.location.hostname)) {
    return window.location.origin;
  }

  const configured = configuredClientLanIp();

  if (configured) {
    return buildLanOrigin(configured);
  }

  const stored = getStoredHostLanIp();

  return stored ? buildLanOrigin(stored) : null;
}

async function fetchServerLanIp(): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/v1/health/network`,
      {
        cache: 'no-store',
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      lanIp?: unknown;
    };

    return typeof payload.lanIp === 'string' &&
      isPrivateLanIpv4(payload.lanIp)
      ? payload.lanIp
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolves the host PC's LAN IP for QR codes. The browser hostname wins when
 * it is already a LAN address; otherwise environment/API, WebRTC and the
 * manually saved value are checked in that order.
 */
export async function resolveHostLanIp(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const browserHostname = window.location.hostname;

  if (!isLoopbackHostname(browserHostname)) {
    if (isPrivateLanIpv4(browserHostname)) {
      cachedLanIp = browserHostname;
      setStoredHostLanIp(browserHostname);
      return browserHostname;
    }

    return null;
  }

  const configured = configuredClientLanIp();

  if (configured) {
    cachedLanIp = configured;
    setStoredHostLanIp(configured);
    return configured;
  }

  const serverIp = await fetchServerLanIp();

  if (serverIp) {
    cachedLanIp = serverIp;
    setStoredHostLanIp(serverIp);
    return serverIp;
  }

  const webrtc = await probeWebRtcNetwork();
  const webrtcIp = preferredLanIp(webrtc.localIps);

  if (webrtcIp) {
    cachedLanIp = webrtcIp;
    setStoredHostLanIp(webrtcIp);
    return webrtcIp;
  }

  const stored = getStoredHostLanIp() ?? cachedLanIp;

  return stored;
}
