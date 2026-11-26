// Runs the real SQL against a local, in-memory D1 (miniflare through wrangler's getPlatformProxy).
// No Cloudflare account or login needed. Excluded from `npm run test:unit`; run with `npm run test:d1`.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPlatformProxy, type PlatformProxy } from "wrangler";

import { createEmptyState } from "@/demo-state/state";

import { createDb } from "./client";
import { decideSave } from "./payload";
import { workspaceStore } from "./workspaces";

let proxy: PlatformProxy<{ DB: D1Database }>;
let d1: D1Database;
let store: ReturnType<typeof workspaceStore>;

async function applyMigrations(db: D1Database) {
  const dir = join(process.cwd(), "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const statements = readFileSync(join(dir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const sql of statements) await db.prepare(sql).run();
  }
}

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ configPath: "wrangler.jsonc", persist: false });
  d1 = proxy.env.DB;
  await applyMigrations(d1);
  store = workspaceStore(createDb(d1));
});

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  await d1.prepare("delete from workspaces").run();
});

const stateWithSeq = (seq: number) => ({ ...createEmptyState(), seq });

describe("workspaceStore on local D1", () => {
  it("loads null for an unknown workspace", async () => {
    expect(await store.load("nope")).toBeNull();
  });

  it("creates with expectedRevision 0 and returns revision 1", async () => {
    const r = await store.save("w1", stateWithSeq(1), 0);
    expect(r).toEqual({ ok: true, revision: 1 });
    const loaded = await store.load("w1");
    expect(loaded?.revision).toBe(1);
    expect(loaded?.state.seq).toBe(1);
    expect(loaded?.updatedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it("increments the revision on each save and stores schema_version", async () => {
    await store.save("w1", stateWithSeq(1), 0);
    expect(await store.save("w1", stateWithSeq(2), 1)).toEqual({ ok: true, revision: 2 });
    expect(await store.save("w1", stateWithSeq(3))).toEqual({ ok: true, revision: 3 });
    const row = await d1.prepare("select schema_version, revision from workspaces where id = ?").bind("w1").first();
    expect(row).toEqual({ schema_version: 1, revision: 3 });
  });

  it("reports a conflict with the server state when the revision is stale", async () => {
    await store.save("w1", stateWithSeq(1), 0);
    await store.save("w1", stateWithSeq(2), 1);
    const r = await store.save("w1", stateWithSeq(99), 1);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.current?.revision).toBe(2);
      expect(r.current?.state.seq).toBe(2);
    }
    expect((await store.load("w1"))?.state.seq).toBe(2); // the stale write changed nothing
  });

  it("treats expectedRevision 0 as a conflict when the workspace already exists", async () => {
    await store.save("w1", stateWithSeq(1));
    const r = await store.save("w1", stateWithSeq(5), 0);
    expect(r.ok).toBe(false);
    expect((await store.load("w1"))?.state.seq).toBe(1);
  });

  it("treats a non-zero expectedRevision as a conflict when the workspace does not exist", async () => {
    const r = await store.save("ghost", stateWithSeq(1), 4);
    expect(r).toEqual({ ok: false, conflict: true, current: null });
    expect(await store.load("ghost")).toBeNull();
  });

  it("agrees with the pure decideSave rule for every combination", async () => {
    for (const current of [null, 1, 3] as const) {
      for (const expected of [undefined, 0, 1, 3, 7]) {
        await d1.prepare("delete from workspaces").run();
        if (current !== null) {
          await store.save("w", stateWithSeq(0));
          for (let i = 1; i < current; i++) await store.save("w", stateWithSeq(i));
        }
        const outcome = await store.save("w", stateWithSeq(42), expected);
        const rule = decideSave(current, expected);
        expect(outcome.ok, `current=${current} expected=${expected}`).toBe(rule.ok);
        if (outcome.ok && rule.ok) expect(outcome.revision).toBe(rule.revision);
      }
    }
  });

  it("keeps workspaces isolated and deletes only the requested one", async () => {
    await store.save("a", stateWithSeq(1), 0);
    await store.save("b", stateWithSeq(2), 0);
    await store.remove("a");
    expect(await store.load("a")).toBeNull();
    expect((await store.load("b"))?.state.seq).toBe(2);
    await store.remove("a"); // idempotent
  });

  it("serves an empty state at the real revision when the stored JSON is unreadable", async () => {
    await store.save("w1", stateWithSeq(1), 0);
    await d1.prepare("update workspaces set state = ? where id = ?").bind("{broken", "w1").run();
    const loaded = await store.load("w1");
    expect(loaded?.revision).toBe(1);
    expect(loaded?.state).toEqual(createEmptyState());
  });

  it("has the workspaces table with the documented columns", async () => {
    const cols = await d1.prepare("select name from pragma_table_info('workspaces') order by cid").all<{ name: string }>();
    expect(cols.results.map((c) => c.name)).toEqual(["id", "state", "schema_version", "revision", "created_at", "updated_at"]);
  });
});
