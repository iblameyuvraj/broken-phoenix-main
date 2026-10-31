"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, LOGOUT_EVENT, setToken } from "./api";
import type { TokenResponse, User } from "./types";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Restore the session after a full page refresh.
    if (!getToken()) {
      setReady(true);
      return;
    }
    api<User>("/api/auth/me")
      .then(setUser)
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(res.access_token);
    setUser(res.user);
  }, []);

  // A 401 from any call ends the session everywhere (see api.ts).
  useEffect(() => {
    const onLogout = () => {
      setUser(null);
      setReady(true);
    };
    window.addEventListener(LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(LOGOUT_EVENT, onLogout);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
