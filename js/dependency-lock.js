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
//   selector       — CSS-Selektor des Feldes (Single-Match)
//   selectorAll    — CSS-Selektor für mehrere Felder (Multi-Match)
//   fieldLabelKey  — i18n-Key für den menschenlesbaren Feldnamen
//   getReasonKeys  — Funktion (optional: el), liefert Liste i18n-Keys
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
      // BA 251: jRes entfaellt; nur noch elektrodenlautstaerkeResults.
      const ownHasLoud = (s.elektrodenlautstaerkeResults && s.elektrodenlautstaerkeResults.length > 0);
      if (ownHasLoud) reasons.push('depReasonLoudness');
      // Andere Seite akustisch → Hersteller-Wechsel zieht Frequenzraster mit
      const other = activeSide === 'left' ? 'right' : 'left';
      const otherSync = (sideData[other].config || 'ci') !== 'ci';
      // BA 251: jRes entfaellt; nur noch elektrodenlautstaerkeResults.
      const otherHasLoud = otherSync
        && (sideData[other].elektrodenlautstaerkeResults && sideData[other].elektrodenlautstaerkeResults.length > 0);
      if (otherHasLoud) reasons.push('depReasonLoudnessOtherSide');
      // Frequenzabgleich adaptiv: konvergierte Ergebnisse in FRQ_resultsArray
      // oder Laufdaten in runs[] (auch ohne konvergierten Match).
      try {
        if (typeof FRQ_resultsArray !== 'undefined' && Array.isArray(FRQ_resultsArray) && FRQ_resultsArray.length > 0)
          reasons.push('depReasonFRQAdaptive');
      } catch(ex) { /* FRQ_resultsArray noch in TDZ — ignorieren */ }
      try {
        if (typeof _FRQ_hasAdaptiveData === 'function' && _FRQ_hasAdaptiveData())
          if (reasons.indexOf('depReasonFRQAdaptive') === -1)
            reasons.push('depReasonFRQAdaptive');
      } catch(ex) {}
      // Frequenzabgleich Schieber: Daten liegen in sliderEstimates, nicht in FRQ_resultsArray.
      try {
        var hasSlider = false;
        ['left', 'right'].forEach(function(side) {
          var fa = sideData[side] && sideData[side].freqmatchAdaptive;
          if (fa && fa.sliderEstimates && Object.keys(fa.sliderEstimates).length > 0) {
            hasSlider = true;
          }
        });
        if (hasSlider) reasons.push('depReasonFRQSlider');
      } catch(ex) { /* sliderEstimates noch nicht initialisiert — ignorieren */ }
      return reasons;
    }
  }
  // Weitere Regeln folgen in BA 150ff.

  ,
  // Hörtechnik-Auswahl (BA 151)
  {
    selector: '#cfgSelect',
    fieldLabelKey: 'depFieldCfg',
    getReasonKeys: function() {
      const reasons = [];
      const s = sideData[activeSide];
      // BA 251: jRes entfaellt; nur noch elektrodenlautstaerkeResults.
      const ownHasLoud = (s.elektrodenlautstaerkeResults && s.elektrodenlautstaerkeResults.length > 0);
      if (ownHasLoud) reasons.push('depReasonLoudness');
      // Adaptiv: FRQ_resultsArray (konvergierte Ergebnisse) oder Laufdaten in runs[]
      try {
        if (typeof FRQ_resultsArray !== 'undefined' && Array.isArray(FRQ_resultsArray) && FRQ_resultsArray.length > 0)
          reasons.push('depReasonFRQAdaptive');
      } catch(ex) { /* FRQ_resultsArray noch in TDZ */ }
      try {
        if (typeof _FRQ_hasAdaptiveData === 'function' && _FRQ_hasAdaptiveData())
          if (reasons.indexOf('depReasonFRQAdaptive') === -1)
            reasons.push('depReasonFRQAdaptive');
      } catch(ex) {}
      // Slider: Daten liegen in sliderEstimates, nicht in FRQ_resultsArray
      try {
        var hasSlider = false;
        ['left', 'right'].forEach(function(side) {
          var fa = sideData[side] && sideData[side].freqmatchAdaptive;
          if (fa && fa.sliderEstimates && Object.keys(fa.sliderEstimates).length > 0)
            hasSlider = true;
        });
        if (hasSlider) reasons.push('depReasonFRQSlider');
      } catch(ex) { /* sliderEstimates noch nicht initialisiert */ }
      return reasons;
    }
  },

  // Hz-eigen-Felder pro Elektrode (BA 151) — bilateral wirksam
  {
    selectorAll: '.fo',
    fieldLabelKey: 'depFieldHzEigen',
    getReasonKeys: function(el) {
      const reasons = [];
      const s = sideData[activeSide];
      // BA 251: jRes entfaellt; nur noch elektrodenlautstaerkeResults.
      const ownHasLoud = (s.elektrodenlautstaerkeResults && s.elektrodenlautstaerkeResults.length > 0);
      if (ownHasLoud) reasons.push('depReasonLoudness');
      try {
        if (typeof FRQ_resultsArray !== 'undefined' && Array.isArray(FRQ_resultsArray) && FRQ_resultsArray.length > 0)
          reasons.push('depReasonFRQAdaptive');
      } catch(ex) { /* FRQ_resultsArray noch in TDZ */ }
      try {
        if (typeof _FRQ_hasAdaptiveData === 'function' && _FRQ_hasAdaptiveData())
          if (reasons.indexOf('depReasonFRQAdaptive') === -1)
            reasons.push('depReasonFRQAdaptive');
      } catch(ex) {}
      try {
        var hasSlider = false;
        ['left', 'right'].forEach(function(side) {
          var fa = sideData[side] && sideData[side].freqmatchAdaptive;
          if (fa && fa.sliderEstimates && Object.keys(fa.sliderEstimates).length > 0)
            hasSlider = true;
        });
        if (hasSlider) reasons.push('depReasonFRQSlider');
      } catch(ex) { /* sliderEstimates noch nicht initialisiert */ }
      return reasons;
    }
  },

  // Referenzseite im Frequenzabgleich (BA 151)
  // ID: refEl_freqmatch (cfg.id='freqmatch', type='side' → kein Überschreiben)
  {
    selector: '#refEl_freqmatch',
    fieldLabelKey: 'depFieldRefSide',
    getReasonKeys: function() {
      const reasons = [];
      try {
        if (typeof FRQ_resultsArray !== 'undefined' && Array.isArray(FRQ_resultsArray) && FRQ_resultsArray.length > 0)
          reasons.push('depReasonFRQAdaptive');
      } catch(ex) { /* FRQ_resultsArray noch in TDZ */ }
      try {
        var hasSlider = false;
        ['left', 'right'].forEach(function(side) {
          var fa = sideData[side] && sideData[side].freqmatchAdaptive;
          if (fa && fa.sliderEstimates && Object.keys(fa.sliderEstimates).length > 0)
            hasSlider = true;
        });
        if (hasSlider) reasons.push('depReasonFRQSlider');
      } catch(ex) { /* sliderEstimates noch nicht initialisiert */ }
      // Laufdaten (noch nicht abgeschlossene Runs) ebenfalls berücksichtigen
      try {
        if (typeof _FRQ_hasAdaptiveData === 'function' && _FRQ_hasAdaptiveData())
          if (reasons.indexOf('depReasonFRQAdaptive') === -1)
            reasons.push('depReasonFRQAdaptive');
      } catch(ex) {}
      return reasons;
    }
  },

  // BA 164: Aktiv-Häkchen pro Elektrode — kann nicht umgeschaltet
  // werden, wenn Meßergebnisse der aktiven Seite vorliegen.
  {
    selectorAll: '.ec-active',
    fieldLabelKey: 'depFieldActive',
    getReasonKeys: function() {
      const reasons = [];
      const s = sideData[activeSide];
      // BA 251: jRes entfaellt; nur noch elektrodenlautstaerkeResults.
      const ownHasLoud = (s.elektrodenlautstaerkeResults && s.elektrodenlautstaerkeResults.length > 0);
      if (ownHasLoud) reasons.push('depReasonLoudness');
      try {
        if (typeof FRQ_resultsArray !== 'undefined' && Array.isArray(FRQ_resultsArray) && FRQ_resultsArray.length > 0)
          reasons.push('depReasonFRQAdaptive');
      } catch(ex) { /* FRQ_resultsArray noch in TDZ */ }
      try {
        if (typeof _FRQ_hasAdaptiveData === 'function' && _FRQ_hasAdaptiveData())
          if (reasons.indexOf('depReasonFRQAdaptive') === -1)
            reasons.push('depReasonFRQAdaptive');
      } catch(ex) {}
      try {
        var hasSlider = false;
        ['left', 'right'].forEach(function(side) {
          var fa = sideData[side] && sideData[side].freqmatchAdaptive;
          if (fa && fa.sliderEstimates && Object.keys(fa.sliderEstimates).length > 0)
            hasSlider = true;
        });
        if (hasSlider) reasons.push('depReasonFRQSlider');
      } catch(ex) {}
      return reasons;
    }
  }
  ,
  // BA 205: Ausschluss-Checkbox — gesperrt, wenn adaptive FreqMatch-Trials vorliegen.
  // Bewußt eng nur auf _FRQ_hasAdaptiveData(); Loudness- und Slider-Bezug bleibt außen vor.
  {
    selectorAll: '.ec',
    fieldLabelKey: 'depFieldExclude',
    getReasonKeys: function() {
      var reasons = [];
      try {
        if (typeof _FRQ_hasAdaptiveData === 'function' && _FRQ_hasAdaptiveData())
          reasons.push('depReasonFRQAdaptive');
      } catch(ex) { /* freqmatch noch nicht initialisiert */ }
      return reasons;
    }
  }
];

// ---- Anwenden ----
function depLockApply() {
  if (typeof DEP_LOCK_RULES === 'undefined') return;
  DEP_LOCK_RULES.forEach(function(rule) {
    if (rule.selectorAll) {
      var nodes = document.querySelectorAll(rule.selectorAll);
      nodes.forEach(function(el) {
        var reasons = rule.getReasonKeys(el);
        if (reasons.length === 0) _depLockUnlock(el);
        else _depLockLock(el, rule.fieldLabelKey, reasons);
      });
    } else if (rule.selector) {
      var el = document.querySelector(rule.selector);
      if (!el) return;
      var reasons = rule.getReasonKeys(el);
      if (reasons.length === 0) _depLockUnlock(el);
      else _depLockLock(el, rule.fieldLabelKey, reasons);
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
  // BA 153: data-dep-simple → nur Titel + Grund, kein Meßdaten-Boilerplate
  if (el.dataset.depSimple) {
    popup.innerHTML =
      '<div class="dep-popup-title">' + fieldLabel + ' ' + titleSuffix + '</div>' +
      (reasonHtml ? '<div class="dep-popup-body"><ul>' + reasonHtml + '</ul></div>' : '');
  } else {
    var bodyText    = (typeof t === 'function') ? t('depLockedBody')  : 'Die Änderung würde folgende Meßergebnisse ungültig machen:';
    var footerText  = (typeof t === 'function') ? t('depLockedFooter') : 'Erst diese Ergebnisse löschen oder das Tool zurücksetzen.';
    popup.innerHTML =
      '<div class="dep-popup-title">' + fieldLabel + ' ' + titleSuffix + '</div>' +
      '<div class="dep-popup-body">' +
        '<div>' + bodyText + '</div>' +
        '<ul>' + reasonHtml + '</ul>' +
        '<div>' + footerText + '</div>' +
      '</div>';
  }
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

// BA 205: Transient-Popup für selektive Sperren (z.B. einzelner Dropdown-Wert),
// bei denen das Element selbst NICHT dauerhaft .dep-locked tragen soll.
// Setzt dataset-Attribute kurzzeitig, ruft depLockShowPopup, räumt auf.
function depLockShowTransientPopup(el, fieldLabelKey, reasonKeys) {
  if (!el) return;
  var prevField   = el.dataset.depFieldLabel;
  var prevReasons = el.dataset.depReasons;
  var prevSimple  = el.dataset.depSimple;
  el.dataset.depFieldLabel = fieldLabelKey;
  el.dataset.depReasons    = (reasonKeys || []).join(',');
  el.dataset.depSimple     = '1';   // kompakte Popup-Variante ohne Boilerplate
  depLockShowPopup(el);
  if (prevField   === undefined) delete el.dataset.depFieldLabel; else el.dataset.depFieldLabel = prevField;
  if (prevReasons === undefined) delete el.dataset.depReasons;    else el.dataset.depReasons    = prevReasons;
  if (prevSimple  === undefined) delete el.dataset.depSimple;     else el.dataset.depSimple     = prevSimple;
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
  // BA 152: Info-Icon — Popup zeigen, aber kein Blockieren
  var icon = e.target.closest('.dep-info-icon');
  if (icon) {
    e.preventDefault();
    e.stopPropagation();
    depLockShowPopup(icon);
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
    return;
  }
  // BA 152: Info-Icon
  var icon = e.target.closest('.dep-info-icon');
  if (icon) {
    e.preventDefault();
    e.stopPropagation();
    depLockShowPopup(icon);
  }
}, { capture: true, passive: false });

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') depLockHidePopup();
  var active = document.activeElement;
  if (active && active.classList && active.classList.contains('dep-locked')) {
    e.preventDefault();
  }
});
