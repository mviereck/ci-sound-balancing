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

// Hz-Software-Range pro Hersteller.
//   MED-EL: 70–8500 Hz (MAESTRO Kap. 24.6, FS/FSP-Strategien).
//   Cochlear: 63–18938 Hz (umfassender LFE/HFE-Bereich aus
//             CI Select Manual; Standard-Range ist enger, aber
//             jeder Wert in diesem Intervall ist erreichbar).
//   AB: 250–8700 Hz (Extended Low Filter Default aus SoundWave
//       Quick Reference S. 37).
const IMPL_VAL_HZ_RANGE = {
  medel:    { min: 70,  max: 8500  },
  cochlear: { min: 63,  max: 18938 },
  ab:       { min: 250, max: 8700  }
};

// Größenordnungs-Schwelle (Tippfehler-Verdacht):
//   ratio = eigen / default; warnt, wenn ratio >= 5 oder <= 0.2.
const IMPL_VAL_HZ_MAGNITUDE_FACTOR = 5;

// Trend-/Lookup-Schwellen in Cent (gegen erwarteten Verlauf).
//   Sanfter Hinweis ab 300 Cent (≈ 3 Halbtöne).
//   Stärkere Warnung ab 600 Cent (= halbe Oktave).
// Schwellwerte begründet in .manuals/Recherche_Cent_Schwellwerte_Plausibilitaet.md.
const IMPL_VAL_HZ_TREND_YELLOW_CENT = 300;
const IMPL_VAL_HZ_TREND_ORANGE_CENT = 600;

// Lokale Sprung-Schwellen in Cent (Cent-Schrittweite zwischen
// Nachbarelektroden vs. Default-Schrittweite). Aus Konzept:
// lokale Sprünge dürfen etwas weiter als globale Trend-
// Abweichungen sein, weil der apikal-basal-Gradient die
// Schrittweiten ohnehin variiert.
const IMPL_VAL_HZ_JUMP_YELLOW_CENT = 400;
const IMPL_VAL_HZ_JUMP_ORANGE_CENT = 700;

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

// Lokaler Median über die Nachbar-Werte von Index i im Versatz-Array,
// Fenster ±2, ohne i selbst. Null-Werte und null/undefined werden
// übersprungen. Rückgabe: Median oder null wenn keine Nachbarn vorhanden.
function _implLocalNeighborMedian(arr, i) {
  const vals = [];
  const from = Math.max(0, i - 2);
  const to   = Math.min(arr.length - 1, i + 2);
  for (let j = from; j <= to; j++) {
    if (j === i) continue;
    const v = arr[j];
    if (v == null || isNaN(v)) continue;
    vals.push(v);
  }
  if (vals.length === 0) return null;
  vals.sort(function (a, b) { return a - b; });
  const mid = Math.floor(vals.length / 2);
  return (vals.length % 2 === 0)
    ? (vals[mid - 1] + vals[mid]) / 2
    : vals[mid];
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

function _implCheckHzRange(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;
  const mfr = s.manufacturer;
  const range = IMPL_VAL_HZ_RANGE[mfr];
  if (!range) return warnings;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  for (let i = 0; i < s.nEl; i++) {
    if (s.elSt && s.elSt[i] === 'deactivated') continue;
    if (!s.elFreqOwn || s.elFreqOwn[i] == null) continue;

    const hz = s.elFreqOwn[i];
    if (hz < range.min || hz > range.max) {
      warnings.push({
        level: IMPL_VAL_LEVEL_RED,
        electrodeIdx: i,
        field: 'hz',
        messageKey: 'implValidateHzRange',
        messageParams: {
          e: dENFn(i),
          hz: Math.round(hz),
          min: range.min,
          max: range.max
        }
      });
    }
  }
  return warnings;
}

function _implCheckHzMagnitude(s) {
  const warnings = [];
  if (!s || !s.nEl || !s.freqs) return warnings;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };
  const fac = IMPL_VAL_HZ_MAGNITUDE_FACTOR;

  for (let i = 0; i < s.nEl; i++) {
    if (s.elSt && s.elSt[i] === 'deactivated') continue;
    if (!s.elFreqOwn || s.elFreqOwn[i] == null) continue;

    const eigen = s.elFreqOwn[i];
    const def = s.freqs[i];
    if (!def || def <= 0) continue;

    const ratio = eigen / def;
    if (ratio >= fac || ratio <= (1 / fac)) {
      warnings.push({
        level: IMPL_VAL_LEVEL_ORANGE,
        electrodeIdx: i,
        field: 'hz',
        messageKey: 'implValidateHzMagnitude',
        messageParams: {
          e: dENFn(i),
          hz: Math.round(eigen),
          def: Math.round(def),
          ratio: ratio >= 1 ? Math.round(ratio) : '1/' + Math.round(1 / ratio)
        }
      });
    }
  }
  return warnings;
}

function _implCheckHzCochlearLookup(s) {
  const warnings = [];
  if (!s || s.manufacturer !== 'cochlear') return warnings;
  if (s.nEl !== 22) return warnings;
  if (typeof COCHLEAR_FATS === 'undefined') return warnings;

  // Lookup nur bei vollem Elektrodensatz aktiv — siehe BA 137
  // für die Deaktivierungs-Sonderprüfung.
  let nActive = s.nEl;
  if (s.elSt) {
    nActive = 0;
    for (let i = 0; i < s.nEl; i++) {
      if (s.elSt[i] !== 'deactivated') nActive++;
    }
  }
  if (nActive !== 22) return warnings;

  const fat = COCHLEAR_FATS.standard_22_lfe188_hfe7938;
  if (!fat || fat.length !== s.nEl) return warnings;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  for (let i = 0; i < s.nEl; i++) {
    if (s.elSt && s.elSt[i] === 'deactivated') continue;
    // Nur User-Override prüfen.
    if (!s.elFreqOwn || s.elFreqOwn[i] == null) continue;

    const eigen = s.elFreqOwn[i];
    const expected = fat[i];
    if (!expected || expected <= 0 || eigen <= 0) continue;

    const cents = Math.abs(1200 * Math.log2(eigen / expected));

    let level = null;
    if (cents >= IMPL_VAL_HZ_TREND_ORANGE_CENT) {
      level = IMPL_VAL_LEVEL_ORANGE;
    } else if (cents >= IMPL_VAL_HZ_TREND_YELLOW_CENT) {
      level = IMPL_VAL_LEVEL_YELLOW;
    }
    if (level == null) continue;

    warnings.push({
      level: level,
      electrodeIdx: i,
      field: 'hz',
      messageKey: 'implValidateHzCochlearLookup',
      messageParams: {
        e: dENFn(i),
        hz: Math.round(eigen),
        expected: Math.round(expected),
        cents: Math.round(cents)
      }
    });
  }
  return warnings;
}

function _implCheckHzTrendMedelAb(s) {
  const warnings = [];
  if (!s || !s.nEl || !s.freqs) return warnings;
  if (s.manufacturer !== 'medel' && s.manufacturer !== 'ab') return warnings;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  // Versatz-Array vorbereiten: Cent-Differenz zwischen
  // eigen_i und default_i, nur für User-Override und aktive
  // (nicht deaktivierte) Elektroden. Sonst null.
  const versatz = new Array(s.nEl).fill(null);
  for (let i = 0; i < s.nEl; i++) {
    if (s.elSt && s.elSt[i] === 'deactivated') continue;
    if (!s.elFreqOwn || s.elFreqOwn[i] == null) continue;
    const eigen = s.elFreqOwn[i];
    const def = s.freqs[i];
    if (!eigen || !def || eigen <= 0 || def <= 0) continue;
    versatz[i] = 1200 * Math.log2(eigen / def);
  }

  // Mindestens 3 Versatz-Werte erforderlich, damit ein lokaler
  // Median überhaupt aussagekräftig wird.
  let nVersatz = 0;
  for (let i = 0; i < versatz.length; i++) if (versatz[i] != null) nVersatz++;
  if (nVersatz < 3) return warnings;

  for (let i = 0; i < s.nEl; i++) {
    if (versatz[i] == null) continue;
    const trend = _implLocalNeighborMedian(versatz, i);
    if (trend == null) continue;
    const dev = Math.abs(versatz[i] - trend);

    let level = null;
    if (dev >= IMPL_VAL_HZ_TREND_ORANGE_CENT) {
      level = IMPL_VAL_LEVEL_ORANGE;
    } else if (dev >= IMPL_VAL_HZ_TREND_YELLOW_CENT) {
      level = IMPL_VAL_LEVEL_YELLOW;
    }
    if (level == null) continue;

    warnings.push({
      level: level,
      electrodeIdx: i,
      field: 'hz',
      messageKey: 'implValidateHzTrend',
      messageParams: {
        e: dENFn(i),
        dev: Math.round(dev),
        trend: Math.round(trend)
      }
    });
  }
  return warnings;
}

function _implCheckHzJumpMedelAb(s) {
  const warnings = [];
  if (!s || !s.nEl || !s.freqs) return warnings;
  if (s.manufacturer !== 'medel' && s.manufacturer !== 'ab') return warnings;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  for (let i = 0; i < s.nEl - 1; i++) {
    if (s.elSt && s.elSt[i] === 'deactivated') continue;
    if (s.elSt && s.elSt[i + 1] === 'deactivated') continue;

    // Sprung-Prüfung nur, wenn mindestens eine der beiden
    // Elektroden einen User-Override hat — sonst sind die Werte
    // = Default und die Schrittweite stimmt per Konstruktion.
    const hasOverride = (s.elFreqOwn && s.elFreqOwn[i] != null)
                     || (s.elFreqOwn && s.elFreqOwn[i + 1] != null);
    if (!hasOverride) continue;

    const hzI = (s.elFreqOwn && s.elFreqOwn[i]     != null) ? s.elFreqOwn[i]     : s.freqs[i];
    const hzJ = (s.elFreqOwn && s.elFreqOwn[i + 1] != null) ? s.elFreqOwn[i + 1] : s.freqs[i + 1];
    if (!hzI || !hzJ || hzI <= 0 || hzJ <= 0) continue;
    if (!s.freqs[i] || !s.freqs[i + 1]) continue;

    const stepUser  = 1200 * Math.log2(hzJ / hzI);
    const stepDef   = 1200 * Math.log2(s.freqs[i + 1] / s.freqs[i]);
    const dev = Math.abs(stepUser - stepDef);

    let level = null;
    if (dev >= IMPL_VAL_HZ_JUMP_ORANGE_CENT) {
      level = IMPL_VAL_LEVEL_ORANGE;
    } else if (dev >= IMPL_VAL_HZ_JUMP_YELLOW_CENT) {
      level = IMPL_VAL_LEVEL_YELLOW;
    }
    if (level == null) continue;

    // Markiert die rechte Elektrode des Paars (E_{i+1}), weil
    // die Lesart "der Sprung zu dieser Elektrode ist verdächtig"
    // intuitiv ist.
    warnings.push({
      level: level,
      electrodeIdx: i + 1,
      field: 'hz',
      messageKey: 'implValidateHzJump',
      messageParams: {
        eI:       dENFn(i),
        eJ:       dENFn(i + 1),
        stepUser: Math.round(stepUser),
        stepDef:  Math.round(stepDef),
        dev:      Math.round(dev)
      }
    });
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
  warnings.push.apply(warnings, _implCheckHzRange(s));
  warnings.push.apply(warnings, _implCheckHzMagnitude(s));
  warnings.push.apply(warnings, _implCheckHzCochlearLookup(s));
  warnings.push.apply(warnings, _implCheckHzTrendMedelAb(s));
  warnings.push.apply(warnings, _implCheckHzJumpMedelAb(s));

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
