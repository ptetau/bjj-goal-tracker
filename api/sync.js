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
      if (!url) throw new Error("db-not-configured");
      const pool = new pg.Pool({ connectionString: url, max: 3 });
      const schema = readFileSync(join(process.cwd(), "server", "schema.sql"), "utf8");
      try {
        await pool.query(schema);
      } catch (err) {
        console.error("db connect failed:", err);
        throw new Error("db-unreachable");
      }
      return makeReferee(makePgDb(pool));
    })();
    refereePromise.catch(() => (refereePromise = null)); // retry next request
  }
  return refereePromise;
}

// Says WHY sync is down, without leaking anything: the operator reading this
// either needs to set a variable, or to check the one they set.
const UNAVAILABLE = {
  "db-not-configured":
    "no direct postgres:// URL found — set DATABASE_URL or POSTGRES_URL (a prisma+postgres:// URL doesn't count)",
  "db-unreachable": "database URL is set but the connection failed — check the URL and that the db is up",
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  let referee;
  try {
    referee = await getReferee();
  } catch (err) {
    return res
      .status(503)
      .json({ error: "sync unavailable", reason: UNAVAILABLE[err.message] || "startup failed" });
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
