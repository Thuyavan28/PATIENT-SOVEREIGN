import React, { createContext, useContext, useState, useEffect } from 'react';
import api from './api';
import { toast } from './toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('rxvault_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('rxvault_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data.user);
          localStorage.setItem('rxvault_user', JSON.stringify(res.data.user));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('rxvault_token', res.data.token);
      localStorage.setItem('rxvault_user', JSON.stringify(res.data.user));
      toast.success(`Welcome back, ${res.data.user.name}`);
      return res.data.user;
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Login failed';
      toast.error(msg);
      throw err;
    }
  };

  const register = async (formData) => {
    try {
      const res = await api.post('/auth/register', formData);
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('rxvault_token', res.data.token);
      localStorage.setItem('rxvault_user', JSON.stringify(res.data.user));
      toast.success('Registration successful');
      return res.data.user;
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Registration failed';
      toast.error(msg);
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('rxvault_token');
    localStorage.removeItem('rxvault_user');
    toast.info('Logged out');
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      localStorage.setItem('rxvault_user', JSON.stringify(res.data.user));
      return res.data.user;
    } catch (err) {
      console.error('Refresh user error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
