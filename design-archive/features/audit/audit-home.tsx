"use client";

import Link from "next/link";
import { useMemo } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import type { AuditRow } from "@/types/audit";

import { progressAt, elapsedOf } from "./simulation";
import { useAudits } from "./use-audits";

/** The page's one primary action, in the header. */
export function StartAuditAction({ storeId }: { storeId: string }) {
  return (
    <HeaderAction>
      <ButtonLink href={`/stores/${storeId}/audits/new`} variant="primary" icon="plus">Start audit</ButtonLink>
    </HeaderAction>
  );
}

/** One line per audit that is running now: seeded or created here. Progress comes from the run clock. */
export function RunningAudits({ storeId, seeded }: { storeId: string; seeded: AuditRow[] }) {
  const { live, rows, now } = useAudits(storeId, seeded);
  const running = useMemo(() => live.filter((a) => a.provisional && a.status !== "draft"), [live]);
  if (running.length === 0) return null;
  return (
    <div className="mb-4 flex flex-col gap-3">
      {running.map((a) => {
        const raw = rows.find((r) => r.id === a.id);
        const p = raw?.plan && raw.run && now > 0 ? progressAt(raw.plan, elapsedOf(raw.run, now)) : null;
        const value = p ? p.overall.n : a.succeededJobs + a.failedJobs + (a.pages?.n ?? 0);
        const max = p ? Math.max(p.overall.d, 1) : Math.max(a.plannedJobs + (a.pages?.d ?? 0), 1);
        return (
          <Card key={a.id} className="border-accent/40">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text"><Icon name={a.paused ? "pause" : "loader"} size={18} className={a.paused ? "" : "animate-spin"} /></span>
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/stores/${storeId}/audits/${a.id}`} className="text-body-sm font-semibold text-fg hover:underline">{a.title}</Link>
                  <Status kind="audit" value={a.status} />
                  {a.paused ? <span className="text-helper text-fg-muted">Paused</span> : null}
                </div>
                <Progress className="mt-2" value={value} max={max} label={`${a.title} progress`} />
                <p className="tnum mt-1.5 text-helper text-fg-muted">{value} / {max} work units{a.failedJobs > 0 ? ` · ${a.failedJobs} failed requests` : ""}</p>
              </div>
              <ButtonLink href={`/stores/${storeId}/audits/${a.id}`} trailingIcon="arrow-right">View progress</ButtonLink>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
