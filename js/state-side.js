// ============================================================
// STATE & SIDE MANAGEMENT
// ============================================================

// --- Global state variables ---
let activeSide = "left";
const sideData = { left: {}, right: {} };
let mfr,
  nEl,
  FRQ_implantat,
  FRQ_implantatOwn,
  elSt,
  elNt,
  elExDur,
  schieberELL,
  ELL_refEl,
  ELL_results,
  config;
// FRQ_implantatEffektiv[i] = FRQ_implantatOwn[i] ?? FRQ_implantat[i] (MFR default)
// Optionales srcData: ohne = globale Seite (58 Bestandsaufrufer), mit = explizites Seiten-Objekt
// (ersetzt _implEffFreqOf; 0-Fallback nur im srcData-Zweig)
function FRQ_implantatEffektiv(i, srcData) {
  if (srcData) {
    var own = srcData.FRQ_implantatOwn;
    if (own && own[i] != null) return own[i];
    var def = srcData.FRQ_implantat;
    return def ? def[i] : 0;          // 0-Fallback wie _implEffFreqOf
  }
  return FRQ_implantatOwn && FRQ_implantatOwn[i] != null ? FRQ_implantatOwn[i] : FRQ_implantat[i];
}
// Effektive Anzeige-/Berechnungs-Frequenz unter Berücksichtigung des
// aktuellen Frequenz-Warping-Zustands. Verwendet von Kurven-Tab
// (kurvenELLChartZeichnen, kurvenELLBerechnen) und Player (pDrawEQ, pBuildEQ) für
// die Cent-basierte x-Achse und die Frequenz-Interpolation.
//
// Andere Module (Tests, Audio-Pfad, Schieber-Tab, Meßergebnisse,
// Implantat-Tabelle, MAPLAW) verwenden weiterhin FRQ_implantatEffektiv() — die
// Elektroden bewegen sich physisch nicht, Warp ist eine
// Anzeige-/Berechnungs-Schicht für die wahrgenommene Frequenz.
//
// Parameter side optional: wenn gesetzt, wird temporär die andere
// Seite gebunden (für seitenspezifische Aufrufe wie im Druck).
function effFreqDisplay(i, side) {
  const baseHz = (side != null && typeof withSide === "function")
    ? withSide(side, function () { return FRQ_implantatEffektiv(i); })
    : FRQ_implantatEffektiv(i);
  if (typeof pWarpOn === "undefined" || !pWarpOn) return baseHz;
  const src = (typeof _warpFResSource === "function")
    ? _warpFResSource()
    : (typeof FRQ_resultsArray !== "undefined" && Array.isArray(FRQ_resultsArray) ? FRQ_resultsArray : []);
  if (!src.length) return baseHz;
  if (typeof buildWarpPoints !== "function" ||
      typeof centShift !== "function") return baseHz;
  const points = buildWarpPoints(src, pWarpMode);
  const sideKey = side || activeSide;
  const str = (typeof pWarpStrength === "number" ? pWarpStrength : 100) / 100;
  const cs = centShift(baseHz, sideKey, points) * str;
  return baseHz * Math.pow(2, cs / 1200);
}
let ell_focus = 0;
let defaultMfr = "unknown"; // BA 154: Erststart-Default
let audiologUserNote = ""; // Patient-Notiz für Audiologen-Bericht (top-level, beide Seiten)
let userFileSuffix = ""; // globaler Dateinamen-Suffix für alle Exporte
let userLastName  = ""; // Nachname für Dateinamen und Druck-Seitentitel (BA 268)
let userFirstName = ""; // Vorname für Dateinamen und Druck-Seitentitel (BA 268)

let kurvenELL = [];
let elActive = [];  // BA 164: Aktivitäts-Flag pro Elektrode der aktiven Seite
let fullSweepRound = null,
  fullSweepDonePairs = [];
function initElektrodenlautstaerkeKurven() {
  kurvenELL = KURVEN_ELL_TYPES.map((tp) => ({
    type: tp,
    on: false,
    strength: 0,
    center: CENT_REF_HZ,
    width: 1200,
    phon: 70,
    cutoff:
      tp === "bassboost" ? Math.floor(nEl / 3) : Math.floor((nEl * 2) / 3),
  }));
}
function bindActiveSide() {
  const s = sideData[activeSide];
  mfr = s.manufacturer;
  nEl = s.nEl;
  FRQ_implantat = s.FRQ_implantat;
  FRQ_implantatOwn = s.FRQ_implantatOwn;
  elSt = s.elSt;
  elNt = s.elNt;
  elExDur = s.elExDur;
  schieberELL = s.schieberELL;
  kurvenELL = s.kurvenELL;
  ELL_refEl = s.ELL_refEl;
  ELL_results = s.ELL_results;
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
// seitenspezifisch in sideData[activeSide].ELL_refEl; die gespiegelte
// globale Ansicht wird synchron gehalten, damit der Wert beim
// Seiten-Umschalten (bindActiveSide/withSide) nicht verlorengeht.
// Zieht die abhaengigen Anzeigen nach (Ergebnis-Tabelle, Pegel-Graph,
// Player-EQ).
function setRefEl(v) {
  ELL_refEl = v;
  if (sideData[activeSide]) sideData[activeSide].ELL_refEl = v;
  if (typeof ELL_renderResults === "function") ELL_renderResults();
  if (typeof kurvenELLChartZeichnen === "function") kurvenELLChartZeichnen();
  if (typeof pUpdEQ === "function") pUpdEQ();
}
// Baut das vollständige ctx-Objekt einer Seite für die parametrisierten
// ELL-Funktionen (ELL_compWLS, ELL_drawChart, ELL_testData). side:
// 'left' | 'right' | 'global' ('global' = aktuell gebundene Seite).
// Liefert seitenrichtige Daten UND Closures, ohne die globalen Tool-
// Variablen zu binden (kein withSide nötig).
function ELL_ctx(side) {
  var key = (side === "left" || side === "right") ? side : activeSide;
  var s = sideData[key];
  if (!s) return {};                 // defensiv: keine Seite -> leeres ctx
  var _nEl = s.nEl;
  var _frq    = s.FRQ_implantat;
  var _frqOwn = s.FRQ_implantatOwn;
  var _cfg    = s.config || "ci";
  return {
    // Datenfelder (compWLS + drawChart)
    nEl:         _nEl,
    ELL_results: s.ELL_results,
    elSt:        s.elSt,
    elExDur:     s.elExDur,
    ELL_refEl:   s.ELL_refEl,
    // Funktions-Closures (drawChart) — seitenrichtig, lesen NICHT die Globalen
    hzGetter: function (i) {
      return (_frqOwn && _frqOwn[i] != null) ? _frqOwn[i] : _frq[i];
    },
    dEN: function (i) {
      return dEN(i, key);
    },
    dENPrefix: function () {
      return _cfg === "ci" ? t("cfgLblEnCI") : t("cfgLblEnAcoustic");
    },
  };
}

function initSideData(side, m) {
  const s = sideData[side];
  // BA 154: Default jetzt „Keine Angabe" statt „ci"/„medel"
  s.config = s.config || "unknown";
  s.manufacturer = m || "unknown";
  s.nEl = MFR[s.manufacturer].n;
  s.FRQ_implantat = [...MFR[s.manufacturer].FRQ_implantat];
  s.elSt = new Array(s.nEl).fill(null);
  s.elNt = new Array(s.nEl).fill("");
  s.elExDur = new Array(s.nEl).fill(null);
  s.FRQ_implantatOwn = new Array(s.nEl).fill(null);
  s.schieberELL = new Array(s.nEl).fill(0);
  s.ELL_refEl = Math.floor(s.nEl / 2);
  s.ELL_results = [];
  // BA 164: Aktivitäts-Flag pro Elektrode (true = arbeitet im CI)
  s.elActive = new Array(s.nEl).fill(true);
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
  s.kurvenELL = kurvenELL;
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
function ELL_updFClearBtn() {
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

  FRQ_implantatTableBuild();
  kurvenELLTabelleBauen();
  kurvenELLChartZeichnen();
  if (typeof schieberELLRebuild === "function") schieberELLRebuild();
  ELL_renderResults();
  // BA414-Folgefix: FRQ-Ergebnisgraph haengt seit der kanonischen Umstellung
  // an der aktiven Seite (FRQ_refHzForMode/FRQ_seitenWerte) -> bei Seiten-
  // wechsel neu rendern, sonst bleibt die Anzeige auf der alten Seite stehen.
  if (typeof FRQ_renderResults === "function") FRQ_renderResults();
  buildImplantCard();
  updSideButtons();
  ELL_updFClearBtn();
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
// Korrespondierend dazu räumt _FRQ_cleanupLegacyResults() Einträge aus FRQ_resultsArray weg,
// die noch die alten Detail-Felder tragen (sie stammen sicher aus dem alten
// 2-Track-Schema und sind mit der neuen Auswertung nicht vereinbar). Wird in
// file.js und init.js nach dem FRQ_resultsArray-Load aufgerufen.
function _FRQ_cleanupLegacyResults() {
  if (typeof FRQ_resultsArray === 'undefined' || !Array.isArray(FRQ_resultsArray)) return;
  for (let i = FRQ_resultsArray.length - 1; i >= 0; i--) {
    const r = FRQ_resultsArray[i];
    if (!r) continue;
    if (r.fmConvUp != null || r.fmConvDown != null || r.fmTrackDiff != null
        || r.fmStatusUpLast != null || r.fmStatusDownLast != null) {
      FRQ_resultsArray.splice(i, 1);
    }
  }
}
// BA415: Hebt alte Frequenzabgleich-Eintraege auf das kanonische Format
// (cent kanonisch + frqRefMode). Idempotent.
// BA416: testmode -> frqRefMode (Feld-Umbenennung); alte BA414/415-Eintraege
// mit 'testmode' werden auf 'frqRefMode' gehoben.
// cent-Konvention (s. core.js FRQ_varRefOffsetToCanonical): +cent = rechtes Ohr hoeher.
function _FRQ_migrateResultsFormat() {
  if (typeof FRQ_resultsArray === 'undefined' || !Array.isArray(FRQ_resultsArray)) return;
  for (var i = 0; i < FRQ_resultsArray.length; i++) {
    var r = FRQ_resultsArray[i];
    if (!r) continue;
    // Schon auf frqRefMode umgestellt -> nichts tun.
    if (typeof r.frqRefMode === 'string') continue;
    // BA414/415-Eintrag mit altem Feld 'testmode': nur Feld umbenennen.
    if (typeof r.testmode === 'string') {
      r.frqRefMode = r.testmode;
      delete r.testmode;
      continue;
    }

    // 1) frqRefMode aus Alt-Feldern ableiten.
    var frqRefMode;
    if (r.refSide === 'symmetric')      frqRefMode = 'symmetric';
    else if (r.varSide === 'right')     frqRefMode = 'right';
    else                                frqRefMode = 'left';   // Default/legacy

    // 2) Rohen Offset (pse-Konvention: refHz = varHz * 2^(pse/1200)) rekonstruieren.
    //    - asym Altdaten: Offset steckt in refFreq/varFreq.
    //    - sym Altdaten:  altes r.cent IST der rohe pse (= Offset gegen Mitte).
    var rawOffset = null;
    if (typeof r.refFreq === 'number' && typeof r.varFreq === 'number'
        && r.refFreq > 0 && r.varFreq > 0) {
      rawOffset = 1200 * Math.log2(r.refFreq / r.varFreq);
    } else if (typeof r.cent === 'number' && isFinite(r.cent)) {
      rawOffset = r.cent;   // sym-Altfall: altes cent war roher pse
    }
    if (rawOffset == null) {
      r._frqUnmigratable = true;
      continue;
    }

    // 3) Kanonisieren (FRQ_varRefOffsetToCanonical aus core.js, var/ref-Migration).
    r.cent       = Math.round(FRQ_varRefOffsetToCanonical(frqRefMode, rawOffset));
    r.frqRefMode = frqRefMode;

    // 4) Alte Felder entfernen.
    delete r.varSide;
    delete r.refSide;
    delete r.varFreq;
    delete r.refFreq;
  }
  // Nicht migrierbare Eintraege entfernen.
  for (var j = FRQ_resultsArray.length - 1; j >= 0; j--) {
    if (FRQ_resultsArray[j] && FRQ_resultsArray[j]._frqUnmigratable) {
      FRQ_resultsArray.splice(j, 1);
    }
  }
}

// BA416: Laedt FRQ_pianoSession aus den geladenen Daten. Migriert alte
// pro-Seite-Behaelter (d.sides[side].freqmatchPiano) auf die globale,
// seitenlose Session. d = das geladene JSON-Objekt.
function _FRQ_loadPianoSession(d) {
  // 1) Neues Format: globale Session direkt.
  if (d && d.pianoSession) {
    FRQ_pianoSession = d.pianoSession;
    return;
  }
  // 2) Alt-Format: die EINE Seite mit freqmatchPiano-Daten finden.
  FRQ_pianoSession = null;
  if (!d || !d.sides) return;
  var srcSide = null, src = null;
  ['left', 'right'].forEach(function (side) {
    var fp = d.sides[side] && d.sides[side].freqmatchPiano;
    if (!srcSide && fp && fp.perElectrode
        && Object.keys(fp.perElectrode).length > 0) {
      srcSide = side; src = fp;
    }
  });
  // (Falls BEIDE Seiten Daten tragen: die erste gefundene -- Beschluss.)
  if (!src) return;
  // run aus Alt-Format: varSide/refSide/symmetric -> frqRefMode ableiten.
  var oldRun = src.run || null;
  var frqRefMode = 'left';
  if (oldRun) {
    if (oldRun.symmetric)                frqRefMode = 'symmetric';
    else if (oldRun.varSide === 'right') frqRefMode = 'right';
    else                                 frqRefMode = 'left';
  }
  var newRun = null;
  if (oldRun) {
    newRun = {
      runId:        oldRun.runId || new Date().toISOString(),
      startedAt:    oldRun.startedAt || Date.now(),
      lastUpdate:   oldRun.lastUpdate || Date.now(),
      electrodeList: oldRun.electrodeList || [],
      currentRound: oldRun.currentRound || 1,
      roundOrder:   oldRun.roundOrder || [],
      posInRound:   oldRun.posInRound || 0,
      borderOrder:  oldRun.borderOrder || ['lower', 'upper'],
      posInBorder:  oldRun.posInBorder || 0
    };
  }
  FRQ_pianoSession = {
    frqRefMode:   frqRefMode,
    run:          newRun,
    perElectrode: src.perElectrode || {}
  };
}

function loadSideData(side, d) {
  const s = sideData[side];
  s.config = d.config || "ci";
  if (d.manufacturer && MFR[d.manufacturer]) {
    s.manufacturer = d.manufacturer;
    s.nEl = MFR[s.manufacturer].n;
    s.FRQ_implantat = d.frequencies || [...MFR[s.manufacturer].FRQ_implantat];
  } else {
    s.nEl = MFR[s.manufacturer].n;
    s.FRQ_implantat = [...MFR[s.manufacturer].FRQ_implantat];
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
    s.ELL_refEl = valid ? r : pickDefaultRefEl(side);
  }
  // BA 251: judgmentResults aus alten Dateien werden stillschweigend ignoriert.
  s.ELL_results = d.balanceResults || [];
  s.schieberELL = d.manualLevels || new Array(s.nEl).fill(0);
  if (d.presets && Array.isArray(d.presets)) {
    s.kurvenELL = KURVEN_ELL_TYPES.map((tp) => {
      const found = d.presets.find((p) => p.type === tp);
      if (found) {
        if (found.phon == null) found.phon = 70;
        return found;
      }
      return {
        type: tp, on: false, strength: 0, center: CENT_REF_HZ, width: 1200,
        phon: 70,
        cutoff: tp === "bassboost" ? Math.floor(s.nEl / 3) : Math.floor((s.nEl * 2) / 3),
      };
    });
  }
  s.fullSweepRound = d.fullSweepRound !== undefined ? d.fullSweepRound : null;
  s.fullSweepDonePairs =
    d.fullSweepDonePairs !== undefined ? d.fullSweepDonePairs : [];
  // Load FRQ_implantatOwn: if present use it; else split loaded FRQ_implantat vs defaults
  if (d.electrodeFreqOwn) {
    s.FRQ_implantatOwn = [...d.electrodeFreqOwn];
  } else {
    const defF = MFR[s.manufacturer].FRQ_implantat;
    s.FRQ_implantatOwn = s.FRQ_implantat.map((f, i) =>
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
function getPlayerSTB() {
  if (!plApplyBalance) return 0;
  // Mean aus STB_results berechnen (STB_results ist global in stereobalance-balance.js)
  if (typeof STB_results === "undefined") return 0;
  const vals = Object.values(STB_results).filter((v) => isFinite(v));
  if (!vals.length) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  // Positive mean = right louder → negative balance offset (rechts dämpfen)
  return Math.max(-60, Math.min(60, parseFloat((-mean).toFixed(1))));
}
function getPlayerSTBGains() {
  // Liefert {left, right} dB-Werte für die beiden Channel-Gains
  // im "both"-Modus. Berücksichtigt plBalanceMode.
  // b ist die gemessene L↔R-Differenz in dB (= -mean der STB_results).
  // Der akustische Unterschied muss in ALLEN Modi genau b betragen,
  // wie beim Test eingestellt (STB_pairGains verteilt off als ±off/2).
  // "sym" (Default): symmetrisch, jede Seite trägt die Hälfte (±b/2).
  // "left":  voller Ausgleich b ausschließlich auf der linken Seite.
  // "right": voller Ausgleich b ausschließlich auf der rechten Seite.
  const b = getPlayerSTB();
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
function STB_rawGains() {
  // Wie getPlayerSTBGains(), aber ignoriert plApplyBalance.
  // Für Meßtests (Frequenzabgleich, Latenz): Balance immer anwenden.
  if (typeof STB_results === "undefined") return { left: 0, right: 0 };
  const vals = Object.values(STB_results).filter((v) => isFinite(v));
  if (!vals.length) return { left: 0, right: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  // b = gemessene L↔R-Differenz; Verteilung wie getPlayerSTBGains.
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
    FRQ_implantat,
    elSt,
    elNt,
    elExDur,
    schieberELL,
    kurvenELL,
    ELL_refEl,
    ELL_results,
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
function dEN(i, side) {
  if (side === "left" || side === "right") {
    var s = sideData[side];
    if (s) {
      var me = MFR[s.manufacturer];
      var ap = me ? me.apFirst : true;
      return ap ? i + 1 : s.nEl - i;
    }
  }
  return MFR[mfr].apFirst ? i + 1 : nEl - i;
}
// Liefert das Präfix ("E" oder "B") für die aktive Seite
function dENPrefix(side) {
  const cfg = side ? (sideData[side].config || "ci") : (config || "ci");
  return cfg === "ci" ? t("cfgLblEnCI") : t("cfgLblEnAcoustic");
}
// Liefert Seite, die als Frequenzraster-Quelle dient,
// oder null wenn beide CI (unabhängig) oder beide nicht-CI (Default)
function FRQ_implantatGetSource() {
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
    oldSnap = (typeof STB_snapshot !== 'undefined') ? STB_snapshot : null;
  } else if (testKey === 'latenz') {
    oldSnap = (typeof LTZ_result !== 'undefined' && LTZ_result)
            ? LTZ_result.implantSnapshot : null;
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
function FRQ_implantatSyncToAcoustic() {
  if (_syncInProgress) return;
  _syncInProgress = true;
  try {
    const src = FRQ_implantatGetSource();
    if (src) {
      // Eine CI-Seite ist Quelle: andere Seite(n) spiegeln
      const other = src === "left" ? "right" : "left";
      // BA 154: nur akustische Konfigurationen spiegeln, nicht „unknown" oder „deaf"
      const otherCfg = sideData[other].config || "unknown";
      if (["hg", "normal", "shoh"].includes(otherCfg)) {
        const srcData = sideData[src];
        const otherData = sideData[other];
        otherData.nEl = srcData.nEl;
        otherData.FRQ_implantat = [...srcData.FRQ_implantat];
        otherData.manufacturer = srcData.manufacturer;
        // FRQ_implantatOwn auf neue Länge anpassen, nicht überschreiben
        if (!otherData.FRQ_implantatOwn || otherData.FRQ_implantatOwn.length !== otherData.nEl) {
          otherData.FRQ_implantatOwn = new Array(otherData.nEl).fill(null);
        }
        // Arrays auf neue Elektrodenzahl anpassen
        ["elSt","elNt","elExDur","schieberELL"].forEach(k => {
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
            s.FRQ_implantat = [...MFR[defaultMfr].FRQ_implantat];
            s.manufacturer = defaultMfr;
            s.FRQ_implantatOwn = new Array(defN).fill(null);
            ["elSt","elNt","elExDur","schieberELL"].forEach(k => {
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
    s.FRQ_implantat = (MFR[s.manufacturer] && [...MFR[s.manufacturer].FRQ_implantat]) || [];
    FRQ_implantatSyncToAcoustic();
  } else {
    // unknown / hg / normal / shoh / deaf: keine eigenen Frequenzen,
    // ggf. Spiegel von der anderen CI-Seite.
    FRQ_implantatSyncToAcoustic();
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
let ELL_testAct = false,
  ELL_testPairs = [],
  ELL_testIdx = 0,
  ELL_curPlayed = false,
  ELL_curBase = 0,
  slExt = false;
let ELL_curA = -1,
  ELL_curB = -1,
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
// Vol als int 0..100 (UI-Wert); FRQ_getVolume macht die quadratische Audio-Konversion.
let duration_freqmatch = TEST_DEFAULTS.freqmatch.duration;
let pause_freqmatch    = TEST_DEFAULTS.freqmatch.pause;
// BA 250: Vol/Dur/Pau fuer Elektrodenlautstaerke. Analog zu freqmatch
// als State-Variablen statt im testUI-Header. Vol als int 0..100;
// tGVol macht die quadratische Audio-Konversion.
// BA 287: gemeinsame Lautstaerke fuer alle drei Mess-Tests UND den
// Implantat-Reiter. Ersetzt die frueheren volume_test/volume_balance/
// volume_freqmatch/volume_implant. Vol als int 0..100; die Getter
// (tGVol/STB_gVol/FRQ_getVolume/...) machen die quadratische Audio-Konversion.
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
let FRQ_resultsArray = [];

// BA416: Klaviertest-Sitzungszustand, global+seitenlos (Architektur 6a).
// null = keine Session. Persistiert in .cimbel (global) + localStorage.
let FRQ_pianoSession = null;

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

let schieberELLShowMeas = false;
let schieberELLShowCurves = false;
let schieberELLMode = "rel";    // "rel" = relativ (±dB), "abs" = absolut (qu/CL/CU)
let schieberELLVariant = "stack"; // "stack" = gestapelt, "sum" = nur Summe, "lines" = Summe + Vergleichslinien

