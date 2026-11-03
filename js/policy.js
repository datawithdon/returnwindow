// Deadline engine: purchase + item + store policy → return-by and warranty dates.
// Pure functions (no DOM, no storage) so the rules are unit-tested.

import { addDays, addMonths, diffDays, fmt, isYmd, maxYmd } from "./dates.js";
import { byId } from "./retailers.js";

/** Resolve a purchase's store to a policy object: bundled retailer, custom store, or null. */
export function storeFor(purchase, customStores = []) {
  if (!purchase?.store) return null;
  return byId(purchase.store) || customStores.find((s) => s.id === purchase.store) || null;
}

export const categoryOf = (store, key) => (store?.categories || []).find((c) => c.key === key) || null;

/**
 * Work out an item's return deadline.
 * Returns { kind, deadline, start, days, reasons[] } where kind is
 *   "window"   — returnable until `deadline`
 *   "exchange" — exchange only, until `deadline`
 *   "anytime"  — no stated limit
 *   "final"    — not returnable
 *   "unknown"  — no store policy and no manual date
 */
export function returnInfo(purchase, item, store) {
  const reasons = [];
  if (isYmd(item.returnBy)) {
    return { kind: "window", deadline: item.returnBy, start: purchase.date, days: diffDays(purchase.date, item.returnBy), reasons: ["Return-by date entered manually"] };
  }
  if (!store) return { kind: "unknown", deadline: null, start: purchase.date, days: null, reasons: ["No return policy set for this store"] };

  const cat = categoryOf(store, item.category);
  if (cat?.final) return { kind: "final", deadline: null, start: purchase.date, days: null, reasons: [`${cat.label}: not returnable`] };

  let days = cat?.days ?? store.days;
  if (cat?.days != null) reasons.push(`${cat.label}: ${cat.days} days`);
  const member = !cat && (store.members || []).find((m) => m.key === purchase.member);
  if (member) { days = member.days; reasons.push(`${member.label}: ${member.days} days`); }
  if (days == null) {
    if (store.anytime) return { kind: "anytime", deadline: null, start: purchase.date, days: null, reasons: [`${store.name}: no time limit stated`] };
    return { kind: "unknown", deadline: null, start: purchase.date, days: null, reasons: ["No return window known"] };
  }
  if (!cat?.days && !member) reasons.push(`${store.name}: ${days} days`);

  const fromDelivery = store.clock === "delivery" && isYmd(purchase.deliveredOn) && purchase.deliveredOn >= purchase.date;
  const start = fromDelivery ? purchase.deliveredOn : purchase.date;
  reasons.push(fromDelivery ? "counted from delivery" : store.clock === "delivery" ? "counted from purchase (add the delivery date for the exact deadline)" : "counted from purchase");
  let deadline = addDays(start, days);

  for (const h of store.holiday || []) {
    if (purchase.date < h.from || purchase.date > h.to) continue;
    if (h.member && h.member !== purchase.member) continue;
    if ((h.excludes || []).includes(cat?.key)) continue;
    const extended = h.returnBy || addDays(h.startOn, days);
    if (extended > deadline) {
      deadline = extended;
      reasons.push(h.startOn ? `holiday purchase: window starts ${fmt(h.startOn)}` : `holiday purchase: extended to ${fmt(h.returnBy)}`);
    }
  }
  return { kind: cat?.exchange ? "exchange" : "window", deadline, start, days, reasons };
}

/** Warranty end date, or null when no warranty length is set. */
export function warrantyEnd(purchase, item) {
  const months = item.warrantyMonths;
  if (!Number.isInteger(months) || months <= 0) return null;
  const start = isYmd(purchase.deliveredOn) && purchase.deliveredOn >= purchase.date ? purchase.deliveredOn : purchase.date;
  return addMonths(start, months);
}

/** Urgency bucket for colouring a deadline. */
export function urgency(daysLeft) {
  if (daysLeft == null) return "none";
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 3) return "urgent";
  if (daysLeft <= 7) return "soon";
  return "ok";
}

/**
 * Flatten purchases into timeline rows, one per item:
 * { purchase, item, store, ret, returnLeft, warranty, warrantyLeft }.
 */
export function timeline(purchases, customStores, todayYmd) {
  const rows = [];
  for (const p of purchases) {
    const store = storeFor(p, customStores);
    for (const item of p.items) {
      const ret = returnInfo(p, item, store);
      const warranty = warrantyEnd(p, item);
      rows.push({
        purchase: p, item, store, ret,
        returnLeft: ret.deadline ? diffDays(todayYmd, ret.deadline) : null,
        warranty,
        warrantyLeft: warranty ? diffDays(todayYmd, warranty) : null,
      });
    }
  }
  return rows;
}

/** Rows still worth acting on (open, deadline today or later), soonest first. */
export const returnable = (rows) => rows
  .filter((r) => r.item.status === "open" && r.returnLeft != null && r.returnLeft >= 0)
  .sort((a, b) => a.returnLeft - b.returnLeft);

/** Savings if the item is now cheaper than what was paid. */
export const priceDrop = (item) => (item.seenPrice != null && item.price != null && item.seenPrice < item.price ? +(item.price - item.seenPrice).toFixed(2) : 0);

/** Guess an item's policy category from its name using the store's keyword lists. */
export function guessCategory(store, name) {
  const n = ` ${String(name || "").toUpperCase().replace(/[^A-Z0-9&'+ -]/g, " ")} `;
  for (const c of store?.categories || []) {
    for (const k of c.match || []) {
      if (n.includes(` ${k} `) || (k.length >= 5 && n.includes(k))) return c.key;
    }
  }
  return "";
}
