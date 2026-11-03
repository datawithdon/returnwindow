import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, addMonths, diffDays, isYmd, today } from "../js/dates.js";
import { guessCategory, priceDrop, returnInfo, returnable, timeline, urgency, warrantyEnd } from "../js/policy.js";
import { byId } from "../js/retailers.js";

const item = (o = {}) => ({ id: "item1", name: "Thing", price: 50, category: "", warrantyMonths: 0, serial: "", returnBy: "", status: "open", seenPrice: null, ...o });
const purchase = (o = {}) => ({ id: "p0001", store: "", date: "2026-06-01", deliveredOn: "", member: "", items: [item()], ...o });

test("dates: validation and arithmetic", () => {
  assert.ok(isYmd("2026-02-28"));
  assert.ok(!isYmd("2026-02-30"));
  assert.ok(!isYmd("2026-2-3"));
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-07", 2), "2026-03-09"); // across US DST change
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-11-15", 24), "2028-11-15");
  assert.equal(diffDays("2026-11-02", "2026-11-12"), 10);
  assert.equal(today(new Date(2026, 10, 2, 23, 59)), "2026-11-02");
});

test("standard window counts from purchase", () => {
  const r = returnInfo(purchase({ store: "walmart" }), item(), byId("walmart"));
  assert.equal(r.kind, "window");
  assert.equal(r.deadline, "2026-08-30");
  assert.equal(r.days, 90);
});

test("category window overrides the standard one", () => {
  const r = returnInfo(purchase({ store: "walmart" }), item({ category: "phones" }), byId("walmart"));
  assert.equal(r.deadline, "2026-06-15");
});

test("delivery clock uses the delivery date only when given", () => {
  const amazon = byId("amazon");
  assert.equal(returnInfo(purchase({ store: "amazon" }), item(), amazon).deadline, "2026-07-01");
  assert.equal(returnInfo(purchase({ store: "amazon", deliveredOn: "2026-06-05" }), item(), amazon).deadline, "2026-07-05");
  // A delivery date before the purchase date is ignored.
  assert.equal(returnInfo(purchase({ store: "amazon", deliveredOn: "2026-05-01" }), item(), amazon).deadline, "2026-07-01");
});

test("member tier replaces the standard window but not category windows", () => {
  const bb = byId("bestbuy");
  assert.equal(returnInfo(purchase({ store: "bestbuy", member: "plus-total" }), item(), bb).days, 60);
  assert.equal(returnInfo(purchase({ store: "bestbuy", member: "plus-total" }), item({ category: "activatable" }), bb).days, 14);
});

test("final-sale and anytime categories", () => {
  assert.equal(returnInfo(purchase({ store: "costco" }), item({ category: "gift-cards" }), byId("costco")).kind, "final");
  assert.equal(returnInfo(purchase({ store: "costco" }), item(), byId("costco")).kind, "anytime");
  const tv = returnInfo(purchase({ store: "costco", deliveredOn: "2026-06-03" }), item({ category: "electronics" }), byId("costco"));
  assert.equal(tv.deadline, "2026-09-01");
});

test("exchange-only category", () => {
  const r = returnInfo(purchase({ store: "target" }), item({ category: "media-opened" }), byId("target"));
  assert.equal(r.kind, "exchange");
  assert.equal(r.deadline, "2026-08-30");
});

test("holiday: Target window starts Dec 26 for Nov 1 – Dec 24 purchases", () => {
  const t = byId("target");
  const p = purchase({ store: "target", date: "2026-11-20" });
  assert.equal(returnInfo(p, item(), t).deadline, "2027-03-26");
  assert.equal(returnInfo(p, item({ category: "apple" }), t).deadline, "2027-01-09");
  // Outside the holiday range: no change.
  assert.equal(returnInfo(purchase({ store: "target", date: "2026-12-26" }), item({ category: "apple" }), t).deadline, "2027-01-09");
});

test("holiday: Best Buy extension, member variant and exclusions", () => {
  const bb = byId("bestbuy");
  const p = purchase({ store: "bestbuy", date: "2026-11-02" });
  assert.equal(returnInfo(p, item(), bb).deadline, "2027-01-15");
  assert.equal(returnInfo({ ...p, member: "plus-total" }, item(), bb).deadline, "2027-01-31");
  assert.equal(returnInfo(p, item({ category: "activatable" }), bb).deadline, "2026-11-16");
  // A normal window that's already later than the holiday date wins.
  assert.equal(returnInfo({ ...p, date: "2026-12-20", member: "plus-total" }, item(), bb).deadline, "2027-02-18");
});

test("manual return-by beats the policy; unknown store is unknown", () => {
  assert.equal(returnInfo(purchase({ store: "walmart" }), item({ returnBy: "2026-06-10" }), byId("walmart")).deadline, "2026-06-10");
  assert.equal(returnInfo(purchase(), item(), null).kind, "unknown");
});

test("custom store", () => {
  const s = { id: "c-abcd", name: "Corner Shop", days: 14, clock: "purchase", categories: [], members: [], holiday: [], custom: true };
  const rows = timeline([purchase({ store: "c-abcd" })], [s], "2026-06-10");
  assert.equal(rows[0].ret.deadline, "2026-06-15");
  assert.equal(rows[0].returnLeft, 5);
});

test("warranty end from delivery or purchase", () => {
  assert.equal(warrantyEnd(purchase(), item({ warrantyMonths: 12 })), "2027-06-01");
  assert.equal(warrantyEnd(purchase({ deliveredOn: "2026-06-04" }), item({ warrantyMonths: 24 })), "2028-06-04");
  assert.equal(warrantyEnd(purchase(), item()), null);
});

test("timeline: returnable sorts soonest first and skips closed/returned", () => {
  const ps = [
    purchase({ id: "p1aaa", store: "walmart", date: "2026-10-01", items: [item({ id: "a1aa" }), item({ id: "a2aa", status: "returned" })] }),
    purchase({ id: "p2aaa", store: "apple", date: "2026-10-25", items: [item({ id: "b1aa" })] }),
    purchase({ id: "p3aaa", store: "apple", date: "2026-01-01", items: [item({ id: "c1aa" })] }),
  ];
  const open = returnable(timeline(ps, [], "2026-11-02"));
  assert.deepEqual(open.map((r) => r.item.id), ["b1aa", "a1aa"]);
  assert.equal(open[0].returnLeft, 6);
});

test("urgency buckets and price drop", () => {
  assert.equal(urgency(-1), "expired");
  assert.equal(urgency(2), "urgent");
  assert.equal(urgency(6), "soon");
  assert.equal(urgency(30), "ok");
  assert.equal(priceDrop(item({ price: 199.99, seenPrice: 149.99 })), 50);
  assert.equal(priceDrop(item({ price: 20, seenPrice: 25 })), 0);
});

test("guessCategory uses store keywords as whole words", () => {
  const t = byId("target");
  assert.equal(guessCategory(t, "Apple AirPods Pro 3"), "apple");
  assert.equal(guessCategory(t, "Good & Gather Pasta"), "owned-brand");
  assert.equal(guessCategory(t, "Sony 55in TV"), "electronics");
  assert.equal(guessCategory(t, "Stevia sweetener"), ""); // "TV" inside a word doesn't count
  assert.equal(guessCategory(byId("walmart"), "Samsung Galaxy S26"), "phones");
  assert.equal(guessCategory(null, "Anything"), "");
});
