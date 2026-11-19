"use client";

import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { downloadText } from "@/features/reports/download";

/** Export menu for a report. CSV and JSON download real files; PDF is a demo request. */
export function ExportActions({ baseName, csv, json }: { baseName: string; csv: string; json: string }) {
  const toast = useToast();
  return (
    <Menu
      trigger={<Button variant="primary" icon="download" trailingIcon="chevron-down">Export</Button>}
      items={[
        {
          label: "CSV",
          icon: "database",
          onSelect: () => {
            downloadText(`${baseName}.csv`, "text/csv", csv);
            toast.push({ title: "CSV exported", description: `${baseName}.csv`, tone: "success" });
          },
        },
        {
          label: "JSON",
          icon: "code",
          onSelect: () => {
            downloadText(`${baseName}.json`, "application/json", json);
            toast.push({ title: "JSON exported", description: `${baseName}.json`, tone: "success" });
          },
        },
        {
          label: "PDF",
          icon: "file-text",
          onSelect: () => toast.push({ title: "PDF requested", description: "Demo: no file is generated. This page holds the same content.", tone: "info" }),
        },
      ]}
    />
  );
}

/** Shown when a report failed to generate. */
export function RetryReport({ title }: { title: string }) {
  const toast = useToast();
  return <Button icon="refresh" onClick={() => toast.push({ title: "Retry queued", description: title, tone: "info" })}>Retry</Button>;
}
