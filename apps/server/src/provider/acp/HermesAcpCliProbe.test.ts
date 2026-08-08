/**
 * Optional integration check against a real `hermes acp` install.
 * Enable with: T3_HERMES_ACP_PROBE=1 bun run test HermesAcpCliProbe
 *
 * The probe assumes Hermes has provider credentials configured for the
 * active profile (e.g. `hermes model` or `hermes acp --setup` has been
 * run outside T3).
 */
import * as NodeServices from "@effect/platform-node/NodeServices";
import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vite-plus/test";

import { makeHermesAcpRuntime } from "./HermesAcpSupport.ts";

const makeProbeRuntime = Effect.gen(function* () {
  const childProcessSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return yield* makeHermesAcpRuntime({
    hermesSettings: { binaryPath: "hermes", profile: "", authMethodId: "" },
    environment: process.env,
    childProcessSpawner,
    cwd: process.cwd(),
    clientInfo: { name: "t3-hermes-probe", version: "0.0.0" },
  });
});

describe.runIf(process.env.T3_HERMES_ACP_PROBE === "1")("Hermes ACP CLI probe", () => {
  it.effect("initialize and authenticate against real hermes acp", () =>
    Effect.gen(function* () {
      const runtime = yield* makeProbeRuntime;
      const started = yield* runtime.start();
      expect(started.initializeResult).toBeDefined();
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );

  it.effect("session/new advertises typed SessionModelState", () =>
    Effect.gen(function* () {
      const runtime = yield* makeProbeRuntime;
      const started = yield* runtime.start();
      const result = started.sessionSetupResult;

      expect(typeof started.sessionId).toBe("string");
      expect(result.models).toBeDefined();
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  );
});
