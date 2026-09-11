// The coach's sheets are the admin backend: one sheet holds the graph (one
// row per step of every set), one holds the connection ranks. The engine
// reads rows into a catalogue and writes a catalogue back out to rows; the
// server does the fetching. Derived columns (rung, control change) are
// written for the coach to read and ignored on the way back in.

import { describe, expect, it } from "vitest";
import { catalogueToRows, parseCsv, rowsToCatalogue, toCsv } from "../src/engine/sheet.js";
import { DEFAULT_TEMPLATES } from "../src/engine/templates.js";
import { CONTROL } from "../src/engine/ladder.js";

describe("parseCsv", () => {
  it("reads plain rows, quoted cells, embedded commas, quotes and newlines, CRLF", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv('"Set","Kind"\r\n"Fundamentals","tokui"\r\n')).toEqual([["Set", "Kind"], ["Fundamentals", "tokui"]]);
    expect(parseCsv('x,"a, b","say ""hi""","two\nlines"')).toEqual([["x", "a, b", 'say "hi"', "two\nlines"]]);
  });

  it("keeps empty cells and drops a trailing empty line only", () => {
    expect(parseCsv("a,,c\n,,\n")).toEqual([["a", "", "c"], ["", "", ""]]);
    expect(parseCsv("")).toEqual([]);
  });

  it("round-trips what toCsv writes", () => {
    const rows = [["Set", "Note"], ["Body lock", 'the "big" one, standing\nsecond line']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

const GRAPH = [
  ["Set", "Kind", "From", "To", "Name", "Target", "Rung", "Control change"],
  ["Fundamentals", "tokui", "Both standing", "Collar tie", "", "", "make", "up"],
  ["Fundamentals", "tokui", "Front headlock", "Takedown", "", "25", "profit", "phase"],
  ["Fundamentals", "tokui", "Closed guard", "Hold", "", "", "", ""],
  ["Fundamentals", "tokui", "Closed guard", "Armbar", "", "25", "", ""],
  ["Body lock", "tokui", "Body lock", "Takedown", "Ko soto gari", "25", "", ""],
  ["Body lock", "tokui", "Body lock", "Hold", "", "", "", ""],
  ["Body lock", "tokui", "Body lock", "Rear body lock", "", "", "", ""],
  ["Body lock", "tokui", "Rear body lock", "Back", "", "25", "", ""],
  ["De la Riva", "kaizen", "I'm down", "DLR hook", "", "50", "", ""],
  ["De la Riva", "kaizen", "DLR hook", "Hold", "", "50", "", ""],
  ["De la Riva", "kaizen", "DLR hook", "Seatbelt", "", "50", "", ""],
  ["De la Riva", "kaizen", "DLR hook", "Mount", "", "50", "", ""],
];
const RANKS = [
  ["Connection", "Rank (weak / strong / dominant)", "Notes"],
  ["Collar tie", "weak", ""],
  ["Front headlock", "Strong", "decides the exchange"],
  ["Rear body lock", "dominant", ""],
];

describe("rowsToCatalogue", () => {
  it("turns graph rows into sets in sheet order, kaizen meaning the growth list", () => {
    const { templates } = rowsToCatalogue({ graph: GRAPH, ranks: RANKS });
    expect(templates.map((t) => [t.key, t.name, t.type])).toEqual([
      ["fundamentals", "Fundamentals", "tokui"],
      ["body-lock", "Body lock", "tokui"],
      ["de-la-riva", "De la Riva", "growth"],
    ]);
    expect(templates[0].lines).toBe("Both standing => Collar tie\nFront headlock => Takedown x25\nClosed guard => Hold\nClosed guard => Armbar x25");
    expect(templates[1].lines.split("\n")[0]).toBe("Body lock => Takedown => Ko soto gari x25");
    expect(templates[2].lines.split("\n")[0]).toBe("I'm down => DLR hook x50");
  });

  it("reads ranks by the first word of the header, any case, and ignores notes", () => {
    const { control } = rowsToCatalogue({ graph: GRAPH, ranks: RANKS });
    expect(control).toEqual({ weak: ["Collar tie"], strong: ["Front headlock"], dominant: ["Rear body lock"] });
  });

  it("finds columns by header, not position, and ignores extra or derived columns", () => {
    const shuffled = [
      ["Target", "Rung", "To", "From", "Kind", "Set", "Coach note"],
      ["25", "nonsense", "Darce", "Front headlock", "tokui", "Front headlock", "squeeze"],
    ];
    const { templates } = rowsToCatalogue({ graph: shuffled, ranks: RANKS });
    expect(templates).toEqual([{ key: "front-headlock", name: "Front headlock", type: "tokui", lines: "Front headlock => Darce x25" }]);
  });

  it("skips blank rows and trims cells", () => {
    const rows = [GRAPH[0], ["", "", "", "", "", "", "", ""], [" Fundamentals ", " tokui", "Both standing ", " Collar tie", "", " ", "", ""]];
    const { templates } = rowsToCatalogue({ graph: rows, ranks: RANKS });
    expect(templates).toEqual([{ key: "fundamentals", name: "Fundamentals", type: "tokui", lines: "Both standing => Collar tie" }]);
  });

  it("names the row of anything it cannot read", () => {
    const bad = (rows) => () => rowsToCatalogue({ graph: rows, ranks: RANKS });
    expect(bad([["Set", "Kind", "From"]])).toThrow(/graph sheet: missing column To/);
    expect(bad([GRAPH[0], ["Fundamentals", "cardio", "Both standing", "Collar tie", "", "", "", ""]])).toThrow(/graph row 2: kind "cardio"/);
    expect(bad([GRAPH[0], ["Fundamentals", "tokui", "", "Collar tie", "", "", "", ""]])).toThrow(/graph row 2: From is empty/);
    expect(bad([GRAPH[0], ["Fundamentals", "tokui", "Both standing", "", "", "", "", ""]])).toThrow(/graph row 2: To is empty/);
    expect(bad([GRAPH[0], ["Fundamentals", "tokui", "Both standing", "Collar tie", "", "lots", "", ""]])).toThrow(/graph row 2: target "lots"/);
    expect(bad([GRAPH[0], ["", "tokui", "Both standing", "Collar tie", "", "", "", ""]])).toThrow(/graph row 2: Set is empty/);
    expect(bad([GRAPH[0], ["A", "tokui", "Both standing", "Collar tie", "", "", "", ""], ["A", "kaizen", "I'm down", "DLR hook", "", "", "", ""]])).toThrow(/graph row 3: set "A" is tokui on row 2/);
    expect(() => rowsToCatalogue({ graph: GRAPH, ranks: [["Connection", "Rank"], ["Collar tie", "medium"]] })).toThrow(/ranks row 2: rank "medium"/);
    expect(() => rowsToCatalogue({ graph: GRAPH, ranks: [["Connection", "Notes"]] })).toThrow(/ranks sheet: missing column Rank/);
  });
});

describe("catalogueToRows", () => {
  it("writes one row per line with the derived rung and control change, and one row per rank", () => {
    const { graph, ranks } = catalogueToRows({ templates: DEFAULT_TEMPLATES.slice(0, 1), control: CONTROL });
    expect(graph[0]).toEqual(["Set", "Kind", "From", "To", "Name", "Target", "Rung", "Control change"]);
    expect(graph[1]).toEqual(["Fundamentals", "tokui", "Both standing", "Collar tie", "", "", "make", "up"]);
    expect(graph[3]).toEqual(["Fundamentals", "tokui", "Front headlock", "Takedown", "", "25", "profit", "phase"]);
    expect(ranks[0]).toEqual(["Connection", "Rank (weak / strong / dominant)"]);
    expect(ranks).toContainEqual(["Front headlock", "strong"]);
    expect(ranks).toHaveLength(1 + CONTROL.weak.length + CONTROL.strong.length + CONTROL.dominant.length);
  });

  it("round-trips the shipped catalogue, keys included", () => {
    const cat = { templates: DEFAULT_TEMPLATES, control: CONTROL };
    const back = rowsToCatalogue(catalogueToRows(cat));
    expect(back.templates.map((t) => [t.name, t.type, t.lines])).toEqual(DEFAULT_TEMPLATES.map((t) => [t.name, t.type, t.lines]));
    expect(back.control).toEqual(CONTROL);
  });
});
