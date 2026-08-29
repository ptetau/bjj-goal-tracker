// node-postgres adapter for the referee's db interface: one transaction on
// one pooled connection per tx(fn) call.

// Prisma Postgres on Vercel injects DATABASE_URL as a "prisma+postgres://"
// Accelerate URL that node-postgres cannot speak; the direct TCP string it
// CAN speak usually lands in POSTGRES_URL. Pick the first direct
// postgres:// URL wherever the integration put it.
export function pickDatabaseUrl(env) {
  for (const url of [env.DATABASE_URL, env.POSTGRES_URL, env.PRISMA_DATABASE_URL])
    if (url && /^postgres(ql)?:\/\//.test(url)) return url;
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
