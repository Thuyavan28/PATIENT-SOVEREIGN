import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach JWT token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('rxvault_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const errData = error.response?.data;

    if (status === 401) {
      // Invalid/expired token — clear session
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        localStorage.removeItem('rxvault_token');
        localStorage.removeItem('rxvault_user');
        window.location.href = '/login';
      }
    } else if (status === 403) {
      // Role mismatch — don't redirect, just surface the error
      // The toast will be shown by the calling code via err.response
      console.warn('[RxVault] 403 Forbidden:', errData?.message || errData?.error || 'Access denied');
    }
    return Promise.reject(error);
  }
);


export default api;
