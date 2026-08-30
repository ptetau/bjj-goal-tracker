// The mission-list line parser. A schema exists for UX reasons, but a user
// can write anything: lines that parse gain a position for grouping; lines
// that don't are kept whole as free-form items. Nothing is ever rejected.
//
//   Back => strangle | arm bar        position "Back", move "strangle | arm bar"
//   Bottom -> top x50                 ...with a cumulative target of 50
//   shrimp to knees                   free-form: no position, move is the line
//
// Only arrow forms split position from move ("=>", "->", "→"). A colon does
// not — real lists write "Top => pinning: tight weight and balance".

const ARROW = /\s*(?:=>|->|→)\s*/;
const TARGET = /\s*[x×*]\s*(\d+)\s*$/i;

// One line -> { position, move, target }. `position` is null for free-form
// lines; `target` is null unless an xN suffix is present.
export function parseLine(raw) {
  let line = String(raw).trim();
  if (!line) return null;

  // A target is a *suffix* — a bare "x50" line is just text, not a target
  // hanging off nothing.
  let target = null;
  const t = line.match(TARGET);
  if (t) {
    const rest = line.slice(0, t.index).trim();
    const n = parseInt(t[1], 10);
    if (rest && n >= 1) {
      target = n;
      line = rest;
    }
  }

  const parts = line.split(ARROW);
  if (parts.length >= 2 && parts[0].trim()) {
    const position = parts[0].trim();
    const move = parts.slice(1).join(" → ").trim();
    if (move) return { position, move, target };
  }
  return { position: null, move: line, target };
}

export const parseLines = (text) =>
  String(text)
    .split("\n")
    .map(parseLine)
    .filter(Boolean);

// How an item reads everywhere in the UI.
export const itemTitle = (item) =>
  item.position ? `${item.position} → ${item.move}` : item.move;

// The inverse of parseLine for arrow-free content: what the waza picker
// creates is exactly what typing the line would have created.
export const toLine = ({ position, move, target }) =>
  `${position ? `${position} => ` : ""}${move}${target ? ` x${target}` : ""}`;
