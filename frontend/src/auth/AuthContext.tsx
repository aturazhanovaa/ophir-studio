import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearToken, getToken, setToken } from "../api/client";

export type AuthUser = {
  id: number;
  email: string;
  full_name: string;
  is_admin: boolean;
  role: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTok] = useState<string | null>(getToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchMe = async (nextToken?: string | null) => {
    const t = nextToken ?? token;
    if (!t) {
      setUser(null);
      return;
    }
    const me = await api.me();
    setUser(me as AuthUser);
  };

  useEffect(() => {
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        await fetchMe();
      } catch (e) {
        clearToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const value = useMemo<AuthState>(
    () => ({
      token,
      user,
      loading,
      login: async (email, password) => {
        const res = await api.login(email, password);
        const t = (res as any).access_token as string;
        setToken(t);
        setTok(t);
        await fetchMe(t);
      },
      logout: () => {
        clearToken();
        setTok(null);
        setUser(null);
      },
    }),
    [token, user, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
