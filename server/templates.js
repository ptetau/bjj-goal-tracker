// The coach-owned template store. Reads are public (the picker needs no
// account); replacing the catalogue needs the admin secret — the stopgap
// for "the coach edits these" until accounts exist. Seeds itself from the
// shipped defaults the first time anyone reads an empty table, and every
// incoming template is validated by the same engine that will create it.

import crypto from "node:crypto";
import { DEFAULT_TEMPLATES } from "../src/engine/templates.js";
import { apply, initState } from "../src/engine/actions.js";

const KEY_RE = /^[a-z0-9-]{1,60}$/;

const validate = (t) => {
  if (!t || typeof t !== "object" || !KEY_RE.test(String(t.key))) throw new Error("bad template key");
  // The engine is the validator: whatever it refuses, the store refuses.
  apply(initState(), {
    id: `tpl-${t.key}`,
    type: "createList",
    payload: { name: t.name, type: t.type, lines: t.lines },
    at: "2026-01-01T00:00:00",
  });
};

export function makeTemplateStore(db, adminSecret) {
  const seedIfEmpty = async (q) => {
    const n = await q("SELECT count(*)::int AS n FROM templates", []);
    if (n.rows[0].n > 0) return;
    for (let i = 0; i < DEFAULT_TEMPLATES.length; i++) {
      const t = DEFAULT_TEMPLATES[i];
      await q("INSERT INTO templates (key, name, type, lines, position) VALUES ($1,$2,$3,$4,$5)", [
        t.key,
        t.name,
        t.type,
        t.lines,
        i,
      ]);
    }
  };

  return {
    async list() {
      return db.tx(async (q) => {
        await seedIfEmpty(q);
        const r = await q("SELECT key, name, type, lines FROM templates ORDER BY position, key", []);
        return r.rows;
      });
    },

    // Full-catalogue replace: what the coach sends is what everyone gets.
    async replace(secret, templates) {
      if (!adminSecret) throw new Error("template editing is disabled (no admin secret configured)");
      const a = crypto.createHash("sha256").update(String(secret)).digest();
      const b = crypto.createHash("sha256").update(String(adminSecret)).digest();
      if (!crypto.timingSafeEqual(a, b)) throw new Error("auth failed");
      if (!Array.isArray(templates) || templates.length > 100) throw new Error("bad catalogue");
      for (const t of templates) validate(t);
      return db.tx(async (q) => {
        await q("DELETE FROM templates", []);
        for (let i = 0; i < templates.length; i++) {
          const t = templates[i];
          await q(
            "INSERT INTO templates (key, name, type, lines, position) VALUES ($1,$2,$3,$4,$5)",
            [t.key, String(t.name), t.type, String(t.lines), i]
          );
        }
      });
    },
  };
}
