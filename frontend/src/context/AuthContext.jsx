import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const authApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('academiax-user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('academiax-token') || '');

  useEffect(() => {
    if (token) {
      authApi.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete authApi.defaults.headers.common.Authorization;
    }
  }, [token]);

  const login = async (email, password) => {
    const response = await authApi.post('/auth/login', { email, password });
    const payload = response.data;
    const nextToken = payload.token || payload.accessToken;
    const nextUser = payload.user || payload;

    setToken(nextToken || '');
    setUser(nextUser || null);

    if (nextToken) localStorage.setItem('academiax-token', nextToken);
    if (nextUser) localStorage.setItem('academiax-user', JSON.stringify(nextUser));

    return payload;
  };

  const register = async (payload) => {
    const response = await authApi.post('/auth/register', payload);
    return response.data;
  };

  const logout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('academiax-token');
    localStorage.removeItem('academiax-user');
  };

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    logout,
    api: authApi,
  }), [user, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
