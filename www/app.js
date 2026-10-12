const APP_VERSION = "1.0 (1)";
let count = 0;
const label = document.getElementById("count");
document.getElementById("ver").textContent = "เวอร์ชัน " + APP_VERSION;
document.getElementById("btn").addEventListener("click", function () {
  count += 1;
  label.textContent = String(count);
});
