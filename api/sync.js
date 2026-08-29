// Serverless shell #1: the referee behind one Vercel function.
// Needs DATABASE_URL (a pooled Postgres connection string). The schema is
// idempotent and cheap, so it is ensured lazily on cold start — a
// single-gym app doesn't need a migration pipeline yet.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { makePgDb, pickDatabaseUrl } from "../server/db-pg.js";
import { makeReferee } from "../server/referee.js";

let refereePromise = null;

function getReferee() {
  if (!refereePromise) {
    refereePromise = (async () => {
      const url = pickDatabaseUrl(process.env);
      if (!url) throw new Error("no database");
      const pool = new pg.Pool({ connectionString: url, max: 3 });
      const schema = readFileSync(join(process.cwd(), "server", "schema.sql"), "utf8");
      await pool.query(schema);
      return makeReferee(makePgDb(pool));
    })();
    refereePromise.catch(() => (refereePromise = null)); // retry next request
  }
  return refereePromise;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  let referee;
  try {
    referee = await getReferee();
  } catch {
    return res.status(503).json({ error: "sync unavailable" });
  }
  try {
    const body = req.body || {};
    if (body.op === "create") return res.status(200).json(await referee.create());
    if (body.op === "sync") return res.status(200).json(await referee.sync(body));
    return res.status(400).json({ error: "unknown op" });
  } catch (err) {
    const msg = String(err.message || err);
    if (/auth/.test(msg)) return res.status(401).json({ error: "auth failed" });
    if (/envelope|batch/.test(msg)) return res.status(400).json({ error: msg });
    console.error("sync error:", err);
    return res.status(500).json({ error: "sync failed" });
  }
}
