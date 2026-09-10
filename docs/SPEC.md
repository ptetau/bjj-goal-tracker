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
| List kinds | **tokui** (exploit — stay sharp) and **growth** (explore, shown as "Kaizen") as one model; any item may carry a cumulative target (`x50`). |
| One short list each | You keep **one tokui list of at most 7 live items** — a submission, a guard, a sweep, a takedown, maybe one to three more — and **one kaizen list of at most 3**: more than that and you're working on nothing. The Missions tab has one slot per kind; a slot offers a way to make a list only while empty, and Add / restore go dark when the list is full. The cap is an engine query (`room`), honoured by the screens, not a rule the log enforces — a history that outgrew the cap still replays and simply shows "9 of 7". |
| Item shape | Semi-structured: `Position => move` parses for grouping/UX, but any line is accepted verbatim. Colons don't split; arrows do. |
| Authoring | Text-first: type or paste lines, the parser does the rest. |
| Capture | Live tally is primary; sessions stay editable after (± steppers, notes). Manual past sessions allowed. Sessions are freeform — several per day. |
| Tap semantics | Two zones per item: **TRY** (attempted, no finish) and **HIT** (finished — implies the attempt). Rate = hits ÷ (tries + hits). |
| Ergonomics | Giant undo-last-tap with label; haptic (Android) + visual flash on every count; live mode never demands re-auth. No wake lock. |
| Training mode | ✅ A rolling session takes the whole screen, styled as a drum machine: one fat pad per live item (tap = one hit), a latching TRY key that makes pad taps count attempts instead, two banks you swipe between or pick with A/B keys — A is the tokui list, B ("Kaizen") the growth list; both are always there, and an empty one says what it's for and sends you to Missions to fill it — a display echoing the last tap, and one UNDO for whatever the last tap was. MENU leaves the pads with the session still rolling; END closes it and opens the editor. No masthead, no tabs, nothing that needs precision. |
| Sharpness | Consistency over a **21-day calendar window**, every session equal weight — legible over smooth. Cells show hits *and* tries; tokui rows lead with hit-consistency, growth rows with try-consistency. Empty window shows "no data", not 0%. |
| Targets | Met target → celebrate → explicit choice: next lap or retire. Laps count on (lap 2 of x50 = hits 51–100). Changing a target resets laps. |
| Lifecycle | Items/lists retire or archive, never silently delete; renames keep ids so history follows the item. Sessions can be deleted. |
| Timeline | Calendar-first: month grid with intensity dots, day drill-down, Mon–Sun streaks with an in-progress-week grace. |
| Roles (M2) | Students share a list to a coach or training partner as read/comment/edit. Coaches assign lists; students accept and can archive. Comments attach to **lists and items** (not sessions). |
| Onboarding (M2) | Signup gated by a gym passphrase; coach role via an email allowlist (env/config). |
| Entry: two taps | ✅ Each slot has a rail of positions (from the template catalogue, so coach edits flow through) and, under it, that position's moves. Tap position, tap move, and the line is written for you — `Closed guard => triangle x25` — the first tap creating the list, later taps adding to it. A target key (none / x25 / x50) sticks between taps; tokui defaults to x25, kaizen to x50. A move that isn't in the catalogue is typed in a box that suggests as you go. Chips of moves already on the list go dark. Empty slots also offer the coach's sets, trimmed to the cap. |
| Editing: the grid | ✅ Each item is one editable row: tap the position pill to pick another position (or free-form), type the move with the catalogue suggesting, tap the target to cycle none → x25 → x50 (a change restarts laps, as targets always have), × retires. Ids never change, so history follows the edit. |
| Colour by family | ✅ Positions are coloured by family — standing, guard & bottom, top & passing, mount/back/turtle, legs, other — on the rail, the chips, the pills, and the rows' left band, with a key at the top of the tab. `familyOf` in the engine is the one place the grouping lives. |
| Starter sets | ✅ 16 curated sets feed the waza picker — as its catalogue, and as presets a "Start from a set" chip loads (trimmed to the cap); a set no longer becomes a list of its own — fundamentals, back attack, leg entanglement, pressure passing, the guard curriculum (closed/half/X/SLX/lasso/DLR/RDLR/collar-sleeve), loose/tight passing, standing, triangle hub. Tokui sets target finishes (x25); growth sets target everything x50 by default. Templates are **coach-owned by design**: served from Postgres (`GET /api/templates`, seeded from shipped defaults), replaced wholesale with the `TEMPLATE_ADMIN_SECRET` (`PUT` with `x-template-secret`); offline or db-less, the shipped defaults stand. |

### Technical

| Question | Decision |
| --- | --- |
| Build order | M1: offline core ✅ → **M2.1: device sync ✅ (anonymous trackers)** → M2.2: accounts → M2.3: coach layer. |
| Offline | Installable PWA; taps land locally and instantly. |
| State | Everything is an **action log**: `{id, type, payload, at}` folded through a pure engine (no Date, no randomness). Action ids are `<deviceId>-<counter>`; created entities derive ids from them, so devices can't collide. |
| Sync | ✅ Action-log sync: clients queue the same actions offline; the referee (`server/referee.js`, one endpoint at `/api/sync`) replays them through the same engine into an append-only **Postgres** log, idempotent by action id, per-tracker serialized. Pre-auth, a "tracker" is named by a sync code (`trackerId.secret`) carried between devices; M2.2 accounts absorb it. Rejected actions (engine says no against server truth) are named and dropped client-side. |
| Auth | ✅ **Magic-link accounts** (M2.2 slice one): request a link with your email plus the gym passphrase (`GYM_PASSPHRASE` gates signup, not login; unset = open signup), redeem it and the device holds a 90-day session plus the account's tracker credentials — login IS the sync-code handover, so the referee is unchanged. Coaches flagged live from `COACH_EMAILS` at each login. Mail via Resend (`RESEND_API_KEY`, `MAIL_FROM`); without a key the link goes to server logs and the UI says so. Links are single-use, 15-minute, hash-stored. The tracker secret is stored server-side in the clear deliberately (re-issued to each new device; grants nothing beyond the session). **Passkeys are the next slice** — the magic link is their enrollment path. |
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
