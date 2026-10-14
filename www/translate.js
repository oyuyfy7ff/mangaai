// Translate screen: pick a manga page, the model finds each speech box and translates it to Thai,
// then the text is covered on a canvas and the Thai text is drawn in the same place.
// The picture is sent to the model provider (OpenRouter) and is not kept after the app closes.
// Needs settings.js, write.js (askModel) and media.js loaded first.
const TR_SYSTEM =
  "คุณคือนักแปลมังงะเป็นภาษาไทย ตอบเป็น JSON เท่านั้น ไม่มีข้อความอื่นและไม่ใส่ code fence";
const TR_ASK =
  "อ่านข้อความบทพูดทั้งหมดในหน้ามังงะนี้ แล้วแปลเป็นภาษาไทยที่เป็นธรรมชาติ " +
  "ตอบเป็นอาร์เรย์ JSON รูปแบบ [{\"box\":[ซ้าย,บน,ขวา,ล่าง],\"text\":\"คำแปล\"}] " +
  "ค่า box เป็นตัวเลข 0 ถึง 1000 เทียบกับความกว้างและความสูงของรูป (0,0 คือมุมซ้ายบน) " +
  "หนึ่งรายการต่อหนึ่งกรอบคำพูด ข้ามเสียงประกอบฉาก ถ้าไม่มีข้อความให้ตอบ []";
const TR_PAD = 4;        // px added around each box so the old text is fully covered

let trImage = null;      // { blob, width, height } of the chosen page
let trBusy = false;

function trSetBusy(on) {
  trBusy = on;
  $("tr-busy").hidden = !on;
  $("tr-go").disabled = on || !trImage;
  $("tr-pick").disabled = on;
}

// Draws the original picture on the canvas (also used to start over before a new translation).
function trDrawOriginal() {
  return new Promise(function (resolve, reject) {
    const url = URL.createObjectURL(trImage.blob);
    const img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      const c = $("tr-canvas");
      c.width = trImage.width;
      c.height = trImage.height;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.hidden = false;
      resolve();
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("decode")); };
    img.src = url;
  });
}

function trClamp(v) { return Math.max(0, Math.min(1000, v)); }

// Finds the JSON array in the reply and returns [{ l, t, r, b, text }] (0 to 1000), or null.
function trParse(reply) {
  const a = reply.indexOf("[");
  const z = reply.lastIndexOf("]");
  if (a < 0 || z <= a) return null;
  let data;
  try { data = JSON.parse(reply.slice(a, z + 1)); } catch (e) { return null; }
  if (!Array.isArray(data)) return null;
  const out = [];
  data.forEach(function (it) {
    if (!it || !Array.isArray(it.box) || it.box.length !== 4 || typeof it.text !== "string") return;
    const n = it.box.map(Number);
    if (n.some(function (v) { return !isFinite(v); })) return;
    const item = {
      l: trClamp(Math.min(n[0], n[2])), r: trClamp(Math.max(n[0], n[2])),
      t: trClamp(Math.min(n[1], n[3])), b: trClamp(Math.max(n[1], n[3])),
      text: it.text.trim().slice(0, 300)
    };
    if (item.r - item.l < 5 || item.b - item.t < 5 || !item.text) return;
    out.push(item);
  });
  return out;
}

function trMedian(values) {
  values.sort(function (p, q) { return p - q; });
  return values[Math.floor(values.length / 2)];
}

// Colour of the page just outside the box (median of the four edges), so the cover matches the bubble.
function trBackground(ctx, x, y, w, h, W, H) {
  const x0 = Math.max(0, x - 3), y0 = Math.max(0, y - 3);
  const x1 = Math.min(W - 1, x + w + 2), y1 = Math.min(H - 1, y + h + 2);
  const strips = [
    ctx.getImageData(x0, y0, x1 - x0 + 1, 1), ctx.getImageData(x0, y1, x1 - x0 + 1, 1),
    ctx.getImageData(x0, y0, 1, y1 - y0 + 1), ctx.getImageData(x1, y0, 1, y1 - y0 + 1)
  ];
  const ch = [[], [], []];
  strips.forEach(function (s) {
    for (let i = 0; i < s.data.length; i += 4) {
      ch[0].push(s.data[i]); ch[1].push(s.data[i + 1]); ch[2].push(s.data[i + 2]);
    }
  });
  return [trMedian(ch[0]), trMedian(ch[1]), trMedian(ch[2])];
}

// Splits Thai text (no spaces) into words with the browser's segmenter, or into characters.
function trTokens(text, ctx, maxW) {
  let words;
  try {
    words = Array.from(new Intl.Segmenter("th", { granularity: "word" }).segment(text), function (s) { return s.segment; });
  } catch (e) { words = Array.from(text); }
  const out = [];
  words.forEach(function (w) {
    if (ctx.measureText(w).width > maxW) Array.prototype.push.apply(out, Array.from(w));
    else out.push(w);
  });
  return out;
}

function trWrap(ctx, text, maxW) {
  const lines = [];
  text.split("\n").forEach(function (para) {
    let line = "";
    trTokens(para, ctx, maxW).forEach(function (tok) {
      if (!line || ctx.measureText(line + tok).width <= maxW) line += tok;
      else { lines.push(line.trim()); line = tok.trimStart(); }
    });
    lines.push(line.trim());
  });
  return lines;
}

function trDrawBox(ctx, item, W, H) {
  const x = Math.max(0, Math.round(item.l * W / 1000) - TR_PAD);
  const y = Math.max(0, Math.round(item.t * H / 1000) - TR_PAD);
  const w = Math.min(W - x, Math.round((item.r - item.l) * W / 1000) + 2 * TR_PAD);
  const h = Math.min(H - y, Math.round((item.b - item.t) * H / 1000) + 2 * TR_PAD);
  const bg = trBackground(ctx, x, y, w, h, W, H);
  ctx.fillStyle = "rgb(" + bg[0] + "," + bg[1] + "," + bg[2] + ")";       // image content, not UI
  ctx.fillRect(x, y, w, h);
  const dark = (0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]) > 140;
  ctx.fillStyle = dark ? "#111111" : "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = Math.min(Math.floor(h * 0.9), 40);
  let lines = [];
  for (; size >= 9; size--) {
    ctx.font = "600 " + size + "px system-ui, sans-serif";
    lines = trWrap(ctx, item.text, w - 8);
    if (lines.length * size * 1.35 <= h) break;
  }
  const lh = size * 1.35;
  const top = y + h / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach(function (ln, i) { ctx.fillText(ln, x + w / 2, top + i * lh, w - 4); });
}

async function trPick(file) {
  showError("tr-err", "");
  $("tr-done").hidden = true;
  trSetBusy(true);
  try {
    trImage = await loadImageFile(file);
    await trDrawOriginal();
  } catch (e) {
    trImage = null;
    $("tr-canvas").hidden = true;
    showError("tr-err", imageErrorText(e));
  }
  trSetBusy(false);
}

async function trGo() {
  if (trBusy || !trImage) return;
  showError("tr-err", "");
  $("tr-done").hidden = true;
  if (!load(KEY_STORE) || !load(MODEL_STORE)) { showError("tr-err", "บันทึกคีย์และชื่อโมเดลในหน้าตั้งค่าก่อน"); return; }
  trSetBusy(true);
  try {
    await trDrawOriginal();                      // start from the original every time
    const dataUrl = await blobToDataUrl(trImage.blob);
    const result = await askModel(TR_SYSTEM, [
      { type: "text", text: TR_ASK },
      { type: "image_url", image_url: { url: dataUrl } }
    ]);
    if (result.error) { showError("tr-err", result.error); trSetBusy(false); return; }
    const items = trParse(result.reply);
    if (!items) { showError("tr-err", "อ่านคำตอบของโมเดลไม่ได้ ลองใหม่หรือเปลี่ยนเป็นโมเดลที่อ่านรูปได้"); trSetBusy(false); return; }
    if (!items.length) { showError("tr-err", "ไม่พบข้อความในรูปนี้"); trSetBusy(false); return; }
    const c = $("tr-canvas");
    const ctx = c.getContext("2d");
    items.forEach(function (it) { trDrawBox(ctx, it, c.width, c.height); });
    $("tr-done").textContent = "แปลแล้ว " + items.length + " กรอบ ถ้าตำแหน่งเพี้ยนให้กดแปลอีกครั้งหรือลองโมเดลอื่น";
    $("tr-done").hidden = false;
  } catch (e) {
    showError("tr-err", "ทำไม่สำเร็จ ลองใหม่");
  }
  trSetBusy(false);
}

$("tr-pick").addEventListener("click", function () { $("tr-file").click(); });
$("tr-file").addEventListener("change", function () {
  const file = $("tr-file").files && $("tr-file").files[0];
  $("tr-file").value = "";
  if (file) trPick(file);
});
$("tr-go").addEventListener("click", trGo);
