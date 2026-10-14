// Story screen: the user's characters (kept on the phone) and a question box for the AI.
// The AI always gets the character list, so its answers use the same names.
// Needs settings.js (helpers), write.js (askModel) and ui.js (confirmSheet) loaded first.
const CHAR_STORE = "mangaai.story.characters";
const MAX_CHARS = 50;
const ST_SYSTEM =
  "คุณคือผู้ช่วยเขียนมังงะ ตอบเป็นภาษาไทยกระชับและตรงคำถาม " +
  "เมื่อพูดถึงตัวละครให้ใช้ชื่อตามรายการที่ผู้ใช้ให้เท่านั้น ห้ามตั้งชื่อใหม่ให้ตัวละครที่มีอยู่แล้ว";

function stLoad() {
  try {
    const list = JSON.parse(load(CHAR_STORE) || "[]");
    if (!Array.isArray(list)) return [];
    return list.filter(function (c) { return c && typeof c.id === "string" && typeof c.name === "string"; });
  } catch (e) { return []; }
}

function stSave(list) { return store(CHAR_STORE, JSON.stringify(list)); }

// Text block with the characters, empty when there are none. Panels uses it too.
function stCharactersText() {
  const list = stLoad();
  if (!list.length) return "ผู้ใช้ยังไม่ได้เพิ่มตัวละคร";
  return "ตัวละครในเรื่องของผู้ใช้:\n" + list.map(function (c) {
    return "- " + c.name + (c.desc ? ": " + c.desc : "");
  }).join("\n");
}

function stRender() {
  const list = stLoad();
  const ul = $("st-list");
  ul.textContent = "";
  list.forEach(function (c) {
    const li = document.createElement("li");
    li.className = "row";
    const grow = document.createElement("div");
    grow.className = "grow";
    const name = document.createElement("h3");
    name.textContent = c.name;               // textContent, never innerHTML
    grow.appendChild(name);
    if (c.desc) {
      const d = document.createElement("p");
      d.className = "muted small";
      d.textContent = c.desc;
      grow.appendChild(d);
    }
    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger";
    del.textContent = "ลบ";
    del.addEventListener("click", function () { stDelete(c); });
    li.appendChild(grow);
    li.appendChild(del);
    ul.appendChild(li);
  });
  $("st-empty").hidden = list.length > 0;
}

function stAdd() {
  showError("st-err", "");
  const name = $("st-name").value.trim();
  const desc = $("st-desc").value.trim();
  const list = stLoad();
  if (!name) { showError("st-err", "ใส่ชื่อตัวละครก่อน"); return; }
  if (list.length >= MAX_CHARS) { showError("st-err", "เพิ่มได้ไม่เกิน " + MAX_CHARS + " ตัวละคร"); return; }
  const lower = name.toLowerCase();
  if (list.some(function (c) { return c.name.toLowerCase() === lower; })) { showError("st-err", "มีตัวละครชื่อนี้แล้ว"); return; }
  list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name, desc: desc });
  if (!stSave(list)) { showError("st-err", "บันทึกไม่ได้"); return; }
  $("st-name").value = "";
  $("st-desc").value = "";
  stRender();
}

async function stDelete(c) {
  const yes = await confirmSheet("ลบตัวละคร " + c.name + "?", "ลบแล้วเอากลับมาไม่ได้");
  if (!yes) return;
  stSave(stLoad().filter(function (x) { return x.id !== c.id; }));
  stRender();
}

async function stAsk() {
  if ($("st-ask").disabled) return;
  showError("st-q-err", "");
  const text = $("st-q").value.trim();
  if (!load(KEY_STORE) || !load(MODEL_STORE)) { showError("st-q-err", "บันทึกคีย์และชื่อโมเดลในหน้าตั้งค่าก่อน"); return; }
  if (!text) { showError("st-q-err", "พิมพ์คำถามก่อน"); return; }
  $("st-out").textContent = "";
  $("st-ask").disabled = true;
  $("st-busy").hidden = false;
  const result = await askModel(ST_SYSTEM + "\n\n" + stCharactersText(), text);
  $("st-ask").disabled = false;
  $("st-busy").hidden = true;
  if (result.error) { showError("st-q-err", result.error); return; }
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = result.reply;
  $("st-out").appendChild(bubble);
}

$("st-add").addEventListener("click", stAdd);
$("st-ask").addEventListener("click", stAsk);
stRender();
