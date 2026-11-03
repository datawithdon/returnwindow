// Add or edit a purchase: snap/upload a receipt (OCR, optional Claude), then
// review the store, dates and items with a live return-by preview per item.

import { readWithClaude } from "../ai.js";
import { addDays, fmt, isYmd, today } from "../dates.js";
import { h, mount, toast } from "../dom.js";
import { readReceipt, toCanvas } from "../ocr.js";
import { parseReceipt } from "../parse.js";
import { canvasToBlob, deletePhoto, getPhoto, putPhoto } from "../photos.js";
import { guessCategory, returnInfo, storeFor, warrantyEnd } from "../policy.js";
import { RETAILERS, byId } from "../retailers.js";
import { addStore, getApiKey, getPurchase, newId, state, upsertPurchase } from "../store.js";

const WARRANTY = [[0, "None"], [3, "3 months"], [6, "6 months"], [12, "1 year"], [24, "2 years"], [36, "3 years"], [60, "5 years"]];
const OTHER = "__other";
const blankItem = () => ({ id: newId(), name: "", price: null, category: "", warrantyMonths: 0, serial: "", returnBy: "", status: "open", seenPrice: null });

let busy = false;

export function render(root, _params, editId) {
  const existing = editId ? getPurchase(editId) : null;
  if (editId && !existing) { mount(root, h("p", { class: "error" }, "Purchase not found.")); return; }

  const draft = existing ? structuredClone(existing) : {
    id: newId(), store: "", storeName: "", date: today(), deliveredOn: "", member: "", orderNumber: "", total: null, notes: "", hasPhoto: false, items: [blankItem()],
  };
  const other = { name: draft.storeName, days: "", clock: "purchase" };
  let storeChoice = draft.store || (draft.storeName ? OTHER : "");
  let canvas = null;          // new photo to save
  let removePhoto = false;

  const status = h("div", { class: "status", role: "status", "aria-live": "polite" });
  const preview = h("div", { class: "receipt-preview" });
  const formHost = h("div");
  const setStatus = (msg, kind = "") => { status.textContent = msg; status.className = `status ${kind}`; };

  // ----------------------------------------------------------- photo
  const camera = h("input", { type: "file", accept: "image/*", capture: "environment", class: "visually-hidden", id: "cam" });
  const picker = h("input", { type: "file", accept: "image/*", class: "visually-hidden", id: "pick" });
  const aiBtn = h("button", { class: "btn hidden", type: "button", onclick: () => runClaude() }, "Read with Claude");
  for (const input of [camera, picker]) {
    input.addEventListener("change", async () => {
      const f = input.files?.[0];
      input.value = "";
      if (f) await loadPhoto(f);
    });
  }

  async function loadPhoto(file) {
    if (busy) return;
    if (!/^image\//.test(file.type)) { setStatus("That file isn't an image.", "error"); return; }
    if (file.size > 30 * 1024 * 1024) { setStatus("That image is too large (over 30 MB).", "error"); return; }
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { setStatus("Couldn't open that image.", "error"); return; }
    canvas = toCanvas(bmp, 2400);
    bmp.close?.();
    removePhoto = false;
    showPreview(canvas.toDataURL("image/jpeg", 0.7));
    aiBtn.classList.toggle("hidden", !getApiKey());
    await runOcr();
  }

  function showPreview(src) {
    mount(preview, src ? h("img", { src, alt: "Receipt photo", class: "receipt-thumb" }) : null,
      src ? h("button", { class: "btn small", type: "button", onclick: () => { canvas = null; removePhoto = true; showPreview(null); aiBtn.classList.add("hidden"); } }, "Remove photo") : null);
  }

  async function runOcr() {
    busy = true;
    setStatus("Reading receipt on this device…");
    try {
      const { text, confidence } = await readReceipt(canvas, (m) => {
        if (m.status === "recognizing text") setStatus(`Reading receipt… ${Math.round(m.progress * 100)}%`);
        else if (/load|initiali/.test(m.status)) setStatus("Loading the text reader (first time only)…");
      });
      const parsed = parseReceipt(text, today());
      const weak = !parsed.items.length || !parsed.date || confidence < 55;
      apply(parsed);
      busy = false;
      if (weak && state.settings.autoAi && getApiKey()) { await runClaude(); return; }
      setStatus(weak
        ? `Read what I could (${parsed.items.length} item${parsed.items.length === 1 ? "" : "s"}). Check the details below${getApiKey() ? " or try Claude" : ""}.`
        : `Found ${parsed.items.length} item${parsed.items.length === 1 ? "" : "s"}. Check the details below.`, weak ? "" : "ok");
    } catch (e) {
      busy = false;
      setStatus(`Couldn't read the receipt here (${e?.message || "OCR failed"}). Fill in the details below.`, "error");
    }
  }

  async function runClaude() {
    if (!canvas || busy) return;
    busy = true;
    setStatus("Asking Claude to read the receipt…");
    try {
      const parsed = await readWithClaude(canvas, state.settings.model, today());
      apply(parsed, true);
      if (!parsed.store && parsed.storeText) { storeChoice = OTHER; other.name = parsed.storeText; drawForm(); }
      setStatus(`Claude found ${parsed.items.length} item${parsed.items.length === 1 ? "" : "s"}. Check the details below.`, "ok");
    } catch (e) {
      setStatus(e.message, "error");
    } finally {
      busy = false;
    }
  }

  /** Merge a parsed receipt into the draft. Items are replaced unless the user already typed some. */
  function apply(p, force = false) {
    if (p.store) { storeChoice = p.store; draft.store = p.store; }
    if (p.date) draft.date = p.date;
    if (p.total != null) draft.total = p.total;
    if (p.orderNumber) draft.orderNumber = p.orderNumber;
    const userTyped = draft.items.some((i) => i.name && !i.fromScan);
    if (p.items.length && (force || !userTyped)) {
      draft.items = p.items.map((i) => ({ ...blankItem(), name: i.name, price: i.price, returnBy: p.returnBy || "", fromScan: true }));
      regroup();
    }
    drawForm();
  }

  const currentStore = () => (storeChoice && storeChoice !== OTHER ? storeFor({ store: storeChoice }, state.stores) : storeChoice === OTHER && Number(other.days) > 0
    ? { name: other.name || "This store", days: Math.floor(Number(other.days)), clock: other.clock, categories: [], members: [], holiday: [], custom: true } : null);

  /** Re-guess categories for items the user hasn't categorised. */
  function regroup() {
    const s = currentStore();
    for (const i of draft.items) if (!i.category || i.fromScan) i.category = guessCategory(s, i.name);
  }

  // ----------------------------------------------------------- form
  function drawForm() {
    const store = currentStore();
    const bundled = byId(storeChoice);

    const storeSel = h("select", { id: "store" },
      h("option", { value: "" }, "Choose a store…"),
      h("optgroup", { label: "Retailers" }, [...RETAILERS].sort((a, b) => a.name.localeCompare(b.name)).map((r) => h("option", { value: r.id, selected: storeChoice === r.id }, r.name))),
      state.stores.length ? h("optgroup", { label: "Your stores" }, state.stores.map((s) => h("option", { value: s.id, selected: storeChoice === s.id }, `${s.name} (${s.days} days)`))) : null,
      h("option", { value: OTHER, selected: storeChoice === OTHER }, "Other store…"));
    storeSel.addEventListener("change", () => {
      storeChoice = storeSel.value;
      draft.member = "";
      for (const i of draft.items) if (!i.manualCategory) i.category = "";
      regroup();
      drawForm();
    });

    const otherBox = storeChoice === OTHER ? h("div", { class: "form-grid" },
      h("label", {}, "Store name", input("text", other.name, (v) => { other.name = v; }, { maxlength: "60", required: true })),
      h("label", {}, "Return window (days)", input("number", other.days, (v) => { other.days = v; updatePreviews(); }, { min: "1", max: "3650", inputmode: "numeric", placeholder: "e.g. 30" })),
      h("label", {}, "Counted from", select([["purchase", "Purchase date"], ["delivery", "Delivery date"]], other.clock, (v) => { other.clock = v; updatePreviews(); })),
      h("p", { class: "muted small span2" }, "The window is saved as one of your stores so you can reuse it. Leave it blank to enter return-by dates per item.")) : null;

    const memberSel = bundled?.members.length
      ? h("label", {}, "Membership / store card",
        select([["", "None"], ...bundled.members.map((m) => [m.key, `${m.label} (${m.days} days)`])], draft.member, (v) => { draft.member = v; updatePreviews(); }))
      : null;

    mount(formHost,
      h("label", { for: "store" }, "Store"), storeSel,
      bundled ? h("p", { class: "muted small" }, bundled.anytime ? "Most items: no time limit." : `Standard window: ${bundled.days} days from ${bundled.clock}.`, " ", h("a", { href: `#/stores?q=${encodeURIComponent(bundled.name)}` }, "Policy details")) : null,
      otherBox,
      h("div", { class: "form-grid" },
        h("label", {}, "Purchase date", input("date", draft.date, (v) => { draft.date = v; updatePreviews(); }, { max: addDays(today(), 1), required: true })),
        h("label", {}, store?.clock === "delivery" ? "Delivered on (online orders)" : "Delivered on (optional)", input("date", draft.deliveredOn, (v) => { draft.deliveredOn = v; updatePreviews(); })),
        memberSel,
        h("label", {}, "Order / receipt #", input("text", draft.orderNumber, (v) => { draft.orderNumber = v; }, { maxlength: "40" })),
        h("label", {}, "Total paid", input("number", draft.total ?? "", (v) => { draft.total = v === "" ? null : Number(v); }, { min: "0", step: "0.01", inputmode: "decimal" }))),
      h("h2", {}, `Items (${draft.items.length})`),
      h("div", { class: "items-edit" }, draft.items.map(itemEditor)),
      h("button", { class: "btn", type: "button", onclick: () => { draft.items.push(blankItem()); drawForm(); } }, "+ Add item"),
      h("label", { for: "notes" }, "Notes"),
      h("textarea", { id: "notes", rows: "2", maxlength: "500", oninput: (e) => { draft.notes = e.target.value; } }, draft.notes),
      h("div", { class: "row sticky-actions" },
        h("button", { class: "btn primary", type: "button", onclick: submit }, existing ? "Save changes" : "Save purchase"),
        h("a", { class: "btn", href: existing ? `#/purchase/${existing.id}` : "#/timeline" }, "Cancel")));
    updatePreviews();
  }

  function itemEditor(item, idx) {
    const store = currentStore();
    const cats = [["", "Standard window"], ...(store?.categories || []).map((c) => [c.key, c.final ? `${c.label} (final sale)` : c.exchange ? `${c.label} (exchange only)` : `${c.label} (${c.days} days)`])];
    return h("fieldset", { class: "item-edit" },
      h("legend", { class: "visually-hidden" }, `Item ${idx + 1}`),
      h("div", { class: "form-grid" },
        h("label", { class: "span2" }, "Item", input("text", item.name, (v) => { item.name = v; item.fromScan = false; }, { maxlength: "80", placeholder: "e.g. Noise-cancelling headphones" })),
        h("label", {}, "Price", input("number", item.price ?? "", (v) => { item.price = v === "" ? null : Number(v); }, { min: "0", step: "0.01", inputmode: "decimal" })),
        cats.length > 1 ? h("label", {}, "Policy category", select(cats, item.category, (v) => { item.category = v; item.manualCategory = true; updatePreviews(); })) : null,
        h("label", {}, "Warranty", select(WARRANTY.map(([m, l]) => [String(m), l]), String(item.warrantyMonths || 0), (v) => { item.warrantyMonths = Number(v); updatePreviews(); })),
        h("label", {}, "Serial # (optional)", input("text", item.serial, (v) => { item.serial = v; }, { maxlength: "60", autocapitalize: "characters", spellcheck: "false" })),
        h("label", {}, "Printed return-by (optional)", input("date", item.returnBy, (v) => { item.returnBy = v; updatePreviews(); }))),
      h("div", { class: "row tight between" },
        h("span", { class: "deadline-preview small", "data-item": item.id }),
        draft.items.length > 1 ? h("button", { class: "btn small danger", type: "button", onclick: () => { draft.items.splice(idx, 1); drawForm(); } }, "Remove") : null));
  }

  function updatePreviews() {
    const store = currentStore();
    for (const item of draft.items) {
      const el = formHost.querySelector(`[data-item="${item.id}"]`);
      if (!el) continue;
      if (!isYmd(draft.date)) { el.textContent = "Set the purchase date to see the deadline."; continue; }
      const ret = returnInfo(draft, item, store);
      const w = warrantyEnd(draft, item);
      const parts = [
        ret.kind === "window" ? `Return by ${fmt(ret.deadline)}` : ret.kind === "exchange" ? `Exchange by ${fmt(ret.deadline)}` : ret.kind === "final" ? "Final sale: not returnable" : ret.kind === "anytime" ? "No time limit" : "Return window unknown",
        w ? `warranty to ${fmt(w)}` : "",
      ].filter(Boolean);
      el.textContent = `${parts.join(" · ")}${ret.reasons.length ? ` (${ret.reasons.join(", ")})` : ""}`;
    }
  }

  async function submit() {
    if (!isYmd(draft.date) || draft.date > addDays(today(), 1)) { toast("Enter a valid purchase date."); return; }
    const items = draft.items.filter((i) => i.name.trim());
    if (!items.length) { toast("Add at least one item."); return; }
    let storeId = storeChoice === OTHER ? "" : storeChoice;
    let storeNameText = "";
    if (storeChoice === OTHER) {
      if (!other.name.trim()) { toast("Enter the store name."); return; }
      if (other.days !== "" && Number(other.days) > 0) {
        const match = state.stores.find((s) => s.name.toLowerCase() === other.name.trim().toLowerCase() && s.days === Math.floor(Number(other.days)) && s.clock === other.clock);
        const s = match || addStore({ name: other.name, days: Math.floor(Number(other.days)), clock: other.clock });
        if (!s) { toast("Return window must be 1–3650 days."); return; }
        storeId = s.id;
      } else {
        storeNameText = other.name;
      }
    }
    if (!storeId && !storeNameText) { toast("Choose a store."); return; }

    const saved = upsertPurchase({
      ...draft, store: storeId, storeName: storeNameText,
      items: items.map(({ fromScan, manualCategory, ...i }) => i),
      hasPhoto: removePhoto ? false : (canvas ? true : draft.hasPhoto),
    });
    if (!saved) { toast("Couldn't save. Check the date and items."); return; }
    try {
      if (canvas) {
        const blob = await canvasToBlob(canvas);
        if (blob) await putPhoto(saved.id, blob);
      } else if (removePhoto) await deletePhoto(saved.id);
    } catch {
      upsertPurchase({ ...saved, hasPhoto: false });
      toast("Saved, but the receipt photo couldn't be stored (storage full?).");
    }
    location.hash = `#/purchase/${saved.id}`;
  }

  // ----------------------------------------------------------- page
  mount(root, h("section", { class: "panel narrow" },
    h("h1", {}, existing ? "Edit purchase" : "Add a receipt"),
    h("div", { class: "row" },
      h("label", { class: "btn primary", for: "cam" }, "Take photo"), camera,
      h("label", { class: "btn", for: "pick" }, "Choose image"), picker,
      aiBtn),
    h("p", { class: "muted small" }, "Paper receipts and screenshots of order confirmations both work. The photo is read on this device", getApiKey() ? " (or by Claude, if you choose)" : "", ". You can also just fill in the form."),
    status, preview, formHost));

  if (existing?.hasPhoto) {
    getPhoto(existing.id).then((blob) => {
      if (!blob || canvas || removePhoto) return;
      const url = URL.createObjectURL(blob);
      showPreview(url);
    });
  }
  drawForm();
}

function input(type, value, onInput, attrs = {}) {
  const el = h("input", { type, value: value ?? "", ...attrs });
  el.addEventListener("input", () => onInput(el.value));
  return el;
}

function select(options, value, onChange) {
  const el = h("select", {}, options.map(([v, l]) => h("option", { value: v, selected: v === value }, l)));
  el.addEventListener("change", () => onChange(el.value));
  return el;
}
