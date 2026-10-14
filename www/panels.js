// Panels screen: a list of manga panels. Each panel is a picture from the phone plus its dialogue.
// Pictures live in IndexedDB (media.js), so they are still there after the app is closed.
// Needs settings.js, write.js (askModel), story.js (stCharactersText), ui.js and media.js loaded first.
const PN_SYSTEM =
  "คุณคือนักเขียนบทมังงะ ดูรูปช่องมังงะที่ให้ แล้วเขียนบทพูดสั้นๆ ภาษาไทยสำหรับช่องนี้ " +
  "หนึ่งบรรทัดต่อหนึ่งคำพูด รูปแบบ ชื่อตัวละคร: คำพูด ใช้ชื่อตัวละครตามรายการที่ให้เมื่อรู้ว่าเป็นใคร " +
  "ตอบเฉพาะบทพูด ไม่ต้องอธิบายเพิ่ม";

let pnItems = [];        // records currently shown
let pnUrls = [];         // object URLs to release on the next render
let pnBusy = false;
const pnTimers = {};     // debounce timers for saving dialogue, by panel id

function pnSetBusy(on, text) {
  pnBusy = on;
  $("pn-add").disabled = on;
  $("pn-busy").hidden = !on;
  if (on && text) $("pn-busy").textContent = text;
  document.querySelectorAll("#pn-list button").forEach(function (b) { b.disabled = on; });
}

function pnRenderCard(rec) {
  const card = document.createElement("div");
  card.className = "card stack";
  const url = URL.createObjectURL(rec.image);
  pnUrls.push(url);
  const img = document.createElement("img");
  img.className = "panel-img";
  img.alt = "ช่องมังงะ";
  img.src = url;
  const field = document.createElement("div");
  field.className = "field";
  const label = document.createElement("label");
  label.textContent = "บทพูด";
  const area = document.createElement("textarea");
  area.rows = 4;
  area.value = rec.dialogue || "";
  area.setAttribute("aria-label", "บทพูด");
  area.addEventListener("input", function () { pnQueueSave(rec, area.value); });
  field.appendChild(label);
  field.appendChild(area);
  const row = document.createElement("div");
  row.className = "grid2";
  const gen = document.createElement("button");
  gen.type = "button";
  gen.className = "soft";
  gen.textContent = "สร้างด้วย AI";
  gen.addEventListener("click", function () { pnGenerate(rec, area); });
  const del = document.createElement("button");
  del.type = "button";
  del.className = "danger";
  del.textContent = "ลบช่อง";
  del.addEventListener("click", function () { pnDelete(rec); });
  row.appendChild(gen);
  row.appendChild(del);
  card.appendChild(img);
  card.appendChild(field);
  card.appendChild(row);
  return card;
}

async function pnRefresh() {
  let list = [];
  try { list = await dbAll(); } catch (e) { showError("pn-err", "เปิดที่เก็บรูปไม่ได้"); }
  pnItems = list;
  pnUrls.forEach(function (u) { URL.revokeObjectURL(u); });
  pnUrls = [];
  const box = $("pn-list");
  box.textContent = "";
  list.forEach(function (rec) { box.appendChild(pnRenderCard(rec)); });
  $("pn-empty").hidden = list.length > 0;
}

// Saves the dialogue 0.4 s after the last key press, so nothing is lost if the app is closed.
function pnQueueSave(rec, value) {
  rec.dialogue = value;
  clearTimeout(pnTimers[rec.id]);
  pnTimers[rec.id] = setTimeout(function () {
    dbPut(rec).catch(function () { showError("pn-err", "บันทึกบทพูดไม่ได้"); });
  }, 400);
}

async function pnAddFile(file) {
  showError("pn-err", "");
  pnSetBusy(true, "กำลังเตรียมรูป");
  try {
    const img = await loadImageFile(file);
    await dbPut({ image: img.blob, dialogue: "", created: Date.now() });
    await pnRefresh();
  } catch (e) {
    showError("pn-err", e && e.message === "no-db" ? "เปิดที่เก็บรูปไม่ได้" : imageErrorText(e));
  }
  pnSetBusy(false);
}

async function pnDelete(rec) {
  if (pnBusy) return;
  const yes = await confirmSheet("ลบช่องนี้?", "ลบรูปและบทพูดของช่องนี้ เอากลับมาไม่ได้");
  if (!yes) return;
  clearTimeout(pnTimers[rec.id]);
  try { await dbDelete(rec.id); } catch (e) { showError("pn-err", "ลบไม่ได้"); }
  await pnRefresh();
}

async function pnGenerate(rec, area) {
  if (pnBusy) return;
  showError("pn-err", "");
  if (!load(KEY_STORE) || !load(MODEL_STORE)) { showError("pn-err", "บันทึกคีย์และชื่อโมเดลในหน้าตั้งค่าก่อน"); return; }
  pnSetBusy(true, "กำลังรอคำตอบ (โมเดลต้องอ่านรูปได้)");
  try {
    const dataUrl = await blobToDataUrl(rec.image);
    const content = [
      { type: "text", text: "เขียนบทพูดสำหรับช่องมังงะนี้\n\n" + stCharactersText() },
      { type: "image_url", image_url: { url: dataUrl } }
    ];
    const result = await askModel(PN_SYSTEM, content);
    if (result.error) { showError("pn-err", result.error); }
    else {
      const old = area.value.trim();
      area.value = old ? old + "\n" + result.reply : result.reply;
      pnQueueSave(rec, area.value);
    }
  } catch (e) {
    showError("pn-err", "อ่านรูปไม่ได้ ลองใหม่");
  }
  pnSetBusy(false);
}

$("pn-add").addEventListener("click", function () { $("pn-file").click(); });
$("pn-file").addEventListener("change", function () {
  const file = $("pn-file").files && $("pn-file").files[0];
  $("pn-file").value = "";                 // the same picture can be chosen again
  if (file) pnAddFile(file);
});
pnRefresh();
