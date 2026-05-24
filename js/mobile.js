// mobile.js – Touch-Geräte-Erkennung und kleine Helfer.
// Lädt sehr früh; keine Abhängigkeiten außer dem Browser.

var IS_TOUCH_ONLY = (function () {
  try {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  } catch (e) {
    return false;
  }
})();

function safeFocus(el) {
  if (!el) return;
  if (IS_TOUCH_ONLY) return;
  try { el.focus(); } catch (e) {}
}

function applyMobileReadonly(root) {
  if (!IS_TOUCH_ONLY) return;
  var scope = root || document;
  var list = scope.querySelectorAll('input[type="number"]');
  for (var i = 0; i < list.length; i++) {
    list[i].setAttribute('readonly', 'readonly');
    list[i].setAttribute('inputmode', 'numeric');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  applyMobileReadonly(document);
});
