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

// Auf Touch-Geraeten die passende Bildschirmtastatur waehlen. Frueher wurde
// hier zusaetzlich readonly gesetzt (native Tastatur unterdrueckt zugunsten von
// Steppertasten) — das machte alle Zahlenfelder OHNE danebenstehenden Stepper
// (Implantat-Tabelle, C-Wert/IDR, Kurven-Center/Breite) auf iPad/Android
// unbedienbar. Direkte Zahleneingabe muss ueberall moeglich sein; die
// vorhandenen Stepper (Schieber, testUI-Slider) bleiben als Zusatz erhalten.
function applyMobileReadonly(root) {
  if (!IS_TOUCH_ONLY) return;
  var scope = root || document;
  var list = scope.querySelectorAll('input[type="number"]');
  for (var i = 0; i < list.length; i++) {
    list[i].removeAttribute('readonly');
    list[i].setAttribute('inputmode', 'decimal');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  applyMobileReadonly(document);
});
