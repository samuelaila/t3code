import { type HermesSettings, ProviderDriverKind } from "@t3tools/contracts";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Scope from "effect/Scope";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import * as EffectAcpErrors from "effect-acp/errors";
import type * as EffectAcpSchema from "effect-acp/schema";
import { normalizeModelSlug } from "@t3tools/shared/model";
import { homedir } from "node:os";

import * as AcpSessionRuntime from "./AcpSessionRuntime.ts";

const HERMES_AUTH_METHOD_TERMINAL_SETUP = "hermes-setup";
const HERMES_DRIVER_KIND = ProviderDriverKind.make("hermes");
const HERMES_BUILT_IN_MODEL_SLUG = "hermes";

type HermesAcpRuntimeHermesSettings = Pick<
  HermesSettings,
  "binaryPath" | "profile" | "authMethodId"
>;

interface HermesAcpRuntimeInput extends Omit<
  AcpSessionRuntime.AcpSessionRuntimeOptions,
  "authMethodId" | "clientCapabilities" | "spawn"
> {
  readonly childProcessSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly hermesSettings: HermesAcpRuntimeHermesSettings | null | undefined;
  readonly environment?: NodeJS.ProcessEnv;
}

/**
 * Resolve the Hermes home directory for a profile.
 *
 * An empty, missing, or `"default"` profile means Hermes owns its default
 * home (`~/.hermes`). Any other value activates `~/.hermes/profiles/<name>`.
 */
export function resolveHermesHomeForProfile(profile: string | undefined): string | undefined {
  const name = profile?.trim();
  if (!name || name === "default") {
    return undefined;
  }
  return `${homedir()}/.hermes/profiles/${name}`;
}

export function resolveHermesHome(profile: string | undefined): string {
  return resolveHermesHomeForProfile(profile) ?? `${homedir()}/.hermes`;
}

/**
 * Minimal YAML-ish scanner for Hermes `config.yaml`. Hermes stores the
 * active runtime provider under the top-level `model:` section:
 *
 *   model:
 *     provider: openrouter
 *     model: ...
 *
 * Only the first `provider:` under that section is used — later `provider:`
 * keys elsewhere in the file (tool defaults, TTS, etc.) must be ignored.
 */
export function extractHermesProviderFromConfig(configText: string): string | undefined {
  let inModelSection = false;

  for (const rawLine of configText.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) {
      continue;
    }

    // Top-level key (no indent) ends the model section once we have entered it.
    if (/^[^\s#]/.test(rawLine)) {
      if (inModelSection) {
        break;
      }
      if (/^model:\s*$/.test(rawLine.trim()) || /^model:\s*/.test(rawLine.trim())) {
        // `model: value` is not a mapping section; only bare `model:` starts one.
        if (/^model:\s*$/.test(rawLine.trim())) {
          inModelSection = true;
        }
      }
      continue;
    }

    if (!inModelSection) {
      continue;
    }

    const line = rawLine.trim();
    const match = /^provider:\s*(?:"([^"]*)"|'([^']*)'|([^\s#]+))/.exec(line);
    if (match) {
      const provider = (match[1] ?? match[2] ?? match[3] ?? "").trim();
      return provider || undefined;
    }
  }

  return undefined;
}

/**
 * Resolve the Hermes ACP auth method id without spawning Hermes.
 *
 * Preference order:
 * 1. explicit `authMethodId` setting (non-setup)
 * 2. `model.provider` from the profile's `config.yaml`
 *
 * Returns `null` when only interactive `hermes-setup` is available so callers
 * can surface a clear "run hermes model" status instead of hanging on a TTY.
 */
export const resolveHermesAuthMethodId = Effect.fn("resolveHermesAuthMethodId")(function* (
  hermesSettings: HermesAcpRuntimeHermesSettings | null | undefined,
  _environment: NodeJS.ProcessEnv = process.env,
) {
  const override = hermesSettings?.authMethodId?.trim();
  if (override) {
    return override.toLowerCase() === HERMES_AUTH_METHOD_TERMINAL_SETUP ? null : override;
  }

  const home = resolveHermesHome(hermesSettings?.profile);
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const configFile = yield* fileSystem
    .readFileString(path.join(home, "config.yaml"))
    .pipe(Effect.option);

  if (Option.isNone(configFile)) {
    return null;
  }

  const provider = extractHermesProviderFromConfig(configFile.value);
  return provider ? provider.toLowerCase() : null;
});

export function buildHermesAcpSpawnInput(
  hermesSettings: HermesAcpRuntimeHermesSettings | null | undefined,
  cwd: string,
  environment?: NodeJS.ProcessEnv,
): AcpSessionRuntime.AcpSpawnInput {
  const profileHome = resolveHermesHomeForProfile(hermesSettings?.profile);
  const env: NodeJS.ProcessEnv = { ...environment };

  if (profileHome) {
    env.HERMES_HOME = profileHome;
  } else {
    // Default profile must use Hermes' own default home even if a parent
    // process leaked HERMES_HOME into T3's environment.
    delete env.HERMES_HOME;
  }

  return {
    command: hermesSettings?.binaryPath || "hermes",
    args: ["acp"],
    cwd,
    env,
  };
}

export const makeHermesAcpRuntime = (
  input: HermesAcpRuntimeInput,
): Effect.Effect<
  AcpSessionRuntime.AcpSessionRuntime["Service"],
  EffectAcpErrors.AcpError,
  Crypto.Crypto | Scope.Scope | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const authMethodId = yield* resolveHermesAuthMethodId(input.hermesSettings, input.environment);
    if (!authMethodId) {
      return yield* EffectAcpErrors.AcpRequestError.invalidParams(
        "Hermes provider is not configured. Run `hermes model` or `hermes acp --setup` before using Hermes in T3 Code.",
      );
    }

    const acpContext = yield* Layer.build(
      AcpSessionRuntime.layer({
        ...input,
        spawn: buildHermesAcpSpawnInput(input.hermesSettings, input.cwd, input.environment),
        authMethodId,
      }).pipe(
        Layer.provide(
          Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, input.childProcessSpawner),
        ),
      ),
    );

    const runtime = yield* Effect.service(AcpSessionRuntime.AcpSessionRuntime).pipe(
      Effect.provide(acpContext),
    );
    return runtime;
  });

export function resolveHermesAcpBaseModelId(model: string | null | undefined): string {
  const trimmed = model?.trim();
  const base = trimmed && trimmed.length > 0 ? trimmed : HERMES_BUILT_IN_MODEL_SLUG;
  return normalizeModelSlug(base, HERMES_DRIVER_KIND) ?? HERMES_BUILT_IN_MODEL_SLUG;
}

export function currentHermesModelIdFromSessionSetup(
  sessionSetupResult:
    | EffectAcpSchema.LoadSessionResponse
    | EffectAcpSchema.NewSessionResponse
    | EffectAcpSchema.ResumeSessionResponse,
): string | undefined {
  return sessionSetupResult.models?.currentModelId?.trim() || undefined;
}

export function applyHermesAcpModelSelection<E>(input: {
  readonly runtime: Pick<AcpSessionRuntime.AcpSessionRuntime["Service"], "setSessionModel">;
  readonly currentModelId: string | undefined;
  readonly requestedModelId: string | undefined;
  readonly mapError: (cause: EffectAcpErrors.AcpError) => E;
}): Effect.Effect<string | undefined, E> {
  const shouldSwitchModel =
    input.requestedModelId !== undefined && input.requestedModelId !== input.currentModelId;
  if (!shouldSwitchModel) {
    return Effect.succeed(input.currentModelId);
  }
  return input.runtime
    .setSessionModel(input.requestedModelId)
    .pipe(Effect.mapError(input.mapError), Effect.as(input.requestedModelId));
}
