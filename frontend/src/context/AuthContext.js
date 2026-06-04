import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(!!localStorage.getItem('impersonatorToken'));

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch {
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    // The login response does not include RBAC `permissions`. Immediately fetch
    // the full profile via /auth/me so the sidebar + route guard reflect the
    // user's effective permissions right after login (not only after a refresh).
    let full = data.user;
    try { const me = await api.get('/auth/me'); full = me.data; } catch { /* fall back to login user */ }
    setUser(full);
    return full;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('impersonatorToken');
    setImpersonating(false);
    setUser(null);
  };

  // ── Proxy login (super admin → tenant) ──────────────────────────────────────
  // Backs up the super-admin token, switches to the tenant token, and loads the
  // impersonated profile (with permissions) so the whole app behaves as that tenant.
  const impersonate = async (token) => {
    const current = localStorage.getItem('token');
    if (current) localStorage.setItem('impersonatorToken', current);
    localStorage.setItem('token', token);
    setImpersonating(true);
    const me = await api.get('/auth/me');
    setUser(me.data);
    return me.data;
  };

  const exitImpersonation = async () => {
    const orig = localStorage.getItem('impersonatorToken');
    localStorage.removeItem('impersonatorToken');
    setImpersonating(false);
    if (orig) { localStorage.setItem('token', orig); await loadUser(); }
    else { logout(); }
  };

  const isAdmin = user?.role === 'ADMIN';
  const isAgent = user?.role === 'AGENT';
  const isCustomer = user?.role === 'CUSTOMER';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isAgent, isCustomer, reload: loadUser, impersonate, exitImpersonation, impersonating }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
