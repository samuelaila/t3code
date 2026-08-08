import { describe, expect, it } from "@effect/vitest";
import { TurnId } from "@t3tools/contracts";

import { hermesPromptSettlementBelongsToContext } from "./HermesAdapter.ts";

describe("hermesPromptSettlementBelongsToContext", () => {
  const turnId = TurnId.make("turn-1");

  it("returns true when the live ACP session and turn match", () => {
    expect(
      hermesPromptSettlementBelongsToContext({
        liveAcpSessionId: "acp-1",
        expectedAcpSessionId: "acp-1",
        liveActiveTurnId: turnId,
        liveSessionActiveTurnId: turnId,
        turnId,
      }),
    ).toBe(true);
  });

  it("returns false when the ACP session changed", () => {
    expect(
      hermesPromptSettlementBelongsToContext({
        liveAcpSessionId: "acp-2",
        expectedAcpSessionId: "acp-1",
        liveActiveTurnId: turnId,
        liveSessionActiveTurnId: turnId,
        turnId,
      }),
    ).toBe(false);
  });

  it("returns false when neither live turn matches the expected turn", () => {
    const otherTurnId = TurnId.make("turn-2");
    expect(
      hermesPromptSettlementBelongsToContext({
        liveAcpSessionId: "acp-1",
        expectedAcpSessionId: "acp-1",
        liveActiveTurnId: otherTurnId,
        liveSessionActiveTurnId: otherTurnId,
        turnId,
      }),
    ).toBe(false);
  });
});
