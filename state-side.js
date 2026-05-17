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
  manualLevels,
  refEl,
  jRes,
  bRes,
  config;
// effFreq[i] = elFreqOwn[i] ?? freqs[i] (MFR default)
function effFreq(i) {
  return elFreqOwn && elFreqOwn[i] != null ? elFreqOwn[i] : freqs[i];
}
let lvFocus = 0;
let defaultMfr = "medel"; // Frequenzraster-Default wenn keine Seite CI ist

let presets = [];
let fullSweepRound = null,
  fullSweepDonePairs = [];
function initPresets() {
  const centerMap = { medel: 5.5, ab: 7.5, cochlear: 10.5 };
  const defaultCenter = centerMap[mfr] || Math.floor(nEl / 2);
  presets = PR_TYPES.map((tp) => ({
    type: tp,
    on: false,
    strength: 0,
    center: defaultCenter,
    width: Math.max(2, Math.floor(nEl / 4)),
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
  manualLevels = s.manualLevels;
  presets = s.presets;
  refEl = s.refEl;
  jRes = s.jRes;
  bRes = s.bRes;
  config = s.config || "ci";
  fullSweepRound = s.fullSweepRound !== undefined ? s.fullSweepRound : null;
  fullSweepDonePairs = s.fullSweepDonePairs || [];
}
function initSideData(side, m) {
  const s = sideData[side];
  s.config = s.config || "ci"; // bewahren wenn schon gesetzt, sonst Default
  s.manufacturer = m || "medel";
  s.nEl = MFR[s.manufacturer].n;
  s.freqs = [...MFR[s.manufacturer].freqs];
  s.elSt = new Array(s.nEl).fill(null);
  s.elNt = new Array(s.nEl).fill("");
  s.elExDur = new Array(s.nEl).fill(null);
  s.elFreqOwn = new Array(s.nEl).fill(null);
  s.manualLevels = new Array(s.nEl).fill(0);
  s.refEl = Math.floor(s.nEl / 2);
  s.jRes = [];
  s.bRes = [];
  s.fullSweepRound = null;
  s.fullSweepDonePairs = [];
  s.implant = {
    model: "",
    processor: "",
    cValue: null,
    idr: null,
    iidr: null,
    generation: null,
    mcl: new Array(s.nEl).fill(null),
    thr: new Array(s.nEl).fill(null),
    upperLevel: new Array(s.nEl).fill(null),
  };
  activeSide = side;
  bindActiveSide();
  initPresets();
  s.presets = presets;
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
  const dfSel = document.getElementById("defaultMfrSelect");
  if (dfSel) dfSel.value = defaultMfr;
  buildFreqTable();
  buildPrTbl();
  drawLvChart();
  if (typeof lvTabRebuild === "function") lvTabRebuild();
  renderResults();
  buildImplantCard();
  updSideButtons();
  updFClearBtn();
  updPlSrcButtons();
  if (pBuf) updatePlayerForSideChange();
  else plCheck();
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
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
  // Deactivated: ensure elExDur is set
  for (let _i = 0; _i < s.elSt.length; _i++) {
    if (s.elSt[_i] === "deactivated") {
      s.elExDur[_i] = s.elExDur[_i] || Date.now();
    }
  }
  s.refEl =
    d.referenceElectrode !== undefined
      ? d.referenceElectrode
      : Math.floor(s.nEl / 2);
  s.jRes = d.judgmentResults || [];
  s.bRes = d.balanceResults || [];
  s.manualLevels = d.manualLevels || new Array(s.nEl).fill(0);
  s.presets = d.presets || s.presets;
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
    iidr: di.iidr !== undefined && di.iidr !== null ? di.iidr : null,
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
  // Mean aus lrResults berechnen (lrResults ist global in lr-balance.js)
  if (typeof lrResults === "undefined") return 0;
  const vals = Object.values(lrResults).filter((v) => isFinite(v));
  if (!vals.length) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  // Positive mean = right louder → negative balance offset (rechts dämpfen)
  return Math.max(-60, Math.min(60, parseFloat((-mean).toFixed(1))));
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
    manualLevels,
    presets,
    refEl,
    jRes,
    bRes,
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
let _syncInProgress = false;
function syncFreqsToAcoustic() {
  if (_syncInProgress) return;
  _syncInProgress = true;
  try {
    const src = getFreqSource();
    if (src) {
      // Eine CI-Seite ist Quelle: andere Seite(n) spiegeln
      const other = src === "left" ? "right" : "left";
      if ((sideData[other].config || "ci") !== "ci") {
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
        ["elSt","elNt","elExDur","manualLevels"].forEach(k => {
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
            cValue: null, idr: null, iidr: null, generation: null,
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
            ["elSt","elNt","elExDur","manualLevels"].forEach(k => {
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
  if (cfg !== "ci") {
    // Wenn akustisch/taub: Daten dieser Seite bleiben, Frequenzen werden synchronisiert
    syncFreqsToAcoustic();
  } else {
    // Wenn zurück zu CI: unabhängig werden – Frequenzen auf Default zurücksetzen
    const s = sideData[side];
    s.manufacturer = s.manufacturer || "medel";
    s.nEl = MFR[s.manufacturer].n;
    s.freqs = [...MFR[s.manufacturer].freqs];
    // Andere nicht-CI-Seite ebenfalls sync
    syncFreqsToAcoustic();
  }
  bindActiveSide();
}
initSideData("left", "medel");
initSideData("right", "medel");
activeSide = "left";
bindActiveSide();
updateMfrSelectLabels();

let audioCtx = null,
  curOsc = null,
  playTO = null,
  sweepAct = false,
  isPlay = false,
  holdIdx = -1;
let testAct = false,
  testPairs = [],
  testIdx = 0,
  testMode = "balance",
  curPlayed = false,
  curBase = 0,
  slExt = false;
let curA = -1,
  curB = -1,
  undoSt = [],
  tStart = 0,
  tInt = null,
  compCnt = 0,
  convRnd = 0;

let globalToneType = "warbleSine"; // "sine" | "complex" | "noise" | ...
let globalSequence = "aba";       // "aba" | "ab"
let slTarget_test = "balance";    // "a" | "b" | "balance"
let slTarget_balance = "both";    // "left" | "right" | "both"

// Frequenzabgleich-Ergebnisse (global, nicht pro Seite)
// { varSide, refSide, elIdx, varFreq, refFreq, timestamp }
let fRes = [];

let plEqOn = true; // EQ toggle state
let plApplyBalance = true; // Stereo-Balance anwenden
let plSrcMeas = true,
  plSrcLevels = true,
  plSrcCurves = true; // EQ source toggles

let lvTabShowMeas = false;
let lvTabShowCurves = false;
let lvTabMode = "rel";    // "rel" = relativ (±dB), "abs" = absolut (qu/CL/CU)
let lvTabVariant = "stack"; // "stack" = gestapelt, "sum" = nur Summe, "lines" = Summe + Vergleichslinien

