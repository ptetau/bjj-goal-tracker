// The ladder: every item is "from => to", and the rung falls out of the two
// ends. Disconnected (four shapes) to a connection is Make; a connection
// held is Maintain; a connection to another connection is Transition; a
// connection to a finish (takedown, back, pin, submission) is Profit.

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { CONNECTIONS, DISCONNECTED, FINISHES, RUNGS, rungOf, toOptions } from "../src/engine/ladder.js";
import { parseLine } from "../src/engine/parse.js";

describe("the ladder vocabulary", () => {
  it("has four disconnected shapes, four rungs in order, and no overlaps", () => {
    expect(DISCONNECTED.map((d) => d.label)).toEqual(["Both standing", "They're down", "I'm down", "Both down"]);
    expect(RUNGS.map((r) => r.key)).toEqual(["make", "maintain", "transition", "profit", "other"]);
    const all = [...DISCONNECTED.map((d) => d.label), ...CONNECTIONS, ...FINISHES.map((f) => f.label)];
    expect(new Set(all.map((x) => x.toLowerCase())).size).toBe(all.length);
    expect(CONNECTIONS).toContain("Front headlock");
    expect(FINISHES.map((f) => f.kind)).toEqual(expect.arrayContaining(["takedown", "position", "submission"]));
  });
});

describe("rungOf(from, to)", () => {
  it("classifies the four rungs from your class notes", () => {
    expect(rungOf("Both standing", "Front headlock")).toBe("make");
    expect(rungOf("Body lock", "Hold")).toBe("maintain");
    expect(rungOf("Body lock", "Body lock")).toBe("maintain");
    expect(rungOf("Front headlock", "Rear body lock")).toBe("transition");
    expect(rungOf("Front headlock", "Darce")).toBe("profit");
    expect(rungOf("Single leg", "Takedown")).toBe("profit");
    expect(rungOf("Seatbelt", "Back")).toBe("profit");
  });

  it("ignores case, spacing and apostrophes", () => {
    expect(rungOf("  both STANDING ", "front  headlock")).toBe("make");
    expect(rungOf("They’re down", "Gift wrap")).toBe("make");
    expect(rungOf("front headlock", "HOLD")).toBe("maintain");
  });

  it("colours the old position-first lines where it can, and admits what it can't", () => {
    expect(rungOf("Closed guard", "Triangle")).toBe("profit"); // closed guard is a connection
    expect(rungOf("Both standing", "Takedown")).toBe("profit"); // skipping the ladder is still a finish
    expect(rungOf("Mount", "armbar")).toBe("profit"); // an unknown "from" with a known finish
    expect(rungOf("Mount", "cross collar strangle")).toBe("other"); // neither end known
    expect(rungOf("Front headlock", "snap to turtle")).toBe("other"); // a destination we don't know
    expect(rungOf(null, "shrimp drills")).toBe("other");
  });
});

describe("toOptions(from): what the second tap offers", () => {
  it("from disconnected, only connections (all makes)", () => {
    const opts = toOptions("Both standing");
    expect(opts.map((o) => o.to)).toEqual(CONNECTIONS);
    expect(new Set(opts.map((o) => o.rung))).toEqual(new Set(["make"]));
  });

  it("from a connection: hold it, every other connection, then every finish", () => {
    const opts = toOptions("Front headlock");
    expect(opts[0]).toEqual({ to: "Hold", rung: "maintain" });
    expect(opts.filter((o) => o.rung === "transition").map((o) => o.to)).toEqual(CONNECTIONS.filter((c) => c !== "Front headlock"));
    expect(opts.filter((o) => o.rung === "profit").map((o) => o.to)).toEqual(FINISHES.map((f) => f.label));
  });

  it("from nothing we know, nothing", () => {
    expect(toOptions("Quad pod")).toEqual([]);
    expect(toOptions(null)).toEqual([]);
  });

  it("every option it offers classifies to the rung it says, through a real line", () => {
    const froms = [...DISCONNECTED.map((d) => d.label), ...CONNECTIONS];
    fc.assert(
      fc.property(fc.nat({ max: froms.length - 1 }), fc.nat({ max: 999 }), (i, j) => {
        const from = froms[i];
        const opts = toOptions(from);
        const o = opts[j % opts.length];
        const p = parseLine(`${from} => ${o.to} x25`);
        expect(p.position).toBe(from);
        expect(rungOf(p.position, p.move)).toBe(o.rung);
      })
    );
  });
});

describe("ladderGraph(templates): the graph we built, as the sheet offers it", () => {
  it("offers, from a connection, only the edges the sets contain", async () => {
    const { ladderGraph } = await import("../src/engine/ladder.js");
    const { DEFAULT_TEMPLATES } = await import("../src/engine/templates.js");
    const g = ladderGraph(DEFAULT_TEMPLATES);
    const fhl = g.edges.get("Front headlock").map((e) => e.to);
    expect(fhl).toEqual(["Hold", "Rear body lock", "Takedown", "Guillotine", "Darce", "Anaconda"]);
    expect(fhl).not.toContain("Collar tie"); // every other connection is NOT offered
    expect(g.edges.get("Both standing").map((e) => e.to)).toEqual(["Collar tie", "Front headlock", "Body lock", "Single leg", "Two-on-one"]);
  });

  it("lists as froms only what has an edge, disconnected shapes first, in order of appearance", async () => {
    const { ladderGraph } = await import("../src/engine/ladder.js");
    const { DEFAULT_TEMPLATES } = await import("../src/engine/templates.js");
    const g = ladderGraph(DEFAULT_TEMPLATES);
    expect(g.froms.slice(0, 3)).toEqual(["Both standing", "They're down", "I'm down"]);
    expect(g.froms).not.toContain("Both down"); // no set starts there yet
    expect(g.froms).not.toContain("Wrist lock"); // a finish is never a from
    expect(g.froms).toContain("Omoplata hub");
    expect(new Set(g.froms).size).toBe(g.froms.length);
  });

  it("dedupes across sets, keeps the first target, and names each edge's rung", async () => {
    const { ladderGraph, rungOf } = await import("../src/engine/ladder.js");
    const { DEFAULT_TEMPLATES } = await import("../src/engine/templates.js");
    const g = ladderGraph(DEFAULT_TEMPLATES);
    const takedowns = g.edges.get("Front headlock").filter((e) => e.to === "Takedown");
    expect(takedowns).toHaveLength(1); // in "fundamentals", "front-headlock" and "standing"
    expect(takedowns[0].target).toBe(25);
    for (const [from, edges] of g.edges) for (const e of edges) expect(e.rung).toBe(rungOf(from, e.to));
  });

  it("is exactly the lines of the sets it was built from, for any subset of them", async () => {
    const { ladderGraph } = await import("../src/engine/ladder.js");
    const { DEFAULT_TEMPLATES } = await import("../src/engine/templates.js");
    const { parseLines } = await import("../src/engine/parse.js");
    fc.assert(
      fc.property(fc.subarray(DEFAULT_TEMPLATES), (sets) => {
        const g = ladderGraph(sets);
        const want = new Set(sets.flatMap((t) => parseLines(t.lines).map((p) => `${p.position}→${p.move}`.toLowerCase())));
        const got = new Set([...g.edges].flatMap(([from, es]) => es.map((e) => `${from}→${e.move}`.toLowerCase())));
        expect(got).toEqual(want);
        expect(new Set(g.froms)).toEqual(new Set([...g.edges.keys()]));
      })
    );
  });
});

describe("control: is the step up, level, or a phase change?", () => {
  it("ranks connections weak < strong < dominant, disconnected below, finishes as a phase", async () => {
    const { controlOf, climbOf } = await import("../src/engine/ladder.js");
    expect(controlOf("Both standing")).toBe(0);
    expect(controlOf("Collar tie")).toBe(1);
    expect(controlOf("Front headlock")).toBe(2);
    expect(controlOf("Rear body lock")).toBe(3);
    expect(controlOf("Darce")).toBe(4);
    expect(controlOf("quad pod")).toBe(null);
    expect(climbOf("Both standing", "Collar tie")).toBe("up");
    expect(climbOf("Collar tie", "Front headlock")).toBe("up");
    expect(climbOf("Front headlock", "Body lock")).toBe("level");
    expect(climbOf("Front headlock", "Collar tie")).toBe("down");
    expect(climbOf("Front headlock", "Takedown")).toBe("phase");
    expect(climbOf("Front headlock", "Hold")).toBe("hold");
    expect(climbOf("Front headlock", "snap to turtle")).toBe("other");
  });

  it("every connection in the vocabulary has a rank", async () => {
    const { CONNECTIONS, controlOf } = await import("../src/engine/ladder.js");
    for (const c of CONNECTIONS) expect([1, 2, 3], c).toContain(controlOf(c));
  });
});

describe("named steps: 'from => to => label'", () => {
  it("splits the label off the destination, and classifies by the destination", async () => {
    const { splitMove, rungOf, climbOf } = await import("../src/engine/ladder.js");
    const { parseLine } = await import("../src/engine/parse.js");
    const p = parseLine("Body lock => Takedown => Ko soto gari x25");
    expect(p.position).toBe("Body lock");
    expect(splitMove(p.move)).toEqual({ to: "Takedown", label: "Ko soto gari" });
    expect(splitMove("Darce")).toEqual({ to: "Darce", label: null });
    expect(rungOf(p.position, p.move)).toBe("profit");
    expect(climbOf(p.position, p.move)).toBe("phase");
  });

  it("the graph keeps labelled edges apart from the plain one, on the same destination", async () => {
    const { ladderGraph } = await import("../src/engine/ladder.js");
    const { DEFAULT_TEMPLATES } = await import("../src/engine/templates.js");
    const g = ladderGraph(DEFAULT_TEMPLATES);
    const bl = g.edges.get("Body lock").filter((e) => e.to === "Takedown");
    expect(bl.map((e) => e.label)).toEqual(expect.arrayContaining([null, "Ko soto gari", "Ouchi gari"]));
    for (const [from, es] of g.edges) for (const e of es) expect(["up", "level", "down", "phase", "hold"], `${from} => ${e.to}`).toContain(e.climb);
  });
});
