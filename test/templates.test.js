// Starter mission sets: the shipped defaults must be valid app content
// (every line parses, sane sizes, growth items carrying the default x50),
// and the server-side store must seed them, serve them, and let only the
// holder of the admin secret replace them — coach-owned by design, before
// accounts exist.

import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { makePgliteDb } from "./pglite-db.js";
import { DEFAULT_TEMPLATES } from "../src/engine/templates.js";
import { makeTemplateStore } from "../server/templates.js";
import { parseLines } from "../src/engine/parse.js";
import { apply, initState } from "../src/engine/actions.js";

describe("DEFAULT_TEMPLATES content", () => {
  it("ships the agreed catalogue", () => {
    const keys = DEFAULT_TEMPLATES.map((t) => t.key);
    for (const expected of [
      "fundamentals",
      "back-attack",
      "leg-entanglement",
      "pressure-pass",
      "closed-guard",
      "half-guard",
      "x-guard",
      "slx",
      "lasso",
      "dlr",
      "rdlr",
      "collar-sleeve",
      "loose-passing",
      "tight-passing",
      "standing",
      "triangle-hub",
    ])
      expect(keys).toContain(expected);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every template is a valid, well-sized list the engine accepts", () => {
    for (const t of DEFAULT_TEMPLATES) {
      expect(["tokui", "growth"]).toContain(t.type);
      expect(t.name.length).toBeGreaterThan(2);
      const items = parseLines(t.lines);
      expect(items.length).toBeGreaterThanOrEqual(4);
      expect(items.length).toBeLessThanOrEqual(7);
      // the whole template must create cleanly through the real action
      const state = apply(initState(), {
        id: `tpl-${t.key}`,
        type: "createList",
        payload: { name: t.name, type: t.type, lines: t.lines },
        at: "2026-08-30T12:00:00",
      });
      expect(state.lists[0].items).toHaveLength(items.length);
    }
  });

  it("growth templates default every item to a high x50 target", () => {
    for (const t of DEFAULT_TEMPLATES.filter((x) => x.type === "growth"))
      for (const item of parseLines(t.lines)) expect(item.target).toBe(50);
  });

  it("tokui templates put targets on finishes, not on positional work", () => {
    // Concretely: at least one targeted item per tokui set, never all of them.
    for (const t of DEFAULT_TEMPLATES.filter((x) => x.type === "tokui")) {
      const items = parseLines(t.lines);
      const targeted = items.filter((i) => i.target !== null);
      expect(targeted.length).toBeGreaterThanOrEqual(1);
      expect(targeted.length).toBeLessThan(items.length);
    }
  });
});

describe("the template store", () => {
  let store;
  beforeAll(async () => {
    store = makeTemplateStore(await makePgliteDb(new PGlite()), "coach-secret");
  });

  it("seeds the defaults on first list and serves them in order", async () => {
    const templates = await store.list();
    expect(templates.map((t) => t.key)).toEqual(DEFAULT_TEMPLATES.map((t) => t.key));
    expect(templates[0]).toMatchObject({ name: DEFAULT_TEMPLATES[0].name, type: DEFAULT_TEMPLATES[0].type });
  });

  it("replaces the catalogue only with the right secret", async () => {
    const mine = [{ key: "gym-a-game", name: "Gym A-game", type: "tokui", lines: "Back => choke x50\nBottom => top" }];
    await expect(store.replace("wrong", mine)).rejects.toThrow(/auth/);
    await store.replace("coach-secret", mine);
    const after = await store.list();
    expect(after.map((t) => t.key)).toEqual(["gym-a-game"]); // full replace: old rows gone
  });

  it("rejects catalogues the engine wouldn't accept", async () => {
    await expect(
      store.replace("coach-secret", [{ key: "bad", name: "  ", type: "tokui", lines: "x" }])
    ).rejects.toThrow(/name/);
    await expect(
      store.replace("coach-secret", [{ key: "bad", name: "ok", type: "cardio", lines: "x" }])
    ).rejects.toThrow(/type/);
  });

  it("refuses edits entirely when no admin secret is configured", async () => {
    const locked = makeTemplateStore(await makePgliteDb(new PGlite()), undefined);
    await expect(locked.replace("anything", [])).rejects.toThrow(/disabled/);
    expect(await locked.list()).toHaveLength(DEFAULT_TEMPLATES.length); // reads still work
  });
});
