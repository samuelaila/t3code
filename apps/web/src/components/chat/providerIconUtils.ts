import { ProviderDriverKind } from "@t3tools/contracts";
import {
  ClaudeAI,
  CursorIcon,
  Gemini,
  GrokIcon,
  HermesIcon,
  Icon,
  KimiIcon,
  OpenAI,
  OpenCodeIcon,
} from "../Icons";
import { PROVIDER_OPTIONS } from "../../session-logic";

export const PROVIDER_ICON_BY_PROVIDER: Partial<Record<ProviderDriverKind, Icon>> = {
  [ProviderDriverKind.make("codex")]: OpenAI,
  [ProviderDriverKind.make("claudeAgent")]: ClaudeAI,
  [ProviderDriverKind.make("opencode")]: OpenCodeIcon,
  [ProviderDriverKind.make("cursor")]: CursorIcon,
  [ProviderDriverKind.make("grok")]: GrokIcon,
  [ProviderDriverKind.make("hermes")]: HermesIcon,
};

/**
 * Brand marks keyed off the model family rather than the driver.
 *
 * A driver kind only says which CLI protocol we speak. Anything that fronts an
 * Anthropic-compatible endpoint (a local proxy, a gateway, a self-hosted relay)
 * reports `claudeAgent` no matter whose model is behind it, so leaning on the
 * driver alone paints Gemini, Grok and Kimi with the Claude mark. Matching the
 * model slug / instance label first keeps each vendor's own logo.
 *
 * Ordered: the first pattern that matches wins, and the Anthropic entry is last
 * so a "Gemini (via Claude API)" style label is not caught by its own wording.
 */
const BRAND_ICON_MATCHERS: ReadonlyArray<{
  pattern: RegExp;
  icon: Icon | null;
}> = [
  { pattern: /\b(?:gemini|google|antigravity|bard|palm)\b/iu, icon: Gemini },
  { pattern: /\b(?:grok|xai)\b/iu, icon: GrokIcon },
  { pattern: /\b(?:gpt|codex|openai|o[1-9])\b/iu, icon: OpenAI },
  { pattern: /\b(?:kimi|moonshot)\b/iu, icon: KimiIcon },
  { pattern: /\bhermes\b/iu, icon: HermesIcon },
  {
    pattern: /\b(?:claude|anthropic|opus|sonnet|haiku|fable)\b/iu,
    icon: ClaudeAI,
  },
  // Recognised vendors we ship no mark for. Resolving them to `null` on purpose
  // stops the driver fallback from stamping DeepSeek with the Anthropic mark —
  // callers render initials instead, which is at least honest.
  {
    pattern: /\b(?:deepseek|qwen|glm|zhipu|minimax|mistral|llama)\b/iu,
    icon: null,
  },
];

/**
 * Resolve the vendor named in the first hint that names one at all.
 *
 * Returns `undefined` when nothing looks like a vendor, so callers can tell
 * "no vendor here, use the driver default" apart from "known vendor, no mark".
 */
export function brandIconFromHints(
  hints: ReadonlyArray<string | null | undefined>,
): Icon | null | undefined {
  for (const hint of hints) {
    if (!hint) continue;
    // Slugs are hyphen/underscore separated, labels are spaced — normalise both
    // so `\b` boundaries behave the same for "claude-opus-5" and "Claude Opus".
    const normalized = hint.replace(/[_./-]+/gu, " ");
    for (const { pattern, icon } of BRAND_ICON_MATCHERS) {
      if (pattern.test(normalized)) {
        return icon;
      }
    }
  }
  return undefined;
}

/** Logo for a provider account row: its label wins, then the driver's default. */
export function providerInstanceBrandIcon(
  displayName: string | null | undefined,
  driverKind: ProviderDriverKind,
  extraHints: ReadonlyArray<string | null | undefined> = [],
): Icon | null {
  const branded = brandIconFromHints([displayName, ...extraHints]);
  if (branded !== undefined) {
    return branded;
  }
  return PROVIDER_ICON_BY_PROVIDER[driverKind] ?? null;
}

/** Logo for a model row: the model itself wins, then its account, then the driver. */
export function modelBrandIcon(
  model: Pick<ModelEsque, "slug" | "name" | "subProvider">,
  displayName: string | null | undefined,
  driverKind: ProviderDriverKind,
): Icon | null {
  const branded = brandIconFromHints([model.slug, model.name, model.subProvider, displayName]);
  if (branded !== undefined) {
    return branded;
  }
  return PROVIDER_ICON_BY_PROVIDER[driverKind] ?? null;
}

function isAvailableProviderOption(option: (typeof PROVIDER_OPTIONS)[number]): option is {
  value: ProviderDriverKind;
  label: string;
  available: true;
  pickerSidebarBadge?: "new" | "soon";
} {
  return option.available;
}

export const AVAILABLE_PROVIDER_OPTIONS = PROVIDER_OPTIONS.filter(isAvailableProviderOption);

export type ModelEsque = {
  slug: string;
  name: string;
  shortName?: string | undefined;
  subProvider?: string | undefined;
  badge?: "new" | undefined;
  isLegacy?: boolean | undefined;
  isUnavailable?: boolean | undefined;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripLeadingQualifier(value: string, qualifier: string | null | undefined): string {
  const trimmedQualifier = qualifier?.trim();
  if (!trimmedQualifier) {
    return value;
  }

  const pattern = new RegExp(`^${escapeRegExp(trimmedQualifier)}(?:\\s*[.:/-]\\s*|\\s+)`, "iu");
  return value.replace(pattern, "").trim() || value;
}

export function getDisplayModelName(
  model: ModelEsque,
  options?: { preferShortName?: boolean },
): string {
  const name = options?.preferShortName && model.shortName ? model.shortName : model.name;
  return stripLeadingQualifier(name, model.subProvider);
}

export function getTriggerDisplayModelName(model: ModelEsque): string {
  return getDisplayModelName(model, { preferShortName: true });
}

export function getTriggerDisplayModelLabel(model: ModelEsque): string {
  return getTriggerDisplayModelName(model);
}
