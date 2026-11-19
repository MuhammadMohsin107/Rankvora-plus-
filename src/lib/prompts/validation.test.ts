import { describe, expect, it } from "vitest";

import { parseInput } from "@/lib/tenancy/validation";

import {
  createPromptInput,
  importRowInput,
  listPromptsInput,
  updatePromptInput,
} from "./validation";

describe("createPromptInput", () => {
  it("applies safe defaults and keeps the wording as typed", () => {
    const parsed = parseInput(createPromptInput, {
      text: "  What are the best running shoes for beginners?  ",
      intent: "discovery",
    });
    expect(parsed).toMatchObject({
      text: "What are the best running shoes for beginners?",
      status: "draft",
      trackingScope: "both",
      creationSource: "manual",
      isCore: false,
    });
  });

  it.each([
    ["an empty prompt", { text: "   " }],
    ["a punctuation-only prompt", { text: "?!..." }],
    ["an over-long prompt", { text: "a ".repeat(600) }],
    ["an unknown intent", { intent: "shopping" }],
    ["a bad status", { status: "live" }],
    ["a bad country", { country: "PAK" }],
    ["a non-uuid group", { groupId: "group-1" }],
  ])("rejects %s", (_label, override) => {
    expect(() =>
      parseInput(createPromptInput, {
        text: "Best shoes?",
        intent: "discovery",
        ...override,
      }),
    ).toThrow();
  });

  it("normalizes country and removes duplicate product ids", () => {
    const id = "5b3e1c2a-1d2e-4f3a-8b9c-0d1e2f3a4b5c";
    const parsed = parseInput(createPromptInput, {
      text: "Best shoes?",
      intent: "discovery",
      country: "pk",
      productIds: [id, id],
    });
    expect(parsed.country).toBe("PK");
    expect(parsed.productIds).toEqual([id]);
  });
});

describe("updatePromptInput", () => {
  it("is a partial patch", () => {
    expect(parseInput(updatePromptInput, { isCore: true })).toEqual({
      isCore: true,
    });
  });

  it("still validates fields that are present", () => {
    expect(() => parseInput(updatePromptInput, { text: "?!" })).toThrow();
  });
});

describe("listPromptsInput", () => {
  it("defaults to the first 50 rows", () => {
    expect(parseInput(listPromptsInput, {})).toMatchObject({
      limit: 50,
      offset: 0,
    });
  });

  it("rejects an oversized page", () => {
    expect(() => parseInput(listPromptsInput, { limit: 1000 })).toThrow();
  });
});

describe("importRowInput", () => {
  const ok = importRowInput.safeParse({
    prompt_text: "Best running shoes for beginners?",
    intent: " Discovery ",
    topic: "",
    group: "",
    language: "",
    country: "",
    status: "",
    tracking_scope: "",
    is_core: "",
  });

  it("accepts a minimal row and fills defaults", () => {
    expect(ok.success).toBe(true);
    expect(ok.data).toMatchObject({
      intent: "discovery",
      status: "draft",
      tracking_scope: "both",
    });
    expect(ok.data?.group).toBeUndefined();
    expect(ok.data?.language).toBeUndefined();
  });

  it("reads optional columns when present", () => {
    const parsed = importRowInput.parse({
      prompt_text: "Where can I buy running shoes in Lahore?",
      intent: "local_market",
      topic: "Local",
      group: "Local",
      language: "en",
      country: "pk",
      status: "Active",
      tracking_scope: "monitoring",
      is_core: "yes",
    });
    expect(parsed).toMatchObject({
      topic: "Local",
      group: "Local",
      country: "PK",
      status: "active",
      tracking_scope: "monitoring",
      is_core: true,
    });
  });

  it("requires an intent instead of guessing one", () => {
    expect(
      importRowInput.safeParse({ prompt_text: "Best shoes?", intent: "" })
        .success,
    ).toBe(false);
  });

  it.each([
    ["an unknown intent", { intent: "buying" }],
    ["a bad status", { status: "live" }],
    ["a bad boolean", { is_core: "maybe" }],
    ["an empty prompt", { prompt_text: " " }],
  ])("rejects %s", (_label, override) => {
    expect(
      importRowInput.safeParse({
        prompt_text: "Best shoes?",
        intent: "discovery",
        ...override,
      }).success,
    ).toBe(false);
  });
});
