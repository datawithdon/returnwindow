import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanName, detectStore, findAmounts, findDates, parseReceipt } from "../js/parse.js";

const TODAY = "2026-11-02";

test("detectStore picks the most specific alias", () => {
  assert.equal(detectStore("OLD NAVY #1234\nGAP INC"), "oldnavy");
  assert.equal(detectStore("THE HOME DEPOT\n1234 MAIN ST"), "homedepot");
  assert.equal(detectStore("Sam's Club #6612"), "samsclub");
  assert.equal(detectStore("T.J.MAXX"), "tjmaxx");
  assert.equal(detectStore("Thank you for shopping at Target"), "target");
  assert.equal(detectStore("GAPING HOLE HARDWARE"), "");     // short alias must stand alone
  assert.equal(detectStore("PRICE: 3.99"), "");                // REI inside a word
  assert.equal(detectStore("Kohl’s"), "kohls");                // curly apostrophe
});

test("findDates handles common receipt formats", () => {
  assert.deepEqual(findDates("11/02/2026 14:32"), ["2026-11-02"]);
  assert.deepEqual(findDates("11/2/26"), ["2026-11-02"]);
  assert.deepEqual(findDates("2026-10-30"), ["2026-10-30"]);
  assert.deepEqual(findDates("Order placed Oct 30, 2026"), ["2026-10-30"]);
  assert.deepEqual(findDates("02 NOV 2026"), ["2026-11-02"]);
  assert.deepEqual(findDates("13/45/2026"), []);
});

test("findAmounts parses thousands and credits", () => {
  assert.deepEqual(findAmounts("TV 1,299.99"), [1299.99]);
  assert.deepEqual(findAmounts("COUPON 5.00-"), [-5]);
  assert.deepEqual(findAmounts("SAVINGS -2.50"), [-2.5]);
  assert.deepEqual(findAmounts("QTY 2 @ 3.49 6.98"), [3.49, 6.98]);
});

test("cleanName strips SKUs and quantity prefixes", () => {
  assert.equal(cleanName("012345678905 GG PASTA "), "GG PASTA");
  assert.equal(cleanName("2 @ BANANAS"), "BANANAS");
});

test("parseReceipt: a typical store receipt", () => {
  const text = `TARGET
Expect More. Pay Less.
1234 Main St, Springfield
11/01/2026 15:04
211110123 SONY WH-1000XM6 HEADPHONES  N  379.99
071234567 GOOD & GATHER PASTA  F  2.49
SUBTOTAL 382.48
T = 8.25% TAX 31.35
TOTAL 413.83
VISA CREDIT 413.83
CHANGE DUE 0.00
REC#2-4471-0089-0123-4567-8
RETURN BY 01/30/2027`;
  const r = parseReceipt(text, TODAY);
  assert.equal(r.store, "target");
  assert.equal(r.date, "2026-11-01");
  assert.equal(r.total, 413.83);
  assert.equal(r.returnBy, "2027-01-30");
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].price, 379.99);
  assert.match(r.items[0].name, /SONY WH-1000XM6 HEADPHONES/);
  assert.equal(r.items[1].price, 2.49);
});

test("parseReceipt: online order confirmation", () => {
  const text = `Best Buy
Order Number: BBY01-806123456789
Order placed Oct 30, 2026
Apple - AirPods Pro 3   $249.99
Insignia 6ft USB-C Cable   $14.99
Order Total: $282.48`;
  const r = parseReceipt(text, TODAY);
  assert.equal(r.store, "bestbuy");
  assert.equal(r.date, "2026-10-30");
  assert.equal(r.orderNumber, "BBY01-806123456789");
  assert.equal(r.total, 282.48);
  assert.deepEqual(r.items.map((i) => i.price), [249.99, 14.99]);
});

test("parseReceipt ignores future dates and empty input", () => {
  assert.equal(parseReceipt("WALMART\n12/25/2031\nMILK 3.99", TODAY).date, "");
  const empty = parseReceipt("", TODAY);
  assert.equal(empty.store, "");
  assert.deepEqual(empty.items, []);
});
