import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthState, UserAccount } from '../types/auth';
import { ApiError, fetchMeApi, loginApi, registerApi, SESSION_EXPIRED_EVENT } from '../services/api';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: (reason?: string) => void;
  error: string | null;
  notice: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'omnigraph_jwt_token';
const USER_KEY = 'omnigraph_user_email';

function tokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

const SIGNED_OUT: AuthState = { user: null, token: null, isAuthenticated: false, isLoading: false };

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({ ...SIGNED_OUT, isLoading: true });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const logout = useCallback((reason?: string) => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState(SIGNED_OUT);
    setError(null);
    setNotice(reason ?? null);
  }, []);

  // Restore and *verify* the stored session.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setState(SIGNED_OUT);
      return;
    }
    const expiry = tokenExpiry(token);
    if (expiry !== null && expiry <= Date.now()) {
      logout('Your session expired. Please sign in again.');
      return;
    }
    const controller = new AbortController();
    fetchMeApi(token, controller.signal)
      .then((me) => {
        setState({ user: { id: me.id, email: me.email }, token, isAuthenticated: true, isLoading: false });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof ApiError && err.status === 401) {
          logout('Your session expired. Please sign in again.');
        } else {
          // API temporarily unreachable: keep the session; data requests surface the outage.
          const email = localStorage.getItem(USER_KEY) ?? 'analyst';
          setState({ user: { id: 'session', email }, token, isAuthenticated: true, isLoading: false });
        }
      });
    return () => controller.abort();
  }, [logout]);

  // Any authenticated request returning 401 ends the session.
  useEffect(() => {
    const onExpired = () => logout('Your session expired. Please sign in again.');
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [logout]);

  // Proactively sign out when the JWT reaches its expiry.
  useEffect(() => {
    if (!state.token) return undefined;
    const expiry = tokenExpiry(state.token);
    if (expiry === null) return undefined;
    const timer = window.setTimeout(
      () => logout('Your session expired. Please sign in again.'),
      Math.max(0, Math.min(expiry - Date.now(), 2 ** 31 - 1)),
    );
    return () => window.clearTimeout(timer);
  }, [state.token, logout]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setNotice(null);
    try {
      const data = await loginApi(email.trim(), password);
      const user: UserAccount = { id: 'session', email: data.user_email };
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, data.user_email);
      setState({ user, token: data.access_token, isAuthenticated: true, isLoading: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Check your credentials.');
      throw err;
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await registerApi(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
      throw err;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  const value = useMemo(
    () => ({ ...state, login, register, logout, error, notice, clearError }),
    [state, login, register, logout, error, notice, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
