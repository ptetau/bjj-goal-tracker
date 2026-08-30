// node-postgres adapter for the referee's db interface: one transaction on
// one pooled connection per tx(fn) call.

// Find a database URL node-postgres can dial, wherever the integration put
// it. Two traps on a real Vercel + Prisma Postgres setup: the value under
// DATABASE_URL is a "prisma+postgres://" Accelerate URL (wrong scheme —
// only a direct postgres:// works here), and the integration prefixes its
// variable names with whatever the user typed (tokui_POSTGRES_URL). So:
// take the first direct postgres:// value, trying exact names before
// prefixed ones, DATABASE_URL before POSTGRES_URL before
// PRISMA_DATABASE_URL.
const SUFFIXES = ["DATABASE_URL", "POSTGRES_URL", "PRISMA_DATABASE_URL"];

export function pickDatabaseUrl(env) {
  for (const suffix of SUFFIXES) {
    const keys = Object.keys(env)
      .filter((k) => k === suffix || k.endsWith(`_${suffix}`))
      .sort(); // deterministic; exact uppercase names sort before prefixed lowercase ones
    for (const k of keys) {
      const url = env[k];
      if (url && /^postgres(ql)?:\/\//.test(url)) return url;
    }
  }
  return null;
}

export function makePgDb(pool) {
  return {
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn((text, params) => client.query(text, params));
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
