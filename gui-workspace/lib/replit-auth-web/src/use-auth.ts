import { useCallback, useEffect, useState } from 'react';
import type { AuthUser } from '@workspace/api-client-react';

export type { AuthUser };

interface AuthState {
  user: AuthUser | null;
  roles: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

function getBasePath() {
  return import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadAuth = () => {
      fetch('/api/auth/user', { credentials: 'include' })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<{ user: AuthUser | null; roles: string[] }>;
        })
        .then((data) => {
          if (!cancelled) {
            setUser(data.user ?? null);
            setRoles(data.roles ?? []);
            setIsLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setUser(null);
            setRoles([]);
            setIsLoading(false);
          }
        });
    };

    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') loadAuth();
    };
    loadAuth();
    const interval = window.setInterval(loadAuth, 30000);
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, []);

  const login = useCallback(() => {
    const base = getBasePath();
    window.location.href = `/api/login?returnTo=${encodeURIComponent(base)}`;
  }, []);

  const logout = useCallback(() => {
    const base = getBasePath();
    window.location.href = `/api/logout?returnTo=${encodeURIComponent(base)}`;
  }, []);

  return {
    user,
    roles,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
