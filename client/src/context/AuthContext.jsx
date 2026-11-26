import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api, setAccessToken, clearAccessToken, setDemoSessionEndCallback } from "../api/client.js";

const AuthContext = createContext(null);
const PUBLIC_AUTH_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/resend-verification",
  "/oauth/callback"
]);

export function AuthProvider({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverWaking, setServerWaking] = useState(false);
  const [demoSessionEnded, setDemoSessionEnded] = useState(false);
  const wakingOperationsRef = useRef(0);
  const authOperationRef = useRef(0);
  const restoreStartedRef = useRef(false);
  const mountedRef = useRef(true);

  const beginServerWake = useCallback(() => {
    wakingOperationsRef.current += 1;
    setServerWaking(true);
  }, []);

  const finishServerWake = useCallback(() => {
    wakingOperationsRef.current = Math.max(0, wakingOperationsRef.current - 1);
    if (wakingOperationsRef.current === 0) {
      setServerWaking(false);
    }
  }, []);

  // Set up demo session end callback
  useEffect(() => {
    setDemoSessionEndCallback(() => {
      setDemoSessionEnded(true);
      setUser(null);
      clearAccessToken();
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Try to restore session on mount
  useEffect(() => {
    if (PUBLIC_AUTH_PATHS.has(location.pathname)) {
      setLoading(false);
      return;
    }
    if (restoreStartedRef.current) return;
    restoreStartedRef.current = true;
    setLoading(true);

    const restoreOperation = authOperationRef.current;

    async function restoreSession() {
      beginServerWake();
      try {
        const refreshRes = await fetch(
          `${import.meta.env.VITE_API_URL || ""}/api/auth/refresh`,
          { method: "POST", credentials: "include" }
        );

        if (!refreshRes.ok) {
          return;
        }

        const { accessToken } = await refreshRes.json();
        if (authOperationRef.current !== restoreOperation) return;
        setAccessToken(accessToken);

        const { user: userData } = await api.get("/api/auth/me");
        if (authOperationRef.current === restoreOperation) {
          setUser(userData);
        }
      } catch {
        // No valid session
      } finally {
        if (mountedRef.current) {
          finishServerWake();
          setLoading(false);
        }
      }
    }

    restoreSession();
  }, [location.pathname, beginServerWake, finishServerWake]);

  const login = useCallback(async (email, password) => {
    authOperationRef.current += 1;
    const { accessToken, user: userData } = await api.post("/api/auth/login", { email, password });
    restoreStartedRef.current = true;
    setAccessToken(accessToken, userData.isDemo);
    setUser(userData);
    setDemoSessionEnded(false);
    return userData;
  }, []);

  const register = useCallback(async (data) => {
    authOperationRef.current += 1;
    const result = await api.post("/api/auth/register", data);
    if (result.requiresEmailVerification) {
      clearAccessToken();
      setUser(null);
      setDemoSessionEnded(false);
      return result;
    }

    const { accessToken, user: userData } = result;
    restoreStartedRef.current = true;
    setAccessToken(accessToken, userData.isDemo);
    setUser(userData);
    setDemoSessionEnded(false);
    return userData;
  }, []);

  const loginDemo = useCallback(async () => {
    authOperationRef.current += 1;
    beginServerWake();
    try {
      const { accessToken, user: userData } = await api.post("/api/auth/demo", {});
      restoreStartedRef.current = true;
      setAccessToken(accessToken, true);
      setUser(userData);
      setDemoSessionEnded(false);
      return userData;
    } finally {
      finishServerWake();
    }
  }, [beginServerWake, finishServerWake]);

  const logout = useCallback(async () => {
    authOperationRef.current += 1;
    try {
      await api.post("/api/auth/logout", {});
    } catch {
      // Ignore logout errors
    }
    clearAccessToken();
    setUser(null);
    setDemoSessionEnded(false);
  }, []);

  const refreshUser = useCallback(async () => {
    const { user: userData } = await api.get("/api/auth/me");
    setUser(userData);
    return userData;
  }, []);

  const restoreOAuthSession = useCallback(async () => {
    authOperationRef.current += 1;
    restoreStartedRef.current = true;
    beginServerWake();
    try {
      const { accessToken } = await api.post("/api/auth/refresh", {});
      setAccessToken(accessToken);
      const { user: userData } = await api.get("/api/auth/me");
      setUser(userData);
      setDemoSessionEnded(false);
      return userData;
    } catch (error) {
      clearAccessToken();
      setUser(null);
      throw error;
    } finally {
      finishServerWake();
    }
  }, [beginServerWake, finishServerWake]);

  const clearDemoSessionEnded = useCallback(() => {
    setDemoSessionEnded(false);
  }, []);

  const value = {
    user,
    loading,
    serverWaking,
    demoSessionEnded,
    login,
    register,
    loginDemo,
    logout,
    refreshUser,
    restoreOAuthSession,
    clearDemoSessionEnded
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
