// ============================================================
// INFO-ICON (BA 550)
// ------------------------------------------------------------
// Wiederverwendbare Info-Hinweis-Engine: ein anklickbares "?"-
// Symbol, das einen frei formulierten Erklaertext (i18n-Key) in
// einem kleinen Popup zeigt. Hover, Klick, Tap und Tastatur
// oeffnen denselben Text; Verlassen, Klick daneben und Escape
// schliessen.
//
// Getrennt vom Dependency-Lock-Popup (dependency-lock.js): jenes
// zeigt fest formulierte Sperr-Begruendungen, diese Engine freien
// Text. Kein IIFE, kein Modul-System. Globaler Scope wie das
// uebrige Tool.
// Architektur: .docs/spec/00-info-icon-architektur.md
// ============================================================

// ---- Markup-Helfer ----
// Liefert das "?"-Symbol als HTML-String. Einziger Parameter: der
// i18n-Key des Erklaertextes. Der Text selbst wird erst beim
// Oeffnen aus t() geholt (Sprachwechsel-fest), hier steht nur der
// Key im data-Attribut. aria-label ueber t('infoIconAria').
function infoIconHtml(textKey) {
  var aria = (typeof t === 'function') ? t('infoIconAria') : 'Info';
  return '<span class="info-icon" role="button" tabindex="0"'
    + ' aria-label="' + aria + '"'
    + ' data-info-key="' + textKey + '">?</span>';
}

// ---- Popup ----
function infoIconShowPopup(el) {
  var popup = document.getElementById('infoIconPopup');
  if (!popup) return;
  var key = el.dataset.infoKey || '';
  var text = (typeof t === 'function') ? t(key) : key;
  popup.textContent = text;
  // Positionierung: unter dem Symbol
  var rect = el.getBoundingClientRect();
  popup.style.left = (rect.left + window.scrollX) + 'px';
  popup.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
  popup.hidden = false;
}

function infoIconHidePopup() {
  var popup = document.getElementById('infoIconPopup');
  if (popup) popup.hidden = true;
}

// ---- Globale Event-Handler (Delegation ueber .info-icon) ----
// Hover
document.addEventListener('mouseover', function(e) {
  var icon = e.target.closest('.info-icon');
  if (icon) infoIconShowPopup(icon);
});
document.addEventListener('mouseout', function(e) {
  var icon = e.target.closest('.info-icon');
  if (icon) {
    // Nicht schliessen, wenn der Zeiger im Symbol selbst bleibt
    var to = e.relatedTarget;
    if (to && to.closest && to.closest('.info-icon') === icon) return;
    infoIconHidePopup();
  }
});
// Klick / Tap
document.addEventListener('mousedown', function(e) {
  var icon = e.target.closest('.info-icon');
  if (icon) {
    e.preventDefault();
    e.stopPropagation();
    infoIconShowPopup(icon);
    return;
  }
  // Klick ausserhalb des Popups schliesst es
  if (!e.target.closest('#infoIconPopup')) infoIconHidePopup();
}, true);
document.addEventListener('touchstart', function(e) {
  var icon = e.target.closest('.info-icon');
  if (icon) {
    e.preventDefault();
    e.stopPropagation();
    infoIconShowPopup(icon);
  }
}, { capture: true, passive: false });
// Tastatur: Enter/Leertaste oeffnen auf fokussiertem Symbol, Escape schliesst
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { infoIconHidePopup(); return; }
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
    var active = document.activeElement;
    if (active && active.classList && active.classList.contains('info-icon')) {
      e.preventDefault();
      infoIconShowPopup(active);
    }
  }
});
