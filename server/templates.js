// The coach-owned catalogue: the sets, and the connection ranks the add
// sheet reads climbs from. Reads are public (the picker needs no account);
// replacing anything needs the admin secret — the stopgap for "the coach
// edits these" until accounts exist. Seeds itself from the shipped
// defaults the first time anyone reads an empty table, and every incoming
// template is validated by the same engine that will create it.

import crypto from "node:crypto";
import { DEFAULT_TEMPLATES } from "../src/engine/templates.js";
import { CONTROL } from "../src/engine/ladder.js";
import { apply, initState } from "../src/engine/actions.js";

const RANKS = ["weak", "strong", "dominant"];

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

  const check = (secret) => {
    if (!adminSecret) throw new Error("template editing is disabled (no admin secret configured)");
    const a = crypto.createHash("sha256").update(String(secret)).digest();
    const b = crypto.createHash("sha256").update(String(adminSecret)).digest();
    if (!crypto.timingSafeEqual(a, b)) throw new Error("auth failed");
  };

  const validateControl = (control) => {
    if (!control || typeof control !== "object") throw new Error("bad ranks");
    for (const rank of RANKS) {
      if (!Array.isArray(control[rank]) || control[rank].length > 200) throw new Error("bad ranks");
      for (const name of control[rank]) if (typeof name !== "string" || !name.trim()) throw new Error("bad ranks");
    }
  };

  const writeTemplates = async (q, templates) => {
    await q("DELETE FROM templates", []);
    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      await q("INSERT INTO templates (key, name, type, lines, position) VALUES ($1,$2,$3,$4,$5)", [
        t.key,
        String(t.name),
        t.type,
        String(t.lines),
        i,
      ]);
    }
  };

  const writeControl = async (q, control) => {
    await q("DELETE FROM ladder_ranks", []);
    let i = 0;
    for (const rank of RANKS)
      for (const name of control[rank]) await q("INSERT INTO ladder_ranks (connection, rank, position) VALUES ($1,$2,$3)", [name, rank, i++]);
  };

  return {
    check,

    async list() {
      return db.tx(async (q) => {
        await seedIfEmpty(q);
        const r = await q("SELECT key, name, type, lines FROM templates ORDER BY position, key", []);
        return r.rows;
      });
    },

    // The ranks: the coach's table once synced, the shipped one until then.
    async control() {
      return db.tx(async (q) => {
        const r = await q("SELECT connection, rank FROM ladder_ranks ORDER BY position, connection", []);
        if (!r.rows.length) return CONTROL;
        const control = { weak: [], strong: [], dominant: [] };
        for (const row of r.rows) control[row.rank]?.push(row.connection);
        return control;
      });
    },

    // Full-catalogue replace: what the coach sends is what everyone gets.
    async replace(secret, templates) {
      check(secret);
      if (!Array.isArray(templates) || templates.length > 100) throw new Error("bad catalogue");
      for (const t of templates) validate(t);
      return db.tx((q) => writeTemplates(q, templates));
    },

    // Sets and ranks together, one transaction: a sheet that fails to read
    // leaves both as they were.
    async replaceCatalogue(secret, { templates, control }) {
      check(secret);
      if (!Array.isArray(templates) || templates.length > 100) throw new Error("bad catalogue");
      for (const t of templates) validate(t);
      validateControl(control);
      return db.tx(async (q) => {
        await writeTemplates(q, templates);
        await writeControl(q, control);
      });
    },
  };
}
