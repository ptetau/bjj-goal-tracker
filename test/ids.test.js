// The id contract that makes multi-device sync possible (milestone 2):
// every action envelope carries a shell-stamped id, unique per device
// ("<deviceId>-<counter>"). Entities created by an action derive their ids
// from it — the primary entity takes action.id, parsed items take
// "<action.id>.1", ".2", … — so two devices working offline can never mint
// colliding ids, and an action's id doubles as its sync idempotency key.

import { describe, expect, it } from "vitest";
import { apply, fold, initState, openSession } from "../src/engine/actions.js";

const act = (id, type, payload, at = "2026-08-29T12:00:00") => ({ id, type, payload, at });

describe("action envelope ids", () => {
  it("requires a non-empty string id on every action", () => {
    const s = initState();
    expect(() => apply(s, { type: "startSession", payload: {}, at: "2026-08-29T12:00:00" })).toThrow(/action id/);
    expect(() => apply(s, act("", "startSession", {}))).toThrow(/action id/);
    expect(() => apply(s, act(42, "startSession", {}))).toThrow(/action id/);
  });

  it("derives entity ids from the action id", () => {
    let s = apply(initState(), act("phone-1", "createList", { name: "A", type: "tokui", lines: "Back => choke\nBottom => top" }));
    expect(s.lists[0].id).toBe("phone-1");
    expect(s.lists[0].items.map((it) => it.id)).toEqual(["phone-1.1", "phone-1.2"]);

    s = apply(s, act("phone-2", "addLines", { listId: "phone-1", lines: "Leg => heel" }));
    expect(s.lists[0].items[2].id).toBe("phone-2.1");

    s = apply(s, act("phone-3", "startSession", {}));
    expect(openSession(s).id).toBe("phone-3");

    s = apply(s, act("phone-4", "tap", { sessionId: "phone-3", itemId: "phone-1.1", kind: "hit" }));
    expect(openSession(s).taps).toEqual([{ itemId: "phone-1.1", kind: "hit" }]);
  });

  it("rejects entity-id collisions instead of silently overwriting", () => {
    const s = apply(initState(), act("a-1", "createList", { name: "A", type: "tokui", lines: "x" }));
    expect(() => apply(s, act("a-1", "createList", { name: "B", type: "growth", lines: "y" }))).toThrow(/already/);
    expect(() => apply(s, act("a-1", "startSession", {}))).toThrow(/already/);
  });

  it("two devices' offline logs merge in any interleaving without collisions", () => {
    // Device A and device B both start from the same synced list, then work
    // offline. Their actions reference their OWN derived ids, so both
    // interleavings replay cleanly and agree on the entities that exist.
    const shared = [act("a-1", "createList", { name: "A", type: "tokui", lines: "Back => choke" })];
    const A = [
      act("a-2", "createSession", { date: "2026-08-28" }),
      act("a-3", "adjustTap", { sessionId: "a-2", itemId: "a-1.1", kind: "hit", delta: 2 }),
    ];
    const B = [
      act("b-1", "createSession", { date: "2026-08-28" }),
      act("b-2", "adjustTap", { sessionId: "b-1", itemId: "a-1.1", kind: "try", delta: 1 }),
    ];
    const ab = fold([...shared, ...A, ...B]);
    const ba = fold([...shared, ...B, ...A]);
    for (const s of [ab, ba]) {
      expect(s.sessions.map((x) => x.id).sort()).toEqual(["a-2", "b-1"]);
      expect(s.sessions.find((x) => x.id === "a-2").taps).toHaveLength(2);
      expect(s.sessions.find((x) => x.id === "b-1").taps).toHaveLength(1);
    }
  });

  it("state carries no id counter — ids come only from actions", () => {
    expect(initState().nextId).toBeUndefined();
  });
});
