import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from '../auth/storage';

// Single axios instance. Request interceptor injects the bearer token; response
// interceptor transparently refreshes on 401 (rotating refresh token) and retries
// the original request once. Concurrent 401s share one in-flight refresh.
const api = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

let refreshing = null;          // Promise<string|null> while a refresh is in flight
let onAuthLost = null;          // set by AuthContext to force logout on hard failure

export const setAuthLostHandler = (fn) => { onAuthLost = fn; };

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

async function doRefresh() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  try {
    // Bare axios (not `api`) so this call doesn't recurse through the interceptor.
    const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
    await saveTokens({ token: data.token, refreshToken: data.refreshToken });
    return data.token;
  } catch {
    await clearTokens();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    if (status === 401 && original && !original._retried) {
      original._retried = true;
      if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null; });
      const newToken = await refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      if (onAuthLost) onAuthLost();   // refresh failed → bounce to Login
    }
    return Promise.reject(error);
  }
);

export default api;
