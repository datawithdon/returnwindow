import assert from "node:assert/strict";
import { test } from "node:test";
import { SCHEMA, buildRequest, parseResponse } from "../js/ai.js";
import { returnChecklist, warrantyEmail } from "../js/claims.js";
import { dueReminders } from "../js/notify.js";
import { timeline } from "../js/policy.js";
import { CHECKED, RETAILERS, byId } from "../js/retailers.js";

const reply = (obj, extra = {}) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(obj) }], ...extra });

test("retailer data: 25 stores, sourced from their own domain, internally consistent", () => {
  assert.equal(RETAILERS.length, 25);
  assert.match(CHECKED, /^\d{4}-\d{2}-\d{2}$/);
  const ids = new Set();
  for (const r of RETAILERS) {
    assert.ok(!ids.has(r.id), `duplicate id ${r.id}`);
    ids.add(r.id);
    const host = new URL(r.source).hostname;
    assert.equal(new URL(r.source).protocol, "https:");
    assert.ok(host === r.domain || host.endsWith(`.${r.domain}`) || r.domain.endsWith(host.replace(/^www\./, "")) || host.endsWith(r.domain.split(".").slice(-2).join(".")), `${r.id} source ${host} not on ${r.domain}`);
    assert.ok(["page", "search"].includes(r.verified));
    assert.ok(r.anytime ? r.days === null : Number.isInteger(r.days) && r.days > 0, `${r.id} days`);
    assert.ok(["purchase", "delivery"].includes(r.clock));
    assert.ok(r.aliases.length && r.aliases.every((a) => a === a.toUpperCase()), `${r.id} aliases upper case`);
    const keys = new Set(r.categories.map((c) => c.key));
    for (const c of r.categories) assert.ok(c.final || c.exchange || (Number.isInteger(c.days) && c.days > 0), `${r.id}/${c.key}`);
    for (const h of r.holiday) {
      assert.ok(h.from <= h.to && (h.returnBy || h.startOn), `${r.id} holiday`);
      for (const x of h.excludes || []) assert.ok(keys.has(x), `${r.id} holiday excludes unknown ${x}`);
      if (h.member) assert.ok(r.members.some((m) => m.key === h.member));
    }
  }
});

test("Claude request: structured output, fallback beta for Opus/Sonnet only", () => {
  const img = { mediaType: "image/jpeg", base64: "AAAA" };
  const { body, betas } = buildRequest(img, "claude-opus-5-5");
  assert.equal(body.model, "claude-opus-5-5");
  assert.equal(body.output_config.format.schema, SCHEMA);
  assert.equal(body.fallbacks, "default");
  assert.deepEqual(betas, ["server-side-fallback-2026-07-01"]);
  const h = buildRequest(img, "claude-haiku-5-5");
  assert.equal(h.body.fallbacks, undefined);
  assert.deepEqual(h.betas, []);
  assert.equal(buildRequest(img, "gpt-9").body.model, "claude-opus-5-5");
});

test("Claude response is validated", () => {
  const ok = parseResponse(reply({ isReceipt: true, store: "Best Buy", date: "2026-10-30", total: 264.98, orderNumber: "BBY01-123<x>", returnBy: "", items: [{ name: "AirPods Pro 3", price: 249.99 }, { name: "", price: 3 }] }), "2026-11-02");
  assert.equal(ok.store, "bestbuy");
  assert.equal(ok.orderNumber, "BBY01-123x");
  assert.equal(ok.items.length, 1);
  assert.equal(parseResponse(reply({ isReceipt: true, store: "", date: "2031-01-01", total: 0, orderNumber: "", returnBy: "", items: [{ name: "A", price: 1 }] }), "2026-11-02").date, "");
  assert.throws(() => parseResponse(reply({ isReceipt: false }), "2026-11-02"), /receipt/);
  assert.throws(() => parseResponse({ stop_reason: "refusal", content: [] }, "2026-11-02"), /declined/);
  assert.throws(() => parseResponse({ stop_reason: "end_turn", content: [{ type: "text", text: "nope" }] }, "2026-11-02"), /JSON/);
});

test("reminders: one per threshold, not repeated", () => {
  const p = { id: "p1aaa", store: "apple", storeName: "", date: "2026-10-22", deliveredOn: "", member: "", items: [{ id: "i1aa", name: "iPad", price: 349, category: "", warrantyMonths: 0, serial: "", returnBy: "", status: "open", seenPrice: null }] };
  const rows = timeline([p], [], "2026-11-03"); // deadline Nov 5 → 2 days left
  const due = dueReminders(rows, 3, []);
  assert.equal(due.length, 1);
  assert.equal(due[0].key, "i1aa:2026-11-05:3");
  assert.match(due[0].body, /iPad from Apple/);
  assert.equal(dueReminders(rows, 3, [due[0].key]).length, 0);
  assert.equal(dueReminders(timeline([p], [], "2026-11-04"), 3, [due[0].key])[0].key, "i1aa:2026-11-05:1");
  assert.equal(dueReminders(timeline([p], [], "2026-10-25"), 3, []).length, 0);
});

test("claim kit text", () => {
  const purchase = { date: "2026-11-01", orderNumber: "A123", deliveredOn: "" };
  const item = { name: "Kallax shelf", price: 79, serial: "" };
  const t = returnChecklist({ purchase, item, store: byId("ikea"), ret: { kind: "window", deadline: "2027-11-01" }, storeLabel: "IKEA" });
  assert.match(t, /Return by: Nov 1, 2027/);
  assert.match(t, /photo ID/);
  const { subject, body } = warrantyEmail({ purchase, item: { ...item, serial: "SN9" }, storeLabel: "IKEA", warranty: "2027-11-01" });
  assert.match(subject, /SN9/);
  assert.match(body, /Order \/ receipt number: A123/);
  assert.doesNotMatch(body, /\n\n\n/);
});

test("claim kit omits missing fields without leaving blank lines", () => {
  const { body } = warrantyEmail({ purchase: { date: "2026-10-25", orderNumber: "" }, item: { name: "Headphones", price: null, serial: "" }, storeLabel: "Target", warranty: null });
  assert.match(body, /Purchase date: Oct 25, 2026\n\nThe problem/);
});
