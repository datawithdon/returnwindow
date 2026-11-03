import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanItem, cleanPurchase, cleanStore, load, sanitize, save, state, STORAGE_KEY } from "../js/store.js";

const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };

test("sanitize: garbage in, empty state out", () => {
  for (const raw of [null, 42, "x", [], { purchases: "nope" }]) {
    const s = sanitize(raw);
    assert.deepEqual(s.purchases, []);
    assert.deepEqual(s.stores, []);
    assert.equal(s.settings.leadDays, 3);
  }
});

test("cleanPurchase requires a valid date and at least one named item", () => {
  assert.equal(cleanPurchase({ date: "2026-13-01", items: [{ name: "A" }] }), null);
  assert.equal(cleanPurchase({ date: "2026-11-01", items: [{ name: "  " }] }), null);
  const p = cleanPurchase({ date: "2026-11-01", store: "target", member: "circle-card", items: [{ name: "Lamp", price: 19.999 }] });
  assert.equal(p.store, "target");
  assert.equal(p.member, "circle-card");
  assert.equal(p.items[0].price, 20);
});

test("unknown store ids and members are dropped", () => {
  const p = cleanPurchase({ date: "2026-11-01", store: "evil<script>", storeName: "Corner\u0000 Shop", member: "x", items: [{ name: "A" }] });
  assert.equal(p.store, "");
  assert.equal(p.storeName, "Corner Shop");
  const q = cleanPurchase({ date: "2026-11-01", store: "walmart", member: "circle-card", items: [{ name: "A" }] });
  assert.equal(q.member, "");
});

test("cleanItem clamps and validates fields", () => {
  const i = cleanItem({ name: "x".repeat(200), price: -5, category: "BAD KEY!", warrantyMonths: 9999, status: "stolen", returnBy: "soon", seenPrice: 10 });
  assert.equal(i.name.length, 80);
  assert.equal(i.price, null);
  assert.equal(i.category, "");
  assert.equal(i.warrantyMonths, 0);
  assert.equal(i.status, "open");
  assert.equal(i.returnBy, "");
  assert.equal(i.seenPrice, 10);
});

test("custom stores: validated, and purchases may reference them", () => {
  assert.equal(cleanStore({ name: "A", days: 0 }), null);
  const s = cleanStore({ id: "c-abcd1", name: "Corner Shop", days: 14, clock: "delivery" });
  assert.equal(s.clock, "delivery");
  const st = sanitize({ stores: [s], purchases: [{ date: "2026-11-01", store: "c-abcd1", items: [{ name: "A" }] }, { date: "2026-11-01", store: "c-zzzz9", items: [{ name: "B" }] }] });
  assert.equal(st.purchases[0].store, "c-abcd1");
  assert.equal(st.purchases[1].store, "");
});

test("duplicate purchase ids are dropped; notified keys validated", () => {
  const st = sanitize({
    purchases: [{ id: "dup1", date: "2026-11-01", items: [{ name: "A" }] }, { id: "dup1", date: "2026-11-02", items: [{ name: "B" }] }],
    notified: ["abcd:2026-11-05:3", "<img>", 5],
  });
  assert.equal(st.purchases.length, 1);
  assert.deepEqual(st.notified, ["abcd:2026-11-05:3"]);
});

test("save/load round trip", () => {
  const mem = memStorage();
  state.purchases = [cleanPurchase({ date: "2026-11-01", store: "ikea", items: [{ name: "Shelf", price: 79 }] })];
  save(mem);
  assert.ok(mem.m.has(STORAGE_KEY));
  state.purchases = [];
  load(mem);
  assert.equal(state.purchases[0].items[0].name, "Shelf");
});
