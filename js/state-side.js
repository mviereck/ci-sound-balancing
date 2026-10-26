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
  AWG_activeId,          // aktiver Audioweg der aktiven Seite (Spiegel von sideData[side].AWG_activeId)
  ELL_raw,
  ELL_distWeightMode,
  config;
// Einzige Frequenzquelle aller Messungen/Wiedergaben: geometrische
// Mitte des effektiven Bandes (Own[i] ?? Default[i]) der Elektrode i.
// Architektur: 00-implantat-frequenzbaender-architektur.md Sec. 3.
function FRQ_implantatEffektiv(i, srcData) {
  var band = FRQ_implantatBand(i, srcData);
  return band ? geomMitte(band.lo, band.hi) : 0;
}
let ell_focus = 0;
let audiologUserNote = ""; // Patient-Notiz für Audiologen-Bericht (top-level, beide Seiten)
let userFileSuffix = ""; // globaler Dateinamen-Suffix für alle Exporte
let userLastName  = ""; // Nachname für Dateinamen und Druck-Seitentitel (BA 268)
let userFirstName = ""; // Vorname für Dateinamen und Druck-Seitentitel (BA 268)

let kurvenELL = [];
let kurvenELLActivePi = -1;   // aktive Kurvenzeile (-1 = keine)
let elActive = [];  // BA 164: Aktivitäts-Flag pro Elektrode der aktiven Seite
// Voreingestellte Stärke je Kurventyp (Startwert des Schiebers beim
// Einschalten; alle Kurven starten mit on:false). Fehlt ein Typ, gilt 0.
const KURVEN_ELL_DEFAULT_STRENGTH = {
  speech: 5,
  iso226: 1,
  volume: 0,
  tilt: 2,
  scurve: 3,
  pivot: 5,
  gauss: 5,
};
function initElektrodenlautstaerkeKurven() {
  kurvenELL = KURVEN_ELL_TYPES.map((tp) => ({
    type: tp,
    on: false,
    strength: KURVEN_ELL_DEFAULT_STRENGTH[tp] || 0,
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
  AWG_activeId = (s.AWG_activeId != null) ? s.AWG_activeId : 0;
  ELL_raw = s.ELL_raw;
  ELL_distWeightMode = s.ELL_distWeightMode || "voll";
  // BA648: seitenabhaengige ELL-Testvorgaben spiegeln (Vorbild oben).
  if (typeof _ell_selectedEls !== "undefined") {
    _ell_selectedEls = (s.ELL_selectedEls !== undefined) ? s.ELL_selectedEls : null;
  }
  if (typeof _ell_evalSelectedEls !== "undefined") {
    _ell_evalSelectedEls = (s.ELL_evalSelectedEls !== undefined) ? s.ELL_evalSelectedEls : null;
  }
  if (typeof _ELL_activeVerfahren !== "undefined") {
    _ELL_activeVerfahren = s.ELL_activeVerfahren || "full";
  }
  if (typeof snr_noiseChoiceId !== "undefined") {
    snr_noiseChoiceId = (s.SNRtest_noise !== undefined) ? s.SNRtest_noise : "__werk__";
  }
  if (typeof SNR_activeTestSet !== "undefined") {
    SNR_activeTestSet = (s.SNRtest_material !== undefined) ? s.SNRtest_material : null;
  }
  elActive = s.elActive || (s.elActive = new Array(s.nEl).fill(true));
  config = s.config || "ci";
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
  if (typeof ELL_writeEval === "function") ELL_writeEval(activeSide);
  if (typeof ELL_renderResults === "function") ELL_renderResults();
  if (typeof kurvenELLChartZeichnen === "function") kurvenELLChartZeichnen();
  if (typeof pUpdEQ === "function") pUpdEQ();
}
// Einziger Schreibweg fuer den aktiven Audioweg EINER Seite. Wahrheit
// seitenweise in sideData[side].AWG_activeId; der globale Spiegel
// AWG_activeId gilt nur fuer die aktive Seite. Zieht die Dropdown-Anzeige
// nach (AWG_renderSelects, Abschnitt 4).
function AWG_setActive(side, id) {
  if (side !== "left" && side !== "right") return;
  if (sideData[side]) sideData[side].AWG_activeId = id;
  if (side === activeSide) AWG_activeId = id;
  if (typeof AWG_renderSelects === "function") AWG_renderSelects();
  // Das aktuelle Weg-Paar hat sich evtl. geaendert -> die anzuwendende
  // Latenz und der Latenz-Button-Zustand haengen daran. Neu anwenden +
  // Button-Optik aktualisieren.
  if (typeof LTZ_applyToPlayer === "function") LTZ_applyToPlayer();
  if (typeof plUpdLatLock === "function") plUpdLatLock();
  if (typeof _autoSaveState === "function") _autoSaveState();
}
// Baut das vollständige ctx-Objekt einer Seite für die parametrisierten
// ELL-Funktionen (ELL_computeEval_compWLS, drawBarGraph, ELL_testData). side:
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
    ELL_raw: (s.ELL_raw && Array.isArray(s.ELL_raw.messpunkte)) ? s.ELL_raw.messpunkte : [],
    elSt:        s.elSt,
    elExDur:     s.elExDur,
    ELL_refEl:   s.ELL_refEl,
    ELL_evalSelectedEls: (s.ELL_evalSelectedEls !== undefined) ? s.ELL_evalSelectedEls : null,
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
  s.ELL_raw = { durchlauf: { round: null, donePairs: [] }, messpunkte: [] };
  s.ELL_eval = null;
  s.SNR_rawSide = null;   // Sprachtest-Rohwert je Seite (Stufe 1)
  s.SNR_evalSide = null;   // Sprachtest-Auswertung je Seite (Stufe 3)
  s.ELL_distWeightMode = "voll";
  // Seitenabhaengige ELL-Testvorgaben (BA648): gewaehlte Testelektroden
  // (null = alle testbaren) und gewaehltes Testverfahren ("full" | "conv").
  // Vorbild ELL_distWeightMode: Wahrheit in sideData, globaler Spiegel in
  // bindActiveSide, Schreibweg ELL_setSelectedEls / ELL_setActiveVerfahren.
  s.ELL_selectedEls = null;
  s.ELL_activeVerfahren = "full";
  // BA660: Auswertungs-eigene Elektrodenauswahl. Bestimmt, welche der
  // gemessenen Elektroden in die ELL-Auswertung (ELL_computeEval_compWLS) einfliessen.
  // null = alle gemessenen; sonst Index-Liste. UNABHAENGIG von der
  // Testauswahl ELL_selectedEls (die nur die Test-Sequenz filtert) --
  // hier wird die AUSWERTUNG gefiltert. Hash-wirksame Auswertungs-
  // Einstellung (Snapshot-Grundmodell §7 Nr. 3). Globaler Spiegel in
  // bindActiveSide, Schreibweg ELL_setEvalSelectedEls.
  s.ELL_evalSelectedEls = null;
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
  // BA651: seitenweise Testeinstellungen als Einzelfelder in sideData.
  s.ELLtest_volume = 50; s.ELLtest_toneType = "sine"; s.ELLtest_duration = 600; s.ELLtest_pause = 300; s.ELLtest_sequence = "abab";
  s.SNRtest_volume = 50;
  s.SNRtest_noise = "__werk__";   // Sprachtest-Rauschwahl, seitenweise
  s.SNRtest_material = null;   // Sprachtest-Testmaterial (test_set-Wert), seitenweise; null = Fallback erste verfuegbare
  s.map = null;   // BA696: gemessenes CI-Programm (MAP) als Zahl 1..maxMaps; null = keine Angabe
  s.hgVersorgung = "unknown";   // BA697: Hörversorgung bei config==="shoh": "unknown" | "hg" | "none"
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
  const active = (activeSide === "left") ? L : R;
  const other  = (activeSide === "left") ? R : L;
  active.classList.add("is-active");
  other.classList.remove("is-active");
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
  if (typeof SNR_renderResults === "function") SNR_renderResults();
  // Verlaufsanalyse (debug-only) haengt ebenfalls an activeSide -> mitziehen,
  // sonst bleibt Heatmap/Trend/Kurve auf der alten Seite stehen.
  if (typeof window.zaRedraw === "function") window.zaRedraw();
  buildImplantCard();
  updSideButtons();
  if (typeof AWG_renderSelects === "function") AWG_renderSelects();
  ELL_updFClearBtn();
  // BA648: ELL-Auswahl ist jetzt seitenabhaengig -> Header-Zusammenfassung
  // "m von n gewaehlt" auf die neue Seite nachziehen.
  if (typeof ELL_refreshElectrodeSelectionSummary === "function") ELL_refreshElectrodeSelectionSummary();
  // BA649: Lautstaerke-/Testton-Button zeigen den Wert der neuen Seite.
  if (typeof ELL_refreshToneTypeLabel === "function") ELL_refreshToneTypeLabel();
  if (typeof SNR_refreshVolumeLabel === "function") SNR_refreshVolumeLabel();
  if (typeof snr_refreshMeasSide === "function") snr_refreshMeasSide();   // BA662
  updPlSrcButtons();
  if (pBuf) updatePlayerForSideChange();
  else plCheck();
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
}
// Laedt FRQ_rawPiano aus den geladenen Daten (globale, seitenlose
// Session). d = das geladene JSON-Objekt.
function _FRQ_loadPianoSession(d) {
  var v = (d && d.pianoSession) ? d.pianoSession : null;
  FRQ_rawPiano = (typeof FRQ_migratePiano === "function") ? FRQ_migratePiano(v) : v;
  if (!FRQ_rawPiano) return;
  _FRQ_pianoNachLadenNeuRechnen();
}

// Nach dem Laden: Klavier-Ergebnisse (fRes) aus dem Verlauf neu
// schreiben, damit sie immer der AKTUELLEN Streuband-Rechnung
// entsprechen. Ohne diesen Schritt stuende eine mit aelterem
// Rechenstand gespeicherte Mitte bis zur naechsten Bestaetigung neben
// dem live gerechneten Band. Nur bei vorhandenen Verlaufsdaten —
// FRQ_writeEval loescht sonst piano-Eintraege ersatzlos.
function _FRQ_pianoNachLadenNeuRechnen() {
  if (FRQ_rawPiano && Array.isArray(FRQ_rawPiano.messpunkte)
      && FRQ_rawPiano.messpunkte.length > 0
      && typeof FRQ_writeEval === "function") {
    FRQ_writeEval();
  }
}

function getPlayerSide() {
  if (plBothSides) {
    if (plMonoEQ) return "mono";
    return "both";
  }
  return activeSide;
}
// Mittelungs-Verfahren der Stereo-Balance-Auswertung: "mean" | "median".
// Default arithmetisch.
let STB_avgMode = "mean";

// Persistente STB-Auswertung (Stufe 3). null = nicht gemessen.
// Geschrieben von STB_writeEval() an den Ausloesern Bestaetigung / Testende /
// nach Laden. Liegt im SAVE_SCHEMA. Felder: perEl, mean, median, avgMode,
// value, audioPath, timestamp.
let STB_eval = null;

// Stufe 1 — Rohwert-Accessor. STB_raw liegt in lr-balance.js (spaeter
// geladen), daher typeof-Guard.
//   STB_rawOffset(i) -> Zahl (der dB-Ausgleich) | undefined (nicht gemessen)
//   STB_hasRaw(i)    -> true, wenn eine gueltige (endliche) Messung vorliegt
function STB_rawOffset(i) {
  if (typeof STB_raw === "undefined" || !STB_raw || !Array.isArray(STB_raw.messpunkte)) return undefined;
  var p = (typeof stb_pointForEl === "function") ? stb_pointForEl(i) : null;
  var st = (p && Array.isArray(p.historie)) ? p.historie[0] : null;
  return (st && isFinite(st.offset)) ? st.offset : undefined;
}
function STB_hasRaw(i) {
  return STB_rawOffset(i) !== undefined;
}

// Migration geladener Rohwerte aufs Objekt-Format.
//   - neues Format (Eintrag ist Objekt mit .offset)       -> uebernommen
//   - altes Format (Eintrag ist nackte Zahl)              -> { offset: zahl,
//       timestamp: null, audioweg: {left,right} }; Weg aus oldPath ziehen
//   - unbrauchbarer Eintrag                               -> uebersprungen
// oldPath: beim Laden alter Dateien aufgefangener STB_resultsPath (oder null).
// Migration geladener STB-Rohwerte aufs Grundmuster §8. Liefert IMMER
// { durchlauf:{seq,idx}, messpunkte:[{bezug:{el}, historie:[...]}] }:
//   - NEU: bereits { durchlauf, messpunkte } -> validiert uebernehmen
//   - ALT A: Objekt {el: {offset,timestamp,audioweg}} -> je Elektrode ein
//            Meszpunkt mit einschrittiger historie
//   - ALT B: Objekt {el: <nackte Zahl>} (aelteste) -> Weg aus oldPath
//   - unbrauchbar -> leeres Grundmuster
// oldPath: beim Laden alter Dateien aufgefangener STB_resultsPath (oder null).
function STB_migrateRaw(v, oldPath) {
  var leer = { durchlauf: { seq: [], idx: 0 }, messpunkte: [] };
  if (!v || typeof v !== "object") return leer;
  var op = (oldPath && typeof oldPath === "object") ? oldPath : {};

  // NEU: Container-Objekt.
  if (!Array.isArray(v) && Array.isArray(v.messpunkte)) {
    var d = (v.durchlauf && typeof v.durchlauf === "object") ? v.durchlauf : {};
    var out = {
      durchlauf: { seq: Array.isArray(d.seq) ? d.seq : [],
                   idx: (typeof d.idx === "number") ? d.idx : 0 },
      messpunkte: []
    };
    v.messpunkte.forEach(function (p) {
      if (!p || !p.bezug || typeof p.bezug.el !== "number") return;
      var hist = Array.isArray(p.historie) ? p.historie.filter(function (st) {
        return st && isFinite(st.offset);
      }) : [];
      if (!hist.length) return;
      if (hist.length > STB_HIST_MAX) hist = hist.slice(0, STB_HIST_MAX);
      out.messpunkte.push({ bezug: { el: p.bezug.el }, historie: hist });
    });
    return out;
  }

  // ALT: Objekt {el: eintrag}. Jede Elektrode -> ein Meszpunkt mit einem Schritt.
  var outA = { durchlauf: { seq: [], idx: 0 }, messpunkte: [] };
  Object.keys(v).forEach(function (k) {
    var el = Number(k);
    if (!isFinite(el)) return;
    var e = v[k];
    var schritt = null;
    if (e != null && typeof e === "object") {
      if (!isFinite(e.offset)) return;
      var aw = (e.audioweg && typeof e.audioweg === "object") ? e.audioweg
             : (e.audiopathID && typeof e.audiopathID === "object") ? e.audiopathID : {};
      schritt = {
        audioweg: { left:  (typeof aw.left  === "number") ? aw.left  : 0,
                    right: (typeof aw.right === "number") ? aw.right : 0 },
        timestamp: (typeof e.timestamp === "number") ? e.timestamp : null,
        offset: e.offset
      };
    } else if (isFinite(e)) {
      var pth = op[k];
      schritt = {
        audioweg: { left:  (pth && typeof pth.left  === "number") ? pth.left  : 0,
                    right: (pth && typeof pth.right === "number") ? pth.right : 0 },
        timestamp: null,
        offset: e
      };
    }
    if (schritt) outA.messpunkte.push({ bezug: { el: el }, historie: [schritt] });
  });
  return outA;
}

// Stufe 2a -- die eine gewertete Elektroden-Teilmenge: endlich gemessen,
// in der Auswertungs-Auswahl, auf BEIDEN Seiten nicht stumm/ausgeschlossen.
// EINE Quelle fuer Wert-Verdichtung UND Audioweg.
function STB_evalKeys() {
  if (typeof STB_raw === "undefined") return [];
  var _selSet = (typeof STB_evalSelectedEls !== "undefined"
                 && STB_evalSelectedEls && STB_evalSelectedEls.length)
                ? new Set(STB_evalSelectedEls) : null;
  var _els = Array.isArray(STB_raw.messpunkte)
    ? STB_raw.messpunkte.map(function (p) { return p.bezug.el; })
    : [];
  return _els.filter(function (i) {
    if (!STB_hasRaw(i)) return false;
    if (_selSet && !_selSet.has(i)) return false;
    var exL = sideData.left.elExDur[i]  !== null || sideData.left.elSt[i]  === "mute";
    var exR = sideData.right.elExDur[i] !== null || sideData.right.elSt[i] === "mute";
    return !(exL || exR);
  });
}

// Stufe 2a -- Verdichtung der offsets der gewerteten Elektroden nach mode.
// Kennt STB_avgMode NICHT; mode ("mean"|"median") wird immer uebergeben.
// null, wenn keine gueltige Elektrode uebrig bleibt.
function STB_computeEval_average(mode) {
  var keys = STB_evalKeys();
  if (!keys.length) return null;
  var vals = keys.map(function (k) { return STB_rawOffset(k); });
  if (mode === "median") {
    var sorted = vals.slice().sort(function (a, b) { return a - b; });
    var mid = sorted.length >> 1;
    return (sorted.length % 2) ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  var sum = vals.reduce(function (a, v) { return a + v; }, 0);
  return sum / vals.length;
}

// Audioweg-Verdichtung je Seite ueber die gewerteten Elektroden.
function STB_audioPathSide(side, keys) {
  var entries = [];
  for (var i = 0; i < keys.length; i++) {
    var p = (typeof stb_pointForEl === "function") ? stb_pointForEl(keys[i]) : null;
    var st = (p && Array.isArray(p.historie)) ? p.historie[0] : null;
    if (st) entries.push(st);
  }
  return AWG_distribution(AWG_usedIds(entries, side));   // [{id,count}] | null
}

// Stufe 2b -- einziger Schreiber von STB_eval. Schreibt perEl, avgMode,
// value, timestamp. Aufrufer: stb_confirm, STB_finish, Laden, avgMode-Change.
function STB_writeEval() {
  var keys = STB_evalKeys();
  if (!keys.length) { STB_eval = null; return; }

  var mean   = STB_computeEval_average("mean");
  var median = STB_computeEval_average("median");

  // avgMode/value ins Feld einfrieren, damit Stufe 4/5 nicht aus der
  // globalen Variable lesen muessen. Default "mean".
  var mode = (typeof STB_avgMode !== "undefined" && STB_avgMode === "median")
             ? "median" : "mean";
  var value = (mode === "median") ? median : mean;

  // Per-Elektrode-Ebene: nur die gewerteten Elektroden.
  var perEl = {};
  for (var ki = 0; ki < keys.length; ki++) {
    var el = keys[ki];
    var p = stb_pointForEl(el);
    var r = (p && Array.isArray(p.historie)) ? p.historie[0] : null;
    if (!r) continue;
    perEl[el] = {
      offset: r.offset,
      ausgewertet: true,
      audioweg: (r.audioweg && typeof r.audioweg === "object")
        ? { left:  (typeof r.audioweg.left  === "number") ? r.audioweg.left  : 0,
            right: (typeof r.audioweg.right === "number") ? r.audioweg.right : 0 }
        : { left: 0, right: 0 }
    };
  }

  // Nicht-volatiler Zeitstempel: Maximum ueber alle STB_raw-Stempel.
  var ts = 0;
  var _mp = Array.isArray(STB_raw.messpunkte) ? STB_raw.messpunkte : [];
  for (var ti = 0; ti < _mp.length; ti++) {
    var st = (_mp[ti] && Array.isArray(_mp[ti].historie)) ? _mp[ti].historie[0] : null;
    var t0 = st && st.timestamp;
    if (typeof t0 === "number" && t0 > ts) ts = t0;
  }

  STB_eval = {
    perEl: perEl,
    mean: mean,
    median: median,
    avgMode: mode,
    value: value,
    audioPath: {
      left:  STB_audioPathSide("left",  keys),
      right: STB_audioPathSide("right", keys)
    },
    timestamp: ts
  };
}

// Stufe 4 -- reiner Leser des persistierten STB_eval-Felds. Parameterlos
// (STB binaural/global, ein STB_eval). Alle Anzeige-/Status-Leser gehen hier
// durch, nie roh an STB_raw/STB_eval. Rechnet NICHT.
function STB_testData() {
  if (STB_eval) return STB_eval;
  return {
    perEl: {},
    mean: null,
    median: null,
    avgMode: (typeof STB_avgMode !== "undefined" && STB_avgMode === "median")
             ? "median" : "mean",
    value: null,
    audioPath: { left: null, right: null },
    timestamp: 0
  };
}

// Stufe-4-naher Anzeige-Helfer: der nach avgMode gewaehlte Wert (value),
// gelesen ueber Stufe 4. null = nicht gemessen.
function STB_evalValue() {
  var v = STB_testData().value;
  return (typeof v === "number" && isFinite(v)) ? v : null;
}

// Stufe 5 -- die anzuwendenden Balance-Gains {left,right} in dB.
// Liest NUR ueber Stufe 4 (STB_evalValue -> STB_testData), nie den Rohwert.
// opts.applyBalance: false -> {0,0}; true -> Gains immer anwenden.
// Verteilung nach plBalanceMode: "sym" jede Seite +/- b/2,
// "left" voller Ausgleich links, "right" voller Ausgleich rechts.
// b = -value (positiver value = rechts lauter -> rechts daempfen).
function STB_apply(opts) {
  opts = opts || {};
  if (opts.applyBalance === false) return { left: 0, right: 0 };
  var mean = STB_evalValue();
  if (mean === null) return { left: 0, right: 0 };
  var clamp = function (v) { return Math.max(-60, Math.min(60, v)); };
  var b = clamp(parseFloat((-mean).toFixed(1)));
  var mode = (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym";
  if (mode === "left")  return { left: clamp(b),  right: 0 };
  if (mode === "right") return { left: 0, right: clamp(-b) };
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
    ELL_raw,
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
      if (["normal", "shoh"].includes(otherCfg)) {
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
      // Beide nicht-CI: leeres „unknown"-Raster setzen (kein Hersteller gewaehlt).
      const lCfg = sideData.left.config || "ci";
      const rCfg = sideData.right.config || "ci";
      if (lCfg !== "ci" && rCfg !== "ci") {
        ["left","right"].forEach(side => {
          const s = sideData[side];
          if (s.config !== "ci") {
            const defN = MFR["unknown"].n;
            s.nEl = defN;
            s.FRQ_implantatBaenderDefault = implantDefaultBaender("unknown");
            s.FRQ_implantatBaenderOwn = new Array(defN).fill(null);
            s.manufacturer = "unknown";
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
  // BA697: Hörversorgung gilt nur bei „Schwerhörig". Bei jedem Wechsel
  // auf eine andere Hörsituation zurücksetzen (nicht erhalten).
  if (cfg !== "shoh") sideData[side].hgVersorgung = "unknown";
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

// ============================================================
// BA 280: Zentrale Default-Werte (Single Source of Truth).
const TONE_ENV_DEFAULTS = {
  attackForm: "dblin",  // Anstiegsform: dB-linear
  attackMs:   90,       // Anschwingzeit ms
  dbFloor:    -20,      // Startpegel dB (nur bei dblin wirksam)
  release:    "short"   // Ausklang: kurz
};
// BA651: Testeinstellungen seitenlos (global). volume in Prozent (0..100).
let STBtest_volume = 50, STBtest_toneType = "sine", STBtest_duration = 600, STBtest_pause = 300, STBtest_sequence = "abab";
let FRQtest_volume = 50, FRQtest_toneType = "sine", FRQtest_duration = 600, FRQtest_pause = 300, FRQtest_sequence = "abab";
let LTZtest_volume = 50;
let abspielklavier_volume = 50, abspielklavier_toneType = "sine", abspielklavier_duration = 500, abspielklavier_pause = 250;
let implantat_volume = 50, implantat_toneType = "sine", implantat_duration = 600, implantat_pause = 300;

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

// Frequenzabgleich-Ergebnisse (global, nicht pro Seite)
// { varSide, refSide, elIdx, varFreq, refFreq, timestamp }
let FRQ_eval = [];

// BA662: Beidohriges Sprachtest-Ergebnis (Player "beide Seiten").
// Seitenlos: ein SRT fuer das Hoeren mit beiden Ohren zusammen, gehoert
// zu keiner Einzelseite. Vorbild FRQ_rawPiano / LTZ_result.
// null = kein beidohriger Durchgang gemessen. Liegt im SAVE_SCHEMA
// (scope:"global"). Die seitenweisen Ergebnisse bleiben in
// sideData[side].SNR_result.
// Sprachtest-Rohwert (Stufe 1, Sechs-Schichten-Muster). Satzreihe des
// beidohrigen Durchgangs (Player "beide Seiten"). null = kein beidohriger
// Durchgang gemessen. Liegt im SAVE_SCHEMA (scope "global"). Das seitige
// Gegenstueck ist sideData[side].SNR_rawSide.
let SNR_rawBoth = null;
let SNR_resultBoth = null;
// Stufe 3 (Auswertung) des beidohrigen Sprachtests. null = nicht gemessen.
// Loest SNR_resultBoth ab (dessen Lade-Key bleibt als Auffang, save-schema.js).
let SNR_evalBoth = null;

// BA416: Klaviertest-Sitzungszustand, global+seitenlos (Architektur 6a).
// null = keine Session. Persistiert in .cimbel (global) + localStorage.
let FRQ_rawPiano = null;

// FRQ_distribution: globale Verteilung der Frequenz-Messergebnisse auf die
// Seiten (frueher Player-pWarpMode). "left" | "right" | "symmetric".
// EINE Wahl fuer alle Anwendungs-Konsumenten; gesetzt NUR im Reiter
// Frequenzbaender (BA492) + Datei-Laden; gelesen von FRQ_apply als Default.
// Architektur 00-freqmatch-wertquelle-architektur.md §4.3.
let FRQ_distribution = "right";

let plEqOn = true; // EQ toggle state
let plApplyBalance = true; // Stereo-Balance anwenden
let plBalanceMode = "sym"; // "sym" | "left" | "right" — wie Stereo-Balance angewandt wird
let plEqHeadroom = true; // BA 316: Elektrodenlautstaerke gemeinsam absenken (Clipping-/Uebersteuern-Schutz)
let plEqHeadroomBoth = true; // BA 319: Absenk-Betrag ueber beide Seiten (an) vs. pro Seite (aus)
let plNHSim = false; // BA 656: Simulation fuer Normalhoerende; Wahrheit in der Variable, DOM-Haekchen gespiegelt (plUpdNHBox)
let plSrcMeas = true,
  plSrcLevels = true,
  plSrcCurves = true; // EQ source toggles
let plSrcMeasFactor = 1.0; // Staerke-Faktor fuer Elektrodenlautstaerke-Korrektur (0.5–2.0)

let plActiveSource = "musik";   // "musik" | "saetze" | "geraeusche" | "hoerbuecher"
let plAutoAdvance  = false;     // Auto-Advance-Toggle, Default aus
let plLoop         = false;     // Endlos-Toggle (aktuelles Stueck wiederholen), Default aus
let plShuffle      = false;     // BA258: Zufall-Modus global, Default aus
let plPauseMs      = 2000;      // Pause zwischen Stuecken (ms), Default 2000
let plMaskOn       = false;    // BA604: Geraeusch-Unterlegung an/aus, Default aus
let plBothSides    = false;   // Player "Beide Seiten" -- Wahrheit, DOM gespiegelt
let plMonoEQ       = false;   // Player "Stereo zu Mono" -- Wahrheit, DOM gespiegelt
let plMaskLevelKey = "snr0";   // BA604: gewaehlte SNR-Stufe (Schluessel aus PL_MASK_LEVELS)
let plShowText       = true;    // Begleittext sichtbar (Default AN, Sitzungszustand, beide Kategorien)
let plReadAutoscroll = false;   // Autoscroll-Setting (persistent)
let plTextFontStep = 2;         // Schriftgröße-Stufe der Text-Begleitbox (0..4)
let plTextLineStep = 1;         // Zeilenabstand-Stufe der Text-Begleitbox (0..3)
let plNoiseSelectedId = "gen:pink";   // Default-Geraeusch beim ersten Start
let plNoiseSearchQuery = "";          // BA262: Suchfeld-Inhalt
// BA570: parallele Achsen-Auswahl { axisKey: gewaehlterWert } (flüchtig, pro Sitzung)
let plNoiseAxisSel = {};
// BA558: Auswahl-Tabelle der parallelen Saetze-Achsen: { axisKey: wert }.
// Wert "_all" (Default) = kein Filter, "_none" = tag-frei, sonst konkret.
let plSentAxisSel = {};
let plContentLang = "de";             // BA336: Inhalts-Sprache (entkoppelt von Tool-Sprache lang); Default wird in init.js auf Tool-Sprache gesetzt
let pNoiseBuf         = null;         // dekodierter / generierter Geraeusch-Buffer
let plBookSelectedId = null;          // Collection-ID des aktuellen Buchs
let plBookChapterIdx = 0;             // Index des aktuellen Kapitels
let plBookAxisSel    = {};            // Auswahl-Tabelle der parallelen Hoerbuch-Achsen: { axisKey: wert }
let plBookSearchQuery = "";           // Stichwortsuche der Hoerbuch-Buchliste
let plBookPositions  = {};            // { <bookId>: { chapterIdx, posSeconds } }

// BA260: Musik-Bibliothek
let plMusicSelectedId   = null;     // welches Stueck aktiv ist
let plMusicSortAxis     = "title";  // Default-Sortier-Achse (noch genutzt? -> grep vor Entfernen)
let plMusicCategory     = "_all";   // "(alle)" als Default (noch genutzt? -> grep vor Entfernen)
let plMusicSearchQuery  = "";       // Such-String (persistiert)
// BA561: Auswahl-Tabelle der parallelen Musik-Achsen: { axisKey: wert }.
// Wert "_all" (Default) = kein Filter, sonst konkret.
let plMusicAxisSel = {};
let pBookBuf         = null;          // dekodierter Kapitel-Buffer (Laufzeit, nicht persistiert)

let schieberELLShowMeas = false;
let schieberELLShowCurves = false;
let schieberELLMode = "rel";    // "rel" = relativ (±dB), "abs" = absolut (qu/CL/CU)
let schieberELLVariant = "stack"; // "stack" = gestapelt, "sum" = nur Summe, "lines" = Summe + Vergleichslinien

