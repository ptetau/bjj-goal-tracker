// Milestone 2.2, slice one: magic-link accounts. Request a link with your
// email (plus the gym passphrase the first time), tap it, and the device is
// signed in and bound to your account's tracker — the same sync machinery,
// with the credential handed over instead of carried. Coaches are flagged
// by an email allowlist. Time and mail are injected, so every path drives
// deterministically against in-process Postgres.

import { beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { makePgliteDb } from "./pglite-db.js";
import { makeAuth } from "../server/auth.js";
import { makeReferee } from "../server/referee.js";

const T0 = new Date("2026-08-30T12:00:00Z");

function fixture(env = {}) {
  const sent = [];
  let clock = T0;
  const build = async () => {
    const db = await makePgliteDb(new PGlite());
    const auth = makeAuth({
      db,
      referee: makeReferee(db),
      env: { GYM_PASSPHRASE: "osu", COACH_EMAILS: "coach@gym.nz, sensei@gym.nz", ...env },
      mailer: async (email, link) => sent.push({ email, link }),
      now: () => clock,
    });
    return auth;
  };
  return { build, sent, tick: (ms) => (clock = new Date(clock.getTime() + ms)) };
}

const tokenOf = (link) => new URL(link, "https://tokui.test").searchParams.get("login");

describe("magic-link accounts", () => {
  let f, auth;
  beforeEach(async () => {
    f = fixture();
    auth = await f.build();
  });

  it("new signups need the gym passphrase; wrong ones send nothing", async () => {
    await expect(auth.request({ email: "pat@x.nz", passphrase: "wrong" })).rejects.toThrow(/passphrase/);
    expect(f.sent).toHaveLength(0);
    await auth.request({ email: "pat@x.nz", passphrase: "osu" });
    expect(f.sent).toHaveLength(1);
    expect(f.sent[0].email).toBe("pat@x.nz");
  });

  it("redeeming a link signs in, creates the account, and hands over a tracker", async () => {
    await auth.request({ email: "pat@x.nz", passphrase: "osu" });
    const r = await auth.redeem({ token: tokenOf(f.sent[0].link) });
    expect(r.user).toMatchObject({ email: "pat@x.nz", isCoach: false });
    expect(typeof r.session).toBe("string");
    expect(r.tracker.id).toBeTruthy();
    expect(r.tracker.secret).toBeTruthy();
  });

  it("an existing account logs in without the passphrase, onto the SAME tracker", async () => {
    await auth.request({ email: "pat@x.nz", passphrase: "osu" });
    const first = await auth.redeem({ token: tokenOf(f.sent[0].link) });
    await auth.request({ email: "pat@x.nz" }); // second device, no passphrase
    const second = await auth.redeem({ token: tokenOf(f.sent[1].link) });
    expect(second.tracker).toEqual(first.tracker); // both devices share one log
    expect(second.session).not.toBe(first.session); // but hold their own sessions
  });

  it("email addresses normalize: case and whitespace don't fork accounts", async () => {
    await auth.request({ email: "pat@x.nz", passphrase: "osu" });
    const a = await auth.redeem({ token: tokenOf(f.sent[0].link) });
    await auth.request({ email: "  PAT@X.NZ " });
    const b = await auth.redeem({ token: tokenOf(f.sent[1].link) });
    expect(b.tracker).toEqual(a.tracker);
  });

  it("links are single-use and expire after 15 minutes", async () => {
    await auth.request({ email: "pat@x.nz", passphrase: "osu" });
    const token = tokenOf(f.sent[0].link);
    await auth.redeem({ token });
    await expect(auth.redeem({ token })).rejects.toThrow(/invalid or expired/);

    await auth.request({ email: "pat@x.nz" });
    f.tick(16 * 60 * 1000);
    await expect(auth.redeem({ token: tokenOf(f.sent[1].link) })).rejects.toThrow(/invalid or expired/);
    await expect(auth.redeem({ token: "made-up" })).rejects.toThrow(/invalid or expired/);
  });

  it("the coach allowlist flags coaches, case-insensitively", async () => {
    await auth.request({ email: "Coach@Gym.NZ", passphrase: "osu" });
    const r = await auth.redeem({ token: tokenOf(f.sent[0].link) });
    expect(r.user.isCoach).toBe(true);
  });

  it("whoami validates a session and expires it after 90 days", async () => {
    await auth.request({ email: "pat@x.nz", passphrase: "osu" });
    const { session } = await auth.redeem({ token: tokenOf(f.sent[0].link) });
    expect((await auth.whoami(session)).email).toBe("pat@x.nz");
    expect(await auth.whoami("nonsense")).toBe(null);
    f.tick(91 * 24 * 60 * 60 * 1000);
    expect(await auth.whoami(session)).toBe(null);
  });

  it("without a configured passphrase, signup is open", async () => {
    const g = fixture({ GYM_PASSPHRASE: undefined });
    const a = await g.build();
    await a.request({ email: "anyone@x.nz" });
    expect(g.sent).toHaveLength(1);
  });

  it("rejects garbage emails before any row is written", async () => {
    await expect(auth.request({ email: "not-an-email", passphrase: "osu" })).rejects.toThrow(/email/);
    await expect(auth.request({ email: "", passphrase: "osu" })).rejects.toThrow(/email/);
  });
});
