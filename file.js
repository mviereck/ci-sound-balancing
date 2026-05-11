// ============================================================
// FILE OPERATIONS
// ============================================================
function expText() {
  const ls = [],
    now = new Date().toLocaleString(lang === "de" ? "de-DE" : "en-US"),
    vol = document.getElementById("vol2").value;
  ls.push(`CI Sound Balancing – ${now}`);
  ls.push(
    `${MFR[mfr].name} (${nEl}) | ${t("lblVol")} ${vol}% | Ref: E${dEN(refEl)}`,
  );
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
        `  E${dEN(i)} (${Math.round(effFreq(i))} Hz): ${(eff[i] >= 0 ? "+" : "") + eff[i].toFixed(1)} dB`,
      );
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
  activeSide = "left";
  bindActiveSide();
  document.getElementById("ciSideSelect").value = "left";
  document.getElementById("mfrSelect").value = "medel";
  document.getElementById("vol1").value = "50";
  document.getElementById("vol2").value = "50";
  document.getElementById("dur1").value = "1000";
  document.getElementById("dur2").value = "1000";
  document.getElementById("pau1").value = "500";
  document.getElementById("pau2").value = "500";
  document.getElementById("paraI").value = "balance";
  buildFreqTable();
  buildLvGrid();
  drawLvChart();
  renderResults();
  alert(t("resetDone"));
}

async function saveJson() {
  const d = {
    version: "2.6",
    date: new Date().toLocaleString(
      lang === "de"
        ? "de-DE"
        : lang === "fr"
          ? "fr-FR"
          : lang === "es"
            ? "es-ES"
            : "en-US",
    ),
    sides: {
      left: {
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
    paradigm: document.getElementById("paraI").value,
    toneDuration: parseInt(document.getElementById("dur1").value),
    pauseDuration: parseInt(document.getElementById("pau1").value),
    volume: document.getElementById("vol2").value,
    playerSource:
      plSrcMeas && plSrcLevels
        ? "both"
        : plSrcMeas
          ? "measured"
          : plSrcLevels
            ? "levels"
            : "none",
    plSide: getPlayerSide(),
    eqOn: plEqOn,
    eqStrength: parseInt(document.getElementById("plStr").value),
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
  const fn = `loudness-balancing-v2.6-${ds}-${ts}.json`;
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
  bindActiveSide();
  const gEl = (id) => document.getElementById(id);
  const setVal = (id, v) => {
    const e = gEl(id);
    if (e) e.value = v;
  };
  setVal("ciSideSelect", activeSide);
  setVal("mfrSelect", mfr);
  if (d.paradigm) setVal("paraI", d.paradigm);
  if (d.toneDuration) {
    setVal("dur1", d.toneDuration);
    setVal("dur2", d.toneDuration);
  }
  if (d.pauseDuration) {
    setVal("pau1", d.pauseDuration);
    setVal("pau2", d.pauseDuration);
  }
  if (d.volume) {
    setVal("vol1", d.volume);
    setVal("vol2", d.volume);
  }
  if (d.eqOn !== undefined) {
    plEqOn = d.eqOn;
    updEqToggleBtn();
  }
  if (d.eqStrength !== undefined) setVal("plStr", d.eqStrength);
  if (d.playerSource !== undefined) {
    plSrcMeas = d.playerSource === "measured" || d.playerSource === "both";
    plSrcLevels = d.playerSource === "levels" || d.playerSource === "both";
  } else {
    plSrcMeas = true;
    plSrcLevels = true;
  }
  buildFreqTable();
  renderResults();
  if (typeof buildLvGrid === "function") buildLvGrid();
  if (typeof drawLvChart === "function") drawLvChart();
  if (typeof updFClearBtn === "function") updFClearBtn();
  if (typeof buildImplantCard === "function") buildImplantCard();
  if (pEqF && pEqF.length > 0) pUpdEQ();
  updSideButtons();
  const fi = gEl("fInput");
  if (fi) fi.value = "";
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

