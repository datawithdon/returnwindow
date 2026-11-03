// Settings: reminders, Claude vision key/model, backup/restore (optionally with photos), wipe.

import { download, h, mount, toast } from "../dom.js";
import { checkReminders } from "../notify.js";
import { allPhotoIds, blobToDataUrl, clearPhotos, dataUrlToBlob, getPhoto, putPhoto } from "../photos.js";
import { MODELS, STORAGE_KEY, getApiKey, keyRemembered, replaceAll, save, setApiKey, state } from "../store.js";

const MAX_BACKUP_BYTES = 200 * 1024 * 1024;

export function render(root) {
  const s = state.settings;

  const toggle = (id, label, prop, onOn) => {
    const box = h("input", { type: "checkbox", id, checked: s[prop] });
    box.addEventListener("change", async () => {
      s[prop] = box.checked;
      if (box.checked && onOn && !(await onOn())) { s[prop] = false; box.checked = false; }
      save();
    });
    return h("label", { class: "check", for: id }, box, " ", label);
  };

  const askNotify = async () => {
    if (typeof Notification === "undefined") { toast("This browser doesn't support notifications. On iPhone, add ReturnWindow to your Home Screen first."); return false; }
    const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (p !== "granted") { toast("Notifications are blocked for this site."); return false; }
    checkReminders();
    return true;
  };

  const lead = h("select", { id: "lead" }, [1, 2, 3, 5, 7, 14].map((d) => h("option", { value: String(d), selected: s.leadDays === d }, `${d} day${d === 1 ? "" : "s"} before`)));
  lead.addEventListener("change", () => { s.leadDays = Number(lead.value); save(); });

  const key = h("input", { id: "key", type: "password", autocomplete: "off", spellcheck: "false", placeholder: getApiKey() ? "•••••••• (saved)" : "sk-ant-…" });
  const remember = h("input", { type: "checkbox", id: "remember", checked: keyRemembered() });
  const model = h("select", { id: "model" }, Object.entries(MODELS).map(([id, label]) => h("option", { value: id, selected: s.model === id }, label)));
  model.addEventListener("change", () => { s.model = model.value; save(); });
  const saveKey = () => {
    const v = key.value.trim();
    if (v && !/^sk-ant-[A-Za-z0-9_-]{20,200}$/.test(v)) { toast("That doesn't look like a Claude API key."); return; }
    setApiKey(v || getApiKey(), remember.checked);
    key.value = "";
    key.placeholder = getApiKey() ? "•••••••• (saved)" : "sk-ant-…";
    toast(getApiKey() ? "Key saved" : "No key set");
  };
  const forget = () => { setApiKey("", false); remember.checked = false; key.placeholder = "sk-ant-…"; toast("Key removed"); };

  const withPhotos = h("input", { type: "checkbox", id: "withphotos", checked: true });
  const backup = async () => {
    const photos = {};
    if (withPhotos.checked) {
      for (const id of await allPhotoIds()) {
        if (!state.purchases.some((p) => p.id === id)) continue;
        const blob = await getPhoto(id);
        if (blob) photos[id] = await blobToDataUrl(blob);
      }
    }
    download(`returnwindow-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: "returnwindow", ...state, photos }), "application/json");
  };

  const file = h("input", { type: "file", accept: "application/json,.json", class: "visually-hidden", id: "restore" });
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    file.value = "";
    if (!f) return;
    if (f.size > MAX_BACKUP_BYTES) { toast("Backup file is too large."); return; }
    let data;
    try { data = JSON.parse(await f.text()); } catch { toast("That file isn't valid JSON."); return; }
    if (!data || typeof data !== "object" || data.app !== "returnwindow" || !Array.isArray(data.purchases)) { toast("That isn't a ReturnWindow backup."); return; }
    if (!confirm(`Replace your current data with this backup (${data.purchases.length} purchases)?`)) return;
    replaceAll(data);
    await clearPhotos();
    let restored = 0;
    const photos = data.photos && typeof data.photos === "object" ? data.photos : {};
    for (const p of state.purchases) {
      const blob = Object.hasOwn(photos, p.id) ? dataUrlToBlob(photos[p.id]) : null;
      if (blob) { await putPhoto(p.id, blob); restored++; }
      p.hasPhoto = Boolean(blob);
    }
    save();
    toast(`Restored ${state.purchases.length} purchases and ${restored} receipt photos`);
    render(root);
  });

  const wipe = async () => {
    if (!confirm("Delete every purchase, receipt photo, custom store, setting and saved API key from this browser? This can't be undone.")) return;
    setApiKey("", false);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    await clearPhotos();
    replaceAll(null);
    toast("All ReturnWindow data deleted from this browser");
    render(root);
  };

  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !matchMedia("(display-mode: standalone)").matches;

  mount(root, h("section", { class: "panel narrow" },
    h("h1", {}, "Settings"),

    h("h2", {}, "Reminders"),
    h("p", { class: "muted small" }, "ReturnWindow has no server, so reminders appear when you open the app (and hourly while it's open). The app icon shows a badge for windows closing soon, where your phone supports it."),
    toggle("notify", "Show a notification when a return window is closing", "notify", askNotify),
    ios ? h("p", { class: "muted small" }, "On iPhone, notifications only work after you add ReturnWindow to your Home Screen (Share → Add to Home Screen).") : null,
    h("label", { for: "lead" }, "Warn me"), lead,

    h("h2", {}, "Claude vision (optional)"),
    h("p", { class: "muted small" }, "For faded, crumpled or long receipts, ReturnWindow can send the photo to Claude using your own API key. The key stays in this browser and is cleared when the tab closes unless you tick Remember. It is only ever sent to api.anthropic.com. Each receipt costs about a cent."),
    h("label", { for: "key" }, "API key"), key,
    h("label", { class: "check", for: "remember" }, remember, " Remember on this device"),
    h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: saveKey }, "Save key"), h("button", { class: "btn", type: "button", onclick: forget }, "Remove key")),
    h("label", { for: "model" }, "Model"), model,
    toggle("autoai", "Use Claude automatically when the on-device reader isn't sure", "autoAi"),

    h("h2", {}, "Your data"),
    h("p", { class: "muted small" }, "Everything is stored only in this browser. Download a backup to move it to another device or keep it safe. Backups never include your API key."),
    h("label", { class: "check", for: "withphotos" }, withPhotos, " Include receipt photos in the backup"),
    h("div", { class: "row" },
      h("button", { class: "btn", type: "button", onclick: backup }, "Download backup"),
      h("label", { class: "btn", for: "restore" }, "Restore backup"), file,
      h("button", { class: "btn danger", type: "button", onclick: wipe }, "Delete all data"))));
}
