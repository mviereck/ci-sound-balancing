// ============================================================
// DEPENDENCY-LOCK (BA 149)
// ------------------------------------------------------------
// Sperrt UI-Eingaben, wenn vorhandene Meßergebnisse durch eine
// Änderung ungültig würden. Sperr-Schicht (b) Daten-vorhanden.
// Schicht (a) Test-läuft liegt in test-ui.js (lockTestTabs),
// Schicht (c) Voraussetzungen-fehlen jeweils im Test-Modul.
//
// Kein IIFE, kein Modul-System. Globaler Scope wie restliches Tool.
// ============================================================

// ---- Sperr-Tabelle ----
// Pro Eintrag:
//   selector       — CSS-Selektor des Feldes
//   fieldLabelKey  — i18n-Key für den menschenlesbaren Feldnamen
//   getReasonKeys  — Funktion ohne Argumente, liefert Liste i18n-Keys
//                    mit menschenlesbaren Bezeichnungen der betroffenen
//                    Tests. Leere Liste = nicht gesperrt.
const DEP_LOCK_RULES = [
  // Hersteller-Auswahl (BA 149)
  {
    selector: '#mfrSelect',
    fieldLabelKey: 'depFieldMfr',
    getReasonKeys: function() {
      const reasons = [];
      const s = sideData[activeSide];
      // Eigene Lautstärke-Daten der aktiven Seite
      const ownHasLoud =
        (s.bRes && s.bRes.length > 0) ||
        (s.jRes && s.jRes.length > 0);
      if (ownHasLoud) reasons.push('depReasonLoudness');
      // Andere Seite akustisch → Hersteller-Wechsel zieht Frequenzraster mit
      const other = activeSide === 'left' ? 'right' : 'left';
      const otherSync = (sideData[other].config || 'ci') !== 'ci';
      const otherHasLoud = otherSync && (
        (sideData[other].bRes && sideData[other].bRes.length > 0) ||
        (sideData[other].jRes && sideData[other].jRes.length > 0)
      );
      if (otherHasLoud) reasons.push('depReasonLoudnessOtherSide');
      // Frequenzabgleich adaptiv: fRes enthält ausschließlich abgeschlossene
      // Adaptiv-Ergebnisse (kein method-Feld; Vorhandensein reicht als Signal).
      // try/catch: fRes ist let in state-side.js und kann bei frühem
      // depLockApply()-Aufruf noch in der TDZ liegen.
      try {
        if (typeof fRes !== 'undefined' && Array.isArray(fRes) && fRes.length > 0) {
          reasons.push('depReasonFreqMatchAdaptive');
        }
      } catch(ex) { /* fRes noch in TDZ — ignorieren */ }
      // Frequenzabgleich Schieber: Daten liegen in sliderEstimates, nicht in fRes.
      try {
        var hasSlider = false;
        ['left', 'right'].forEach(function(side) {
          var fa = sideData[side] && sideData[side].freqmatchAdaptive;
          if (fa && fa.sliderEstimates && Object.keys(fa.sliderEstimates).length > 0) {
            hasSlider = true;
          }
        });
        if (hasSlider) reasons.push('depReasonFreqMatchSlider');
      } catch(ex) { /* sliderEstimates noch nicht initialisiert — ignorieren */ }
      return reasons;
    }
  }
  // Weitere Regeln folgen in BA 150ff.
];

// ---- Anwenden ----
function depLockApply() {
  if (typeof DEP_LOCK_RULES === 'undefined') return;
  DEP_LOCK_RULES.forEach(function(rule) {
    var el = document.querySelector(rule.selector);
    if (!el) return;
    var reasons = rule.getReasonKeys();
    if (reasons.length === 0) {
      _depLockUnlock(el);
    } else {
      _depLockLock(el, rule.fieldLabelKey, reasons);
    }
  });
}

function _depLockLock(el, fieldLabelKey, reasonKeys) {
  el.classList.add('dep-locked');
  el.setAttribute('aria-disabled', 'true');
  el.dataset.depFieldLabel = fieldLabelKey;
  el.dataset.depReasons = reasonKeys.join(',');
}

function _depLockUnlock(el) {
  el.classList.remove('dep-locked');
  el.removeAttribute('aria-disabled');
  delete el.dataset.depFieldLabel;
  delete el.dataset.depReasons;
}

// ---- Popup ----
function depLockShowPopup(el) {
  var popup = document.getElementById('depLockPopup');
  if (!popup) return;
  var fieldLabel = (typeof t === 'function')
    ? t(el.dataset.depFieldLabel || 'depFieldGeneric')
    : (el.dataset.depFieldLabel || 'Dieses Feld');
  var reasonList = (el.dataset.depReasons || '').split(',').filter(function(x) { return !!x; });
  var reasonHtml = reasonList.map(function(k) {
    var label = (typeof t === 'function') ? t(k) : k;
    return '<li>' + label + '</li>';
  }).join('');
  var titleSuffix = (typeof t === 'function') ? t('depLockedTitle') : 'kann gerade nicht geändert werden';
  var bodyText    = (typeof t === 'function') ? t('depLockedBody')  : 'Die Änderung würde folgende Meßergebnisse ungültig machen:';
  var footerText  = (typeof t === 'function') ? t('depLockedFooter') : 'Erst diese Ergebnisse löschen oder das Tool zurücksetzen.';
  popup.innerHTML =
    '<div class="dep-popup-title">' + fieldLabel + ' ' + titleSuffix + '</div>' +
    '<div class="dep-popup-body">' +
      '<div>' + bodyText + '</div>' +
      '<ul>' + reasonHtml + '</ul>' +
      '<div>' + footerText + '</div>' +
    '</div>';
  // Positionierung: unter dem gesperrten Element
  var rect = el.getBoundingClientRect();
  popup.style.left = (rect.left + window.scrollX) + 'px';
  popup.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
  popup.hidden = false;
}

function depLockHidePopup() {
  var popup = document.getElementById('depLockPopup');
  if (popup) popup.hidden = true;
}

// ---- Globale Event-Handler ----
// mousedown statt click, damit das Öffnen der Select-Dropdown-Liste
// noch vor dem Browser-Default abgefangen wird.
document.addEventListener('mousedown', function(e) {
  var target = e.target.closest('.dep-locked');
  if (target) {
    e.preventDefault();
    e.stopPropagation();
    depLockShowPopup(target);
    return;
  }
  // Klick außerhalb des Popups schließt es
  if (!e.target.closest('#depLockPopup')) depLockHidePopup();
}, true);

// Touch-Variante: touchstart entsprechend abfangen
document.addEventListener('touchstart', function(e) {
  var target = e.target.closest('.dep-locked');
  if (target) {
    e.preventDefault();
    e.stopPropagation();
    depLockShowPopup(target);
  }
}, { capture: true, passive: false });

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') depLockHidePopup();
  var active = document.activeElement;
  if (active && active.classList && active.classList.contains('dep-locked')) {
    e.preventDefault();
  }
});
