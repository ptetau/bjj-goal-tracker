// Starter mission sets — the catalogue a new user picks from on an empty
// Missions tab. Pure data in the exact authoring format the parser reads,
// shared by the client (offline fallback) and the server store (seed +
// coach-owned truth). Conventions, per the spec: tokui sets target the
// finishes (x25); growth sets target everything high (x50) — on a growth
// list, fifty of the new thing is the whole point.

import { parseLines } from "./parse.js";

// The waza catalogue behind the picker: every technique across the template
// sets, grouped by position and deduplicated, remembering which sets it
// came from. Fundamentals items are the pre-checked default selection —
// the "default missions" a brand-new user can accept with one tap.
export function wazaCatalogue(templates) {
  const groups = [];
  const byPosition = new Map();
  const seen = new Map();
  for (const t of templates) {
    for (const p of parseLines(t.lines)) {
      const key = `${p.position ?? ""}→${p.move}`.toLowerCase();
      let item = seen.get(key);
      if (!item) {
        item = { position: p.position, move: p.move, target: p.target, sources: [], recommended: false };
        seen.set(key, item);
        const label = p.position ?? "Other";
        if (!byPosition.has(label)) {
          byPosition.set(label, { position: p.position, label, items: [] });
          groups.push(byPosition.get(label));
        }
        byPosition.get(label).items.push(item);
      }
      if (!item.sources.includes(t.name)) item.sources.push(t.name);
      if (item.target === null && p.target !== null) item.target = p.target;
      if (t.key === "fundamentals") item.recommended = true;
    }
  }
  return groups;
}

export const DEFAULT_TEMPLATES = [
  {
    key: "fundamentals",
    name: "Fundamentals",
    type: "tokui",
    lines: `Bottom => frame and shrimp escape
Mount bottom => trap and roll x25
Closed guard => break posture and climb
Bottom => technical stand up x25
Top => knee on belly control
Mount => cross collar strangle x25`,
  },
  {
    key: "back-attack",
    name: "Back attack system",
    type: "tokui",
    lines: `Bottom => sweep to back
Top => back take
Back => strangle | arm bar x50
Back => arm trap | reverse triangle x25
Mount => strangle | arm bar x25
Turtle => seatbelt to hooks`,
  },
  {
    key: "leg-entanglement",
    name: "Leg entanglement game",
    type: "growth",
    lines: `Bottom => leg entanglement entry x50
Top => leg entangle x50
Leg => inside heel x50
Leg => outside heel x50
Leg => Mateusz footlock x50
Leg => backside 50/50 transition x50`,
  },
  {
    key: "pressure-pass",
    name: "Pressure pass & pin",
    type: "tokui",
    lines: `Top => pinning: around the outside redirection
Top => pinning: tight weight and balance
Top => body lock pass x25
Side control => transition to mount x25
Mount => hold through three escapes
Top => knee cut x25`,
  },
  {
    key: "closed-guard",
    name: "Closed guard",
    type: "tokui",
    lines: `Closed guard => break posture and keep it
Closed guard => arm bar x25
Closed guard => triangle x25
Closed guard => hip bump sweep x25
Closed guard => flower sweep x25
Closed guard => back take`,
  },
  {
    key: "half-guard",
    name: "Half guard",
    type: "tokui",
    lines: `Half guard => knee shield frames
Half guard => underhook to dogfight
Half guard => old school sweep x25
Half guard => back take x25
Half guard => electric chair entry`,
  },
  {
    key: "x-guard",
    name: "X-guard",
    type: "growth",
    lines: `Bottom => x-guard entry x50
X-guard => technical stand up sweep x50
X-guard => off balance to single leg x50
X-guard => transition to SLX x50`,
  },
  {
    key: "slx",
    name: "Single leg X",
    type: "growth",
    lines: `Bottom => SLX entry x50
SLX => sweep x50
SLX => transition to x-guard x50
SLX => straight ankle lock x50`,
  },
  {
    key: "lasso",
    name: "Lasso guard",
    type: "growth",
    lines: `Guard => lasso grip entry x50
Lasso => omoplata x50
Lasso => triangle x50
Lasso => balloon sweep x50`,
  },
  {
    key: "dlr",
    name: "De la Riva",
    type: "growth",
    lines: `Guard => DLR hook entry x50
DLR => berimbolo to back x50
DLR => sweep to single leg x50
DLR => kiss of the dragon x50`,
  },
  {
    key: "rdlr",
    name: "Reverse De la Riva",
    type: "growth",
    lines: `Guard => RDLR entry x50
RDLR => back take x50
RDLR => sweep x50
RDLR => kneebar entry x50`,
  },
  {
    key: "collar-sleeve",
    name: "Collar sleeve guard",
    type: "growth",
    lines: `Guard => collar sleeve grips x50
Collar sleeve => triangle x50
Collar sleeve => omoplata x50
Collar sleeve => balloon sweep x50`,
  },
  {
    key: "loose-passing",
    name: "Loose passing",
    type: "tokui",
    lines: `Top => toreando pass x25
Top => leg drag x25
Top => long step x25
Top => shin pin to knee cut x25
Top => recover distance when framed`,
  },
  {
    key: "tight-passing",
    name: "Tight passing",
    type: "tokui",
    lines: `Top => body lock pass x25
Top => over under pass x25
Top => half guard knee cut x25
Top => smash pass to mount x25
Top => kill the knee shield`,
  },
  {
    key: "standing",
    name: "Standing game",
    type: "tokui",
    lines: `Standing => collar sleeve grip fighting
Standing => over under clinch
Standing => two on one control
Standing => snap down to front headlock x25
Standing => single leg finish x25`,
  },
  {
    key: "triangle-hub",
    name: "Triangle hub",
    type: "growth",
    lines: `Closed guard => triangle entry x50
Mount => triangle transition x50
Back => reverse triangle x50
Triangle => cut the angle and finish x50
Triangle => switch to arm bar x50
Triangle => sweep when stalled x50`,
  },
];
