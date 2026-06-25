// ============================================================
// FILE OPERATIONS
// ============================================================

// ---------- BA 268: zentrale Dateiname-Helfer ----------
//
// Schema:
//   CImbel_<Nachname-Vorname>_<Zusatz>_<Typ?>_<Extra?>_<JJ-MM-TT_HH-MM>.<ext>
//
// Leere Blöcke werden komplett weggelassen (keine doppelten Unterstriche).
// Umlaute werden im Dateinamen transliteriert (ä->ae usw.); übrig
// bleibende Akzente per Unicode-Zerlegung entfernt.

function _fnTransliterate(s) {
  const map = {
    "ä": "ae", "ö": "oe", "ü": "ue",
    "Ä": "Ae", "Ö": "Oe", "Ü": "Ue",
    "ß": "ss"
  };
  let out = String(s || "").replace(/[äöüÄÖÜß]/g,
                                    function (ch) { return map[ch]; });
  // NFKD-Zerlegung: Akzente trennen, dann Combining-Marks entfernen.
  out = out.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return out;
}

function _fnSafeFileChars(s) {
  // Pfad-/Wildcard-/Steuerzeichen durch "_".
  return String(s || "").replace(/[\s\/\\:*?"<>|\x00-\x1F]/g, "_");
}

function _fnSafeNamePart(s) {
  return _fnSafeFileChars(_fnTransliterate(String(s || "").trim()));
}

function _safeUserFileSuffix() {
  if (typeof userFileSuffix !== "string") return "";
  const s = userFileSuffix.trim();
  if (!s) return "";
  return s.replace(/[\s\/\\:*?"<>|\x00-\x1F]/g, "_");
}

function _fnBuildNameBlock() {
  const ln = _fnSafeNamePart(typeof userLastName  === "string" ? userLastName  : "");
  const fn = _fnSafeNamePart(typeof userFirstName === "string" ? userFirstName : "");
  if (ln && fn) return ln + "-" + fn;
  if (ln) return ln;
  if (fn) return fn;
  return "";
}

function _fnDateStampShort() {
  const now = new Date();
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return yy + "-" + mm + "-" + dd + "_" + hh + "-" + mi;
}

// typeTag, extraTag: jeweils optional (null/"" = weglassen).
// ext: ".json" oder ".md" inkl. Punkt.
function buildCImbelFilename(typeTag, extraTag, ext) {
  const parts = ["CImbel"];
  const nameBlock = _fnBuildNameBlock();
  if (nameBlock) parts.push(nameBlock);
  const suf = _safeUserFileSuffix();
  if (suf) parts.push(suf);
  if (typeTag)  parts.push(typeTag);
  if (extraTag) parts.push(extraTag);
  parts.push(_fnDateStampShort());
  return parts.join("_") + ext;
}

// ---------- BA 268.1: Druck-Seitentitel (kompakt für PDF-Dateinamen) ----------
//
// Format: "<Basis> Nachname Vorname Zusatz JJ-MM-TT HH-MM"
// Trenner: einfaches Leerzeichen, damit das vom Browser als PDF-Dateiname
// vorgeschlagene Ergebnis kurz und ohne Sonderzeichen bleibt. Doppelpunkt
// wird durch Bindestrich ersetzt (sonst macht der Browser daraus "_").
// Leere Blöcke fallen weg. Original-Schreibweise (Umlaute) bleibt erhalten.

function buildCImbelPrintTitle(baseTitle) {
  const parts = [String(baseTitle || "")];
  const ln = (typeof userLastName  === "string" ? userLastName  : "").trim();
  const fn = (typeof userFirstName === "string" ? userFirstName : "").trim();
  let nameBlock = "";
  if (ln && fn) nameBlock = ln + " " + fn;
  else if (ln) nameBlock = ln;
  else if (fn) nameBlock = fn;
  if (nameBlock) parts.push(nameBlock);
  const suf = (typeof userFileSuffix === "string" ? userFileSuffix : "").trim();
  if (suf) parts.push(suf);
  const now = new Date();
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  parts.push(yy + "-" + mm + "-" + dd + " " + hh + "-" + mi);
  return parts.join(" ");
}

function resetAll() {
  const ch = confirm(t("resetConfirm"));
  if (!ch) return;
  // --- Mess-/Patientendaten pro Seite zurück ---
  for (const s of SIDES) {
    sideData[s].config = "unknown";
    sideData[s].manufacturer = "unknown";
    sideData[s].nEl = MFR["unknown"].n;
    sideData[s].FRQ_implantat = [...MFR["unknown"].FRQ_implantat];
    sideData[s].elSt = new Array(sideData[s].nEl).fill(null);
    sideData[s].elNt = new Array(sideData[s].nEl).fill("");
    sideData[s].elExDur = new Array(sideData[s].nEl).fill(null);
    sideData[s].FRQ_implantatOwn = new Array(sideData[s].nEl).fill(null);
    sideData[s].elektrodenlautstaerkeSchieber = new Array(sideData[s].nEl).fill(0);
    sideData[s].refEl = Math.floor(sideData[s].nEl / 2);
    sideData[s].elektrodenlautstaerkeResults = [];
    sideData[s].elektrodenlautstaerkeKurven = [];
    initSideData(s, "unknown");
  }
  defaultMfr = "unknown";
  // --- Notiz an Audiologen ---
  if (typeof audiologUserNote !== "undefined") {
    audiologUserNote = "";
    const aNoteEl = document.getElementById("audiologNoteInput");
    if (aNoteEl) aNoteEl.value = "";
  }
  // --- Aktive Seite + Hersteller-Dropdowns ---
  activeSide = "left";
  bindActiveSide();
  document.getElementById("ciSideSelect").value = "left";
  document.getElementById("mfrSelect").value = "unknown";
  const cfgSelR = document.getElementById("cfgSelect");
  if (cfgSelR) cfgSelR.value = "unknown";
  const dfSelR = document.getElementById("defaultMfrSelect");
  if (dfSelR) dfSelR.value = "unknown";
  // --- Globale Test-Parameter ---
  // BA 254: Tonfolge pro Test
  if (typeof sequence_freqmatch !== "undefined") sequence_freqmatch = TEST_DEFAULTS.freqmatch.sequence;
  if (typeof FRQ_activeMethodValue !== "undefined") FRQ_activeMethodValue = null;
  if (typeof sequence_elektrodenlautstaerke      !== "undefined") sequence_elektrodenlautstaerke      = TEST_DEFAULTS.elektrodenlautstaerke.sequence;
  if (typeof sequence_stereobalance   !== "undefined") sequence_stereobalance   = TEST_DEFAULTS.stereobalance.sequence;
  // BA 246
  if (typeof toneType_elektrodenlautstaerke !== "undefined") toneType_elektrodenlautstaerke = TEST_DEFAULTS.elektrodenlautstaerke.toneType;
  if (typeof volume_global !== "undefined") volume_global = TEST_DEFAULTS.commonVolume;
  if (typeof duration_elektrodenlautstaerke !== "undefined") duration_elektrodenlautstaerke = TEST_DEFAULTS.elektrodenlautstaerke.duration;
  if (typeof pause_elektrodenlautstaerke    !== "undefined") pause_elektrodenlautstaerke    = TEST_DEFAULTS.elektrodenlautstaerke.pause;
  if (typeof toneType_stereobalance !== "undefined") toneType_stereobalance = TEST_DEFAULTS.stereobalance.toneType;
  if (typeof duration_stereobalance !== "undefined") duration_stereobalance = TEST_DEFAULTS.stereobalance.duration;
  if (typeof pause_stereobalance    !== "undefined") pause_stereobalance    = TEST_DEFAULTS.stereobalance.pause;
  if (typeof toneType_freqmatch !== "undefined") toneType_freqmatch = TEST_DEFAULTS.freqmatch.toneType;
  if (typeof duration_freqmatch !== "undefined") duration_freqmatch = TEST_DEFAULTS.freqmatch.duration;
  if (typeof pause_freqmatch    !== "undefined") pause_freqmatch    = TEST_DEFAULTS.freqmatch.pause;
  if (typeof toneType_implant !== "undefined") toneType_implant = TEST_DEFAULTS.implant.toneType;
  if (typeof duration_implant !== "undefined") duration_implant = TEST_DEFAULTS.implant.duration;
  if (typeof pause_implant    !== "undefined") pause_implant    = TEST_DEFAULTS.implant.pause;
  // --- Latenz ---
  if (typeof LTZ_result !== "undefined") LTZ_result = null;
  if (typeof plApplyLatency !== "undefined") plApplyLatency = true;
  if (typeof LTZ_applyToPlayer === "function") LTZ_applyToPlayer();
  if (typeof LTZ_renderResults === "function") LTZ_renderResults();
  if (typeof LTZ_sliderInput === "function") LTZ_sliderInput(0);
  // --- LR-Balance ---
  if (typeof stereobalanceResults !== "undefined") {
    Object.keys(stereobalanceResults).forEach(k => delete stereobalanceResults[k]);
    if (typeof stereobalanceResetSequence === "function") stereobalanceResetSequence();
    if (typeof stereobalanceSnapshot !== "undefined") stereobalanceSnapshot = null;
    if (typeof stereobalanceRenderResults === "function") stereobalanceRenderResults();
    if (typeof stereobalanceApplyMeanToBalance === "function") stereobalanceApplyMeanToBalance();
  }
  if (typeof plApplyBalance !== "undefined") plApplyBalance = true;
  if (typeof plBalanceMode !== "undefined") plBalanceMode = "sym";
  if (typeof updBalApplyBtn === "function") updBalApplyBtn();
  // --- Frequenzabgleich-Ergebnisse ---
  if (typeof FRQ_resultsArray !== "undefined") FRQ_resultsArray.splice(0, FRQ_resultsArray.length);
  if (typeof freqmatchTestSelection !== "undefined") freqmatchTestSelection = null;
  if (typeof FRQ_renderResults === "function") FRQ_renderResults();
  // BA 161: FreqMatch-Tab-UI nach Reset auffrischen
  if (typeof FRQ_refreshResumeHint === "function") FRQ_refreshResumeHint();
  if (typeof _FRQ_refreshTabState === "function") _FRQ_refreshTabState();
  if (typeof FRQ_applyLang === "function") FRQ_applyLang();
  // --- Player-Quellen-Knöpfe ---
  if (typeof plSrcMeas !== "undefined") {
    plSrcMeas = true; plSrcLevels = true; plSrcCurves = true;
  }
  if (typeof updPlSrcButtons === "function") updPlSrcButtons();
  // --- Player „beide Seiten" + Mono-EQ ---
  const _plBoth = document.getElementById("plBothSides");
  if (_plBoth) _plBoth.checked = false;
  const _plMono = document.getElementById("plMonoEQ");
  if (_plMono) _plMono.checked = false;
  if (typeof plUpdMonoBox === "function") plUpdMonoBox();
  // --- EQ-Knopf + Stärke ---
  if (typeof plEqOn !== "undefined") plEqOn = false;
  if (typeof updEqToggleBtn === "function") updEqToggleBtn();
  if (typeof plEqHeadroom !== "undefined") plEqHeadroom = true;
  if (typeof plEqHeadroomBoth !== "undefined") plEqHeadroomBoth = true;
  if (typeof plUpdHeadroomBox === "function") plUpdHeadroomBox();
  // --- Warp-Block ---
  if (typeof pWarpOn !== "undefined") {
    pWarpOn = false;
    pWarpMode = "right";
    const _wmd = document.getElementById("plWarpModeSelect");
    if (_wmd) _wmd.value = pWarpMode;
    if (typeof _pPlayerWarpDefaultApplied !== "undefined") {
      _pPlayerWarpDefaultApplied = false;
    }
    if (typeof pWarpUpdUI === "function") pWarpUpdUI();
  }
  // --- MAPLAW-Knopf ---
  if (typeof pMaplawOn !== "undefined") pMaplawOn = false;
  if (typeof pMaplawSollC !== "undefined") pMaplawSollC = 1000;
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
  if (typeof pMaplawTrigger === "function") pMaplawTrigger();
  // --- Player-Experimental ---
  if (typeof plShowExperimental !== "undefined") plShowExperimental = false;
  if (typeof pApplyShowExperimental === "function") pApplyShowExperimental();
  // BA323: Player-Box ist zustandslos — keine Reset-Zuweisungen mehr nötig.
  // --- Sprecher-Auswahl im Player ---
  const _spk = document.getElementById("plSentSpeaker");
  if (_spk) _spk.value = "";
  // --- Schieber-Tab-Modus und -Variante ---
  if (typeof elektrodenlautstaerkeSchieberMode !== "undefined") elektrodenlautstaerkeSchieberMode = "rel";
  if (typeof elektrodenlautstaerkeSchieberVariant !== "undefined") elektrodenlautstaerkeSchieberVariant = "stack";
  if (typeof elektrodenlautstaerkeSchieberShowMeas !== "undefined") elektrodenlautstaerkeSchieberShowMeas = false;
  if (typeof elektrodenlautstaerkeSchieberShowCurves !== "undefined") elektrodenlautstaerkeSchieberShowCurves = false;
  const _lvModeRel = document.getElementById("schieberModeRel");
  if (_lvModeRel) _lvModeRel.checked = true;
  const _lvVarStack = document.getElementById("schieberVarStack");
  if (_lvVarStack) _lvVarStack.checked = true;
  const _lvChkMeas = document.getElementById("schieberChkMeas");
  if (_lvChkMeas) _lvChkMeas.checked = false;
  const _lvChkCurves = document.getElementById("schieberChkCurves");
  if (_lvChkCurves) _lvChkCurves.checked = false;
  if (typeof elektrodenlautstaerkeSchieberUpdateModeAvailability === "function") elektrodenlautstaerkeSchieberUpdateModeAvailability();
  // --- „Schieber für beide Seiten gleich"-Checkbox ---
  const _prBoth = document.getElementById("kurvenBothSides");
  if (_prBoth) _prBoth.checked = true;
  // --- UI-Refresh ---
  FRQ_implantatTableBuild();
  elektrodenlautstaerkeKurvenTabelleBauen();
  elektrodenlautstaerkeKurvenChartZeichnen();
  renderResults();
  if (typeof buildImplantCard === "function") buildImplantCard();
  if (typeof elektrodenlautstaerkeSchieberRebuild === "function") elektrodenlautstaerkeSchieberRebuild();
  if (typeof updSideButtons === "function") updSideButtons();
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  // BA 161: Direkt persistieren, damit ein F5 sofort danach NICHT
  // den alten Stand zurückbringt. Nicht auf den 5-s-Tick warten.
  if (typeof window._autoSaveState === "function") window._autoSaveState();
  alert(t("resetDone"));
}

async function saveJson() {
  const d = {
    app: "CImbel",
    version: APP_VERSION,
    presetFormat: "freq-v3",
    date: new Date().toLocaleString(
      lang === "de"
        ? "de-DE"
        : lang === "fr"
          ? "fr-FR"
          : lang === "es"
            ? "es-ES"
            : "en-US",
    ),
    defaultMfr: defaultMfr,
    sides: {
      left: {
        config: sideData.left.config || "ci",
        manufacturer: sideData.left.manufacturer,
        frequencies: sideData.left.FRQ_implantat,
        electrodeFreqOwn: sideData.left.FRQ_implantatOwn,
        electrodeStatus: sideData.left.elSt,
        electrodeActive: sideData.left.elActive,
        electrodeNotes: sideData.left.elNt,
        electrodeExcludedDuring: sideData.left.elExDur,
        referenceElectrode: sideData.left.refEl,
        balanceResults: sideData.left.elektrodenlautstaerkeResults,
        fmMode: sideData.left.fmMode || 'adaptive',
        fmAdaptiveDur: sideData.left.fmAdaptiveDur != null ? sideData.left.fmAdaptiveDur : 200,
        fmAdaptivePau: sideData.left.fmAdaptivePau != null ? sideData.left.fmAdaptivePau : 200,
        manualLevels: sideData.left.elektrodenlautstaerkeSchieber,
        presets: sideData.left.elektrodenlautstaerkeKurven,
        fullSweepRound: sideData.left.fullSweepRound,
        fullSweepDonePairs: sideData.left.fullSweepDonePairs,
        implant: sideData.left.implant,
        freqmatchAdaptive: sideData.left.freqmatchAdaptive || null,
        freqmatchPiano: sideData.left.freqmatchPiano || null,
      },
      right: {
        config: sideData.right.config || "ci",
        manufacturer: sideData.right.manufacturer,
        frequencies: sideData.right.FRQ_implantat,
        electrodeFreqOwn: sideData.right.FRQ_implantatOwn,
        electrodeStatus: sideData.right.elSt,
        electrodeActive: sideData.right.elActive,
        electrodeNotes: sideData.right.elNt,
        electrodeExcludedDuring: sideData.right.elExDur,
        referenceElectrode: sideData.right.refEl,
        balanceResults: sideData.right.elektrodenlautstaerkeResults,
        fmMode: sideData.right.fmMode || 'adaptive',
        fmAdaptiveDur: sideData.right.fmAdaptiveDur != null ? sideData.right.fmAdaptiveDur : 200,
        fmAdaptivePau: sideData.right.fmAdaptivePau != null ? sideData.right.fmAdaptivePau : 200,
        manualLevels: sideData.right.elektrodenlautstaerkeSchieber,
        presets: sideData.right.elektrodenlautstaerkeKurven,
        fullSweepRound: sideData.right.fullSweepRound,
        fullSweepDonePairs: sideData.right.fullSweepDonePairs,
        implant: sideData.right.implant,
        freqmatchAdaptive: sideData.right.freqmatchAdaptive || null,
        freqmatchPiano: sideData.right.freqmatchPiano || null,
      },
    },
    currentSide: activeSide,
    lrResults: (typeof stereobalanceResults !== "undefined") ? stereobalanceResults : {},
    stereobalanceSnapshot: (typeof stereobalanceSnapshot !== "undefined") ? stereobalanceSnapshot : null, // BA 156
    latencyResult: (typeof LTZ_result !== "undefined") ? LTZ_result : null,
    plApplyLatency: (typeof plApplyLatency !== "undefined") ? plApplyLatency : true,
    plApplyBalance: (typeof plApplyBalance !== "undefined") ? plApplyBalance : true,
    plBalanceMode: (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym",
    fRes: (typeof FRQ_resultsArray !== "undefined") ? FRQ_resultsArray : [],
    freqmatchTestSelection: (typeof freqmatchTestSelection !== "undefined")
      ? freqmatchTestSelection : null,
    sequence_freqmatch: (typeof sequence_freqmatch !== "undefined") ? sequence_freqmatch : TEST_DEFAULTS.freqmatch.sequence,
    fmActiveMethod: (typeof FRQ_activeMethodValue !== "undefined") ? FRQ_activeMethodValue : null,
    sequence_test:      (typeof sequence_elektrodenlautstaerke      !== "undefined") ? sequence_elektrodenlautstaerke      : TEST_DEFAULTS.elektrodenlautstaerke.sequence,
    sequence_balance:   (typeof sequence_stereobalance   !== "undefined") ? sequence_stereobalance   : TEST_DEFAULTS.stereobalance.sequence,
    playerSourceMeas: plSrcMeas,
    playerSourceLevels: plSrcLevels,
    playerSourceCurves: plSrcCurves,
    levelsTabShowMeas: elektrodenlautstaerkeSchieberShowMeas,
    levelsTabShowCurves: elektrodenlautstaerkeSchieberShowCurves,
    levelsTabMode: elektrodenlautstaerkeSchieberMode,
    levelsTabVariant: elektrodenlautstaerkeSchieberVariant,
    plSide: getPlayerSide(),
    plBothSides: document.getElementById("plBothSides").checked,
    plMonoEQ: document.getElementById("plMonoEQ").checked,
    eqOn: plEqOn,
    eqHeadroom: (typeof plEqHeadroom !== "undefined") ? plEqHeadroom : true,
    eqHeadroomBoth: (typeof plEqHeadroomBoth !== "undefined") ? plEqHeadroomBoth : true,
    toneType_freqmatch: (typeof toneType_freqmatch !== "undefined")
      ? toneType_freqmatch : TEST_DEFAULTS.freqmatch.toneType,
    // BA 246
    toneType_test: (typeof toneType_elektrodenlautstaerke !== "undefined")
      ? toneType_elektrodenlautstaerke : TEST_DEFAULTS.elektrodenlautstaerke.toneType,
    // BA 287: gemeinsame Lautstaerke.
    volume_global: (typeof volume_global !== "undefined") ? volume_global : TEST_DEFAULTS.commonVolume,
    duration_test: (typeof duration_elektrodenlautstaerke !== "undefined") ? duration_elektrodenlautstaerke : TEST_DEFAULTS.elektrodenlautstaerke.duration,
    pause_test:    (typeof pause_elektrodenlautstaerke    !== "undefined") ? pause_elektrodenlautstaerke    : TEST_DEFAULTS.elektrodenlautstaerke.pause,
    // BA 240: Dur/Pau-State des Frequenzabgleichs persistieren.
    duration_freqmatch: (typeof duration_freqmatch !== "undefined") ? duration_freqmatch : TEST_DEFAULTS.freqmatch.duration,
    pause_freqmatch:    (typeof pause_freqmatch    !== "undefined") ? pause_freqmatch    : TEST_DEFAULTS.freqmatch.pause,
    // BA 253: Dur/Pau/ToneType fuer Stereo-Balance persistieren.
    toneType_balance: (typeof toneType_stereobalance !== "undefined")
      ? toneType_stereobalance : TEST_DEFAULTS.stereobalance.toneType,
    duration_balance: (typeof duration_stereobalance !== "undefined") ? duration_stereobalance : TEST_DEFAULTS.stereobalance.duration,
    pause_balance:    (typeof pause_stereobalance    !== "undefined") ? pause_stereobalance    : TEST_DEFAULTS.stereobalance.pause,
    toneType_implant:   (typeof toneType_implant !== "undefined") ? toneType_implant : TEST_DEFAULTS.implant.toneType,
    duration_implant:   (typeof duration_implant !== "undefined") ? duration_implant : TEST_DEFAULTS.implant.duration,
    pause_implant:      (typeof pause_implant    !== "undefined") ? pause_implant    : TEST_DEFAULTS.implant.pause,
    warpOn: (typeof pWarpOn !== "undefined") ? pWarpOn : false,
    warpMode: (typeof pWarpMode !== "undefined") ? pWarpMode : "right",
    playerWarpMode: (typeof pWarpCalcMode !== "undefined") ? pWarpCalcMode : "fast",

    plMaplawOn: (typeof pMaplawOn !== "undefined") ? pMaplawOn : false,
    plMaplawSollC: (typeof pMaplawSollC !== "undefined") ? pMaplawSollC : 1000,
    playerShowExperimental: (typeof plShowExperimental !== "undefined") ? plShowExperimental : false,
    // BA323: Player-Box-Felder (plActiveSource, plLoop, plShuffle, plNoise*, plSent*,
    // plBook*, plMusic*, localCollections) werden nicht mehr gespeichert — Box ist zustandslos.
    // BA336: Inhalts-Sprache — einzige persistente Box-Einstellung.
    playerContentLang: (typeof plContentLang !== "undefined") ? plContentLang : "de",
    // BA366.1: Hoerbuch-Positionen (max. 30 neueste Eintraege nach Key-Reihenfolge).
    plBookPositions: (function () {
      const pos = (typeof plBookPositions !== "undefined" && plBookPositions) ? plBookPositions : {};
      const keys = Object.keys(pos);
      if (keys.length <= 30) return pos;
      const kept = {};
      keys.slice(keys.length - 30).forEach(function (k) { kept[k] = pos[k]; });
      return kept;
    }()),
    userFileSuffix: (typeof userFileSuffix === "string") ? userFileSuffix : "",
    userLastName:   (typeof userLastName   === "string") ? userLastName   : "",
    userFirstName:  (typeof userFirstName  === "string") ? userFirstName  : "",
    audiologUserNote: (typeof audiologUserNote !== "undefined") ? audiologUserNote : "",
  };
  const blob = new Blob([JSON.stringify(d, null, 2)], {
    type: "application/json",
  });
  const fn = buildCImbelFilename(null, null, ".cimbel");
  if (window.showSaveFilePicker) {
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: fn,
        types: [
          {
            description: "CImbel",
            accept: { "application/json": [".cimbel"] },
          },
        ],
      });
      const w = await h.createWritable();
      await w.write(blob);
      await w.close();
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fn;
  a.click();
}


// BA 352: Erkennt einen gueltigen CImbel-Speicherstand. Neue Dateien
// tragen das Kennzeichen app:"CImbel"; bestehende .json-Staende haben
// (noch) keins, werden aber am Zweiseiten-Block erkannt.
function _isCimbelSave(d) {
  if (!d || typeof d !== "object") return false;
  if (d.app === "CImbel") return true;
  if (d.sides && d.sides.left && d.sides.right) return true;
  return false;
}

// BA 352: grobe Heuristik fuer EasyEffects-Konfigurationsdateien
// (oberste Ebene output/input als Objekt, keine CImbel-Merkmale).
function _looksLikeEasyEffects(d) {
  if (!d || typeof d !== "object") return false;
  return (
    (d.output && typeof d.output === "object") ||
    (d.input && typeof d.input === "object")
  );
}

function loadJson(file) {
  const r = new FileReader();
  r.onload = (e) => {
    try {
      const d = JSON.parse(e.target.result);

      if (_isCimbelSave(d)) {
        loadSideData("left", d.sides.left);
        loadSideData("right", d.sides.right);
        activeSide = SIDES.includes(d.currentSide) ? d.currentSide : "left";
        applyLoadedData(d);
        // BA 149
        if (typeof depLockApply === 'function') depLockApply();
      } else {
        // BA 352: keine gueltige CImbel-Datei -> abweisen, nicht laden.
        let msg = t("loadNotCimbel");
        if (_looksLikeEasyEffects(d)) {
          msg += " " + t("loadEasyeffectsHint");
        }
        alert(msg);
        document.getElementById("fInput").value = "";
      }
    } catch (err) {
      console.error("Fehler:", err);
      alert("Fehler beim Laden: " + err.message);
    }
  };
  r.readAsText(file);
}

function _migratePresetsFromIndexToFreq(rawPresets, fileFreqs, fileElFreqOwn) {
  const effF = (i) =>
    fileElFreqOwn && fileElFreqOwn[i] != null ? fileElFreqOwn[i] : fileFreqs[i];
  const meanStep = meanCentStepOfFreqs(fileFreqs.map((_, i) => effF(i)));
  return rawPresets.map((pr) => {
    const np = { ...pr };
    if (!np.strength) {
      np.center = CENT_REF_HZ;
      np.width = 1200;
    } else {
      if (np.center != null) {
        const idx = np.center;
        const lo = Math.max(0, Math.min(fileFreqs.length - 1, Math.floor(idx)));
        const hi = Math.max(0, Math.min(fileFreqs.length - 1, Math.ceil(idx)));
        const t = idx - lo;
        const f = lo === hi ? effF(lo) : logInterpHz(effF(lo), effF(hi), t);
        np.center = +f.toFixed(1);
      } else {
        np.center = CENT_REF_HZ;
      }
      if (np.width != null) {
        const newW = np.width * meanStep;
        np.width = Math.max(50, Math.min(4800, Math.round(newW)));
      } else {
        np.width = 1200;
      }
    }
    return np;
  });
}

function applyLoadedData(d) {
  // defaultMfr laden
  if (d.defaultMfr && MFR[d.defaultMfr]) defaultMfr = d.defaultMfr;

  // Preset-Migration für neue Dateien im alten Index-Format
  if (d.sides && d.presetFormat !== "freq-v3") {
    for (const side of SIDES) {
      const s = sideData[side];
      if (s.elektrodenlautstaerkeKurven && Array.isArray(s.elektrodenlautstaerkeKurven)) {
        s.elektrodenlautstaerkeKurven = _migratePresetsFromIndexToFreq(
          s.elektrodenlautstaerkeKurven,
          [...s.FRQ_implantat],
          s.FRQ_implantatOwn,
        );
        s._presetsMigrated = true;
      }
    }
  }

  bindActiveSide();
  const gEl = (id) => document.getElementById(id);
  const setVal = (id, v) => {
    const e = gEl(id);
    if (e) e.value = v;
  };
  setVal("ciSideSelect", activeSide);
  setVal("mfrSelect", mfr);
  // cfgSelect für aktive Seite setzen
  const cfgSel = gEl("cfgSelect");
  if (cfgSel) cfgSel.value = sideData[activeSide].config || "ci";
  // defaultMfrSelect setzen
  const dfSel = gEl("defaultMfrSelect");
  if (dfSel) dfSel.value = defaultMfr;
  // BA 254: Tonfolge pro Test — Migration aus altem globalSequence-Feld.
  function _validSeq(s) { return (s === "aba" || s === "ab") ? s : null; }
  var _legacySeq = _validSeq(d.globalSequence)
                || _validSeq(d.paradigm)
                || TEST_DEFAULTS.elektrodenlautstaerke.sequence;
  if (typeof sequence_freqmatch !== "undefined") {
    sequence_freqmatch = _validSeq(d.sequence_freqmatch) || _legacySeq;
  }
  if (typeof FRQ_activeMethodValue !== "undefined") {
    // BA363 Klavier-only: aktives Verfahren beim Laden hart auf piano.
    // Gespeicherter Wert (adaptive/slider) wird verworfen; Messdaten bleiben.
    FRQ_activeMethodValue = "piano";
  }
  if (typeof sequence_elektrodenlautstaerke !== "undefined") {
    sequence_elektrodenlautstaerke = _validSeq(d.sequence_test) || _legacySeq;
  }
  if (typeof sequence_stereobalance !== "undefined") {
    sequence_stereobalance = _validSeq(d.sequence_balance) || _legacySeq;
  }
  if (typeof d.plBothSides === "boolean") {
    const bsEl = document.getElementById("plBothSides");
    if (bsEl) bsEl.checked = d.plBothSides;
  }
  if (typeof d.plMonoEQ === "boolean") {
    const mmEl = document.getElementById("plMonoEQ");
    if (mmEl) mmEl.checked = d.plMonoEQ;
  }
  if (typeof plUpdMonoBox === "function") plUpdMonoBox();
  if (d.eqOn !== undefined) {
    plEqOn = d.eqOn;
    updEqToggleBtn();
  }
  if (typeof plEqHeadroom !== "undefined") {
    plEqHeadroom = (typeof d.eqHeadroom === "boolean") ? d.eqHeadroom : true;
    if (typeof plUpdHeadroomBox === "function") plUpdHeadroomBox();
  }
  if (typeof plEqHeadroomBoth !== "undefined") {
    plEqHeadroomBoth = (typeof d.eqHeadroomBoth === "boolean") ? d.eqHeadroomBoth : true;
    if (typeof plUpdHeadroomBox === "function") plUpdHeadroomBox();
    if (typeof updBalApplyBtn === "function") updBalApplyBtn();
  }
  // BA 209: Per-Test-Tonart Frequenzabgleich.
  // Migration aus altem globalToneType-Feld (nur lesen, nicht mehr schreiben).
  if (typeof toneType_freqmatch !== "undefined") {
    if (isValidToneType(d.toneType_freqmatch)) {
      toneType_freqmatch = d.toneType_freqmatch;
    } else if (isValidToneType(d.globalToneType)) {
      toneType_freqmatch = d.globalToneType;
    } else {
      toneType_freqmatch = TEST_DEFAULTS.freqmatch.toneType;
    }
  }
  // BA 246
  if (typeof toneType_elektrodenlautstaerke !== "undefined") {
    if (isValidToneType(d.toneType_test)) {
      toneType_elektrodenlautstaerke = d.toneType_test;
    } else if (isValidToneType(d.globalToneType)) {
      toneType_elektrodenlautstaerke = d.globalToneType;
    } else {
      toneType_elektrodenlautstaerke = TEST_DEFAULTS.elektrodenlautstaerke.toneType;
    }
  }
  // BA 287: gemeinsame Lautstaerke laden. Abwaertskompat: altes Profil
  // ohne volume_global -> frueheren volume_test-Wert uebernehmen.
  if (typeof volume_global !== "undefined") {
    var _vg = parseInt(d.volume_global, 10);
    if (!(isFinite(_vg) && _vg >= 0 && _vg <= 100)) {
      _vg = parseInt(d.volume_test, 10);
    }
    volume_global = (isFinite(_vg) && _vg >= 0 && _vg <= 100) ? _vg : TEST_DEFAULTS.commonVolume;
  }
  if (typeof duration_elektrodenlautstaerke !== "undefined") {
    var _du = parseInt(d.duration_test, 10);
    duration_elektrodenlautstaerke = (isFinite(_du) && _du >= 100 && _du <= 3000) ? _du : TEST_DEFAULTS.elektrodenlautstaerke.duration;
  }
  if (typeof pause_elektrodenlautstaerke !== "undefined") {
    var _pa = parseInt(d.pause_test, 10);
    pause_elektrodenlautstaerke = (isFinite(_pa) && _pa >= 50 && _pa <= 2000) ? _pa : TEST_DEFAULTS.elektrodenlautstaerke.pause;
  }
  // BA 240: Vol/Dur/Pau aus gespeicherten Daten zuruecklesen, mit Default-Fallback.
  if (typeof duration_freqmatch !== "undefined") {
    var sd = parseInt(d.duration_freqmatch, 10);
    duration_freqmatch = (isFinite(sd) && sd >= 100 && sd <= 3000) ? sd : TEST_DEFAULTS.freqmatch.duration;
  }
  if (typeof pause_freqmatch !== "undefined") {
    var sp = parseInt(d.pause_freqmatch, 10);
    pause_freqmatch = (isFinite(sp) && sp >= 50 && sp <= 2000) ? sp : TEST_DEFAULTS.freqmatch.pause;
  }
  // BA 253: ToneType/Vol/Dur/Pau fuer Stereo-Balance aus JSON zuruecklesen.
  if (typeof toneType_stereobalance !== "undefined") {
    if (isValidToneType(d.toneType_balance)) {
      toneType_stereobalance = d.toneType_balance;
    } else if (isValidToneType(d.globalToneType)) {
      toneType_stereobalance = d.globalToneType;
    } else {
      toneType_stereobalance = TEST_DEFAULTS.stereobalance.toneType;
    }
  }
  if (typeof duration_stereobalance !== "undefined") {
    var _dB = parseInt(d.duration_balance, 10);
    duration_stereobalance = (isFinite(_dB) && _dB >= 100 && _dB <= 3000) ? _dB : TEST_DEFAULTS.stereobalance.duration;
  }
  if (typeof pause_stereobalance !== "undefined") {
    var _pB = parseInt(d.pause_balance, 10);
    pause_stereobalance = (isFinite(_pB) && _pB >= 50 && _pB <= 2000) ? _pB : TEST_DEFAULTS.stereobalance.pause;
  }
  // BA 242: Implantat-State aus JSON zuruecklesen.
  if (typeof toneType_implant !== "undefined") {
    toneType_implant = isValidToneType(d.toneType_implant) ? d.toneType_implant : TEST_DEFAULTS.implant.toneType;
  }
  if (typeof duration_implant !== "undefined") {
    var sdi = parseInt(d.duration_implant, 10);
    duration_implant = (isFinite(sdi) && sdi >= 100 && sdi <= 3000) ? sdi : TEST_DEFAULTS.implant.duration;
  }
  if (typeof pause_implant !== "undefined") {
    var spi = parseInt(d.pause_implant, 10);
    pause_implant = (isFinite(spi) && spi >= 50 && spi <= 2000) ? spi : TEST_DEFAULTS.implant.pause;
  }
  if (typeof d.playerSourceMeas === "boolean") {
    plSrcMeas = d.playerSourceMeas;
    plSrcLevels = !!d.playerSourceLevels;
    plSrcCurves = !!d.playerSourceCurves;
  } else if (typeof d.playerSource === "string") {
    plSrcMeas = d.playerSource === "measured" || d.playerSource === "both";
    plSrcLevels = d.playerSource === "levels" || d.playerSource === "both";
    plSrcCurves = d.playerSource === "levels" || d.playerSource === "both";
  } else {
    plSrcMeas = true;
    plSrcLevels = true;
    plSrcCurves = true;
  }
  if (typeof updPlSrcButtons === "function") updPlSrcButtons();
  if (typeof stereobalanceResults !== "undefined" && d.lrResults) {
    Object.keys(stereobalanceResults).forEach((k) => delete stereobalanceResults[k]);
    Object.assign(stereobalanceResults, d.lrResults);
    if (typeof stereobalanceRenderResults === "function") stereobalanceRenderResults();
    if (typeof stereobalanceApplyMeanToBalance === "function") stereobalanceApplyMeanToBalance();
  }
  if (typeof stereobalanceSnapshot !== "undefined") {
    stereobalanceSnapshot = (d && d.stereobalanceSnapshot) ? d.stereobalanceSnapshot : null; // BA 156
  }
  if (typeof LTZ_result !== "undefined") {
    LTZ_result = (d && d.latencyResult) ? d.latencyResult : null;
  }
  if (typeof plApplyLatency !== "undefined") {
    plApplyLatency = (d && typeof d.plApplyLatency === "boolean")
      ? d.plApplyLatency : true;
  }
  if (typeof plApplyBalance !== "undefined") {
    plApplyBalance = (d && typeof d.plApplyBalance === "boolean")
      ? d.plApplyBalance : true;
  }
  if (typeof plBalanceMode !== "undefined") {
    plBalanceMode = (d && typeof d.plBalanceMode === "string"
                     && ["sym", "left", "right"].includes(d.plBalanceMode))
      ? d.plBalanceMode : "sym";
  }
  if (typeof updBalApplyBtn === "function") updBalApplyBtn();
  if (typeof LTZ_applyToPlayer === "function") LTZ_applyToPlayer();
  if (typeof LTZ_renderResults === "function") LTZ_renderResults();
  if (typeof FRQ_resultsArray !== "undefined") {
    if (Array.isArray(d.fRes)) {
      // BA 106: KEIN fmStatus-Filter mehr — alle Einträge übernehmen.
      // _FRQ_cleanupLegacyResults() entfernt Alt-Adaptive-Schema-Einträge
      // (mit fmConvUp etc.). _FRQ_migrateAltSliderResults() überführt
      // Alt-Slider-Einträge (ohne fmStatus) nach
      // freqmatchAdaptive.sliderEstimates, damit sie als Startwerte
      // für den adaptiven Test verfügbar sind.
      FRQ_resultsArray.splice(0, FRQ_resultsArray.length, ...d.fRes);
    } else {
      FRQ_resultsArray.splice(0, FRQ_resultsArray.length); // keine FRQ_resultsArray im JSON → zurücksetzen
    }
    if (typeof _FRQ_cleanupLegacyResults === "function") _FRQ_cleanupLegacyResults();
    if (typeof _FRQ_migrateAltSliderResults === "function") _FRQ_migrateAltSliderResults();
    if (typeof _FRQ_migrateSliderRounds === "function") _FRQ_migrateSliderRounds();
    // BA365: Altwerte (Adaptiv/Slider) ins Klavier uebernehmen (Abfrage).
    if (typeof _FRQ_migrateAltToPiano === "function") _FRQ_migrateAltToPiano();
  }
  // BA 207: Auswahl der Testelektroden für FreqMatch.
  // Alte Dateien ohne dieses Feld → null (= alle aktiven testen).
  if (typeof freqmatchTestSelection !== "undefined") {
    freqmatchTestSelection = Array.isArray(d.freqmatchTestSelection)
      ? d.freqmatchTestSelection.slice()
      : null;
  }
  // Warp-Einstellungen laden (Buffer wird nicht gespeichert – neu berechnen bei Bedarf)
  if (typeof pWarpOn !== "undefined") {
    if (typeof d.warpOn === "boolean") pWarpOn = d.warpOn;
    if (d.warpMode !== undefined) {
      pWarpMode = (typeof _migrateLegacyWarpMode === "function")
        ? _migrateLegacyWarpMode(d.warpMode, d.fRes)
        : d.warpMode;
    }
    const modeSel = document.getElementById("plWarpModeSelect");
    if (modeSel) modeSel.value = pWarpMode;
    pWarpedBuf = null;
    if (typeof pWarpUpdUI === "function") pWarpUpdUI();
  }
  // BA375: Berechnungs-Modus. Keine Migration von playerWarpLive
  // (alter Wert wird ignoriert). Fehlt der Wert -> Default "fast".
  pWarpCalcMode = (d.playerWarpMode === "fast" || d.playerWarpMode === "mid" || d.playerWarpMode === "best")
    ? d.playerWarpMode : "fast";
  if (typeof _pWarpCalcModeApply === "function") _pWarpCalcModeApply();
  // BA 177: wenn Save-Daten Frequenzabgleich-Messungen enthielten,
  // den Default-Anwendungs-Flag setzen, damit der nächste Insert
  // den gespeicherten pWarpMode nicht überschreibt.
  try {
    const _hasFm =
      (Array.isArray(FRQ_resultsArray) && FRQ_resultsArray.length > 0)
      || (typeof _FRQ_hasSliderEstimates === "function" && _FRQ_hasSliderEstimates())
      || (typeof _FRQ_hasAdaptiveData === "function" && _FRQ_hasAdaptiveData());
    if (_hasFm && typeof pMarkPlayerWarpDefaultAsApplied === "function") {
      pMarkPlayerWarpDefaultAsApplied();
    }
  } catch (e) { /* defensiv */ }
  if (typeof d.plMaplawOn === "boolean") pMaplawOn = d.plMaplawOn;
  if (typeof d.plMaplawSollC === "number") pMaplawSollC = d.plMaplawSollC;
  if (typeof d.playerShowExperimental === "boolean") plShowExperimental = d.playerShowExperimental;
  // BA323: Player-Box-Felder werden beim Laden nicht mehr angewendet — Box ist zustandslos.
  // Alte JSON-Dateien mit diesen Feldern werden fehlerfrei ignoriert.
  // BA366.1: Hoerbuch-Positionen zusammenfuehren (Datei-Eintraege haben Vorrang).
  if (d.plBookPositions && typeof d.plBookPositions === "object" && typeof plBookPositions !== "undefined") {
    Object.assign(plBookPositions, d.plBookPositions);
  }
  // BA336: Inhalts-Sprache — einzige persistente Box-Einstellung.
  if (typeof d.playerContentLang === "string" && d.playerContentLang) {
    if (typeof plContentLang !== "undefined") {
      plContentLang = d.playerContentLang;
      try { localStorage.setItem("ci-lb-content-lang", plContentLang); } catch (e) {}
    }
  }
  if (typeof pApplyShowExperimental === "function") pApplyShowExperimental();
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
  if (typeof pMaplawTrigger === "function") pMaplawTrigger();
  if (typeof d.userFileSuffix === "string") {
    userFileSuffix = d.userFileSuffix;
    const _el = document.getElementById("userFileSuffix");
    if (_el) _el.value = userFileSuffix;
  }
  if (typeof d.userLastName === "string") {
    userLastName = d.userLastName;
    const _ln = document.getElementById("userLastName");
    if (_ln) _ln.value = userLastName;
    try { sessionStorage.setItem("ci-lb-userLastName", userLastName); } catch (e) {}
  }
  if (typeof d.userFirstName === "string") {
    userFirstName = d.userFirstName;
    const _fn = document.getElementById("userFirstName");
    if (_fn) _fn.value = userFirstName;
    try { sessionStorage.setItem("ci-lb-userFirstName", userFirstName); } catch (e) {}
  }
  if (typeof audiologUserNote !== "undefined") {
    audiologUserNote = (typeof d.audiologUserNote === "string") ? d.audiologUserNote : "";
    const aNoteEl = document.getElementById("audiologNoteInput");
    if (aNoteEl) aNoteEl.value = audiologUserNote;
  }
  FRQ_implantatTableBuild();
  renderResults();
  if (typeof FRQ_renderResults === "function") FRQ_renderResults();
  if (typeof FRQ_refreshResumeHint === "function") FRQ_refreshResumeHint();
  if (typeof FRQ_applyLang === "function") FRQ_applyLang();
  if (typeof _FRQ_refreshTabState === "function") _FRQ_refreshTabState();
  if (typeof stereobalanceRefreshElectrodeSelectionSummary === "function") stereobalanceRefreshElectrodeSelectionSummary();
  if (typeof FRQ_refreshElectrodeSelectionSummary === "function") FRQ_refreshElectrodeSelectionSummary();
  if (typeof testRefreshElectrodeSelectionSummary === "function") testRefreshElectrodeSelectionSummary();
  if (typeof stereobalanceRefreshToneTypeLabel === "function") stereobalanceRefreshToneTypeLabel();
  if (typeof FRQ_refreshToneTypeLabel === "function") FRQ_refreshToneTypeLabel();
  if (typeof testRefreshToneTypeLabel === "function") testRefreshToneTypeLabel();
  if (typeof elektrodenlautstaerkeKurvenTabelleBauen === "function") elektrodenlautstaerkeKurvenTabelleBauen();
  if (typeof elektrodenlautstaerkeKurvenChartZeichnen === "function") elektrodenlautstaerkeKurvenChartZeichnen();
  if (typeof d.levelsTabShowMeas === "boolean") elektrodenlautstaerkeSchieberShowMeas = d.levelsTabShowMeas;
  if (typeof d.levelsTabShowCurves === "boolean") elektrodenlautstaerkeSchieberShowCurves = d.levelsTabShowCurves;
  if (typeof d.levelsTabMode === "string") elektrodenlautstaerkeSchieberMode = d.levelsTabMode;
  if (typeof d.levelsTabVariant === "string") elektrodenlautstaerkeSchieberVariant = d.levelsTabVariant;
  if (typeof elektrodenlautstaerkeSchieberUpdateModeAvailability === "function") elektrodenlautstaerkeSchieberUpdateModeAvailability();
  if (typeof elektrodenlautstaerkeSchieberRebuild === "function" &&
      document.getElementById("panel-schieber")?.classList.contains("active")) {
    elektrodenlautstaerkeSchieberRebuild();
  }
  if (typeof updFClearBtn === "function") updFClearBtn();
  if (typeof buildImplantCard === "function") buildImplantCard();
  if (pEqF && pEqF.length > 0) pUpdEQ();
  updSideButtons();
  const fi = gEl("fInput");
  if (fi) fi.value = "";
  // BA323: d.localCollections wird ignoriert — Box ist zustandslos.
  const MIGR_TYPES = ["tilt", "scurve", "pivot", "gauss"];
  const sideHasMeaningfulMigration = (side) =>
    sideData[side]._presetsMigrated === true &&
    (sideData[side].elektrodenlautstaerkeKurven || []).some(
      (p) => MIGR_TYPES.includes(p.type) && p.strength !== 0,
    );
  if (SIDES.some(sideHasMeaningfulMigration)) {
    alert(t("loadMigratedCurves"));
  }
  sideData.left._presetsMigrated = false;
  sideData.right._presetsMigrated = false;
  if (typeof tabLockApply === "function") tabLockApply();
  if (typeof depLockApply === "function") depLockApply();
}
function clearRes() {
  const ch = confirm(t("delConfirmMeas"));
  if (!ch) return;
  sideData[activeSide].elektrodenlautstaerkeResults.splice(0, sideData[activeSide].elektrodenlautstaerkeResults.length);
  sideData[activeSide].fullSweepRound = null;
  sideData[activeSide].fullSweepDonePairs = [];
  elektrodenlautstaerkeResults = sideData[activeSide].elektrodenlautstaerkeResults;
  fullSweepRound = null;
  fullSweepDonePairs = [];
  renderResults();
  pUpdEQ();
}

// Sammelt die format-unabhaengige Korrektur fuer die System-Equalizer-
// Exporte (EasyEffects, Equalizer APO). Liest ausschliesslich aus den
// zentralen Funktionen (getPlayerCorrection, getPlayerLatencyMs) — spiegelt
// damit exakt den Player (inkl. EQ-Schalter-Gate und nhSim).
//   bands[i] = { freq, q, gainL, gainR }   (gainL===gainR wenn nicht split)
//   splitChannels: true  -> echte Stereo-Kurven (Modus "both"/"mono")
//   hasLat/LTZ_ms:  Latenz (ms>=0 verzoegert links, ms<0 rechts)
//   hasBal/balL/balR: Stereo-Balance dB-Pegel pro Ohr in allen Side-Modi
//                     (Balance pro Ohr, spiegelt den Player)
//   anyData: false -> nichts zu exportieren
function collectSysEqCorrection() {
  const mode = getPlayerSide();

  // BA 314: Werte ausschliesslich aus der zentralen Quelle
  // (getPlayerCorrection, player.js). eq[] ist fertig: EQ-Schalter-Gate
  // + nhSim-Spiegelung, natuerliche Konvention (= was der Player-Filter
  // setzt). balance = flacher dB-Pegel pro Ohr. So spiegelt der Export
  // exakt den Player (inkl. nhSim), ohne eigene Rechnung.
  let leftArr, rightArr, splitChannels, balL, balR;
  if (mode === "both" || mode === "mono") {
    const corrL = getPlayerCorrection("left");
    const corrR = getPlayerCorrection("right");
    leftArr = corrL.eq;
    rightArr = corrR.eq;
    balL = corrL.balance;
    balR = corrR.balance;
    splitChannels = true;
  } else {
    const corr = getPlayerCorrection(mode);   // mode === "left" oder "right"
    leftArr = corr.eq;
    rightArr = corr.eq;
    balL = (mode === "left")  ? corr.balance : 0;
    balR = (mode === "right") ? corr.balance : 0;
    splitChannels = false;
  }

  // Stereo->Mono-Mischung wie im Player (unveraendert; NICHT am
  // EQ-Schalter, da der Mono-Downmix ueber den Buffer laeuft).
  // "left"/"right": Monosumme auf das aktive Ohr, Gegenseite stumm.
  // "mono":         Monosumme auf beide Ohren (EQ bleibt pro Ohr getrennt).
  const monoSum = (mode === "left" || mode === "right" || mode === "mono");
  const muteCh = mode === "left" ? "R" : mode === "right" ? "L" : null;

  const LTZ_ms = (typeof getPlayerLatencyMs === "function")
    ? getPlayerLatencyMs() : 0;
  const hasLat = LTZ_ms !== 0;
  const hasBal = balL !== 0 || balR !== 0;

  const hasGain = (arr) => arr.some((v) => v !== 0);
  const anyData =
    hasGain(leftArr) || hasGain(rightArr) || plEqOn || hasLat || hasBal
    || monoSum;

  const bands = [];
  for (let i = 0; i < nEl; i++) {
    bands.push({
      freq: FRQ_implantatEffektiv(i),
      q: pCompQ(i),
      gainL: leftArr[i] || 0,
      gainR: rightArr[i] || 0,
    });
  }

  return {
    bands,
    splitChannels,
    monoSum,
    muteCh,
    hasLat,
    LTZ_ms,
    hasBal,
    balL,
    balR,
    anyData,
  };
}

function exportEasyEffects() {
  const corr = collectSysEqCorrection();
  if (!corr.anyData) {
    alert(t("plNoData"));
    return;
  }
  const makeBand = (freq, gainVal, q) => ({
    frequency: freq,
    gain: parseFloat(gainVal.toFixed(1)),
    mode: "APO (DR)",
    mute: false,
    q: parseFloat(q.toFixed(2)),
    slope: "x1",
    solo: false,
    type: "Bell",
    width: 4.0,
  });
  const left = {},
    right = {};
  corr.bands.forEach((b, i) => {
    left["band" + i] = makeBand(b.freq, b.gainL, b.q);
    right["band" + i] = makeBand(b.freq, b.gainR, b.q);
  });
  const preset = {
    output: {
      blocklist: [],
      "equalizer#0": {
        balance: 0.0,
        bypass: false,
        "input-gain": 0.0,
        left: left,
        "output-gain": 0.0,
        right: right,
        "split-channels": corr.splitChannels,
        "num-bands": corr.bands.length,
      },
    },
  };
  // BA 307: Stereo->Mono-Mischung als stereo_tools VOR dem Equalizer.
  // "LR > L+R (Mono Sum L+R)" mittelt zu (L+R)/2 (Nutzer-getestet, kein
  // Gain-Ausgleich noetig). Bei Einseiten-Modus die Gegenseite stummschalten.
  if (corr.monoSum) {
    preset.output["stereo_tools#0"] = {
      "balance-in": 0.0,
      "balance-out": 0.0,
      bypass: false,
      delay: 0.0,
      "input-gain": 0.0,
      "middle-level": 0.0,
      "middle-panorama": 0.0,
      mode: "LR > L+R (Mono Sum L+R)",
      mutel: corr.muteCh === "L",
      muter: corr.muteCh === "R",
      "output-gain": 0.0,
      phasel: false,
      phaser: false,
      "sc-level": 1.0,
      "side-balance": 0.0,
      "side-level": 0.0,
      softclip: false,
      "stereo-base": 0.0,
      "stereo-phase": 0.0,
    };
  }
  if (corr.hasLat || corr.hasBal) {
    const ms = corr.hasLat ? corr.LTZ_ms : 0;
    const tL = ms >= 0 ? Math.abs(ms) : 0;
    const tR = ms < 0 ? Math.abs(ms) : 0;
    preset.output["delay#0"] = {
      bypass: false,
      "dry-l": -100.0,
      "dry-r": -100.0,
      "input-gain": 0.0,
      "invert-phase-l": false,
      "invert-phase-r": false,
      "output-gain": 0.0,
      "time-l": parseFloat(tL.toFixed(1)),
      "time-r": parseFloat(tR.toFixed(1)),
      "wet-l": parseFloat(corr.balL.toFixed(1)),
      "wet-r": parseFloat(corr.balR.toFixed(1)),
    };
  }
  // BA 307: Reihenfolge zentral. Mono-Mischung zuerst, dann EQ, dann
  // Verzoegerung/Balance.
  const order = [];
  if (corr.monoSum) order.push("stereo_tools#0");
  order.push("equalizer#0");
  if (corr.hasLat || corr.hasBal) order.push("delay#0");
  preset.output.plugins_order = order;
  const blob = new Blob([JSON.stringify(preset, null, 4)], {
      type: "application/json",
    }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = buildCImbelFilename("easyeffects", null, ".json");
  a.click();
}

// Equalizer APO (Windows): Textformat config.txt. PK-Filter (= Bell),
// Channel-gebundene Delay/Preamp-Zeilen. Reihenfolge egal (alles linear),
// daher: EQ, dann Balance (Preamp pro Kanal), dann Latenz (Delay).
function exportEqualizerAPO() {
  const corr = collectSysEqCorrection();
  if (!corr.anyData) {
    alert(t("plNoData"));
    return;
  }
  const fname = buildCImbelFilename("equalizerapo", null, ".txt");
  const fc = (n) => n.toFixed(1);
  const g = (n) => n.toFixed(1);
  const q = (n) => n.toFixed(2);

  const L = [];
  L.push("# CImbel");
  L.push("# " + t("apoFileHint"));
  L.push("#   Include: " + fname);
  L.push("");

  // BA 307: Stereo->Mono-Mischung VOR den Filtern (analog Player und
  // EasyEffects stereo_tools). Alle Zuweisungen in EINER Copy-Zeile
  // (parallele Auswertung in Equalizer APO). 0.5/0.5 = (L+R)/2.
  if (corr.monoSum) {
    L.push("# " + t("apoMonoHint"));
    if (corr.muteCh === "R") {
      L.push("Copy: L=0.5*L+0.5*R R=0");
    } else if (corr.muteCh === "L") {
      L.push("Copy: R=0.5*L+0.5*R L=0");
    } else {
      L.push("Copy: L=0.5*L+0.5*R R=0.5*L+0.5*R");
    }
    L.push("");
  }

  const eqLines = (side, ch) => {
    L.push("Channel: " + ch);
    corr.bands.forEach((b, i) => {
      const gain = side === "R" ? b.gainR : b.gainL;
      L.push(
        "Filter " + (i + 1) + ": ON PK Fc " + fc(b.freq) +
        " Hz Gain " + g(gain) + " dB Q " + q(b.q),
      );
    });
  };

  if (corr.splitChannels) {
    eqLines("L", "L");
    eqLines("R", "R");
  } else {
    // Mono / eine Seite: gleiche Kurve auf beide Ausgangskanaele.
    eqLines("L", "L R");
  }

  // Stereo-Balance (nur Modus "both" -> splitChannels): Pegel pro Ohr
  // als kanalweiser Preamp. Werte direkt uebernommen (analog EasyEffects
  // wet-l/wet-r), damit der PC dieselbe Korrektur wie der Player macht.
  if (corr.hasBal) {
    L.push("");
    L.push("Channel: L");
    L.push("Preamp: " + g(corr.balL) + " dB");
    L.push("Channel: R");
    L.push("Preamp: " + g(corr.balR) + " dB");
  }

  // Latenz: ms>=0 verzoegert links, ms<0 rechts (analog Player/EasyEffects).
  if (corr.hasLat) {
    L.push("");
    if (corr.LTZ_ms >= 0) {
      L.push("Channel: L");
    } else {
      L.push("Channel: R");
    }
    L.push("Delay: " + Math.abs(corr.LTZ_ms).toFixed(1) + " ms");
  }

  const blob = new Blob([L.join("\n") + "\n"], { type: "text/plain" }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fname;
  a.click();
}

