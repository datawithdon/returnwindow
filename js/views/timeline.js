// Home: what's returnable now, what's closing soon, warranties and all purchases.

import { fmt, today } from "../dates.js";
import { h, money, mount, toast } from "../dom.js";
import { priceDrop, returnable, timeline } from "../policy.js";
import { setItem, state, storeName } from "../store.js";
import { deadlineBadge, warrantyBadge } from "../ui.js";

const TABS = { returns: "Returns", warranties: "Warranties", purchases: "Purchases", done: "Done" };

export function render(root, params) {
  const tab = Object.hasOwn(TABS, params.get("tab")) ? params.get("tab") : "returns";
  const rows = timeline(state.purchases, state.stores, today());

  if (!state.purchases.length) {
    mount(root, h("section", { class: "panel narrow hero" },
      h("h1", {}, "Never miss a return window"),
      h("p", {}, "Snap a receipt and ReturnWindow works out the return-by date from the store's policy. That covers 25 major US retailers, including holiday extensions and member perks. It also tracks warranties and drafts the claim email when something breaks."),
      h("a", { class: "btn primary big", href: "#/add" }, "Add your first receipt"),
      h("p", { class: "muted small" }, "Everything stays on this device. No account, no server.")));
    return;
  }

  const open = returnable(rows);
  const lead = state.settings.leadDays;
  const closing = open.filter((r) => r.returnLeft <= lead);
  const openValue = open.reduce((s, r) => s + (r.item.price || 0), 0);
  const warranties = rows.filter((r) => r.warranty && r.warrantyLeft >= 0 && r.item.status !== "returned").sort((a, b) => a.warrantyLeft - b.warrantyLeft);
  const drops = open.filter((r) => priceDrop(r.item) > 0);

  const tabs = h("nav", { class: "tabs", "aria-label": "Timeline sections" },
    Object.entries(TABS).map(([k, label]) => h("a", { href: `#/timeline?tab=${k}`, "aria-current": k === tab ? "page" : null }, label)));

  let body;
  if (tab === "returns") {
    const anytime = rows.filter((r) => r.item.status === "open" && r.ret.kind === "anytime");
    body = [
      open.length ? h("div", { class: "list" }, open.map(returnRow)) : h("p", { class: "empty" }, "Nothing open to return. Nice."),
      anytime.length ? [h("h2", {}, "No time limit"), h("div", { class: "list" }, anytime.map(returnRow))] : null,
    ];
  } else if (tab === "warranties") {
    body = warranties.length ? h("div", { class: "list" }, warranties.map(warrantyRow))
      : h("p", { class: "empty" }, "No warranties tracked. Set a warranty length on an item to see it here.");
  } else if (tab === "done") {
    const done = rows.filter((r) => r.item.status !== "open" || (r.returnLeft != null && r.returnLeft < 0) || r.ret.kind === "final");
    body = done.length ? h("div", { class: "list" }, done.map(returnRow)) : h("p", { class: "empty" }, "Returned, kept and expired items show up here.");
  } else {
    body = purchaseList();
  }

  mount(root,
    h("div", { class: "head" }, h("h1", {}, "Timeline"), h("a", { class: "btn primary", href: "#/add" }, "+ Add receipt")),
    h("div", { class: "tiles" },
      stat("Returnable now", `${open.length}`, open.length ? `${money(openValue)} total` : ""),
      stat(`Closing in ${lead} day${lead === 1 ? "" : "s"}`, `${closing.length}`, closing.length ? closing[0].item.name : "", closing.length ? "urgent" : ""),
      stat("Under warranty", `${warranties.length}`, warranties[0] ? `next ends ${fmt(warranties[0].warranty)}` : ""),
      stat("Price drops", drops.length ? money(drops.reduce((s, r) => s + priceDrop(r.item), 0)) : "—", drops.length ? `on ${drops.length} item${drops.length === 1 ? "" : "s"}` : "log a lower price on an item", drops.length ? "good" : "")),
    tabs, body);

  function returnRow(r) {
    const drop = priceDrop(r.item);
    const isOpen = r.item.status === "open";
    return h("div", { class: `item ${r.returnLeft != null && r.returnLeft >= 0 && r.returnLeft <= 3 && isOpen ? "urgent" : ""}` },
      h("a", { class: "item-main", href: `#/purchase/${r.purchase.id}` },
        h("strong", {}, r.item.name),
        h("span", { class: "muted small" }, [storeName(r.purchase), fmt(r.purchase.date), r.item.price != null && money(r.item.price)].filter(Boolean).join(" · ")),
        r.ret.deadline ? h("span", { class: "small" }, `${r.ret.kind === "exchange" ? "Exchange" : "Return"} by ${fmt(r.ret.deadline)}`) : null,
        drop ? h("span", { class: "small good-text" }, `Now ${money(drop)} cheaper: return and rebuy, or ask for a price adjustment`) : null),
      h("div", { class: "item-side" },
        isOpen ? deadlineBadge(r.ret, r.returnLeft) : h("span", { class: "pill none" }, r.item.status === "returned" ? "Returned" : "Kept"),
        isOpen && r.ret.kind !== "final"
          ? h("div", { class: "row tight" },
            h("button", { class: "btn small", type: "button", onclick: () => mark(r, "returned") }, "Returned"),
            h("button", { class: "btn small", type: "button", onclick: () => mark(r, "kept") }, "Keep"))
          : !isOpen ? h("button", { class: "btn small", type: "button", onclick: () => mark(r, "open") }, "Undo") : null));
  }

  function warrantyRow(r) {
    return h("div", { class: "item" },
      h("a", { class: "item-main", href: `#/purchase/${r.purchase.id}` },
        h("strong", {}, r.item.name),
        h("span", { class: "muted small" }, [storeName(r.purchase), `bought ${fmt(r.purchase.date)}`, r.item.serial && `S/N ${r.item.serial}`].filter(Boolean).join(" · "))),
      h("div", { class: "item-side" }, warrantyBadge(r.warranty, r.warrantyLeft), h("span", { class: "muted small" }, `${r.warrantyLeft} days left`)));
  }

  function mark(r, status) {
    setItem(r.purchase.id, r.item.id, { status });
    toast(status === "open" ? "Moved back to open" : `Marked ${status}`);
    render(root, params);
  }

  function purchaseList() {
    const q = h("input", { type: "search", placeholder: "Search store, item, order #", "aria-label": "Search purchases" });
    const list = h("div", { class: "list" });
    const draw = () => {
      const term = q.value.trim().toLowerCase();
      const ps = [...state.purchases].sort((a, b) => (a.date < b.date ? 1 : -1))
        .filter((p) => !term || [storeName(p), p.orderNumber, p.notes, ...p.items.map((i) => `${i.name} ${i.serial}`)].join(" ").toLowerCase().includes(term));
      mount(list, ps.length ? ps.map((p) => h("a", { class: "item", href: `#/purchase/${p.id}` },
        h("span", { class: "item-main" },
          h("strong", {}, storeName(p)),
          h("span", { class: "muted small" }, `${fmt(p.date)} · ${p.items.length} item${p.items.length === 1 ? "" : "s"}${p.orderNumber ? ` · #${p.orderNumber}` : ""}`)),
        h("span", { class: "item-side" }, p.total != null ? h("strong", {}, money(p.total)) : null, p.hasPhoto ? h("span", { class: "muted small" }, "Receipt saved") : null)))
        : h("p", { class: "empty" }, "No matches."));
    };
    q.addEventListener("input", draw);
    draw();
    return [q, list];
  }
}

function stat(label, value, sub, tone = "") {
  return h("div", { class: `stat ${tone}` },
    h("span", { class: "stat-label" }, label),
    h("span", { class: "stat-value" }, value),
    sub ? h("span", { class: "muted small ellipsis" }, sub) : null);
}
