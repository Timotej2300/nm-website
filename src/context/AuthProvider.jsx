import { useState, useCallback, useMemo, useEffect } from "react";
import { AuthContext } from "./auth-context";
import { api, errorMessage } from "../lib/api";
import { avatarUrl } from "../data/votes";

const withAvatar = (u) => (u ? { ...u, username: u.name, avatar: avatarUrl(u.name, 64) } : null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [site, setSite] = useState(null); // { maintenance, pages }
  const [loading, setLoading] = useState(true);
  const [siteError, setSiteError] = useState(null);

  const refreshSite = useCallback(async () => {
    try {
      setSite(await api.get("/site/status"));
      setSiteError(null);
    } catch (e) {
      setSiteError(errorMessage(e)); // keep last known site state, if any
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const r = await api.get("/auth/me");
      setUser(withAvatar(r.user));
      return r.user;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load: state is set after the async calls resolve
    Promise.all([refreshSite(), refreshUser()]).finally(() => alive && setLoading(false));
    const onUnauthorized = () => setUser(null);
    const onRefresh = () => {
      refreshSite();
      refreshUser();
    };
    window.addEventListener("nm:unauthorized", onUnauthorized);
    window.addEventListener("nm:refresh-status", onRefresh);
    window.addEventListener("focus", onRefresh);
    const id = setInterval(refreshSite, 60_000);
    return () => {
      alive = false;
      window.removeEventListener("nm:unauthorized", onUnauthorized);
      window.removeEventListener("nm:refresh-status", onRefresh);
      window.removeEventListener("focus", onRefresh);
      clearInterval(id);
    };
  }, [refreshSite, refreshUser]);

  const login = useCallback(async (payload) => {
    const r = await api.post(payload.code ? "/auth/code-login" : "/auth/login", payload);
    setUser(withAvatar(r.user));
    refreshSite();
    return r.user;
  }, [refreshSite]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
    }
  }, []);

  const can = useCallback((perm) => Boolean(user?.permissions?.includes(perm)), [user]);

  const value = useMemo(
    () => ({ user, site, siteError, loading, login, logout, can, refreshUser, refreshSite, setUser: (u) => setUser(withAvatar(u)) }),
    [user, site, siteError, loading, login, logout, can, refreshUser, refreshSite],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
