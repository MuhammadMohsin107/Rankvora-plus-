import { and, eq, ne } from "drizzle-orm";

import type { DbOrTx } from "@/db";
import { promptGroups, prompts } from "@/db/schema";
import { CsvError, parseCsvObjects } from "@/lib/csv";
import type { Actor } from "@/lib/tenancy/actor";
import { recordActivity } from "@/lib/tenancy/activity";
import { TenancyError } from "@/lib/tenancy/errors";
import { parseInput } from "@/lib/tenancy/validation";

import { insertPromptRow, lockStoreForPromptWrite } from "./prompts";
import { hashPromptText } from "./text";
import {
  IMPORT_MAX_ROWS,
  importPromptsInput,
  importRowInput,
} from "./validation";

export type ImportRowResult = {
  /** Spreadsheet line number (the header is line 1). */
  line: number;
  status: "created" | "would_create" | "duplicate" | "invalid";
  errors?: string[];
  promptId?: string;
};

export type ImportReport = {
  dryRun: boolean;
  total: number;
  created: number;
  duplicates: number;
  invalid: number;
  groupsCreated: string[];
  rows: ImportRowResult[];
};

const REQUIRED_COLUMNS = ["prompt_text", "intent"] as const;

/**
 * Imports prompts from CSV text.
 *
 * Columns: prompt_text (required), intent (required), topic, group, language,
 * country, status, tracking_scope, is_core. Every row is checked on its own:
 * invalid rows and duplicates are reported and skipped, valid rows are saved.
 * Use `dryRun: true` to see the full report without saving anything.
 */
export async function importPrompts(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  rawInput: unknown,
): Promise<ImportReport> {
  const input = parseInput(importPromptsInput, rawInput);

  let records: Record<string, string>[];
  try {
    records = parseCsvObjects(input.csv);
  } catch (error) {
    if (error instanceof CsvError) {
      throw new TenancyError("validation", error.message);
    }
    throw error;
  }
  if (records.length === 0) {
    throw new TenancyError("validation", "The CSV has no data rows.");
  }
  if (records.length > IMPORT_MAX_ROWS) {
    throw new TenancyError(
      "validation",
      `Import at most ${IMPORT_MAX_ROWS} prompts at a time (this file has ${records.length}).`,
    );
  }
  const missing = REQUIRED_COLUMNS.filter((column) => !(column in records[0]));
  if (missing.length > 0) {
    throw new TenancyError(
      "validation",
      `The CSV is missing the required column(s): ${missing.join(", ")}.`,
    );
  }

  return dbx.transaction(async (tx) => {
    const store = await lockStoreForPromptWrite(tx, actor, storeId);

    const groupRows = await tx
      .select({ id: promptGroups.id, name: promptGroups.name })
      .from(promptGroups)
      .where(eq(promptGroups.storeId, store.id));
    const groupIds = new Map(
      groupRows.map((g) => [g.name.toLowerCase(), g.id]),
    );
    const newGroups = new Map<string, string>();

    const existing = await tx
      .select({
        language: prompts.language,
        country: prompts.country,
        hash: prompts.textHash,
      })
      .from(prompts)
      .where(
        and(eq(prompts.storeId, store.id), ne(prompts.status, "archived")),
      );
    const seen = new Set(
      existing.map((row) => `${row.language}|${row.country}|${row.hash}`),
    );

    const report: ImportReport = {
      dryRun: input.dryRun,
      total: records.length,
      created: 0,
      duplicates: 0,
      invalid: 0,
      groupsCreated: [],
      rows: [],
    };

    for (const [index, record] of records.entries()) {
      const line = index + 2;
      const parsed = importRowInput.safeParse(record);
      if (!parsed.success) {
        report.invalid += 1;
        report.rows.push({
          line,
          status: "invalid",
          errors: parsed.error.issues.map(
            (issue) => `${issue.path.join(".") || "row"}: ${issue.message}`,
          ),
        });
        continue;
      }
      const row = parsed.data;

      const language = row.language ?? store.language;
      const country = row.country ?? store.market;
      const key = `${language}|${country}|${hashPromptText(row.prompt_text)}`;
      if (seen.has(key)) {
        report.duplicates += 1;
        report.rows.push({
          line,
          status: "duplicate",
          errors: [
            "Same wording already exists (or appears earlier in this file).",
          ],
        });
        continue;
      }
      seen.add(key);

      let groupId: string | null = null;
      if (row.group) {
        const groupKey = row.group.toLowerCase();
        const known = groupIds.get(groupKey) ?? newGroups.get(groupKey);
        if (known !== undefined) {
          // "" is the placeholder for a group a dry run would create.
          groupId = known || null;
        } else if (input.dryRun) {
          newGroups.set(groupKey, "");
          report.groupsCreated.push(row.group);
        } else {
          const [group] = await tx
            .insert(promptGroups)
            .values({
              organizationId: store.organizationId,
              storeId: store.id,
              name: row.group,
            })
            .returning();
          groupId = group.id;
          newGroups.set(groupKey, group.id);
          report.groupsCreated.push(group.name);
        }
      }

      if (input.dryRun) {
        report.created += 1;
        report.rows.push({ line, status: "would_create" });
        continue;
      }

      const prompt = await insertPromptRow(tx, actor, store, {
        text: row.prompt_text,
        intent: row.intent,
        topic: row.topic ?? null,
        groupId,
        language,
        country,
        isCore: row.is_core ?? false,
        creationSource: "imported",
        status: row.status,
        trackingScope: row.tracking_scope,
      });
      report.created += 1;
      report.rows.push({ line, status: "created", promptId: prompt.id });
    }

    if (
      !input.dryRun &&
      (report.created > 0 || report.groupsCreated.length > 0)
    ) {
      await recordActivity(tx, actor, {
        organizationId: store.organizationId,
        storeId: store.id,
        action: "prompt.imported",
        resourceType: "prompt",
        details: {
          total: report.total,
          created: report.created,
          duplicates: report.duplicates,
          invalid: report.invalid,
          groupsCreated: report.groupsCreated,
        },
      });
    }

    return report;
  });
}
