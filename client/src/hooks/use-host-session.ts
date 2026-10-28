'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { apiClient } from '@/lib/api-client';
import {
  clearHostSession,
  getHostToken,
  getHostUser,
  setHostSession,
  setHostToken,
} from '@/lib/session';
import type { HostUser, UserRole } from '@/types/api';

interface HostSessionState {
  token: string | null;
  user: HostUser | null;
  ready: boolean;
  logout: () => void;
}

interface JwtHostPayload {
  sub?: unknown;
  email?: unknown;
  role?: unknown;
  exp?: unknown;
}

function decodeJwtHostUser(token: string): HostUser | null {
  try {
    const payloadPart = token.split('.')[1];

    if (!payloadPart) {
      return null;
    }

    const base64 = payloadPart
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = base64.padEnd(
      Math.ceil(base64.length / 4) * 4,
      '=',
    );
    const payload = JSON.parse(
      atob(padded),
    ) as JwtHostPayload;

    if (
      typeof payload.exp === 'number' &&
      payload.exp * 1000 <= Date.now()
    ) {
      return null;
    }

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      (payload.role !== 'HOST' && payload.role !== 'ADMIN')
    ) {
      return null;
    }

    const timestamp = new Date().toISOString();

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.email,
      role: payload.role as UserRole,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  } catch {
    return null;
  }
}

function cleanHostTokenFromUrl(): void {
  const url = new URL(window.location.href);

  if (!url.searchParams.has('hostToken')) {
    return;
  }

  url.searchParams.delete('hostToken');
  const query = url.searchParams.toString();
  const canonicalUrl = `${url.pathname}${query ? `?${query}` : ''}${
    url.hash
  }`;

  window.history.replaceState({}, '', canonicalUrl);
}

export function useHostSession(): HostSessionState {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<HostUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refreshUser = async (
      tokenValue: string,
      fallback: HostUser | null,
      redirectOnFailure: boolean,
    ): Promise<void> => {
      try {
        const profile = await apiClient.auth.me(tokenValue);

        if (cancelled) {
          return;
        }

        setHostSession(tokenValue, profile);
        setUser(profile);
      } catch {
        if (cancelled) {
          return;
        }

        if (redirectOnFailure && !fallback) {
          clearHostSession();
          setToken(null);
          setUser(null);
          setReady(false);
          router.replace('/host/login');
        }
      }
    };

    const hostToken = new URLSearchParams(
      window.location.search,
    ).get('hostToken');

    if (hostToken) {
      cleanHostTokenFromUrl();
      setHostToken(hostToken);

      const initialUser =
        decodeJwtHostUser(hostToken) ?? getHostUser();

      if (initialUser) {
        setHostSession(hostToken, initialUser);
      }

      setToken(hostToken);
      setUser(initialUser);
      setReady(true);
      void refreshUser(hostToken, initialUser, true);

      return () => {
        cancelled = true;
      };
    }

    const storedToken = getHostToken();

    if (!storedToken) {
      router.replace('/host/login');
      return;
    }

    const storedUser = getHostUser();

    setToken(storedToken);
    setUser(storedUser);
    setReady(true);
    void refreshUser(storedToken, storedUser, false);

    return () => {
      cancelled = true;
    };
  }, [router]);

  const logout = () => {
    clearHostSession();
    router.replace('/host/login');
  };

  return { token, user, ready, logout };
}
