import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, setAccessToken, clearAccessToken, checkApiHealth, setDemoSessionEndCallback } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverWaking, setServerWaking] = useState(false);
  const [demoSessionEnded, setDemoSessionEnded] = useState(false);
  const wakingOperationsRef = useRef(0);

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

  // Try to restore session on mount
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        // Check if API is healthy first (handles cold starts)
        beginServerWake();
        let isHealthy = false;
        try {
          isHealthy = await checkApiHealth();
        } finally {
          if (!cancelled) {
            finishServerWake();
          }
        }

        if (!isHealthy) {
          // Server not ready yet, but don't block the UI
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }

        // Try to refresh token (uses HttpOnly cookie)
        const refreshRes = await fetch(
          `${import.meta.env.VITE_API_URL || ""}/api/auth/refresh`,
          { method: "POST", credentials: "include" }
        );

        if (refreshRes.ok) {
          const { accessToken, user: userData } = await refreshRes.json();
          setAccessToken(accessToken, userData?.isDemo);

          // Fetch user profile
          const { user: fullUserData } = await api.get("/api/auth/me");
          if (!cancelled) {
            setUser(fullUserData);
          }
        }
      } catch {
        // No valid session
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    restoreSession();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password) => {
    const { accessToken, user: userData } = await api.post("/api/auth/login", { email, password });
    setAccessToken(accessToken, userData.isDemo);
    setUser(userData);
    setDemoSessionEnded(false);
    return userData;
  }, []);

  const register = useCallback(async (data) => {
    const { accessToken, user: userData } = await api.post("/api/auth/register", data);
    setAccessToken(accessToken, userData.isDemo);
    setUser(userData);
    setDemoSessionEnded(false);
    return userData;
  }, []);

  const loginDemo = useCallback(async () => {
    // Check if API is awake first
    beginServerWake();
    try {
      const isHealthy = await checkApiHealth();
      if (!isHealthy) {
        throw new Error("Backend server is waking up. Please try again in a few seconds.");
      }

      const { accessToken, user: userData } = await api.post("/api/auth/demo", {});
      setAccessToken(accessToken, true);
      setUser(userData);
      setDemoSessionEnded(false);
      return userData;
    } finally {
      finishServerWake();
    }
  }, [beginServerWake, finishServerWake]);

  const logout = useCallback(async () => {
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
