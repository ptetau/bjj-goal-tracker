// The coach's catalogue over HTTP: the sets and the connection ranks. GET
// is public — the picker needs no account, and with no database it still
// serves the shipped defaults. PUT replaces the sets and POST {op:"sync"}
// pulls sets and ranks from the coach's sheets; both need the admin secret
// (TEMPLATE_ADMIN_SECRET) — the coach's editing key until accounts exist.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { makePgDb, pickDatabaseUrl } from "../server/db-pg.js";
import { makeTemplateStore } from "../server/templates.js";
import { sheetUrls, syncFromSheets } from "../server/sheet-sync.js";
import { DEFAULT_TEMPLATES } from "../src/engine/templates.js";
import { CONTROL } from "../src/engine/ladder.js";

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

// One mapping from what the store and the sync throw to a status, shared
// with the long-lived server so both shells answer alike.
export function templateErrorStatus(err) {
  const msg = String(err.message || err);
  if (/auth/.test(msg)) return 401;
  if (/disabled/.test(msg)) return 403;
  if (/not configured/.test(msg)) return 503;
  if (/fetch failed/.test(msg)) return 502;
  if (/bad|name|type|required|sheet|row \d+/.test(msg)) return 400;
  console.error("templates error:", err);
  return 500;
}
export const templateErrorMessage = (err) => (templateErrorStatus(err) === 500 ? "templates failed" : String(err.message || err));

export default async function handler(req, res) {
  let store = null;
  try {
    store = await getStore();
  } catch {
    store = null;
  }
  const urls = sheetUrls(process.env);
  const catalogue = async () => ({
    templates: store ? await store.list() : DEFAULT_TEMPLATES,
    control: store ? await store.control() : CONTROL,
    sheet: Boolean(store && urls.graph && urls.ranks),
  });
  try {
    if (req.method === "GET") return res.status(200).json(await catalogue());
    if (!store) return res.status(503).json({ error: "no database — templates are read-only defaults" });
    const secret = req.headers["x-template-secret"];
    if (req.method === "PUT") {
      await store.replace(secret, (req.body || {}).templates);
      return res.status(200).json(await catalogue());
    }
    if (req.method === "POST" && (req.body || {}).op === "sync") {
      const synced = await syncFromSheets({ store, secret, urls });
      return res.status(200).json({ synced, ...(await catalogue()) });
    }
    return res.status(405).json({ error: "GET, PUT, or POST {op:'sync'}" });
  } catch (err) {
    return res.status(templateErrorStatus(err)).json({ error: templateErrorMessage(err) });
  }
}
