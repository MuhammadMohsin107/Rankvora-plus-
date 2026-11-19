/** Client-side CSV dry run for prompt import. Pure functions: no I/O, no randomness. */
import { parseCsvObjects } from "@/lib/csv";
import type { PromptIntent, PromptScope, PromptStatus } from "@/types/core";

import { findDuplicate, normalisePrompt, validatePromptText } from "./text";

export const CSV_COLUMNS = ["prompt_text", "intent", "topic", "group", "language", "country", "status", "tracking_scope", "is_core"] as const;
export const MAX_IMPORT_ROWS = 500;

const INTENTS: PromptIntent[] = ["discovery", "recommendation", "comparison", "alternative", "product_service", "local_market", "informational"];
const SCOPES: PromptScope[] = ["audit", "monitoring", "both"];
const STATUSES: PromptStatus[] = ["draft", "active", "paused"];

export type ImportDefaults = {
  language: string;
  market: string;
  groups: { id: string; name: string }[];
  existing: { id: string; text: string }[];
};

export type ImportRowResult = "create" | "duplicate" | "invalid";

export type ImportRow = {
  /** Row number in the file, header = 1. */
  line: number;
  text: string;
  intent: string;
  group: string;
  scope: string;
  status: string;
  result: ImportRowResult;
  /** Reasons (invalid / duplicate) or short notes (create). */
  notes: string[];
};

export type ImportPreview = {
  rows: ImportRow[];
  /** Blocking problem with the whole file. */
  fileError: string | null;
  ignoredColumns: string[];
};

const slug = (value: string) => value.trim().toLowerCase().replace(/[\s/-]+/g, "_");

function parseBool(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (v === "") return false;
  if (["true", "yes", "y", "1"].includes(v)) return true;
  if (["false", "no", "n", "0"].includes(v)) return false;
  return null;
}

const clip = (value: string, max = 48) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

export function previewImport(input: string, defaults: ImportDefaults): ImportPreview {
  const empty: ImportPreview = { rows: [], fileError: null, ignoredColumns: [] };
  if (input.trim() === "") return empty;

  let records: Record<string, string>[];
  try {
    records = parseCsvObjects(input);
  } catch (error) {
    return { ...empty, fileError: error instanceof Error ? error.message : "The file could not be read as CSV." };
  }
  if (records.length === 0) return { ...empty, fileError: "No data rows found under the header." };

  const headers = Object.keys(records[0]);
  if (!headers.includes("prompt_text")) return { ...empty, fileError: "Missing required column: prompt_text." };
  const ignoredColumns = headers.filter((h) => !(CSV_COLUMNS as readonly string[]).includes(h));
  if (records.length > MAX_IMPORT_ROWS) return { ...empty, ignoredColumns, fileError: `${records.length} rows found. The maximum is ${MAX_IMPORT_ROWS} per import.` };

  const seen: { id: string; text: string }[] = [];
  const rows = records.map<ImportRow>((record, index) => {
    const line = index + 2;
    const problems: string[] = [];
    const notes: string[] = [];
    const text = record.prompt_text ?? "";

    const textProblem = validatePromptText(text);
    if (textProblem) problems.push(`Text: ${textProblem}`);

    const rawIntent = slug(record.intent ?? "");
    let intent: PromptIntent = "discovery";
    if (rawIntent === "") notes.push("Intent defaults to Discovery");
    else if ((INTENTS as string[]).includes(rawIntent)) intent = rawIntent as PromptIntent;
    else problems.push(`Unknown intent “${record.intent}”`);

    const rawScope = slug(record.tracking_scope ?? "");
    let scope: PromptScope = "both";
    if (rawScope !== "") {
      if ((SCOPES as string[]).includes(rawScope)) scope = rawScope as PromptScope;
      else problems.push(`Unknown tracking scope “${record.tracking_scope}”`);
    }

    const rawStatus = slug(record.status ?? "");
    let status: PromptStatus = "draft";
    if (rawStatus !== "") {
      if ((STATUSES as string[]).includes(rawStatus)) status = rawStatus as PromptStatus;
      else problems.push(`Status must be draft, active or paused (“${record.status}”)`);
    }

    const language = (record.language ?? "").trim() || defaults.language;
    if (!/^[A-Za-z]{2}$/.test(language)) problems.push(`Language must be a 2-letter code (“${language}”)`);
    const country = (record.country ?? "").trim() || defaults.market;
    if (!/^[A-Za-z]{2}$/.test(country)) problems.push(`Country must be a 2-letter code (“${country}”)`);
    if (parseBool(record.is_core ?? "") === null) problems.push(`is_core must be true or false (“${record.is_core}”)`);

    const groupName = (record.group ?? "").trim();
    if (groupName && !defaults.groups.some((g) => g.name.toLowerCase() === groupName.toLowerCase())) notes.push(`New group “${groupName}”`);

    const base = { line, text, intent, group: groupName || "Ungrouped", scope, status };
    if (problems.length > 0) return { ...base, result: "invalid", notes: problems };

    const earlier = seen.find((s) => normalisePrompt(s.text) === normalisePrompt(text));
    if (earlier) return { ...base, result: "duplicate", notes: [`Repeats row ${earlier.id}`] };
    const match = findDuplicate(text, defaults.existing);
    if (match?.kind === "exact") return { ...base, result: "duplicate", notes: ["Already in the library"] };
    if (match) notes.push(`Similar to “${clip(match.text)}”`);
    seen.push({ id: String(line), text });
    return { ...base, result: "create", notes };
  });

  return { rows, fileError: null, ignoredColumns };
}

const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;

export function toCsvText(rows: string[][]): string {
  return [CSV_COLUMNS.join(","), ...rows.map((row) => row.map(quote).join(","))].join("\n");
}
