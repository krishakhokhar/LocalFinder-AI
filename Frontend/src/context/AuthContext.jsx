import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import authApi from "../services/authApi";
import { AUTH_EXPIRED_EVENT, clearSession, getToken, setToken, USER_KEY } from "../services/apiClient";

const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* private mode - the session just will not survive a reload */
  }
}

/**
 * The single source of truth for "who is signed in".
 *
 * Previously every component read localStorage directly, which meant the
 * navbar could show a stale user and logging out needed a full page
 * reload. Here the stored user is only a cache for first paint: the token
 * is always re-verified against /api/auth/me, so a revoked, expired or
 * tampered-with session is corrected within one request - and the role
 * used for route guards comes from the server, never from localStorage.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser());
  const [status, setStatus] = useState(() => (getToken() ? "loading" : "anonymous"));

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const applySession = useCallback((token, nextUser) => {
    setToken(token);
    writeStoredUser(nextUser);
    setUser(nextUser);
    setStatus("authenticated");
  }, []);

  // Verify the cached session once on boot.
  useEffect(() => {
    if (!getToken()) return undefined;

    const controller = new AbortController();
    authApi
      .me({ signal: controller.signal })
      .then((data) => {
        writeStoredUser(data.user);
        setUser(data.user);
        setStatus("authenticated");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        // A network blip must not sign a user out; only an auth failure does.
        if (error.status === 401 || error.status === 403) signOut();
        else setStatus(user ? "authenticated" : "anonymous");
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot-time check only
  }, []);

  // Any request that comes back 401 signs the user out exactly once.
  useEffect(() => {
    const handler = () => signOut();
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, [signOut]);

  // Keep tabs in sync: signing out in one tab signs out in all of them.
  useEffect(() => {
    const handler = (event) => {
      if (event.key === USER_KEY || event.key === "token") {
        const stored = readStoredUser();
        setUser(stored);
        setStatus(getToken() && stored ? "authenticated" : "anonymous");
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const data = await authApi.login(credentials);
      applySession(data.token, data.user);
      return data.user;
    },
    [applySession]
  );

  const register = useCallback(
    async (payload) => {
      const data = await authApi.register(payload);
      applySession(data.token, data.user);
      return data.user;
    },
    [applySession]
  );

  const refresh = useCallback(async () => {
    const data = await authApi.me();
    writeStoredUser(data.user);
    setUser(data.user);
    setStatus("authenticated");
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isLoading: status === "loading",
      isAuthenticated: Boolean(user) && status !== "anonymous",
      isCustomer: user?.role === "customer",
      isOwner: user?.role === "owner" || user?.role === "admin",
      isAdmin: user?.role === "admin",
      login,
      register,
      signOut,
      refresh,
      setUser: (next) => {
        writeStoredUser(next);
        setUser(next);
      },
    }),
    [user, status, login, register, signOut, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}

export default AuthContext;
