import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { homedir } from "node:os";

import {
  buildHermesAcpSpawnInput,
  extractHermesProviderFromConfig,
  resolveHermesAuthMethodId,
  resolveHermesHomeForProfile,
} from "./HermesAcpSupport.ts";

describe("resolveHermesHomeForProfile", () => {
  it("returns undefined for empty, missing, and default profiles", () => {
    expect(resolveHermesHomeForProfile(undefined)).toBeUndefined();
    expect(resolveHermesHomeForProfile("")).toBeUndefined();
    expect(resolveHermesHomeForProfile("   ")).toBeUndefined();
    expect(resolveHermesHomeForProfile("default")).toBeUndefined();
  });

  it("resolves named profiles under ~/.hermes/profiles", () => {
    expect(resolveHermesHomeForProfile("work")).toBe(`${homedir()}/.hermes/profiles/work`);
    expect(resolveHermesHomeForProfile(" personal ")).toBe(
      `${homedir()}/.hermes/profiles/personal`,
    );
  });
});

describe("buildHermesAcpSpawnInput", () => {
  it("spawns `hermes acp` for the default profile without leaking HERMES_HOME", () => {
    const spawn = buildHermesAcpSpawnInput(
      { binaryPath: "/usr/local/bin/hermes", profile: "", authMethodId: "" },
      "/tmp/project",
      { HERMES_HOME: "/should/be/deleted", PATH: "/usr/bin" },
    );

    expect(spawn.command).toBe("/usr/local/bin/hermes");
    expect(spawn.args).toEqual(["acp"]);
    expect(spawn.cwd).toBe("/tmp/project");
    expect(spawn.env?.HERMES_HOME).toBeUndefined();
  });

  it("sets HERMES_HOME for named Hermes profiles", () => {
    const spawn = buildHermesAcpSpawnInput(
      { binaryPath: "hermes", profile: "work", authMethodId: "" },
      "/tmp/project",
      { PATH: "/usr/bin" },
    );

    expect(spawn.command).toBe("hermes");
    expect(spawn.args).toEqual(["acp"]);
    expect(spawn.env?.HERMES_HOME).toBe(`${homedir()}/.hermes/profiles/work`);
  });

  it("does not set HERMES_HOME for the literal default profile", () => {
    const spawn = buildHermesAcpSpawnInput(
      { binaryPath: "hermes", profile: "default", authMethodId: "" },
      "/tmp/project",
      {},
    );

    expect(spawn.env?.HERMES_HOME).toBeUndefined();
  });
});

describe("extractHermesProviderFromConfig", () => {
  it("reads provider from a model: section", () => {
    const config = [
      "model:",
      "  provider: openrouter",
      "  model: hermes-3.1",
      "",
      "tts:",
      "  provider: edge",
    ].join("\n");
    expect(extractHermesProviderFromConfig(config)).toBe("openrouter");
  });

  it("ignores provider keys outside the model section", () => {
    expect(extractHermesProviderFromConfig("provider: xai\ntheme: dark\n")).toBeUndefined();
  });

  it("returns undefined when no provider is configured", () => {
    expect(extractHermesProviderFromConfig("model:\n  model: hermes-3.1\n")).toBeUndefined();
  });
});

describe("resolveHermesAuthMethodId", () => {
  it.effect("prefers an explicit authMethodId override", () =>
    Effect.gen(function* () {
      const authMethodId = yield* resolveHermesAuthMethodId(
        { binaryPath: "hermes", profile: "", authMethodId: "openrouter" },
        {},
      );
      expect(authMethodId).toBe("openrouter");
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("does not use the terminal setup method for headless auth", () =>
    Effect.gen(function* () {
      const authMethodId = yield* resolveHermesAuthMethodId(
        { binaryPath: "hermes", profile: "", authMethodId: "hermes-setup" },
        {},
      );
      expect(authMethodId).toBeNull();
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
