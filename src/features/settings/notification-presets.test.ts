import { describe, expect, it } from "vitest";

import { DEMO_ORG_NOTIFICATIONS, NOTIFICATION_EVENTS } from "@/demo/settings";

import { activeEventCount, detectPreset, presetMatrix } from "./notification-presets";

describe("notification presets", () => {
  it("builds each preset for every event", () => {
    const everything = presetMatrix("everything", NOTIFICATION_EVENTS);
    expect(Object.keys(everything)).toHaveLength(NOTIFICATION_EVENTS.length);
    expect(activeEventCount(everything)).toBe(NOTIFICATION_EVENTS.length);
    expect(activeEventCount(presetMatrix("digest", NOTIFICATION_EVENTS))).toBe(0);
    const important = presetMatrix("important", NOTIFICATION_EVENTS);
    expect(important.provider_error_spike).toEqual(["in_app", "email"]);
    expect(important.new_mention).toEqual([]);
  });

  it("detects a preset regardless of channel order and falls back to custom", () => {
    expect(detectPreset(presetMatrix("important", NOTIFICATION_EVENTS), NOTIFICATION_EVENTS)).toBe("important");
    const flipped = { ...presetMatrix("everything", NOTIFICATION_EVENTS), new_mention: ["email", "in_app"] as ("email" | "in_app")[] };
    expect(detectPreset(flipped, NOTIFICATION_EVENTS)).toBe("everything");
    expect(detectPreset(DEMO_ORG_NOTIFICATIONS.matrix, NOTIFICATION_EVENTS)).toBe("custom");
  });
});
