import { describe, expect, it } from "vite-plus/test";
import { ProviderDriverKind } from "@t3tools/contracts";

import { ClaudeAI, Gemini, GrokIcon, HermesIcon, KimiIcon, OpenAI } from "../Icons";
import { modelBrandIcon, providerInstanceBrandIcon } from "./providerIconUtils";
import { providerInstanceInitials } from "./ProviderInstanceIcon";

const CLAUDE_AGENT = ProviderDriverKind.make("claudeAgent");
const CODEX = ProviderDriverKind.make("codex");

const model = (slug: string, name = slug) => ({ slug, name, subProvider: undefined });

describe("providerInstanceBrandIcon", () => {
  it("uses the vendor named in the account label, not the driver", () => {
    // Proxy-backed accounts all report claudeAgent; the label is what tells them apart.
    expect(providerInstanceBrandIcon("Gemini (CLIProxy)", CLAUDE_AGENT)).toBe(Gemini);
    expect(providerInstanceBrandIcon("Grok (CLIProxy)", CLAUDE_AGENT)).toBe(GrokIcon);
    expect(providerInstanceBrandIcon("Claude (CLIProxy)", CLAUDE_AGENT)).toBe(ClaudeAI);
    expect(providerInstanceBrandIcon("Kimi (CLIProxy)", CLAUDE_AGENT)).toBe(KimiIcon);
    expect(providerInstanceBrandIcon("Hermes", ProviderDriverKind.make("hermes"))).toBe(HermesIcon);
  });

  it("falls back to the driver icon when the label names no vendor", () => {
    expect(providerInstanceBrandIcon("CLIProxy (all models)", CLAUDE_AGENT)).toBe(ClaudeAI);
    expect(providerInstanceBrandIcon("Work account", CODEX)).toBe(OpenAI);
    expect(providerInstanceBrandIcon(undefined, CODEX)).toBe(OpenAI);
  });

  it("does not mistake a Claude-compatible note for an Anthropic account", () => {
    expect(providerInstanceBrandIcon("Gemini via Claude API", CLAUDE_AGENT)).toBe(Gemini);
  });
});

describe("modelBrandIcon", () => {
  it("matches the model family ahead of the account", () => {
    expect(modelBrandIcon(model("gemini-3.7-flash-high"), "CLIProxy", CLAUDE_AGENT)).toBe(Gemini);
    expect(modelBrandIcon(model("grok-4.6"), "CLIProxy", CLAUDE_AGENT)).toBe(GrokIcon);
    expect(modelBrandIcon(model("claude-opus-5"), "CLIProxy", CLAUDE_AGENT)).toBe(ClaudeAI);
    expect(modelBrandIcon(model("gpt-5.6-sol"), "CLIProxy", CLAUDE_AGENT)).toBe(OpenAI);
  });

  it("reads Anthropic family names that omit the vendor", () => {
    expect(modelBrandIcon(model("claude-fable-5", "Fable"), "CLIProxy", CLAUDE_AGENT)).toBe(
      ClaudeAI,
    );
    expect(modelBrandIcon(model("opus-4-8", "Opus 4.8"), "CLIProxy", CLAUDE_AGENT)).toBe(ClaudeAI);
  });

  it("keeps a Claude model on the Claude mark even inside a Gemini account", () => {
    expect(modelBrandIcon(model("claude-opus-5"), "Gemini (CLIProxy)", CLAUDE_AGENT)).toBe(
      ClaudeAI,
    );
  });

  it("borrows the account vendor when the model slug is anonymous", () => {
    expect(modelBrandIcon(model("default"), "Grok (CLIProxy)", CLAUDE_AGENT)).toBe(GrokIcon);
  });

  it("shows no mark for a known vendor we ship no logo for", () => {
    // Better a blank/initials slot than stamping DeepSeek with Anthropic's mark.
    expect(modelBrandIcon(model("deepseek-flash"), "CLIProxy", CLAUDE_AGENT)).toBeNull();
  });

  it("uses the Kimi mark for Moonshot models", () => {
    expect(modelBrandIcon(model("kimi-k3"), "Kimi (CLIProxy)", CLAUDE_AGENT)).toBe(KimiIcon);
  });
});

describe("providerInstanceInitials", () => {
  it("uses the first word, ignoring a parenthetical qualifier", () => {
    expect(providerInstanceInitials("Claude (CLIProxy)")).toBe("CL");
    expect(providerInstanceInitials("Gemini (CLIProxy)")).toBe("GE");
    expect(providerInstanceInitials("Kimi (CLIProxy)")).toBe("KI");
  });
});
