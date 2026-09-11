// Sync from the coach's sheets: fetch both CSVs, read them into a catalogue
// through the engine, replace sets and ranks in one transaction. The
// secret is checked before anything is fetched, so a wrong key costs no
// network. The URLs come from the environment (TEMPLATE_SHEET_GRAPH_CSV,
// TEMPLATE_SHEET_RANKS_CSV): a Google Sheet shared "anyone with the link"
// exports as https://docs.google.com/spreadsheets/d/<id>/export?format=csv.

import { parseCsv, rowsToCatalogue } from "../src/engine/sheet.js";
import { parseLines } from "../src/engine/parse.js";

export const sheetUrls = (env) => ({
  graph: env.TEMPLATE_SHEET_GRAPH_CSV || "",
  ranks: env.TEMPLATE_SHEET_RANKS_CSV || "",
});

export const defaultFetchText = async (url) => {
  const res = await fetch(url, { redirect: "follow", headers: { accept: "text/csv" } });
  if (!res.ok) throw new Error(`sheet fetch failed: ${res.status} from ${url}`);
  const text = await res.text();
  if (/^\s*<(!doctype|html)/i.test(text)) throw new Error(`sheet fetch failed: ${url} answered with a web page, not CSV — is the sheet shared with anyone who has the link?`);
  return text;
};

export async function syncFromSheets({ store, secret, urls, fetchText = defaultFetchText }) {
  store.check(secret);
  if (!urls.graph || !urls.ranks) throw new Error("sheet sync is not configured (TEMPLATE_SHEET_GRAPH_CSV and TEMPLATE_SHEET_RANKS_CSV)");
  const [graphText, ranksText] = await Promise.all([fetchText(urls.graph), fetchText(urls.ranks)]);
  const catalogue = rowsToCatalogue({ graph: parseCsv(graphText), ranks: parseCsv(ranksText) });
  await store.replaceCatalogue(secret, catalogue);
  const { templates, control } = catalogue;
  return {
    sets: templates.length,
    lines: templates.reduce((n, t) => n + parseLines(t.lines).length, 0),
    ranks: control.weak.length + control.strong.length + control.dominant.length,
  };
}
