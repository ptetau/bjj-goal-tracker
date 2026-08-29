// Apply server/schema.sql to DATABASE_URL. Idempotent — safe to re-run.
//   node --env-file-if-exists=.env.development.local scripts/migrate-db.js

import { readFileSync } from "node:fs";
import pg from "pg";
import { pickDatabaseUrl } from "../server/db-pg.js";

const url = pickDatabaseUrl(process.env);
if (!url) {
  console.error("no direct postgres:// URL in DATABASE_URL / POSTGRES_URL / PRISMA_DATABASE_URL");
  process.exit(1);
}

const schema = readFileSync(new URL("../server/schema.sql", import.meta.url), "utf8");
const pool = new pg.Pool({ connectionString: url, max: 1 });
await pool.query(schema);
await pool.end();
console.log("schema applied");
