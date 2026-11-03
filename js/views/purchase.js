// One purchase: receipt photo, each item's deadline with the reasoning behind
// it, status buttons, price-drop check, claim kits and the store's policy.

import { fmt, today } from "../dates.js";
import { h, money, mount, toast } from "../dom.js";
import { deletePhoto, getPhoto } from "../photos.js";
import { priceDrop, timeline } from "../policy.js";
import { deletePurchase, getPurchase, setItem, state, storeName } from "../store.js";
import { deadlineBadge, openModal, openReturnKit, openWarrantyKit, sourceLine, warrantyBadge } from "../ui.js";

let photoUrl = null;

export function render(root, _params, id) {
  const p = getPurchase(id);
  if (!p) { mount(root, h("section", { class: "panel narrow" }, h("p", { class: "error" }, "Purchase not found."), h("a", { href: "#/timeline" }, "Back to timeline"))); return; }
  const rows = timeline([p], state.stores, today());
  const store = rows[0]?.store || null;

  const photo = h("div", { class: "receipt-preview" });
  if (p.hasPhoto) {
    getPhoto(p.id).then((blob) => {
      if (!blob) return;
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = URL.createObjectURL(blob);
      mount(photo, h("button", { class: "thumb-btn", type: "button", "aria-label": "View receipt full size", onclick: () => openModal("Receipt", h("img", { src: photoUrl, alt: "Receipt", class: "receipt-full" })) },
        h("img", { src: photoUrl, alt: "Receipt photo", class: "receipt-thumb" })));
    });
  }

  const remove = async () => {
    if (!confirm(`Delete this ${storeName(p)} purchase and its receipt photo?`)) return;
    deletePurchase(p.id);
    await deletePhoto(p.id);
    toast("Purchase deleted");
    location.hash = "#/timeline";
  };

  mount(root, h("section", { class: "panel narrow" },
    h("div", { class: "head" },
      h("div", {},
        h("h1", {}, storeName(p)),
        h("p", { class: "muted" }, [
          `Bought ${fmt(p.date)}`,
          p.deliveredOn && `delivered ${fmt(p.deliveredOn)}`,
          p.orderNumber && `#${p.orderNumber}`,
          p.total != null && money(p.total),
        ].filter(Boolean).join(" · ")),
        p.member && store ? h("p", { class: "small" }, `Member: ${store.members.find((m) => m.key === p.member)?.label || p.member}`) : null),
      h("div", { class: "row tight" },
        h("a", { class: "btn small", href: `#/edit/${p.id}` }, "Edit"),
        h("button", { class: "btn small danger", type: "button", onclick: remove }, "Delete"))),
    photo,
    p.notes ? h("p", { class: "note" }, p.notes) : null,
    h("h2", {}, "Items"),
    h("div", { class: "list" }, rows.map((r) => itemCard(r, () => render(root, _params, id)))),
    store ? h("div", { class: "policy-box" },
      h("h2", {}, `${store.name} return policy`),
      store.custom ? h("p", {}, `${store.days} days from ${store.clock}.`)
        : h("ul", {}, store.notes.map((n) => h("li", {}, n))),
      sourceLine(store),
      h("p", { class: "muted small" }, "Policies change and stores can make exceptions. When it's close, check the store's page or your order history.")) : null));
}

function itemCard(r, rerender) {
  const { item, purchase, ret } = r;
  const drop = priceDrop(item);
  const seen = h("input", { type: "number", min: "0", step: "0.01", inputmode: "decimal", value: item.seenPrice ?? "", placeholder: item.price != null ? item.price.toFixed(2) : "", "aria-label": "Price seen elsewhere" });
  const statusBtn = (s, label) => h("button", { class: `btn small${item.status === s ? " primary" : ""}`, type: "button", "aria-pressed": String(item.status === s), onclick: () => { setItem(purchase.id, item.id, { status: s }); rerender(); } }, label);

  return h("article", { class: "item-card" },
    h("div", { class: "row between" },
      h("strong", {}, item.name),
      item.status === "open" ? deadlineBadge(ret, r.returnLeft) : h("span", { class: "pill none" }, item.status === "returned" ? "Returned" : "Kept")),
    h("p", { class: "muted small" }, [item.price != null && money(item.price), item.serial && `S/N ${item.serial}`].filter(Boolean).join(" · ")),
    ret.deadline ? h("p", {}, `${ret.kind === "exchange" ? "Exchange" : "Return"} by `, h("strong", {}, fmt(ret.deadline)), r.returnLeft >= 0 ? ` (${r.returnLeft === 0 ? "today" : `${r.returnLeft} day${r.returnLeft === 1 ? "" : "s"} left`})` : " (closed)") : null,
    h("p", { class: "muted small" }, `Why: ${ret.reasons.join(", ")}.`),
    r.warranty ? h("p", {}, warrantyBadge(r.warranty, r.warrantyLeft)) : null,
    h("div", { class: "row tight" }, statusBtn("open", "Open"), statusBtn("returned", "Returned"), statusBtn("kept", "Keeping it")),
    item.status === "open" && ret.deadline && r.returnLeft >= 0 ? h("div", { class: "row tight" },
      h("label", { class: "inline" }, "Seen it cheaper? ", seen),
      h("button", { class: "btn small", type: "button", onclick: () => {
        const v = seen.value === "" ? null : Number(seen.value);
        setItem(purchase.id, item.id, { seenPrice: Number.isFinite(v) && v >= 0 ? v : null });
        rerender();
      } }, "Save")) : null,
    drop ? h("p", { class: "good-text small" }, `${money(drop)} cheaper now. Ask ${r.store?.name || "the store"} for a price adjustment, or return it and buy it again before ${fmt(ret.deadline)}.`) : null,
    h("div", { class: "row tight" },
      ret.kind !== "final" ? h("button", { class: "btn small", type: "button", onclick: () => openReturnKit(r) }, "Return checklist") : null,
      h("button", { class: "btn small", type: "button", onclick: () => openWarrantyKit(r) }, "Warranty claim email")));
}

