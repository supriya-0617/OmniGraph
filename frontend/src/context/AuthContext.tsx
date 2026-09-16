import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserAccount, AuthState } from '../types/auth';
import { loginApi, registerApi } from '../services/api';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'omnigraph_jwt_token';
const USER_KEY = 'omnigraph_user_email';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Restore session from localStorage if available
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedEmail = localStorage.getItem(USER_KEY);

    if (savedToken && savedEmail) {
      setState({
        user: { id: 'restored-session', email: savedEmail },
        token: savedToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const data = await loginApi(email, password);
      const user: UserAccount = { id: 'session', email: data.user_email };

      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, data.user_email);

      setState({
        user,
        token: data.access_token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
      throw err;
    }
  };

  const register = async (email: string, password: string) => {
    setError(null);
    try {
      await registerApi(email, password);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
    setError(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, error, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
