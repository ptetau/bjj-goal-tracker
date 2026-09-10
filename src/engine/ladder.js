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

export const isDisconnected = (s) => DIS.has(norm(s));
export const isConnection = (s) => CON.has(norm(s));
export const isFinish = (s) => FIN.has(norm(s));
export const isHold = (s) => norm(s) === norm(HOLD);

export function rungOf(from, to) {
  if (!from) return "other";
  if (isDisconnected(from)) return isFinish(to) ? "profit" : "make";
  if (isHold(to) || norm(to) === norm(from)) return "maintain";
  if (isFinish(to)) return "profit";
  if (isConnection(to)) return "transition";
  return "other";
}

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
