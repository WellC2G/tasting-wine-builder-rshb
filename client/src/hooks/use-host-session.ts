'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  clearHostSession,
  getHostToken,
  getHostUser,
} from '@/lib/session';
import type { HostUser } from '@/types/api';

interface HostSessionState {
  token: string | null;
  user: HostUser | null;
  ready: boolean;
  logout: () => void;
}

export function useHostSession(): HostSessionState {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<HostUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedToken = getHostToken();

    if (!storedToken) {
      router.replace('/host/login');
      return;
    }

    setToken(storedToken);
    setUser(getHostUser());
    setReady(true);
  }, [router]);

  const logout = () => {
    clearHostSession();
    router.replace('/host/login');
  };

  return { token, user, ready, logout };
}
