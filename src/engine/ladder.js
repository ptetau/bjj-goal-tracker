// The ladder. The gym trains connections — strong ties like a front
// headlock or a body lock — and every item on a list is a step on the
// ladder, written "from => to". The rung falls out of the two ends:
//
//   Disconnected  => a connection          Make
//   a connection  => Hold (or itself)      Maintain
//   a connection  => another connection    Transition
//   a connection  => a finish              Profit (takedown, back, pin, submission)
//
// Disconnected comes in four shapes, because "one of us is down" is two
// different fights depending on who. Pure vocabulary and lookups: the
// engine never rejects a line it can't place — it calls that rung "other".
//
// The vocabulary says what CAN be a step. The graph (ladderGraph, below)
// says which steps the gym actually trains: the union of the coach's sets.
// The add sheet offers the graph; the vocabulary is what the text box
// falls back to.

import { parseLines } from "./parse.js";

export const DISCONNECTED = [
  { label: "Both standing", hint: "on the feet, no tie yet" },
  { label: "They're down", hint: "I'm standing over a grounded opponent" },
  { label: "I'm down", hint: "playing guard against a standing opponent" },
  { label: "Both down", hint: "both grounded, no tie yet" },
];

export const CONNECTIONS = [
  // standing ties
  "Collar tie",
  "Two-on-one",
  "Front headlock",
  "Body lock",
  "Rear body lock",
  "Single leg",
  "Underhook",
  "Double underhooks",
  // top ties
  "Seatbelt",
  "Gift wrap",
  "Crowbar",
  "Shoulder lever",
  "Cross face",
  // guard ties
  "Closed guard",
  "Knee shield",
  "Butterfly hooks",
  "K guard",
  "DLR hook",
  "RDLR hook",
  "Collar and sleeve",
  "Lasso",
  "Triangle hub",
  "Omoplata hub",
  // leg entanglements
  "Inside entanglement",
  "Outside entanglement",
  "Open entanglement",
  "Closed entanglement",
];

export const FINISHES = [
  { label: "Takedown", kind: "takedown" },
  { label: "Back", kind: "position" },
  { label: "Mount", kind: "position" },
  { label: "Side control", kind: "position" },
  { label: "Five star side control", kind: "position" },
  { label: "Knee ride", kind: "position" },
  { label: "Guillotine", kind: "submission" },
  { label: "Marcelotine", kind: "submission" },
  { label: "Darce", kind: "submission" },
  { label: "Anaconda", kind: "submission" },
  { label: "Rear naked strangle", kind: "submission" },
  { label: "Collar strangle", kind: "submission" },
  { label: "Bow and arrow", kind: "submission" },
  { label: "Armbar", kind: "submission" },
  { label: "Triangle", kind: "submission" },
  { label: "Kimura", kind: "submission" },
  { label: "Americana", kind: "submission" },
  { label: "Omoplata", kind: "submission" },
  { label: "Heel hook", kind: "submission" },
  { label: "Straight ankle lock", kind: "submission" },
  { label: "Kneebar", kind: "submission" },
  { label: "Wrist lock", kind: "submission" },
];

export const HOLD = "Hold";

// How much control a connection gives, so a step can be read as up, level
// or down. Weak ties you get to from neutral; strong ties decide the
// exchange (the gym scores a takedown from a strong tie double); dominant
// ties are a finish waiting to happen. Disconnected sits below all of them;
// a finish is not a rank but a phase change. One table, easy to argue with.
export const CONTROL = {
  weak: ["Collar tie", "Two-on-one", "Underhook", "Collar and sleeve", "Lasso", "DLR hook", "RDLR hook", "Butterfly hooks", "K guard", "Knee shield", "Open entanglement", "Cross face"],
  strong: ["Front headlock", "Body lock", "Single leg", "Double underhooks", "Closed guard", "Inside entanglement", "Outside entanglement", "Closed entanglement", "Triangle hub", "Omoplata hub"],
  dominant: ["Rear body lock", "Seatbelt", "Gift wrap", "Crowbar", "Shoulder lever"],
};

export const RUNGS = [
  { key: "make", label: "Make", blurb: "from disconnected to a connection" },
  { key: "maintain", label: "Maintain", blurb: "hold the connection" },
  { key: "transition", label: "Transition", blurb: "one connection to another" },
  { key: "profit", label: "Profit", blurb: "takedown, back, pin or submission" },
  { key: "other", label: "Off the ladder", blurb: "an end we don't recognise" },
];

const norm = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ");
const DIS = new Set(DISCONNECTED.map((d) => norm(d.label)));
const CON = new Set(CONNECTIONS.map(norm));
const FIN = new Set(FINISHES.map((f) => norm(f.label)));

// The shipped table is the default; the coach's synced table (same shape)
// replaces it wherever a caller passes one. Maps are cached per table.
const RANKS = new WeakMap();
function rankOf(control) {
  let m = RANKS.get(control);
  if (!m) {
    m = new Map([
      ...(control.weak ?? []).map((c) => [norm(c), 1]),
      ...(control.strong ?? []).map((c) => [norm(c), 2]),
      ...(control.dominant ?? []).map((c) => [norm(c), 3]),
    ]);
    RANKS.set(control, m);
  }
  return m;
}

export const isDisconnected = (s) => DIS.has(norm(s));
export const isConnection = (s) => CON.has(norm(s));
export const isFinish = (s) => FIN.has(norm(s));
export const isHold = (s) => norm(s) === norm(HOLD);

// A destination may carry a name: "Body lock => Takedown => Ko soto gari"
// parses to move "Takedown → Ko soto gari". The first part is the step on
// the ladder; the rest is what the gym calls it.
export function splitMove(move) {
  const [to, ...rest] = String(move ?? "").split(" → ");
  return { to: to.trim(), label: rest.length ? rest.join(" → ").trim() : null };
}

export function rungOf(from, move) {
  const { to } = splitMove(move);
  if (!from) return "other";
  if (isDisconnected(from)) return isFinish(to) ? "profit" : "make";
  if (isHold(to) || norm(to) === norm(from)) return "maintain";
  if (isFinish(to)) return "profit";
  if (isConnection(to)) return "transition";
  return "other";
}

// 0 disconnected, 1 weak, 2 strong, 3 dominant, 4 a finish; null unknown.
export function controlOf(name, control = CONTROL) {
  if (isDisconnected(name)) return 0;
  if (isFinish(name)) return 4;
  return rankOf(control ?? CONTROL).get(norm(name)) ?? null;
}

// The step read as control: up, level, down, a phase change, a hold — or
// other when an end is unknown.
export function climbOf(from, move, control = CONTROL) {
  const { to } = splitMove(move);
  if (isHold(to) || (from && norm(to) === norm(from))) return "hold";
  const a = controlOf(from, control), b = controlOf(to, control);
  if (a === null || b === null) return "other";
  if (b === 4) return "phase";
  return b > a ? "up" : b < a ? "down" : "level";
}

export const CLIMBS = [
  { key: "hold", label: "Hold it" },
  { key: "up", label: "Better connection" },
  { key: "level", label: "Similar connection" },
  { key: "down", label: "Less control" },
  { key: "phase", label: "Phase change" },
  { key: "other", label: "Off the ladder" },
];

// What the second tap offers once the first has picked a "from".
export function toOptions(from) {
  if (isDisconnected(from)) return CONNECTIONS.map((to) => ({ to, rung: "make" }));
  if (isConnection(from)) {
    const f = norm(from);
    return [
      { to: HOLD, rung: "maintain" },
      ...CONNECTIONS.filter((c) => norm(c) !== f).map((to) => ({ to, rung: "transition" })),
      ...FINISHES.map((x) => ({ to: x.label, rung: "profit", kind: x.kind })),
    ];
  }
  return [];
}

// The graph we built: every "from => to" across the given sets, deduped,
// each edge carrying its rung, its climb and the first target the sets gave
// it; a named step ("=> Takedown => Ko soto gari") is its own edge beside
// the plain one. Edges come in climb order (hold, up, level, down, phase),
// then by first appearance; froms come disconnected shapes first (those with an edge, in
// the ladder's order), then connections by first appearance — so the
// coach's sets are the one place the gym's map lives. Climbs are read
// against the control table given (the coach's synced ranks) or the shipped one.
export function ladderGraph(templates, control = CONTROL) {
  const edges = new Map();
  const seen = new Set();
  for (const t of templates) {
    for (const p of parseLines(t.lines)) {
      if (!p.position) continue;
      const key = `${norm(p.position)}→${norm(p.move)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!edges.has(p.position)) edges.set(p.position, []);
      const { to, label } = splitMove(p.move);
      edges.get(p.position).push({
        to,
        label,
        move: p.move,
        rung: rungOf(p.position, p.move),
        climb: climbOf(p.position, p.move, control),
        target: p.target,
      });
    }
  }
  const climbIndex = (c) => CLIMBS.findIndex((x) => x.key === c);
  for (const list of edges.values()) list.sort((a, b) => climbIndex(a.climb) - climbIndex(b.climb));
  const disIndex = (f) => DISCONNECTED.findIndex((d) => norm(d.label) === norm(f));
  const froms = [...edges.keys()].sort((a, b) => {
    const da = isDisconnected(a), db = isDisconnected(b);
    if (da !== db) return da ? -1 : 1;
    return da ? disIndex(a) - disIndex(b) : 0;
  });
  return { froms, edges };
}
