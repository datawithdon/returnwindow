// Offline shell: same-origin files are served cache-first and refreshed in the
// background. Cross-origin requests (the Claude API) are never cached here.

const CACHE = "returnwindow-v2";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/styles.css", "icons/icon.svg",
  "js/app.js", "js/tt.js", "js/dom.js", "js/dates.js", "js/retailers.js", "js/policy.js", "js/parse.js", "js/store.js",
  "js/photos.js", "js/ocr.js", "js/ai.js", "js/notify.js", "js/claims.js", "js/ui.js",
  "js/views/timeline.js", "js/views/add.js", "js/views/purchase.js", "js/views/stores.js", "js/views/settings.js",
  "vendor/tesseract/tesseract.esm.min.js", "vendor/tesseract/worker.min.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("returnwindow-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then((res) => {
      if (res.ok && res.type === "basic") cache.put(e.request, res.clone());
      return res;
    }).catch(() => hit);
    return hit || fresh;
  }));
});

// Tapping a reminder focuses the open app (or opens it) on the timeline.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL("./#/timeline", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.startsWith(self.registration.scope));
    if (open) { open.navigate?.(target); return open.focus(); }
    return self.clients.openWindow(target);
  }));
});
