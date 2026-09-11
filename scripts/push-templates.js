// Push the shipped starter sets to a running server, replacing what its
// database holds. The server seeds itself only once, when its table is
// empty — so after the sets change (say, from position-first lines to the
// ladder's "from => to"), a deployment keeps serving the old ones until
// the coach replaces them. This is that replacement:
//
//   TEMPLATE_ADMIN_SECRET=… APP_URL=https://your-app node scripts/push-templates.js

import { DEFAULT_TEMPLATES } from "../src/engine/templates.js";

const url = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/api/templates`;
const secret = process.env.TEMPLATE_ADMIN_SECRET;
if (!secret) {
  console.error("TEMPLATE_ADMIN_SECRET is not set — the server refuses replacements without it.");
  process.exit(1);
}
const res = await fetch(url, {
  method: "PUT",
  headers: { "content-type": "application/json", "x-template-secret": secret },
  body: JSON.stringify({ templates: DEFAULT_TEMPLATES }),
});
const body = await res.text();
if (!res.ok) {
  console.error(`${res.status} from ${url}: ${body}`);
  process.exit(1);
}
console.log(`${url} now serves ${JSON.parse(body).templates.length} sets.`);
