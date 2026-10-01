import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export interface AuthUser {
  id: string;
  name: string;
  role: 'owner' | 'operator' | 'viewer';
}

export interface AuthState {
  loaded: boolean;
  enabled: boolean;
  user: AuthUser | null;
}

export const AUTH_EVENT = 'zakos:auth-changed';

export function useAuth() {
  const [state, setState] = useState<AuthState>({ loaded: false, enabled: false, user: null });
  const refresh = useCallback(() => {
    api<{ enabled: boolean; user: AuthUser | null }>('/api/auth/status')
      .then((d) => setState({ loaded: true, enabled: d.enabled, user: d.user }))
      .catch(() => setState((s) => ({ ...s, loaded: true })));
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener(AUTH_EVENT, refresh);
    window.addEventListener('zakos:auth-required', refresh);
    return () => {
      window.removeEventListener(AUTH_EVENT, refresh);
      window.removeEventListener('zakos:auth-required', refresh);
    };
  }, [refresh]);
  return { ...state, refresh };
}
