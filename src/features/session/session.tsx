"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, ApiRequestError, authApi } from "@/lib/api-client";

export type Role = "owner" | "admin" | "manager" | "member" | "viewer";
export type SessionUser = { id: string; name: string; email: string };
export type Organization = { id: string; name: string; slug: string; timezone: string; status: "active" | "suspended"; role: Role };

export type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  /** The server has no accounts set up (no database or sign-in settings). */
  | { status: "unavailable" }
  | { status: "error"; message: string }
  | { status: "ready"; user: SessionUser; organizations: Organization[]; organization: Organization | null };

type Loaded = Exclude<SessionState, { status: "ready" }> | { status: "ready"; user: SessionUser; organizations: Organization[] };

type Session = {
  state: SessionState;
  refresh: () => Promise<void>;
  selectOrganization: (id: string) => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

/** Which organization this browser showed last. A convenience only: the server checks every request. */
const ORGANIZATION_KEY = "rv-organization";

function readChoice(): string | null {
  try {
    return localStorage.getItem(ORGANIZATION_KEY);
  } catch {
    return null;
  }
}

async function load(): Promise<Loaded> {
  try {
    const data = await api<{ user: SessionUser; organizations: Organization[] }>("/api/v1/auth/me");
    return { status: "ready", user: data.user, organizations: data.organizations };
  } catch (error) {
    if (!(error instanceof ApiRequestError)) return { status: "error", message: "Something went wrong. Try again." };
    if (error.status === 401) return { status: "signed-out" };
    if (error.code === "auth_not_configured" || error.code === "AUTH_NOT_CONFIGURED" || error.code === "database_unavailable") return { status: "unavailable" };
    return { status: "error", message: error.message };
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [choice, setChoice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await load();
    setChoice(readChoice());
    setLoaded(next);
  }, []);

  useEffect(() => {
    let live = true;
    void load().then((next) => {
      if (!live) return;
      setChoice(readChoice());
      setLoaded(next);
    });
    return () => {
      live = false;
    };
  }, []);

  const selectOrganization = useCallback((id: string) => {
    try {
      localStorage.setItem(ORGANIZATION_KEY, id);
    } catch {
      /* storage unavailable: the choice lasts until the page is closed */
    }
    setChoice(id);
  }, []);

  const signOut = useCallback(async () => {
    await authApi("/sign-out", {}).catch(() => undefined);
    setLoaded({ status: "signed-out" });
  }, []);

  const state = useMemo<SessionState>(() => {
    if (loaded.status !== "ready") return loaded;
    const organization = loaded.organizations.find((item) => item.id === choice) ?? loaded.organizations[0] ?? null;
    return { ...loaded, organization };
  }, [loaded, choice]);

  const value = useMemo(() => ({ state, refresh, selectOrganization, signOut }), [state, refresh, selectOrganization, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession needs a SessionProvider");
  return session;
}

/** For pages inside the signed-in shell, where the user and organization are guaranteed. */
export function useWorkspace(): { user: SessionUser; organization: Organization } {
  const { state } = useSession();
  if (state.status !== "ready" || !state.organization) throw new Error("This page needs a signed-in organization");
  return { user: state.user, organization: state.organization };
}

const MANAGE_WEBSITES: Role[] = ["owner", "admin"];
/** Mirrors the server's permission so buttons that would be refused are not offered. The server still checks. */
export const canAddWebsite = (role: Role) => MANAGE_WEBSITES.includes(role);
