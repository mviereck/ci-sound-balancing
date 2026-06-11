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
//     field:        'hz' | 'thr' | 'upper' oder Array davon
//                   (optional, ein Warning kann mehrere Felder markieren),
//     globalEl:    'c' | 'idr' | 'iidr' (optional, bei globalen Feldern),
//     messageKey:   i18n-Key,
//     messageParams: {…}  (Platzhalter für den i18n-Text)
//   }
// ============================================================

const IMPL_VAL_LEVEL_RED = 1;
const IMPL_VAL_LEVEL_ORANGE = 2;
const IMPL_VAL_LEVEL_YELLOW = 3;
const IMPL_VAL_LEVEL_INFO = 4;

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

// THR/Upper-Level Wertebereiche pro Hersteller (Hardware-Limits).
//   MED-EL: MCL maximal 268,6 qu (Berechnungsgrundlagen dB zu CI.md
//           Kap. 3.1); THR identische Hardware-Grenze, real meist
//           viel niedriger. Bereich konservativ 0–268.6.
//   Cochlear: T-Level und C-Level als 8-bit-Skala 0–255 CL.
//   AB: M-Level/T-Level in CU; keine harte öffentlich dokumentierte
//       Grenze, typischer klinischer Bereich 0–600. Hard-Cap
//       pragmatisch auf 1000 gesetzt.
const IMPL_VAL_THR_UPPER_RANGE = {
  medel:    { thr: { min: 0, max: 268.6 }, upper: { min: 0, max: 268.6 } },
  cochlear: { thr: { min: 0, max: 255   }, upper: { min: 0, max: 255   } },
  ab:       { thr: { min: 0, max: 1000  }, upper: { min: 0, max: 1000  } }
};

// Größenordnungs-Schwelle für THR/Upper (Tippfehler):
//   Wert weicht um Faktor 10 vom Spaltenmedian ab.
const IMPL_VAL_THR_UPPER_MAGNITUDE_FACTOR = 10;

// MAD-Schwelle für THR/Upper-Ausreißer:
//   |x − median| > MAD_FACTOR · MAD wird als Ausreißer markiert.
const IMPL_VAL_THR_UPPER_MAD_FACTOR = 3;

// Aktivierungsschwellen:
//   Größenordnung greift ab MIN_MAGNITUDE Werten,
//   MAD-Ausreißer ab MIN_MAD Werten in der Spalte.
const IMPL_VAL_THR_UPPER_MIN_FOR_MAGNITUDE = 3;
const IMPL_VAL_THR_UPPER_MIN_FOR_MAD = 5;

// Globale Implantat-Parameter — Plausibilitäts-Bereiche.
// Quellen: Berechnungsgrundlagen dB zu CI.md Kap. 3.2 (c-Wert),
// Kap. 5.2 (IDR), Kap. 4.3 (IIDR).
//   hardware: Software-Limits, außerhalb → Level 1 rot.
//   typical:  typischer Audiologen-Bereich, außerhalb → Level 3 gelb.
//   Default-Werte sind kommentiert, werden aber nicht direkt geprüft.
const IMPL_VAL_GLOBAL_C = {
  hardware: { min: 0,   max: 8000 }, // Default 500
  typical:  { min: 100, max: 2000 }
};
const IMPL_VAL_GLOBAL_IDR = {
  hardware: { min: 20, max: 80 },    // Default 60
  typical:  { min: 40, max: 70 }
};
const IMPL_VAL_GLOBAL_IIDR = {
  // IIDR hat keine öffentlich dokumentierte harte Software-Grenze.
  // Konservativ als Hardware-Range das volle plausible Spektrum,
  // typischer Bereich enger.
  hardware: { min: 10, max: 100 },   // Default 40
  typical:  { min: 30, max: 60  }
};

// Bezeichnung der "Upper Level"-Spalte je Hersteller — wird in
// den Info-Hinweisen als {label} eingesetzt, damit der Text mit
// dem Tabellenkopf konsistent bleibt.
const IMPL_VAL_UPPER_LABEL = {
  medel:    'MCL',
  cochlear: 'C-Level',
  ab:       'M-Level'
};

// Einheit der Hersteller-Werte je Hersteller — wird in den
// Info-Hinweisen als {unit} eingesetzt.
const IMPL_VAL_UNIT = {
  medel:    'qu',
  cochlear: 'CL',
  ab:       'CU'
};

// --- Helfer -------------------------------------------------

function _implEffFreqOf(s, i) {
  if (!s) return 0;
  if (s.elFreqOwn && s.elFreqOwn[i] != null) return s.elFreqOwn[i];
  return s.freqs ? s.freqs[i] : 0;
}

function _implThrOf(s, i) {
  if (!s || !s.implant || !s.implant.thr) return null;
  const v = s.implant.thr[i];
  return (v == null || isNaN(v)) ? null : v;
}

function _implUpperOf(s, i) {
  if (!s || !s.implant) return null;
  const arr = (s.manufacturer === 'medel')
    ? s.implant.mcl
    : s.implant.upperLevel;
  if (!arr) return null;
  const v = arr[i];
  return (v == null || isNaN(v)) ? null : v;
}

function _implCollectColumnValues(s, getterFn) {
  const vals = [];
  for (let i = 0; i < s.nEl; i++) {
    // BA 164
    if (s.elActive && s.elActive[i] === false) continue;
    const v = getterFn(s, i);
    if (v != null && !isNaN(v)) vals.push(v);
  }
  return vals;
}

function _implMedian(arr) {
  if (!arr || arr.length === 0) return null;
  const sorted = arr.slice().sort(function (a, b) { return a - b; });
  const mid = Math.floor(sorted.length / 2);
  return (sorted.length % 2 === 0)
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function _implMAD(arr, median) {
  if (!arr || arr.length === 0 || median == null) return null;
  const devs = arr.map(function (v) { return Math.abs(v - median); });
  return _implMedian(devs);
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

function _implGlobalSelector(globalEl) {
  if (globalEl === 'c')    return '#implC';
  if (globalEl === 'idr')  return '#implIDR';
  if (globalEl === 'iidr') return '#implIIDR';
  return null;
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
  // Globale-Parameter-Pfad: markiert #implC / #implIDR / #implIIDR.
  if (w.globalEl) {
    const sel = _implGlobalSelector(w.globalEl);
    if (!sel) return;
    const el = document.querySelector(sel);
    if (!el) return;
    _implApplyLevelToElement(el, w);
    return;
  }

  // Tabellenfeld-Pfad: ein Warning kann mehrere Felder markieren.
  if (w.electrodeIdx == null || !w.field) return;
  const fields = Array.isArray(w.field) ? w.field : [w.field];
  fields.forEach(function (field) {
    const sel = _implFieldSelector(w.electrodeIdx, field);
    if (!sel) return;
    const el = document.querySelector(sel);
    if (!el) return;
    _implApplyLevelToElement(el, w);
  });
}

// Setzt die strengste Stufe auf ein einzelnes Eingabefeld.
function _implApplyLevelToElement(el, w) {
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
    // BA 164
    if (s.elActive && s.elActive[i] === false) continue;
    // BA 164
    if (s.elActive && s.elActive[i + 1] === false) continue;

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
    // BA 164
    if (s.elActive && s.elActive[i] === false) continue;
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
    // BA 164
    if (s.elActive && s.elActive[i] === false) continue;
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
      // BA 164
      if (s.elActive && s.elActive[i] !== false) nActive++;
    }
  }
  if (nActive !== 22) return warnings;

  const fat = COCHLEAR_FATS.standard_22_lfe188_hfe7938;
  if (!fat || fat.length !== s.nEl) return warnings;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  for (let i = 0; i < s.nEl; i++) {
    // BA 164
    if (s.elActive && s.elActive[i] === false) continue;
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
    // BA 164
    if (s.elActive && s.elActive[i] === false) continue;
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
    // BA 164
    if (s.elActive && s.elActive[i] === false) continue;
    // BA 164
    if (s.elActive && s.elActive[i + 1] === false) continue;

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

function _implCheckThrUpperRange(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;
  const ranges = IMPL_VAL_THR_UPPER_RANGE[s.manufacturer];
  if (!ranges) return warnings;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  for (let i = 0; i < s.nEl; i++) {
    // BA 164
    if (s.elActive && s.elActive[i] === false) continue;

    const thr = _implThrOf(s, i);
    if (thr != null && (thr < ranges.thr.min || thr > ranges.thr.max)) {
      warnings.push({
        level: IMPL_VAL_LEVEL_RED,
        electrodeIdx: i,
        field: 'thr',
        messageKey: 'implValidateThrRange',
        messageParams: {
          e: dENFn(i),
          val: thr,
          min: ranges.thr.min,
          max: ranges.thr.max
        }
      });
    }

    const upper = _implUpperOf(s, i);
    if (upper != null && (upper < ranges.upper.min || upper > ranges.upper.max)) {
      warnings.push({
        level: IMPL_VAL_LEVEL_RED,
        electrodeIdx: i,
        field: 'upper',
        messageKey: 'implValidateUpperRange',
        messageParams: {
          e: dENFn(i),
          val: upper,
          min: ranges.upper.min,
          max: ranges.upper.max
        }
      });
    }
  }
  return warnings;
}

function _implCheckThrUpperConflict(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  for (let i = 0; i < s.nEl; i++) {
    // BA 164
    if (s.elActive && s.elActive[i] === false) continue;
    const thr   = _implThrOf(s, i);
    const upper = _implUpperOf(s, i);
    if (thr == null || upper == null) continue;
    if (thr >= upper) {
      warnings.push({
        level: IMPL_VAL_LEVEL_RED,
        electrodeIdx: i,
        field: ['thr', 'upper'],
        messageKey: 'implValidateThrUpperConflict',
        messageParams: { e: dENFn(i), thr: thr, upper: upper }
      });
    }
  }
  return warnings;
}

function _implCheckThrUpperMagnitude(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;
  const fac = IMPL_VAL_THR_UPPER_MAGNITUDE_FACTOR;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  const colsToCheck = [
    { getter: _implThrOf,   field: 'thr',   msgKey: 'implValidateThrMagnitude' },
    { getter: _implUpperOf, field: 'upper', msgKey: 'implValidateUpperMagnitude' }
  ];

  colsToCheck.forEach(function (col) {
    const vals = _implCollectColumnValues(s, col.getter);
    if (vals.length < IMPL_VAL_THR_UPPER_MIN_FOR_MAGNITUDE) return;
    const med = _implMedian(vals);
    if (med == null || med <= 0) return;

    for (let i = 0; i < s.nEl; i++) {
      // BA 164
    if (s.elActive && s.elActive[i] === false) continue;
      const v = col.getter(s, i);
      if (v == null) continue;
      const ratio = v / med;
      if (ratio >= fac || ratio <= (1 / fac)) {
        warnings.push({
          level: IMPL_VAL_LEVEL_ORANGE,
          electrodeIdx: i,
          field: col.field,
          messageKey: col.msgKey,
          messageParams: {
            e: dENFn(i),
            val: v,
            median: Math.round(med * 10) / 10,
            ratio: ratio >= 1 ? Math.round(ratio) : '1/' + Math.round(1 / ratio)
          }
        });
      }
    }
  });
  return warnings;
}

function _implCheckThrUpperMAD(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;
  const fac = IMPL_VAL_THR_UPPER_MAD_FACTOR;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  const colsToCheck = [
    { getter: _implThrOf,   field: 'thr',   msgKey: 'implValidateThrMAD' },
    { getter: _implUpperOf, field: 'upper', msgKey: 'implValidateUpperMAD' }
  ];

  colsToCheck.forEach(function (col) {
    const vals = _implCollectColumnValues(s, col.getter);
    if (vals.length < IMPL_VAL_THR_UPPER_MIN_FOR_MAD) return;
    const med = _implMedian(vals);
    const mad = _implMAD(vals, med);
    if (med == null || mad == null || mad <= 0) return;
    const threshold = fac * mad;

    for (let i = 0; i < s.nEl; i++) {
      // BA 164
    if (s.elActive && s.elActive[i] === false) continue;
      const v = col.getter(s, i);
      if (v == null) continue;
      const dev = Math.abs(v - med);
      if (dev > threshold) {
        warnings.push({
          level: IMPL_VAL_LEVEL_YELLOW,
          electrodeIdx: i,
          field: col.field,
          messageKey: col.msgKey,
          messageParams: {
            e:      dENFn(i),
            val:    v,
            median: Math.round(med * 10) / 10,
            dev:    Math.round(dev * 10) / 10
          }
        });
      }
    }
  });
  return warnings;
}

function _implCheckFatOnDeactivation(s) {
  const warnings = [];
  if (!s || !s.nEl || !s.elSt) return warnings;

  // Indizes der deaktivierten und der aktiven Elektroden sammeln.
  const deactIdxs = [];
  const activeIdxs = [];
  for (let i = 0; i < s.nEl; i++) {
    // BA 164
    if (s.elActive && s.elActive[i] === false) deactIdxs.push(i);
    else activeIdxs.push(i);
  }

  // Auslöser: ≥1 deaktivierte Elektrode.
  if (deactIdxs.length === 0) return warnings;

  // Wenn keine aktiven mehr da sind (Edge-Case), nichts melden.
  if (activeIdxs.length === 0) return warnings;

  // Sub-Test 1 — globaler Test:
  //   Alle aktiven Elektroden haben einen Hz-eigen-Override.
  //   Deutet auf vollständige globale Umverteilung der FAT.
  const allActiveOverridden = activeIdxs.every(function (i) {
    return s.elFreqOwn && s.elFreqOwn[i] != null;
  });
  if (allActiveOverridden) return warnings; // global-Test bestanden

  // Sub-Test 2 — lokaler Test:
  //   Für mindestens eine deaktivierte Elektrode hat ein direkter
  //   (aktiver) Nachbar einen Hz-eigen-Override.
  //   Deutet auf lokale Anpassung an die Lücke.
  const localTestPassed = deactIdxs.some(function (d) {
    const neighbors = [];
    if (d > 0)             neighbors.push(d - 1);
    if (d < s.nEl - 1)     neighbors.push(d + 1);
    return neighbors.some(function (n) {
      // BA 164
      if (s.elActive && s.elActive[n] === false) return false;
      return s.elFreqOwn && s.elFreqOwn[n] != null;
    });
  });
  if (localTestPassed) return warnings; // lokal-Test bestanden

  // Weder global noch lokal bestanden → FAT scheint nicht angepasst.
  // Bewertung herstellerspezifisch.
  const isAb = (s.manufacturer === 'ab');
  warnings.push({
    level: isAb ? IMPL_VAL_LEVEL_YELLOW : IMPL_VAL_LEVEL_ORANGE,
    messageKey: isAb ? 'implValidateFatAb' : 'implValidateFatMissing',
    messageParams: {
      n_deact: deactIdxs.length
    }
  });
  return warnings;
}

function _implCheckGlobalCWert(s) {
  const warnings = [];
  if (!s || s.manufacturer !== 'medel' || !s.implant) return warnings;
  const v = s.implant.cValue;
  if (v == null || isNaN(v)) return warnings;

  const hw = IMPL_VAL_GLOBAL_C.hardware;
  const tp = IMPL_VAL_GLOBAL_C.typical;

  if (v < hw.min || v > hw.max) {
    warnings.push({
      level: IMPL_VAL_LEVEL_RED,
      globalEl: 'c',
      messageKey: 'implValidateCRangeHard',
      messageParams: { val: v, min: hw.min, max: hw.max }
    });
  } else if (v < tp.min || v > tp.max) {
    warnings.push({
      level: IMPL_VAL_LEVEL_YELLOW,
      globalEl: 'c',
      messageKey: 'implValidateCRangeTypical',
      messageParams: { val: v, min: tp.min, max: tp.max }
    });
  }
  return warnings;
}

function _implCheckGlobalIDR(s) {
  const warnings = [];
  if (!s || s.manufacturer !== 'ab' || !s.implant) return warnings;
  const v = s.implant.idr;
  if (v == null || isNaN(v)) return warnings;

  const hw = IMPL_VAL_GLOBAL_IDR.hardware;
  const tp = IMPL_VAL_GLOBAL_IDR.typical;

  if (v < hw.min || v > hw.max) {
    warnings.push({
      level: IMPL_VAL_LEVEL_RED,
      globalEl: 'idr',
      messageKey: 'implValidateIDRRangeHard',
      messageParams: { val: v, min: hw.min, max: hw.max }
    });
  } else if (v < tp.min || v > tp.max) {
    warnings.push({
      level: IMPL_VAL_LEVEL_YELLOW,
      globalEl: 'idr',
      messageKey: 'implValidateIDRRangeTypical',
      messageParams: { val: v, min: tp.min, max: tp.max }
    });
  }
  return warnings;
}

function _implCheckGlobalIIDR(s) {
  const warnings = [];
  if (!s || s.manufacturer !== 'cochlear' || !s.implant) return warnings;
  const v = s.implant.iidr;
  if (v == null || isNaN(v)) return warnings;

  const hw = IMPL_VAL_GLOBAL_IIDR.hardware;
  const tp = IMPL_VAL_GLOBAL_IIDR.typical;

  if (v < hw.min || v > hw.max) {
    warnings.push({
      level: IMPL_VAL_LEVEL_RED,
      globalEl: 'iidr',
      messageKey: 'implValidateIIDRRangeHard',
      messageParams: { val: v, min: hw.min, max: hw.max }
    });
  } else if (v < tp.min || v > tp.max) {
    warnings.push({
      level: IMPL_VAL_LEVEL_YELLOW,
      globalEl: 'iidr',
      messageKey: 'implValidateIIDRRangeTypical',
      messageParams: { val: v, min: tp.min, max: tp.max }
    });
  }
  return warnings;
}

// --- Info-Hinweise (Level 4, blau) -------------------------
// Diese Prüfungen markieren keine Tabellenfelder mit Outline.
// Sie erscheinen nur als Listeneintrag in der Warnbox.
// Sie betrachten nur aktive Elektroden (elActive[i] !== false).

function _implCheckInfoFreqOwn(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;

  let totalActive = 0;
  let ownCount = 0;
  for (let i = 0; i < s.nEl; i++) {
    if (s.elActive && s.elActive[i] === false) continue;
    totalActive++;
    if (s.elFreqOwn && s.elFreqOwn[i] != null) ownCount++;
  }
  if (totalActive === 0) return warnings;

  if (ownCount === 0) {
    warnings.push({
      level: IMPL_VAL_LEVEL_INFO,
      messageKey: 'implValidateInfoFreqEmpty'
    });
  } else if (ownCount < totalActive) {
    warnings.push({
      level: IMPL_VAL_LEVEL_INFO,
      messageKey: 'implValidateInfoFreqPartial'
    });
  }
  return warnings;
}

function _implCheckInfoAllActive(s) {
  const warnings = [];
  if (!s || !s.nEl || !s.elActive) return warnings;

  const anyInactive = s.elActive.some(function (a) { return a === false; });
  if (!anyInactive) {
    warnings.push({
      level: IMPL_VAL_LEVEL_INFO,
      messageKey: 'implValidateInfoAllActive'
    });
  }
  return warnings;
}

function _implCheckInfoUpperLevel(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;

  const label = IMPL_VAL_UPPER_LABEL[s.manufacturer] || 'MCL';
  const unit  = IMPL_VAL_UNIT[s.manufacturer] || 'qu';

  let totalActive = 0;
  let setCount = 0;
  for (let i = 0; i < s.nEl; i++) {
    if (s.elActive && s.elActive[i] === false) continue;
    totalActive++;
    if (_implUpperOf(s, i) != null) setCount++;
  }
  if (totalActive === 0) return warnings;

  if (setCount === 0) {
    warnings.push({
      level: IMPL_VAL_LEVEL_INFO,
      messageKey: 'implValidateInfoUpperEmpty',
      messageParams: { label: label, unit: unit }
    });
  } else if (setCount < totalActive) {
    warnings.push({
      level: IMPL_VAL_LEVEL_INFO,
      messageKey: 'implValidateInfoUpperPartial',
      messageParams: { label: label, unit: unit }
    });
  }
  return warnings;
}

function _implCheckInfoThr(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;
  // THR-Hinweis nur bei Advanced Bionics — bei MED-EL und Cochlear
  // wird THR fuer die Hersteller-Werte-Berechnung nicht gebraucht.
  if (s.manufacturer !== 'ab') return warnings;

  let totalActive = 0;
  let setCount = 0;
  for (let i = 0; i < s.nEl; i++) {
    if (s.elActive && s.elActive[i] === false) continue;
    totalActive++;
    if (_implThrOf(s, i) != null) setCount++;
  }
  if (totalActive === 0) return warnings;

  if (setCount === 0) {
    warnings.push({
      level: IMPL_VAL_LEVEL_INFO,
      messageKey: 'implValidateInfoThrEmpty'
    });
  } else if (setCount < totalActive) {
    warnings.push({
      level: IMPL_VAL_LEVEL_INFO,
      messageKey: 'implValidateInfoThrPartial'
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
  warnings.push.apply(warnings, _implCheckThrUpperRange(s));
  warnings.push.apply(warnings, _implCheckThrUpperConflict(s));
  warnings.push.apply(warnings, _implCheckThrUpperMagnitude(s));
  warnings.push.apply(warnings, _implCheckThrUpperMAD(s));
  warnings.push.apply(warnings, _implCheckFatOnDeactivation(s));
  warnings.push.apply(warnings, _implCheckGlobalCWert(s));
  warnings.push.apply(warnings, _implCheckGlobalIDR(s));
  warnings.push.apply(warnings, _implCheckGlobalIIDR(s));
  warnings.push.apply(warnings, _implCheckInfoFreqOwn(s));
  warnings.push.apply(warnings, _implCheckInfoAllActive(s));
  warnings.push.apply(warnings, _implCheckInfoUpperLevel(s));
  warnings.push.apply(warnings, _implCheckInfoThr(s));

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
