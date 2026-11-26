import { describe, expect, it } from "vitest";

import { createEmptyState } from "@/demo-state/state";

import { MAX_STATE_BYTES, byteLength, decideSave, parsePutBody } from "./payload";

const body = (o: unknown) => JSON.stringify(o);

describe("parsePutBody", () => {
  it("accepts a valid state with and without expectedRevision", () => {
    const state = createEmptyState();
    const a = parsePutBody(body({ state }));
    expect(a).toEqual({ ok: true, value: { state } });
    const b = parsePutBody(body({ state, expectedRevision: 3 }));
    expect(b).toEqual({ ok: true, value: { state, expectedRevision: 3 } });
  });

  it("normalises a partial v1 payload (missing collections are filled in)", () => {
    const r = parsePutBody(body({ state: { v: 1, seq: 4 } }));
    expect(r.ok && r.value.state.seq).toBe(4);
    expect(r.ok && r.value.state.websites).toEqual({ created: [], patched: {}, removed: [] });
  });

  it("rejects bad JSON, wrong version, wrong shape and unknown body keys", () => {
    expect(parsePutBody("{nope")).toEqual({ ok: false, code: "invalid_json" });
    expect(parsePutBody(body({ state: { v: 2, seq: 0 } }))).toEqual({ ok: false, code: "invalid_body" });
    expect(parsePutBody(body({ state: { v: 1, seq: -1 } }))).toEqual({ ok: false, code: "invalid_body" });
    expect(parsePutBody(body({ state: { v: 1, seq: 0, prompts: { created: [{ noId: true }] } } }))).toEqual({ ok: false, code: "invalid_body" });
    expect(parsePutBody(body({}))).toEqual({ ok: false, code: "invalid_body" });
    expect(parsePutBody(body({ state: createEmptyState(), workspaceId: "other" }))).toEqual({ ok: false, code: "invalid_body" });
  });

  it("rejects bad expectedRevision values", () => {
    const state = createEmptyState();
    for (const expectedRevision of [-1, 1.5, "2", null]) {
      expect(parsePutBody(body({ state, expectedRevision })).ok).toBe(false);
    }
  });

  it("enforces the size limit in bytes", () => {
    const state = createEmptyState();
    state.settings = { blob: "x".repeat(MAX_STATE_BYTES) };
    expect(parsePutBody(body({ state }))).toEqual({ ok: false, code: "too_large" });
    expect(byteLength("é")).toBe(2);
    expect(parsePutBody(body({ state: createEmptyState() }), 10)).toEqual({ ok: false, code: "too_large" });
  });
});

describe("decideSave (revision rule)", () => {
  it.each([
    // current, expected, result
    [null, undefined, { ok: true, revision: 1 }],
    [null, 0, { ok: true, revision: 1 }],
    [null, 2, { ok: false }],
    [4, undefined, { ok: true, revision: 5 }],
    [4, 4, { ok: true, revision: 5 }],
    [4, 3, { ok: false }],
    [4, 0, { ok: false }],
  ] as const)("current=%s expected=%s", (current, expected, result) => {
    expect(decideSave(current, expected)).toEqual(result);
  });
});
