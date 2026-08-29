// Calendar arithmetic on ISO "YYYY-MM-DD" strings.
//
// The engine never calls `new Date()` for "now" — the shell passes today in —
// but it still needs to add days and find week boundaries. All math runs in
// UTC on the date's midnight, so a calendar date is the same calendar date
// everywhere and daylight-saving shifts can't make a day 23 or 25 hours.

const DAY_MS = 86400000;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

const toUTC = (iso) =>
  Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);

// True for well-formed, real calendar dates ("2026-02-31" round-trips to
// March and is rejected).
export const isISODate = (iso) =>
  typeof iso === "string" && ISO_RE.test(iso) && fromUTC(toUTC(iso)) === iso;

export const addDays = (iso, n) => fromUTC(toUTC(iso) + n * DAY_MS);

// Whole days from a to b; negative when b precedes a.
export const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / DAY_MS);

// Monday of the week containing `iso`. Training weeks run Mon–Sun: the
// weekend open mat belongs to the week of work that led up to it.
export const weekStart = (iso) => {
  const dow = new Date(toUTC(iso)).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((dow + 6) % 7));
};

// The calendar month containing `iso` as Mon-started weeks: an array of
// 7-element rows of ISO dates, padded with the neighbouring months' days so
// every row is full.
export function monthGrid(iso) {
  const first = iso.slice(0, 8) + "01";
  const month = iso.slice(0, 7);
  const rows = [];
  let day = weekStart(first);
  do {
    const row = [];
    for (let i = 0; i < 7; i++) {
      row.push(day);
      day = addDays(day, 1);
    }
    rows.push(row);
  } while (day.slice(0, 7) === month);
  return rows;
}

export const monthLabel = (iso) => {
  const NAMES = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  return `${NAMES[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
};

export const addMonths = (iso, n) => {
  const y = +iso.slice(0, 4);
  const m = +iso.slice(5, 7) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
};
