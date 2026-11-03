// Entry point: hash router, nav badge, reminders, service worker.

import { $, $$ } from "./dom.js";
import { checkReminders, urgentCount } from "./notify.js";
import { load, onChange } from "./store.js";
import { closeModal } from "./ui.js";
import * as add from "./views/add.js";
import * as purchase from "./views/purchase.js";
import * as settings from "./views/settings.js";
import * as stores from "./views/stores.js";
import * as timeline from "./views/timeline.js";

const ROUTES = { timeline, add, edit: add, purchase, stores, settings };

function route() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const [name, arg] = path.split("/");
  const view = Object.hasOwn(ROUTES, name) ? name : "timeline";
  closeModal();
  const navView = view === "edit" || view === "purchase" ? "timeline" : view;
  for (const a of $$("header nav a")) a.toggleAttribute("aria-current", a.dataset.view === navView);
  const root = $("#view");
  let id = "";
  try { id = arg ? decodeURIComponent(arg) : ""; } catch { id = ""; }
  ROUTES[view].render(root, new URLSearchParams(query), id);
  root.focus({ preventScroll: true });
  scrollTo(0, 0);
}

function updateBadge() {
  const n = urgentCount();
  const b = $("#nav-urgent");
  b.textContent = n ? String(n) : "";
  b.classList.toggle("hidden", !n);
}

// GitHub Pages can't send X-Frame-Options and a <meta> CSP can't set
// frame-ancestors, so refuse to run inside another site's frame (clickjacking).
if (window.top !== window.self) {
  document.body.replaceChildren(Object.assign(document.createElement("p"), { className: "empty", textContent: "ReturnWindow can't run inside another site. Open it directly." }));
  throw new Error("framed");
}

load();
onChange(updateBadge);
updateBadge();
addEventListener("hashchange", route);
addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#modal").classList.contains("hidden")) closeModal(); });
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
route();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Reminders: on open, when the app comes back to the foreground, and hourly.
checkReminders();
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { checkReminders(); updateBadge(); } });
setInterval(checkReminders, 60 * 60 * 1000);
