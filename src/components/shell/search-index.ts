import { listPromptsBase } from "@/services/core";
import { listFindings, registry } from "@/services/records";
import type { Store } from "@/types/core";

import type { SearchIndex } from "./search-types";

/** Static (seeded) records for the command palette. Runs on the server; the result is plain JSON. */
export async function buildSearchIndex(stores: Pick<Store, "id">[]): Promise<SearchIndex> {
  const perStore = await Promise.all(
    stores.map(async ({ id }) => {
      const [prompts, findings] = await Promise.all([listPromptsBase(id), listFindings(id)]);
      return {
        prompts: prompts.map((p) => ({ id: p.id, storeId: id, text: p.text, status: p.status })),
        findings: findings.map((f) => ({ id: f.id, storeId: id, title: f.title, status: f.status })),
        tasks: registry.tasks(id).map((t) => ({ id: t.id, storeId: id, title: t.title, status: t.status })),
        runs: registry.runs(id).map((r) => ({ id: r.id, storeId: id, scheduledFor: r.scheduledFor, status: r.status })),
        reports: registry.reports(id).map((r) => ({ id: r.id, storeId: id, title: r.title, type: r.type })),
      };
    }),
  );
  return {
    prompts: perStore.flatMap((s) => s.prompts),
    findings: perStore.flatMap((s) => s.findings),
    tasks: perStore.flatMap((s) => s.tasks),
    runs: perStore.flatMap((s) => s.runs),
    reports: perStore.flatMap((s) => s.reports),
  };
}
