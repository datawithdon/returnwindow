// Receipt photos, stored as JPEG blobs in IndexedDB keyed by purchase id.
// localStorage is too small for images, and blobs never leave the device
// except inside a backup the user downloads.

const DB = "returnwindow";
const STORE = "receipts";
const MAX_SIDE = 1800;
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

let dbPromise = null;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const putPhoto = (id, blob) => tx("readwrite", (s) => s.put(blob, id));
export const getPhoto = (id) => tx("readonly", (s) => s.get(id)).catch(() => null);
export const deletePhoto = (id) => tx("readwrite", (s) => s.delete(id)).catch(() => {});
export const clearPhotos = () => tx("readwrite", (s) => s.clear()).catch(() => {});
export const allPhotoIds = () => tx("readonly", (s) => s.getAllKeys()).catch(() => []);

/** Compress a canvas to a JPEG blob for storage. */
export function canvasToBlob(canvas) {
  const scale = Math.min(1, MAX_SIDE / Math.max(canvas.width, canvas.height));
  const c = document.createElement("canvas");
  c.width = Math.round(canvas.width * scale);
  c.height = Math.round(canvas.height * scale);
  c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob(resolve, "image/jpeg", 0.8));
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Decode a backup's data URL back into a blob. Only base64 JPEG/PNG/WebP under the size cap is accepted. */
export function dataUrlToBlob(url) {
  const m = typeof url === "string" && /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url);
  if (!m || m[2].length * 0.75 > MAX_PHOTO_BYTES) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}
