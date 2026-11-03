// App state: purchases (with their items), custom stores and settings,
// persisted in localStorage. Receipt photos live in IndexedDB (photos.js).
// Everything read back from storage or an imported backup goes through
// sanitize(), which rebuilds each record from known fields with type and
// length checks, so a tampered backup can't smuggle odd values into the app.

import { isYmd } from "./dates.js";
import { byId } from "./retailers.js";

export const STORAGE_KEY = "returnwindow.v1";
const MAX_PURCHASES = 5000;
const MAX_ITEMS = 60;

export const MODELS = {
  "claude-opus-5-5": "Claude Opus 5.5 (most accurate)",
  "claude-sonnet-5-5": "Claude Sonnet 5.5 (faster, cheaper)",
  "claude-haiku-5-5": "Claude Haiku 5.5 (cheapest)",
};
export const DEFAULT_MODEL = "claude-opus-5-5";
export const STATUSES = ["open", "returned", "kept"];

const str = (v, max = 120) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const num = (v, min = 0, max = 1e7) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? Math.round(v * 100) / 100 : null);
const int = (v, min, max, dflt) => (Number.isInteger(v) && v >= min && v <= max ? v : dflt);
const ymd = (v) => (isYmd(v) ? v : "");
const ID_RE = /^[a-z0-9-]{4,40}$/;
const KEY_RE = /^[a-z0-9-]{1,30}$/;

let seq = 0;
export const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const id = (v) => (typeof v === "string" && ID_RE.test(v) ? v : newId());

export function cleanStore(x) {
  if (!x || typeof x !== "object") return null;
  const name = str(x.name, 60);
  const days = int(x.days, 1, 3650, null);
  if (!name || days == null) return null;
  return { id: typeof x.id === "string" && /^c-[a-z0-9]{4,40}$/.test(x.id) ? x.id : `c-${newId()}`, name, days, clock: x.clock === "delivery" ? "delivery" : "purchase", categories: [], members: [], holiday: [], custom: true };
}

export function cleanItem(x) {
  if (!x || typeof x !== "object") return null;
  const name = str(x.name, 80);
  if (!name) return null;
  return {
    id: id(x.id),
    name,
    price: num(x.price),
    category: typeof x.category === "string" && KEY_RE.test(x.category) ? x.category : "",
    warrantyMonths: int(x.warrantyMonths, 0, 600, 0),
    serial: str(x.serial, 60),
    returnBy: ymd(x.returnBy),
    status: STATUSES.includes(x.status) ? x.status : "open",
    seenPrice: num(x.seenPrice),
  };
}

export function cleanPurchase(x, customIds = new Set()) {
  if (!x || typeof x !== "object" || !isYmd(x.date)) return null;
  const items = (Array.isArray(x.items) ? x.items : []).slice(0, MAX_ITEMS).map(cleanItem).filter(Boolean);
  if (!items.length) return null;
  const storeId = typeof x.store === "string" && (byId(x.store) || customIds.has(x.store)) ? x.store : "";
  const store = byId(storeId);
  const member = store && store.members.some((m) => m.key === x.member) ? x.member : "";
  return {
    id: id(x.id),
    store: storeId,
    storeName: storeId ? "" : str(x.storeName, 60),
    date: x.date,
    deliveredOn: ymd(x.deliveredOn),
    member,
    orderNumber: str(x.orderNumber, 40),
    total: num(x.total),
    notes: str(x.notes, 500),
    hasPhoto: x.hasPhoto === true,
    items,
    createdAt: typeof x.createdAt === "string" && !Number.isNaN(Date.parse(x.createdAt)) ? x.createdAt.slice(0, 30) : new Date().toISOString(),
  };
}

export function cleanSettings(x) {
  const s = x && typeof x === "object" ? x : {};
  return {
    model: Object.hasOwn(MODELS, s.model) ? s.model : DEFAULT_MODEL,
    autoAi: s.autoAi === true,
    notify: s.notify === true,
    leadDays: int(s.leadDays, 1, 30, 3),
  };
}

/** Rebuild a whole state object from untrusted input. */
export function sanitize(raw) {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const stores = (Array.isArray(r.stores) ? r.stores : []).slice(0, 200).map(cleanStore).filter(Boolean);
  const customIds = new Set(stores.map((s) => s.id));
  const seen = new Set();
  const purchases = (Array.isArray(r.purchases) ? r.purchases : []).slice(0, MAX_PURCHASES)
    .map((p) => cleanPurchase(p, customIds)).filter((p) => p && !seen.has(p.id) && seen.add(p.id));
  const notified = (Array.isArray(r.notified) ? r.notified : []).filter((k) => typeof k === "string" && /^[a-z0-9-]{4,40}:\d{4}-\d{2}-\d{2}:\d{1,2}$/.test(k)).slice(-2000);
  return { version: 1, purchases, stores, settings: cleanSettings(r.settings), notified };
}

// ------------------------------------------------------------- persistence

export const state = sanitize(null);
const listeners = new Set();

export function load(storage = globalThis.localStorage) {
  let raw = null;
  try { raw = JSON.parse(storage?.getItem(STORAGE_KEY) || "null"); } catch { raw = null; }
  Object.assign(state, sanitize(raw));
}

export function save(storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  } finally {
    for (const fn of listeners) fn();
  }
}

export const onChange = (fn) => listeners.add(fn);

export function replaceAll(raw) {
  Object.assign(state, sanitize(raw));
  return save();
}

// ------------------------------------------------------------- records

export const getPurchase = (pid) => state.purchases.find((p) => p.id === pid) || null;

/** Insert or replace a purchase. Returns the cleaned record, or null if invalid. */
export function upsertPurchase(raw) {
  const p = cleanPurchase(raw, new Set(state.stores.map((s) => s.id)));
  if (!p) return null;
  const i = state.purchases.findIndex((x) => x.id === p.id);
  if (i >= 0) state.purchases[i] = p; else state.purchases.unshift(p);
  save();
  return p;
}

export function deletePurchase(pid) {
  state.purchases = state.purchases.filter((p) => p.id !== pid);
  save();
}

export function setItem(pid, itemId, patch) {
  const p = getPurchase(pid);
  const item = p?.items.find((i) => i.id === itemId);
  if (!item) return null;
  const next = cleanItem({ ...item, ...patch });
  if (next) Object.assign(item, next);
  save();
  return item;
}

export function addStore(raw) {
  const s = cleanStore(raw);
  if (s) { state.stores.push(s); save(); }
  return s;
}

export function removeStore(sid) {
  if (state.purchases.some((p) => p.store === sid)) return false;
  state.stores = state.stores.filter((s) => s.id !== sid);
  save();
  return true;
}

/** Display name for a purchase's store. */
export function storeName(p) {
  return byId(p.store)?.name || state.stores.find((s) => s.id === p.store)?.name || p.storeName || "Unknown store";
}

// ------------------------------------------------------------- API key

const KEY_NAME = "returnwindow.apiKey";
// Kept in sessionStorage (cleared when the tab closes) unless the user opts
// to remember it on this device. It is never written into backups.
export function getApiKey() {
  try { return sessionStorage.getItem(KEY_NAME) || localStorage.getItem(KEY_NAME) || ""; } catch { return ""; }
}
export function setApiKey(key, remember) {
  try {
    sessionStorage.removeItem(KEY_NAME);
    localStorage.removeItem(KEY_NAME);
    if (!key) return;
    (remember ? localStorage : sessionStorage).setItem(KEY_NAME, key);
  } catch { /* storage blocked: key is not kept */ }
}
export function keyRemembered() {
  try { return Boolean(localStorage.getItem(KEY_NAME)); } catch { return false; }
}
