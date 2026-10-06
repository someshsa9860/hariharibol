import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiRequestError, clearTokens, loadTokens, saveTokens, type Tokens } from './api';

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
};

export type AdminMe = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: { slug: string; name: string };
  permissions: string[];
  permissionGroups: Record<string, string[]>;
};

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out'; error?: string }
  | { status: 'signed-in'; user: SessionUser; me: AdminMe };

type AuthContextValue = AuthState & {
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => void;
  hasPermission: (slug: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type SocialResponse = { user: SessionUser; tokens: Tokens };

async function fetchMe(): Promise<AdminMe> {
  const res = await api.get<AdminMe>('/api/admin/me');
  return res.data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const restore = useCallback(async () => {
    const tokens = loadTokens();
    if (!tokens) {
      setState({ status: 'signed-out' });
      return;
    }
    try {
      const me = await fetchMe();
      setState({
        status: 'signed-in',
        user: { id: me.id, email: me.email, name: me.name, avatarUrl: me.avatarUrl, role: me.role.slug },
        me,
      });
    } catch {
      clearTokens();
      setState({ status: 'signed-out' });
    }
  }, []);

  useEffect(() => {
    restore();
  }, [restore]);

  const signInWithGoogle = useCallback(async (idToken: string) => {
    setState({ status: 'loading' });
    try {
      const res = await api.post<SocialResponse>('/api/app/auth/social', {
        provider: 'GOOGLE',
        idToken,
        platform: 'web',
        deviceId: 'admin-web',
      });
      saveTokens(res.data.tokens);

      const me = await fetchMe();
      if (me.permissions.length === 0) {
        clearTokens();
        setState({
          status: 'signed-out',
          error: 'Signed in, but this account has no admin access yet.',
        });
        return;
      }

      setState({
        status: 'signed-in',
        user: { id: me.id, email: me.email, name: me.name, avatarUrl: me.avatarUrl, role: me.role.slug },
        me,
      });
    } catch (err) {
      clearTokens();
      const message = err instanceof ApiRequestError ? err.message : 'Sign-in failed';
      setState({ status: 'signed-out', error: message });
    }
  }, []);

  const signOut = useCallback(() => {
    clearTokens();
    setState({ status: 'signed-out' });
  }, []);

  const hasPermission = useCallback(
    (slug: string) => state.status === 'signed-in' && state.me.permissions.includes(slug),
    [state]
  );

  return (
    <AuthContext.Provider value={{ ...state, signInWithGoogle, signOut, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
