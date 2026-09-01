import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { ContextWindowMeter } from "./ContextWindowMeter";

describe("ContextWindowMeter", () => {
  it("renders a horizontal meter bar with 0% state when no usage recorded yet", () => {
    const markup = renderToStaticMarkup(
      <ContextWindowMeter
        model="grok-4.5"
        providerKind="grok"
        providerDisplayName="Grok"
      />,
    );

    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain("0%");
    expect(markup).toContain("Context window 0% used (0 of 500k)");
    expect(markup).toContain('aria-valuenow="0"');
  });

  it("renders active token usage with correct percentage and progressbar value", () => {
    const markup = renderToStaticMarkup(
      <ContextWindowMeter
        usage={{
          usedTokens: 100_000,
          totalProcessedTokens: 250_000,
          maxTokens: 500_000,
          remainingTokens: 400_000,
          usedPercentage: 20,
          remainingPercentage: 80,
          inputTokens: 80_000,
          cachedInputTokens: 50_000,
          outputTokens: 20_000,
          reasoningOutputTokens: 5_000,
          lastUsedTokens: 100_000,
          lastInputTokens: 80_000,
          lastCachedInputTokens: 50_000,
          lastOutputTokens: 20_000,
          lastReasoningOutputTokens: 5_000,
          toolUses: 3,
          durationMs: 1200,
          compactsAutomatically: true,
          updatedAt: "2026-08-15T00:00:00.000Z",
        }}
        model="grok-4.5"
        providerKind="grok"
        providerDisplayName="Grok"
      />,
    );

    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="20"');
    expect(markup).toContain("20%");
    expect(markup).toContain("Context window 20% used (100k of 500k)");
    expect(markup).toContain('style="width:20%"');
  });

  it("handles high / overloaded usage with distinct visual states", () => {
    const markup = renderToStaticMarkup(
      <ContextWindowMeter
        usage={{
          usedTokens: 480_000,
          totalProcessedTokens: null,
          maxTokens: 500_000,
          remainingTokens: 20_000,
          usedPercentage: 96,
          remainingPercentage: 4,
          inputTokens: 400_000,
          cachedInputTokens: null,
          outputTokens: 80_000,
          reasoningOutputTokens: null,
          lastUsedTokens: null,
          lastInputTokens: null,
          lastCachedInputTokens: null,
          lastOutputTokens: null,
          lastReasoningOutputTokens: null,
          toolUses: null,
          durationMs: null,
          compactsAutomatically: true,
          updatedAt: "2026-08-15T00:00:00.000Z",
        }}
        model="grok-4.5"
        providerKind="grok"
      />,
    );

    expect(markup).toContain("96%");
    expect(markup).toContain("Context window 96% used (480k of 500k)");
    expect(markup).toContain("bg-rose-500");
    expect(markup).toContain('aria-valuenow="96"');
  });
});
