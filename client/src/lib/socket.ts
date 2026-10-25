import { io, type Socket } from 'socket.io-client';

import { API_URL } from './api-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@/types/realtime';

export type TastingSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

export function createTastingSocket(
  token: string,
): TastingSocket {
  return io(`${API_URL}/tasting`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    autoConnect: true,
    forceNew: true,
  });
}
