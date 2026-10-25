'use client';

import { useEffect, useState } from 'react';

import {
  createTastingSocket,
  type TastingSocket,
} from '@/lib/socket';

interface TastingSocketState {
  socket: TastingSocket | null;
  connected: boolean;
  hasConnected: boolean;
  connectCount: number;
  connectionError: string | null;
  reconnecting: boolean;
}

export function useTastingSocket(
  token: string | null,
): TastingSocketState {
  const [socket, setSocket] = useState<TastingSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [hasConnected, setHasConnected] = useState(false);
  const [connectCount, setConnectCount] = useState(0);
  const [connectionError, setConnectionError] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setConnected(false);
      return;
    }

    const nextSocket = createTastingSocket(token);
    setSocket(nextSocket);

    const handleConnect = () => {
      setConnected(true);
      setHasConnected(true);
      setConnectionError(null);
      setConnectCount((count) => count + 1);
    };
    const handleDisconnect = () => {
      setConnected(false);
    };
    const handleConnectError = (error: Error) => {
      setConnected(false);
      setConnectionError(
        error.message ||
          'Не удалось подключиться к серверу в реальном времени',
      );
    };

    nextSocket.on('connect', handleConnect);
    nextSocket.on('disconnect', handleDisconnect);
    nextSocket.on('connect_error', handleConnectError);

    return () => {
      nextSocket.off('connect', handleConnect);
      nextSocket.off('disconnect', handleDisconnect);
      nextSocket.off('connect_error', handleConnectError);
      nextSocket.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [token]);

  return {
    socket,
    connected,
    hasConnected,
    connectCount,
    connectionError,
    reconnecting: Boolean(token) && !connected,
  };
}
