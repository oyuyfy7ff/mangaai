// Image and storage helpers shared by Panels and Translate.
// Pictures stay on the phone: Panels keeps them in IndexedDB (localStorage is too small).
const MAX_IMG = 1280;                    // longest side after scaling, keeps storage and uploads small
const MAX_FILE = 25 * 1024 * 1024;

// Reads a picked file and returns { blob, width, height }, scaled down and re-encoded as JPEG.
function loadImageFile(file) {
  return new Promise(function (resolve, reject) {
    if (!file || !/^image\//.test(file.type)) { reject(new Error("not-image")); return; }
    if (file.size > MAX_FILE) { reject(new Error("too-big")); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_IMG / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff";         // image content, not UI: transparent PNG becomes white
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      c.toBlob(function (blob) {
        if (blob) resolve({ blob: blob, width: w, height: h });
        else reject(new Error("decode"));
      }, "image/jpeg", 0.85);
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("decode")); };
    img.src = url;
  });
}

function imageErrorText(e) {
  const m = e && e.message;
  if (m === "not-image") return "ไฟล์นี้ไม่ใช่รูปภาพ";
  if (m === "too-big") return "รูปใหญ่เกินไป (เกิน 25 MB) เลือกรูปอื่น";
  return "เปิดรูปนี้ไม่ได้ ลองรูปอื่น";
}

function blobToDataUrl(blob) {
  return new Promise(function (resolve, reject) {
    const r = new FileReader();
    r.onload = function () { resolve(String(r.result)); };
    r.onerror = function () { reject(new Error("read")); };
    r.readAsDataURL(blob);
  });
}

// IndexedDB: one store "panels", records { id, image (Blob), dialogue, created }.
function openDb() {
  return new Promise(function (resolve, reject) {
    if (!window.indexedDB) { reject(new Error("no-db")); return; }
    const req = indexedDB.open("mangaai", 1);
    req.onupgradeneeded = function () {
      req.result.createObjectStore("panels", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error || new Error("db")); };
  });
}

function dbRun(mode, work) {
  return openDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction("panels", mode);
      const req = work(tx.objectStore("panels"));
      tx.oncomplete = function () { db.close(); resolve(req ? req.result : undefined); };
      tx.onerror = function () { db.close(); reject(tx.error || new Error("db")); };
      tx.onabort = function () { db.close(); reject(tx.error || new Error("db")); };
    });
  });
}

function dbAll() { return dbRun("readonly", function (s) { return s.getAll(); }); }
function dbPut(rec) { return dbRun("readwrite", function (s) { return s.put(rec); }); }
function dbDelete(id) { return dbRun("readwrite", function (s) { return s.delete(id); }); }
