import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { pool, type DbOrTx } from "@/db";
import { activityLogs, brandProfiles, competitors } from "@/db/schema";
import {
  addTestMember,
  createTestUser,
  validStoreInput,
  withRollback,
} from "@/test/db";

import {
  getCurrentBrandProfile,
  listBrandProfileVersions,
  saveBrandProfile,
} from "./brand";
import {
  createCompetitor,
  listCompetitors,
  setCompetitorStatus,
  updateCompetitor,
} from "./competitors";
import { createOrganization, listOrganizations } from "./organizations";
import {
  createProductService,
  deleteProductService,
  listProductsServices,
  updateProductService,
} from "./products";
import {
  addStoreDomain,
  createStore,
  getStore,
  listStoreDomains,
  listStores,
  removeStoreDomain,
  transitionStoreStatus,
  updateStore,
} from "./stores";

afterAll(async () => {
  await pool.end();
});

/** Two unrelated customers, each with an organization and one store. */
async function twoTenants(tx: DbOrTx) {
  const a = await createTestUser(tx);
  const b = await createTestUser(tx);
  const orgA = await createOrganization(tx, a.actor, { name: "Org A" });
  const orgB = await createOrganization(tx, b.actor, { name: "Org B" });
  const storeA = (await createStore(tx, a.actor, validStoreInput(orgA.id)))
    .store;
  const storeB = (await createStore(tx, b.actor, validStoreInput(orgB.id)))
    .store;
  return { a, b, orgA, orgB, storeA, storeB };
}

const denied = { code: "not_found" };

describe("cross-tenant isolation", () => {
  it("hides another customer's store from reads, lists and edits", async () => {
    await withRollback(async (tx) => {
      const { a, storeA, storeB } = await twoTenants(tx);

      await expect(getStore(tx, a.actor, storeB.id)).rejects.toMatchObject(
        denied,
      );
      await expect(
        updateStore(tx, a.actor, storeB.id, { name: "Hijacked" }),
      ).rejects.toMatchObject(denied);
      await expect(
        transitionStoreStatus(tx, a.actor, storeB.id, "archived"),
      ).rejects.toMatchObject(denied);

      const visible = await listStores(tx, a.actor);
      expect(visible.map((row) => row.store.id)).toEqual([storeA.id]);
    });
  });

  it("hides another customer's brand profile, competitors, products and domains", async () => {
    await withRollback(async (tx) => {
      const { a, b, storeB } = await twoTenants(tx);
      await createCompetitor(tx, b.actor, storeB.id, { name: "Rival" });

      await expect(
        getCurrentBrandProfile(tx, a.actor, storeB.id),
      ).rejects.toMatchObject(denied);
      await expect(
        listBrandProfileVersions(tx, a.actor, storeB.id),
      ).rejects.toMatchObject(denied);
      await expect(
        saveBrandProfile(tx, a.actor, storeB.id, { brandName: "Mine now" }),
      ).rejects.toMatchObject(denied);
      await expect(
        listCompetitors(tx, a.actor, storeB.id),
      ).rejects.toMatchObject(denied);
      await expect(
        createCompetitor(tx, a.actor, storeB.id, { name: "Planted" }),
      ).rejects.toMatchObject(denied);
      await expect(
        listProductsServices(tx, a.actor, storeB.id),
      ).rejects.toMatchObject(denied);
      await expect(
        createProductService(tx, a.actor, storeB.id, { title: "Planted" }),
      ).rejects.toMatchObject(denied);
      await expect(
        listStoreDomains(tx, a.actor, storeB.id),
      ).rejects.toMatchObject(denied);
      await expect(
        addStoreDomain(tx, a.actor, storeB.id, {
          host: "evil.example.com",
          kind: "alias",
        }),
      ).rejects.toMatchObject(denied);
    });
  });

  it("will not create a store inside another customer's organization", async () => {
    await withRollback(async (tx) => {
      const { a, orgB } = await twoTenants(tx);
      await expect(
        createStore(tx, a.actor, validStoreInput(orgB.id)),
      ).rejects.toMatchObject(denied);
    });
  });

  it("treats a competitor ID from another store as missing, even inside your own organization", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const org = await createOrganization(tx, a.actor, { name: "Org" });
      const one = (await createStore(tx, a.actor, validStoreInput(org.id)))
        .store;
      const two = (await createStore(tx, a.actor, validStoreInput(org.id)))
        .store;
      const rival = await createCompetitor(tx, a.actor, one.id, {
        name: "Rival",
      });

      await expect(
        updateCompetitor(tx, a.actor, two.id, rival.id, { name: "Moved" }),
      ).rejects.toMatchObject(denied);
      await expect(
        setCompetitorStatus(tx, a.actor, two.id, rival.id, "archived"),
      ).rejects.toMatchObject(denied);
      expect(await listCompetitors(tx, a.actor, two.id)).toEqual([]);
    });
  });

  it("answers malformed and unknown IDs exactly like another tenant's IDs", async () => {
    await withRollback(async (tx) => {
      const { a } = await twoTenants(tx);
      await expect(getStore(tx, a.actor, "not-a-uuid")).rejects.toMatchObject(
        denied,
      );
      await expect(
        getStore(tx, a.actor, "00000000-0000-4000-8000-000000000000"),
      ).rejects.toMatchObject(denied);
    });
  });

  it("shows each customer only their own organizations", async () => {
    await withRollback(async (tx) => {
      const { a, b, orgA, orgB } = await twoTenants(tx);
      expect(
        (await listOrganizations(tx, a.actor)).map((r) => r.organization.id),
      ).toEqual([orgA.id]);
      expect(
        (await listOrganizations(tx, b.actor)).map((r) => r.organization.id),
      ).toEqual([orgB.id]);
    });
  });

  it("is enforced by the database: a row cannot pair a store with the wrong organization", async () => {
    await withRollback(async (tx) => {
      const { orgA, storeB } = await twoTenants(tx);
      // A nested transaction becomes a savepoint, so the failure does not
      // poison the outer transaction.
      await expect(
        tx.transaction(async (inner) => {
          await inner.insert(competitors).values({
            organizationId: orgA.id,
            storeId: storeB.id,
            name: "Mismatched",
            source: "manual",
            status: "confirmed",
          });
        }),
      ).rejects.toMatchObject({ cause: { code: "23503" } });
    });
  });
});

describe("roles", () => {
  it("lets a viewer read but not change anything", async () => {
    await withRollback(async (tx) => {
      const { orgA, storeA } = await twoTenants(tx);
      const viewer = await createTestUser(tx);
      await addTestMember(tx, orgA.id, viewer.user.id, "viewer");

      expect((await getStore(tx, viewer.actor, storeA.id)).role).toBe("viewer");
      await expect(
        updateStore(tx, viewer.actor, storeA.id, { name: "Nope" }),
      ).rejects.toMatchObject({ code: "forbidden" });
      await expect(
        saveBrandProfile(tx, viewer.actor, storeA.id, { brandName: "Nope" }),
      ).rejects.toMatchObject({ code: "forbidden" });
      await expect(
        createCompetitor(tx, viewer.actor, storeA.id, { name: "Nope" }),
      ).rejects.toMatchObject({ code: "forbidden" });
      await expect(
        createStore(tx, viewer.actor, validStoreInput(orgA.id)),
      ).rejects.toMatchObject({ code: "forbidden" });
    });
  });

  it("lets an editor change a store but not create, archive or approve", async () => {
    await withRollback(async (tx) => {
      const { orgA, storeA } = await twoTenants(tx);
      const editor = await createTestUser(tx);
      await addTestMember(tx, orgA.id, editor.user.id, "editor");

      const updated = await updateStore(tx, editor.actor, storeA.id, {
        name: "Edited",
      });
      expect(updated.name).toBe("Edited");
      await expect(
        createStore(tx, editor.actor, validStoreInput(orgA.id)),
      ).rejects.toMatchObject({ code: "forbidden" });
      await expect(
        transitionStoreStatus(tx, editor.actor, storeA.id, "archived"),
      ).rejects.toMatchObject({ code: "forbidden" });
    });
  });

  it("makes the creator of an organization its owner", async () => {
    await withRollback(async (tx) => {
      const { a, orgA } = await twoTenants(tx);
      const rows = await listOrganizations(tx, a.actor);
      expect(rows).toHaveLength(1);
      expect(rows[0].role).toBe("owner");
      expect(rows[0].organization.ownerUserId).toBe(a.actor.userId);
      expect(orgA.status).toBe("active");
    });
  });
});

describe("stores", () => {
  it("creates a store with brand profile version 1 and defaults the time zone from the organization", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const org = await createOrganization(tx, a.actor, {
        name: "Org",
        timezoneDefault: "Asia/Karachi",
      });
      const { store, brandProfile } = await createStore(
        tx,
        a.actor,
        validStoreInput(org.id, {
          brandName: "RunPro",
          brandAliases: ["Run Pro"],
        }),
      );
      expect(store.status).toBe("draft");
      expect(store.timezone).toBe("Asia/Karachi");
      expect(brandProfile).toMatchObject({
        version: 1,
        brandName: "RunPro",
        aliases: ["Run Pro"],
      });
    });
  });

  it("rejects a second active store on the same domain in one organization, but allows it across organizations", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const b = await createTestUser(tx);
      const orgA = await createOrganization(tx, a.actor, { name: "A" });
      const orgB = await createOrganization(tx, b.actor, { name: "B" });
      const input = validStoreInput(orgA.id, {
        canonicalDomain: "https://Shared.Example.com",
      });

      await createStore(tx, a.actor, input);
      await expect(createStore(tx, a.actor, input)).rejects.toMatchObject({
        code: "conflict",
      });
      await expect(
        createStore(tx, b.actor, { ...input, organizationId: orgB.id }),
      ).resolves.toBeDefined();
    });
  });

  it("frees the domain when a store is archived and blocks restoring onto a taken domain", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const org = await createOrganization(tx, a.actor, { name: "A" });
      const input = validStoreInput(org.id, {
        canonicalDomain: "reuse.example.com",
      });

      const first = (await createStore(tx, a.actor, input)).store;
      await transitionStoreStatus(tx, a.actor, first.id, "archived");
      const second = (await createStore(tx, a.actor, input)).store;
      expect(second.id).not.toBe(first.id);

      await expect(
        transitionStoreStatus(tx, a.actor, first.id, "paused"),
      ).rejects.toMatchObject({ code: "conflict" });
    });
  });

  it("requires confirmation to change the canonical domain and keeps the old one as history", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const org = await createOrganization(tx, a.actor, { name: "A" });
      const store = (
        await createStore(
          tx,
          a.actor,
          validStoreInput(org.id, { canonicalDomain: "old.example.com" }),
        )
      ).store;

      await expect(
        updateStore(tx, a.actor, store.id, {
          canonicalDomain: "new.example.com",
        }),
      ).rejects.toMatchObject({ code: "conflict" });

      const updated = await updateStore(tx, a.actor, store.id, {
        canonicalDomain: "new.example.com",
        confirmDomainChange: true,
      });
      expect(updated.canonicalDomain).toBe("new.example.com");

      const domains = await listStoreDomains(tx, a.actor, store.id);
      expect(domains).toMatchObject([
        { host: "old.example.com", kind: "previous_canonical" },
      ]);
    });
  });

  it("manages alias domains but never deletes domain history", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const org = await createOrganization(tx, a.actor, { name: "A" });
      const store = (
        await createStore(
          tx,
          a.actor,
          validStoreInput(org.id, { canonicalDomain: "main.example.com" }),
        )
      ).store;

      const alias = await addStoreDomain(tx, a.actor, store.id, {
        host: "https://WWW.Main.example.com/",
        kind: "alias",
      });
      expect(alias.host).toBe("www.main.example.com");

      await expect(
        addStoreDomain(tx, a.actor, store.id, {
          host: "main.example.com",
          kind: "alias",
        }),
      ).rejects.toMatchObject({ code: "conflict" });
      await expect(
        addStoreDomain(tx, a.actor, store.id, {
          host: "www.main.example.com",
          kind: "redirect",
        }),
      ).rejects.toMatchObject({ code: "conflict" });

      await removeStoreDomain(tx, a.actor, store.id, alias.id);
      expect(await listStoreDomains(tx, a.actor, store.id)).toEqual([]);

      await updateStore(tx, a.actor, store.id, {
        canonicalDomain: "moved.example.com",
        confirmDomainChange: true,
      });
      const [history] = await listStoreDomains(tx, a.actor, store.id);
      await expect(
        removeStoreDomain(tx, a.actor, store.id, history.id),
      ).rejects.toMatchObject({ code: "conflict" });
    });
  });

  it("enforces the status lifecycle and blocks edits to archived stores", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const org = await createOrganization(tx, a.actor, { name: "A" });
      const store = (await createStore(tx, a.actor, validStoreInput(org.id)))
        .store;

      await expect(
        transitionStoreStatus(tx, a.actor, store.id, "active"),
      ).rejects.toMatchObject({ code: "conflict" });
      await transitionStoreStatus(tx, a.actor, store.id, "ready");
      expect(
        (await transitionStoreStatus(tx, a.actor, store.id, "active")).status,
      ).toBe("active");
      await transitionStoreStatus(tx, a.actor, store.id, "archived");

      await expect(
        updateStore(tx, a.actor, store.id, { name: "Changed" }),
      ).rejects.toMatchObject({ code: "conflict" });
      await expect(
        createCompetitor(tx, a.actor, store.id, { name: "Late" }),
      ).rejects.toMatchObject({ code: "conflict" });

      // History stays readable.
      expect((await getStore(tx, a.actor, store.id)).store.status).toBe(
        "archived",
      );
      expect(await listStores(tx, a.actor)).toEqual([]);
      expect(
        await listStores(tx, a.actor, { includeArchived: true }),
      ).toHaveLength(1);
    });
  });

  it("rejects invalid input before touching the database", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const org = await createOrganization(tx, a.actor, { name: "A" });
      await expect(
        createStore(
          tx,
          a.actor,
          validStoreInput(org.id, { canonicalDomain: "localhost" }),
        ),
      ).rejects.toMatchObject({ code: "validation" });
      await expect(
        createStore(tx, a.actor, validStoreInput(org.id, { market: "XYZ" })),
      ).rejects.toMatchObject({ code: "validation" });
    });
  });
});

describe("brand profile versions", () => {
  it("creates a new version on change, never edits an old one, and ignores identical saves", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const org = await createOrganization(tx, a.actor, { name: "A" });
      const store = (
        await createStore(
          tx,
          a.actor,
          validStoreInput(org.id, { brandName: "OldName" }),
        )
      ).store;

      const renamed = await saveBrandProfile(tx, a.actor, store.id, {
        brandName: "NewName",
        aliases: ["Old Name"],
      });
      expect(renamed).toMatchObject({
        created: true,
        profile: { version: 2, brandName: "NewName" },
      });

      const again = await saveBrandProfile(tx, a.actor, store.id, {
        brandName: "NewName",
        aliases: ["old name"],
      });
      expect(again.created).toBe(false);
      expect(again.profile.version).toBe(2);

      const versions = await listBrandProfileVersions(tx, a.actor, store.id);
      expect(versions.map((v) => [v.version, v.brandName])).toEqual([
        [2, "NewName"],
        [1, "OldName"],
      ]);
      expect(
        (await getCurrentBrandProfile(tx, a.actor, store.id))?.version,
      ).toBe(2);
    });
  });

  it("refuses duplicate version numbers at the database level", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const org = await createOrganization(tx, a.actor, { name: "A" });
      const store = (await createStore(tx, a.actor, validStoreInput(org.id)))
        .store;
      await expect(
        tx.transaction(async (inner) => {
          await inner.insert(brandProfiles).values({
            organizationId: org.id,
            storeId: store.id,
            version: 1,
            brandName: "Dup",
          });
        }),
      ).rejects.toMatchObject({ cause: { code: "23505" } });
    });
  });
});

describe("competitors", () => {
  it("confirms hand-entered competitors, keeps suggestions unconfirmed, and normalizes domains", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const org = await createOrganization(tx, a.actor, { name: "A" });
      const store = (await createStore(tx, a.actor, validStoreInput(org.id)))
        .store;

      const manual = await createCompetitor(tx, a.actor, store.id, {
        name: "Manual Rival",
        domains: ["https://Rival.com/shoes"],
      });
      expect(manual).toMatchObject({
        status: "confirmed",
        domains: ["rival.com"],
      });

      const suggested = await createCompetitor(tx, a.actor, store.id, {
        name: "Suggested Rival",
        source: "ai_suggested",
      });
      expect(suggested.status).toBe("suggested");

      const confirmed = await setCompetitorStatus(
        tx,
        a.actor,
        store.id,
        suggested.id,
        "confirmed",
      );
      expect(confirmed.status).toBe("confirmed");
      expect(
        await listCompetitors(tx, a.actor, store.id, { status: "confirmed" }),
      ).toHaveLength(2);
    });
  });

  it("rejects case-insensitive duplicate names, but frees the name after archiving", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const org = await createOrganization(tx, a.actor, { name: "A" });
      const store = (await createStore(tx, a.actor, validStoreInput(org.id)))
        .store;

      const first = await createCompetitor(tx, a.actor, store.id, {
        name: "Rival",
      });
      await expect(
        createCompetitor(tx, a.actor, store.id, { name: "RIVAL" }),
      ).rejects.toMatchObject({ code: "conflict" });

      await setCompetitorStatus(tx, a.actor, store.id, first.id, "archived");
      await expect(
        createCompetitor(tx, a.actor, store.id, { name: "rival" }),
      ).resolves.toBeDefined();
      await expect(
        setCompetitorStatus(tx, a.actor, store.id, first.id, "confirmed"),
      ).rejects.toMatchObject({ code: "conflict" });
    });
  });

  it("allows the same competitor name in different stores", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const org = await createOrganization(tx, a.actor, { name: "A" });
      const one = (await createStore(tx, a.actor, validStoreInput(org.id)))
        .store;
      const two = (await createStore(tx, a.actor, validStoreInput(org.id)))
        .store;
      await createCompetitor(tx, a.actor, one.id, { name: "Rival" });
      await expect(
        createCompetitor(tx, a.actor, two.id, { name: "Rival" }),
      ).resolves.toBeDefined();
    });
  });
});

describe("products and services", () => {
  it("creates, updates and deletes catalogue records and rejects duplicate external IDs", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const org = await createOrganization(tx, a.actor, { name: "A" });
      const store = (await createStore(tx, a.actor, validStoreInput(org.id)))
        .store;

      const product = await createProductService(tx, a.actor, store.id, {
        title: "Trail shoe",
        externalId: "sku-1",
        url: "https://shop.example.com/products/trail",
        facts: { weightGrams: 280 },
      });
      expect(product.facts).toEqual({ weightGrams: 280 });

      await expect(
        createProductService(tx, a.actor, store.id, {
          title: "Dup",
          externalId: "sku-1",
        }),
      ).rejects.toMatchObject({ code: "conflict" });
      await expect(
        createProductService(tx, a.actor, store.id, {
          title: "Bad URL",
          url: "javascript:alert(1)",
        }),
      ).rejects.toMatchObject({ code: "validation" });

      const updated = await updateProductService(
        tx,
        a.actor,
        store.id,
        product.id,
        {
          category: "Footwear",
        },
      );
      expect(updated.category).toBe("Footwear");
      expect(await listProductsServices(tx, a.actor, store.id)).toHaveLength(1);

      await deleteProductService(tx, a.actor, store.id, product.id);
      expect(await listProductsServices(tx, a.actor, store.id)).toEqual([]);
    });
  });

  it("allows the same external ID in different stores", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const org = await createOrganization(tx, a.actor, { name: "A" });
      const one = (await createStore(tx, a.actor, validStoreInput(org.id)))
        .store;
      const two = (await createStore(tx, a.actor, validStoreInput(org.id)))
        .store;
      await createProductService(tx, a.actor, one.id, {
        title: "P",
        externalId: "x",
      });
      await expect(
        createProductService(tx, a.actor, two.id, {
          title: "P",
          externalId: "x",
        }),
      ).resolves.toBeDefined();
    });
  });
});

describe("activity log", () => {
  it("records who changed what, scoped to the store", async () => {
    await withRollback(async (tx) => {
      const a = await createTestUser(tx);
      const org = await createOrganization(tx, a.actor, { name: "A" });
      const store = (await createStore(tx, a.actor, validStoreInput(org.id)))
        .store;
      await updateStore(tx, a.actor, store.id, { name: "Renamed" });
      await createCompetitor(tx, a.actor, store.id, { name: "Rival" });

      const rows = await tx
        .select()
        .from(activityLogs)
        .where(
          and(
            eq(activityLogs.storeId, store.id),
            eq(activityLogs.actorUserId, a.actor.userId),
          ),
        );
      expect(rows.map((r) => r.action).sort()).toEqual([
        "competitor.created",
        "store.created",
        "store.updated",
      ]);
      const updatedEntry = rows.find((r) => r.action === "store.updated");
      expect(updatedEntry?.details).toMatchObject({
        changes: { name: { to: "Renamed" } },
      });
    });
  });

  it("rejects an activity entry that pairs a store with the wrong organization", async () => {
    await withRollback(async (tx) => {
      const { orgA, storeB } = await twoTenants(tx);
      await expect(
        tx.transaction(async (inner) => {
          await inner.insert(activityLogs).values({
            organizationId: orgA.id,
            storeId: storeB.id,
            action: "x",
            resourceType: "x",
          });
        }),
      ).rejects.toMatchObject({ cause: { code: "23503" } });
    });
  });
});
