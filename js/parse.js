// Turn OCR'd receipt text into a draft purchase: store, date, total, order
// number, a printed "return by" date and item lines. Receipts vary wildly, so
// every field is a best guess the user reviews before saving.

import { isYmd } from "./dates.js";
import { RETAILERS } from "./retailers.js";

const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12 };

const norm = (s) => ` ${String(s || "").toUpperCase().replace(/[’`]/g, "'").replace(/[^A-Z0-9'&.*\- ]+/g, " ").replace(/\s+/g, " ").trim()} `;

/** Find which bundled retailer a receipt (or a typed store name) is from. Longest alias wins. */
export function detectStore(text) {
  const t = norm(text);
  let best = null;
  for (const r of RETAILERS) {
    for (const a of r.aliases) {
      // Short aliases (GAP, REI) must stand alone; longer ones may touch punctuation.
      const hit = a.length <= 4 ? t.includes(` ${a} `) : t.includes(a);
      if (hit && (!best || a.length > best.len)) best = { id: r.id, len: a.length };
    }
  }
  return best?.id || "";
}

const pad = (n) => String(n).padStart(2, "0");
function ymd(y, m, d) {
  if (y < 100) y += 2000;
  const s = `${y}-${pad(m)}-${pad(d)}`;
  return isYmd(s) ? s : "";
}

/** Every date found in a line of text, in order. Handles 11/02/2026, 11/2/26, 2026-11-02, Nov 2, 2026 and 02 NOV 2026. */
export function findDates(line) {
  const out = [];
  const s = String(line).toUpperCase();
  for (const m of s.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) out.push({ at: m.index, v: ymd(+m[1], +m[2], +m[3]) });
  for (const m of s.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/g)) out.push({ at: m.index, v: ymd(+m[3], +m[1], +m[2]) });
  for (const m of s.matchAll(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEPT?|OCT|NOV|DEC)[A-Z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/g)) out.push({ at: m.index, v: ymd(+m[3], MONTHS[m[1]], +m[2]) });
  for (const m of s.matchAll(/\b(\d{1,2})[\s-](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEPT?|OCT|NOV|DEC)[A-Z]*[\s-](\d{4})\b/g)) out.push({ at: m.index, v: ymd(+m[3], MONTHS[m[2]], +m[1]) });
  return out.filter((d) => d.v).sort((a, b) => a.at - b.at).map((d) => d.v);
}

const AMOUNT_RE = /(-?)\$?\s?(\d{1,3}(?:,\d{3})*|\d+)[.,](\d{2})(?!\d)/g;

/** Amounts in a line, as numbers. "1,299.99" → 1299.99; a trailing "-" or leading "-" marks a credit. */
export function findAmounts(line) {
  const out = [];
  for (const m of String(line).matchAll(AMOUNT_RE)) {
    const v = Number(`${m[2].replace(/,/g, "")}.${m[3]}`);
    const after = String(line).slice(m.index + m[0].length, m.index + m[0].length + 1);
    out.push(m[1] === "-" || after === "-" ? -v : v);
  }
  return out;
}

const NOT_ITEM = /\b(SUB\s*-?\s*TOTAL|TOTAL|TAX|CHANGE|CASH|VISA|MASTER\s*CARD|MASTERCARD|AMEX|AMERICAN EXPRESS|DISCOVER|DEBIT|CREDIT|BALANCE|SAVINGS|YOU SAVED|DISCOUNT|COUPON|TEND|AUTH|APPROV|ITEMS SOLD|ACCOUNT|ACCT|CARD\s*#|REWARD|POINTS|REFUND|PAYMENT|AMOUNT|DUE|GIFT RECEIPT|PROMO|MEMBER SINCE|TRANS|REGISTER|STORE #|CASHIER|INVOICE|ORDER)\b/;

/**
 * Parse receipt text. `todayYmd` keeps future dates (OCR misreads) out.
 * Returns { store, date, total, orderNumber, returnBy, items: [{ name, price }] }.
 */
export function parseReceipt(text, todayYmd) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const result = { store: detectStore(lines.slice(0, 12).join("\n")) || detectStore(text), date: "", total: null, orderNumber: "", returnBy: "", items: [] };

  // Dates: a "return by" line is special; otherwise the first plausible date is the purchase date.
  const floor = `${Number(todayYmd.slice(0, 4)) - 10}${todayYmd.slice(4)}`;
  for (const line of lines) {
    const ds = findDates(line);
    if (!ds.length) continue;
    if (/RETURN\s*(BY|DATE|BEFORE|UNTIL)|RETURNABLE\s*(THROUGH|UNTIL|BY)/i.test(line)) { result.returnBy ||= ds[0]; continue; }
    const ok = ds.find((d) => d <= todayYmd && d >= floor);
    if (ok && !result.date) result.date = ok;
  }

  // Total: prefer explicit TOTAL / BALANCE DUE / AMOUNT DUE lines (not subtotal or tax).
  for (const line of lines) {
    const u = line.toUpperCase();
    if (!/\b(TOTAL|BALANCE DUE|AMOUNT DUE|GRAND TOTAL|ORDER TOTAL)\b/.test(u) || /SUB\s*-?\s*TOTAL|TOTAL\s*(TAX|SAVINGS|DISCOUNT|ITEMS|NUMBER)|TAX\s*TOTAL/.test(u)) continue;
    const amts = findAmounts(line).filter((a) => a > 0);
    if (amts.length) result.total = amts[amts.length - 1];
  }

  const order = text.match(/\b(?:ORDER|ORD|INVOICE|TRANS(?:ACTION)?|RECEIPT)\s*(?:NO\.?|NUMBER|#|ID)?\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{4,30})\b/i);
  if (order && /\d/.test(order[1])) result.orderNumber = order[1];

  for (const line of lines) {
    if (NOT_ITEM.test(line.toUpperCase())) continue;
    const amts = findAmounts(line);
    if (!amts.length) continue;
    const price = amts[amts.length - 1];
    if (price <= 0 || price > 100000) continue;
    const firstAmt = line.search(/-?\$?\s?(\d{1,3}(?:,\d{3})*|\d+)[.,]\d{2}(?!\d)/);
    const name = cleanName(line.slice(0, firstAmt));
    if (name.length < 2 || !/[A-Za-z]{2}/.test(name)) continue;
    if (findDates(line).length) continue;
    result.items.push({ name, price });
    if (result.items.length >= 60) break;
  }
  return result;
}

/** Strip SKUs/UPCs, quantity prefixes and tax flags from an item line. */
export function cleanName(s) {
  return String(s)
    .replace(/\b\d{6,}\b/g, " ")          // UPC / SKU
    .replace(/^\s*\d{1,3}\s*[@xX]\s*/, "") // "2 @" / "1 x"
    .replace(/[^\p{L}\p{N}&'.,\-/ ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
