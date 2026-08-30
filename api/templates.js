// Starter mission sets over HTTP. GET is public — the picker needs no
// account, and with no database it still serves the shipped defaults.
// PUT replaces the whole catalogue and needs the admin secret
// (TEMPLATE_ADMIN_SECRET) — the coach's editing key until accounts exist.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { makePgDb, pickDatabaseUrl } from "../server/db-pg.js";
import { makeTemplateStore } from "../server/templates.js";
import { DEFAULT_TEMPLATES } from "../src/engine/templates.js";

let storePromise = null;

function getStore() {
  if (!storePromise) {
    storePromise = (async () => {
      const url = pickDatabaseUrl(process.env);
      if (!url) return null; // defaults-only mode
      const pool = new pg.Pool({ connectionString: url, max: 3 });
      await pool.query(readFileSync(join(process.cwd(), "server", "schema.sql"), "utf8"));
      return makeTemplateStore(makePgDb(pool), process.env.TEMPLATE_ADMIN_SECRET);
    })();
    storePromise.catch(() => (storePromise = null));
  }
  return storePromise;
}

export default async function handler(req, res) {
  let store = null;
  try {
    store = await getStore();
  } catch {
    store = null;
  }
  try {
    if (req.method === "GET") {
      const templates = store ? await store.list() : DEFAULT_TEMPLATES;
      return res.status(200).json({ templates });
    }
    if (req.method === "PUT") {
      if (!store) return res.status(503).json({ error: "no database — templates are read-only defaults" });
      await store.replace(req.headers["x-template-secret"], (req.body || {}).templates);
      return res.status(200).json({ templates: await store.list() });
    }
    return res.status(405).json({ error: "GET or PUT" });
  } catch (err) {
    const msg = String(err.message || err);
    if (/auth/.test(msg)) return res.status(401).json({ error: "auth failed" });
    if (/disabled/.test(msg)) return res.status(403).json({ error: msg });
    if (/bad|name|type|required/.test(msg)) return res.status(400).json({ error: msg });
    console.error("templates error:", err);
    return res.status(500).json({ error: "templates failed" });
  }
}
