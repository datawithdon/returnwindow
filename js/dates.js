// Calendar dates as "YYYY-MM-DD" strings. Arithmetic runs in UTC so a
// deadline never shifts by a day across daylight-saving changes or time zones.

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isYmd(s) {
  const m = typeof s === "string" && YMD_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

const toUtc = (ymd) => { const [y, m, d] = ymd.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const fromUtc = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Today in the device's local time zone. */
export function today(now = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export const addDays = (ymd, n) => fromUtc(toUtc(ymd) + n * 86400000);

/** Add calendar months, clamping to the last day of a shorter month (Jan 31 + 1 → Feb 28). */
export function addMonths(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return fromUtc(first.getTime());
}

/** Whole days from a to b (positive when b is later). */
export const diffDays = (a, b) => Math.round((toUtc(b) - toUtc(a)) / 86400000);

export const maxYmd = (a, b) => (a >= b ? a : b);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmt(ymd) {
  if (!isYmd(ymd)) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "today", "tomorrow", "in 5 days", "3 days ago". */
export function rel(days) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
