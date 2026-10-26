import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    if (getToken()) api.post('/auth/logout').catch(() => {});
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { setToken(null); setUser(null); });
    if (!getToken()) return;
    api.get('/auth/me').then((r) => setUser(r.data)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  const startSession = useCallback(({ token, user: u }) => { setToken(token); setUser(u); }, []);
  const refresh = useCallback(() => api.get('/auth/me').then((r) => { setUser(r.data); return r.data; }), []);

  const value = useMemo(() => ({ user, loading, startSession, logout, refresh }), [user, loading, startSession, logout, refresh]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
