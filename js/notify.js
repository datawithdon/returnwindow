// Deadline reminders. A static site has no server to push from, so reminders
// fire when the app is opened or brought back to the foreground (and hourly
// while it stays open). Each item is announced once per threshold: the lead
// time from Settings, then 1 day left and the last day.

import { today } from "./dates.js";
import { returnable, timeline } from "./policy.js";
import { save, state, storeName } from "./store.js";

/** Pick reminders due now. Pure: returns { due: [{ key, title, body, tag }], keys }. */
export function dueReminders(rows, leadDays, notified) {
  const sent = new Set(notified);
  const due = [];
  for (const r of returnable(rows)) {
    const level = [0, 1, leadDays].filter((l, i, a) => a.indexOf(l) === i).sort((a, b) => a - b).find((l) => r.returnLeft <= l);
    if (level == null) continue;
    const key = `${r.item.id}:${r.ret.deadline}:${level}`;
    if (sent.has(key)) continue;
    const when = r.returnLeft === 0 ? "today is the last day" : r.returnLeft === 1 ? "1 day left" : `${r.returnLeft} days left`;
    due.push({ key, tag: r.item.id, title: `Return window: ${when}`, body: `${r.item.name} from ${storeName(r.purchase)}` });
  }
  return due;
}

/** Number of items whose window closes within the lead time (for the nav and app badge). */
export function urgentCount(rows = timeline(state.purchases, state.stores, today())) {
  return returnable(rows).filter((r) => r.returnLeft <= state.settings.leadDays).length;
}

export function updateAppBadge(n) {
  try {
    if (n && navigator.setAppBadge) navigator.setAppBadge(n).catch(() => {});
    else if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  } catch { /* unsupported */ }
}

export async function checkReminders() {
  const rows = timeline(state.purchases, state.stores, today());
  updateAppBadge(urgentCount(rows));
  if (!state.settings.notify || typeof Notification === "undefined" || Notification.permission !== "granted") return 0;
  const due = dueReminders(rows, state.settings.leadDays, state.notified);
  if (!due.length) return 0;
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => null);
  for (const n of due.slice(0, 5)) {
    const opts = { body: n.body, tag: n.tag, icon: "icons/icon.svg", data: { url: "./#/timeline" } };
    try {
      if (reg?.showNotification) await reg.showNotification(n.title, opts);
      else new Notification(n.title, opts);
    } catch { /* blocked or unsupported (e.g. iOS outside an installed app) */ }
  }
  // Everything due is marked sent, even past the first five, so a long backlog doesn't spam later.
  state.notified = [...state.notified, ...due.map((n) => n.key)].slice(-2000);
  save();
  return due.length;
}
