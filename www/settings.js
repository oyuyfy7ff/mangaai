// Settings screen: OpenRouter key, model name, one test message.
// The key stays in this app's private storage on the phone. It is never shown again
// and is sent only to openrouter.ai (see connect-src in index.html).
const KEY_STORE = "mangaai.openrouter";
const MODEL_STORE = "mangaai.model";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const WAIT_MS = 90000;

function $(id) { return document.getElementById(id); }

function load(name) {
  try { return localStorage.getItem(name) || ""; } catch (e) { return ""; }
}

function store(name, value) {
  try { localStorage.setItem(name, value); return true; } catch (e) { return false; }
}

function showError(id, text) {
  const el = $(id);
  el.textContent = text;          // textContent, never innerHTML
  el.hidden = !text;
}

function refresh() {
  $("key-state").textContent = load(KEY_STORE)
    ? "มีคีย์บันทึกไว้แล้ว (ซ่อนอยู่ ใส่คีย์ใหม่เพื่อเปลี่ยน)"
    : "ยังไม่มีคีย์";
  $("model").value = load(MODEL_STORE);
}

function saveSettings() {
  showError("set-err", "");
  $("saved").hidden = true;
  const typedKey = $("key").value.trim();
  const model = $("model").value.trim();
  if (!typedKey && !load(KEY_STORE)) { showError("set-err", "ใส่คีย์ OpenRouter ก่อน"); return; }
  if (/\s/.test(typedKey)) { showError("set-err", "คีย์ต้องไม่มีช่องว่างหรือขึ้นบรรทัดใหม่"); return; }
  if (!model) { showError("set-err", "ใส่ชื่อโมเดลก่อน"); return; }
  if (typedKey && !store(KEY_STORE, typedKey)) { showError("set-err", "บันทึกคีย์ไม่ได้"); return; }
  if (!store(MODEL_STORE, model)) { showError("set-err", "บันทึกชื่อโมเดลไม่ได้"); return; }
  $("key").value = "";
  refresh();
  $("saved").hidden = false;
}

function addBubble(text, mine) {
  const el = document.createElement("div");
  el.className = mine ? "bubble me" : "bubble";
  el.textContent = text;
  $("chat").appendChild(el);
}

function setBusy(on) {
  $("send").disabled = on;
  $("busy").hidden = !on;
}

function httpError(status, data) {
  if (status === 401) return "คีย์ไม่ถูกต้อง หรือหมดอายุ";
  if (status === 429) return "ส่งถี่เกินไป รอสักครู่แล้วลองใหม่";
  const msg = data && data.error && typeof data.error.message === "string" ? data.error.message : "";
  return "ผิดพลาด (" + status + ")" + (msg ? ": " + msg.slice(0, 200) : "");
}

async function sendTest() {
  if ($("send").disabled) return;
  showError("msg-err", "");
  const key = load(KEY_STORE);
  const model = load(MODEL_STORE);
  const text = $("msg").value.trim();
  if (!key || !model) { showError("msg-err", "บันทึกคีย์และชื่อโมเดลก่อน"); return; }
  if (!text) { showError("msg-err", "พิมพ์ข้อความก่อน"); return; }
  $("chat").textContent = "";
  addBubble(text, true);
  setBusy(true);
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, WAIT_MS);
  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model: model, messages: [{ role: "user", content: text }] }),
      signal: ctrl.signal
    });
    let data = null;
    try { data = await resp.json(); } catch (e) { data = null; }
    if (!resp.ok) { showError("msg-err", httpError(resp.status, data)); return; }
    const msg = data && data.choices && data.choices[0] && data.choices[0].message;
    const reply = msg && msg.content;
    if (typeof reply !== "string" || !reply) { showError("msg-err", "โมเดลไม่ส่งคำตอบกลับมา ลองโมเดลอื่น"); return; }
    addBubble(reply, false);
  } catch (e) {
    showError("msg-err", e && e.name === "AbortError" ? "รอนานเกินไป ลองใหม่" : "ส่งไม่ได้ ตรวจอินเทอร์เน็ต");
  } finally {
    clearTimeout(timer);
    setBusy(false);
  }
}

$("save").addEventListener("click", saveSettings);
$("send").addEventListener("click", sendTest);
refresh();
