// The coach's catalogue over HTTP: the sets and the connection ranks. GET
// is public — the picker needs no account, and with no database it still
// serves the shipped defaults. PUT replaces the catalogue (sets, and the
// ranks when sent) and needs the admin secret (TEMPLATE_ADMIN_SECRET) —
// the coach's editing key until accounts exist. `npm run templates:push`
// sends catalogue.json this way.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { makePgDb, pickDatabaseUrl } from "../server/db-pg.js";
import { makeTemplateStore } from "../server/templates.js";
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
  if (/bad|name|type|required/.test(msg)) return 400;
  console.error("templates error:", err);
  return 500;
}
export const templateErrorMessage = (err) => (templateErrorStatus(err) === 500 ? "templates failed" : String(err.message || err));

// PUT replaces the sets, and the ranks too when the body carries them.
export const putCatalogue = (store, secret, body) =>
  body.control ? store.replaceCatalogue(secret, body) : store.replace(secret, body.templates);

export default async function handler(req, res) {
  let store = null;
  try {
    store = await getStore();
  } catch {
    store = null;
  }
  const catalogue = async () => ({
    templates: store ? await store.list() : DEFAULT_TEMPLATES,
    control: store ? await store.control() : CONTROL,
  });
  try {
    if (req.method === "GET") return res.status(200).json(await catalogue());
    if (!store) return res.status(503).json({ error: "no database — templates are read-only defaults" });
    if (req.method === "PUT") {
      await putCatalogue(store, req.headers["x-template-secret"], req.body || {});
      return res.status(200).json(await catalogue());
    }
    return res.status(405).json({ error: "GET or PUT" });
  } catch (err) {
    return res.status(templateErrorStatus(err)).json({ error: templateErrorMessage(err) });
  }
}
