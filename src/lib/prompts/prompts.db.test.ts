import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { pool, type DbOrTx } from "@/db";
import {
  brandProfiles,
  promptGroups,
  promptProducts,
  prompts,
  promptVersions,
} from "@/db/schema";
import {
  addTestMember,
  createTestUser,
  validStoreInput,
  withRollback,
} from "@/test/db";
import { createOrganization } from "@/lib/tenancy/organizations";
import { createProductService } from "@/lib/tenancy/products";
import { createStore, transitionStoreStatus } from "@/lib/tenancy/stores";

import {
  createPromptGroup,
  deletePromptGroup,
  listPromptGroups,
  updatePromptGroup,
} from "./groups";
import { importPrompts } from "./import";
import {
  createPrompt,
  getPrompt,
  listPrompts,
  listPromptVersions,
  setPromptStatus,
  updatePrompt,
} from "./prompts";
import { getPromptLibrarySummary } from "./summary";
import {
  archivePromptTemplate,
  copyTemplateToStore,
  createPromptTemplate,
  listPromptTemplates,
} from "./templates";

afterAll(async () => {
  await pool.end();
});

const denied = { code: "not_found" };

async function oneStore(tx: DbOrTx) {
  const user = await createTestUser(tx);
  const org = await createOrganization(tx, user.actor, { name: "Org" });
  const { store } = await createStore(
    tx,
    user.actor,
    validStoreInput(org.id, {
      brandName: "RunPro",
      language: "en",
      market: "PK",
    }),
  );
  return { user, actor: user.actor, org, store };
}

const basePrompt = {
  text: "What are the best running shoes for beginners?",
  intent: "discovery",
};

describe("creating prompts", () => {
  it("defaults language and country from the store and writes version 1", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      const { prompt } = await createPrompt(tx, actor, store.id, basePrompt);

      expect(prompt).toMatchObject({
        status: "draft",
        language: "en",
        country: "PK",
        currentVersion: 1,
        trackingScope: "both",
        creationSource: "manual",
        text: basePrompt.text,
      });
      const versions = await listPromptVersions(tx, actor, store.id, prompt.id);
      expect(versions).toHaveLength(1);
      expect(versions[0]).toMatchObject({ version: 1, text: basePrompt.text });
    });
  });

  it("blocks exact duplicates (ignoring case and punctuation) but allows other markets", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      await createPrompt(tx, actor, store.id, basePrompt);

      await expect(
        createPrompt(tx, actor, store.id, {
          ...basePrompt,
          text: "what are the BEST running shoes for beginners",
        }),
      ).rejects.toMatchObject({ code: "conflict" });

      await expect(
        createPrompt(tx, actor, store.id, { ...basePrompt, country: "AE" }),
      ).resolves.toBeDefined();
    });
  });

  it("warns about near-duplicates without blocking them", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      await createPrompt(tx, actor, store.id, {
        text: "Which running shoes are best for beginners in Lahore",
        intent: "local_market",
      });
      const { similar } = await createPrompt(tx, actor, store.id, {
        text: "Which running shoes are best for beginners in Karachi",
        intent: "local_market",
      });
      expect(similar).toHaveLength(1);
      expect(similar[0].similarity).toBeGreaterThan(0.7);
    });
  });

  it("frees the wording when a prompt is archived", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      const { prompt } = await createPrompt(tx, actor, store.id, basePrompt);
      await setPromptStatus(tx, actor, store.id, prompt.id, "archived");
      await expect(
        createPrompt(tx, actor, store.id, basePrompt),
      ).resolves.toBeDefined();
    });
  });

  it("links products from the same store only", async () => {
    await withRollback(async (tx) => {
      const { actor, org, store } = await oneStore(tx);
      const other = (await createStore(tx, actor, validStoreInput(org.id)))
        .store;
      const mine = await createProductService(tx, actor, store.id, {
        title: "Mine",
      });
      const theirs = await createProductService(tx, actor, other.id, {
        title: "Theirs",
      });

      const { prompt } = await createPrompt(tx, actor, store.id, {
        ...basePrompt,
        productIds: [mine.id],
      });
      expect(
        (await getPrompt(tx, actor, store.id, prompt.id)).productIds,
      ).toEqual([mine.id]);

      await expect(
        createPrompt(tx, actor, store.id, {
          text: "Another question",
          intent: "product_service",
          productIds: [theirs.id],
        }),
      ).rejects.toMatchObject(denied);
    });
  });
});

describe("tenant isolation", () => {
  async function twoTenants(tx: DbOrTx) {
    const a = await oneStore(tx);
    const b = await oneStore(tx);
    const { prompt } = await createPrompt(tx, b.actor, b.store.id, basePrompt);
    const group = await createPromptGroup(tx, b.actor, b.store.id, {
      name: "Secret",
    });
    return { a, b, prompt, group };
  }

  it("hides another customer's prompts, versions, groups and library", async () => {
    await withRollback(async (tx) => {
      const { a, b, prompt, group } = await twoTenants(tx);

      await expect(listPrompts(tx, a.actor, b.store.id)).rejects.toMatchObject(
        denied,
      );
      await expect(
        getPrompt(tx, a.actor, b.store.id, prompt.id),
      ).rejects.toMatchObject(denied);
      await expect(
        listPromptVersions(tx, a.actor, b.store.id, prompt.id),
      ).rejects.toMatchObject(denied);
      await expect(
        getPromptLibrarySummary(tx, a.actor, b.store.id),
      ).rejects.toMatchObject(denied);
      await expect(
        listPromptGroups(tx, a.actor, b.store.id),
      ).rejects.toMatchObject(denied);
      await expect(
        createPrompt(tx, a.actor, b.store.id, {
          text: "Planted",
          intent: "discovery",
        }),
      ).rejects.toMatchObject(denied);
      await expect(
        updatePrompt(tx, a.actor, b.store.id, prompt.id, { text: "Changed" }),
      ).rejects.toMatchObject(denied);
      await expect(
        setPromptStatus(tx, a.actor, b.store.id, prompt.id, "archived"),
      ).rejects.toMatchObject(denied);
      await expect(
        updatePromptGroup(tx, a.actor, b.store.id, group.id, { name: "Mine" }),
      ).rejects.toMatchObject(denied);
      await expect(
        deletePromptGroup(tx, a.actor, b.store.id, group.id),
      ).rejects.toMatchObject(denied);
      await expect(
        importPrompts(tx, a.actor, b.store.id, {
          csv: "prompt_text,intent\nHi there,discovery",
        }),
      ).rejects.toMatchObject(denied);
    });
  });

  it("treats another store's prompt or group id as missing, even in the same organization", async () => {
    await withRollback(async (tx) => {
      const { actor, org, store } = await oneStore(tx);
      const other = (await createStore(tx, actor, validStoreInput(org.id)))
        .store;
      const { prompt } = await createPrompt(tx, actor, store.id, basePrompt);
      const group = await createPromptGroup(tx, actor, store.id, { name: "G" });

      await expect(
        getPrompt(tx, actor, other.id, prompt.id),
      ).rejects.toMatchObject(denied);
      await expect(
        updatePrompt(tx, actor, other.id, prompt.id, { topic: "x" }),
      ).rejects.toMatchObject(denied);
      await expect(
        createPrompt(tx, actor, other.id, {
          text: "New one",
          intent: "discovery",
          groupId: group.id,
        }),
      ).rejects.toMatchObject(denied);
      expect((await listPrompts(tx, actor, other.id)).total).toBe(0);
    });
  });

  it("enforces store consistency in the database for groups and product links", async () => {
    await withRollback(async (tx) => {
      const { actor, org, store } = await oneStore(tx);
      const other = (await createStore(tx, actor, validStoreInput(org.id)))
        .store;
      const group = await createPromptGroup(tx, actor, other.id, {
        name: "Other",
      });
      const { prompt } = await createPrompt(tx, actor, store.id, basePrompt);
      const product = await createProductService(tx, actor, other.id, {
        title: "Other",
      });

      await expect(
        tx.transaction((inner) =>
          inner
            .update(prompts)
            .set({ groupId: group.id })
            .where(eq(prompts.id, prompt.id)),
        ),
      ).rejects.toMatchObject({ cause: { code: "23503" } });

      await expect(
        tx.transaction((inner) =>
          inner.insert(promptProducts).values({
            organizationId: org.id,
            storeId: store.id,
            promptId: prompt.id,
            productServiceId: product.id,
          }),
        ),
      ).rejects.toMatchObject({ cause: { code: "23503" } });
    });
  });

  it("only lets editors and above change prompts", async () => {
    await withRollback(async (tx) => {
      const { org, store } = await oneStore(tx);
      const viewer = await createTestUser(tx);
      const auditor = await createTestUser(tx);
      const editor = await createTestUser(tx);
      await addTestMember(tx, org.id, viewer.user.id, "viewer");
      await addTestMember(tx, org.id, auditor.user.id, "auditor");
      await addTestMember(tx, org.id, editor.user.id, "editor");

      for (const denied of [viewer, auditor]) {
        await expect(
          createPrompt(tx, denied.actor, store.id, basePrompt),
        ).rejects.toMatchObject({ code: "forbidden" });
        expect((await listPrompts(tx, denied.actor, store.id)).total).toBe(0);
      }
      await expect(
        createPrompt(tx, editor.actor, store.id, basePrompt),
      ).resolves.toBeDefined();
    });
  });
});

describe("versioning", () => {
  it("creates a new version on a wording change and never touches the old one", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      const { prompt } = await createPrompt(tx, actor, store.id, basePrompt);

      const result = await updatePrompt(tx, actor, store.id, prompt.id, {
        text: "Which running shoes would you recommend for a beginner?",
      });
      expect(result.versionCreated).toBe(true);
      expect(result.prompt).toMatchObject({
        currentVersion: 2,
        text: "Which running shoes would you recommend for a beginner?",
      });

      const versions = await listPromptVersions(tx, actor, store.id, prompt.id);
      expect(versions.map((v) => [v.version, v.text])).toEqual([
        [2, "Which running shoes would you recommend for a beginner?"],
        [1, basePrompt.text],
      ]);
      expect(versions[1].textHash).not.toBe(versions[0].textHash);
      expect(
        (await getPrompt(tx, actor, store.id, prompt.id)).prompt.text,
      ).toBe(versions[0].text);
    });
  });

  it("does not create a version for metadata-only changes or identical text", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      const { prompt } = await createPrompt(tx, actor, store.id, basePrompt);
      const group = await createPromptGroup(tx, actor, store.id, {
        name: "Core",
      });

      const meta = await updatePrompt(tx, actor, store.id, prompt.id, {
        topic: "Beginners",
        intent: "recommendation",
        groupId: group.id,
        isCore: true,
        trackingScope: "monitoring",
        text: basePrompt.text,
      });
      expect(meta.versionCreated).toBe(false);
      expect(meta.prompt).toMatchObject({
        currentVersion: 1,
        topic: "Beginners",
        intent: "recommendation",
        groupId: group.id,
        isCore: true,
        trackingScope: "monitoring",
      });
      expect(
        await listPromptVersions(tx, actor, store.id, prompt.id),
      ).toHaveLength(1);
    });
  });

  it("versions a language or country change too", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      const { prompt } = await createPrompt(tx, actor, store.id, basePrompt);
      const result = await updatePrompt(tx, actor, store.id, prompt.id, {
        country: "AE",
      });
      expect(result.versionCreated).toBe(true);
      const [latest] = await listPromptVersions(tx, actor, store.id, prompt.id);
      expect(latest).toMatchObject({
        version: 2,
        country: "AE",
        text: basePrompt.text,
      });
    });
  });

  it("refuses an edit that would duplicate another prompt", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      await createPrompt(tx, actor, store.id, basePrompt);
      const { prompt } = await createPrompt(tx, actor, store.id, {
        text: "A different question entirely",
        intent: "informational",
      });
      await expect(
        updatePrompt(tx, actor, store.id, prompt.id, { text: basePrompt.text }),
      ).rejects.toMatchObject({ code: "conflict" });
    });
  });

  it("is enforced by the database: version and brand history rows cannot be changed or deleted", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      const { prompt } = await createPrompt(tx, actor, store.id, basePrompt);

      const attempts = [
        () =>
          tx
            .update(promptVersions)
            .set({ text: "rewritten" })
            .where(eq(promptVersions.promptId, prompt.id)),
        () =>
          tx
            .delete(promptVersions)
            .where(eq(promptVersions.promptId, prompt.id)),
        () =>
          tx
            .update(brandProfiles)
            .set({ brandName: "Rewritten" })
            .where(eq(brandProfiles.storeId, store.id)),
        () =>
          tx.delete(brandProfiles).where(eq(brandProfiles.storeId, store.id)),
      ];
      for (const attempt of attempts) {
        await expect(
          tx.transaction(async () => attempt()),
        ).rejects.toMatchObject({
          cause: { code: "55000" },
        });
      }

      const [row] = await tx
        .select()
        .from(promptVersions)
        .where(
          and(
            eq(promptVersions.promptId, prompt.id),
            eq(promptVersions.version, 1),
          ),
        );
      expect(row.text).toBe(basePrompt.text);
    });
  });
});

describe("status lifecycle", () => {
  it("blocks edits to archived prompts and restores only as paused", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      const { prompt } = await createPrompt(tx, actor, store.id, basePrompt);
      await setPromptStatus(tx, actor, store.id, prompt.id, "active");
      await setPromptStatus(tx, actor, store.id, prompt.id, "archived");

      await expect(
        updatePrompt(tx, actor, store.id, prompt.id, { topic: "x" }),
      ).rejects.toMatchObject({ code: "conflict" });
      await expect(
        setPromptStatus(tx, actor, store.id, prompt.id, "active"),
      ).rejects.toMatchObject({ code: "conflict" });
      expect(
        (await setPromptStatus(tx, actor, store.id, prompt.id, "paused"))
          .status,
      ).toBe("paused");
    });
  });

  it("cannot restore a prompt whose wording has since been reused", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      const { prompt } = await createPrompt(tx, actor, store.id, basePrompt);
      await setPromptStatus(tx, actor, store.id, prompt.id, "archived");
      await createPrompt(tx, actor, store.id, basePrompt);
      await expect(
        setPromptStatus(tx, actor, store.id, prompt.id, "paused"),
      ).rejects.toMatchObject({ code: "conflict" });
    });
  });

  it("blocks all prompt writes in an archived store but keeps reads", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      const { prompt } = await createPrompt(tx, actor, store.id, basePrompt);
      await transitionStoreStatus(tx, actor, store.id, "archived");

      await expect(
        createPrompt(tx, actor, store.id, {
          text: "Late one",
          intent: "discovery",
        }),
      ).rejects.toMatchObject({ code: "conflict" });
      await expect(
        updatePrompt(tx, actor, store.id, prompt.id, { topic: "x" }),
      ).rejects.toMatchObject({ code: "conflict" });
      expect((await listPrompts(tx, actor, store.id)).total).toBe(1);
    });
  });
});

describe("listing", () => {
  it("filters by status, intent, group, scope, core flag and search, with paging", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      const group = await createPromptGroup(tx, actor, store.id, {
        name: "Local",
      });
      const make = (text: string, extra: Record<string, unknown> = {}) =>
        createPrompt(tx, actor, store.id, {
          text,
          intent: "discovery",
          ...extra,
        });

      await make("Best trail shoes for rocky paths", {
        status: "active",
        isCore: true,
      });
      await make("Where to buy shoes in Lahore", {
        intent: "local_market",
        groupId: group.id,
        status: "active",
      });
      await make("How to wash running shoes", {
        intent: "informational",
        trackingScope: "audit",
      });
      const archived = (await make("Old retired question")).prompt;
      await setPromptStatus(tx, actor, store.id, archived.id, "archived");

      expect((await listPrompts(tx, actor, store.id)).total).toBe(3);
      expect(
        (await listPrompts(tx, actor, store.id, { status: ["archived"] }))
          .total,
      ).toBe(1);
      expect(
        (await listPrompts(tx, actor, store.id, { status: ["active"] })).total,
      ).toBe(2);
      expect(
        (await listPrompts(tx, actor, store.id, { intent: "local_market" }))
          .total,
      ).toBe(1);
      expect(
        (await listPrompts(tx, actor, store.id, { groupId: group.id })).total,
      ).toBe(1);
      expect(
        (await listPrompts(tx, actor, store.id, { groupId: null })).total,
      ).toBe(2);
      expect(
        (await listPrompts(tx, actor, store.id, { trackingScope: "audit" }))
          .total,
      ).toBe(1);
      expect(
        (await listPrompts(tx, actor, store.id, { isCore: true })).total,
      ).toBe(1);
      expect(
        (await listPrompts(tx, actor, store.id, { search: "LAHORE" })).total,
      ).toBe(1);
      expect(
        (await listPrompts(tx, actor, store.id, { search: "100%" })).total,
      ).toBe(0);

      const page = await listPrompts(tx, actor, store.id, {
        limit: 2,
        offset: 0,
      });
      expect(page.items).toHaveLength(2);
      expect(page.total).toBe(3);
      expect(
        (await listPrompts(tx, actor, store.id, { limit: 2, offset: 2 })).items,
      ).toHaveLength(1);
    });
  });
});

describe("groups", () => {
  it("rejects duplicate names, counts prompts and ungroups prompts on delete", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      const group = await createPromptGroup(tx, actor, store.id, {
        name: "Discovery",
      });
      await expect(
        createPromptGroup(tx, actor, store.id, { name: "DISCOVERY" }),
      ).rejects.toMatchObject({ code: "conflict" });

      const { prompt } = await createPrompt(tx, actor, store.id, {
        ...basePrompt,
        groupId: group.id,
      });
      expect((await listPromptGroups(tx, actor, store.id))[0]).toMatchObject({
        promptCount: 1,
      });

      const renamed = await updatePromptGroup(tx, actor, store.id, group.id, {
        name: "Beginners",
      });
      expect(renamed.name).toBe("Beginners");

      expect(await deletePromptGroup(tx, actor, store.id, group.id)).toEqual({
        ungroupedPrompts: 1,
      });
      expect(
        (await getPrompt(tx, actor, store.id, prompt.id)).prompt.groupId,
      ).toBeNull();
      const remaining = await tx
        .select()
        .from(promptGroups)
        .where(eq(promptGroups.storeId, store.id));
      expect(remaining).toEqual([]);
    });
  });
});

describe("templates", () => {
  it("copies a template into a store as an independent prompt", async () => {
    await withRollback(async (tx) => {
      const { actor, org, store } = await oneStore(tx);
      const other = (await createStore(tx, actor, validStoreInput(org.id)))
        .store;
      const template = await createPromptTemplate(tx, actor, {
        organizationId: org.id,
        text: "What are the best brands for beginners?",
        intent: "discovery",
        language: "en",
      });

      const copy = await copyTemplateToStore(tx, actor, store.id, template.id);
      expect(copy).toMatchObject({
        creationSource: "template",
        sourceTemplateId: template.id,
        country: "PK",
        status: "draft",
        text: template.text,
      });
      await expect(
        copyTemplateToStore(tx, actor, store.id, template.id),
      ).rejects.toMatchObject({
        code: "conflict",
      });
      // The same template can be used in another store of the organization.
      await expect(
        copyTemplateToStore(tx, actor, other.id, template.id),
      ).resolves.toBeDefined();

      await archivePromptTemplate(tx, actor, template.id);
      expect(await listPromptTemplates(tx, actor, org.id)).toEqual([]);
      expect(
        await listPromptTemplates(tx, actor, org.id, { includeArchived: true }),
      ).toHaveLength(1);
      expect((await getPrompt(tx, actor, store.id, copy.id)).prompt.text).toBe(
        template.text,
      );
      await expect(
        copyTemplateToStore(tx, actor, other.id, template.id),
      ).rejects.toMatchObject(denied);
    });
  });

  it("keeps templates inside their organization", async () => {
    await withRollback(async (tx) => {
      const a = await oneStore(tx);
      const b = await oneStore(tx);
      const template = await createPromptTemplate(tx, b.actor, {
        organizationId: b.org.id,
        text: "Private template",
        intent: "discovery",
        language: "en",
      });

      await expect(
        copyTemplateToStore(tx, a.actor, a.store.id, template.id),
      ).rejects.toMatchObject(denied);
      await expect(
        archivePromptTemplate(tx, a.actor, template.id),
      ).rejects.toMatchObject(denied);
      await expect(
        listPromptTemplates(tx, a.actor, b.org.id),
      ).rejects.toMatchObject(denied);
      await expect(
        createPromptTemplate(tx, a.actor, {
          organizationId: b.org.id,
          text: "Planted",
          intent: "discovery",
          language: "en",
        }),
      ).rejects.toMatchObject(denied);
    });
  });
});

describe("csv import", () => {
  const csv = [
    "prompt_text,intent,topic,group,language,country,status,tracking_scope,is_core",
    "Best running shoes for beginners?,discovery,Beginners,Discovery,,,active,both,true",
    '"Where can I buy shoes in Lahore, Pakistan?",local_market,,Local,,,,,',
    "best RUNNING shoes for beginners,discovery,,,,,,,",
    "Missing intent question,,,,,,,,",
    "Bad intent question,shopping,,,,,,,",
    "RunPro versus Brand X?,comparison,,Discovery,,,,,",
  ].join("\n");

  it("previews without saving anything", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      const report = await importPrompts(tx, actor, store.id, {
        csv,
        dryRun: true,
      });

      expect(report).toMatchObject({
        dryRun: true,
        total: 6,
        created: 3,
        duplicates: 1,
        invalid: 2,
      });
      expect(report.groupsCreated.sort()).toEqual(["Discovery", "Local"]);
      expect((await listPrompts(tx, actor, store.id)).total).toBe(0);
      expect(await listPromptGroups(tx, actor, store.id)).toEqual([]);
    });
  });

  it("saves valid rows, reports the rest, and creates missing groups once", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      const report = await importPrompts(tx, actor, store.id, { csv });

      expect(report).toMatchObject({ created: 3, duplicates: 1, invalid: 2 });
      expect(report.rows.map((r) => [r.line, r.status])).toEqual([
        [2, "created"],
        [3, "created"],
        [4, "duplicate"],
        [5, "invalid"],
        [6, "invalid"],
        [7, "created"],
      ]);

      const { items, total } = await listPrompts(tx, actor, store.id);
      expect(total).toBe(3);
      expect(items.every((p) => p.creationSource === "imported")).toBe(true);
      const groups = await listPromptGroups(tx, actor, store.id);
      expect(groups.map((g) => [g.name, g.promptCount])).toEqual([
        ["Discovery", 2],
        ["Local", 1],
      ]);
      const core = items.find((p) => p.text.startsWith("Best running"));
      expect(core).toMatchObject({
        isCore: true,
        status: "active",
        topic: "Beginners",
      });
      expect(
        items.find((p) => p.text.startsWith("Where can I buy"))?.text,
      ).toBe("Where can I buy shoes in Lahore, Pakistan?");
    });
  });

  it("reports rows that already exist as duplicates on a second import", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      await importPrompts(tx, actor, store.id, { csv });
      const again = await importPrompts(tx, actor, store.id, { csv });
      expect(again).toMatchObject({ created: 0, duplicates: 4, invalid: 2 });
      expect((await listPrompts(tx, actor, store.id)).total).toBe(3);
    });
  });

  it("rejects malformed files outright", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      const reject = (value: string) =>
        expect(
          importPrompts(tx, actor, store.id, { csv: value }),
        ).rejects.toMatchObject({
          code: "validation",
        });

      await reject("");
      await reject("prompt_text,intent");
      await reject("prompt_text\nHello there");
      await reject('prompt_text,intent\n"unclosed,discovery');
      await reject(
        [
          "prompt_text,intent",
          ...Array.from({ length: 501 }, (_, i) => `Question ${i},discovery`),
        ].join("\n"),
      );
    });
  });
});

describe("library summary", () => {
  it("counts prompts and warns when every active prompt names the brand", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      const make = (text: string, status = "active") =>
        createPrompt(tx, actor, store.id, {
          text,
          intent: "discovery",
          status,
        });

      for (const n of ["one", "two", "three", "four", "five"]) {
        await make(`Is RunPro good for ${n} kind of runner`);
      }
      let summary = await getPromptLibrarySummary(tx, actor, store.id);
      expect(summary).toMatchObject({
        total: 5,
        byStatus: { active: 5 },
        byIntent: { discovery: 5 },
        brandSpecificActive: 5,
        neutralActive: 0,
      });
      expect(summary.warnings.join(" ")).toMatch(/names the brand/);

      await make("What are the best shoes for beginners");
      summary = await getPromptLibrarySummary(tx, actor, store.id);
      expect(summary).toMatchObject({
        brandSpecificActive: 5,
        neutralActive: 1,
      });
      expect(summary.warnings).toEqual([]);
    });
  });

  it("warns when nothing is active", async () => {
    await withRollback(async (tx) => {
      const { actor, store } = await oneStore(tx);
      await createPrompt(tx, actor, store.id, basePrompt);
      const summary = await getPromptLibrarySummary(tx, actor, store.id);
      expect(summary.warnings.join(" ")).toMatch(/No prompts are active/);
    });
  });
});
