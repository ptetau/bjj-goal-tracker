// `toLine` turns an item back into an authoring line, so what the taps
// create is exactly what typing the line would have created.

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { parseLine, toLine } from "../src/engine/parse.js";

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
