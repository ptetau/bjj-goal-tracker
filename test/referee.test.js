// The sync referee, driven against a real (in-process) Postgres. The server
// replays clients' actions through the same engine the browser runs — these
// tests are the contract that milestone 2's whole sync story hangs on.

import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { makePgliteDb } from "./pglite-db.js";
import { makeReferee } from "../server/referee.js";
import { fold } from "../src/engine/actions.js";

const at = "2026-08-29T19:00:00";
const mkList = (id) => ({ id, type: "createList", payload: { name: "A", type: "tokui", lines: "Back => choke" }, at });
const mkSession = (id, date) => ({ id, type: "createSession", payload: { date }, at });
const mkAdjust = (id, sessionId, itemId, delta) => ({ id, type: "adjustTap", payload: { sessionId, itemId, kind: "hit", delta }, at });

let referee;
beforeAll(async () => {
  referee = makeReferee(await makePgliteDb(new PGlite()));
});

describe("referee", () => {
  it("creates trackers with distinct ids and secrets", async () => {
    const a = await referee.create();
    const b = await referee.create();
    expect(a.trackerId).not.toBe(b.trackerId);
    expect(a.secret).not.toBe(b.secret);
    expect(a.secret.length).toBeGreaterThanOrEqual(20);
  });

  it("rejects a bad secret and an unknown tracker", async () => {
    const t = await referee.create();
    await expect(referee.sync({ trackerId: t.trackerId, secret: "wrong", cursor: 0, actions: [] })).rejects.toThrow(/auth/);
    await expect(referee.sync({ trackerId: "nope", secret: t.secret, cursor: 0, actions: [] })).rejects.toThrow(/auth/);
  });

  it("appends valid actions and returns the log after the cursor, sequenced", async () => {
    const t = await referee.create();
    const creds = { trackerId: t.trackerId, secret: t.secret };
    const r1 = await referee.sync({ ...creds, cursor: 0, actions: [mkList("a-1")] });
    expect(r1.actions.map((a) => a.id)).toEqual(["a-1"]);
    expect(r1.cursor).toBe(1);
    expect(r1.rejected).toEqual([]);

    // a second device pulls from zero and sees the same log
    const r2 = await referee.sync({ ...creds, cursor: 0, actions: [] });
    expect(r2.actions.map((a) => a.id)).toEqual(["a-1"]);
  });

  it("is idempotent: re-pushing an already-appended action is a no-op ack", async () => {
    const t = await referee.create();
    const creds = { trackerId: t.trackerId, secret: t.secret };
    await referee.sync({ ...creds, cursor: 0, actions: [mkList("a-1")] });
    const again = await referee.sync({ ...creds, cursor: 1, actions: [mkList("a-1")] });
    expect(again.actions).toEqual([]); // nothing new after cursor 1
    expect(again.rejected).toEqual([]);
    const all = await referee.sync({ ...creds, cursor: 0, actions: [] });
    expect(all.actions).toHaveLength(1);
  });

  it("rejects actions the engine refuses, and says which", async () => {
    const t = await referee.create();
    const creds = { trackerId: t.trackerId, secret: t.secret };
    const r = await referee.sync({
      ...creds,
      cursor: 0,
      actions: [mkList("a-1"), mkAdjust("a-2", "ghost", "a-1.1", 2), mkSession("a-3", "2026-08-28")],
    });
    expect(r.rejected).toEqual(["a-2"]); // references a session that doesn't exist
    expect(r.actions.map((a) => a.id)).toEqual(["a-1", "a-3"]);
  });

  it("merges two devices: both converge on the same folded state", async () => {
    const t = await referee.create();
    const creds = { trackerId: t.trackerId, secret: t.secret };
    // device A seeds the list and syncs
    const a1 = await referee.sync({ ...creds, cursor: 0, actions: [mkList("a-1")] });
    // both go offline: A logs a session, B (which had pulled a-1) logs its own
    const A = [mkSession("a-2", "2026-08-28"), mkAdjust("a-3", "a-2", "a-1.1", 2)];
    const B = [mkSession("b-1", "2026-08-28"), mkAdjust("b-2", "b-1", "a-1.1", 1)];
    const ra = await referee.sync({ ...creds, cursor: a1.cursor, actions: A });
    const rb = await referee.sync({ ...creds, cursor: a1.cursor, actions: B });

    const logA = [...a1.actions, ...ra.actions, ...(await referee.sync({ ...creds, cursor: ra.cursor, actions: [] })).actions];
    const logB = [...a1.actions, ...rb.actions];
    expect(fold(logA)).toEqual(fold(logB));
    const s = fold(logA);
    expect(s.sessions).toHaveLength(2);
    expect(s.sessions.flatMap((x) => x.taps)).toHaveLength(3);
  });

  it("enforces envelope hygiene before the engine sees anything", async () => {
    const t = await referee.create();
    const creds = { trackerId: t.trackerId, secret: t.secret };
    await expect(referee.sync({ ...creds, cursor: 0, actions: [{ id: 5, type: "startSession", at }] })).rejects.toThrow(/envelope/);
    await expect(referee.sync({ ...creds, cursor: 0, actions: [{ id: "x".repeat(200), type: "startSession", at }] })).rejects.toThrow(/envelope/);
    await expect(
      referee.sync({ ...creds, cursor: 0, actions: Array.from({ length: 501 }, (_, i) => mkSession(`s-${i}`, "2026-08-01")) })
    ).rejects.toThrow(/batch/);
  });
});
