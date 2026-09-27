// Starter sets — the coach's sets an empty kaizen slot offers. They live
// in catalogue.json, the admin file for now: the coach edits the JSON
// (one line per step, "from => to", see ladder.js) and `npm run
// templates:push` sends sets and ranks to the server whole. Every set is
// a kaizen set: tokui waza is yours to add, no presets. Every line
// targets x50 — on a kaizen list, fifty of the new thing is the whole
// point. Shared by the client (offline fallback) and the server store
// (seed + coach-owned truth).

import catalogue from "./catalogue.json" with { type: "json" };

export const DEFAULT_TEMPLATES = catalogue.templates.map((t) => ({
  key: t.key,
  name: t.name,
  type: t.type,
  lines: t.lines.join("\n"),
}));
