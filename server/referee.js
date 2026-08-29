// The sync referee: the same pure engine the browser runs, replaying
// clients' queued actions into an append-only Postgres log. Storage comes
// injected as `db.tx(fn)` — a per-tracker serialized transaction — so the
// referee runs identically over node-postgres in production and PGlite in
// tests. This is a server *shell*: randomness and hashing live here, never
// in the engine.

import crypto from "node:crypto";
import { apply, initState } from "../src/engine/actions.js";

const MAX_BATCH = 500;
const MAX_ACTION_BYTES = 10_000;

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest();

const checkEnvelope = (a) => {
  const ok =
    a &&
    typeof a === "object" &&
    typeof a.id === "string" &&
    a.id.length >= 1 &&
    a.id.length <= 120 &&
    typeof a.type === "string" &&
    a.type.length <= 40 &&
    typeof a.at === "string" &&
    a.at.length <= 25 &&
    (a.payload === undefined || (typeof a.payload === "object" && a.payload !== null)) &&
    JSON.stringify(a).length <= MAX_ACTION_BYTES;
  if (!ok) throw new Error("bad action envelope");
};

export function makeReferee(db) {
  return {
    async create() {
      const trackerId = crypto.randomBytes(8).toString("hex");
      const secret = crypto.randomBytes(18).toString("base64url");
      await db.tx((q) =>
        q("INSERT INTO trackers (id, secret_hash) VALUES ($1, $2)", [
          trackerId,
          sha256(secret).toString("hex"),
        ])
      );
      return { trackerId, secret };
    },

    // Push `actions`, pull everything after `cursor`. Idempotent: an action
    // id the log already holds is silently acked; one the engine refuses is
    // named in `rejected` (the client drops it — server truth won).
    async sync({ trackerId, secret, cursor, actions }) {
      const incoming = actions || [];
      if (!Array.isArray(incoming) || incoming.length > MAX_BATCH) throw new Error("sync batch too large");
      for (const a of incoming) checkEnvelope(a);
      const from = Number(cursor) || 0;

      return db.tx(async (q) => {
        const t = await q("SELECT secret_hash FROM trackers WHERE id = $1 FOR UPDATE", [String(trackerId)]);
        const row = t.rows[0];
        const given = sha256(secret);
        const stored = row ? Buffer.from(row.secret_hash, "hex") : crypto.randomBytes(32);
        if (!row || !crypto.timingSafeEqual(stored, given)) throw new Error("auth failed");

        // The stored log is authoritative and must replay cleanly — it was
        // validated on the way in. This is why the action vocabulary is a
        // wire format: additive changes only.
        const existing = await q("SELECT seq, action FROM actions WHERE tracker_id = $1 ORDER BY seq", [trackerId]);
        let state = initState();
        const known = new Set();
        for (const r of existing.rows) {
          state = apply(state, r.action);
          known.add(r.action.id);
        }

        let seq = existing.rows.length ? Number(existing.rows[existing.rows.length - 1].seq) : 0;
        const rejected = [];
        for (const a of incoming) {
          if (known.has(a.id)) continue;
          try {
            state = apply(state, a);
          } catch {
            rejected.push(a.id);
            continue;
          }
          seq += 1;
          await q("INSERT INTO actions (tracker_id, seq, action) VALUES ($1, $2, $3)", [
            trackerId,
            seq,
            JSON.stringify(a),
          ]);
          known.add(a.id);
        }

        const after = await q(
          "SELECT action FROM actions WHERE tracker_id = $1 AND seq > $2 ORDER BY seq",
          [trackerId, from]
        );
        return { actions: after.rows.map((r) => r.action), cursor: seq, rejected };
      });
    },
  };
}
