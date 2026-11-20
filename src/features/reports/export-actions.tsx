"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { downloadText } from "@/features/reports/download";
import { reportToCsv, reportToHtml, reportToJson, exportFileName } from "@/features/reports/exports";
import type { ReportDocument } from "@/types/shared-records";

/** Prints a standalone HTML page through a hidden frame, so the shell, tabs and drawers never reach the paper. */
export function printHtml(html: string): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0";
  frame.srcdoc = html;
  const cleanup = () => window.setTimeout(() => frame.remove(), 1000);
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) return cleanup();
    win.addEventListener("afterprint", cleanup);
    win.focus();
    win.print();
  };
  document.body.appendChild(frame);
}

type Text = string | (() => string);
const text = (value: Text) => (typeof value === "function" ? value() : value);

type ExportMenuProps = {
  /** File name stem, for example the report id. */
  baseName: string;
  /** Strings, or functions called when the item is chosen (so a timestamp is taken at export time). */
  csv: Text;
  json: Text;
  /** Standalone HTML. Enables Preview, Download HTML and Print. */
  html?: Text;
  title?: string;
};

/**
 * ONE export menu for any report: Preview, HTML, CSV, JSON and Print (save as PDF). Every item produces a real file
 * or print job in the browser from the content it is given. Reused by Audit and Comparison.
 */
export function ExportActions({ baseName, csv, json, html, title = "Report preview" }: ExportMenuProps) {
  const toast = useToast();
  const [preview, setPreview] = useState<string | null>(null);
  const save = (extension: "csv" | "json" | "html", mime: string, content: string, label: string) => {
    const name = exportFileName(baseName, extension);
    downloadText(name, mime, content);
    toast.push({ title: `${label} downloaded`, description: name, tone: "success" });
  };
  return (
    <>
      <Menu
        label="Export report"
        trigger={<Button variant="secondary" icon="download" trailingIcon="chevron-down">Export</Button>}
        items={[
          ...(html ? [{ label: "Preview", icon: "eye" as const, onSelect: () => setPreview(text(html)) }] : []),
          ...(html ? [{ label: "HTML", icon: "code" as const, onSelect: () => save("html", "text/html", text(html), "HTML") }] : []),
          { label: "CSV", icon: "database", onSelect: () => save("csv", "text/csv", text(csv), "CSV") },
          { label: "JSON", icon: "file-text", onSelect: () => save("json", "application/json", text(json), "JSON") },
          ...(html ? [{ label: "Print or save as PDF", icon: "reports" as const, onSelect: () => printHtml(text(html)) }] : []),
        ]}
      />
      {html ? (
        <Dialog
          open={preview !== null}
          onClose={() => setPreview(null)}
          title={title}
          size="xl"
          footer={
            <>
              <Button variant="secondary" onClick={() => setPreview(null)}>Close</Button>
              <Button variant="primary" icon="reports" onClick={() => preview && printHtml(preview)}>Print or save as PDF</Button>
            </>
          }
        >
          <iframe title="Standalone HTML export" srcDoc={preview ?? ""} sandbox="allow-same-origin" className="h-[60dvh] w-full rounded-control border border-line bg-surface" />
        </Dialog>
      ) : null}
    </>
  );
}

/** Export menu for a ReportDocument: builds CSV, JSON and HTML from the document that is on screen. */
export function ReportExportMenu({ reportId, doc }: { reportId: string; doc: ReportDocument }) {
  const now = () => new Date().toISOString();
  return <ExportActions baseName={reportId} csv={() => reportToCsv(doc)} json={() => reportToJson(doc, now())} html={() => reportToHtml(doc, now())} title={doc.title} />;
}
