// PGlite adapter: real Postgres, in-process, for the referee tests.

import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../server/schema.sql", import.meta.url), "utf8");

export async function makePgliteDb(pglite) {
  await pglite.exec(schema);
  return {
    tx: (fn) => pglite.transaction((t) => fn((text, params) => t.query(text, params))),
  };
}
