// Confirmation sheet for actions that cannot be undone. Resolves true when the user confirms.
function confirmSheet(title, text) {
  return new Promise(function (resolve) {
    const box = $("confirm");
    function done(answer) {
      box.hidden = true;
      $("confirm-yes").onclick = null;
      $("confirm-no").onclick = null;
      box.onclick = null;
      resolve(answer);
    }
    $("confirm-title").textContent = title;
    $("confirm-text").textContent = text;
    $("confirm-yes").onclick = function () { done(true); };
    $("confirm-no").onclick = function () { done(false); };
    box.onclick = function (e) { if (e.target === box) done(false); };
    box.hidden = false;
  });
}
