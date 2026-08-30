// The tokui waza picker: a new user composes a personal list by tapping
// individual techniques. The catalogue is derived from the template sets —
// one curated source, coach edits flow through — grouped by position and
// deduplicated. `toLine` turns a picked item back into an authoring line,
// so what the picker creates is exactly what typing it would have created.

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { parseLine, toLine } from "../src/engine/parse.js";
import { DEFAULT_TEMPLATES, wazaCatalogue } from "../src/engine/templates.js";

describe("toLine", () => {
  it("serializes items back to authoring lines", () => {
    expect(toLine({ position: "Back", move: "strangle | arm bar", target: 50 })).toBe(
      "Back => strangle | arm bar x50"
    );
    expect(toLine({ position: "Bottom", move: "top", target: null })).toBe("Bottom => top");
    expect(toLine({ position: null, move: "shrimp drills", target: null })).toBe("shrimp drills");
  });

  it("round-trips: parseLine(toLine(p)) === p, for all arrow-free content", () => {
    const arbWord = fc.stringMatching(/^[a-zA-Z][a-zA-Z ,'|:]{0,30}[a-zA-Z]$/);
    fc.assert(
      fc.property(
        fc.option(arbWord, { nil: null }),
        arbWord,
        fc.option(fc.integer({ min: 1, max: 999 }), { nil: null }),
        (position, move, target) => {
          // a colon can't lead a free-form line's tail-target parse oddly; and
          // positions come trimmed, as the parser would produce them
          const p = { position: position?.trim() || null, move: move.trim(), target };
          fc.pre(p.move.length > 1);
          expect(parseLine(toLine(p))).toEqual(p);
        }
      )
    );
  });
});

describe("wazaCatalogue", () => {
  const groups = wazaCatalogue(DEFAULT_TEMPLATES);

  it("groups every template item by position, deduplicated", () => {
    const allTitles = groups.flatMap((g) => g.items.map((i) => `${i.position}→${i.move}`.toLowerCase()));
    expect(new Set(allTitles).size).toBe(allTitles.length);
    // "Back => strangle | arm bar" appears in the back-attack set once, deduped
    const back = groups.find((g) => g.position === "Back");
    expect(back.items.filter((i) => i.move.includes("strangle")).length).toBe(1);
  });

  it("keeps targets and remembers which sets an item came from", () => {
    const back = groups.find((g) => g.position === "Back");
    const strangle = back.items.find((i) => i.move === "strangle | arm bar");
    expect(strangle.target).toBe(50);
    expect(strangle.sources).toContain("Back attack system");
  });

  it("marks the fundamentals items as the default selection", () => {
    const defaults = groups.flatMap((g) => g.items.filter((i) => i.recommended));
    expect(defaults.length).toBeGreaterThanOrEqual(4);
    for (const i of defaults) expect(i.sources).toContain("Fundamentals");
  });

  it("every catalogue item serializes to a line the engine accepts", () => {
    for (const g of groups)
      for (const i of g.items) {
        const parsed = parseLine(toLine(i));
        expect(parsed.move).toBe(i.move);
        expect(parsed.position).toBe(i.position);
      }
  });
});
