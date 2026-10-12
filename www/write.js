// Write screen: pick a role, send a draft, get a critique (Editor) or a storyline (Screenwriter).
// Uses the helpers and constants from settings.js ($, load, store, showError, httpError,
// KEY_STORE, MODEL_STORE, API_URL, WAIT_MS), so settings.js must load first.
// The draft and the chosen role stay in this app's private storage on the phone.
const ROLE_STORE = "mangaai.write.role";
const DRAFT_STORE = "mangaai.write.draft";
const MAX_DRAFT = 12000;

const ROLES = {
  editor: {
    system:
      "คุณคือบรรณาธิการมังงะมืออาชีพ ผู้ใช้จะส่งร่างเรื่อง ฉาก หรือบทพูดมาให้ " +
      "ให้วิจารณ์เป็นภาษาไทยอย่างตรงไปตรงมาแต่สุภาพ โดยแบ่งเป็นหัวข้อสั้นๆ: " +
      "จุดแข็ง, จุดที่ควรแก้ (โครงเรื่อง จังหวะ ตัวละคร บทพูด), และข้อเสนอแนะที่ทำตามได้จริง 3 ข้อ " +
      "ห้ามเขียนเรื่องใหม่แทนผู้ใช้ ให้ชี้และแนะนำเท่านั้น"
  },
  screenwriter: {
    system:
      "คุณคือนักเขียนบทมังงะ ผู้ใช้จะส่งไอเดียหรือร่างเรื่องมาให้ " +
      "ให้เรียบเรียงเป็นเรื่องย่อ (storyline) ภาษาไทย ประกอบด้วย: ประโยคเดียวสรุปเรื่อง, " +
      "ตัวละครหลัก, โครงเรื่อง 3 องก์ (เปิดเรื่อง ปมขัดแย้ง ไคลแมกซ์และปิดเรื่อง), " +
      "และฉากเด่นที่เหมาะกับการวาดเป็นช่องมังงะ 3-5 ฉาก " +
      "ใช้เฉพาะสิ่งที่ผู้ใช้ให้มา เติมรายละเอียดได้แต่ต้องไม่ขัดกับต้นฉบับ"
  }
};

function currentRole() {
  const r = load(ROLE_STORE);
  return ROLES[r] ? r : "editor";
}

function selectRole(role) {
  if (!ROLES[role]) role = "editor";
  store(ROLE_STORE, role);
  const tabs = document.querySelectorAll("#role-tabs button");
  for (let i = 0; i < tabs.length; i++) {
    tabs[i].setAttribute("aria-selected", tabs[i].dataset.role === role ? "true" : "false");
  }
}

function setWriteBusy(on) {
  $("w-send").disabled = on;
  $("w-busy").hidden = !on;
}

// Same request as the Settings test message, plus a system message. Returns { reply } or { error }.
async function askModel(system, text) {
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, WAIT_MS);
  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Authorization": "Bearer " + load(KEY_STORE), "Content-Type": "application/json" },
      body: JSON.stringify({
        model: load(MODEL_STORE),
        messages: [{ role: "system", content: system }, { role: "user", content: text }]
      }),
      signal: ctrl.signal
    });
    let data = null;
    try { data = await resp.json(); } catch (e) { data = null; }
    if (!resp.ok) return { error: httpError(resp.status, data) };
    const msg = data && data.choices && data.choices[0] && data.choices[0].message;
    const reply = msg && msg.content;
    if (typeof reply !== "string" || !reply) return { error: "โมเดลไม่ส่งคำตอบกลับมา ลองโมเดลอื่น" };
    return { reply: reply };
  } catch (e) {
    return { error: e && e.name === "AbortError" ? "รอนานเกินไป ลองใหม่" : "ส่งไม่ได้ ตรวจอินเทอร์เน็ต" };
  } finally {
    clearTimeout(timer);
  }
}

async function sendDraft() {
  if ($("w-send").disabled) return;
  showError("w-err", "");
  const text = $("w-draft").value.trim();
  if (!load(KEY_STORE) || !load(MODEL_STORE)) { showError("w-err", "บันทึกคีย์และชื่อโมเดลในหน้าตั้งค่าก่อน"); return; }
  if (!text) { showError("w-err", "พิมพ์ร่างก่อน"); return; }
  if (text.length > MAX_DRAFT) { showError("w-err", "ร่างยาวเกินไป (เกิน " + MAX_DRAFT + " ตัวอักษร) ตัดให้สั้นลง"); return; }
  $("w-out").textContent = "";
  setWriteBusy(true);
  const result = await askModel(ROLES[currentRole()].system, text);
  setWriteBusy(false);
  if (result.error) { showError("w-err", result.error); return; }
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = result.reply;   // textContent, never innerHTML
  $("w-out").appendChild(bubble);
}

document.querySelectorAll("#role-tabs button").forEach(function (b) {
  b.addEventListener("click", function () { selectRole(b.dataset.role); });
});
$("w-draft").value = load(DRAFT_STORE);
$("w-draft").addEventListener("input", function () { store(DRAFT_STORE, $("w-draft").value); });
$("w-send").addEventListener("click", sendDraft);
selectRole(currentRole());
