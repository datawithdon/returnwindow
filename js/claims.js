// Ready-to-send text for returns and warranty claims. Pure string builders so
// they can be tested; the UI adds copy/share buttons.

import { fmt } from "./dates.js";

/** Drop omitted (null) lines, then any blank line that follows another blank line. */
const collapse = (lines) => lines.filter((l) => l != null).filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== "")).join("\n").trim();

const money = (n) => (n == null ? "" : `$${n.toFixed(2)}`);

export function returnChecklist({ purchase, item, store, ret, storeLabel }) {
  const lines = [
    `Return: ${item.name}${item.price != null ? ` (${money(item.price)})` : ""}`,
    `Store: ${storeLabel}`,
    `Bought: ${fmt(purchase.date)}${purchase.orderNumber ? ` · order ${purchase.orderNumber}` : ""}`,
    ret.deadline ? `${ret.kind === "exchange" ? "Exchange" : "Return"} by: ${fmt(ret.deadline)}` : ret.kind === "anytime" ? "No time limit stated" : null,
    "",
    "Bring:",
    "• Receipt or order confirmation (photo saved in ReturnWindow)",
    "• The item with all parts, accessories and original packaging",
    "• The card you paid with",
  ];
  if (store?.id === "ikea") lines.push("• Government-issued photo ID (IKEA requires it)");
  if (store?.clock === "delivery" && !purchase.deliveredOn) lines.push("", "Tip: add the delivery date in ReturnWindow; the window may be later than shown.");
  if (store?.notes?.length) lines.push("", "Policy notes:", ...store.notes.map((n) => `• ${n}`));
  return collapse(lines);
}

export function warrantyEmail({ purchase, item, storeLabel, warranty }) {
  const subject = `Warranty claim: ${item.name}${item.serial ? ` (serial ${item.serial})` : ""}`;
  const body = [
    "Hello,",
    "",
    `I'd like to make a warranty claim for my ${item.name}, which has stopped working properly.`,
    "",
    `Product: ${item.name}`,
    item.serial ? `Serial number: ${item.serial}` : "Serial number: [add serial number]",
    `Purchased from: ${storeLabel}`,
    `Purchase date: ${fmt(purchase.date)}`,
    purchase.orderNumber ? `Order / receipt number: ${purchase.orderNumber}` : null,
    item.price != null ? `Price paid: ${money(item.price)}` : null,
    warranty ? `Warranty valid until: ${fmt(warranty)}` : null,
    "",
    "The problem: [describe what happens, when it started, and what you've tried]",
    "",
    "A copy of my receipt is attached. Please let me know the next steps for a repair or replacement.",
    "",
    "Thank you,",
    "[Your name]",
    "[Phone / address for shipping]",
  ];
  return { subject, body: collapse(body) };
}
