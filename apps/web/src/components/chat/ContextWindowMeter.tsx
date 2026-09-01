import { memo } from "react";
import { cn } from "~/lib/utils";
import {
  type ContextWindowSnapshot,
  deriveEffectiveContextWindowSnapshot,
  formatContextWindowTokens,
  formatProviderDisplayName,
  resolveAutoCompactPercentage,
} from "~/lib/contextWindow";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { brandIconFromHints, PROVIDER_ICON_BY_PROVIDER } from "./providerIconUtils";
import { type ProviderDriverKind } from "@t3tools/contracts";
import { CpuIcon, Minimize2Icon, SparklesIcon, ZapIcon } from "lucide-react";
import { Button } from "../ui/button";

function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "0%";
  }
  if (value > 0 && value < 1) {
    return `${value.toFixed(1)}%`;
  }
  if (value < 10) {
    return `${value.toFixed(1).replace(/\.0$/, "")}%`;
  }
  return `${Math.round(value)}%`;
}

export interface ContextWindowMeterProps {
  usage?: ContextWindowSnapshot | null | undefined;
  providerDisplayName?: string | null | undefined;
  providerKind?: string | null | undefined;
  model?: string | null | undefined;
  compact?: boolean | undefined;
  className?: string | undefined;
  modelDisplayName?: string | null | undefined;
  onCompact?: (() => void) | undefined;
  compactDisabled?: boolean | undefined;
  compactDisabledReason?: string | null | undefined;
}

export const ContextWindowMeter = memo(function ContextWindowMeter(props: ContextWindowMeterProps) {
  const {
    usage,
    providerDisplayName,
    providerKind,
    model,
    compact = false,
    className,
    modelDisplayName,
    onCompact,
    compactDisabled,
    compactDisabledReason,
  } = props;

  const effective = deriveEffectiveContextWindowSnapshot(usage ?? null, {
    model: model ?? undefined,
    provider: providerKind ?? undefined,
  });

  const resolvedDisplayName =
    providerDisplayName ||
    formatProviderDisplayName(providerKind) ||
    modelDisplayName ||
    "Provider";

  const BrandIcon =
    brandIconFromHints([model, resolvedDisplayName, providerKind]) ??
    (providerKind ? PROVIDER_ICON_BY_PROVIDER[providerKind as ProviderDriverKind] : null);

  const autoCompactPercentage = resolveAutoCompactPercentage(
    model ?? undefined,
    providerKind ?? undefined,
  );
  const normalizedPercentage = Math.max(0, Math.min(100, effective.usedPercentage ?? 0));
  const isOverloaded = normalizedPercentage > 90;
  const isWarning = normalizedPercentage > 75;

  const barFillColor = isOverloaded
    ? "bg-rose-500"
    : isWarning
      ? "bg-amber-500"
      : "bg-primary/80 dark:bg-primary/90";

  const percentLabel = formatPercentage(effective.usedPercentage);

  const hasDetailedTokens =
    (effective.inputTokens ?? 0) > 0 ||
    (effective.cachedInputTokens ?? 0) > 0 ||
    (effective.outputTokens ?? 0) > 0 ||
    (effective.reasoningOutputTokens ?? 0) > 0;

  const cacheHitRate =
    (effective.inputTokens ?? 0) + (effective.cachedInputTokens ?? 0) > 0 &&
    (effective.cachedInputTokens ?? 0) > 0
      ? Math.round(
          ((effective.cachedInputTokens ?? 0) /
            ((effective.inputTokens ?? 0) + (effective.cachedInputTokens ?? 0))) *
            100,
        )
      : null;

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={120}
        closeDelay={onCompact ? 150 : 0}
        render={
          <button
            type="button"
            className={cn(
              "group inline-flex h-7 shrink-0 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-xs transition-colors",
              "hover:bg-accent/60 data-[pressed]:bg-accent/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              className,
            )}
            aria-label={`Context window ${percentLabel} used (${formatContextWindowTokens(effective.usedTokens)} of ${formatContextWindowTokens(effective.maxTokens ?? null)})`}
          >
            {/* Horizontal Mini Bar */}
            <div
              className={cn(
                "relative h-1.5 overflow-hidden rounded-full bg-muted-foreground/20 dark:bg-muted-foreground/25",
                compact ? "w-10" : "w-14 sm:w-16",
              )}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(normalizedPercentage)}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none",
                  barFillColor,
                )}
                style={{
                  width: `${Math.max(normalizedPercentage > 0 ? 3 : 0, normalizedPercentage)}%`,
                }}
              />
            </div>

            {/* Percentage text */}
            <span
              className={cn(
                "text-[11px] font-medium tabular-nums transition-colors",
                isOverloaded
                  ? "font-semibold text-rose-500 dark:text-rose-400"
                  : isWarning
                    ? "font-semibold text-amber-600 dark:text-amber-400"
                    : "text-secondary-label group-hover:text-foreground",
              )}
            >
              {percentLabel}
            </span>
          </button>
        }
      />

      <PopoverPopup
        tooltipStyle
        side="top"
        align="center"
        viewportClassName="p-0"
        className="w-72 max-w-none text-left whitespace-normal shadow-lg sm:w-80"
      >
        <div className="flex flex-col text-xs">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              {BrandIcon ? (
                <BrandIcon className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <CpuIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">{resolvedDisplayName}</div>
                {model ? (
                  <div className="truncate text-[10px] text-muted-foreground">{model}</div>
                ) : null}
              </div>
            </div>

            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                isOverloaded
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : isWarning
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : effective.usedTokens > 0
                      ? "bg-primary/10 text-primary dark:text-primary-foreground"
                      : "bg-muted text-muted-foreground",
              )}
            >
              {isOverloaded
                ? "Overloaded"
                : isWarning
                  ? "High"
                  : effective.usedTokens > 0
                    ? `${percentLabel} used`
                    : "Ready"}
            </span>
          </div>

          {/* Context Window Progress Section */}
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-muted-foreground text-xs">Context Window</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatContextWindowTokens(effective.usedTokens)}
                <span className="text-muted-foreground">
                  {" / "}
                  {formatContextWindowTokens(effective.maxTokens ?? null)}
                </span>
              </span>
            </div>

            {/* Main Progress Bar */}
            <div
              className="relative h-2 w-full overflow-hidden rounded-full bg-muted/80 dark:bg-muted/50"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(normalizedPercentage)}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none",
                  barFillColor,
                )}
                style={{
                  width: `${Math.max(normalizedPercentage > 0 ? 2 : 0, normalizedPercentage)}%`,
                }}
              />
              {/* Optional Auto-compact threshold marker */}
              {autoCompactPercentage ? (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground/25 dark:bg-foreground/35"
                  style={{ left: `${autoCompactPercentage}%` }}
                  title={`Auto-compact threshold (~${autoCompactPercentage}%)`}
                />
              ) : null}
            </div>

            {/* Remaining tokens */}
            <div className="flex items-center justify-between text-[11px] text-secondary-label">
              <span>
                {formatContextWindowTokens(effective.remainingTokens ?? null)} tokens remaining
              </span>
              <span className="tabular-nums font-medium text-muted-foreground">
                {formatPercentage(effective.remainingPercentage)} free
              </span>
            </div>
          </div>

          {/* Detailed Token Breakdown (if present) */}
          {hasDetailedTokens ? (
            <div className="border-t border-border/40 bg-muted/20 px-3 py-2">
              <div className="mb-1.5 font-medium text-[10px] uppercase tracking-wider text-muted-foreground">
                Token Breakdown
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                {effective.inputTokens != null && effective.inputTokens > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Prompt</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatContextWindowTokens(effective.inputTokens)}
                    </span>
                  </div>
                ) : null}

                {effective.cachedInputTokens != null && effective.cachedInputTokens > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <ZapIcon className="size-3 text-amber-500" />
                      Cached
                    </span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatContextWindowTokens(effective.cachedInputTokens)}
                      {cacheHitRate !== null ? (
                        <span className="ms-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                          ({cacheHitRate}%)
                        </span>
                      ) : null}
                    </span>
                  </div>
                ) : null}

                {effective.outputTokens != null && effective.outputTokens > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Completion</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatContextWindowTokens(effective.outputTokens)}
                    </span>
                  </div>
                ) : null}

                {effective.reasoningOutputTokens != null && effective.reasoningOutputTokens > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <SparklesIcon className="size-3 text-purple-500" />
                      Reasoning
                    </span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatContextWindowTokens(effective.reasoningOutputTokens)}
                    </span>
                  </div>
                ) : null}

                {effective.totalProcessedTokens != null && effective.totalProcessedTokens > 0 ? (
                  <div className="col-span-2 mt-1 flex items-center justify-between border-t border-border/30 pt-1">
                    <span className="text-muted-foreground">Total processed</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatContextWindowTokens(effective.totalProcessedTokens)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Footer note for auto-compact or session status */}
          {effective.compactsAutomatically ? (
            <div className="border-t border-border/40 bg-muted/30 px-3 py-2 text-[11px] text-secondary-label">
              {resolvedDisplayName} automatically compacts context when approaching capacity
              {autoCompactPercentage ? ` (~${autoCompactPercentage}%)` : ""}.
            </div>
          ) : null}

          {onCompact ? (
            <div className="flex flex-col gap-1 border-t border-border/40 px-3 py-2">
              <Button
                size="xs"
                variant="outline"
                className="w-full justify-center"
                disabled={compactDisabled}
                onClick={onCompact}
              >
                <Minimize2Icon aria-hidden="true" />
                Compact context
              </Button>
              {compactDisabled && compactDisabledReason ? (
                <div className="text-pretty text-secondary-label text-[11px]">
                  {compactDisabledReason}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
});
