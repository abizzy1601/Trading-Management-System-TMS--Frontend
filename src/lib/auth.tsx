import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, refreshSession, setAccessToken, setSessionLostHandler } from "./api";
import type { AuthResponse, User } from "./types";

type Status = "loading" | "authed" | "anon";

interface AuthContextValue {
  user: User | null;
  status: Status;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, fullName: string): Promise<void>;
  logout(): Promise<void>;
  /** Re-read the profile, e.g. after a subscription change. */
  reload(): Promise<User | null>;
  setUser(user: User): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const queryClient = useQueryClient();

  const accept = useCallback((data: AuthResponse) => {
    setAccessToken(data.access_token, data.expires_in);
    setUser(data.user);
    setStatus("authed");
  }, []);

  const drop = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("anon");
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let cancelled = false;
    refreshSession().then((data) => {
      if (cancelled) return;
      if (data) accept(data);
      else setStatus("anon");
    });
    setSessionLostHandler(drop);
    return () => {
      cancelled = true;
      setSessionLostHandler(null);
    };
  }, [accept, drop]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      async login(email, password) {
        accept(await api<AuthResponse>("/auth/login", { method: "POST", body: { email, password } }));
      },
      async register(email, password, fullName) {
        accept(await api<AuthResponse>("/auth/register", { method: "POST", body: { email, password, full_name: fullName } }));
      },
      async logout() {
        try {
          await api("/auth/logout", { method: "POST" });
        } finally {
          drop();
        }
      },
      async reload() {
        try {
          const me = await api<User>("/auth/me");
          setUser(me);
          return me;
        } catch {
          return null;
        }
      },
      setUser,
    }),
    [user, status, accept, drop],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function useEntitled(): boolean {
  return useAuth().user?.subscription.entitled ?? false;
}
