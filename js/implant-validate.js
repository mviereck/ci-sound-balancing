// ============================================================
// IMPLANT VALIDATE — Plausibilitätsprüfung User-Eingaben
// ============================================================
// Architektur:
//   validateImplantTable(side) wird nach jedem Re-Render von
//   buildFreqTable() in freq-table.js aufgerufen. Sie sammelt
//   Warnungen aus einzelnen Prüfungs-Funktionen (_check…),
//   trägt die strengste Warnung pro Feld als CSS-Klassen-Rand
//   an die Eingabefelder und rendert eine Liste in der
//   Warnbox unter der Tabelle.
//
// Warn-Schema (ein Objekt pro Warnung):
//   {
//     level:        1 (rot) | 2 (orange) | 3 (gelb),
//     electrodeIdx: 0..n-1  (optional, bei zeilenbezogen),
//     field:        'hz' | 'thr' | 'upper'  (optional),
//     globalEl:    'c' | 'idr' | 'iidr' (optional, bei globalen Feldern),
//     messageKey:   i18n-Key,
//     messageParams: {…}  (Platzhalter für den i18n-Text)
//   }
// ============================================================

const IMPL_VAL_LEVEL_RED = 1;
const IMPL_VAL_LEVEL_ORANGE = 2;
const IMPL_VAL_LEVEL_YELLOW = 3;

// --- Helfer -------------------------------------------------

function _implEffFreqOf(s, i) {
  if (!s) return 0;
  if (s.elFreqOwn && s.elFreqOwn[i] != null) return s.elFreqOwn[i];
  return s.freqs ? s.freqs[i] : 0;
}

function _implMsg(w) {
  let msg = (typeof t === 'function') ? t(w.messageKey) : w.messageKey;
  if (!msg) msg = w.messageKey;
  if (w.messageParams) {
    msg = msg.replace(/\{(\w+)\}/g, function (_, k) {
      return w.messageParams[k] != null ? w.messageParams[k] : '{' + k + '}';
    });
  }
  return msg;
}

function _implFieldSelector(idx, field) {
  // Klassen wie in freq-table.js: .fo = Hz eigen, .it = THR, .iu = Upper
  const cls = field === 'hz' ? 'fo' : field === 'thr' ? 'it' : field === 'upper' ? 'iu' : null;
  if (!cls) return null;
  return '.' + cls + '[data-i="' + idx + '"]';
}

function _implClearMarkers() {
  document.querySelectorAll(
    '.impl-warn-red, .impl-warn-orange, .impl-warn-yellow'
  ).forEach(function (el) {
    el.classList.remove('impl-warn-red', 'impl-warn-orange', 'impl-warn-yellow');
    el.removeAttribute('title');
  });
}

function _implApplyFieldLevel(w) {
  if (w.electrodeIdx == null || !w.field) return;
  const sel = _implFieldSelector(w.electrodeIdx, w.field);
  if (!sel) return;
  const el = document.querySelector(sel);
  if (!el) return;

  // Strengste Stufe (kleinste level-Nr) gewinnt.
  const currentLevel =
    el.classList.contains('impl-warn-red') ? 1 :
    el.classList.contains('impl-warn-orange') ? 2 :
    el.classList.contains('impl-warn-yellow') ? 3 : 99;
  if (w.level >= currentLevel) return;

  el.classList.remove('impl-warn-red', 'impl-warn-orange', 'impl-warn-yellow');
  const newClass =
    w.level === 1 ? 'impl-warn-red' :
    w.level === 2 ? 'impl-warn-orange' : 'impl-warn-yellow';
  el.classList.add(newClass);
  el.title = _implMsg(w);
}

// --- Render Warnbox ----------------------------------------

function _implRenderBox(warnings) {
  const list = document.getElementById('implValidateList');
  if (!list) return;
  list.innerHTML = '';

  if (!warnings || warnings.length === 0) {
    const li = document.createElement('li');
    li.className = 'impl-val-empty';
    li.textContent = (typeof t === 'function')
      ? t('implValidateEmpty') : 'Keine Auffälligkeiten';
    list.appendChild(li);
    return;
  }

  // Sortierung: rote zuerst, dann orange, dann gelb.
  const sorted = warnings.slice().sort(function (a, b) {
    return a.level - b.level;
  });

  sorted.forEach(function (w) {
    const li = document.createElement('li');
    li.className = 'impl-val-entry impl-val-entry-l' + w.level;
    const dot = document.createElement('span');
    dot.className = 'impl-val-dot impl-val-dot-l' + w.level;
    li.appendChild(dot);
    li.appendChild(document.createTextNode(_implMsg(w)));
    list.appendChild(li);
  });
}

// --- Prüfungen ---------------------------------------------

function _implCheckHzMonotonie(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;
  const n = s.nEl;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  for (let i = 0; i < n - 1; i++) {
    if (s.elSt && s.elSt[i] === 'deactivated') continue;
    if (s.elSt && s.elSt[i + 1] === 'deactivated') continue;

    const hzI = _implEffFreqOf(s, i);
    const hzJ = _implEffFreqOf(s, i + 1);
    if (hzJ <= hzI) {
      warnings.push({
        level: IMPL_VAL_LEVEL_RED,
        electrodeIdx: i + 1,
        field: 'hz',
        messageKey: 'implValidateHzMonotonie',
        messageParams: {
          eI: dENFn(i),
          eJ: dENFn(i + 1),
          hzI: Math.round(hzI),
          hzJ: Math.round(hzJ)
        }
      });
    }
  }
  return warnings;
}

// --- Hauptfunktion -----------------------------------------

function validateImplantTable(side) {
  if (typeof sideData === 'undefined') return;
  const s = sideData[side];
  if (!s) return;

  const warnings = [];
  warnings.push.apply(warnings, _implCheckHzMonotonie(s));
  // Weitere Prüfungen werden hier in folgenden BAs angefügt.

  _implClearMarkers();
  warnings.forEach(_implApplyFieldLevel);
  _implRenderBox(warnings);
}

// --- Box-Header-Sprachsetzer (i18n) ------------------------

function _implValidateApplyLang() {
  const title = document.getElementById('implValidateTitle');
  if (title && typeof t === 'function') {
    title.textContent = t('implValidateTitle');
  }
  // Box neu rendern, damit "Keine Auffälligkeiten"-Text aktualisiert wird.
  if (typeof activeSide !== 'undefined') {
    validateImplantTable(activeSide);
  }
}
