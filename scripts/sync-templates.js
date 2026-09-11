// Ask a running server to pull the coach's sheets into its catalogue —
// the same thing the "Sync from sheets" key in Missions does, from a
// terminal. The server needs the two CSV links in its environment
// (TEMPLATE_SHEET_GRAPH_CSV, TEMPLATE_SHEET_RANKS_CSV); this script needs
// the key:
//
//   TEMPLATE_ADMIN_SECRET=… APP_URL=https://your-app node scripts/sync-templates.js

const url = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/templates`;
const secret = process.env.TEMPLATE_ADMIN_SECRET;
if (!secret) {
  console.error("TEMPLATE_ADMIN_SECRET is not set — the server refuses a sync without it.");
  process.exit(1);
}
const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json", "x-template-secret": secret },
  body: JSON.stringify({ op: "sync" }),
});
const body = await res.text();
if (!res.ok) {
  console.error(`${res.status} from ${url}: ${body}`);
  process.exit(1);
}
const { synced } = JSON.parse(body);
console.log(`${url} synced ${synced.sets} sets (${synced.lines} lines) and ${synced.ranks} ranks from the sheets.`);
