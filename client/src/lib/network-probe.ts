const HTTP_PROBE_TIMEOUT_MS = 1500;
const HTTP_ATTEMPT_TIMEOUT_MS = 700;
const WEBRTC_PROBE_TIMEOUT_MS = 1200;
const PUBLIC_IP_ENDPOINTS = [
  'https://api.ipify.org?format=json',
  'https://icanhazip.com',
  'https://ident.me',
] as const;

export interface ClientNetworkProbe {
  httpPublicIp: string | null;
  webrtcPublicIp: string | null;
  webrtcLocalIps: string[];
  vpnSuspectedByWebrtc: boolean;
}

interface WebRtcProbeResult {
  publicIp: string | null;
  localIps: string[];
  vpnSuspected: boolean;
}

function isIpv4(value: string): boolean {
  const parts = value.split('.').map(Number);

  return (
    parts.length === 4 &&
    parts.every(
      (part) => Number.isInteger(part) && part >= 0 && part <= 255,
    )
  );
}

function isIpAddress(value: string): boolean {
  const candidate = value.trim();

  if (isIpv4(candidate)) {
    return true;
  }

  return (
    candidate.includes(':') &&
    candidate.length <= 64 &&
    /^[0-9a-f:.]+$/i.test(candidate)
  );
}

function parsePublicIp(body: string): string | null {
  const trimmed = body.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('{')) {
    try {
      const payload = JSON.parse(trimmed) as { ip?: unknown };

      return typeof payload.ip === 'string' &&
        isIpAddress(payload.ip)
        ? payload.ip.trim()
        : null;
    } catch {
      return null;
    }
  }

  const candidate = trimmed.split(/\s+/)[0] ?? '';

  return isIpAddress(candidate) ? candidate : null;
}

async function fetchPublicIp(
  url: string,
  timeoutMs: number,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'text/plain, application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return parsePublicIp(await response.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function probeHttpPublicIp(): Promise<string | null> {
  const deadline = Date.now() + HTTP_PROBE_TIMEOUT_MS;

  for (const endpoint of PUBLIC_IP_ENDPOINTS) {
    const remaining = deadline - Date.now();

    if (remaining <= 0) {
      break;
    }

    const value = await fetchPublicIp(
      endpoint,
      Math.min(HTTP_ATTEMPT_TIMEOUT_MS, remaining),
    );

    if (value) {
      return value;
    }
  }

  return null;
}

function parseIceCandidate(candidate: RTCIceCandidate): {
  address: string | null;
  type: string | null;
} {
  const raw = candidate.candidate;
  const address =
    candidate.address && isIpv4(candidate.address)
      ? candidate.address
      : (/(\d{1,3}(?:\.\d{1,3}){3})/.exec(raw)?.[1] ?? null);
  const type =
    candidate.type ??
    / typ (host|srflx|prflx|relay)/i.exec(raw)?.[1]?.toLowerCase() ??
    null;

  return {
    address: address && isIpv4(address) ? address : null,
    type,
  };
}

function isVpnWebRtcRange(ip: string): boolean {
  if (!isIpv4(ip)) {
    return false;
  }

  const [first, second] = ip.split('.').map(Number);

  return first === 100 && second >= 64 && second <= 127;
}

function isSecondaryPrivateRange(ip: string): boolean {
  if (!isIpv4(ip)) {
    return false;
  }

  const [first, second] = ip.split('.').map(Number);

  return (
    first === 10 || (first === 172 && second >= 16 && second <= 31)
  );
}

export async function probeWebRtcNetwork(): Promise<WebRtcProbeResult> {
  if (
    typeof window === 'undefined' ||
    typeof RTCPeerConnection === 'undefined'
  ) {
    return { publicIp: null, localIps: [], vpnSuspected: false };
  }

  const localIps = new Set<string>();
  let publicIp: string | null = null;
  let peer: RTCPeerConnection | null = null;
  let dataChannel: RTCDataChannel | null = null;

  const collect = (candidate: RTCIceCandidate): void => {
    const parsed = parseIceCandidate(candidate);

    if (!parsed.address || parsed.address === '0.0.0.0') {
      return;
    }

    if (parsed.type === 'srflx' && !publicIp) {
      publicIp = parsed.address;
      return;
    }

    if (parsed.type === 'host') {
      localIps.add(parsed.address);
    }
  };

  try {
    peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    const gathering = new Promise<void>((resolve) => {
      const finish = () => resolve();
      const timeout = setTimeout(finish, WEBRTC_PROBE_TIMEOUT_MS);

      peer?.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
          collect(event.candidate);
          return;
        }

        clearTimeout(timeout);
        finish();
      });
      peer?.addEventListener('icegatheringstatechange', () => {
        if (peer?.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          finish();
        }
      });
    });

    dataChannel = peer.createDataChannel('network-probe');
    const offer = await peer.createOffer();

    await peer.setLocalDescription(offer);
    await Promise.race([
      gathering,
      new Promise<void>((resolve) =>
        setTimeout(resolve, WEBRTC_PROBE_TIMEOUT_MS),
      ),
    ]);
  } catch {
    // WebRTC is optional and may be blocked by browser policy.
  } finally {
    dataChannel?.close();
    peer?.close();
  }

  const localIpList = [...localIps];
  const hostname = window.location.hostname;
  const hostnameIsLocalLan = hostname.startsWith('192.168.');
  const vpnSuspected =
    localIpList.some((ip) => isVpnWebRtcRange(ip)) ||
    (hostnameIsLocalLan &&
      localIpList.some((ip) => isSecondaryPrivateRange(ip)));

  return {
    publicIp,
    localIps: localIpList,
    vpnSuspected,
  };
}

export async function probeClientNetwork(): Promise<ClientNetworkProbe> {
  const [httpPublicIp, webrtc] = await Promise.all([
    probeHttpPublicIp(),
    probeWebRtcNetwork(),
  ]);

  return {
    httpPublicIp,
    webrtcPublicIp: webrtc.publicIp,
    webrtcLocalIps: webrtc.localIps,
    vpnSuspectedByWebrtc: webrtc.vpnSuspected,
  };
}
