import type {
  OrchestrationThreadActivity,
  ThreadTokenUsageSnapshot,
} from "@t3tools/contracts";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

type NullableContextWindowUsage = {
  readonly [
    Key in keyof ThreadTokenUsageSnapshot
  ]: undefined extends ThreadTokenUsageSnapshot[Key]
    ? Exclude<ThreadTokenUsageSnapshot[Key], undefined> | null
    : ThreadTokenUsageSnapshot[Key];
};

export type ContextWindowSnapshot = NullableContextWindowUsage & {
  readonly remainingTokens: number | null;
  readonly usedPercentage: number | null;
  readonly remainingPercentage: number | null;
  readonly updatedAt: string;
};

/** Map a provider driver kind to a user-facing display name. */
export function formatProviderDisplayName(
  provider: string | null | undefined,
): string {
  if (!provider) return "This agent";
  switch (provider) {
    case "claudeAgent":
    case "claude":
      return "Claude";
    case "codex":
      return "Codex";
    case "cursor":
      return "Cursor";
    case "grok":
      return "Grok";
    case "hermes":
      return "Hermes";
    case "opencode":
      return "OpenCode";
    case "gemini":
      return "Gemini";
    case "kimi":
      return "Kimi";
    case "deepseek":
      return "DeepSeek";
    default: {
      // Title-case unknown driver kinds so they read reasonably.
      const trimmed = provider.replace(/Agent$/i, "").trim();
      if (trimmed.length === 0) return provider;
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
  }
}

/**
 * Resolve the standard maximum context window for a given model and/or provider.
 */
export function resolveModelContextWindow(
  model?: string | null | undefined,
  provider?: string | null | undefined,
): number {
  const combined = `${model ?? ""} ${provider ?? ""}`.toLowerCase();
  if (combined.includes("2m") || combined.includes("2000k")) {
    return 2_000_000;
  }
  if (
    combined.includes("1m") ||
    combined.includes("1000k") ||
    combined.includes("gemini")
  ) {
    return 1_000_000;
  }
  if (combined.includes("grok")) {
    return 500_000;
  }
  if (combined.includes("deepseek")) {
    return 128_000;
  }
  return 200_000;
}

/**
 * Resolve the auto-compaction threshold percentage for a model / provider if known.
 */
export function resolveAutoCompactPercentage(
  model?: string | null | undefined,
  provider?: string | null | undefined,
): number | null {
  const combined = `${model ?? ""} ${provider ?? ""}`.toLowerCase();
  if (combined.includes("grok")) {
    return 80;
  }
  if (combined.includes("claude")) {
    return 80;
  }
  return null;
}

/**
 * Derive an effective context window snapshot, falling back to model defaults when
 * no active turn usage has been recorded yet.
 */
export function deriveEffectiveContextWindowSnapshot(
  snapshot: ContextWindowSnapshot | null | undefined,
  options?: {
    model?: string | null | undefined;
    provider?: string | null | undefined;
  },
): ContextWindowSnapshot {
  const defaultMax = resolveModelContextWindow(
    options?.model,
    options?.provider,
  );
  const compactPct = resolveAutoCompactPercentage(
    options?.model,
    options?.provider,
  );

  if (snapshot) {
    const maxTokens = snapshot.maxTokens ?? defaultMax;
    const usedPercentage =
      maxTokens > 0
        ? Math.min(100, (snapshot.usedTokens / maxTokens) * 100)
        : 0;
    const remainingTokens = Math.max(
      0,
      Math.round(maxTokens - snapshot.usedTokens),
    );
    const remainingPercentage = Math.max(0, 100 - usedPercentage);

    return {
      ...snapshot,
      maxTokens,
      remainingTokens,
      usedPercentage,
      remainingPercentage,
      compactsAutomatically:
        snapshot.compactsAutomatically || compactPct !== null,
    };
  }

  return {
    usedTokens: 0,
    totalProcessedTokens: null,
    maxTokens: defaultMax,
    remainingTokens: defaultMax,
    usedPercentage: 0,
    remainingPercentage: 100,
    inputTokens: null,
    cachedInputTokens: null,
    outputTokens: null,
    reasoningOutputTokens: null,
    lastUsedTokens: null,
    lastInputTokens: null,
    lastCachedInputTokens: null,
    lastOutputTokens: null,
    lastReasoningOutputTokens: null,
    toolUses: null,
    durationMs: null,
    compactsAutomatically: compactPct !== null,
    updatedAt: "",
  };
}

export function deriveLatestContextWindowSnapshot(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
): ContextWindowSnapshot | null {
  for (let index = activities.length - 1; index >= 0; index -= 1) {
    const activity = activities[index];
    if (!activity || activity.kind !== "context-window.updated") {
      continue;
    }

    const payload = asRecord(activity.payload);
    const usedTokens = asFiniteNumber(payload?.usedTokens);
    if (usedTokens === null || usedTokens < 0) {
      continue;
    }

    const maxTokens = asFiniteNumber(payload?.maxTokens);
    const usedPercentage =
      maxTokens !== null && maxTokens > 0
        ? Math.min(100, (usedTokens / maxTokens) * 100)
        : null;
    const remainingTokens =
      maxTokens !== null
        ? Math.max(0, Math.round(maxTokens - usedTokens))
        : null;
    const remainingPercentage =
      usedPercentage !== null ? Math.max(0, 100 - usedPercentage) : null;

    return {
      usedTokens,
      totalProcessedTokens: asFiniteNumber(payload?.totalProcessedTokens),
      maxTokens,
      remainingTokens,
      usedPercentage,
      remainingPercentage,
      inputTokens: asFiniteNumber(payload?.inputTokens),
      cachedInputTokens: asFiniteNumber(payload?.cachedInputTokens),
      outputTokens: asFiniteNumber(payload?.outputTokens),
      reasoningOutputTokens: asFiniteNumber(payload?.reasoningOutputTokens),
      lastUsedTokens: asFiniteNumber(payload?.lastUsedTokens),
      lastInputTokens: asFiniteNumber(payload?.lastInputTokens),
      lastCachedInputTokens: asFiniteNumber(payload?.lastCachedInputTokens),
      lastOutputTokens: asFiniteNumber(payload?.lastOutputTokens),
      lastReasoningOutputTokens: asFiniteNumber(
        payload?.lastReasoningOutputTokens,
      ),
      toolUses: asFiniteNumber(payload?.toolUses),
      durationMs: asFiniteNumber(payload?.durationMs),
      compactsAutomatically: asBoolean(payload?.compactsAutomatically) ?? false,
      updatedAt: activity.createdAt,
    };
  }

  return null;
}

export function formatContextWindowTokens(
  value: number | null | undefined,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "0";
  }
  if (value < 1_000) {
    return `${Math.round(value)}`;
  }
  if (value < 10_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  if (value < 1_000_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
}
