import React, { useState, useEffect } from 'react';
import { AuthContext } from './authContext';
import api from './api';
import { toast } from './toast';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('rxvault_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('rxvault_token');
    if (!storedToken) {
      setLoading(false);
      return;
    }

    // Decode JWT locally to check expiry (no crypto — just base64)
    try {
      const payloadB64 = storedToken.split('.')[1];
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      const isExpired = payload.exp && (payload.exp * 1000) < Date.now();
      if (isExpired) {
        doLogout(false);
        setLoading(false);
        return;
      }
    } catch {
      doLogout(false);
      setLoading(false);
      return;
    }

    // Verify against backend — gets fresh user data including role
    api.get('/auth/me')
      .then((res) => {
        setUser(res.data.user);
        localStorage.setItem('rxvault_user', JSON.stringify(res.data.user));
      })
      .catch(() => {
        doLogout(false);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const doLogout = (showToast = true) => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('rxvault_token');
    localStorage.removeItem('rxvault_user');
    if (showToast) toast.info('Logged out');
  };

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

  const logout = () => doLogout(true);

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
