import { and, desc, eq, ne } from "drizzle-orm";

import type { DbOrTx } from "@/db";
import {
  brandProfiles,
  promptGroups,
  prompts,
  promptVersions,
} from "@/db/schema";
import type { Actor } from "@/lib/tenancy/actor";
import { requireStoreAccess } from "@/lib/tenancy/access";

import { referencesBrand } from "./text";

export type PromptLibrarySummary = {
  total: number;
  byStatus: Record<string, number>;
  byIntent: Record<string, number>;
  byGroup: { groupId: string | null; name: string | null; count: number }[];
  coreCount: number;
  /** Active prompts that name the brand or an alias. */
  brandSpecificActive: number;
  /** Active prompts that do not name the brand (neutral discovery). */
  neutralActive: number;
  warnings: string[];
};

function tally<T extends string>(values: readonly T[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

/**
 * Overview of a store's prompt library, with a check that it is not made up
 * only of prompts that name the brand: neutral questions are what show whether
 * the brand is surfaced on its own.
 */
export async function getPromptLibrarySummary(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
): Promise<PromptLibrarySummary> {
  const { store } = await requireStoreAccess(dbx, actor, storeId, "store:read");

  const rows = await dbx
    .select({
      status: prompts.status,
      intent: prompts.intent,
      groupId: prompts.groupId,
      isCore: prompts.isCore,
      text: promptVersions.text,
    })
    .from(prompts)
    .innerJoin(
      promptVersions,
      and(
        eq(promptVersions.promptId, prompts.id),
        eq(promptVersions.version, prompts.currentVersion),
      ),
    )
    .where(and(eq(prompts.storeId, store.id), ne(prompts.status, "archived")));

  const groups = await dbx
    .select({ id: promptGroups.id, name: promptGroups.name })
    .from(promptGroups)
    .where(eq(promptGroups.storeId, store.id));
  const groupName = new Map(groups.map((group) => [group.id, group.name]));

  const [profile] = await dbx
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.storeId, store.id))
    .orderBy(desc(brandProfiles.version))
    .limit(1);
  const brandNames = profile
    ? [profile.brandName, profile.legalName ?? "", ...profile.aliases]
    : [];

  const active = rows.filter((row) => row.status === "active");
  const brandSpecificActive = active.filter((row) =>
    referencesBrand(row.text, brandNames),
  ).length;
  const neutralActive = active.length - brandSpecificActive;

  const groupCounts = new Map<string | null, number>();
  for (const row of rows) {
    groupCounts.set(row.groupId, (groupCounts.get(row.groupId) ?? 0) + 1);
  }

  const warnings: string[] = [];
  if (active.length >= 5 && neutralActive === 0) {
    warnings.push(
      "Every active prompt names the brand. Add neutral discovery questions so you can see whether the brand is mentioned without being asked about.",
    );
  }
  if (rows.length > 0 && active.length === 0) {
    warnings.push("No prompts are active yet, so nothing can be tracked.");
  }

  return {
    total: rows.length,
    byStatus: tally(rows.map((row) => row.status)),
    byIntent: tally(rows.map((row) => row.intent)),
    byGroup: [...groupCounts.entries()].map(([groupId, count]) => ({
      groupId,
      name: groupId ? (groupName.get(groupId) ?? null) : null,
      count,
    })),
    coreCount: rows.filter((row) => row.isCore).length,
    brandSpecificActive,
    neutralActive,
    warnings,
  };
}
