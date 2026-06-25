// ============================================================
// STATE & SIDE MANAGEMENT
// ============================================================

// --- Global state variables ---
let activeSide = "left";
const sideData = { left: {}, right: {} };
let mfr,
  nEl,
  freqs,
  elFreqOwn,
  elSt,
  elNt,
  elExDur,
  elektrodenlautstaerkeSchieber,
  refEl,
  elektrodenlautstaerkeResults,
  config;
// effFreq[i] = elFreqOwn[i] ?? freqs[i] (MFR default)
function effFreq(i) {
  return elFreqOwn && elFreqOwn[i] != null ? elFreqOwn[i] : freqs[i];
}
// Effektive Anzeige-/Berechnungs-Frequenz unter Berücksichtigung des
// aktuellen Frequenz-Warping-Zustands. Verwendet von Kurven-Tab
// (elektrodenlautstaerkeKurvenChartZeichnen, elektrodenlautstaerkeKurveBerechnen) und Player (pDrawEQ, pBuildEQ) für
// die Cent-basierte x-Achse und die Frequenz-Interpolation.
//
// Andere Module (Tests, Audio-Pfad, Schieber-Tab, Meßergebnisse,
// Implantat-Tabelle, MAPLAW) verwenden weiterhin effFreq() — die
// Elektroden bewegen sich physisch nicht, Warp ist eine
// Anzeige-/Berechnungs-Schicht für die wahrgenommene Frequenz.
//
// Parameter side optional: wenn gesetzt, wird temporär die andere
// Seite gebunden (für seitenspezifische Aufrufe wie im Druck).
function effFreqDisplay(i, side) {
  const baseHz = (side != null && typeof withSide === "function")
    ? withSide(side, function () { return effFreq(i); })
    : effFreq(i);
  if (typeof pWarpOn === "undefined" || !pWarpOn) return baseHz;
  const src = (typeof _warpFResSource === "function")
    ? _warpFResSource()
    : (typeof fRes !== "undefined" && Array.isArray(fRes) ? fRes : []);
  if (!src.length) return baseHz;
  if (typeof buildWarpPoints !== "function" ||
      typeof centShift !== "function") return baseHz;
  const points = buildWarpPoints(src, pWarpMode);
  const sideKey = side || activeSide;
  const str = (typeof pWarpStrength === "number" ? pWarpStrength : 100) / 100;
  const cs = centShift(baseHz, sideKey, points) * str;
  return baseHz * Math.pow(2, cs / 1200);
}
let elektrodenlautstaerkeFocus = 0;
let defaultMfr = "unknown"; // BA 154: Erststart-Default
let audiologUserNote = ""; // Patient-Notiz für Audiologen-Bericht (top-level, beide Seiten)
let userFileSuffix = ""; // globaler Dateinamen-Suffix für alle Exporte
let userLastName  = ""; // Nachname für Dateinamen und Druck-Seitentitel (BA 268)
let userFirstName = ""; // Vorname für Dateinamen und Druck-Seitentitel (BA 268)

let elektrodenlautstaerkeKurven = [];
let elActive = [];  // BA 164: Aktivitäts-Flag pro Elektrode der aktiven Seite
let fullSweepRound = null,
  fullSweepDonePairs = [];
function initElektrodenlautstaerkeKurven() {
  elektrodenlautstaerkeKurven = KURVEN_TYPES.map((tp) => ({
    type: tp,
    on: false,
    strength: 0,
    center: CENT_REF_HZ,
    width: 1200,
    cutoff:
      tp === "bassboost" ? Math.floor(nEl / 3) : Math.floor((nEl * 2) / 3),
  }));
}
function bindActiveSide() {
  const s = sideData[activeSide];
  mfr = s.manufacturer;
  nEl = s.nEl;
  freqs = s.freqs;
  elFreqOwn = s.elFreqOwn;
  elSt = s.elSt;
  elNt = s.elNt;
  elExDur = s.elExDur;
  elektrodenlautstaerkeSchieber = s.elektrodenlautstaerkeSchieber;
  elektrodenlautstaerkeKurven = s.elektrodenlautstaerkeKurven;
  refEl = s.refEl;
  elektrodenlautstaerkeResults = s.elektrodenlautstaerkeResults;
  elActive = s.elActive || (s.elActive = new Array(s.nEl).fill(true));
  config = s.config || "ci";
  fullSweepRound = s.fullSweepRound !== undefined ? s.fullSweepRound : null;
  fullSweepDonePairs = s.fullSweepDonePairs || [];
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
}
// Seitenspezifische Default-Referenzelektrode: rechnerische Mitte der
// Elektrodenzahl, von dort nach aussen die naechste nutzbare (nicht
// deaktiviert, nicht stumm) Elektrode; bei Gleichstand die tiefere
// Index-Nummer.
function pickDefaultRefEl(side) {
  const s = sideData[side];
  if (!s) return 0;
  const n = s.nEl;
  const mid = Math.floor(n / 2);
  const usable = (i) =>
    i >= 0 && i < n &&
    (!s.elExDur || s.elExDur[i] == null) &&
    (!s.elSt || s.elSt[i] !== "mute");
  if (usable(mid)) return mid;
  for (let d = 1; d < n; d++) {
    if (usable(mid - d)) return mid - d;
    if (usable(mid + d)) return mid + d;
  }
  return mid;
}
// Einziger Schreibweg fuer die Referenzelektrode. Die Wahrheit liegt
// seitenspezifisch in sideData[activeSide].refEl; die gespiegelte
// globale Ansicht wird synchron gehalten, damit der Wert beim
// Seiten-Umschalten (bindActiveSide/withSide) nicht verlorengeht.
// Zieht die abhaengigen Anzeigen nach (Ergebnis-Tabelle, Pegel-Graph,
// Player-EQ).
function setRefEl(v) {
  refEl = v;
  if (sideData[activeSide]) sideData[activeSide].refEl = v;
  if (typeof renderResults === "function") renderResults();
  if (typeof elektrodenlautstaerkeKurvenChartZeichnen === "function") elektrodenlautstaerkeKurvenChartZeichnen();
  if (typeof pUpdEQ === "function") pUpdEQ();
}
function initSideData(side, m) {
  const s = sideData[side];
  // BA 154: Default jetzt „Keine Angabe" statt „ci"/„medel"
  s.config = s.config || "unknown";
  s.manufacturer = m || "unknown";
  s.nEl = MFR[s.manufacturer].n;
  s.freqs = [...MFR[s.manufacturer].freqs];
  s.elSt = new Array(s.nEl).fill(null);
  s.elNt = new Array(s.nEl).fill("");
  s.elExDur = new Array(s.nEl).fill(null);
  s.elFreqOwn = new Array(s.nEl).fill(null);
  s.elektrodenlautstaerkeSchieber = new Array(s.nEl).fill(0);
  s.refEl = Math.floor(s.nEl / 2);
  s.elektrodenlautstaerkeResults = [];
  // BA 164: Aktivitäts-Flag pro Elektrode (true = arbeitet im CI)
  s.elActive = new Array(s.nEl).fill(true);
  s.fmMode = 'adaptive';
  s.fmAdaptiveDur = 200;
  s.fmAdaptivePau = 200;
  s.freqmatchAdaptive = null;
  s.freqmatchPiano = null;
  s.fullSweepRound = null;
  s.fullSweepDonePairs = [];
  s.implant = {
    model: "",
    processor: "",
    cValue: null,
    idr: null,
    generation: null,
    mcl: new Array(s.nEl).fill(null),
    thr: new Array(s.nEl).fill(null),
    upperLevel: new Array(s.nEl).fill(null),
  };
  activeSide = side;
  bindActiveSide();
  initElektrodenlautstaerkeKurven();
  s.elektrodenlautstaerkeKurven = elektrodenlautstaerkeKurven;
}
function updSideButtons() {
  const L = document.getElementById("sideLeftBtn"),
    R = document.getElementById("sideRightBtn");
  if (!L || !R) return;
  const activeStyle =
    "background:var(--success);color:#fff;border-color:var(--success)";
  const inactiveStyle =
    "background:var(--surface);color:var(--text);border-color:var(--border)";
  L.style.cssText = L.style.cssText.replace(
    /background:[^;]+;color:[^;]+;border-color:[^;]+/,
    "",
  );
  R.style.cssText = R.style.cssText.replace(
    /background:[^;]+;color:[^;]+;border-color:[^;]+/,
    "",
  );
  if (activeSide === "left") {
    L.style.background = "var(--success)";
    L.style.color = "#fff";
    L.style.borderColor = "var(--success)";
    R.style.background = "";
    R.style.color = "";
    R.style.borderColor = "";
  } else {
    R.style.background = "var(--success)";
    R.style.color = "#fff";
    R.style.borderColor = "var(--success)";
    L.style.background = "";
    L.style.color = "";
    L.style.borderColor = "";
  }
}
function updFClearBtn() {
  const btn = document.getElementById("fClearBtn");
  if (!btn) return;
  const sideLabel = activeSide === "left" ? "LINKS" : "RECHTS";
  btn.innerHTML = "&#128465; Messergebnisse " + sideLabel + " löschen";
}

function setActiveSide(side) {
  if (!SIDES.includes(side)) return;
  activeSide = side;
  bindActiveSide();
  document.getElementById("ciSideSelect").value = side;
  document.getElementById("mfrSelect").value = mfr;
  const cfgSel = document.getElementById("cfgSelect");
  if (cfgSel) cfgSel.value = config;

  buildFreqTable();
  elektrodenlautstaerkeKurvenTabelleBauen();
  elektrodenlautstaerkeKurvenChartZeichnen();
  if (typeof elektrodenlautstaerkeSchieberRebuild === "function") elektrodenlautstaerkeSchieberRebuild();
  renderResults();
  buildImplantCard();
  updSideButtons();
  updFClearBtn();
  updPlSrcButtons();
  if (pBuf) updatePlayerForSideChange();
  else plCheck();
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
}
// Alt-Daten verwerfen: das neue Schema (1 Track je Elektrode je Lauf) ist nicht
// kompatibel mit den älteren Speicherständen (2-Track-Schema mit ':up'/':down'
// Keys, oder noch älterem lauf1Result-Format). Statt einer riskanten Migration
// werden alte Frequenzabgleichs-Daten beim Laden verworfen; alle übrigen
// Mess-Datentypen (Slider, Vergleich, …) bleiben erhalten.
//
// Korrespondierend dazu räumt _fmCleanupLegacyFRes() Einträge aus fRes weg,
// die noch die alten Detail-Felder tragen (sie stammen sicher aus dem alten
// 2-Track-Schema und sind mit der neuen Auswertung nicht vereinbar). Wird in
// file.js und init.js nach dem fRes-Load aufgerufen.
function _fmCleanupLegacyFRes() {
  if (typeof fRes === 'undefined' || !Array.isArray(fRes)) return;
  for (let i = fRes.length - 1; i >= 0; i--) {
    const r = fRes[i];
    if (!r) continue;
    if (r.fmConvUp != null || r.fmConvDown != null || r.fmTrackDiff != null
        || r.fmStatusUpLast != null || r.fmStatusDownLast != null) {
      fRes.splice(i, 1);
    }
  }
}
function _fmMigrateAdaptive(fa) {
  if (!fa) return null;
  if (!Array.isArray(fa.runs)) return null;   // Vor-runs[]-Schemas → weg

  // Wenn irgendein Lauf noch das alte 2-Track-Key-Schema ':up'/':down' hat,
  // ist das gesamte Aggregat nicht mehr verlässlich aggregierbar → verwerfen.
  // sliderEstimates bleibt jedoch erhalten.
  const savedEstimates = (fa && typeof fa.sliderEstimates === 'object' && fa.sliderEstimates)
    ? fa.sliderEstimates : {};
  for (let i = 0; i < fa.runs.length; i++) {
    const r = fa.runs[i];
    if (!r || !r.tracks) continue;
    const keys = Object.keys(r.tracks);
    for (let j = 0; j < keys.length; j++) {
      if (keys[j].indexOf(':') >= 0) {
        return { runs: [], currentRunIdx: null, sliderEstimates: savedEstimates };
      }
    }
  }
  fa.sliderEstimates = savedEstimates;
  // BA 206: Alte sliderEstimates (ohne rounds[]-Feld) auf R1-Historie heben.
  Object.keys(fa.sliderEstimates).forEach(function(k) {
    const e = fa.sliderEstimates[k];
    if (!e || typeof e !== 'object') return;
    if (Array.isArray(e.rounds)) return;
    if (typeof e.cent !== 'number') return;
    e.rounds = [{ cent: e.cent, ts: e.timestamp || Date.now(), round: 1 }];
  });
  return fa;
}

// Migriert Alt-Slider-Einträge aus fRes nach
// sideData[varSide].freqmatchAdaptive.sliderEstimates.
//
// Hintergrund: bis BA 102 schrieb der klassische Slider-Modus seine
// Werte direkt in fRes — ohne fmStatus-Feld, weil der Eintrag als
// finaler Wert galt. Ab BA 102 lebt der Slider-Modus als Vor-Schätzung
// in freqmatchAdaptive.sliderEstimates; fRes enthält nur noch adaptive
// Mess-Ergebnisse (mit fmStatus). Alte fRes-Einträge ohne fmStatus sind
// Klassisch-Slider-Werte und werden hier in die neue Datenstruktur
// überführt, damit sie als Startwerte für einen anschließenden adaptiven
// Test wieder zur Verfügung stehen.
//
// Vorrang-Regel: wenn für eine (varSide, elIdx)-Kombination bereits ein
// sliderEstimate existiert (neuere Daten, BA 102+), bleibt dieser
// erhalten — der Alt-Eintrag wird verworfen.
//
// Wird in file.js (JSON-Load) und init.js (Autosave-Load) NACH
// _fmCleanupLegacyFRes() aufgerufen.
function _fmMigrateAltSliderFRes() {
  if (typeof fRes === 'undefined' || !Array.isArray(fRes)) return;
  if (typeof sideData === 'undefined') return;

  for (let i = fRes.length - 1; i >= 0; i--) {
    const r = fRes[i];
    if (!r) continue;
    if (r.fmStatus != null) continue;   // adaptive Einträge bleiben unangetastet

    const side = r.varSide;
    if (side !== 'left' && side !== 'right') {
      fRes.splice(i, 1);   // korrupte Seite: still verwerfen
      continue;
    }
    const sd = sideData[side];
    if (!sd) { fRes.splice(i, 1); continue; }

    const elIdx = r.elIdx;
    if (typeof elIdx !== 'number') { fRes.splice(i, 1); continue; }
    const nElSide = sd.nEl || 22;
    if (elIdx < 0 || elIdx >= nElSide) { fRes.splice(i, 1); continue; }

    if (typeof r.varFreq !== 'number' || typeof r.refFreq !== 'number'
        || r.varFreq <= 0 || r.refFreq <= 0) {
      fRes.splice(i, 1); continue;
    }

    // freqmatchAdaptive-Container ggf. anlegen
    if (!sd.freqmatchAdaptive) {
      sd.freqmatchAdaptive = { runs: [], currentRunIdx: null, sliderEstimates: {} };
    }
    if (!sd.freqmatchAdaptive.sliderEstimates
        || typeof sd.freqmatchAdaptive.sliderEstimates !== 'object'
        || Array.isArray(sd.freqmatchAdaptive.sliderEstimates)) {
      sd.freqmatchAdaptive.sliderEstimates = {};
    }
    const store = sd.freqmatchAdaptive.sliderEstimates;

    // Vorrang: existierender neuer sliderEstimate gewinnt.
    if (store[String(elIdx)] != null) {
      fRes.splice(i, 1);
      continue;
    }

    const cent = Math.round(1200 * Math.log2(r.refFreq / r.varFreq));
    const _ts206 = (typeof r.timestamp === 'number') ? r.timestamp : Date.now();
    store[String(elIdx)] = {
      cent:      cent,
      varSide:   r.varSide,
      refSide:   r.refSide || (side === 'left' ? 'right' : 'left'),
      varFreq:   r.varFreq,
      timestamp: _ts206,
      // BA 206: Alt-Slider-fRes-Eintrag wird als R1-Wert übernommen.
      rounds:    [{ cent: cent, ts: _ts206, round: 1 }]
    };
    fRes.splice(i, 1);
  }
}

// BA 362: Alt-Slider-Eintraege mit rounds[]-Historie auf min/max migrieren.
// rounds[] wird danach verworfen. cent bleibt unveraendert (Aggregat aus BA 206).
function _fmMigrateSliderRounds() {
  if (typeof sideData === 'undefined') return;
  ['left', 'right'].forEach(function(side) {
    const fa = sideData[side] && sideData[side].freqmatchAdaptive;
    if (!fa || !fa.sliderEstimates) return;
    Object.keys(fa.sliderEstimates).forEach(function(key) {
      const e = fa.sliderEstimates[key];
      if (!e || typeof e !== 'object') return;
      if (Array.isArray(e.rounds)) {
        // min/max nur, wenn noch nicht gesetzt und >=2 unterschiedliche Werte.
        if ((e.min == null || e.max == null)) {
          const range = (typeof _fmRangeCent === 'function') ? _fmRangeCent(e.rounds) : null;
          if (range && range.min !== range.max) {
            e.min = range.min;
            e.max = range.max;
          }
        }
        delete e.rounds;
      }
    });
  });
}

function loadSideData(side, d) {
  const s = sideData[side];
  s.config = d.config || "ci";
  if (d.manufacturer && MFR[d.manufacturer]) {
    s.manufacturer = d.manufacturer;
    s.nEl = MFR[s.manufacturer].n;
    s.freqs = d.frequencies || [...MFR[s.manufacturer].freqs];
  } else {
    s.nEl = MFR[s.manufacturer].n;
    s.freqs = [...MFR[s.manufacturer].freqs];
  }
  s.elSt = d.electrodeStatus || new Array(s.nEl).fill(null);
  s.elNt = d.electrodeNotes || new Array(s.nEl).fill("");
  s.elExDur = d.electrodeExcludedDuring || new Array(s.nEl).fill(null);
  // Migrate old 'excluded' from elSt to elExDur
  for (let _i = 0; _i < s.elSt.length; _i++) {
    if (s.elSt[_i] === "excluded") {
      s.elExDur[_i] = s.elExDur[_i] || Date.now();
      s.elSt[_i] = null;
    }
  }
  // BA 164: elActive aus Datei lesen oder Default true.
  s.elActive = Array.isArray(d.electrodeActive)
    ? d.electrodeActive.map((v) => v !== false)
    : new Array(s.nEl).fill(true);
  while (s.elActive.length < s.nEl) s.elActive.push(true);
  s.elActive = s.elActive.slice(0, s.nEl);
  // BA 164 Migration: alter elSt-Wert "deactivated" -> elActive=false + elSt=null.
  // elExDur wird zusätzlich gesetzt, damit alte Stände auch die alte
  // Skip-Wirkung behalten (Aktiv und Ausschluss sind ab BA 164 entkoppelt,
  // aber alte Daten brauchen den Spiegel-Effekt fürs nahtlose Weiterarbeiten).
  for (let _i = 0; _i < s.elSt.length; _i++) {
    if (s.elSt[_i] === "deactivated") {
      s.elActive[_i] = false;
      s.elSt[_i] = null;
      s.elExDur[_i] = s.elExDur[_i] || Date.now();
    }
  }
  // Referenzelektrode seitenspezifisch; bei fehlender, ungueltiger oder
  // auf eine deaktivierte/stumme Elektrode zeigender Angabe -> Default.
  {
    const r = d.referenceElectrode;
    const valid =
      typeof r === "number" && r >= 0 && r < s.nEl &&
      s.elExDur[r] == null && s.elSt[r] !== "mute";
    s.refEl = valid ? r : pickDefaultRefEl(side);
  }
  // BA 251: judgmentResults aus alten Dateien werden stillschweigend ignoriert.
  s.elektrodenlautstaerkeResults = d.balanceResults || [];
  s.fmMode = (d.fmMode === 'slider' || d.fmMode === 'adaptive') ? d.fmMode : 'adaptive';
  s.fmAdaptiveDur = (d.fmAdaptiveDur != null) ? d.fmAdaptiveDur : 200;
  s.fmAdaptivePau = (d.fmAdaptivePau != null) ? d.fmAdaptivePau : 200;
  s.freqmatchAdaptive = _fmMigrateAdaptive(d.freqmatchAdaptive);
  s.freqmatchPiano = d.freqmatchPiano || null;
  s.elektrodenlautstaerkeSchieber = d.manualLevels || new Array(s.nEl).fill(0);
  if (d.presets && Array.isArray(d.presets)) {
    s.elektrodenlautstaerkeKurven = KURVEN_TYPES.map((tp) => {
      const found = d.presets.find((p) => p.type === tp);
      return found || {
        type: tp, on: false, strength: 0, center: CENT_REF_HZ, width: 1200,
        cutoff: tp === "bassboost" ? Math.floor(s.nEl / 3) : Math.floor((s.nEl * 2) / 3),
      };
    });
  }
  s.fullSweepRound = d.fullSweepRound !== undefined ? d.fullSweepRound : null;
  s.fullSweepDonePairs =
    d.fullSweepDonePairs !== undefined ? d.fullSweepDonePairs : [];
  // Load elFreqOwn: if present use it; else split loaded freqs vs defaults
  if (d.electrodeFreqOwn) {
    s.elFreqOwn = [...d.electrodeFreqOwn];
  } else {
    const defF = MFR[s.manufacturer].freqs;
    s.elFreqOwn = s.freqs.map((f, i) =>
      Math.round(f) === Math.round(defF[i]) ? null : f,
    );
  }
  // Load implant data (v2.6+)
  const di = d.implant || {};
  s.implant = {
    model: di.model || "",
    processor: di.processor || "",
    cValue: di.cValue !== undefined && di.cValue !== null ? di.cValue : null,
    idr: di.idr !== undefined && di.idr !== null ? di.idr : null,
    generation: di.generation || null,
    mcl: di.mcl || new Array(s.nEl).fill(null),
    thr: di.thr || new Array(s.nEl).fill(null),
    upperLevel: di.upperLevel || new Array(s.nEl).fill(null),
  };
  // Ensure arrays are correct length
  ["mcl", "thr", "upperLevel"].forEach((k) => {
    while (s.implant[k].length < s.nEl) s.implant[k].push(null);
    s.implant[k] = s.implant[k].slice(0, s.nEl);
  });
}
function getPlayerSide() {
  const cb = document.getElementById("plBothSides");
  if (cb && cb.checked) {
    const mono = document.getElementById("plMonoEQ");
    if (mono && mono.checked) return "mono";
    return "both";
  }
  return activeSide;
}
function getPlayerBalance() {
  if (!plApplyBalance) return 0;
  // Mean aus stereobalanceResults berechnen (stereobalanceResults ist global in stereobalance-balance.js)
  if (typeof stereobalanceResults === "undefined") return 0;
  const vals = Object.values(stereobalanceResults).filter((v) => isFinite(v));
  if (!vals.length) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  // Positive mean = right louder → negative balance offset (rechts dämpfen)
  return Math.max(-60, Math.min(60, parseFloat((-mean).toFixed(1))));
}
function getPlayerBalanceGains() {
  // Liefert {left, right} dB-Werte für die beiden Channel-Gains
  // im "both"-Modus. Berücksichtigt plBalanceMode.
  // b ist die gemessene L↔R-Differenz in dB (= -mean der stereobalanceResults).
  // Der akustische Unterschied muss in ALLEN Modi genau b betragen,
  // wie beim Test eingestellt (stereobalancePairGains verteilt off als ±off/2).
  // "sym" (Default): symmetrisch, jede Seite trägt die Hälfte (±b/2).
  // "left":  voller Ausgleich b ausschließlich auf der linken Seite.
  // "right": voller Ausgleich b ausschließlich auf der rechten Seite.
  const b = getPlayerBalance();
  const mode = (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym";
  const clamp = (v) => Math.max(-60, Math.min(60, v));
  if (mode === "left") {
    return { left: clamp(b), right: 0 };
  }
  if (mode === "right") {
    return { left: 0, right: clamp(-b) };
  }
  return { left: b / 2, right: -b / 2 };
}
function getRawBalanceGains() {
  // Wie getPlayerBalanceGains(), aber ignoriert plApplyBalance.
  // Für Meßtests (Frequenzabgleich, Latenz): Balance immer anwenden.
  if (typeof stereobalanceResults === "undefined") return { left: 0, right: 0 };
  const vals = Object.values(stereobalanceResults).filter((v) => isFinite(v));
  if (!vals.length) return { left: 0, right: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  // b = gemessene L↔R-Differenz; Verteilung wie getPlayerBalanceGains.
  const b = Math.max(-60, Math.min(60, parseFloat((-mean).toFixed(1))));
  const mode = (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym";
  const clamp = (v) => Math.max(-60, Math.min(60, v));
  if (mode === "left") {
    return { left: clamp(b), right: 0 };
  }
  if (mode === "right") {
    return { left: 0, right: clamp(-b) };
  }
  return { left: b / 2, right: -b / 2 };
}
function withSide(side, fn) {
  const prevSide = activeSide;
  const prev = {
    mfr,
    nEl,
    freqs,
    elSt,
    elNt,
    elExDur,
    elektrodenlautstaerkeSchieber,
    elektrodenlautstaerkeKurven,
    refEl,
    elektrodenlautstaerkeResults,
  };
  activeSide = side;
  bindActiveSide();
  try {
    return fn();
  } finally {
    activeSide = prevSide;
    bindActiveSide();
  }
}
function dEN(i) {
  return MFR[mfr].apFirst ? i + 1 : nEl - i;
}
// Liefert das Präfix ("E" oder "B") für die aktive Seite
function dENPrefix(side) {
  const cfg = side ? (sideData[side].config || "ci") : (config || "ci");
  return cfg === "ci" ? t("cfgLblEnCI") : t("cfgLblEnAcoustic");
}
// Liefert Seite, die als Frequenzraster-Quelle dient,
// oder null wenn beide CI (unabhängig) oder beide nicht-CI (Default)
function getFreqSource() {
  const lCfg = sideData.left.config || "ci";
  const rCfg = sideData.right.config || "ci";
  if (lCfg === "ci" && rCfg !== "ci") return "left";
  if (rCfg === "ci" && lCfg !== "ci") return "right";
  return null; // beide CI (unabhängig) oder beide nicht-CI (Default)
}
function isSideUsable(side) {
  const s = sideData[side];
  if (!s) return false;
  const cfg = s.config || "unknown";
  if (cfg === "unknown") return false;
  if (cfg === "ci" && (!s.manufacturer || s.manufacturer === "unknown")) return false;
  return true;
}

// BA 156: Snapshot der für Tests relevanten Implantat-Felder
function implantSnapshot() {
  function _sideSnap(side) {
    const s = sideData[side];
    if (!s) return null;
    // BA 164: Quelle ist jetzt elActive[]
    const deact = [];
    const arr = s.elActive || [];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === false) deact.push(i);
    }
    return {
      config: s.config || "unknown",
      manufacturer: s.manufacturer || "unknown",
      nEl: s.nEl || 0,
      deactivatedIdx: deact,
    };
  }
  return {
    left:  _sideSnap("left"),
    right: _sideSnap("right"),
  };
}

function implantSnapshotsDiffer(a, b) {
  if (!a || !b) return false;
  function _eqSide(x, y) {
    if (!x || !y) return false;
    if (x.config !== y.config) return false;
    if (x.manufacturer !== y.manufacturer) return false;
    if (x.nEl !== y.nEl) return false;
    const xD = x.deactivatedIdx || [], yD = y.deactivatedIdx || [];
    if (xD.length !== yD.length) return false;
    for (let i = 0; i < xD.length; i++) if (xD[i] !== yD[i]) return false;
    return true;
  }
  return !(_eqSide(a.left, b.left) && _eqSide(a.right, b.right));
}

// BA 156: Hinweis-Banner-Helper. testKey ∈ {'stereobalance', 'latenz'}.
function renderSnapshotHint(testKey, containerEl) {
  if (!containerEl) return;
  let oldSnap = null;
  if (testKey === 'stereobalance') {
    oldSnap = (typeof stereobalanceSnapshot !== 'undefined') ? stereobalanceSnapshot : null;
  } else if (testKey === 'latenz') {
    oldSnap = (typeof latenzResult !== 'undefined' && latenzResult)
            ? latenzResult.implantSnapshot : null;
  }
  if (!oldSnap) { containerEl.innerHTML = ''; return; }
  const curSnap = implantSnapshot();
  if (!implantSnapshotsDiffer(oldSnap, curSnap)) {
    containerEl.innerHTML = '';
    return;
  }
  containerEl.innerHTML =
    '<div class="snapshot-hint">' + t('snapshotHintChanged') + '</div>';
}
let _syncInProgress = false;
function syncFreqsToAcoustic() {
  if (_syncInProgress) return;
  _syncInProgress = true;
  try {
    const src = getFreqSource();
    if (src) {
      // Eine CI-Seite ist Quelle: andere Seite(n) spiegeln
      const other = src === "left" ? "right" : "left";
      // BA 154: nur akustische Konfigurationen spiegeln, nicht „unknown" oder „deaf"
      const otherCfg = sideData[other].config || "unknown";
      if (["hg", "normal", "shoh"].includes(otherCfg)) {
        const srcData = sideData[src];
        const otherData = sideData[other];
        otherData.nEl = srcData.nEl;
        otherData.freqs = [...srcData.freqs];
        otherData.manufacturer = srcData.manufacturer;
        // elFreqOwn auf neue Länge anpassen, nicht überschreiben
        if (!otherData.elFreqOwn || otherData.elFreqOwn.length !== otherData.nEl) {
          otherData.elFreqOwn = new Array(otherData.nEl).fill(null);
        }
        // Arrays auf neue Elektrodenzahl anpassen
        ["elSt","elNt","elExDur","elektrodenlautstaerkeSchieber"].forEach(k => {
          if (!otherData[k] || otherData[k].length !== otherData.nEl) {
            const def = k === "elSt" || k === "elExDur" ? null : (k === "elNt" ? "" : 0);
            otherData[k] = new Array(otherData.nEl).fill(def);
          }
        });
        if (!otherData.implant || !otherData.implant.mcl ||
            otherData.implant.mcl.length !== otherData.nEl) {
          otherData.implant = {
            model: otherData.implant ? otherData.implant.model || "" : "",
            processor: otherData.implant ? otherData.implant.processor || "" : "",
            cValue: null, idr: null, generation: null,
            mcl: new Array(otherData.nEl).fill(null),
            thr: new Array(otherData.nEl).fill(null),
            upperLevel: new Array(otherData.nEl).fill(null),
          };
        }
      }
    } else {
      // Beide nicht-CI: Default-Raster setzen
      const lCfg = sideData.left.config || "ci";
      const rCfg = sideData.right.config || "ci";
      if (lCfg !== "ci" && rCfg !== "ci") {
        ["left","right"].forEach(side => {
          const s = sideData[side];
          if (s.config !== "ci") {
            const defN = MFR[defaultMfr].n;
            s.nEl = defN;
            s.freqs = [...MFR[defaultMfr].freqs];
            s.manufacturer = defaultMfr;
            s.elFreqOwn = new Array(defN).fill(null);
            ["elSt","elNt","elExDur","elektrodenlautstaerkeSchieber"].forEach(k => {
              if (!s[k] || s[k].length !== defN) {
                const def = k === "elSt" || k === "elExDur" ? null : (k === "elNt" ? "" : 0);
                s[k] = new Array(defN).fill(def);
              }
            });
          }
        });
      }
    }
    // Aktive Seite neu binden
    bindActiveSide();
  } finally {
    _syncInProgress = false;
  }
}
// Konfiguration einer Seite setzen und Sync auslösen
function setSideConfig(side, cfg) {
  sideData[side].config = cfg;
  if (cfg === "ci") {
    // Wenn zurück zu CI: unabhängig werden — Frequenzen auf Default,
    // Hersteller-Fallback weiterhin „unknown" (BA 154).
    const s = sideData[side];
    s.manufacturer = s.manufacturer || "unknown";
    s.nEl = (MFR[s.manufacturer] && MFR[s.manufacturer].n) || 0;
    s.freqs = (MFR[s.manufacturer] && [...MFR[s.manufacturer].freqs]) || [];
    syncFreqsToAcoustic();
  } else {
    // unknown / hg / normal / shoh / deaf: keine eigenen Frequenzen,
    // ggf. Spiegel von der anderen CI-Seite.
    syncFreqsToAcoustic();
  }
  bindActiveSide();
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  // BA 172: Tab-Sperre L1 neu bewerten
  if (typeof tabLockApply === 'function') tabLockApply();
}
initSideData("left", "unknown");
initSideData("right", "unknown");
activeSide = "left";
bindActiveSide();
updateMfrSelectLabels();

let audioCtx = null,
  runningSources = [],
  playTO = null,
  isPlay = false,
  holdIdx = -1;
let testAct = false,
  testPairs = [],
  testIdx = 0,
  curPlayed = false,
  curBase = 0,
  slExt = false;
let curA = -1,
  curB = -1,
  undoSt = [],
  convRnd = 0;

// ============================================================
// BA 280: Zentrale Default-Werte (Single Source of Truth).
// Alle Erststart-Werte, resetAll-Rucksetzwerte, Speicher-/Lade-
// Fallbacks und Druck-Anzeige-Fallbacks fur Test-Parameter und
// Ton-Hullkurve greifen ausschliesslich auf diese zwei Objekte zu.
// Wer einen Default andern will, andert ihn NUR hier.
// ------------------------------------------------------------
// BA 296: Default-Ton fuer alle Verfahren auf "sine" (Sinus). Die
// Tonart-Auswahl ist im Normalbetrieb ausgeblendet und nur im
// Debug-Modus waehlbar.
const TEST_DEFAULTS = {
  commonVolume: 50,                 // BA 287: gemeinsame Lautstaerke aller Tests + Implantat
  freqmatch: { toneType: "sine", volume: 75, duration: 600, pause: 300, sequence: "ab" },
  elektrodenlautstaerke: { toneType: "sine", volume: 50, duration: 600, pause: 300, sequence: "ab" },
  stereobalance: { toneType: "sine", volume: 75, duration: 600, pause: 300, sequence: "ab" },
  implant:   { toneType: "sine", volume: 75, duration: 600, pause: 300 }
};
const TONE_ENV_DEFAULTS = {
  attackForm: "dblin",  // Anstiegsform: dB-linear
  attackMs:   90,       // Anschwingzeit ms
  dbFloor:    -20,      // Startpegel dB (nur bei dblin wirksam)
  release:    "short"   // Ausklang: kurz
};
// BA 209: Tonart speziell fur Frequenzabgleich.
// Default 'richCiHF' (CI-Test flach).
let toneType_freqmatch = TEST_DEFAULTS.freqmatch.toneType;
// BA 246: Tonart speziell fuer Elektrodenlautstaerke. Eigene Persistenz
// statt globalToneType, damit Tonart-Popup-Dialog (analog freqmatch)
// pro Test funktioniert. Wird in BA 247 erstmals aus dem testUI-Header
// gelesen/geschrieben.
let toneType_elektrodenlautstaerke = TEST_DEFAULTS.elektrodenlautstaerke.toneType;
// BA 240: Vol/Dur/Pau leben jetzt als State-Variablen statt im testUI-Header.
// Vol als int 0..100 (UI-Wert); fmGVol macht die quadratische Audio-Konversion.
let duration_freqmatch = TEST_DEFAULTS.freqmatch.duration;
let pause_freqmatch    = TEST_DEFAULTS.freqmatch.pause;
// BA 250: Vol/Dur/Pau fuer Elektrodenlautstaerke. Analog zu freqmatch
// als State-Variablen statt im testUI-Header. Vol als int 0..100;
// tGVol macht die quadratische Audio-Konversion.
// BA 287: gemeinsame Lautstaerke fuer alle drei Mess-Tests UND den
// Implantat-Reiter. Ersetzt die frueheren volume_test/volume_balance/
// volume_freqmatch/volume_implant. Vol als int 0..100; die Getter
// (tGVol/stereobalanceGVol/fmGVol/...) machen die quadratische Audio-Konversion.
let volume_global = TEST_DEFAULTS.commonVolume;
let duration_elektrodenlautstaerke = TEST_DEFAULTS.elektrodenlautstaerke.duration;
let pause_elektrodenlautstaerke    = TEST_DEFAULTS.elektrodenlautstaerke.pause;
// BA 253: Tonart, Lautstaerke, Tondauer, Tonpause speziell fuer
// Stereo-Balance. Ueber die Tonauswahl-Modalbox eingestellt; getrennt
// vom Frequenzabgleich- und Elektrodenlautstaerke-Test.
let toneType_stereobalance = TEST_DEFAULTS.stereobalance.toneType;
let duration_stereobalance = TEST_DEFAULTS.stereobalance.duration;
let pause_stereobalance    = TEST_DEFAULTS.stereobalance.pause;
// BA 254: Tonfolge (AB/ABA) speziell pro Test. Ersetzt globalSequence.
let sequence_freqmatch = TEST_DEFAULTS.freqmatch.sequence;
let sequence_elektrodenlautstaerke      = TEST_DEFAULTS.elektrodenlautstaerke.sequence;
let sequence_stereobalance   = TEST_DEFAULTS.stereobalance.sequence;
// BA 242: Implantat-Tab-Tonauswahl. Vol/Dur/Pau analog freqmatch.
// Default-Tonart Sinus, weil im Implantat-Tab problematische Elektroden
// per Sinus am besten zu erkennen sind (Rauschen, Aussetzer).
let toneType_implant = TEST_DEFAULTS.implant.toneType;
let duration_implant = TEST_DEFAULTS.implant.duration;
let pause_implant    = TEST_DEFAULTS.implant.pause;

// Frequenzabgleich-Ergebnisse (global, nicht pro Seite)
// { varSide, refSide, elIdx, varFreq, refFreq, timestamp }
let fRes = [];

let plEqOn = true; // EQ toggle state
let plApplyBalance = true; // Stereo-Balance anwenden
let plBalanceMode = "sym"; // "sym" | "left" | "right" — wie Stereo-Balance angewandt wird
let plEqHeadroom = true; // BA 316: Elektrodenlautstaerke gemeinsam absenken (Clipping-/Uebersteuern-Schutz)
let plEqHeadroomBoth = true; // BA 319: Absenk-Betrag ueber beide Seiten (an) vs. pro Seite (aus)
let plSrcMeas = true,
  plSrcLevels = true,
  plSrcCurves = true; // EQ source toggles
let plShowExperimental = false; // Toggle für experimentelle Optionen (MAPLAW + Frequenz-Warping); Default aus

let plActiveSource = "musik";   // "musik" | "saetze" | "geraeusche" | "hoerbuecher"
let plAutoAdvance  = false;     // Auto-Advance-Toggle, Default aus
let plLoop         = false;     // Endlos-Toggle (aktuelles Stueck wiederholen), Default aus
let plShuffle      = false;     // BA258: Zufall-Modus global, Default aus
let plPauseMs      = 2000;      // Pause zwischen Stuecken (ms), Default 2000
let plSentShowText = false;     // Satz-Text einblenden (Persistenz neu)
let plNoiseSelectedId = "gen:pink";   // Default-Geraeusch beim ersten Start
let plNoiseSortAxis   = "kind";       // Default-Sortierachse
let plNoiseCategory   = "_all";   // BA262: Kategorie-Filter, "(alle)" als Default
let plNoiseSearchQuery = "";       // BA262: Suchfeld-Inhalt
let plSentBgEnabled = false;          // BA194: Hintergrund-Geraeusch Master-Toggle
let plSentBgItemId  = "gen:pink";     // BA194: gewaehltes Hintergrund-Geraeusch
let plSentBgSnrDb   = 0;             // BA194: SNR in dB
let plSentSpeakerSel = "any";         // BA332: gewaehlter Sprecher im Saetze-Dropdown ("any" = alle)
let plContentLang = "de";             // BA336: Inhalts-Sprache (entkoppelt von Tool-Sprache lang); Default wird in init.js auf Tool-Sprache gesetzt
let pNoiseBuf         = null;         // dekodierter / generierter Geraeusch-Buffer
let plBookSelectedId = null;          // Collection-ID des aktuellen Buchs
let plBookChapterIdx = 0;             // Index des aktuellen Kapitels
let plBookSortAxis   = "author";      // Sortierachse
let plBookPositions  = {};            // { <bookId>: { chapterIdx, posSeconds } }

// BA260: Musik-Bibliothek
let plMusicSelectedId   = null;     // welches Stueck aktiv ist
let plMusicSortAxis     = "title";  // Default-Sortier-Achse
let plMusicCategory     = "_all";   // "(alle)" als Default
let plMusicSearchQuery  = "";       // Such-String (persistiert)
let pBookBuf         = null;          // dekodierter Kapitel-Buffer (Laufzeit, nicht persistiert)

let elektrodenlautstaerkeSchieberShowMeas = false;
let elektrodenlautstaerkeSchieberShowCurves = false;
let elektrodenlautstaerkeSchieberMode = "rel";    // "rel" = relativ (±dB), "abs" = absolut (qu/CL/CU)
let elektrodenlautstaerkeSchieberVariant = "stack"; // "stack" = gestapelt, "sum" = nur Summe, "lines" = Summe + Vergleichslinien

