// Shared UI pieces: modal host, deadline badges, policy summaries and claim-kit sheets.

import { returnChecklist, warrantyEmail } from "./claims.js";
import { fmt } from "./dates.js";
import { $, copyText, h, mount, toast } from "./dom.js";
import { getPhoto } from "./photos.js";
import { urgency } from "./policy.js";
import { CHECKED } from "./retailers.js";
import { storeName } from "./store.js";

// ----------------------------------------------------------------- modal

let lastFocus = null;
export function openModal(label, ...content) {
  const host = $("#modal");
  lastFocus = document.activeElement;
  mount(host, h("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": label },
    h("button", { class: "icon-btn close", type: "button", "aria-label": "Close", onclick: closeModal }, "×"),
    ...content));
  host.classList.remove("hidden");
  document.body.classList.add("modal-open");
  host.querySelector(".close").focus();
}

export function closeModal() {
  const host = $("#modal");
  host.classList.add("hidden");
  host.replaceChildren();
  document.body.classList.remove("modal-open");
  lastFocus?.focus?.();
}

// ----------------------------------------------------------------- badges

/** Coloured "5 days left" pill for a return deadline. */
export function deadlineBadge(ret, daysLeft) {
  if (ret.kind === "final") return h("span", { class: "pill expired" }, "Final sale");
  if (ret.kind === "anytime") return h("span", { class: "pill ok" }, "No time limit");
  if (ret.kind === "unknown") return h("span", { class: "pill none" }, "Window unknown");
  const u = urgency(daysLeft);
  const label = daysLeft < 0 ? "Closed" : daysLeft === 0 ? "Last day" : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`;
  return h("span", { class: `pill ${u}` }, ret.kind === "exchange" ? `Exchange · ${label}` : label);
}

export function warrantyBadge(end, left) {
  if (!end) return null;
  return h("span", { class: `pill ${left < 0 ? "expired" : left <= 30 ? "soon" : "warranty"}` }, left < 0 ? "Warranty ended" : `Warranty to ${fmt(end)}`);
}

/** "Checked Nov 2, 2026 · read from the store's page" + source link. */
export function sourceLine(store) {
  if (!store || store.custom) return h("p", { class: "muted small" }, "Your own store rule.");
  return h("p", { class: "muted small" },
    `Checked ${fmt(CHECKED)} · `,
    store.verified === "page" ? "read from the store's policy page" : "from the store's own site via search (confirm before a close call)",
    " · ",
    h("a", { href: store.source, target: "_blank", rel: "noopener noreferrer" }, `${store.domain} ↗`));
}

/** One-line summary of a store's windows, e.g. "90 days from purchase · Electronics 30 · Apple 14". */
export function policySummary(store) {
  if (!store) return "";
  const base = store.anytime ? "No time limit for most items" : `${store.days} days from ${store.clock === "delivery" ? "delivery" : "purchase"}`;
  return base;
}

// ----------------------------------------------------------------- claim kit

async function shareKit(title, text, purchase) {
  const data = { title, text };
  if (purchase.hasPhoto) {
    const blob = await getPhoto(purchase.id);
    if (blob) {
      const file = new File([blob], "receipt.jpg", { type: blob.type || "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) data.files = [file];
    }
  }
  try { await navigator.share(data); } catch (e) { if (e?.name !== "AbortError") toast("Sharing isn't available here; use Copy."); }
}

export function openReturnKit(row) {
  const text = returnChecklist({ ...row, storeLabel: storeName(row.purchase) });
  openModal("Return checklist",
    h("h2", {}, "Return checklist"),
    h("pre", { class: "kit" }, text),
    h("div", { class: "row" },
      h("button", { class: "btn primary", type: "button", onclick: () => copyText(text) }, "Copy"),
      navigator.share ? h("button", { class: "btn", type: "button", onclick: () => shareKit(`Return ${row.item.name}`, text, row.purchase) }, "Share with receipt") : null));
}

export function openWarrantyKit(row) {
  const { subject, body } = warrantyEmail({ ...row, storeLabel: storeName(row.purchase) });
  const full = `Subject: ${subject}\n\n${body}`;
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  openModal("Warranty claim",
    h("h2", {}, "Warranty claim email"),
    h("p", { class: "muted small" }, "Fill in the [brackets], then send it to the manufacturer's support address. Attach the receipt photo."),
    h("pre", { class: "kit" }, full),
    h("div", { class: "row" },
      h("button", { class: "btn primary", type: "button", onclick: () => copyText(full) }, "Copy"),
      h("a", { class: "btn", href: mailto }, "Open in email"),
      navigator.share ? h("button", { class: "btn", type: "button", onclick: () => shareKit(subject, full, row.purchase) }, "Share with receipt") : null));
}
