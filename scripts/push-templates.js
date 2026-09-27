// Push catalogue.json — the coach's sets and connection ranks — to a
// running server, replacing what its database holds. The server seeds
// itself only once, when its table is empty, so after the file changes a
// deployment keeps serving the old catalogue until this replaces it:
//
//   TEMPLATE_ADMIN_SECRET=… APP_URL=https://your-app npm run templates:push

import { DEFAULT_TEMPLATES } from "../src/engine/templates.js";
import { CONTROL } from "../src/engine/ladder.js";

const url = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/templates`;
const secret = process.env.TEMPLATE_ADMIN_SECRET;
if (!secret) {
  console.error("TEMPLATE_ADMIN_SECRET is not set — the server refuses replacements without it.");
  process.exit(1);
}
const res = await fetch(url, {
  method: "PUT",
  headers: { "content-type": "application/json", "x-template-secret": secret },
  body: JSON.stringify({ templates: DEFAULT_TEMPLATES, control: CONTROL }),
});
const body = await res.text();
if (!res.ok) {
  console.error(`${res.status} from ${url}: ${body}`);
  process.exit(1);
}
const { templates, control } = JSON.parse(body);
console.log(`${url} now serves ${templates.length} sets and ${control.weak.length + control.strong.length + control.dominant.length} ranks.`);
