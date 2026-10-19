// BA536: Deklaratives Speicher-/Lade-Fundament.
// Paralleler Code — wird erst in BA537 an die Ladewege angeschlossen.
// Kein DOMContentLoaded-Closure (global sichtbar fuer file.js / init.js).

// -----------------------------------------------------------------------
// Feld-Tabelle — EIN Register. scope: "global" | "side" steht am Feld.
// Thematische Blöcke (global / seitenweise / Band-Wahlen) sind reine
// Kommentar-Ordnung; buildState/applyState verzweigen nur über e.scope.
// -----------------------------------------------------------------------
// === global ===
// BA676: Zwischenablage fuer den beim Laden alter Dateien aufgefangenen
// STB_resultsPath, bis die STB_results-Migration ihn einzieht.
var _STB_loadPathTmp = null;

var SAVE_SCHEMA = [
  // --- Kern / Seite ---
  { key: "currentSide", scope: "global",
    get: function () { return activeSide; },
    set: function (v) { activeSide = SIDES.includes(v) ? v : "left"; },
    default: "left", valid: { type: "enum", of: ["left", "right"] } },

  // --- Bandgraph global ---
  { key: "bandAusgang", scope: "global",
    get: function () { return (typeof FRQ_bandAusgang !== "undefined" ? FRQ_bandAusgang : "geglaettet"); },
    set: function (v) { if (typeof FRQ_bandAusgang !== "undefined") FRQ_bandAusgang = v; },
    default: "geglaettet", valid: { type: "string" } },

  // --- Stereo-Balance ---
  // STB_resultsPath: Auffang-Feld fuer den Pfad aus ALTEN Dateien (Zwischenablage).
  // get liefert nichts (nicht neu speichern); set fuellt nur _STB_loadPathTmp.
  { key: "STB_resultsPath", scope: "global",
    get: function () { return undefined; },
    set: function (v) { _STB_loadPathTmp = (v && typeof v === "object") ? v : null; },
    default: function () { return undefined; } },

  // Rohwert: neuer Key STB_raw. set migriert aufs Objekt-Format und zieht den
  // alten STB_resultsPath (nur beim Laden alter Dateien) aus der Zwischenablage.
  { key: "STB_raw", scope: "global",
    get: function () { return (typeof STB_raw !== "undefined" ? STB_raw : {}); },
    set: function (v) {
      if (typeof STB_raw === "undefined") return;
      var migrated = STB_migrateRaw(v, _STB_loadPathTmp);
      _STB_loadPathTmp = null;
      Object.keys(STB_raw).forEach(function (k) { delete STB_raw[k]; });
      Object.assign(STB_raw, migrated);
    },
    default: function () { return {}; }, valid: { type: "object" } },

  // Alt-Schluessel (vor BA679 hiess STB_raw noch STB_results). Faengt beim Laden
  // alter Dateien die Rohwerte ab und migriert sie ins neue Feld. get liefert
  // nichts (neue Dateien tragen nur STB_raw). MUSS NACH dem STB_raw-Eintrag
  // stehen: applyState ruft set() IMMER; der STB_raw-Eintrag setzt bei einer
  // Altdatei (kein STB_raw-Key) zuerst den Default {}. Erst danach migriert
  // dieser Auffang (Guard: STB_raw noch leer) die Altdaten -- stuende er davor,
  // machte der STB_raw-Default die Migration wieder platt.
  { key: "STB_results", scope: "global",
    get: function () { return undefined; },
    set: function (v) {
      if (typeof STB_raw === "undefined" || v == null) return;
      if (Object.keys(STB_raw).length) return;   // STB_raw bereits aus neuem Key befuellt
      var migrated = STB_migrateRaw(v, _STB_loadPathTmp);
      _STB_loadPathTmp = null;
      Object.assign(STB_raw, migrated);
    },
    default: function () { return undefined; } },

  // Mittelungs-Verfahren der STB-Auswertung (mean/median).
  { key: "STB_avgMode", scope: "global",
    get: function () { return (typeof STB_avgMode !== "undefined" ? STB_avgMode : "mean"); },
    set: function (v) { if (typeof STB_avgMode !== "undefined") STB_avgMode = v; },
    default: "mean", valid: { type: "enum", of: ["mean", "median"] } },
  // STB-Auswertung (Stufe 3): null = nicht gemessen. Wird beim Laden neu
  // gerechnet (STB_writeEval in applyData), daher hier nur persistiert.
  { key: "STB_eval", scope: "global",
    get: function () { return (typeof STB_eval !== "undefined" ? STB_eval : null); },
    set: function (v) { if (typeof STB_eval !== "undefined") STB_eval = v || null; },
    default: null },
  // BA648: STB-Testelektroden-Auswahl (seitenlos, null = alle).
  { key: "stb_selectedEls", scope: "global",
    get: function () { return (typeof stb_selectedEls !== "undefined" ? stb_selectedEls : null); },
    set: function (v) { if (typeof stb_selectedEls !== "undefined") stb_selectedEls = Array.isArray(v) ? v.slice() : null; },
    default: null },
  // BA661: STB-Auswertungs-Elektrodenauswahl (null = alle gemessenen).
  { key: "STB_evalSelectedEls", scope: "global",
    get: function () { return (typeof STB_evalSelectedEls !== "undefined" ? STB_evalSelectedEls : null); },
    set: function (v) { if (typeof STB_evalSelectedEls !== "undefined") STB_evalSelectedEls = Array.isArray(v) ? v.slice() : null; } },

  // BA662: Beidohriges Sprachtest-Ergebnis (seitenlos, wie LTZ_result).
  { key: "SNR_resultBoth", scope: "global",
    get: function () { return (typeof SNR_resultBoth !== "undefined") ? SNR_resultBoth : null; },
    set: function (v) { SNR_resultBoth = (typeof SNR_migrateResult === "function") ? SNR_migrateResult(v) : ((v && typeof v === "object") ? v : null); },
    default: null, valid: { type: "any" } },

  // --- Audioweg-Katalog (Mess-Kontext) ---
  // Seitenloser gemeinsamer Katalog + fortlaufende ID-Vergabe.
  { key: "AWG_catalog", scope: "global",
    get: function () { return (typeof AWG_catalog !== "undefined" ? AWG_catalog : []); },
    set: function (v) {
      if (typeof AWG_catalog === "undefined") return;
      AWG_catalog = Array.isArray(v) ? v.slice() : [];
      if (typeof AWG_init === "function") AWG_init();   // leerer Stand -> ID 0 sichern
    },
    default: function () { return [{ id: 0, label: "", hidden: false }]; },
    valid: { type: "array" } },
  { key: "AWG_nextId", scope: "global",
    get: function () { return (typeof AWG_nextId !== "undefined" ? AWG_nextId : 1); },
    set: function (v) { if (typeof AWG_nextId !== "undefined" && typeof v === "number" && v >= 1) AWG_nextId = v; },
    default: 1, valid: { type: "number", min: 1 } },

  // --- Latenz / Player-Anwendung ---
  // Rohwert (Stufe 1). Persistierter Key bleibt "LTZ_result" (Alt-Stand-
  // Kompatibilitaet); die Variable heisst LTZ_raw.
  { key: "LTZ_result", scope: "global",
    get: function () { return (typeof LTZ_raw !== "undefined" ? LTZ_raw : []); },
    set: function (v) {
      if (typeof LTZ_raw === "undefined") return;
      LTZ_raw = (typeof LTZ_migrateResult === "function") ? LTZ_migrateResult(v) : (Array.isArray(v) ? v : []);
    },
    default: [] },
  // Auswertung (Stufe 3): null = nicht gemessen. Wird beim Laden neu
  // gerechnet (LTZ_writeEval in applyData), daher hier nur persistiert.
  // Muss persistiert sein, obwohl beim Laden neu gerechnet: der Snapshot
  // friert das Rechenergebnis ein, und Berechnungswege koennen sich aendern
  // -- nur so ist ein frueher evtl. abweichendes Ergebnis wiederherstellbar
  // (00-persistierte-messauswertung-architektur.md Abschnitt 2, Stufe 3).
  { key: "LTZ_eval", scope: "global",
    get: function () { return (typeof LTZ_eval !== "undefined" ? LTZ_eval : null); },
    set: function (v) { if (typeof LTZ_eval !== "undefined") LTZ_eval = (v && typeof v === "object") ? v : null; },
    default: function () { return null; } },
  // Latenz-Testeinstellungen (clickType/intervalMs), vom Ergebnis entkoppelt.
  { key: "LTZtest_clickType", scope: "global",
    get: function () { return (typeof ltz_clickType !== "undefined" ? ltz_clickType : "click"); },
    set: function (v) { if (typeof ltz_clickType !== "undefined" && typeof v === "string") ltz_clickType = v; },
    default: "click", valid: { type: "string" } },
  { key: "LTZtest_intervalMs", scope: "global",
    get: function () { return (typeof ltz_intervalMs !== "undefined" ? ltz_intervalMs : 1000); },
    set: function (v) { if (typeof ltz_intervalMs !== "undefined" && typeof v === "number") ltz_intervalMs = v; },
    default: 1000, valid: { type: "number", min: 0, max: 10000 } },
  { key: "plApplyLatency", scope: "global",
    get: function () { return (typeof plApplyLatency !== "undefined" ? plApplyLatency : true); },
    set: function (v) { if (typeof plApplyLatency !== "undefined") plApplyLatency = v; },
    default: true, valid: { type: "bool" } },
  { key: "plApplyBalance", scope: "global",
    get: function () { return (typeof plApplyBalance !== "undefined" ? plApplyBalance : true); },
    set: function (v) { if (typeof plApplyBalance !== "undefined") plApplyBalance = v; },
    default: true, valid: { type: "bool" } },
  { key: "plBalanceMode", scope: "global",
    get: function () { return (typeof plBalanceMode !== "undefined" ? plBalanceMode : "sym"); },
    set: function (v) { if (typeof plBalanceMode !== "undefined") plBalanceMode = v; },
    default: "sym", valid: { type: "enum", of: ["sym", "left", "right"] } },

  // --- Frequenzabgleich-Ergebnisse + Piano-Session ---
  { key: "FRQ_resultsArray", scope: "global",
    get: function () { return (typeof FRQ_eval !== "undefined" ? FRQ_eval : []); },
    set: function (v) { if (typeof FRQ_eval !== "undefined") FRQ_eval.splice(0, FRQ_eval.length, ...(Array.isArray(v) ? v : [])); },
    default: function () { return []; }, valid: { type: "array" } },
  { key: "FRQ_pianoSession", scope: "global",
    get: function () { return (typeof FRQ_rawPiano !== "undefined" ? FRQ_rawPiano : null); },
    set: function (v) { if (typeof _FRQ_loadPianoSession === "function") _FRQ_loadPianoSession({ pianoSession: v || null }); },
    default: null },
  { key: "freqmatchTestSelection", scope: "global",
    get: function () { return (typeof freqmatchTestSelection !== "undefined" ? freqmatchTestSelection : null); },
    set: function (v) { if (typeof freqmatchTestSelection !== "undefined") freqmatchTestSelection = Array.isArray(v) ? v.slice() : null; },
    default: null },
  { key: "FRQ_activeMethodValue", scope: "global",
    get: function () { return (typeof FRQ_activeMethodValue !== "undefined" ? FRQ_activeMethodValue : "piano"); },
    set: function () { if (typeof FRQ_activeMethodValue !== "undefined") FRQ_activeMethodValue = "piano"; },
    default: "piano", valid: { type: "string" } },

  // --- Player-Quellen ---
  { key: "plSrcMeas", scope: "global",
    get: function () { return plSrcMeas; },
    set: function (v) { plSrcMeas = v; }, default: true, valid: { type: "bool" } },
  { key: "plSrcMeasFactor", scope: "global",
    get: function () { return plSrcMeasFactor; },
    set: function (v) { plSrcMeasFactor = v; }, default: 1.0,
    valid: { type: "number", min: 0.1, max: 4.0 } },
  { key: "plSrcLevels", scope: "global",
    get: function () { return plSrcLevels; },
    set: function (v) { plSrcLevels = v; }, default: true, valid: { type: "bool" } },
  { key: "plSrcCurves", scope: "global",
    get: function () { return plSrcCurves; },
    set: function (v) { plSrcCurves = v; }, default: true, valid: { type: "bool" } },
  { key: "plMaskOn", scope: "global",
    get: function () { return plMaskOn; },
    set: function (v) { plMaskOn = v; }, default: false, valid: { type: "bool" } },
  { key: "plMaskLevelKey", scope: "global",
    get: function () { return plMaskLevelKey; },
    set: function (v) { plMaskLevelKey = v; }, default: "snr0", valid: { type: "string" } },

  // --- Schieber-Tab-Anzeige ---
  { key: "schieberELLShowMeas", scope: "global",
    get: function () { return schieberELLShowMeas; },
    set: function (v) { schieberELLShowMeas = v; }, default: false, valid: { type: "bool" } },
  { key: "schieberELLShowCurves", scope: "global",
    get: function () { return schieberELLShowCurves; },
    set: function (v) { schieberELLShowCurves = v; }, default: false, valid: { type: "bool" } },
  { key: "schieberELLMode", scope: "global",
    get: function () { return schieberELLMode; },
    set: function (v) { schieberELLMode = v; }, default: "rel", valid: { type: "string" } },
  { key: "schieberELLVariant", scope: "global",
    get: function () { return schieberELLVariant; },
    set: function (v) { schieberELLVariant = v; }, default: "stack", valid: { type: "string" } },

  // --- Player-Checkboxen (Variable, DOM gespiegelt via plUpdMonoBox) ---
  { key: "plBothSides", scope: "global",
    get: function () { return plBothSides; },
    set: function (v) { plBothSides = !!v; },
    default: false, valid: { type: "bool" } },
  { key: "plMonoEQ", scope: "global",
    get: function () { return plMonoEQ; },
    set: function (v) { plMonoEQ = !!v; },
    default: false, valid: { type: "bool" } },
  { key: "plNHSim", scope: "global",
    get: function () { return (typeof plNHSim !== "undefined" ? plNHSim : false); },
    set: function (v) { if (typeof plNHSim !== "undefined") plNHSim = !!v; },
    default: false, valid: { type: "bool" } },

  // --- EQ ---
  { key: "plEqOn", scope: "global",
    get: function () { return plEqOn; },
    set: function (v) { plEqOn = v; }, default: true, valid: { type: "bool" } },
  { key: "plEqHeadroom", scope: "global",
    get: function () { return (typeof plEqHeadroom !== "undefined" ? plEqHeadroom : true); },
    set: function (v) { if (typeof plEqHeadroom !== "undefined") plEqHeadroom = v; },
    default: true, valid: { type: "bool" } },
  { key: "plEqHeadroomBoth", scope: "global",
    get: function () { return (typeof plEqHeadroomBoth !== "undefined" ? plEqHeadroomBoth : true); },
    set: function (v) { if (typeof plEqHeadroomBoth !== "undefined") plEqHeadroomBoth = v; },
    default: true, valid: { type: "bool" } },

  // --- Warp / MAPLAW ---
  { key: "pWarpOn", scope: "global",
    get: function () { return (typeof pWarpOn !== "undefined" ? pWarpOn : false); },
    set: function (v) { if (typeof pWarpOn !== "undefined") pWarpOn = v; },
    default: false, valid: { type: "bool" } },
  { key: "FRQ_distribution", scope: "global",
    get: function () { return (typeof FRQ_distribution !== "undefined" ? FRQ_distribution : "right"); },
    set: function (v) { if (typeof FRQ_distribution !== "undefined") FRQ_distribution = v; },
    default: "right", valid: { type: "string" } },
  { key: "pWarpCalcMode", scope: "global",
    get: function () { return (typeof pWarpCalcMode !== "undefined" ? pWarpCalcMode : "mid"); },
    set: function (v) { if (typeof pWarpCalcMode !== "undefined") pWarpCalcMode = v; },
    default: "mid", valid: { type: "enum", of: ["fast", "mid", "best"] } },
  { key: "pSpeed", scope: "global",
    get: function () { return (typeof pSpeed !== "undefined" ? pSpeed : 1); },
    set: function (v) { if (typeof pSpeed !== "undefined") pSpeed = v; },
    default: 1, valid: { type: "number", min: 0.5, max: 2 } },
  { key: "pMaplawOn", scope: "global",
    get: function () { return (typeof pMaplawOn !== "undefined" ? pMaplawOn : false); },
    set: function (v) { if (typeof pMaplawOn !== "undefined") pMaplawOn = v; },
    default: false, valid: { type: "bool" } },
  { key: "pMaplawSollC", scope: "global",
    get: function () { return (typeof pMaplawSollC !== "undefined" ? pMaplawSollC : 1000); },
    set: function (v) { if (typeof pMaplawSollC !== "undefined") pMaplawSollC = v; },
    default: 1000, valid: { type: "number", min: 0, max: 100000 } },
  { key: "plTextFontStep", scope: "global",
    get: function () { return (typeof plTextFontStep !== "undefined" ? plTextFontStep : 2); },
    set: function (v) { if (typeof plTextFontStep !== "undefined" && typeof v === "number") plTextFontStep = v; },
    default: 2, valid: { type: "number", min: 0, max: 4 } },
  { key: "plTextLineStep", scope: "global",
    get: function () { return (typeof plTextLineStep !== "undefined" ? plTextLineStep : 1); },
    set: function (v) { if (typeof plTextLineStep !== "undefined" && typeof v === "number") plTextLineStep = v; },
    default: 1, valid: { type: "number", min: 0, max: 3 } },
  { key: "plReadAutoscroll", scope: "global",
    get: function () { return (typeof plReadAutoscroll !== "undefined" ? plReadAutoscroll : false); },
    set: function (v) { if (typeof plReadAutoscroll !== "undefined") plReadAutoscroll = !!v; },
    default: false, valid: { type: "bool" } },

  // --- Hoerbuch-Positionen / Inhalts-Sprache ---
  { key: "plBookPositions", scope: "global",
    get: function () { return (typeof plBookPositions !== "undefined" && plBookPositions ? plBookPositions : {}); },
    set: function (v) { if (typeof plBookPositions !== "undefined" && v && typeof v === "object") Object.assign(plBookPositions, v); },
    default: function () { return {}; }, valid: { type: "object" } },
  { key: "plContentLang", scope: "global",
    get: function () { return (typeof plContentLang !== "undefined" ? plContentLang : "de"); },
    set: function (v) { if (typeof plContentLang !== "undefined" && v) { plContentLang = v; try { localStorage.setItem("ci-lb-content-lang", plContentLang); } catch (e) {} } },
    default: "de", valid: { type: "string" } },

  // --- Nutzer-Angaben ---
  { key: "userFileSuffix", scope: "global",
    get: function () { return (typeof userFileSuffix === "string" ? userFileSuffix : ""); },
    set: function (v) { if (typeof v === "string") { userFileSuffix = v; var e = document.getElementById("userFileSuffix"); if (e) e.value = v; } },
    default: "", valid: { type: "string" } },
  { key: "userLastName", scope: "global",
    get: function () { return (typeof userLastName === "string" ? userLastName : ""); },
    set: function (v) { if (typeof v === "string") { userLastName = v; var e = document.getElementById("userLastName"); if (e) e.value = v; try { sessionStorage.setItem("ci-lb-userLastName", v); } catch (x) {} } },
    default: "", valid: { type: "string" } },
  { key: "userFirstName", scope: "global",
    get: function () { return (typeof userFirstName === "string" ? userFirstName : ""); },
    set: function (v) { if (typeof v === "string") { userFirstName = v; var e = document.getElementById("userFirstName"); if (e) e.value = v; try { sessionStorage.setItem("ci-lb-userFirstName", v); } catch (x) {} } },
    default: "", valid: { type: "string" } },
  { key: "audiologUserNote", scope: "global",
    get: function () { return (typeof audiologUserNote !== "undefined" ? audiologUserNote : ""); },
    set: function (v) { if (typeof audiologUserNote !== "undefined") { audiologUserNote = (typeof v === "string") ? v : ""; var e = document.getElementById("audiologNoteInput"); if (e) e.value = audiologUserNote; } },
    default: "", valid: { type: "string" } },
  // --- Testeinstellungen (seitenlos) ---
  { key: "STBtest_volume", scope: "global",
    get: function () { return STBtest_volume; },
    set: function (v) { if (typeof v === "number") STBtest_volume = v; },
    default: 50, valid: { type: "number", min: 0, max: 100 } },
  { key: "STBtest_toneType", scope: "global",
    get: function () { return STBtest_toneType; },
    set: function (v) { if (typeof v === "string") STBtest_toneType = v; },
    default: "sine", valid: { type: "string" } },
  { key: "STBtest_duration", scope: "global",
    get: function () { return STBtest_duration; },
    set: function (v) { if (typeof v === "number") STBtest_duration = v; },
    default: 600, valid: { type: "number", min: 0, max: 5000 } },
  { key: "STBtest_pause", scope: "global",
    get: function () { return STBtest_pause; },
    set: function (v) { if (typeof v === "number") STBtest_pause = v; },
    default: 300, valid: { type: "number", min: 0, max: 5000 } },
  { key: "STBtest_sequence", scope: "global",
    get: function () { return STBtest_sequence; },
    set: function (v) { if (typeof v === "string") STBtest_sequence = v; },
    default: "abab", valid: { type: "string" } },
  { key: "FRQtest_volume", scope: "global",
    get: function () { return FRQtest_volume; },
    set: function (v) { if (typeof v === "number") FRQtest_volume = v; },
    default: 50, valid: { type: "number", min: 0, max: 100 } },
  { key: "FRQtest_toneType", scope: "global",
    get: function () { return FRQtest_toneType; },
    set: function (v) { if (typeof v === "string") FRQtest_toneType = v; },
    default: "sine", valid: { type: "string" } },
  { key: "FRQtest_duration", scope: "global",
    get: function () { return FRQtest_duration; },
    set: function (v) { if (typeof v === "number") FRQtest_duration = v; },
    default: 600, valid: { type: "number", min: 0, max: 5000 } },
  { key: "FRQtest_pause", scope: "global",
    get: function () { return FRQtest_pause; },
    set: function (v) { if (typeof v === "number") FRQtest_pause = v; },
    default: 300, valid: { type: "number", min: 0, max: 5000 } },
  { key: "FRQtest_sequence", scope: "global",
    get: function () { return FRQtest_sequence; },
    set: function (v) { if (typeof v === "string") FRQtest_sequence = v; },
    default: "abab", valid: { type: "string" } },
  { key: "LTZtest_volume", scope: "global",
    get: function () { return LTZtest_volume; },
    set: function (v) { if (typeof v === "number") LTZtest_volume = v; },
    default: 50, valid: { type: "number", min: 0, max: 100 } },
  { key: "abspielklavier_volume", scope: "global",
    get: function () { return abspielklavier_volume; },
    set: function (v) { if (typeof v === "number") abspielklavier_volume = v; },
    default: 50, valid: { type: "number", min: 0, max: 100 } },
  { key: "abspielklavier_toneType", scope: "global",
    get: function () { return abspielklavier_toneType; },
    set: function (v) { if (typeof v === "string") abspielklavier_toneType = v; },
    default: "sine", valid: { type: "string" } },
  { key: "abspielklavier_duration", scope: "global",
    get: function () { return abspielklavier_duration; },
    set: function (v) { if (typeof v === "number") abspielklavier_duration = v; },
    default: 500, valid: { type: "number", min: 0, max: 5000 } },
  { key: "abspielklavier_pause", scope: "global",
    get: function () { return abspielklavier_pause; },
    set: function (v) { if (typeof v === "number") abspielklavier_pause = v; },
    default: 250, valid: { type: "number", min: 0, max: 5000 } },
  { key: "implantat_volume", scope: "global",
    get: function () { return implantat_volume; },
    set: function (v) { if (typeof v === "number") implantat_volume = v; },
    default: 50, valid: { type: "number", min: 0, max: 100 } },
  { key: "implantat_toneType", scope: "global",
    get: function () { return implantat_toneType; },
    set: function (v) { if (typeof v === "string") implantat_toneType = v; },
    default: "sine", valid: { type: "string" } },
  { key: "implantat_duration", scope: "global",
    get: function () { return implantat_duration; },
    set: function (v) { if (typeof v === "number") implantat_duration = v; },
    default: 600, valid: { type: "number", min: 0, max: 5000 } },
  { key: "implantat_pause", scope: "global",
    get: function () { return implantat_pause; },
    set: function (v) { if (typeof v === "number") implantat_pause = v; },
    default: 300, valid: { type: "number", min: 0, max: 5000 } },
];

// Normalisiert einen geladenen Bandsatz:
//  - Laenge auf nEl (fehlende hinten mit Fallback fuellen, ueberzaehlige
//    abschneiden);
//  - jeder Eintrag ein gueltiges {lo,hi} mit 0<lo<hi, sonst Fallback.
// fillDefault=true (Default-Snapshot): fehlende/ungueltige -> Hersteller-Default
//   der Elektrode (implantDefaultBaender(mfr)[i]).
// fillDefault=false (Own-Overrides): fehlende/ungueltige -> null (Default gilt).
function _saveNormBaender(arr, nEl, mfr, fillDefault) {
  var defs = fillDefault ? implantDefaultBaender(mfr) : null;
  var out = [];
  // Eine Grenze ist gueltig, wenn null (Default) ODER finite im Bereich.
  for (var i = 0; i < nEl; i++) {
    var b = arr[i];
    if (fillDefault) {
      // Default-Snapshot: beide Grenzen muessen echte Zahlen sein.
      var okD = b && typeof b === "object"
        && isFinite(b.lo) && isFinite(b.hi) && b.lo > 0 && b.hi > b.lo;
      out.push(okD ? { lo: b.lo, hi: b.hi }
                   : (defs[i] ? { lo: defs[i].lo, hi: defs[i].hi } : null));
    } else {
      // Own-Overrides: grenzweise durchreichen: null bleibt null; Zahl bleibt
      // Zahl (auch unplausibel); nicht-leerer String bleibt String (Roh-Eingabe).
      // Keine Bereichs- oder lo<hi-Pruefung -- das macht die Plausibilitaet.
      if (!b || typeof b !== "object") { out.push(null); continue; }
      var norm = function (x) {
        if (x == null) return null;
        if (typeof x === "number") return isFinite(x) ? x : null;
        var str = String(x);
        return str.trim() === "" ? null : str;   // leerer String -> null
      };
      var lo = norm(b.lo);
      var hi = norm(b.hi);
      out.push((lo == null && hi == null) ? null : { lo: lo, hi: hi });
    }
  }
  return out;
}

// -----------------------------------------------------------------------
// === seitenweise === (config und manufacturer zuerst — manufacturer setzt nEl)
// -----------------------------------------------------------------------
SAVE_SCHEMA.push(
  { key: "config", scope: "side",
    get: function (s) { return sideData[s].config; },
    set: function (v, s) { sideData[s].config = v || "ci"; },
    default: "ci", valid: { type: "string" } },
  { key: "manufacturer", scope: "side",
    get: function (s) { return sideData[s].manufacturer; },
    set: function (v, s) {
      if (v && MFR[v]) {
        sideData[s].manufacturer = v;
        sideData[s].nEl = MFR[v].n;
      } else {
        sideData[s].nEl = MFR[sideData[s].manufacturer].n;
      }
    },
    default: "unknown", valid: { type: "string" } },

  { key: "FRQ_implantatBaenderDefault", scope: "side",
    get: function (s) { return sideData[s].FRQ_implantatBaenderDefault; },
    set: function (v, s) {
      var nEl = sideData[s].nEl;
      var mfr = sideData[s].manufacturer;
      // Aus der Datei uebernehmen (self-contained); nur bei fehlend/ungueltig
      // auf den aktuellen Hersteller-Default zurueckfallen.
      if (Array.isArray(v)) {
        sideData[s].FRQ_implantatBaenderDefault = _saveNormBaender(v, nEl, mfr, true);
      } else {
        sideData[s].FRQ_implantatBaenderDefault = implantDefaultBaender(mfr);
      }
    },
    default: function () { return []; }, valid: { type: "array" } },
  { key: "FRQ_implantatBaenderOwn", scope: "side",
    get: function (s) { return sideData[s].FRQ_implantatBaenderOwn; },
    set: function (v, s) {
      var nEl = sideData[s].nEl;
      if (Array.isArray(v)) {
        sideData[s].FRQ_implantatBaenderOwn = _saveNormBaender(v, nEl, null, false);
      } else {
        sideData[s].FRQ_implantatBaenderOwn = new Array(nEl).fill(null);
      }
    },
    default: function () { return []; }, valid: { type: "array" } },
  { key: "elSt", scope: "side",
    get: function (s) { return sideData[s].elSt; },
    set: function (v, s) {
      sideData[s].elSt = Array.isArray(v) ? v : new Array(sideData[s].nEl).fill(null);
    },
    default: function () { return []; }, valid: { type: "array" } },
  { key: "elExDur", scope: "side",
    get: function (s) { return sideData[s].elExDur; },
    set: function (v, s) {
      sideData[s].elExDur = Array.isArray(v) ? v : new Array(sideData[s].nEl).fill(null);
    },
    default: function () { return []; }, valid: { type: "array" } },
  { key: "elActive", scope: "side",
    get: function (s) { return sideData[s].elActive; },
    set: function (v, s) {
      var nEl = sideData[s].nEl;
      sideData[s].elActive = Array.isArray(v)
        ? v.map(function (x) { return x !== false; })
        : new Array(nEl).fill(true);
      while (sideData[s].elActive.length < nEl) sideData[s].elActive.push(true);
      sideData[s].elActive = sideData[s].elActive.slice(0, nEl);
    },
    default: function () { return []; }, valid: { type: "array" } },
  { key: "elFreqChain", scope: "side",
    get: function (s) { return sideData[s].elFreqChain; },
    set: function (v, s) {
      var nEl = sideData[s].nEl;
      sideData[s].elFreqChain = Array.isArray(v)
        ? v.map(function (x) { return x !== false; })
        : new Array(nEl).fill(true);
      while (sideData[s].elFreqChain.length < nEl) sideData[s].elFreqChain.push(true);
      sideData[s].elFreqChain = sideData[s].elFreqChain.slice(0, nEl);
    },
    default: function () { return []; }, valid: { type: "array" } },
  { key: "ELL_refEl", scope: "side",
    get: function (s) { return sideData[s].ELL_refEl; },
    set: function (v, s) {
      var nEl = sideData[s].nEl;
      var valid = typeof v === "number" && v >= 0 && v < nEl
        && sideData[s].elExDur[v] == null && sideData[s].elSt[v] !== "mute";
      sideData[s].ELL_refEl = valid ? v : pickDefaultRefEl(s);
    },
    default: function () { return 0; } },
  // Aktiver Audioweg je Seite (Katalog-id; 0 = "(keine Angabe)").
  { key: "AWG_activeId", scope: "side",
    get: function (s) { return (sideData[s].AWG_activeId != null) ? sideData[s].AWG_activeId : 0; },
    set: function (v, s) { sideData[s].AWG_activeId = (typeof v === "number") ? v : 0; },
    default: function () { return 0; } },
  { key: "ELL_distWeightMode", scope: "side",
    get: function (s) { return sideData[s].ELL_distWeightMode || "voll"; },
    set: function (v, s) {
      sideData[s].ELL_distWeightMode = (v === "mittel" || v === "gering") ? v : "voll";
    },
    default: "voll", valid: { type: "string" } },
  { key: "ELL_evalSelectedEls", scope: "side",
    get: function (s) { return sideData[s].ELL_evalSelectedEls || null; },
    set: function (v, s) { sideData[s].ELL_evalSelectedEls = Array.isArray(v) ? v.slice() : null; } },
  // BA648: seitenabhaengige ELL-Testvorgaben. Globaler Spiegel wird nach dem
  // Laden ueber bindActiveSide (refreshAll) nachgezogen.
  { key: "ELL_selectedEls", scope: "side",
    get: function (s) { return sideData[s].ELL_selectedEls; },
    set: function (v, s) {
      sideData[s].ELL_selectedEls = Array.isArray(v)
        ? v.filter(function (x) { return typeof x === "number"; })
        : null;
    },
    default: null },
  { key: "ELL_activeVerfahren", scope: "side",
    get: function (s) { return sideData[s].ELL_activeVerfahren || "full"; },
    set: function (v, s) {
      sideData[s].ELL_activeVerfahren = (v === "conv") ? "conv" : "full";
    },
    default: "full", valid: { type: "string" } },
  // --- Testeinstellungen (seitenweise) ---
  { key: "ELLtest_volume", scope: "side",
    get: function (s) { return sideData[s].ELLtest_volume; },
    set: function (v, s) { if (typeof v === "number") sideData[s].ELLtest_volume = v; },
    default: 50, valid: { type: "number", min: 0, max: 100 } },
  { key: "ELLtest_toneType", scope: "side",
    get: function (s) { return sideData[s].ELLtest_toneType; },
    set: function (v, s) { if (typeof v === "string") sideData[s].ELLtest_toneType = v; },
    default: "sine", valid: { type: "string" } },
  { key: "ELLtest_duration", scope: "side",
    get: function (s) { return sideData[s].ELLtest_duration; },
    set: function (v, s) { if (typeof v === "number") sideData[s].ELLtest_duration = v; },
    default: 600, valid: { type: "number", min: 0, max: 5000 } },
  { key: "ELLtest_pause", scope: "side",
    get: function (s) { return sideData[s].ELLtest_pause; },
    set: function (v, s) { if (typeof v === "number") sideData[s].ELLtest_pause = v; },
    default: 300, valid: { type: "number", min: 0, max: 5000 } },
  { key: "ELLtest_sequence", scope: "side",
    get: function (s) { return sideData[s].ELLtest_sequence; },
    set: function (v, s) { if (typeof v === "string") sideData[s].ELLtest_sequence = v; },
    default: "abab", valid: { type: "string" } },
  { key: "SNRtest_volume", scope: "side",
    get: function (s) { return sideData[s].SNRtest_volume; },
    set: function (v, s) { if (typeof v === "number") sideData[s].SNRtest_volume = v; },
    default: 50, valid: { type: "number", min: 0, max: 100 } },
  { key: "SNRtest_noise", scope: "side",
    get: function (s) { return sideData[s].SNRtest_noise || "__werk__"; },
    set: function (v, s) { sideData[s].SNRtest_noise = (typeof v === "string" && v) ? v : "__werk__"; },
    default: "__werk__", valid: { type: "string" } },
  { key: "SNRtest_material", scope: "side",
    get: function (s) { return sideData[s].SNRtest_material || null; },
    set: function (v, s) { sideData[s].SNRtest_material = (typeof v === "string" && v) ? v : null; },
    default: null },
  { key: "ELL_raw", scope: "side",
    get: function (s) { return sideData[s].ELL_raw; },
    set: function (v, s) { sideData[s].ELL_raw = Array.isArray(v) ? v : []; },
    default: function () { return []; }, valid: { type: "array" } },
  // Alt-Schluessel (vor BA678 hiess ELL_raw noch ELL_results). Faengt beim
  // Laden alter Dateien den dort gespeicherten Rohwert ab und schreibt ihn
  // ins neue Feld sideData[s].ELL_raw. get liefert nichts (nicht erneut
  // speichern, neue Dateien tragen nur noch ELL_raw).
  // MUSS NACH dem ELL_raw-Eintrag stehen: applyState iteriert SAVE_SCHEMA in
  // Reihenfolge und ruft set() IMMER; der ELL_raw-Eintrag setzt bei einer
  // Altdatei (kein ELL_raw-Key) zuerst den Default []. Erst danach migriert
  // dieser Auffang (Guard !ELL_raw.length ist dann erfuellt) die Altdaten --
  // stuende er davor, machte der ELL_raw-Default die Migration wieder platt.
  { key: "ELL_results", scope: "side",
    get: function () { return undefined; },
    set: function (v, s) {
      if (Array.isArray(v) && v.length && (!sideData[s].ELL_raw || !sideData[s].ELL_raw.length)) {
        sideData[s].ELL_raw = v;
      }
    },
    default: function () { return undefined; } },
  { key: "ELL_eval", scope: "side",
    get: function (s) { return sideData[s].ELL_eval; },
    set: function (v, s) { sideData[s].ELL_eval = (v && typeof v === "object") ? v : null; },
    default: function () { return null; }, valid: { type: "any" } },
  { key: "SNR_result", scope: "side",
    get: function (s) { return sideData[s].SNR_result || null; },
    set: function (v, s) { sideData[s].SNR_result = (typeof SNR_migrateResult === "function") ? SNR_migrateResult(v) : ((v && typeof v === "object") ? v : null); },
    default: null },
  { key: "schieberELL", scope: "side",
    get: function (s) { return sideData[s].schieberELL; },
    set: function (v, s) {
      sideData[s].schieberELL = Array.isArray(v) ? v : new Array(sideData[s].nEl).fill(0);
    },
    default: function () { return []; }, valid: { type: "array" } },
  { key: "kurvenELL", scope: "side",
    get: function (s) { return sideData[s].kurvenELL; },
    set: function (v, s) {
      var nEl = sideData[s].nEl;
      if (v && Array.isArray(v)) {
        sideData[s].kurvenELL = KURVEN_ELL_TYPES.map(function (tp) {
          var found = v.find(function (p) { return p.type === tp; });
          if (found) {
            if (found.phon == null) found.phon = 70;
            return found;
          }
          return {
            type: tp, on: false, strength: tp === "iso226" ? 1 : 0,
            center: CENT_REF_HZ, width: 1200,
            phon: 70,
          };
        });
      }
    },
    default: null },
  { key: "fullSweepRound", scope: "side",
    get: function (s) { return sideData[s].fullSweepRound; },
    set: function (v, s) { sideData[s].fullSweepRound = v !== undefined ? v : null; },
    default: null },
  { key: "fullSweepDonePairs", scope: "side",
    get: function (s) { return sideData[s].fullSweepDonePairs; },
    set: function (v, s) { sideData[s].fullSweepDonePairs = Array.isArray(v) ? v : []; },
    default: function () { return []; }, valid: { type: "array" } },
  { key: "implant", scope: "side",
    get: function (s) { return sideData[s].implant; },
    set: function (v, s) {
      var nEl = sideData[s].nEl;
      var di = (v && typeof v === "object") ? v : {};
      sideData[s].implant = {
        model: di.model || "",
        processor: di.processor || "",
        cValue: di.cValue !== undefined && di.cValue !== null ? di.cValue : null,
        idr: di.idr !== undefined && di.idr !== null ? di.idr : null,
        generation: di.generation || null,
        coding: di.coding || "unknown",
        fspEl: Array.isArray(di.fspEl) ? di.fspEl.map(function (x) { return x === true; }) : new Array(nEl).fill(false),
        mcl: di.mcl || new Array(nEl).fill(null),
        thr: di.thr || new Array(nEl).fill(null),
        upperLevel: di.upperLevel || new Array(nEl).fill(null),
      };
      ["mcl", "thr", "upperLevel", "fspEl"].forEach(function (k) {
        var fill = k === "fspEl" ? false : null;
        while (sideData[s].implant[k].length < nEl) sideData[s].implant[k].push(fill);
        sideData[s].implant[k] = sideData[s].implant[k].slice(0, nEl);
      });
    },
    default: null },
  { key: "bandWandLo", scope: "side",
    get: function (s) { return sideData[s].bandWandLo; },
    set: function (v, s) {
      var mfr = sideData[s].manufacturer;
      var bg = MFR[mfr] ? MFR[mfr].bandGrenzen : null;
      sideData[s].bandWandLo = (typeof v === "number") ? v : (bg ? bg.default[0] : null);
    },
    default: null },
  { key: "bandWandHi", scope: "side",
    get: function (s) { return sideData[s].bandWandHi; },
    set: function (v, s) {
      var mfr = sideData[s].manufacturer;
      var bg = MFR[mfr] ? MFR[mfr].bandGrenzen : null;
      sideData[s].bandWandHi = (typeof v === "number") ? v : (bg ? bg.default[1] : null);
    },
    default: null },
);

// Band-Wahlen (24) datengetrieben aus FRQ_BAND_WAHLEN (key === fileKey).
FRQ_BAND_WAHLEN.forEach(function (w) {
  SAVE_SCHEMA.push({
    key: w.key, scope: "side",
    get: function (s) { return sideData[s][w.key]; },
    set: function (v, s) { sideData[s][w.key] = (typeof v === "string") ? v : w.def; },
    default: w.def, valid: { type: "string" },
  });
});

// -----------------------------------------------------------------------
// Generische Hilfsfunktionen
// -----------------------------------------------------------------------
function _saveValidValue(v, rule) {
  if (v === undefined || v === null) return false;
  if (!rule) return true;
  switch (rule.type) {
    case "bool":   return typeof v === "boolean";
    case "string": return typeof v === "string";
    case "array":  return Array.isArray(v);
    case "object": return typeof v === "object" && !Array.isArray(v);
    case "number": {
      var n = (typeof v === "number") ? v : parseInt(v, 10);
      return isFinite(n)
        && (rule.min === undefined || n >= rule.min)
        && (rule.max === undefined || n <= rule.max);
    }
    case "enum":   return rule.of.indexOf(v) !== -1;
    case "fn":     return !!rule.ok(v);
    default:       return true;
  }
}

function _saveDefault(entry) {
  return (typeof entry.default === "function") ? entry.default() : entry.default;
}

// -----------------------------------------------------------------------
// Laufzeit-Accessor: EIN Weg, ein persistiertes Feld zur Laufzeit zu
// lesen/schreiben (ausserhalb von buildState/applyState). Scope-Aufloesung
// steckt im Schema-Eintrag (get/set bekommen bei scope:"side" die Seite).
// -----------------------------------------------------------------------
var _SAVE_SCHEMA_BY_KEY = {};
SAVE_SCHEMA.forEach(function (e) { _SAVE_SCHEMA_BY_KEY[e.key] = e; });

function saveGet(key, side) {
  var e = _SAVE_SCHEMA_BY_KEY[key];
  if (!e) return null;
  return (e.scope === "side") ? e.get(side || activeSide) : e.get();
}
function saveSet(key, v, side) {
  var e = _SAVE_SCHEMA_BY_KEY[key];
  if (!e) return;
  if (e.scope === "side") e.set(v, side || activeSide);
  else e.set(v);
}

// -----------------------------------------------------------------------
// buildState / applyState (Phase 1)
// -----------------------------------------------------------------------
function buildState() {
  var d = {
    app: "CImbel",
    version: APP_VERSION,
    savedAt: new Date().toISOString(),  // Speicherzeitpunkt (ISO-8601 UTC); Dateiname traegt zusaetzlich das lokale Kurzdatum
    presetFormat: "freq-v4",
    sides: { left: {}, right: {} },
  };
  SAVE_SCHEMA.forEach(function (e) {
    if (e.scope === "global") {
      d[e.key] = e.get();
    } else {
      d.sides.left[e.key]  = e.get("left");
      d.sides.right[e.key] = e.get("right");
    }
  });
  return d;
}

function applyState(d) {
  if (!d || typeof d !== "object") return;
  SAVE_SCHEMA.forEach(function (e) {
    if (e.scope === "global") {
      var raw = d[e.key];
      e.set(_saveValidValue(raw, e.valid) ? raw : _saveDefault(e));
    } else {
      ["left", "right"].forEach(function (side) {
        var src = (d.sides && d.sides[side]) ? d.sides[side] : {};
        var raw = src[e.key];
        e.set(_saveValidValue(raw, e.valid) ? raw : _saveDefault(e), side);
      });
    }
  });
}

// -----------------------------------------------------------------------
// refreshAll (Phase 2) — Vereinigung aller Render-/Refresh-Aufrufe
// beider heutiger Ladewege (applyLoadedData + Restore).
// -----------------------------------------------------------------------
function refreshAll() {
  // Reihenfolge-kritisch zuerst:
  if (typeof _frqBandWandBuild === "function") _frqBandWandBuild();      // VOR _frqBandSpiegle
  if (typeof _frqBandSpiegle === "function") _frqBandSpiegle();          // VOR renderResults
  if (typeof window._frqGlaettUpdate === "function") window._frqGlaettUpdate();
  // Aufbau / Tabellen:
  if (typeof bindActiveSide === "function") bindActiveSide();
  if (typeof FRQ_implantatTableBuild === "function") FRQ_implantatTableBuild();
  if (typeof buildImplantCard === "function") buildImplantCard();
  // Nach Laden: ELL-Auswertung beider Seiten aus den geladenen
  // ELL_raw NEU rechnen (analog STB_writeEval), nicht den
  // gespeicherten Wert blind uebernehmen.
  if (typeof ELL_writeEval === "function") { ELL_writeEval("left"); ELL_writeEval("right"); }
  if (typeof ELL_renderResults === "function") ELL_renderResults();
  if (typeof FRQ_renderResults === "function") FRQ_renderResults();
  if (typeof kurvenELLTabelleBauen === "function") kurvenELLTabelleBauen();
  if (typeof kurvenELLChartZeichnen === "function") kurvenELLChartZeichnen();
  // Player / EQ:
  if (typeof pBuildEQ === "function") pBuildEQ();
  if (typeof pDrawEQ === "function") pDrawEQ();
  if (typeof pEqF !== "undefined" && pEqF && pEqF.length > 0 && typeof pUpdEQ === "function") pUpdEQ();
  // plSyncUI ersetzt die einzelnen Player-UI-Updates (updEqToggleBtn,
  // updPlSrcButtons, updBalApplyBtn, pWarpUpdUI, pMaplawUpdUI,
  // plUpdMonoBox, plUpdHeadroomBox u.a.).
  if (typeof plSyncUI === "function") plSyncUI();
  // Nach Laden: Latenz-Auswertung aus LTZ_raw NEU schreiben, bevor
  // LTZ_applyToPlayer (liest ueber Stufe 5) und die Anzeige laufen.
  if (typeof LTZ_writeEval === "function") LTZ_writeEval();
  if (typeof LTZ_applyToPlayer === "function") LTZ_applyToPlayer();
  if (typeof LTZ_renderResults === "function") LTZ_renderResults();
  // Latenz-Testeinstellungen (ltz_clickType/ltz_intervalMs) in die Buttons/Hinweis spiegeln.
  if (typeof _ltz_refreshExtraActives === "function") _ltz_refreshExtraActives();
  if (typeof _ltz_updateIntervalHint === "function") _ltz_updateIntervalHint();
  if (typeof SNR_renderResults === "function") SNR_renderResults();
  // Nach Laden: STB-Auswertung aus STB_raw NEU rechnen, nicht den gespeicherten
  // Wert blind uebernehmen -> Feld und Rohwerte bleiben konsistent.
  if (typeof STB_writeEval === "function") STB_writeEval();
  if (typeof STB_renderResults === "function") STB_renderResults();
  if (typeof STB_renderMean === "function") STB_renderMean();
  // MAPLAW / Warp:
  if (typeof pMaplawTrigger === "function") pMaplawTrigger();
  if (typeof _pWarpCalcModeApply === "function") _pWarpCalcModeApply();
  // BA590: Buttons spiegeln (plSyncUI ruft plUpdSpeedBtns bereits auf;
  // Extra-Trigger nur wenn Tempo != 1 und Buffer bereit).
  if (typeof pSpeed !== "undefined" && Math.abs(pSpeed - 1) > 1e-6
      && typeof pSourceBuf !== "undefined" && pSourceBuf
      && typeof pWarpTrigger === "function") {
    pWarpTrigger();
  }
  if (typeof schieberELLUpdateWarpHint === "function") schieberELLUpdateWarpHint();
  if (typeof schieberELLUpdateModeAvailability === "function") schieberELLUpdateModeAvailability();
  if (typeof schieberELLRebuild === "function"
      && document.getElementById("panel-schieber")
      && document.getElementById("panel-schieber").classList.contains("active")) {
    schieberELLRebuild();
  }
  // Zusammenfassungen / Labels:
  if (typeof FRQ_refreshResumeHint === "function") FRQ_refreshResumeHint();
  if (typeof FRQ_applyLang === "function") FRQ_applyLang();
  if (typeof _FRQ_refreshTabState === "function") _FRQ_refreshTabState();
  if (typeof STB_refreshElectrodeSelectionSummary === "function") STB_refreshElectrodeSelectionSummary();
  if (typeof FRQ_refreshElectrodeSelectionSummary === "function") FRQ_refreshElectrodeSelectionSummary();
  if (typeof ELL_refreshElectrodeSelectionSummary === "function") ELL_refreshElectrodeSelectionSummary();
  if (typeof STB_refreshToneTypeLabel === "function") STB_refreshToneTypeLabel();
  if (typeof STB_refreshAvgMode === "function") STB_refreshAvgMode();
  if (typeof FRQ_refreshToneTypeLabel === "function") FRQ_refreshToneTypeLabel();
  if (typeof ELL_refreshToneTypeLabel === "function") ELL_refreshToneTypeLabel();
  if (typeof ELL_updFClearBtn === "function") ELL_updFClearBtn();
  if (typeof updSideButtons === "function") updSideButtons();
  if (typeof AWG_renderSelects === "function") AWG_renderSelects();
  // Sperren zuletzt:
  if (typeof tabLockApply === "function") tabLockApply();
  if (typeof depLockApply === "function") depLockApply();
}

// -----------------------------------------------------------------------
// applyData — ein Ladeweg: Phase 1 + Phase 2.
// -----------------------------------------------------------------------
function applyData(d) {
  applyState(d);
  refreshAll();
}
