import { describe, expect, it } from "@effect/vitest";

import { providerModelsFromSettings } from "../providerSnapshot.ts";
import { claudeCustomModelCapabilities } from "./ClaudeProvider.ts";

const effortOptionIds = (slug: string) => {
  const [model] = providerModelsFromSettings([], [slug], claudeCustomModelCapabilities);
  const effort = model?.capabilities?.optionDescriptors?.find(
    (descriptor) => descriptor.id === "effort",
  );
  return {
    label: effort?.label,
    type: effort?.type,
    ids: effort?.type === "select" ? effort.options.map((o) => o.id) : [],
  };
};

describe("custom models on the Claude driver", () => {
  it("offer the reasoning scale, so proxied Kimi/Gemini models are tunable", () => {
    const kimi = effortOptionIds("kimi-k3");

    expect(kimi.label).toBe("Reasoning");
    expect(kimi.type).toBe("select");
    expect(kimi.ids).toEqual(["low", "medium", "high", "xhigh", "max"]);
  });

  it("drop Max for Grok, which never gets past Extra High", () => {
    expect(effortOptionIds("grok-4.6").ids).toEqual(["low", "medium", "high", "xhigh"]);
  });
});
