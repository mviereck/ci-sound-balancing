// ============================================================
// FILE OPERATIONS
// ============================================================
function expText() {
  const ls = [],
    now = new Date().toLocaleString(lang === "de" ? "de-DE" : "en-US"),
    vol = document.getElementById("vol1").value;
  ls.push(`CI Sound Balancing – ${now}`);
  ls.push(
    `${MFR[mfr].name} (${nEl}) | ${t("lblVol")} ${vol}% | Ref: ${dENPrefix()}${dEN(refEl)}`,
  );
  const TONE_LABEL_KEY = {
    sine: "toneSine", complex: "toneComplex", noise: "toneNoise",
    noiseAdaptive: "toneNoiseAdaptive", amSine: "toneAmSine",
    warbleSine: "toneWarbleSine", burstSine: "toneBurstSine",
    wobbleSweep: "toneWobbleSweep"
  };
  const toneLabel = t(TONE_LABEL_KEY[globalToneType] || "toneSine");
  ls.push(`${t("toneTypeLabel")}: ${toneLabel}`);
  ls.push("");
  if (bRes.length > 0) {
    const { levels, elRes } = compWLS();
    ls.push(
      `${t("thEl")}  ${t("thHz")}      ${t("thOff")}     ${t("thRes")}   ${t("thStR")}`,
    );
    ls.push("───  ────────  ─────────  ────────  ──────");
    for (let i = 0; i < nEl; i++) {
      const st = elSt[i] || "",
        n = elNt[i] ? ` (${elNt[i]})` : "";
      const hd = bRes.some((r) => r.a === i || r.b === i);
      ls.push(
        `${String(dEN(i)).padStart(3)}  ${String(Math.round(effFreq(i))).padStart(5)} Hz  ${!hd ? "    —    " : ((levels[i] >= 0 ? "+" : "") + levels[i].toFixed(1) + " dB").padStart(9)}  ${!hd ? "  —   " : (elRes[i].toFixed(1) + " dB").padStart(8)}  ${st}${n}`,
      );
    }
  }
  const eff = getEffectiveLevels();
  if (eff.some((v) => v !== 0)) {
    ls.push("");
    ls.push("Levels:");
    for (let i = 0; i < nEl; i++)
      ls.push(
        `  ${dENPrefix()}${dEN(i)} (${Math.round(effFreq(i))} Hz): ${(eff[i] >= 0 ? "+" : "") + eff[i].toFixed(1)} dB`,
      );
  }
  // Player-Warp-Einstellungen (nur wenn aktiv)
  if (typeof pWarpOn !== "undefined" && pWarpOn) {
    const _wm = (typeof pWarpMethod !== "undefined") ? pWarpMethod : "offline";
    const _n  = fRes ? fRes.length : 0;
    const _statusKey = _wm === "bandshift" ? "pwStatusActiveBandShift"
                     : _wm === "vocoder"   ? "pwStatusActiveVocoder"
                     : "pwStatusActiveOffline";
    if (_wm === "offline" && !pWarpedBuf) {
      // Offline ohne vorberechneten Buffer → nicht ausgeben
    } else {
      ls.push("");
      ls.push("Frequenz-Warping: " + t(_statusKey).replace("{n}", _n));
      const modeKey = pWarpMode === "ref_side" ? "pwModeRef" : pWarpMode === "var_side" ? "pwModeVar" : "pwModeSym";
      ls.push("Modus: " + t(modeKey));
      ls.push("Stärke: " + (typeof pWarpStrength !== "undefined" ? pWarpStrength : 100) + "%");
    }
  }
  // Frequenzabgleich-Ergebnisse
  if (typeof fRes !== "undefined" && fRes.length > 0) {
    ls.push("");
    ls.push(t("fmResultsTitle") + ":");
    ls.push(
      `${t("fmResColEl").padEnd(5)}  ${t("fmResColVarFreq").padStart(8)}  ${t("fmResColRefFreq").padStart(8)}  ${t("fmResColCent").padStart(10)}`
    );
    ls.push("─────  ────────  ────────  ──────────");
    for (const r of fRes) {
      const varSideLabel = r.varSide === "left" ? t("sideLeft") : t("sideRight");
      const cent = 1200 * Math.log2(r.refFreq / r.varFreq);
      const centStr = (cent >= 0 ? "+" : "") + Math.round(cent) + " " + t("fmCentUnit");
      const elNum = withSide(r.varSide, () => dEN(r.elIdx));
      const elPfxExp = withSide(r.varSide, () => dENPrefix());
      ls.push(
        `${elPfxExp}${String(elNum).padEnd(4)}  ${String(Math.round(r.varFreq)).padStart(5)} Hz  ${String(Math.round(r.refFreq)).padStart(5)} Hz  ${centStr.padStart(10)}  (${varSideLabel})`
      );
    }
  }
  return ls.join("\n");
}
function copyRes() {
  navigator.clipboard
    .writeText(expText())
    .then(() => alert(t("copyDone")))
    .catch(() => {
      const ta = document.createElement("textarea");
      ta.value = expText();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert(t("copyDone"));
    });
}
function resetAll() {
  const ch = confirm(t("resetConfirm"));
  if (!ch) return;
  // Reset both sides completely
  for (const s of SIDES) {
    sideData[s].config = "ci"; // vor initSideData setzen, damit es bewahrt wird
    sideData[s].manufacturer = "medel";
    sideData[s].nEl = MFR["medel"].n;
    sideData[s].freqs = [...MFR["medel"].freqs];
    sideData[s].elSt = new Array(sideData[s].nEl).fill(null);
    sideData[s].elNt = new Array(sideData[s].nEl).fill("");
    sideData[s].elExDur = new Array(sideData[s].nEl).fill(null);
    sideData[s].elFreqOwn = new Array(sideData[s].nEl).fill(null);
    sideData[s].manualLevels = new Array(sideData[s].nEl).fill(0);
    sideData[s].refEl = Math.floor(sideData[s].nEl / 2);
    sideData[s].jRes = [];
    sideData[s].bRes = [];
    sideData[s].presets = [];
    initSideData(s, "medel");
  }
  defaultMfr = "medel";
  activeSide = "left";
  bindActiveSide();
  document.getElementById("ciSideSelect").value = "left";
  document.getElementById("mfrSelect").value = "medel";
  const cfgSelR = document.getElementById("cfgSelect");
  if (cfgSelR) cfgSelR.value = "ci";
  const dfSelR = document.getElementById("defaultMfrSelect");
  if (dfSelR) dfSelR.value = "medel";
  document.getElementById("vol1").value = "50";
  document.getElementById("dur1").value = "1000";
  document.getElementById("pau1").value = "500";
  globalSequence = "aba";
  slTarget_test = "balance";
  slTarget_balance = "both";
  if (typeof latencyResult !== "undefined") latencyResult = null;
  if (typeof plApplyLatency !== "undefined") plApplyLatency = true;
  if (typeof latApplyToPlayer === "function") latApplyToPlayer();
  if (typeof latRenderResults === "function") latRenderResults();
  buildFreqTable();
  buildPrTbl();
  drawLvChart();
  renderResults();
  alert(t("resetDone"));
}

async function saveJson() {
  const d = {
    version: APP_VERSION,
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
        electrodeNotes: sideData.left.elNt,
        electrodeExcludedDuring: sideData.left.elExDur,
        referenceElectrode: sideData.left.refEl,
        judgmentResults: sideData.left.jRes,
        balanceResults: sideData.left.bRes,
        manualLevels: sideData.left.manualLevels,
        presets: sideData.left.presets,
        fullSweepRound: sideData.left.fullSweepRound,
        fullSweepDonePairs: sideData.left.fullSweepDonePairs,
        implant: sideData.left.implant,
      },
      right: {
        config: sideData.right.config || "ci",
        manufacturer: sideData.right.manufacturer,
        frequencies: sideData.right.freqs,
        electrodeFreqOwn: sideData.right.elFreqOwn,
        electrodeStatus: sideData.right.elSt,
        electrodeNotes: sideData.right.elNt,
        electrodeExcludedDuring: sideData.right.elExDur,
        referenceElectrode: sideData.right.refEl,
        judgmentResults: sideData.right.jRes,
        balanceResults: sideData.right.bRes,
        manualLevels: sideData.right.manualLevels,
        presets: sideData.right.presets,
        fullSweepRound: sideData.right.fullSweepRound,
        fullSweepDonePairs: sideData.right.fullSweepDonePairs,
        implant: sideData.right.implant,
      },
    },
    currentSide: activeSide,
    lrResults: (typeof lrResults !== "undefined") ? lrResults : {},
    latencyResult: (typeof latencyResult !== "undefined") ? latencyResult : null,
    plApplyLatency: (typeof plApplyLatency !== "undefined") ? plApplyLatency : true,
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
    eqOn: plEqOn,
    eqStrength: parseInt(document.getElementById("plStr").value),
    globalToneType: globalToneType,
    warpOn: (typeof pWarpOn !== "undefined") ? pWarpOn : false,
    warpMode: (typeof pWarpMode !== "undefined") ? pWarpMode : "ref_side",
    warpStrength: (typeof pWarpStrength !== "undefined") ? pWarpStrength : 100,
    warpMethod: (typeof pWarpMethod !== "undefined") ? pWarpMethod : "offline",
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
  const fn = `loudness-balancing-v${APP_VERSION}-${ds}-${ts}.json`;
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
    s.presets = d.presets;
  } else {
    const centerMap = { medel: 5.5, ab: 7.5, cochlear: 10.5 };
    const defaultCenter = centerMap[s.manufacturer] || Math.floor(s.nEl / 2);
    s.presets = PR_TYPES.map((tp) => ({
      type: tp,
      on: false,
      strength: 0,
      center: defaultCenter,
      width: Math.max(2, Math.floor(s.nEl / 4)),
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
  // Deactivated: ensure elExDur is set
  for (let _i = 0; _i < s.elSt.length; _i++) {
    if (s.elSt[_i] === "deactivated") {
      s.elExDur[_i] = s.elExDur[_i] || Date.now();
    }
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

function applyLoadedData(d) {
  // defaultMfr laden
  if (d.defaultMfr && MFR[d.defaultMfr]) defaultMfr = d.defaultMfr;
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
  if (d.eqOn !== undefined) {
    plEqOn = d.eqOn;
    updEqToggleBtn();
  }
  if (d.eqStrength !== undefined) setVal("plStr", d.eqStrength);
  const VALID_TONE_TYPES = ["sine", "complex", "noise",
    "noiseAdaptive", "amSine", "warbleSine", "burstSine", "wobbleSweep"];
  globalToneType = VALID_TONE_TYPES.includes(d.globalToneType)
    ? d.globalToneType : "sine";
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
  if (typeof lrResults !== "undefined" && d.lrResults) {
    Object.keys(lrResults).forEach((k) => delete lrResults[k]);
    Object.assign(lrResults, d.lrResults);
    if (typeof lrRenderResults === "function") lrRenderResults();
    if (typeof lrApplyMeanToBalance === "function") lrApplyMeanToBalance();
  }
  if (typeof latencyResult !== "undefined") {
    latencyResult = (d && d.latencyResult) ? d.latencyResult : null;
  }
  if (typeof plApplyLatency !== "undefined") {
    plApplyLatency = (d && typeof d.plApplyLatency === "boolean")
      ? d.plApplyLatency : true;
  }
  if (typeof latApplyToPlayer === "function") latApplyToPlayer();
  if (typeof latRenderResults === "function") latRenderResults();
  if (typeof fRes !== "undefined") {
    if (Array.isArray(d.fRes)) {
      fRes.splice(0, fRes.length, ...d.fRes);
    } else {
      fRes.splice(0, fRes.length); // keine fRes im JSON → zurücksetzen
    }
  }
  // Warp-Einstellungen laden (Buffer wird nicht gespeichert – neu berechnen bei Bedarf)
  if (typeof pWarpOn !== "undefined") {
    if (d.warpOn !== undefined) {
      pWarpOn = false; // Warp beim Laden immer deaktiviert starten
    }
    if (d.warpMode !== undefined) pWarpMode = d.warpMode;
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
    const warpCb = document.getElementById("plWarpOn");
    if (warpCb) warpCb.checked = false;
    const modeSel = document.getElementById("plWarpModeSelect");
    if (modeSel) modeSel.value = pWarpMode;
    pWarpedBuf = null;
    if (typeof pWarpUpdUI === "function") pWarpUpdUI();
  }
  if (typeof d.plMaplawOn === "boolean") pMaplawOn = d.plMaplawOn;
  if (typeof d.plMaplawSollC === "number") pMaplawSollC = d.plMaplawSollC;
  if (typeof d.playerShowExperimental === "boolean") plShowExperimental = d.playerShowExperimental;
  if (typeof pApplyShowExperimental === "function") pApplyShowExperimental();
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
  if (typeof pMaplawTrigger === "function") pMaplawTrigger();
  buildFreqTable();
  renderResults();
  if (typeof renderFreqMatchResults === "function") renderFreqMatchResults();
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
  const msgCount = (bRes && bRes.length) || 0;
  const sideLabel = activeSide === "left" ? "Links" : "Rechts";
  alert(`Geladen: ${msgCount} Messungen auf Seite ${sideLabel}`);
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
  a.download = "ci-correction-easyeffects.json";
  a.click();
}

