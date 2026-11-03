// Policy browser: every bundled retailer's windows, exceptions, member perks,
// holiday rules and source, plus the user's own stores.

import { fmt } from "../dates.js";
import { h, mount, toast } from "../dom.js";
import { CHECKED, RETAILERS } from "../retailers.js";
import { addStore, removeStore, state } from "../store.js";
import { sourceLine } from "../ui.js";

export function render(root, params) {
  const q = h("input", { type: "search", placeholder: "Search stores", "aria-label": "Search stores", value: params.get("q") || "" });
  const list = h("div", { class: "store-list" });
  const draw = () => {
    const term = q.value.trim().toLowerCase();
    const rs = [...RETAILERS].sort((a, b) => a.name.localeCompare(b.name)).filter((r) => !term || r.name.toLowerCase().includes(term));
    mount(list, rs.length ? rs.map(card) : h("p", { class: "empty" }, "No bundled store matches. Add it below as your own store."));
  };
  q.addEventListener("input", draw);
  draw();

  const name = h("input", { type: "text", maxlength: "60", placeholder: "Store name", "aria-label": "Store name" });
  const days = h("input", { type: "number", min: "1", max: "3650", inputmode: "numeric", placeholder: "Days", "aria-label": "Return window in days" });
  const clock = h("select", { "aria-label": "Counted from" }, h("option", { value: "purchase" }, "from purchase"), h("option", { value: "delivery" }, "from delivery"));
  const add = () => {
    const s = addStore({ name: name.value, days: Math.floor(Number(days.value)), clock: clock.value });
    if (!s) { toast("Enter a name and a window of 1–3650 days."); return; }
    toast(`${s.name} added`);
    render(root, params);
  };

  mount(root, h("section", { class: "panel" },
    h("h1", {}, "Store policies"),
    h("p", { class: "muted" }, `Return rules for ${RETAILERS.length} US retailers, checked ${fmt(CHECKED)} on each store's own website. Where sources disagreed, the shorter window is used, so a deadline is never later than it should be.`),
    q, list,
    h("h2", {}, "Your stores"),
    state.stores.length ? h("div", { class: "list" }, state.stores.map((s) => h("div", { class: "item" },
      h("span", { class: "item-main" }, h("strong", {}, s.name), h("span", { class: "muted small" }, `${s.days} days from ${s.clock}`)),
      h("span", { class: "item-side" }, h("button", { class: "btn small danger", type: "button", onclick: () => {
        if (!removeStore(s.id)) { toast("A saved purchase uses this store. Change or delete it first."); return; }
        render(root, params);
      } }, "Remove")))))
      : h("p", { class: "muted small" }, "Shopping somewhere else? Add its return window once and reuse it."),
    h("div", { class: "row add-store" }, name, days, clock, h("button", { class: "btn primary", type: "button", onclick: add }, "Add store"))));
}

function card(r) {
  return h("details", { class: "store-card" },
    h("summary", {},
      h("strong", {}, r.name),
      h("span", { class: "muted small" }, r.anytime ? " · no time limit for most items" : ` · ${r.days} days from ${r.clock}`),
      r.verified === "page" ? h("span", { class: "pill ok tiny" }, "page read") : h("span", { class: "pill none tiny" }, "via search")),
    r.categories.length ? h("table", { class: "policy" },
      h("thead", {}, h("tr", {}, h("th", {}, "Category"), h("th", {}, "Window"))),
      h("tbody", {}, r.categories.map((c) => h("tr", {}, h("td", {}, c.label), h("td", {}, c.final ? "Not returnable" : c.exchange ? "Exchange only" : `${c.days} days`))))) : null,
    r.members.length ? h("p", { class: "small" }, h("strong", {}, "Members: "), r.members.map((m) => `${m.label}: ${m.days} days`).join(" · ")) : null,
    r.holiday.length ? h("p", { class: "small" }, h("strong", {}, "Holiday: "), r.holiday.map((x) => `${x.member ? `${r.members.find((m) => m.key === x.member)?.label} ` : ""}purchases ${fmt(x.from)} – ${fmt(x.to)} ${x.returnBy ? `returnable until ${fmt(x.returnBy)}` : `window starts ${fmt(x.startOn)}`}`).join(" · ")) : null,
    h("ul", { class: "small" }, r.notes.map((n) => h("li", {}, n))),
    sourceLine(r));
}
