"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const FORMATS = [
  { id: "CSV", icon: "list", hint: "Rows: responses and checks" },
  { id: "JSON", icon: "code", hint: "Full snapshot with ids" },
  { id: "PDF", icon: "file-text", hint: "Formatted report" },
] as const;

/**
 * Export buttons. Demo: each pushes a toast confirming the request.
 * When the formatted report failed, PDF is unavailable and the one other action is to regenerate it.
 */
export function ReportActions({ snapshotId, reportStatus }: { snapshotId: string; reportStatus?: "ready" | "generating" | "failed" | null }) {
  const toast = useToast();
  const failed = reportStatus === "failed";
  return (
    <ul className="flex flex-col gap-2">
      {FORMATS.map((f) => {
        const unavailable = failed && f.id === "PDF";
        return (
          <li key={f.id}>
            <Button
              icon="download"
              className="w-full justify-start"
              disabled={unavailable}
              title={unavailable ? "The formatted report failed to generate. Regenerate it first." : undefined}
              onClick={() => toast.push({ title: `${f.id} export ready`, description: `Snapshot ${snapshotId}. Demo: no file is generated.`, tone: "success" })}
            >
              Export {f.id}
              <span className="ml-auto text-xs font-normal text-fg-subtle">{unavailable ? "Unavailable" : f.hint}</span>
            </Button>
          </li>
        );
      })}
      {failed ? (
        <li>
          <Button
            icon="refresh"
            className="w-full justify-start"
            onClick={() => toast.push({ title: "Report regeneration queued", description: `Snapshot ${snapshotId} is unchanged. Demo: nothing runs.`, tone: "info" })}
          >
            Regenerate report
          </Button>
        </li>
      ) : null}
    </ul>
  );
}
