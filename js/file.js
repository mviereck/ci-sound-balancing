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
    sideData[s].freqs = [...MFR["unknown"].freqs];
    sideData[s].elSt = new Array(sideData[s].nEl).fill(null);
    sideData[s].elNt = new Array(sideData[s].nEl).fill("");
    sideData[s].elExDur = new Array(sideData[s].nEl).fill(null);
    sideData[s].elFreqOwn = new Array(sideData[s].nEl).fill(null);
    sideData[s].manualLevels = new Array(sideData[s].nEl).fill(0);
    sideData[s].refEl = Math.floor(sideData[s].nEl / 2);
    sideData[s].bRes = [];
    sideData[s].presets = [];
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
  slTarget_balance = "both";
  // BA 254: Tonfolge pro Test
  if (typeof sequence_freqmatch !== "undefined") sequence_freqmatch = TEST_DEFAULTS.freqmatch.sequence;
  if (typeof sequence_test      !== "undefined") sequence_test      = TEST_DEFAULTS.test.sequence;
  if (typeof sequence_balance   !== "undefined") sequence_balance   = TEST_DEFAULTS.balance.sequence;
  // BA 246
  if (typeof toneType_test !== "undefined") toneType_test = TEST_DEFAULTS.test.toneType;
  if (typeof volume_global !== "undefined") volume_global = TEST_DEFAULTS.commonVolume;
  if (typeof duration_test !== "undefined") duration_test = TEST_DEFAULTS.test.duration;
  if (typeof pause_test    !== "undefined") pause_test    = TEST_DEFAULTS.test.pause;
  if (typeof toneType_balance !== "undefined") toneType_balance = TEST_DEFAULTS.balance.toneType;
  if (typeof duration_balance !== "undefined") duration_balance = TEST_DEFAULTS.balance.duration;
  if (typeof pause_balance    !== "undefined") pause_balance    = TEST_DEFAULTS.balance.pause;
  if (typeof toneType_freqmatch !== "undefined") toneType_freqmatch = TEST_DEFAULTS.freqmatch.toneType;
  if (typeof duration_freqmatch !== "undefined") duration_freqmatch = TEST_DEFAULTS.freqmatch.duration;
  if (typeof pause_freqmatch    !== "undefined") pause_freqmatch    = TEST_DEFAULTS.freqmatch.pause;
  if (typeof toneType_implant !== "undefined") toneType_implant = TEST_DEFAULTS.implant.toneType;
  if (typeof duration_implant !== "undefined") duration_implant = TEST_DEFAULTS.implant.duration;
  if (typeof pause_implant    !== "undefined") pause_implant    = TEST_DEFAULTS.implant.pause;
  // --- Latenz ---
  if (typeof latencyResult !== "undefined") latencyResult = null;
  if (typeof plApplyLatency !== "undefined") plApplyLatency = true;
  if (typeof latApplyToPlayer === "function") latApplyToPlayer();
  if (typeof latRenderResults === "function") latRenderResults();
  if (typeof latSliderInput === "function") latSliderInput(0);
  // --- LR-Balance ---
  if (typeof lrResults !== "undefined") {
    Object.keys(lrResults).forEach(k => delete lrResults[k]);
    if (typeof lrUndoStack !== "undefined") lrUndoStack.splice(0, lrUndoStack.length);
    if (typeof lrSnapshot !== "undefined") lrSnapshot = null;
    if (typeof lrRenderResults === "function") lrRenderResults();
    if (typeof lrApplyMeanToBalance === "function") lrApplyMeanToBalance();
  }
  if (typeof plApplyBalance !== "undefined") plApplyBalance = true;
  if (typeof plBalanceMode !== "undefined") plBalanceMode = "sym";
  if (typeof updBalApplyBtn === "function") updBalApplyBtn();
  // --- Frequenzabgleich-Ergebnisse ---
  if (typeof fRes !== "undefined") fRes.splice(0, fRes.length);
  if (typeof freqmatchTestSelection !== "undefined") freqmatchTestSelection = null;
  if (typeof renderFreqMatchResults === "function") renderFreqMatchResults();
  // BA 161: FreqMatch-Tab-UI nach Reset auffrischen
  if (typeof fmRefreshResumeHint === "function") fmRefreshResumeHint();
  if (typeof _fmRefreshTabState === "function") _fmRefreshTabState();
  if (typeof fmApplyLang === "function") fmApplyLang();
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
  // --- EQ-Knopf + Stärke ---
  if (typeof plEqOn !== "undefined") plEqOn = false;
  if (typeof updEqToggleBtn === "function") updEqToggleBtn();
  const _plStr = document.getElementById("plStr");
  if (_plStr) _plStr.value = "100";
  // --- Warp-Block ---
  if (typeof pWarpOn !== "undefined") {
    pWarpOn = false;
    pWarpMode = "right";
    pWarpStrength = 100;
    const _ws  = document.getElementById("plWarpStr");
    if (_ws) _ws.value = pWarpStrength;
    const _wmd = document.getElementById("plWarpModeSelect");
    if (_wmd) _wmd.value = pWarpMode;
    if (typeof _pPlayerWarpDefaultApplied !== "undefined") {
      _pPlayerWarpDefaultApplied = false;
    }
    if (typeof pWarpUpdUI === "function") pWarpUpdUI();
    if (typeof pRubberbandOptions !== "undefined") {
      pRubberbandOptions.engine   = "r3";
      pRubberbandOptions.material = "standard";
      pRubberbandOptions.formant  = true;
      pRubberbandOptions.fast     = false;
      const rE = document.querySelector('input[name="plWarpEngine"][value="r3"]');
      if (rE) rE.checked = true;
      const rM = document.querySelector('input[name="plWarpMaterial"][value="standard"]');
      if (rM) rM.checked = true;
      const cF = document.getElementById("plWarpFormant");
      if (cF) cF.checked = true;
      const cS = document.getElementById("plWarpFast");
      if (cS) cS.checked = false;
      if (typeof _pRbOptUpdateR3Hint === "function") _pRbOptUpdateR3Hint();
    }
  }
  // --- MAPLAW-Knopf ---
  if (typeof pMaplawOn !== "undefined") pMaplawOn = false;
  if (typeof pMaplawSollC !== "undefined") pMaplawSollC = 1000;
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
  if (typeof pMaplawTrigger === "function") pMaplawTrigger();
  // --- Player-Experimental ---
  if (typeof plShowExperimental !== "undefined") plShowExperimental = false;
  if (typeof pApplyShowExperimental === "function") pApplyShowExperimental();
  // --- BA192: Player-Wiedergabe-State ---
  if (typeof plActiveSource !== "undefined") plActiveSource = "music";
  if (typeof plAutoAdvance  !== "undefined") plAutoAdvance  = false;
  if (typeof plLoop         !== "undefined") plLoop         = false;
  if (typeof plShuffle      !== "undefined") plShuffle      = false;
  if (typeof plPauseMs      !== "undefined") plPauseMs      = 2000;
  if (typeof plSentShowText !== "undefined") plSentShowText = false;
  // --- BA193: Geraeusche-State ---
  if (typeof plNoiseSelectedId !== "undefined") plNoiseSelectedId = "gen:pink";
  if (typeof plNoiseSortAxis   !== "undefined") plNoiseSortAxis   = "kind";
  if (typeof plNoiseCategory   !== "undefined") plNoiseCategory   = "_all";
  if (typeof plNoiseSearchQuery !== "undefined") plNoiseSearchQuery = "";
  if (typeof plSentBgEnabled   !== "undefined") plSentBgEnabled   = false;
  if (typeof plSentBgItemId    !== "undefined") plSentBgItemId    = "gen:pink";
  if (typeof plSentBgSnrDb     !== "undefined") plSentBgSnrDb     = 0;
  if (typeof plBookSelectedId  !== "undefined") plBookSelectedId  = null;
  if (typeof plBookChapterIdx  !== "undefined") plBookChapterIdx  = 0;
  if (typeof plBookSortAxis    !== "undefined") plBookSortAxis    = "author";
  if (typeof plBookPositions   !== "undefined") plBookPositions   = {};
  if (typeof plMusicSelectedId   !== "undefined") plMusicSelectedId   = null;
  if (typeof plMusicSortAxis     !== "undefined") plMusicSortAxis     = "title";
  if (typeof plMusicCategory     !== "undefined") plMusicCategory     = "_all";
  if (typeof plMusicSearchQuery  !== "undefined") plMusicSearchQuery  = "";
  // --- Sprecher-Auswahl im Player ---
  const _spk = document.getElementById("plSentSpeaker");
  if (_spk) _spk.value = "";
  // --- Schieber-Tab-Modus und -Variante ---
  if (typeof lvTabMode !== "undefined") lvTabMode = "rel";
  if (typeof lvTabVariant !== "undefined") lvTabVariant = "stack";
  if (typeof lvTabShowMeas !== "undefined") lvTabShowMeas = false;
  if (typeof lvTabShowCurves !== "undefined") lvTabShowCurves = false;
  const _lvModeRel = document.getElementById("lvTabModeRel");
  if (_lvModeRel) _lvModeRel.checked = true;
  const _lvVarStack = document.getElementById("lvTabVarStack");
  if (_lvVarStack) _lvVarStack.checked = true;
  const _lvChkMeas = document.getElementById("lvTabChkMeas");
  if (_lvChkMeas) _lvChkMeas.checked = false;
  const _lvChkCurves = document.getElementById("lvTabChkCurves");
  if (_lvChkCurves) _lvChkCurves.checked = false;
  if (typeof lvTabUpdateModeAvailability === "function") lvTabUpdateModeAvailability();
  // --- „Schieber für beide Seiten gleich"-Checkbox ---
  const _prBoth = document.getElementById("prBothSides");
  if (_prBoth) _prBoth.checked = true;
  // --- UI-Refresh ---
  buildFreqTable();
  buildPrTbl();
  drawLvChart();
  renderResults();
  if (typeof buildImplantCard === "function") buildImplantCard();
  if (typeof lvTabRebuild === "function") lvTabRebuild();
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
        frequencies: sideData.left.freqs,
        electrodeFreqOwn: sideData.left.elFreqOwn,
        electrodeStatus: sideData.left.elSt,
        electrodeActive: sideData.left.elActive,
        electrodeNotes: sideData.left.elNt,
        electrodeExcludedDuring: sideData.left.elExDur,
        referenceElectrode: sideData.left.refEl,
        balanceResults: sideData.left.bRes,
        fmMode: sideData.left.fmMode || 'adaptive',
        fmAdaptiveDur: sideData.left.fmAdaptiveDur != null ? sideData.left.fmAdaptiveDur : 200,
        fmAdaptivePau: sideData.left.fmAdaptivePau != null ? sideData.left.fmAdaptivePau : 200,
        manualLevels: sideData.left.manualLevels,
        presets: sideData.left.presets,
        fullSweepRound: sideData.left.fullSweepRound,
        fullSweepDonePairs: sideData.left.fullSweepDonePairs,
        implant: sideData.left.implant,
        freqmatchAdaptive: sideData.left.freqmatchAdaptive || null,
      },
      right: {
        config: sideData.right.config || "ci",
        manufacturer: sideData.right.manufacturer,
        frequencies: sideData.right.freqs,
        electrodeFreqOwn: sideData.right.elFreqOwn,
        electrodeStatus: sideData.right.elSt,
        electrodeActive: sideData.right.elActive,
        electrodeNotes: sideData.right.elNt,
        electrodeExcludedDuring: sideData.right.elExDur,
        referenceElectrode: sideData.right.refEl,
        balanceResults: sideData.right.bRes,
        fmMode: sideData.right.fmMode || 'adaptive',
        fmAdaptiveDur: sideData.right.fmAdaptiveDur != null ? sideData.right.fmAdaptiveDur : 200,
        fmAdaptivePau: sideData.right.fmAdaptivePau != null ? sideData.right.fmAdaptivePau : 200,
        manualLevels: sideData.right.manualLevels,
        presets: sideData.right.presets,
        fullSweepRound: sideData.right.fullSweepRound,
        fullSweepDonePairs: sideData.right.fullSweepDonePairs,
        implant: sideData.right.implant,
        freqmatchAdaptive: sideData.right.freqmatchAdaptive || null,
      },
    },
    currentSide: activeSide,
    lrResults: (typeof lrResults !== "undefined") ? lrResults : {},
    lrSnapshot: (typeof lrSnapshot !== "undefined") ? lrSnapshot : null, // BA 156
    latencyResult: (typeof latencyResult !== "undefined") ? latencyResult : null,
    plApplyLatency: (typeof plApplyLatency !== "undefined") ? plApplyLatency : true,
    plApplyBalance: (typeof plApplyBalance !== "undefined") ? plApplyBalance : true,
    plBalanceMode: (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym",
    fRes: (typeof fRes !== "undefined") ? fRes : [],
    freqmatchTestSelection: (typeof freqmatchTestSelection !== "undefined")
      ? freqmatchTestSelection : null,
    sequence_freqmatch: (typeof sequence_freqmatch !== "undefined") ? sequence_freqmatch : TEST_DEFAULTS.freqmatch.sequence,
    sequence_test:      (typeof sequence_test      !== "undefined") ? sequence_test      : TEST_DEFAULTS.test.sequence,
    sequence_balance:   (typeof sequence_balance   !== "undefined") ? sequence_balance   : TEST_DEFAULTS.balance.sequence,
    slTarget_balance: slTarget_balance,
    playerSourceMeas: plSrcMeas,
    playerSourceLevels: plSrcLevels,
    playerSourceCurves: plSrcCurves,
    levelsTabShowMeas: lvTabShowMeas,
    levelsTabShowCurves: lvTabShowCurves,
    levelsTabMode: lvTabMode,
    levelsTabVariant: lvTabVariant,
    plSide: getPlayerSide(),
    plBothSides: document.getElementById("plBothSides").checked,
    eqOn: plEqOn,
    eqStrength: parseInt(document.getElementById("plStr").value),
    toneType_freqmatch: (typeof toneType_freqmatch !== "undefined")
      ? toneType_freqmatch : TEST_DEFAULTS.freqmatch.toneType,
    // BA 246
    toneType_test: (typeof toneType_test !== "undefined")
      ? toneType_test : TEST_DEFAULTS.test.toneType,
    // BA 287: gemeinsame Lautstaerke.
    volume_global: (typeof volume_global !== "undefined") ? volume_global : TEST_DEFAULTS.commonVolume,
    duration_test: (typeof duration_test !== "undefined") ? duration_test : TEST_DEFAULTS.test.duration,
    pause_test:    (typeof pause_test    !== "undefined") ? pause_test    : TEST_DEFAULTS.test.pause,
    // BA 240: Dur/Pau-State des Frequenzabgleichs persistieren.
    duration_freqmatch: (typeof duration_freqmatch !== "undefined") ? duration_freqmatch : TEST_DEFAULTS.freqmatch.duration,
    pause_freqmatch:    (typeof pause_freqmatch    !== "undefined") ? pause_freqmatch    : TEST_DEFAULTS.freqmatch.pause,
    // BA 253: Dur/Pau/ToneType fuer Stereo-Balance persistieren.
    toneType_balance: (typeof toneType_balance !== "undefined")
      ? toneType_balance : TEST_DEFAULTS.balance.toneType,
    duration_balance: (typeof duration_balance !== "undefined") ? duration_balance : TEST_DEFAULTS.balance.duration,
    pause_balance:    (typeof pause_balance    !== "undefined") ? pause_balance    : TEST_DEFAULTS.balance.pause,
    toneType_implant:   (typeof toneType_implant !== "undefined") ? toneType_implant : TEST_DEFAULTS.implant.toneType,
    duration_implant:   (typeof duration_implant !== "undefined") ? duration_implant : TEST_DEFAULTS.implant.duration,
    pause_implant:      (typeof pause_implant    !== "undefined") ? pause_implant    : TEST_DEFAULTS.implant.pause,
    warpOn: (typeof pWarpOn !== "undefined") ? pWarpOn : false,
    warpMode: (typeof pWarpMode !== "undefined") ? pWarpMode : "right",
    warpStrength: (typeof pWarpStrength !== "undefined") ? pWarpStrength : 100,
    warpRbOptions: (typeof pRubberbandOptions !== "undefined")
      ? { ...pRubberbandOptions } : null,

    plMaplawOn: (typeof pMaplawOn !== "undefined") ? pMaplawOn : false,
    plMaplawSollC: (typeof pMaplawSollC !== "undefined") ? pMaplawSollC : 1000,
    playerShowExperimental: (typeof plShowExperimental !== "undefined") ? plShowExperimental : false,
    plActiveSource: (typeof plActiveSource !== "undefined") ? plActiveSource : "music",
    plAutoAdvance:  (typeof plAutoAdvance  !== "undefined") ? plAutoAdvance  : false,
    plLoop:         (typeof plLoop         !== "undefined") ? plLoop         : false,
    plShuffle:      (typeof plShuffle      !== "undefined") ? plShuffle      : false,
    plPauseMs:      (typeof plPauseMs      !== "undefined") ? plPauseMs      : 2000,
    plSentShowText: (typeof plSentShowText !== "undefined") ? plSentShowText : false,
    plNoiseSelectedId: (typeof plNoiseSelectedId !== "undefined") ? plNoiseSelectedId : "gen:pink",
    plNoiseSortAxis:   (typeof plNoiseSortAxis   !== "undefined") ? plNoiseSortAxis   : "kind",
    plNoiseCategory:   (typeof plNoiseCategory   !== "undefined") ? plNoiseCategory   : "_all",
    plNoiseSearchQuery: (typeof plNoiseSearchQuery !== "undefined") ? plNoiseSearchQuery : "",
    plSentBgEnabled: (typeof plSentBgEnabled !== "undefined") ? plSentBgEnabled : false,
    plSentBgItemId:  (typeof plSentBgItemId  !== "undefined") ? plSentBgItemId  : "gen:pink",
    plSentBgSnrDb:   (typeof plSentBgSnrDb   !== "undefined") ? plSentBgSnrDb   : 0,
    plBookSelectedId: (typeof plBookSelectedId !== "undefined") ? plBookSelectedId : null,
    plBookChapterIdx: (typeof plBookChapterIdx !== "undefined") ? plBookChapterIdx : 0,
    plBookSortAxis:   (typeof plBookSortAxis   !== "undefined") ? plBookSortAxis   : "author",
    plBookPositions:  (typeof plBookPositions  !== "undefined") ? Object.assign({}, plBookPositions) : {},
    plMusicSelectedId:  (typeof plMusicSelectedId  !== "undefined") ? plMusicSelectedId  : null,
    plMusicSortAxis:    (typeof plMusicSortAxis    !== "undefined") ? plMusicSortAxis    : "title",
    plMusicCategory:    (typeof plMusicCategory    !== "undefined") ? plMusicCategory    : "_all",
    plMusicSearchQuery: (typeof plMusicSearchQuery !== "undefined") ? plMusicSearchQuery : "",
    localCollections: (typeof sLocalCollections !== "undefined")
      ? Array.from(sLocalCollections.values()).map((c) => ({
          id: c.id,
          label: c.label,
          lang: c.lang,
          kind: c.kind,
          folderName: c.folderName,
          fileCount: c.recordings.length,
          handleId: c.handleId || null,
        }))
      : [],
    userFileSuffix: (typeof userFileSuffix === "string") ? userFileSuffix : "",
    userLastName:   (typeof userLastName   === "string") ? userLastName   : "",
    userFirstName:  (typeof userFirstName  === "string") ? userFirstName  : "",
    audiologUserNote: (typeof audiologUserNote !== "undefined") ? audiologUserNote : "",
  };
  const blob = new Blob([JSON.stringify(d, null, 2)], {
    type: "application/json",
  });
  const fn = buildCImbelFilename(null, null, ".json");
  if (window.showSaveFilePicker) {
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: fn,
        types: [
          {
            description: "JSON",
            accept: { "application/json": [".json"] },
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

// Vollständig korrigierte loadOldFormat
function loadOldFormat(d, targetSide) {
  console.log("loadOldFormat aufgerufen für", targetSide);
  const s = sideData[targetSide];

  // Hersteller setzen
  if (d.manufacturer && MFR[d.manufacturer]) {
    s.manufacturer = d.manufacturer;
  } else {
    s.manufacturer = "medel";
  }

  // Anzahl Elektroden und Frequenzen
  s.nEl = MFR[s.manufacturer].n;
  s.freqs = d.frequencies ? [...d.frequencies] : [...MFR[s.manufacturer].freqs];

  // Falls die geladenen Frequenzen nicht zur Elektrodenanzahl passen, korrigieren
  if (s.freqs.length !== s.nEl) {
    console.warn("Frequenzanzahl passt nicht, verwende Standard");
    s.freqs = [...MFR[s.manufacturer].freqs];
  }

  // Arrays initialisieren
  s.elSt = d.electrodeStatus
    ? [...d.electrodeStatus]
    : new Array(s.nEl).fill(null);
  s.elNt = d.electrodeNotes ? [...d.electrodeNotes] : new Array(s.nEl).fill("");
  s.elExDur = d.electrodeExcludedDuring
    ? [...d.electrodeExcludedDuring]
    : new Array(s.nEl).fill(null);

  // Migration: 'excluded' aus elSt in elExDur verschieben
  for (let i = 0; i < s.elSt.length; i++) {
    if (s.elSt[i] === "excluded") {
      s.elExDur[i] = s.elExDur[i] || Date.now();
      s.elSt[i] = null;
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
  // Skip-Wirkung behalten.
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
    s.refEl = valid ? r : pickDefaultRefEl(targetSide);
  }

  // Messergebnisse
  // BA 251: judgmentResults aus alten Dateien werden stillschweigend
  // ignoriert (das Judgment-Verfahren wurde mit BA 247 entfernt).
  s.bRes = d.balanceResults ? [...d.balanceResults] : [];
  s.manualLevels = d.manualLevels
    ? [...d.manualLevels]
    : new Array(s.nEl).fill(0);

  // Presets
  if (d.presets && Array.isArray(d.presets)) {
    s.presets = PR_TYPES.map((tp) => {
      const found = d.presets.find((p) => p.type === tp);
      return found || {
        type: tp, on: false, strength: 0, center: CENT_REF_HZ, width: 1200,
        cutoff: tp === "bassboost" ? Math.floor(s.nEl / 3) : Math.floor((s.nEl * 2) / 3),
      };
    });
  } else {
    s.presets = PR_TYPES.map((tp) => ({
      type: tp,
      on: false,
      strength: 0,
      center: CENT_REF_HZ,
      width: 1200,
      cutoff:
        tp === "bassboost"
          ? Math.floor(s.nEl / 3)
          : Math.floor((s.nEl * 2) / 3),
    }));
  }
  // elFreqOwn: split loaded freqs vs defaults
  if (d.electrodeFreqOwn) {
    s.elFreqOwn = [...d.electrodeFreqOwn];
  } else {
    const defF = MFR[s.manufacturer].freqs;
    s.elFreqOwn = s.freqs.map((f, i) =>
      Math.round(f) === Math.round(defF[i] || 0) ? null : f,
    );
  }
  console.log(
    "loadOldFormat fertig, nEl=",
    s.nEl,
    "bRes.length=",
    s.bRes.length,
  );
}

function loadJson(file) {
  const r = new FileReader();
  r.onload = (e) => {
    try {
      const d = JSON.parse(e.target.result);

      // Neues Format (mit sides)
      if (d.sides && d.sides.left && d.sides.right) {
        loadSideData("left", d.sides.left);
        loadSideData("right", d.sides.right);
        activeSide = SIDES.includes(d.currentSide) ? d.currentSide : "left";
        applyLoadedData(d);
        // BA 149
        if (typeof depLockApply === 'function') depLockApply();
      }
      // Altes Format – Modal zur Seitenwahl anzeigen
      else {
        const overlay = document.getElementById("loadSideOverlay");
        overlay.classList.add("active");
        const doLoad = (side) => {
          overlay.classList.remove("active");
          loadOldFormat(d, side);
          activeSide = side;
          applyLoadedData(d);
          // BA 149
          if (typeof depLockApply === 'function') depLockApply();
        };
        document.getElementById("loadSideLeft").onclick = () => doLoad("left");
        document.getElementById("loadSideRight").onclick = () =>
          doLoad("right");
        document.getElementById("loadSideCanc").onclick = () => {
          overlay.classList.remove("active");
          document.getElementById("fInput").value = "";
        };
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
      if (s.presets && Array.isArray(s.presets)) {
        s.presets = _migratePresetsFromIndexToFreq(
          s.presets,
          [...s.freqs],
          s.elFreqOwn,
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
                || TEST_DEFAULTS.test.sequence;
  if (typeof sequence_freqmatch !== "undefined") {
    sequence_freqmatch = _validSeq(d.sequence_freqmatch) || _legacySeq;
  }
  if (typeof sequence_test !== "undefined") {
    sequence_test = _validSeq(d.sequence_test) || _legacySeq;
  }
  if (typeof sequence_balance !== "undefined") {
    sequence_balance = _validSeq(d.sequence_balance) || _legacySeq;
  }
  if (d.slTarget_balance) slTarget_balance = d.slTarget_balance;
  if (typeof d.plBothSides === "boolean") {
    const bsEl = document.getElementById("plBothSides");
    if (bsEl) bsEl.checked = d.plBothSides;
  }
  if (d.eqOn !== undefined) {
    plEqOn = d.eqOn;
    updEqToggleBtn();
  }
  if (d.eqStrength !== undefined) setVal("plStr", d.eqStrength);
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
  if (typeof toneType_test !== "undefined") {
    if (isValidToneType(d.toneType_test)) {
      toneType_test = d.toneType_test;
    } else if (isValidToneType(d.globalToneType)) {
      toneType_test = d.globalToneType;
    } else {
      toneType_test = TEST_DEFAULTS.test.toneType;
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
  if (typeof duration_test !== "undefined") {
    var _du = parseInt(d.duration_test, 10);
    duration_test = (isFinite(_du) && _du >= 100 && _du <= 3000) ? _du : TEST_DEFAULTS.test.duration;
  }
  if (typeof pause_test !== "undefined") {
    var _pa = parseInt(d.pause_test, 10);
    pause_test = (isFinite(_pa) && _pa >= 50 && _pa <= 2000) ? _pa : TEST_DEFAULTS.test.pause;
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
  if (typeof toneType_balance !== "undefined") {
    if (isValidToneType(d.toneType_balance)) {
      toneType_balance = d.toneType_balance;
    } else if (isValidToneType(d.globalToneType)) {
      toneType_balance = d.globalToneType;
    } else {
      toneType_balance = TEST_DEFAULTS.balance.toneType;
    }
  }
  if (typeof duration_balance !== "undefined") {
    var _dB = parseInt(d.duration_balance, 10);
    duration_balance = (isFinite(_dB) && _dB >= 100 && _dB <= 3000) ? _dB : TEST_DEFAULTS.balance.duration;
  }
  if (typeof pause_balance !== "undefined") {
    var _pB = parseInt(d.pause_balance, 10);
    pause_balance = (isFinite(_pB) && _pB >= 50 && _pB <= 2000) ? _pB : TEST_DEFAULTS.balance.pause;
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
  if (typeof lrResults !== "undefined" && d.lrResults) {
    Object.keys(lrResults).forEach((k) => delete lrResults[k]);
    Object.assign(lrResults, d.lrResults);
    if (typeof lrRenderResults === "function") lrRenderResults();
    if (typeof lrApplyMeanToBalance === "function") lrApplyMeanToBalance();
  }
  if (typeof lrSnapshot !== "undefined") {
    lrSnapshot = (d && d.lrSnapshot) ? d.lrSnapshot : null; // BA 156
  }
  if (typeof latencyResult !== "undefined") {
    latencyResult = (d && d.latencyResult) ? d.latencyResult : null;
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
  if (typeof latApplyToPlayer === "function") latApplyToPlayer();
  if (typeof latRenderResults === "function") latRenderResults();
  if (typeof fRes !== "undefined") {
    if (Array.isArray(d.fRes)) {
      // BA 106: KEIN fmStatus-Filter mehr — alle Einträge übernehmen.
      // _fmCleanupLegacyFRes() entfernt Alt-Adaptive-Schema-Einträge
      // (mit fmConvUp etc.). _fmMigrateAltSliderFRes() überführt
      // Alt-Slider-Einträge (ohne fmStatus) nach
      // freqmatchAdaptive.sliderEstimates, damit sie als Startwerte
      // für den adaptiven Test verfügbar sind.
      fRes.splice(0, fRes.length, ...d.fRes);
    } else {
      fRes.splice(0, fRes.length); // keine fRes im JSON → zurücksetzen
    }
    if (typeof _fmCleanupLegacyFRes === "function") _fmCleanupLegacyFRes();
    if (typeof _fmMigrateAltSliderFRes === "function") _fmMigrateAltSliderFRes();
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
    if (d.warpStrength !== undefined) {
      pWarpStrength = d.warpStrength;
      const ws = document.getElementById("plWarpStr");
      if (ws) ws.value = pWarpStrength;
    }
    const modeSel = document.getElementById("plWarpModeSelect");
    if (modeSel) modeSel.value = pWarpMode;
    pWarpedBuf = null;
    if (typeof pWarpUpdUI === "function") pWarpUpdUI();
  }
  if (typeof pRubberbandOptions !== "undefined"
      && d.warpRbOptions && typeof d.warpRbOptions === "object") {
    if (typeof d.warpRbOptions.engine === "string") {
      pRubberbandOptions.engine = (d.warpRbOptions.engine === "r2") ? "r2" : "r3";
    }
    if (typeof d.warpRbOptions.material === "string") {
      const m = d.warpRbOptions.material;
      pRubberbandOptions.material = (m === "speech" || m === "percussive") ? m : "standard";
    }
    if (typeof d.warpRbOptions.formant === "boolean") {
      pRubberbandOptions.formant = d.warpRbOptions.formant;
    }
    if (typeof d.warpRbOptions.fast === "boolean") {
      pRubberbandOptions.fast = d.warpRbOptions.fast;
    }
    const rE = document.querySelector('input[name="plWarpEngine"][value="' + pRubberbandOptions.engine + '"]');
    if (rE) rE.checked = true;
    const rM = document.querySelector('input[name="plWarpMaterial"][value="' + pRubberbandOptions.material + '"]');
    if (rM) rM.checked = true;
    const cF = document.getElementById("plWarpFormant");
    if (cF) cF.checked = !!pRubberbandOptions.formant;
    const cS = document.getElementById("plWarpFast");
    if (cS) cS.checked = !!pRubberbandOptions.fast;
    if (typeof _pRbOptUpdateR3Hint === "function") _pRbOptUpdateR3Hint();
  }
  // BA 177: wenn Save-Daten Frequenzabgleich-Messungen enthielten,
  // den Default-Anwendungs-Flag setzen, damit der nächste Insert
  // den gespeicherten pWarpMode nicht überschreibt.
  try {
    const _hasFm =
      (Array.isArray(fRes) && fRes.length > 0)
      || (typeof _fmHasSliderEstimates === "function" && _fmHasSliderEstimates())
      || (typeof _fmHasAdaptiveData === "function" && _fmHasAdaptiveData());
    if (_hasFm && typeof pMarkPlayerWarpDefaultAsApplied === "function") {
      pMarkPlayerWarpDefaultAsApplied();
    }
  } catch (e) { /* defensiv */ }
  if (typeof d.plMaplawOn === "boolean") pMaplawOn = d.plMaplawOn;
  if (typeof d.plMaplawSollC === "number") pMaplawSollC = d.plMaplawSollC;
  if (typeof d.playerShowExperimental === "boolean") plShowExperimental = d.playerShowExperimental;
  if (typeof plActiveSource !== "undefined") {
    plActiveSource = (d && typeof d.plActiveSource === "string"
                      && ["music", "sentences", "noise", "audiobook"].includes(d.plActiveSource))
      ? d.plActiveSource : "music";
    }
  if (typeof d.plAutoAdvance === "boolean")  plAutoAdvance  = d.plAutoAdvance;
  if (typeof d.plLoop        === "boolean")  plLoop         = d.plLoop;
  if (typeof d.plShuffle     === "boolean")  plShuffle     = d.plShuffle;
  if (typeof d.plPauseMs     === "number" && d.plPauseMs >= 0) plPauseMs = d.plPauseMs;
  if (typeof d.plSentShowText === "boolean") plSentShowText = d.plSentShowText;
  if (typeof d.plNoiseSelectedId === "string") plNoiseSelectedId = d.plNoiseSelectedId;
  if (typeof d.plNoiseSortAxis   === "string") plNoiseSortAxis   = d.plNoiseSortAxis;
  if (typeof d.plNoiseCategory   === "string") plNoiseCategory   = d.plNoiseCategory;
  if (typeof d.plNoiseSearchQuery === "string") plNoiseSearchQuery = d.plNoiseSearchQuery;
  if (typeof d.plSentBgEnabled === "boolean") plSentBgEnabled = d.plSentBgEnabled;
  if (typeof d.plSentBgItemId  === "string")  plSentBgItemId  = d.plSentBgItemId;
  if (typeof d.plSentBgSnrDb   === "number")  plSentBgSnrDb   = d.plSentBgSnrDb;
  if (typeof d.plBookSelectedId === "string") plBookSelectedId = d.plBookSelectedId;
  if (typeof d.plBookChapterIdx === "number") plBookChapterIdx = d.plBookChapterIdx;
  if (typeof d.plBookSortAxis   === "string") plBookSortAxis   = d.plBookSortAxis;
  if (d.plBookPositions && typeof d.plBookPositions === "object") {
    plBookPositions = Object.assign({}, d.plBookPositions);
  }
  if (typeof d.plMusicSelectedId  === "string") plMusicSelectedId  = d.plMusicSelectedId;
  if (typeof d.plMusicSortAxis    === "string") plMusicSortAxis    = d.plMusicSortAxis;
  if (typeof d.plMusicCategory    === "string") plMusicCategory    = d.plMusicCategory;
  if (typeof d.plMusicSearchQuery === "string") plMusicSearchQuery = d.plMusicSearchQuery;
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
  buildFreqTable();
  renderResults();
  if (typeof renderFreqMatchResults === "function") renderFreqMatchResults();
  if (typeof fmRefreshResumeHint === "function") fmRefreshResumeHint();
  if (typeof fmApplyLang === "function") fmApplyLang();
  if (typeof _fmRefreshTabState === "function") _fmRefreshTabState();
  if (typeof lrRefreshElectrodeSelectionSummary === "function") lrRefreshElectrodeSelectionSummary();
  if (typeof fmRefreshElectrodeSelectionSummary === "function") fmRefreshElectrodeSelectionSummary();
  if (typeof testRefreshElectrodeSelectionSummary === "function") testRefreshElectrodeSelectionSummary();
  if (typeof lrRefreshToneTypeLabel === "function") lrRefreshToneTypeLabel();
  if (typeof fmRefreshToneTypeLabel === "function") fmRefreshToneTypeLabel();
  if (typeof testRefreshToneTypeLabel === "function") testRefreshToneTypeLabel();
  if (typeof buildPrTbl === "function") buildPrTbl();
  if (typeof drawLvChart === "function") drawLvChart();
  if (typeof d.levelsTabShowMeas === "boolean") lvTabShowMeas = d.levelsTabShowMeas;
  if (typeof d.levelsTabShowCurves === "boolean") lvTabShowCurves = d.levelsTabShowCurves;
  if (typeof d.levelsTabMode === "string") lvTabMode = d.levelsTabMode;
  if (typeof d.levelsTabVariant === "string") lvTabVariant = d.levelsTabVariant;
  if (typeof lvTabUpdateModeAvailability === "function") lvTabUpdateModeAvailability();
  if (typeof lvTabRebuild === "function" &&
      document.getElementById("panel-schieber")?.classList.contains("active")) {
    lvTabRebuild();
  }
  if (typeof updFClearBtn === "function") updFClearBtn();
  if (typeof buildImplantCard === "function") buildImplantCard();
  if (pEqF && pEqF.length > 0) pUpdEQ();
  updSideButtons();
  const fi = gEl("fInput");
  if (fi) fi.value = "";
  if (Array.isArray(d.localCollections)
      && typeof sRestoreLocalCollections === "function") {
    sRestoreLocalCollections(d.localCollections);
  }
  const MIGR_TYPES = ["tilt", "scurve", "pivot", "gauss"];
  const sideHasMeaningfulMigration = (side) =>
    sideData[side]._presetsMigrated === true &&
    (sideData[side].presets || []).some(
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
  sideData[activeSide].bRes.splice(0, sideData[activeSide].bRes.length);
  sideData[activeSide].fullSweepRound = null;
  sideData[activeSide].fullSweepDonePairs = [];
  bRes = sideData[activeSide].bRes;
  fullSweepRound = null;
  fullSweepDonePairs = [];
  renderResults();
  pUpdEQ();
}

function exportEasyEffects() {
  const gains = getPlayerGains();
  const mode = getPlayerSide();
  const str = parseInt(document.getElementById("plStr").value) / 100;
  const nhSim = document.getElementById("plNHSim").checked;
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
  // Gains pro Kanal ermitteln
  let leftArr, rightArr, splitChannels;
  if (mode === "both") {
    // Echtes Stereo: L und R unterschiedliche Kurven
    leftArr = gains.left || [];
    rightArr = gains.right || [];
    splitChannels = true;
  } else {
    // Mono oder eine Seite: beide Kanäle gleich
    const arr = Array.isArray(gains) ? gains : [];
    leftArr = arr;
    rightArr = arr;
    splitChannels = false;
  }
  const hasGain = (arr) => arr.some((v) => v !== 0);
  if (!(hasGain(leftArr) || hasGain(rightArr)) && !plEqOn) {
    alert(t("plNoData"));
    return;
  }
  const left = {},
    right = {};
  for (let i = 0; i < nEl; i++) {
    const gL = plEqOn
      ? nhSim
        ? (leftArr[i] || 0) * str
        : -(leftArr[i] || 0) * str
      : 0;
    const gR = plEqOn
      ? nhSim
        ? (rightArr[i] || 0) * str
        : -(rightArr[i] || 0) * str
      : 0;
    left["band" + i] = makeBand(effFreq(i), gL, pCompQ(i));
    right["band" + i] = makeBand(effFreq(i), gR, pCompQ(i));
  }
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
        "split-channels": splitChannels,
        "num-bands": nEl,
      },
      plugins_order: ["equalizer#0"],
    },
  };
  const blob = new Blob([JSON.stringify(preset, null, 4)], {
      type: "application/json",
    }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = buildCImbelFilename("easyeffects", null, ".json");
  a.click();
}

