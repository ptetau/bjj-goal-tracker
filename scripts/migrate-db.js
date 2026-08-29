// Apply server/schema.sql to DATABASE_URL. Idempotent — safe to re-run.
//   node --env-file-if-exists=.env.development.local scripts/migrate-db.js

import { readFileSync } from "node:fs";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const schema = readFileSync(new URL("../server/schema.sql", import.meta.url), "utf8");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
await pool.query(schema);
await pool.end();
console.log("schema applied");
