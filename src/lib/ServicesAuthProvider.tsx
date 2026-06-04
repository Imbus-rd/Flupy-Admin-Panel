"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const TOKEN_KEY = "flupy_services_admin_token";
const ADMIN_KEY = "flupy_services_admin_user";

export type ServicesAdmin = {
  id: number;
  email: string;
  full_name: string;
  role: string;
};

type ServicesAuthContext = {
  token: string | null;
  admin: ServicesAdmin | null;
  ready: boolean;
  setAuth: (token: string, admin: ServicesAdmin) => void;
  logout: () => void;
};

const Context = createContext<ServicesAuthContext | null>(null);

function readToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function readAdmin() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ADMIN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServicesAdmin;
  } catch {
    return null;
  }
}

export function ServicesAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<ServicesAdmin | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setToken(readToken());
    setAdmin(readAdmin());
    setReady(true);
  }, []);

  const setAuth = useCallback((nextToken: string, nextAdmin: ServicesAdmin) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(nextAdmin));
    setToken(nextToken);
    setAdmin(nextAdmin);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    setToken(null);
    setAdmin(null);
    router.push("/services/login");
  }, [router]);

  const value = useMemo(
    () => ({ token, admin, ready, setAuth, logout }),
    [token, admin, ready, setAuth, logout]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useServicesAuth() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useServicesAuth must be used within ServicesAuthProvider");
  return ctx;
}
