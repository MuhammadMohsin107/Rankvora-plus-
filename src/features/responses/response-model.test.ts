import { describe, expect, it } from "vitest";

import { buildRunResponses } from "@/demo/shared-records";
import { buildEvidenceChain } from "@/features/evidence/chain";

import { API_SAMPLE_LABEL, confidenceLevel, groupCitations, latencySeconds, responseEvidenceIds, sampleLabel, siblingSamples, spanCounts } from "./response-model";

const responses = buildRunResponses("run-008");
const succeeded = responses.find((r) => r.status === "succeeded" && r.citations.length > 0)!;

describe("response model", () => {
  it("has generated responses to test against", () => {
    expect(responses.length).toBeGreaterThan(0);
    expect(succeeded).toBeDefined();
  });

  it("states what an API sample is", () => {
    expect(API_SAMPLE_LABEL).toBe("API answer sample, not a consumer-app result");
  });

  it("maps confidence to a level at 80% and 60%", () => {
    expect(confidenceLevel(0.95)).toBe("high");
    expect(confidenceLevel(0.8)).toBe("high");
    expect(confidenceLevel(0.79)).toBe("medium");
    expect(confidenceLevel(0.6)).toBe("medium");
    expect(confidenceLevel(0.2)).toBe("low");
  });

  it("groups citations owned, competitor, third party and keeps empty groups", () => {
    const groups = groupCitations(succeeded.citations);
    expect(groups.map((g) => g.source)).toEqual(["owned", "competitor", "third_party"]);
    expect(groups.reduce((sum, g) => sum + g.items.length, 0)).toBe(succeeded.citations.length);
    expect(groupCitations([]).every((g) => g.items.length === 0)).toBe(true);
  });

  it("counts only spans that lie inside the answer", () => {
    const counts = spanCounts({ answerText: "RunPro beats Brand X.", brandSpans: [{ start: 0, end: 6, kind: "brand" }, { start: 13, end: 20, kind: "competitor" }, { start: 30, end: 99, kind: "competitor" }, { start: 5, end: 5, kind: "brand" }] });
    expect(counts).toEqual({ brand: 1, competitor: 1 });
  });

  it("labels the sample and how many there are", () => {
    const run = siblingSamples(succeeded, responses);
    expect(run.every((r) => r.promptId === succeeded.promptId && r.channelId === succeeded.channelId && r.runId === succeeded.runId)).toBe(true);
    expect(run.map((r) => r.sample)).toEqual([...run.map((r) => r.sample)].sort((a, b) => a - b));
    expect(sampleLabel({ sample: 2 }, [{ sample: 1 }, { sample: 2 }, { sample: 3 }])).toBe("Sample 2 of 3");
    expect(sampleLabel({ sample: 1 })).toBe("Sample 1");
    expect(sampleLabel({ sample: 1 }, [{ sample: 1 }])).toBe("Sample 1");
  });

  it("measures latency and never invents one for an unfinished request", () => {
    expect(latencySeconds({ requestedAt: "2026-11-17T04:00:00Z", completedAt: "2026-11-17T04:00:12.400Z" })).toBe(12.4);
    expect(latencySeconds({ requestedAt: "2026-11-17T04:00:00Z", completedAt: null })).toBeNull();
  });

  it("builds evidence ids from a response and links it to its run", () => {
    const ids = responseEvidenceIds(succeeded, { findingId: "fnd-004" });
    expect(ids.responseId).toBe(succeeded.id);
    expect(ids.promptId).toBe(succeeded.promptId);
    expect(ids.findingId).toBe("fnd-004");
    const hrefs = buildEvidenceChain(ids).map((n) => n.href);
    expect(hrefs.some((h) => h.includes("/monitoring/runs/run-008"))).toBe(true);
  });

  it("does not claim a metric for a failed request", () => {
    const failed = responses.find((r) => r.status === "failed");
    if (!failed) return;
    expect(responseEvidenceIds(failed).metricId).toBeUndefined();
  });
});
