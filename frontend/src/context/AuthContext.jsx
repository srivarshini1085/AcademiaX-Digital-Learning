import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, tokens } from '../lib/api';

const AuthContext = createContext(null);

function readUser() {
  try { return tokens.access ? JSON.parse(localStorage.getItem('user')) : null; } catch { return null; }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);
  const queryClient = useQueryClient();

  const clearSession = useCallback(() => {
    tokens.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  // The API layer fires this when a refresh fails (token expired, revoked, or reused elsewhere).
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async credentials => {
    const { data } = await authApi.login(credentials);
    tokens.save(data);
    const profile = { id: data.userId, name: data.name, email: data.email, role: data.role, department: data.department };
    localStorage.setItem('user', JSON.stringify(profile));
    setUser(profile);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* token may already be revoked */ }
    clearSession();
  }, [clearSession]);

  const updateUser = useCallback(patch => {
    setUser(current => {
      const next = { ...current, ...patch };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(() => ({ user, isAuthenticated: !!user, login, logout, clearSession, updateUser }),
    [user, login, logout, clearSession, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export const homeFor = role => ({ STUDENT: '/dashboard', INSTRUCTOR: '/instructor', ADMIN: '/admin' }[role] || '/');
