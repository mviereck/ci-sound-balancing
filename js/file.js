// ============================================================
// FILE OPERATIONS
// ============================================================

function _safeUserFileSuffix() {
  if (typeof userFileSuffix !== "string") return "";
  const s = userFileSuffix.trim();
  if (!s) return "";
  return s.replace(/[\s\/\\:*?"<>|\x00-\x1F]/g, "_");
}

function _applyUserFileSuffix(name) {
  const suf = _safeUserFileSuffix();
  if (!suf) return name;
  const dot = name.lastIndexOf(".");
  if (dot < 0) return name + "_" + suf;
  return name.slice(0, dot) + "_" + suf + name.slice(dot);
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
    sideData[s].jRes = [];
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
  document.getElementById("vol1").value = "50";
  document.getElementById("dur1").value = "1000";
  document.getElementById("pau1").value = "500";
  globalSequence = "aba";
  slTarget_test = "balance";
  slTarget_balance = "both";
  if (typeof globalToneType !== "undefined") globalToneType = "complex";
  if (typeof syncAllGlobalDropdowns === "function") syncAllGlobalDropdowns();
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
    pWarpMethod = "rubberband";
    const _ws  = document.getElementById("plWarpStr");
    if (_ws) _ws.value = pWarpStrength;
    const _wm  = document.getElementById("plWarpMethod");
    if (_wm) _wm.value = pWarpMethod;
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
        judgmentResults: sideData.left.jRes,
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
        judgmentResults: sideData.right.jRes,
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
    paradigm: globalSequence,
    toneDuration: parseInt(document.getElementById("dur1").value),
    pauseDuration: parseInt(document.getElementById("pau1").value),
    volume: document.getElementById("vol1").value,
    globalSequence: globalSequence,
    slTarget_test: slTarget_test,
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
    globalToneType: globalToneType,
    warpOn: (typeof pWarpOn !== "undefined") ? pWarpOn : false,
    warpMode: (typeof pWarpMode !== "undefined") ? pWarpMode : "right",
    warpStrength: (typeof pWarpStrength !== "undefined") ? pWarpStrength : 100,
    warpMethod: (typeof pWarpMethod !== "undefined") ? pWarpMethod : "rubberband",
    plMaplawOn: (typeof pMaplawOn !== "undefined") ? pMaplawOn : false,
    plMaplawSollC: (typeof pMaplawSollC !== "undefined") ? pMaplawSollC : 1000,
    playerShowExperimental: (typeof plShowExperimental !== "undefined") ? plShowExperimental : false,
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
    audiologUserNote: (typeof audiologUserNote !== "undefined") ? audiologUserNote : "",
  };
  const blob = new Blob([JSON.stringify(d, null, 2)], {
    type: "application/json",
  });
  const now = new Date(),
    ds = now.toISOString().slice(0, 10),
    ts = now
      .toLocaleTimeString(lang === "de" ? "de-DE" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(":", "");
  const fn = _applyUserFileSuffix(`ci-sound-balancing-${ds}-${ts}.json`);
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

  // Referenzelektrode
  s.refEl =
    d.referenceElectrode !== undefined && d.referenceElectrode < s.nEl
      ? d.referenceElectrode
      : Math.floor(s.nEl / 2);

  // Messergebnisse
  s.jRes = d.judgmentResults ? [...d.judgmentResults] : [];
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
  // paradigm/sequence
  if (d.globalSequence) globalSequence = d.globalSequence;
  else if (d.paradigm) globalSequence = (d.paradigm === "aba" || d.paradigm === "ab") ? d.paradigm : "aba";
  if (d.slTarget_test) slTarget_test = d.slTarget_test;
  if (d.slTarget_balance) slTarget_balance = d.slTarget_balance;
  if (d.toneDuration) setVal("dur1", d.toneDuration);
  if (d.pauseDuration) setVal("pau1", d.pauseDuration);
  if (d.volume) setVal("vol1", d.volume);
  if (typeof d.plBothSides === "boolean") {
    const bsEl = document.getElementById("plBothSides");
    if (bsEl) bsEl.checked = d.plBothSides;
  }
  if (d.eqOn !== undefined) {
    plEqOn = d.eqOn;
    updEqToggleBtn();
  }
  if (d.eqStrength !== undefined) setVal("plStr", d.eqStrength);
  const VALID_TONE_TYPES = ["sine", "complex", "pulsedComplex", "noise",
    "noiseAdaptive", "amSine", "warbleSine", "burstSine", "wobbleSweep"];
  globalToneType = VALID_TONE_TYPES.includes(d.globalToneType)
    ? d.globalToneType : "complex";
  // Sync global dropdowns (alle drei Test-Instanzen)
  if (typeof syncAllGlobalDropdowns === "function") syncAllGlobalDropdowns();
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
    if (d.warpMethod !== undefined && typeof pWarpMethod !== "undefined") {
      pWarpMethod = d.warpMethod;
      const methodSel = document.getElementById("plWarpMethod");
      if (methodSel) methodSel.value = pWarpMethod;
    }
    const modeSel = document.getElementById("plWarpModeSelect");
    if (modeSel) modeSel.value = pWarpMode;
    pWarpedBuf = null;
    if (typeof pWarpUpdUI === "function") pWarpUpdUI();
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
  if (typeof pApplyShowExperimental === "function") pApplyShowExperimental();
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
  if (typeof pMaplawTrigger === "function") pMaplawTrigger();
  if (typeof d.userFileSuffix === "string") {
    userFileSuffix = d.userFileSuffix;
    const _el = document.getElementById("userFileSuffix");
    if (_el) _el.value = userFileSuffix;
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
  sideData[activeSide].jRes.splice(0, sideData[activeSide].jRes.length);
  sideData[activeSide].bRes.splice(0, sideData[activeSide].bRes.length);
  sideData[activeSide].fullSweepRound = null;
  sideData[activeSide].fullSweepDonePairs = [];
  jRes = sideData[activeSide].jRes;
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
  a.download = _applyUserFileSuffix("ci-sound-balancing-easyeffects.json");
  a.click();
}

