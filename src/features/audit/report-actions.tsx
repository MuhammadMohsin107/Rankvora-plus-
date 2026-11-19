"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const FORMATS = [
  { id: "CSV", icon: "list", hint: "Rows: responses and checks" },
  { id: "JSON", icon: "code", hint: "Full snapshot with ids" },
  { id: "PDF", icon: "file-text", hint: "Formatted report" },
] as const;

/** Export buttons. Demo: each pushes a toast confirming the request. */
export function ReportActions({ snapshotId }: { snapshotId: string }) {
  const toast = useToast();
  return (
    <ul className="flex flex-col gap-2">
      {FORMATS.map((f) => (
        <li key={f.id}>
          <Button
            icon="download"
            className="w-full justify-start"
            onClick={() => toast.push({ title: `${f.id} export ready`, description: `Snapshot ${snapshotId}. Demo: no file is generated.`, tone: "success" })}
          >
            Export {f.id}
            <span className="ml-auto text-xs font-normal text-fg-subtle">{f.hint}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
