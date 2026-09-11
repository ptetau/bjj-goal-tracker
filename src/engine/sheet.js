// The coach's sheets are the admin backend. Two sheets, kept by hand:
//
//   the graph   Set, Kind, From, To, Name, Target   one row per step of every set
//   the ranks   Connection, Rank                    weak / strong / dominant
//
// This module is the pure half of the trip: rows -> catalogue (sets plus
// ranks, ready for the engine) and catalogue -> rows (with two derived
// columns, Rung and Control change, written for the coach to read and
// ignored on the way back in). Columns are found by header, so the coach
// can reorder them or add notes; blank rows are skipped; anything else the
// sheet can't say is an error naming the row. The server does the fetching.

import { parseLines } from "./parse.js";
import { climbOf, rungOf, splitMove } from "./ladder.js";

export const GRAPH_HEADER = ["Set", "Kind", "From", "To", "Name", "Target", "Rung", "Control change"];
export const RANKS_HEADER = ["Connection", "Rank (weak / strong / dominant)"];
const RANKS = ["weak", "strong", "dominant"];
// What the sheet calls a list kind, and what the engine calls it.
const KINDS = { tokui: "tokui", kaizen: "growth", growth: "growth" };
const SHEET_KIND = { tokui: "tokui", growth: "kaizen" };

// RFC 4180 as sheets export it: commas, double quotes doubled inside
// quotes, quoted cells may hold commas and newlines, CRLF or LF rows.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const quote = (v) => {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows) => rows.map((r) => r.map(quote).join(",")).join("\r\n") + (rows.length ? "\r\n" : "");

const slug = (name) =>
  String(name)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "set";

// Column index by the first word of the header, so "Rank (weak / strong /
// dominant)" and "rank" both find the ranks.
function columns(rows, sheet, required) {
  const header = rows[0] ?? [];
  const at = {};
  header.forEach((h, i) => {
    const key = String(h).trim().toLowerCase().split(/[\s(]/)[0];
    if (key && at[key] === undefined) at[key] = i;
  });
  for (const name of required) if (at[name.toLowerCase()] === undefined) throw new Error(`${sheet} sheet: missing column ${name}`);
  return at;
}
const cell = (row, i) => (i === undefined ? "" : String(row[i] ?? "").trim());
const blank = (row) => row.every((c) => String(c ?? "").trim() === "");

export function rowsToCatalogue({ graph, ranks }) {
  const g = columns(graph, "graph", ["Set", "Kind", "From", "To"]);
  const sets = new Map();
  graph.slice(1).forEach((row, i) => {
    if (blank(row)) return;
    const n = i + 2; // the sheet's row number, header being row 1
    const name = cell(row, g.set), kind = cell(row, g.kind).toLowerCase();
    const from = cell(row, g.from), to = cell(row, g.to), label = cell(row, g.name), target = cell(row, g.target);
    if (!name) throw new Error(`graph row ${n}: Set is empty`);
    if (!KINDS[kind]) throw new Error(`graph row ${n}: kind "${cell(row, g.kind)}" is not tokui or kaizen`);
    if (!from) throw new Error(`graph row ${n}: From is empty`);
    if (!to) throw new Error(`graph row ${n}: To is empty`);
    if (target && !/^\d+$/.test(target)) throw new Error(`graph row ${n}: target "${target}" is not a whole number`);
    const type = KINDS[kind];
    const key = slug(name);
    let set = sets.get(key);
    if (!set) sets.set(key, (set = { key, name, type, row: n, lines: [] }));
    else if (set.type !== type) throw new Error(`graph row ${n}: set "${name}" is ${SHEET_KIND[set.type]} on row ${set.row}, ${kind} here`);
    set.lines.push(`${from} => ${to}${label ? ` => ${label}` : ""}${target ? ` x${Number(target)}` : ""}`);
  });
  const r = columns(ranks, "ranks", ["Connection", "Rank"]);
  const control = { weak: [], strong: [], dominant: [] };
  ranks.slice(1).forEach((row, i) => {
    if (blank(row)) return;
    const n = i + 2;
    const name = cell(row, r.connection), rank = cell(row, r.rank).toLowerCase();
    if (!name) throw new Error(`ranks row ${n}: Connection is empty`);
    if (!RANKS.includes(rank)) throw new Error(`ranks row ${n}: rank "${cell(row, r.rank)}" is not weak, strong or dominant`);
    control[rank].push(name);
  });
  return {
    templates: [...sets.values()].map(({ key, name, type, lines }) => ({ key, name, type, lines: lines.join("\n") })),
    control,
  };
}

export function catalogueToRows({ templates, control }) {
  const graph = [GRAPH_HEADER];
  for (const t of templates)
    for (const p of parseLines(t.lines)) {
      const { to, label } = splitMove(p.move);
      graph.push([
        t.name,
        SHEET_KIND[t.type] ?? t.type,
        p.position ?? "",
        to,
        label ?? "",
        p.target ? String(p.target) : "",
        rungOf(p.position, p.move),
        climbOf(p.position, p.move, control),
      ]);
    }
  const ranks = [RANKS_HEADER];
  for (const rank of RANKS) for (const name of control?.[rank] ?? []) ranks.push([name, rank]);
  return { graph, ranks };
}
