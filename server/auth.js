// Magic-link accounts. Request a link with your email (plus the gym
// passphrase the first time — GYM_PASSPHRASE gates signup, not login);
// redeeming it creates or finds the account, flags coaches from
// COACH_EMAILS, and hands the device the account's tracker credentials, so
// sync works exactly as before with the code carried by the login instead
// of by hand. Time (`now`) and mail (`mailer`) are injected: tests drive
// every path; production wires Resend and the wall clock.

import crypto from "node:crypto";

const LINK_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const newToken = () => crypto.randomBytes(24).toString("base64url");
const sameSecret = (a, b) =>
  crypto.timingSafeEqual(
    crypto.createHash("sha256").update(String(a)).digest(),
    crypto.createHash("sha256").update(String(b)).digest()
  );

const normalizeEmail = (raw) => {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("that doesn't look like an email address");
  return email;
};

export function makeAuth({ db, referee, env, mailer, now }) {
  const coachEmails = new Set(
    (env.COACH_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );

  const findUser = (q, email) =>
    q("SELECT id, email, is_coach, tracker_id, tracker_secret FROM users WHERE email = $1", [email]);

  return {
    // Send (or hand to the injected mailer) a single-use login link.
    async request({ email: rawEmail, passphrase }) {
      const email = normalizeEmail(rawEmail);
      const existing = await db.tx((q) => findUser(q, email));
      if (existing.rows.length === 0 && env.GYM_PASSPHRASE) {
        if (!passphrase || !sameSecret(passphrase, env.GYM_PASSPHRASE))
          throw new Error("wrong gym passphrase");
      }
      const token = newToken();
      await db.tx((q) =>
        q("INSERT INTO login_tokens (token_hash, email, expires_at) VALUES ($1, $2, $3)", [
          sha256(token),
          email,
          new Date(now().getTime() + LINK_TTL_MS),
        ])
      );
      await mailer(email, `${env.APP_ORIGIN || ""}/?login=${token}`);
      return { sent: true };
    },

    // Turn a link into a signed-in device: a session token plus the
    // account's tracker credentials.
    async redeem({ token }) {
      const email = await db.tx(async (q) => {
        const r = await q(
          "UPDATE login_tokens SET used_at = $2 WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2 RETURNING email",
          [sha256(String(token)), now()]
        );
        if (r.rows.length === 0) throw new Error("login link invalid or expired");
        return r.rows[0].email;
      });

      const isCoach = coachEmails.has(email);
      let user = (await db.tx((q) => findUser(q, email))).rows[0];
      if (!user) {
        // referee.create runs its own transaction — never nest inside ours.
        const t = await referee.create();
        const id = crypto.randomBytes(8).toString("hex");
        await db.tx((q) =>
          q(
            "INSERT INTO users (id, email, is_coach, tracker_id, tracker_secret) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING",
            [id, email, isCoach, t.trackerId, t.secret]
          )
        );
        user = (await db.tx((q) => findUser(q, email))).rows[0];
      } else if (user.is_coach !== isCoach) {
        // The allowlist is live: promotion or demotion lands at next login.
        await db.tx((q) => q("UPDATE users SET is_coach = $2 WHERE id = $1", [user.id, isCoach]));
        user = { ...user, is_coach: isCoach };
      }

      const session = newToken();
      await db.tx((q) =>
        q("INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
          sha256(session),
          user.id,
          new Date(now().getTime() + SESSION_TTL_MS),
        ])
      );
      return {
        session,
        user: { email: user.email, isCoach: user.is_coach },
        tracker: { id: user.tracker_id, secret: user.tracker_secret },
      };
    },

    // Who holds this session token — null when unknown or expired.
    async whoami(session) {
      const r = await db.tx((q) =>
        q(
          `SELECT u.email, u.is_coach, u.tracker_id, u.tracker_secret
             FROM auth_sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = $1 AND s.expires_at > $2`,
          [sha256(String(session)), now()]
        )
      );
      const row = r.rows[0];
      return row
        ? { email: row.email, isCoach: row.is_coach, tracker: { id: row.tracker_id, secret: row.tracker_secret } }
        : null;
    },
  };
}
