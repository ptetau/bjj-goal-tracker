// Accounts over HTTP. POST ops: request (email a login link), redeem (turn
// a link into a session + tracker credentials), whoami (validate a session).
// Mail goes through Resend when RESEND_API_KEY is set; without it the link
// is written to the server logs and the response says so — the operator can
// still fish it out, and nothing pretends an email was sent.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { makePgDb, pickDatabaseUrl } from "../server/db-pg.js";
import { makeReferee } from "../server/referee.js";
import { makeAuth } from "../server/auth.js";

const MAILED = Boolean(process.env.RESEND_API_KEY);

async function resendMailer(email, link) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || "TOKUI <onboarding@resend.dev>",
      to: email,
      subject: "Your TOKUI login link",
      text: `Tap to sign in: ${link}\n\nThe link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`,
    }),
  });
  if (!res.ok) throw new Error(`mail send failed (${res.status})`);
}

const logMailer = async (email, link) => console.log(`[auth] login link for ${email}: ${link}`);

let authPromise = null;

function getAuth() {
  if (!authPromise) {
    authPromise = (async () => {
      const url = pickDatabaseUrl(process.env);
      if (!url) throw new Error("no database");
      const pool = new pg.Pool({ connectionString: url, max: 3 });
      await pool.query(readFileSync(join(process.cwd(), "server", "schema.sql"), "utf8"));
      const db = makePgDb(pool);
      return makeAuth({
        db,
        referee: makeReferee(db),
        env: process.env,
        mailer: MAILED ? resendMailer : logMailer,
        now: () => new Date(),
      });
    })();
    authPromise.catch(() => (authPromise = null));
  }
  return authPromise;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  let auth;
  try {
    auth = await getAuth();
  } catch {
    return res.status(503).json({ error: "accounts unavailable — no database configured" });
  }
  try {
    const body = req.body || {};
    if (body.op === "request") {
      await auth.request(body);
      return res.status(200).json(
        MAILED
          ? { sent: true }
          : { sent: false, reason: "no email provider configured — the login link was written to the server logs" }
      );
    }
    if (body.op === "redeem") return res.status(200).json(await auth.redeem(body));
    if (body.op === "whoami") return res.status(200).json({ user: await auth.whoami(body.session) });
    return res.status(400).json({ error: "unknown op" });
  } catch (err) {
    const msg = String(err.message || err);
    if (/passphrase|email|invalid or expired/.test(msg)) return res.status(400).json({ error: msg });
    console.error("auth error:", err);
    return res.status(500).json({ error: "auth failed" });
  }
}
