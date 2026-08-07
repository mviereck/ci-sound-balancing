// ============================================================
// STATE & SIDE MANAGEMENT
// ============================================================

// --- Global state variables ---
let activeSide = "left";
const sideData = { left: {}, right: {} };
let mfr,
  nEl,
  FRQ_implantatBaenderDefault,
  FRQ_implantatBaenderOwn,
  elSt,
  elExDur,
  schieberELL,
  ELL_refEl,
  ELL_results,
  config;
// Einzige Frequenzquelle aller Messungen/Wiedergaben: geometrische
// Mitte des effektiven Bandes (Own[i] ?? Default[i]) der Elektrode i.
// Architektur: 00-implantat-frequenzbaender-architektur.md Sec. 3.
function FRQ_implantatEffektiv(i, srcData) {
  var band = FRQ_implantatBand(i, srcData);
  return band ? geomMitte(band.lo, band.hi) : 0;
}
let ell_focus = 0;
let defaultMfr = "unknown"; // BA 154: Erststart-Default
let audiologUserNote = ""; // Patient-Notiz für Audiologen-Bericht (top-level, beide Seiten)
let userFileSuffix = ""; // globaler Dateinamen-Suffix für alle Exporte
let userLastName  = ""; // Nachname für Dateinamen und Druck-Seitentitel (BA 268)
let userFirstName = ""; // Vorname für Dateinamen und Druck-Seitentitel (BA 268)

let kurvenELL = [];
let kurvenELLActivePi = -1;   // aktive Kurvenzeile (-1 = keine)
let elActive = [];  // BA 164: Aktivitäts-Flag pro Elektrode der aktiven Seite
let fullSweepRound = null,
  fullSweepDonePairs = [];
function initElektrodenlautstaerkeKurven() {
  kurvenELL = KURVEN_ELL_TYPES.map((tp) => ({
    type: tp,
    on: false,
    strength: tp === "iso226" ? 1 : 0,
    center: CENT_REF_HZ,
    width: 1200,
    phon: 70,
  }));
}
function bindActiveSide() {
  const s = sideData[activeSide];
  mfr = s.manufacturer;
  nEl = s.nEl;
  FRQ_implantatBaenderDefault = s.FRQ_implantatBaenderDefault;
  FRQ_implantatBaenderOwn = s.FRQ_implantatBaenderOwn;
  elSt = s.elSt;
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
// ELL-Funktionen (ELL_compWLS, drawBarGraph, ELL_testData). side:
// 'left' | 'right' | 'global' ('global' = aktuell gebundene Seite).
// Liefert seitenrichtige Daten UND Closures, ohne die globalen Tool-
// Variablen zu binden (kein withSide nötig).
function ELL_ctx(side) {
  var key = (side === "left" || side === "right") ? side : activeSide;
  var s = sideData[key];
  if (!s) return {};                 // defensiv: keine Seite -> leeres ctx
  var _nEl = s.nEl;
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
      return FRQ_implantatEffektiv(i, s);
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
  s.FRQ_implantatBaenderDefault = implantDefaultBaender(s.manufacturer);
  s.FRQ_implantatBaenderOwn = new Array(s.nEl).fill(null);
  s.elSt = new Array(s.nEl).fill(null);
  s.elExDur = new Array(s.nEl).fill(null);
  s.schieberELL = new Array(s.nEl).fill(0);
  s.ELL_refEl = Math.floor(s.nEl / 2);
  s.ELL_results = [];
  // BA 164: Aktivitäts-Flag pro Elektrode (true = arbeitet im CI)
  s.elActive = new Array(s.nEl).fill(true);
  // BA479: Frequenzketten-Auswahl pro Elektrode (true = geht ab der Glaettung
  // in die Frequenzkette). Default: alle. Nur elFreqChain===false nimmt die
  // Elektrode aus der Kette (zum Deaktivieren vorgemerkt), zusaetzlich zu
  // elActive===false (bereits deaktiviert).
  s.elFreqChain = new Array(s.nEl).fill(true);
  // BA462: gewählte Bandgrenzen-Wand (Hz) pro Seite. Default = Hersteller-
  // Default aus bandGrenzen; unknown (bandGrenzen null) -> null (keine Wahl).
  var _bg462 = MFR[s.manufacturer] ? MFR[s.manufacturer].bandGrenzen : null;
  s.bandWandLo = _bg462 ? _bg462.default[0] : null;
  s.bandWandHi = _bg462 ? _bg462.default[1] : null;
  // BA463: seitenweise Band-Wahlen mit Default initialisieren.
  if (typeof FRQ_BAND_WAHLEN !== "undefined") {
    FRQ_BAND_WAHLEN.forEach(function (w) { s[w.key] = w.def; });
  }
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
  // BA462: Wand-Radios auf die neue aktive Seite umbauen.
  if (typeof _frqBandWandBuild === "function") _frqBandWandBuild();
  if (typeof _frqBandSpiegle === "function") _frqBandSpiegle();   // BA463
  if (typeof window._frqGlaettUpdate === "function") window._frqGlaettUpdate();
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
// Laedt FRQ_pianoSession aus den geladenen Daten (globale, seitenlose
// Session). d = das geladene JSON-Objekt.
function _FRQ_loadPianoSession(d) {
  FRQ_pianoSession = (d && d.pianoSession) ? d.pianoSession : null;
  if (!FRQ_pianoSession) return;
  _FRQ_pianoNachLadenNeuRechnen();
}

// Nach dem Laden: Klavier-Ergebnisse (fRes) aus dem Verlauf neu
// schreiben, damit sie immer der AKTUELLEN Streuband-Rechnung
// entsprechen. Ohne diesen Schritt stuende eine mit aelterem
// Rechenstand gespeicherte Mitte bis zur naechsten Bestaetigung neben
// dem live gerechneten Band. Nur bei vorhandenen Verlaufsdaten —
// _frq_pianoWriteResults loescht sonst piano-Eintraege ersatzlos.
function _FRQ_pianoNachLadenNeuRechnen() {
  if (FRQ_pianoSession && FRQ_pianoSession.perElectrode
      && Object.keys(FRQ_pianoSession.perElectrode).length > 0
      && typeof _frq_pianoWriteResults === "function") {
    _frq_pianoWriteResults();
  }
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
// Zentraler roher Mittelwert der Stereo-Balance-Messung (STB_results).
// EINE Wahrheit fuer Anzeige, Player, Messtests und Ausdruck.
// Filterung: nur endliche Werte UND nicht deaktivierte/stummgeschaltete
// Elektroden (auf BEIDEN Seiten geprueft) -- deaktivierte tragen nicht mehr
// zur Balance bei. Liefert null, wenn keine gueltige Messung uebrig bleibt.
// STB_results liegt in lr-balance.js (spaeter geladen), daher erst zur
// Laufzeit auswerten.
function STB_meanRaw() {
  if (typeof STB_results === "undefined") return null;
  var keys = Object.keys(STB_results).filter(function (k) {
    var i = +k;
    if (!isFinite(STB_results[i])) return false;
    var exL = sideData.left.elExDur[i]  !== null || sideData.left.elSt[i]  === "mute";
    var exR = sideData.right.elExDur[i] !== null || sideData.right.elSt[i] === "mute";
    return !(exL || exR);
  });
  if (!keys.length) return null;
  var sum = keys.reduce(function (a, k) { return a + STB_results[+k]; }, 0);
  return sum / keys.length;
}
function getPlayerSTB() {
  if (!plApplyBalance) return 0;
  const mean = STB_meanRaw();
  if (mean === null) return 0;
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
  const mean = STB_meanRaw();
  if (mean === null) return { left: 0, right: 0 };
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
    FRQ_implantatBaenderDefault,
    FRQ_implantatBaenderOwn,
    elSt,
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
        otherData.FRQ_implantatBaenderDefault = (srcData.FRQ_implantatBaenderDefault || []).map(function (b) { return b ? { lo: b.lo, hi: b.hi } : null; });
        otherData.FRQ_implantatBaenderOwn = (srcData.FRQ_implantatBaenderOwn || []).map(function (b) { return b ? { lo: b.lo, hi: b.hi } : null; });
        otherData.manufacturer = srcData.manufacturer;
        // Arrays auf neue Elektrodenzahl anpassen
        ["elSt","elExDur","schieberELL"].forEach(k => {
          if (!otherData[k] || otherData[k].length !== otherData.nEl) {
            const def = k === "elSt" || k === "elExDur" ? null : 0;
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
            s.FRQ_implantatBaenderDefault = implantDefaultBaender(defaultMfr);
            s.FRQ_implantatBaenderOwn = new Array(defN).fill(null);
            s.manufacturer = defaultMfr;
            ["elSt","elExDur","schieberELL"].forEach(k => {
              if (!s[k] || s[k].length !== defN) {
                const def = k === "elSt" || k === "elExDur" ? null : 0;
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
    s.FRQ_implantatBaenderDefault = implantDefaultBaender(s.manufacturer);
    s.FRQ_implantatBaenderOwn = new Array(s.nEl).fill(null);
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
  freqmatch: { toneType: "sine", volume: 75, duration: 600, pause: 300, sequence: "abab" },
  elektrodenlautstaerke: { toneType: "sine", volume: 50, duration: 600, pause: 300, sequence: "abab" },
  stereobalance: { toneType: "sine", volume: 75, duration: 600, pause: 300, sequence: "abab" },
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

// FRQ_distribution: globale Verteilung der Frequenz-Messergebnisse auf die
// Seiten (frueher Player-pWarpMode). "left" | "right" | "symmetric".
// EINE Wahl fuer alle Anwendungs-Konsumenten; gesetzt NUR im Reiter
// Frequenzbaender (BA492) + Datei-Laden; gelesen von FRQ_werte als Default.
// Architektur 00-freqmatch-wertquelle-architektur.md §4.3.
let FRQ_distribution = "right";

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

