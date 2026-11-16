import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { localAuthService } from '../services/authService';
import type { AuthService, User } from '../services/authService';

interface AuthValue {
  user: User | null;
  ready: boolean;
  login(email: string, password: string): Promise<void>;
  register(input: { name: string; email: string; password: string; role?: string }): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children, service = localAuthService }: { children: ReactNode; service?: AuthService }) {
  const [user, setUser] = useState<User | null>(() => service.currentUser());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    service
      .ensureDemoAccount()
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [service]);

  const login = useCallback(
    async (email: string, password: string) => {
      setUser(await service.login(email, password));
    },
    [service],
  );
  const register = useCallback(
    async (input: { name: string; email: string; password: string; role?: string }) => {
      setUser(await service.register(input));
    },
    [service],
  );
  const logout = useCallback(() => {
    service.logout();
    setUser(null);
  }, [service]);

  const value = useMemo(() => ({ user, ready, login, register, logout }), [user, ready, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
