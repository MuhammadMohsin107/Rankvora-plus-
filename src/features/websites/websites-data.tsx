"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, ApiRequestError } from "@/lib/api-client";
import type { SiteType, WebsiteStatus } from "@/server/db/schema";

export type Website = {
  id: string;
  organizationId: string;
  name: string;
  siteType: SiteType;
  businessCategory: string | null;
  businessDescription: string | null;
  market: string;
  language: string;
  timezone: string;
  status: Exclude<WebsiteStatus, "removed">;
  version: number;
  createdAt: string;
  updatedAt: string;
  domain: { id: string; host: string; verificationStatus: "unverified" | "pending" | "verified"; verifiedAt: string | null } | null;
};

type Result = { organizationId: string; websites: Website[]; error: string | null };

type WebsitesState = { status: "loading" | "ready" | "error"; websites: Website[]; error: string | null; reload: () => Promise<void> };

const WebsitesContext = createContext<WebsitesState | null>(null);

async function fetchWebsites(organizationId: string): Promise<Result> {
  try {
    const websites = await api<Website[]>(`/api/v1/websites?organizationId=${encodeURIComponent(organizationId)}`);
    return { organizationId, websites, error: null };
  } catch (error) {
    return { organizationId, websites: [], error: error instanceof ApiRequestError ? error.message : "Could not load the websites." };
  }
}

/** The selected organization's websites, shared by the header, search and the websites pages. */
export function WebsitesProvider({ organizationId, children }: { organizationId: string; children: ReactNode }) {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let live = true;
    void fetchWebsites(organizationId).then((next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
    };
  }, [organizationId]);

  const reload = useCallback(async () => {
    setResult(await fetchWebsites(organizationId));
  }, [organizationId]);

  const value = useMemo<WebsitesState>(() => {
    // A result for another organization is not this one's: keep loading until the right one arrives.
    if (!result || result.organizationId !== organizationId) return { status: "loading", websites: [], error: null, reload };
    return { status: result.error ? "error" : "ready", websites: result.websites, error: result.error, reload };
  }, [result, organizationId, reload]);

  return <WebsitesContext.Provider value={value}>{children}</WebsitesContext.Provider>;
}

export function useWebsites(): WebsitesState {
  const value = useContext(WebsitesContext);
  if (!value) throw new Error("useWebsites needs a WebsitesProvider");
  return value;
}
