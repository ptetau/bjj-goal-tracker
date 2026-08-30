// Shell #2: a long-lived node server — the same referee behind plain http,
// serving the built app alongside it. With DATABASE_URL it runs on real
// Postgres; without, it falls back to in-process PGlite (persisted under
// .data/), which is also what the e2e smoke drives.

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { makeReferee } from "./referee.js";
import { makeTemplateStore } from "./templates.js";
import { makePgDb, pickDatabaseUrl } from "./db-pg.js";

const PORT = process.env.PORT || 8787;
const DIST = join(process.cwd(), "dist");
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

async function makeDb() {
  const url = pickDatabaseUrl(process.env);
  if (url) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: url, max: 5 });
    await pool.query(schema);
    return makePgDb(pool);
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const pglite = new PGlite(process.env.PGLITE_DIR || "./.data/pglite");
  await pglite.exec(schema);
  return { tx: (fn) => pglite.transaction((t) => fn((text, params) => t.query(text, params))) };
}

const db = await makeDb();
const referee = makeReferee(db);
const templates = makeTemplateStore(db, process.env.TEMPLATE_ADMIN_SECRET);

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 6_000_000) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });

createServer(async (req, res) => {
  const send = (status, body, type = "application/json") => {
    res.writeHead(status, { "content-type": type });
    res.end(type === "application/json" ? JSON.stringify(body) : body);
  };

  if (req.url === "/api/sync") {
    if (req.method !== "POST") return send(405, { error: "POST only" });
    try {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (body.op === "create") return send(200, await referee.create());
      if (body.op === "sync") return send(200, await referee.sync(body));
      return send(400, { error: "unknown op" });
    } catch (err) {
      const msg = String(err.message || err);
      if (/auth/.test(msg)) return send(401, { error: "auth failed" });
      if (/envelope|batch|JSON/.test(msg)) return send(400, { error: msg });
      console.error("sync error:", err);
      return send(500, { error: "sync failed" });
    }
  }

  if (req.url === "/api/templates") {
    try {
      if (req.method === "GET") return send(200, { templates: await templates.list() });
      if (req.method === "PUT") {
        const body = JSON.parse((await readBody(req)) || "{}");
        await templates.replace(req.headers["x-template-secret"], body.templates);
        return send(200, { templates: await templates.list() });
      }
      return send(405, { error: "GET or PUT" });
    } catch (err) {
      const msg = String(err.message || err);
      if (/auth/.test(msg)) return send(401, { error: "auth failed" });
      if (/disabled/.test(msg)) return send(403, { error: msg });
      return send(400, { error: msg });
    }
  }

  // Static app with SPA fallback.
  const path = normalize(join(DIST, req.url === "/" ? "index.html" : req.url)).replace(/\?.*$/, "");
  const file = path.startsWith(DIST) && existsSync(path) && extname(path) ? path : join(DIST, "index.html");
  try {
    send(200, readFileSync(file), MIME[extname(file)] || "application/octet-stream");
  } catch {
    send(404, { error: "not found" });
  }
}).listen(PORT, () => console.log(`TOKUI on http://localhost:${PORT}`));
