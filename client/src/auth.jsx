import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('auth:logout', onLogout);
    if (tokenStore.get()) {
      api('/auth/me')
        .then((d) => setUser(d.user))
        .catch(() => tokenStore.clear())
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const signIn = useCallback(async (path, body) => {
    const d = await api(path, { method: 'POST', body });
    tokenStore.set(d.token);
    setUser(d.user);
    return d.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      setUser,
      login: (email, password) => signIn('/auth/login', { email, password }),
      register: (email, password) => signIn('/auth/register', { email, password }),
      logout: () => {
        tokenStore.clear();
        setUser(null);
      },
    }),
    [user, ready, signIn],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export const homePath = (user) => (user?.role === 'owner' ? '/owner' : '/me');
