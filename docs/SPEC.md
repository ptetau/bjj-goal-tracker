# TOKUI — product & technical spec

The record of the decisions behind the app, as clarified with its owner.
Milestone 1 (this repo's current state) implements the offline core; the
rest is the committed direction, not speculation.

## What it is

A single gym's mission tracker. A coach or student writes **mission lists**
of jiu-jitsu items; students tally **attempts and hits** per item during
rolling sessions, with notes; sharpness and progress are visualized for
student and coach both.

## Decisions

### Product

| Question | Decision |
| --- | --- |
| Audience | One gym per deployment. Coaches see all students; students see their own data plus lists shared with them. |
| List kinds | **tokui** (exploit — stay sharp) and **growth** (explore) as one model; any item may carry a cumulative target (`x50`). |
| Item shape | Semi-structured: `Position => move` parses for grouping/UX, but any line is accepted verbatim. Colons don't split; arrows do. |
| Authoring | Text-first: type or paste lines, the parser does the rest. |
| Capture | Live tally is primary; sessions stay editable after (± steppers, notes). Manual past sessions allowed. Sessions are freeform — several per day. |
| Tap semantics | Two zones per item: **TRY** (attempted, no finish) and **HIT** (finished — implies the attempt). Rate = hits ÷ (tries + hits). |
| Ergonomics | Giant undo-last-tap with label; haptic (Android) + visual flash on every count; live mode never demands re-auth. No wake lock. |
| Sharpness | Consistency over a **21-day calendar window**, every session equal weight — legible over smooth. Cells show hits *and* tries; tokui rows lead with hit-consistency, growth rows with try-consistency. Empty window shows "no data", not 0%. |
| Targets | Met target → celebrate → explicit choice: next lap or retire. Laps count on (lap 2 of x50 = hits 51–100). Changing a target resets laps. |
| Lifecycle | Items/lists retire or archive, never silently delete; renames keep ids so history follows the item. Sessions can be deleted. |
| Timeline | Calendar-first: month grid with intensity dots, day drill-down, Mon–Sun streaks with an in-progress-week grace. |
| Roles (M2) | Students share a list to a coach or training partner as read/comment/edit. Coaches assign lists; students accept and can archive. Comments attach to **lists and items** (not sessions). |
| Onboarding (M2) | Signup gated by a gym passphrase; coach role via an email allowlist (env/config). |
| Waza picker | ✅ New users can also compose a personal tokui list technique-by-technique: the catalogue derives from the template sets (deduplicated, grouped by position, so coach edits flow through), Fundamentals items arrive pre-checked as the default missions, and creating serializes picks back to authoring lines (`toLine`, round-trip tested). |
| Starter sets | ✅ A template picker on the empty Missions tab (and behind "browse mission sets") offers 16 curated sets — fundamentals, back attack, leg entanglement, pressure passing, the guard curriculum (closed/half/X/SLX/lasso/DLR/RDLR/collar-sleeve), loose/tight passing, standing, triangle hub. Tokui sets target finishes (x25); growth sets target everything x50 by default. Templates are **coach-owned by design**: served from Postgres (`GET /api/templates`, seeded from shipped defaults), replaced wholesale with the `TEMPLATE_ADMIN_SECRET` (`PUT` with `x-template-secret`); offline or db-less, the shipped defaults stand. |

### Technical

| Question | Decision |
| --- | --- |
| Build order | M1: offline core ✅ → **M2.1: device sync ✅ (anonymous trackers)** → M2.2: accounts → M2.3: coach layer. |
| Offline | Installable PWA; taps land locally and instantly. |
| State | Everything is an **action log**: `{id, type, payload, at}` folded through a pure engine (no Date, no randomness). Action ids are `<deviceId>-<counter>`; created entities derive ids from them, so devices can't collide. |
| Sync | ✅ Action-log sync: clients queue the same actions offline; the referee (`server/referee.js`, one endpoint at `/api/sync`) replays them through the same engine into an append-only **Postgres** log, idempotent by action id, per-tracker serialized. Pre-auth, a "tracker" is named by a sync code (`trackerId.secret`) carried between devices; M2.2 accounts absorb it. Rejected actions (engine says no against server truth) are named and dropped client-side. |
| Auth (M2) | **Passkey** primary, **magic-link email** fallback/enrollment (one transactional-email provider, e.g. Resend; dev fallback prints the link). |
| Hosting | Static PWA now (Vercel config included); M2 adds `api/` serverless functions in the same deploy. |

## Milestone 2 sketch

- `api/` — one serverless action endpoint (`POST /api/actions` appends +
  folds; `GET` returns state/log since a cursor) plus auth routes
  (WebAuthn challenge/verify, magic-link issue/consume).
- Postgres tables: `users`, `credentials`, `lists`, `list_shares`,
  `assignments`, `comments`, `actions` (the log, per owner), with folded
  snapshots cached.
- The client's `src/app/store.js` grows a queue: actions append locally,
  flush when online, reconcile by replaying server truth + unacked local
  actions.
- Coach roster view; share/assign/accept/archive flows; comment threads on
  lists and items.

## Open micro-decisions (flagged, not blocking)

- Whether the grid's session columns cap at N with horizontal scroll beyond
  (currently: all window sessions scroll).
- Passphrase rotation UX for M2.
- Whether a coach's own training uses the same student-style account (assumed yes).
