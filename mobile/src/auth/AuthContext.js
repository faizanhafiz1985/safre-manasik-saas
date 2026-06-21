import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { setAuthLostHandler } from '../api/client';
import { saveTokens, clearTokens, getAccessToken, getRefreshToken } from './storage';
import { registerForPush, unregisterPush } from '../push/registerPush';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setUser(data);
    setPermissions(data.permissions || []);
    return data;
  }, []);

  const signOut = useCallback(async () => {
    const rt = await getRefreshToken();
    await unregisterPush().catch(() => {});
    if (rt) await api.post('/auth/logout', { refreshToken: rt }).catch(() => {});
    await clearTokens();
    setUser(null);
    setPermissions([]);
  }, []);

  // If a refresh ultimately fails, the API layer calls this to force logout.
  useEffect(() => { setAuthLostHandler(() => { clearTokens(); setUser(null); setPermissions([]); }); }, []);

  // Restore an existing session on cold start.
  useEffect(() => {
    (async () => {
      try {
        if (await getAccessToken()) {
          await loadMe();
          registerForPush();
        }
      } catch { /* token invalid/expired → stay logged out */ }
      finally { setLoading(false); }
    })();
  }, [loadMe]);

  const signIn = useCallback(async (email, password) => {
    // client:'mobile' → backend returns a 1h access token + 30d refresh token.
    const { data } = await api.post('/auth/login', { email, password, client: 'mobile' });
    await saveTokens({ token: data.token, refreshToken: data.refreshToken });
    const me = await loadMe();
    registerForPush();
    return me;
  }, [loadMe]);

  const can = useCallback(
    (feature, action = 'view') => permissions.length === 0 || permissions.includes(`${feature}:${action}`),
    [permissions]
  );

  const value = {
    user, permissions, loading,
    isCustomer: user?.role === 'CUSTOMER',
    isStaff: user?.role === 'ADMIN' || user?.role === 'AGENT',
    signIn, signOut, reload: loadMe, can,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
