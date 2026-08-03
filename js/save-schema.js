// BA536: Deklaratives Speicher-/Lade-Fundament.
// Paralleler Code — wird erst in BA537 an die Ladewege angeschlossen.
// Kein DOMContentLoaded-Closure (global sichtbar fuer file.js / init.js).

// -----------------------------------------------------------------------
// Feld-Tabelle GLOBAL
// -----------------------------------------------------------------------
var SAVE_SCHEMA_GLOBAL = [
  // --- Kern / Seite ---
  { key: "defaultMfr", scope: "global",
    get: function () { return defaultMfr; },
    set: function (v) { if (v && MFR[v]) defaultMfr = v; },
    default: "medel", valid: { type: "string" } },
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
  { key: "STB_results", scope: "global",
    get: function () { return (typeof STB_results !== "undefined" ? STB_results : {}); },
    set: function (v) { if (typeof STB_results !== "undefined" && v) { Object.keys(STB_results).forEach(function (k) { delete STB_results[k]; }); Object.assign(STB_results, v); } },
    default: function () { return {}; }, valid: { type: "object" } },
  { key: "STB_snapshot", scope: "global",
    get: function () { return (typeof STB_snapshot !== "undefined" ? STB_snapshot : null); },
    set: function (v) { if (typeof STB_snapshot !== "undefined") STB_snapshot = v || null; },
    default: null },

  // --- Latenz / Player-Anwendung ---
  { key: "LTZ_result", scope: "global",
    get: function () { return (typeof LTZ_result !== "undefined" ? LTZ_result : null); },
    set: function (v) { if (typeof LTZ_result !== "undefined") LTZ_result = v || null; },
    default: null },
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
    get: function () { return (typeof FRQ_resultsArray !== "undefined" ? FRQ_resultsArray : []); },
    set: function (v) { if (typeof FRQ_resultsArray !== "undefined") FRQ_resultsArray.splice(0, FRQ_resultsArray.length, ...(Array.isArray(v) ? v : [])); },
    default: function () { return []; }, valid: { type: "array" } },
  { key: "FRQ_pianoSession", scope: "global",
    get: function () { return (typeof FRQ_pianoSession !== "undefined" ? FRQ_pianoSession : null); },
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

  // --- Sequenzen ---
  { key: "sequence_freqmatch", scope: "global",
    get: function () { return sequence_freqmatch; },
    set: function (v) { sequence_freqmatch = v; },
    default: function () { return TEST_DEFAULTS.freqmatch.sequence; }, valid: { type: "enum", of: ["abab", "aba", "ab"] } },
  { key: "sequence_elektrodenlautstaerke", scope: "global",
    get: function () { return sequence_elektrodenlautstaerke; },
    set: function (v) { sequence_elektrodenlautstaerke = v; },
    default: function () { return TEST_DEFAULTS.elektrodenlautstaerke.sequence; }, valid: { type: "enum", of: ["abab", "aba", "ab"] } },
  { key: "sequence_stereobalance", scope: "global",
    get: function () { return sequence_stereobalance; },
    set: function (v) { sequence_stereobalance = v; },
    default: function () { return TEST_DEFAULTS.stereobalance.sequence; }, valid: { type: "enum", of: ["abab", "aba", "ab"] } },

  // --- Player-Quellen ---
  { key: "plSrcMeas", scope: "global",
    get: function () { return plSrcMeas; },
    set: function (v) { plSrcMeas = v; }, default: true, valid: { type: "bool" } },
  { key: "plSrcLevels", scope: "global",
    get: function () { return plSrcLevels; },
    set: function (v) { plSrcLevels = v; }, default: true, valid: { type: "bool" } },
  { key: "plSrcCurves", scope: "global",
    get: function () { return plSrcCurves; },
    set: function (v) { plSrcCurves = v; }, default: true, valid: { type: "bool" } },

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

  // --- Player-Checkboxen (DOM) ---
  { key: "plBothSides", scope: "global",
    get: function () { var e = document.getElementById("plBothSides"); return e ? e.checked : false; },
    set: function (v) { var e = document.getElementById("plBothSides"); if (e) e.checked = v; },
    default: false, valid: { type: "bool" } },
  { key: "plMonoEQ", scope: "global",
    get: function () { var e = document.getElementById("plMonoEQ"); return e ? e.checked : false; },
    set: function (v) { var e = document.getElementById("plMonoEQ"); if (e) e.checked = v; },
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

  // --- Tonarten ---
  { key: "toneType_freqmatch", scope: "global",
    get: function () { return toneType_freqmatch; },
    set: function (v) { toneType_freqmatch = v; },
    default: function () { return TEST_DEFAULTS.freqmatch.toneType; }, valid: { type: "fn", ok: function (v) { return isValidToneType(v); } } },
  { key: "toneType_elektrodenlautstaerke", scope: "global",
    get: function () { return toneType_elektrodenlautstaerke; },
    set: function (v) { toneType_elektrodenlautstaerke = v; },
    default: function () { return TEST_DEFAULTS.elektrodenlautstaerke.toneType; }, valid: { type: "fn", ok: function (v) { return isValidToneType(v); } } },
  { key: "toneType_stereobalance", scope: "global",
    get: function () { return toneType_stereobalance; },
    set: function (v) { toneType_stereobalance = v; },
    default: function () { return TEST_DEFAULTS.stereobalance.toneType; }, valid: { type: "fn", ok: function (v) { return isValidToneType(v); } } },
  { key: "toneType_implant", scope: "global",
    get: function () { return toneType_implant; },
    set: function (v) { toneType_implant = v; },
    default: function () { return TEST_DEFAULTS.implant.toneType; }, valid: { type: "fn", ok: function (v) { return isValidToneType(v); } } },

  // --- Volume / Dauer / Pause ---
  { key: "volume_global", scope: "global",
    get: function () { return volume_global; },
    set: function (v) { volume_global = v; },
    default: function () { return TEST_DEFAULTS.commonVolume; }, valid: { type: "number", min: 0, max: 100 } },
  { key: "duration_elektrodenlautstaerke", scope: "global",
    get: function () { return duration_elektrodenlautstaerke; },
    set: function (v) { duration_elektrodenlautstaerke = v; },
    default: function () { return TEST_DEFAULTS.elektrodenlautstaerke.duration; }, valid: { type: "number", min: 100, max: 3000 } },
  { key: "pause_elektrodenlautstaerke", scope: "global",
    get: function () { return pause_elektrodenlautstaerke; },
    set: function (v) { pause_elektrodenlautstaerke = v; },
    default: function () { return TEST_DEFAULTS.elektrodenlautstaerke.pause; }, valid: { type: "number", min: 50, max: 2000 } },
  { key: "duration_freqmatch", scope: "global",
    get: function () { return duration_freqmatch; },
    set: function (v) { duration_freqmatch = v; },
    default: function () { return TEST_DEFAULTS.freqmatch.duration; }, valid: { type: "number", min: 100, max: 3000 } },
  { key: "pause_freqmatch", scope: "global",
    get: function () { return pause_freqmatch; },
    set: function (v) { pause_freqmatch = v; },
    default: function () { return TEST_DEFAULTS.freqmatch.pause; }, valid: { type: "number", min: 50, max: 2000 } },
  { key: "duration_stereobalance", scope: "global",
    get: function () { return duration_stereobalance; },
    set: function (v) { duration_stereobalance = v; },
    default: function () { return TEST_DEFAULTS.stereobalance.duration; }, valid: { type: "number", min: 100, max: 3000 } },
  { key: "pause_stereobalance", scope: "global",
    get: function () { return pause_stereobalance; },
    set: function (v) { pause_stereobalance = v; },
    default: function () { return TEST_DEFAULTS.stereobalance.pause; }, valid: { type: "number", min: 50, max: 2000 } },
  { key: "duration_implant", scope: "global",
    get: function () { return duration_implant; },
    set: function (v) { duration_implant = v; },
    default: function () { return TEST_DEFAULTS.implant.duration; }, valid: { type: "number", min: 100, max: 3000 } },
  { key: "pause_implant", scope: "global",
    get: function () { return pause_implant; },
    set: function (v) { pause_implant = v; },
    default: function () { return TEST_DEFAULTS.implant.pause; }, valid: { type: "number", min: 50, max: 2000 } },

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
  { key: "pMaplawOn", scope: "global",
    get: function () { return (typeof pMaplawOn !== "undefined" ? pMaplawOn : false); },
    set: function (v) { if (typeof pMaplawOn !== "undefined") pMaplawOn = v; },
    default: false, valid: { type: "bool" } },
  { key: "pMaplawSollC", scope: "global",
    get: function () { return (typeof pMaplawSollC !== "undefined" ? pMaplawSollC : 1000); },
    set: function (v) { if (typeof pMaplawSollC !== "undefined") pMaplawSollC = v; },
    default: 1000, valid: { type: "number", min: 0, max: 100000 } },
  { key: "plShowExperimental", scope: "global",
    get: function () { return (typeof plShowExperimental !== "undefined" ? plShowExperimental : false); },
    set: function (v) { if (typeof plShowExperimental !== "undefined") plShowExperimental = v; },
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
];

// -----------------------------------------------------------------------
// Feld-Tabelle SEITENWEISE
// -----------------------------------------------------------------------
// config und manufacturer zuerst (manufacturer setzt nEl).
var SAVE_SCHEMA_SIDE = [
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

  { key: "FRQ_implantat", scope: "side",
    get: function (s) { return sideData[s].FRQ_implantat; },
    set: function (v, s) {
      var mfr = sideData[s].manufacturer;
      sideData[s].FRQ_implantat = Array.isArray(v) ? v : (MFR[mfr] ? [...MFR[mfr].FRQ_implantat] : []);
    },
    default: function () { return []; }, valid: { type: "array" } },
  { key: "FRQ_implantatOwn", scope: "side",
    get: function (s) { return sideData[s].FRQ_implantatOwn; },
    set: function (v, s) {
      if (Array.isArray(v)) {
        sideData[s].FRQ_implantatOwn = [...v];
      } else {
        var mfr = sideData[s].manufacturer;
        var defF = MFR[mfr] ? MFR[mfr].FRQ_implantat : [];
        sideData[s].FRQ_implantatOwn = sideData[s].FRQ_implantat.map(function (f, i) {
          return Math.round(f) === Math.round(defF[i]) ? null : f;
        });
      }
    },
    default: null },
  { key: "elSt", scope: "side",
    get: function (s) { return sideData[s].elSt; },
    set: function (v, s) {
      sideData[s].elSt = Array.isArray(v) ? v : new Array(sideData[s].nEl).fill(null);
    },
    default: function () { return []; }, valid: { type: "array" } },
  { key: "elNt", scope: "side",
    get: function (s) { return sideData[s].elNt; },
    set: function (v, s) {
      sideData[s].elNt = Array.isArray(v) ? v : new Array(sideData[s].nEl).fill("");
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
  { key: "ELL_results", scope: "side",
    get: function (s) { return sideData[s].ELL_results; },
    set: function (v, s) { sideData[s].ELL_results = Array.isArray(v) ? v : []; },
    default: function () { return []; }, valid: { type: "array" } },
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
            type: tp, on: false, strength: 0, center: CENT_REF_HZ, width: 1200,
            phon: 70,
            cutoff: tp === "bassboost" ? Math.floor(nEl / 3) : Math.floor((nEl * 2) / 3),
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
];

// Band-Wahlen (24) datengetrieben aus FRQ_BAND_WAHLEN (key === fileKey).
FRQ_BAND_WAHLEN.forEach(function (w) {
  SAVE_SCHEMA_SIDE.push({
    key: w.key, scope: "side",
    get: function (s) { return sideData[s][w.key]; },
    set: function (v, s) { sideData[s][w.key] = (typeof v === "string") ? v : w.def; },
    default: w.def, valid: { type: "string" },
  });
});

// -----------------------------------------------------------------------
// Zusammenfuehrung
// -----------------------------------------------------------------------
var SAVE_SCHEMA = SAVE_SCHEMA_GLOBAL.concat(SAVE_SCHEMA_SIDE);

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
// buildState / applyState (Phase 1)
// -----------------------------------------------------------------------
function buildState() {
  var d = {
    app: "CImbel",
    version: APP_VERSION,
    presetFormat: "freq-v3",
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
  if (typeof _frqBandSpiegle === "function") _frqBandSpiegle();          // VOR renderResults
  if (typeof window._frqGlaettUpdate === "function") window._frqGlaettUpdate();
  // Aufbau / Tabellen:
  if (typeof bindActiveSide === "function") bindActiveSide();
  if (typeof FRQ_implantatTableBuild === "function") FRQ_implantatTableBuild();
  if (typeof buildImplantCard === "function") buildImplantCard();
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
  // pApplyShowExperimental, plUpdMonoBox, plUpdHeadroomBox u.a.).
  if (typeof plSyncUI === "function") plSyncUI();
  if (typeof LTZ_applyToPlayer === "function") LTZ_applyToPlayer();
  if (typeof LTZ_renderResults === "function") LTZ_renderResults();
  if (typeof STB_renderResults === "function") STB_renderResults();
  if (typeof STB_renderMean === "function") STB_renderMean();
  // MAPLAW / Warp:
  if (typeof pMaplawTrigger === "function") pMaplawTrigger();
  if (typeof _pWarpCalcModeApply === "function") _pWarpCalcModeApply();
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
  if (typeof FRQ_refreshToneTypeLabel === "function") FRQ_refreshToneTypeLabel();
  if (typeof ELL_refreshToneTypeLabel === "function") ELL_refreshToneTypeLabel();
  if (typeof ELL_updFClearBtn === "function") ELL_updFClearBtn();
  if (typeof updSideButtons === "function") updSideButtons();
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
