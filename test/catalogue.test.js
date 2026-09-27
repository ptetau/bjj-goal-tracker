// The catalogue file is the admin backend for now: one JSON file the coach
// edits, holding the sets and the connection ranks. The engine's shipped
// defaults come from it, and `npm run templates:push` sends it to the
// server whole.

import { describe, expect, it } from "vitest";
import catalogue from "../src/engine/catalogue.json" with { type: "json" };
import { DEFAULT_TEMPLATES } from "../src/engine/templates.js";
import { CONTROL, CONNECTIONS } from "../src/engine/ladder.js";

describe("catalogue.json", () => {
  it("is what the engine ships: every set's lines joined, and the ranks", () => {
    expect(DEFAULT_TEMPLATES).toEqual(
      catalogue.templates.map((t) => ({ key: t.key, name: t.name, type: t.type, lines: t.lines.join("\n") }))
    );
    expect(CONTROL).toEqual(catalogue.control);
  });

  it("ranks only connections the ladder knows, each once", () => {
    const ranked = [...catalogue.control.weak, ...catalogue.control.strong, ...catalogue.control.dominant];
    expect(new Set(ranked).size).toBe(ranked.length);
    for (const name of ranked) expect(CONNECTIONS, name).toContain(name);
  });
});
