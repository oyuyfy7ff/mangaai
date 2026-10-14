// Bottom navigation: show one screen at a time. Add a screen by adding its id and title here
// and a button with the same data-screen in index.html.
const SCREEN_TITLES = {
  write: "เขียน",
  story: "เรื่องและตัวละคร",
  panels: "ช่องมังงะ",
  translate: "แปลหน้ามังงะ",
  settings: "ตั้งค่า"
};

function showScreen(name) {
  if (!SCREEN_TITLES[name]) name = "write";
  Object.keys(SCREEN_TITLES).forEach(function (n) {
    document.getElementById("screen-" + n).hidden = n !== name;
  });
  document.getElementById("title").textContent = SCREEN_TITLES[name];
  document.querySelectorAll("#nav button").forEach(function (b) {
    if (b.dataset.screen === name) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  window.scrollTo(0, 0);
}

document.querySelectorAll("#nav button").forEach(function (b) {
  b.addEventListener("click", function () { showScreen(b.dataset.screen); });
});
