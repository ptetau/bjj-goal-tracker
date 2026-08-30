// Prisma Postgres on Vercel injects DATABASE_URL as a "prisma+postgres://"
// Accelerate URL that node-postgres cannot speak, alongside POSTGRES_URL as
// the direct TCP string it can. The shells must pick a URL pg understands,
// wherever the integration put it — never hand pg an accelerate URL.

import { describe, expect, it } from "vitest";
import { pickDatabaseUrl } from "../server/db-pg.js";

describe("pickDatabaseUrl", () => {
  it("takes a direct postgres:// DATABASE_URL as-is", () => {
    expect(pickDatabaseUrl({ DATABASE_URL: "postgres://u:p@host/db" })).toBe("postgres://u:p@host/db");
    expect(pickDatabaseUrl({ DATABASE_URL: "postgresql://u:p@host/db?sslmode=require" })).toBe(
      "postgresql://u:p@host/db?sslmode=require"
    );
  });

  it("skips a prisma+postgres:// accelerate URL and falls back to POSTGRES_URL", () => {
    expect(
      pickDatabaseUrl({
        DATABASE_URL: "prisma+postgres://accelerate.prisma-data.net/?api_key=xyz",
        POSTGRES_URL: "postgres://u:p@db.prisma.io:5432/db?sslmode=require",
      })
    ).toBe("postgres://u:p@db.prisma.io:5432/db?sslmode=require");
  });

  it("tries PRISMA_DATABASE_URL last, only when it's a direct URL", () => {
    expect(
      pickDatabaseUrl({
        PRISMA_DATABASE_URL: "postgres://u:p@host/db",
      })
    ).toBe("postgres://u:p@host/db");
    expect(
      pickDatabaseUrl({
        PRISMA_DATABASE_URL: "prisma+postgres://accelerate.prisma-data.net/?api_key=xyz",
      })
    ).toBe(null);
  });

  it("returns null when nothing usable is set", () => {
    expect(pickDatabaseUrl({})).toBe(null);
    expect(pickDatabaseUrl({ DATABASE_URL: "" })).toBe(null);
    expect(pickDatabaseUrl({ DATABASE_URL: "mysql://nope" })).toBe(null);
  });

  // The Vercel Prisma integration prefixes its variables with the project
  // name the user typed — tokui_DATABASE_URL, tokui_POSTGRES_URL — so exact
  // names alone find nothing on a real deployment.
  it("finds prefixed variables, still skipping accelerate URLs", () => {
    expect(
      pickDatabaseUrl({
        tokui_DATABASE_URL: "prisma+postgres://accelerate.prisma-data.net/?api_key=xyz",
        tokui_POSTGRES_URL: "postgres://u:p@db.prisma.io:5432/db?sslmode=require",
        tokui_PRISMA_DATABASE_URL: "prisma+postgres://accelerate.prisma-data.net/?api_key=xyz",
      })
    ).toBe("postgres://u:p@db.prisma.io:5432/db?sslmode=require");
  });

  it("prefers an exact unprefixed name over a prefixed one", () => {
    expect(
      pickDatabaseUrl({
        DATABASE_URL: "postgres://exact/db",
        tokui_DATABASE_URL: "postgres://prefixed/db",
      })
    ).toBe("postgres://exact/db");
  });

  it("ignores lookalike keys that don't end in a known suffix", () => {
    expect(pickDatabaseUrl({ MY_DATABASE_URL_BACKUP: "postgres://nope/db" })).toBe(null);
  });
});
