import { describe, expect, it } from "vitest";
import { itemTitle, parseLine, parseLines } from "../src/engine/parse.js";

describe("parseLine", () => {
  it("splits position from move on arrows", () => {
    expect(parseLine("Bottom => top")).toEqual({ position: "Bottom", move: "top", target: null });
    expect(parseLine("Back -> arm trap | reverse triangle")).toEqual({
      position: "Back",
      move: "arm trap | reverse triangle",
      target: null,
    });
    expect(parseLine("Leg → matuesz footlock")).toEqual({
      position: "Leg",
      move: "matuesz footlock",
      target: null,
    });
  });

  it("keeps colons inside the move — they are not separators", () => {
    expect(parseLine("Top => pinning: tight weight and balance")).toEqual({
      position: "Top",
      move: "pinning: tight weight and balance",
      target: null,
    });
  });

  it("reads an xN target suffix in any of its spellings", () => {
    expect(parseLine("Bottom => top x50").target).toBe(50);
    expect(parseLine("armbar ×25").target).toBe(25);
    expect(parseLine("outside pass *100")).toEqual({ position: null, move: "outside pass", target: 100 });
  });

  it("keeps unparseable lines whole as free-form items", () => {
    expect(parseLine("shrimp to knees every warmup")).toEqual({
      position: null,
      move: "shrimp to knees every warmup",
      target: null,
    });
  });

  it("drops blank lines and never rejects content", () => {
    expect(parseLine("   ")).toBe(null);
    expect(parseLine("x50")).toEqual({ position: null, move: "x50", target: null }); // a bare target is just text
  });

  it("chains double arrows into the move", () => {
    expect(parseLine("Bottom => top => back")).toEqual({
      position: "Bottom",
      move: "top → back",
      target: null,
    });
  });
});

describe("parseLines", () => {
  it("parses the user's real list shape", () => {
    const items = parseLines(
      "Bottom => top\nBack => strangle | arm bar\n\nTop => pinning: Around the outside, redirection\nLeg => inside and outside heel"
    );
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.position)).toEqual(["Bottom", "Back", "Top", "Leg"]);
  });
});

describe("itemTitle", () => {
  it("renders both shapes", () => {
    expect(itemTitle({ position: "Back", move: "strangle" })).toBe("Back → strangle");
    expect(itemTitle({ position: null, move: "shrimp drills" })).toBe("shrimp drills");
  });
});
