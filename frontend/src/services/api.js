import axios from 'axios';
import { toast } from 'react-toastify';

// Use same-origin /api by default — nginx in the frontend service proxies
// /api to the backend. This avoids cross-origin SSL issues when the custom
// API domain (api.safremanasik.com) has not yet been provisioned with a cert.
// Override with REACT_APP_API_URL only when you specifically need a direct
// backend URL (e.g. local dev with separate ports).
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.startsWith('http://localhost')
    ? process.env.REACT_APP_API_URL
    : '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.error || err.response?.data?.message || 'An error occurred';
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else if (err.response?.status !== 404) {
      toast.error(msg);
    }
    return Promise.reject(err);
  }
);

export default api;
