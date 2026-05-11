// ============================================================
// LR BALANCE COMPARISON
// ============================================================

// State
let lrResults = {}; // {elIdx: offset_dB}  positive = right louder
let lrSeq = []; // sequence of electrode indices to test
let lrSeqIdx = 0;
let lrCurrentEl = null; // current electrode index (left side numbering)
let lrFlipped = false; // if true, first tone is R then L
let lrRunning = false;
let lrUndoStack = []; // [{el, prev}]
let lrSliderMode = "right"; // 'right' | 'left' | 'both'
let lrPlayTO = null;
let lrIsPlay = false;


// Tab- und Seitensperre während LR-Test
function lrUpdateLockState(active) {
  const tabs = document.querySelectorAll('.tab:not([data-tab="messungen"])');
  const subtabs = document.querySelectorAll('.subtab[data-parent="messungen"]:not([data-subtab="balance"])');
  const sideLeftBtn = document.getElementById("sideLeftBtn");
  const sideRightBtn = document.getElementById("sideRightBtn");
  tabs.forEach((t) => (t.disabled = active));
  subtabs.forEach((t) => (t.disabled = active));
  if (sideLeftBtn) sideLeftBtn.disabled = active;
  if (sideRightBtn) sideRightBtn.disabled = active;
  const lockInfo = document.getElementById("lrLockedInfo");
  if (lockInfo) lockInfo.style.display = active ? "" : "none";
}

// Audio: plays a single tone with stereo pan
function lrPlayTone(hz, vol, ms, pan) {
  return new Promise((res) => {
    const c = gAC();
    const o = c.createOscillator();
    const g = c.createGain();
    const p = c.createStereoPanner();
    o.type = "sine";
    o.frequency.value = hz;
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(Math.max(0, vol), c.currentTime + 0.02);
    g.gain.setValueAtTime(Math.max(0, vol), c.currentTime + (ms - 20) / 1000);
    g.gain.linearRampToValueAtTime(0, c.currentTime + ms / 1000);
    o.connect(g);
    g.connect(p);
    p.connect(c.destination);
    curOsc = o;
    o.start();
    o.stop(c.currentTime + ms / 1000 + 0.01);
    o.onended = () => {
      curOsc = null;
      res();
    };
  });
}

function lrGVol() {
  return Math.pow(parseInt(document.getElementById("lrVol").value) / 100, 2);
}
function lrGDur() {
  return parseInt(document.getElementById("lrDur").value) || 1000;
}
function lrGPau() {
  return parseInt(document.getElementById("lrPau").value) || 400;
}

// Get corrected volume gain for electrode i on given side (WLS levels only, no manual levels)
function lrCorrGain(side, elIdx) {
  return withSide(side, () => {
    if (sideData[side].bRes.length === 0) return 1;
    const { levels } = compWLS();
    return dB2G(-levels[elIdx]);
  });
}

// Get the effective frequency for electrode i on a given side
function lrEffFreq(side, elIdx) {
  return withSide(side, () => effFreq(elIdx));
}

// Get the electrode display number for a given side
function lrDEN(side, elIdx) {
  return withSide(side, () => dEN(elIdx));
}

// Play the current LR comparison sequence
async function lrPlayCurrent() {
  if (lrCurrentEl === null) return;
  if (lrIsPlay) {
    lrStopPlay();
    await new Promise((r) => setTimeout(r, 60));
  }

  const el = lrCurrentEl;
  const slOff = parseFloat(document.getElementById("lrSl").value); // positive = slider side louder
  const vol = lrGVol();
  const dur = lrGDur();
  const pau = lrGPau();

  const rightNEl = sideData["right"].nEl;
  const rightEl = el < rightNEl ? el : rightNEl - 1;
  const hzL = lrEffFreq("left", el);
  const hzR = lrEffFreq("right", rightEl);
  const corrL = lrCorrGain("left", el);
  const corrR = lrCorrGain("right", rightEl);

  // Apply slider offset depending on mode
  let volL, volR;
  if (lrSliderMode === "right") {
    volL = vol * corrL;
    volR = vol * corrR * dB2G(slOff);
  } else if (lrSliderMode === "left") {
    volL = vol * corrL * dB2G(slOff);
    volR = vol * corrR;
  } else {
    // 'both': positive = R up / L down
    volL = vol * corrL * dB2G(-slOff / 2);
    volR = vol * corrR * dB2G(slOff / 2);
  }

  const firstSide = lrFlipped ? "right" : "left";
  const secondSide = lrFlipped ? "left" : "right";
  const firstHz = lrFlipped ? hzR : hzL;
  const secondHz = lrFlipped ? hzL : hzR;
  const firstVol = lrFlipped ? volR : volL;
  const secondVol = lrFlipped ? volL : volR;
  const firstPan = lrFlipped ? 1 : -1;
  const secondPan = lrFlipped ? -1 : 1;

  lrSetSideActive(firstSide);
  lrIsPlay = true;

  await lrPlayTone(firstHz, firstVol, dur, firstPan);
  if (!lrIsPlay) return;
  lrSetSideActive(null);
  await new Promise((r) => (lrPlayTO = setTimeout(r, pau)));
  if (!lrIsPlay) return;
  lrSetSideActive(secondSide);
  await lrPlayTone(secondHz, secondVol, dur, secondPan);
  lrSetSideActive(null);
  lrIsPlay = false;
}

function lrStopPlay() {
  if (curOsc) {
    try {
      curOsc.stop();
    } catch (e) {}
    curOsc = null;
  }
  if (lrPlayTO) {
    clearTimeout(lrPlayTO);
    lrPlayTO = null;
  }
  lrIsPlay = false;
  lrSetSideActive(null);
}

function lrSetSideActive(side) {
  const l = document.getElementById("lrIndL");
  const r = document.getElementById("lrIndR");
  if (!l || !r) return;
  const activeStyle =
    "background:var(--accent-light);border-color:var(--accent);color:var(--accent)";
  const inactiveStyle =
    "background:transparent;border-color:var(--border);color:var(--text)";
  l.style.cssText = l.style.cssText.replace(
    /background:[^;]+;border-color:[^;]+;color:[^;]+/,
    "",
  );
  r.style.cssText = r.style.cssText.replace(
    /background:[^;]+;border-color:[^;]+;color:[^;]+/,
    "",
  );
  if (side === "left") {
    l.style.background = "var(--accent-light)";
    l.style.borderColor = "var(--accent)";
    l.style.color = "var(--accent)";
  } else if (side === "right") {
    r.style.background = "var(--accent-light)";
    r.style.borderColor = "var(--accent)";
    r.style.color = "var(--accent)";
  }
}

function lrUpdSliderMode(mode) {
  lrSliderMode = mode;
  document.querySelectorAll(".lrSlModeBtn").forEach((b) => {
    const on = b.dataset.mode === mode;
    b.style.background = on ? "var(--accent)" : "";
    b.style.color = on ? "#fff" : "";
    b.style.borderColor = on ? "var(--accent)" : "";
  });
  const hints = {
    right:
      "Rechts lauter → positiv · Links lauter → negativ · ◄► ±0.5 dB · Shift ±0.1 dB",
    left: "Links lauter → positiv · Rechts lauter → negativ · ◄► ±0.5 dB · Shift ±0.1 dB",
    both: "Balance: Rechts an/ab ↔ positiv/negativ · ◄► ±0.5 dB · Shift ±0.1 dB",
  };
  const h = document.getElementById("lrSlHint");
  if (h) h.textContent = hints[mode] || "";
}

function lrBuildSequence() {
  // Use left side as reference for electrode count
  const leftNEl = sideData["left"].nEl;
  const rightNEl = sideData["right"].nEl;
  const count = Math.min(leftNEl, rightNEl);
  // Only use electrodes that are active on both sides
  const available = [];
  for (let i = 0; i < count; i++) {
    const leftOk =
      sideData["left"].elExDur[i] === null &&
      sideData["left"].elSt[i] !== "mute";
    const rightOk =
      sideData["right"].elExDur[i] === null &&
      sideData["right"].elSt[i] !== "mute";
    if (leftOk && rightOk) available.push(i);
  }
  const mode = document.getElementById("lrOrderMode").value;
  if (mode === "ascending") {
    lrSeq = [...available];
  } else if (mode === "descending") {
    lrSeq = [...available].reverse();
  } else {
    // shuffle
    const arr = [...available];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    lrSeq = arr;
  }
  lrSeqIdx = 0;
}

function lrDetermineFlip() {
  const mode = document.getElementById("lrSideMode").value;
  if (mode === "lr") return false;
  if (mode === "rl") return true;
  return Math.random() < 0.5;
}

function lrShowPair() {
  if (lrSeqIdx >= lrSeq.length) {
    lrFinish();
    return;
  }
  const el = lrSeq[lrSeqIdx];
  lrCurrentEl = el;
  lrFlipped = lrDetermineFlip();

  // Slider: load existing result if any
  const existing = lrResults[el];
  const sl = document.getElementById("lrSl");
  sl.value = existing !== undefined ? existing : 0;
  document.getElementById("lrSlV").textContent =
    (sl.value >= 0 ? "+" : "") + parseFloat(sl.value).toFixed(1) + " dB";
  const ph = document.getElementById("lrPrevHint");
  if (existing !== undefined) {
    ph.textContent =
      "Vorheriger Wert: " +
      (existing >= 0 ? "+" : "") +
      existing.toFixed(1) +
      " dB";
    ph.style.display = "";
  } else {
    ph.style.display = "none";
  }

  // Update progress
  document.getElementById("lrProgLbl").textContent =
    "Elektrode " + (lrSeqIdx + 1) + " von " + lrSeq.length;

  // Electrode label — show left side numbering
  const leftLabel = withSide("left", () => "E" + dEN(el));
  const rightEl = el < sideData["right"].nEl ? el : sideData["right"].nEl - 1;
  const rightLabel = withSide("right", () => "E" + dEN(el));
  document.getElementById("lrElLabel").textContent =
    leftLabel + " / " + rightLabel;

  const hzL = lrEffFreq("left", el);
  const hzR = lrEffFreq("right", rightEl);
  document.getElementById("lrFreqLabel").textContent =
    "Links: " + Math.round(hzL) + " Hz  ·  Rechts: " + Math.round(hzR) + " Hz";

  document.getElementById("lrUndoBtn").disabled = lrUndoStack.length === 0;

  lrPlayCurrent();
}

function lrConfirm() {
  if (lrCurrentEl === null) return;
  const el = lrCurrentEl;
  const val = parseFloat(document.getElementById("lrSl").value);
  // Save undo
  lrUndoStack.push({ el, prev: lrResults[el] });
  lrResults[el] = val;
  lrSeqIdx++;
  lrRenderResults();
  lrApplyMeanToBalance();
  lrShowPair();
}

function lrUndo() {
  if (!lrUndoStack.length) return;
  const { el, prev } = lrUndoStack.pop();
  if (prev === undefined) delete lrResults[el];
  else lrResults[el] = prev;
  lrSeqIdx = Math.max(0, lrSeqIdx - 1);
  lrRenderResults();
  lrApplyMeanToBalance();
  lrShowPair();
}

function lrFinish() {
  lrStopPlay();
  lrRunning = false;
  document.getElementById("lrTestArea").style.display = "none";
  document.getElementById("lrActiveArea").style.display = "none";
  document.getElementById("lrStartBtn").disabled = false;
  document.getElementById("lrStopBtn").disabled = true;
  lrUpdateLockState(false);
  lrRenderResults();
  lrApplyMeanToBalance();
}

function lrStop() {
  lrStopPlay();
  lrRunning = false;
  document.getElementById("lrTestArea").style.display = "none";
  document.getElementById("lrActiveArea").style.display = "none";
  document.getElementById("lrStartBtn").disabled = false;
  document.getElementById("lrStopBtn").disabled = true;
  lrUpdateLockState(false);
  lrRenderResults();
}

function lrApplyMeanToBalance() {
  const vals = Object.values(lrResults).filter((v) => isFinite(v));
  if (!vals.length) return;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  // Positive lrResult = right louder = right needs to be quieter = negative balance offset
  const balOffset = Math.max(-60, Math.min(60, parseFloat((-mean).toFixed(1))));

  // Prominente Mean-Anzeige
  const mvEl = document.getElementById("lrMedianValue");
  const mhEl = document.getElementById("lrMedianHint");
  if (mvEl) {
    mvEl.textContent =
      (balOffset >= 0 ? "+" : "") + balOffset.toFixed(1) + " dB";
    mvEl.style.color =
      Math.abs(balOffset) < 0.5 ? "var(--success)" : "var(--accent)";
    const parent = mvEl.closest('[style*="border"]');
    if (parent)
      parent.style.borderColor =
        Math.abs(balOffset) < 0.5 ? "var(--success)" : "var(--accent)";
    if (parent)
      parent.style.background =
        Math.abs(balOffset) < 0.5 ? "#dcfce7" : "var(--accent-light)";
  }
  if (mhEl) {
    if (Math.abs(balOffset) < 0.5)
      mhEl.textContent = "Seiten nahezu gleich laut";
    else if (balOffset > 0)
      mhEl.textContent = "Links anheben oder Rechts absenken";
    else mhEl.textContent = "Rechts anheben oder Links absenken";
  }

  const balEl = document.getElementById("balBalance");
  if (balEl) {
    // balBalance wurde entfernt – kein Schreibzugriff mehr nötig
    // balEl.value = balOffset;
    // balEl.dispatchEvent(new Event("input"));
  }
}

function lrRenderResults() {
  const keys = Object.keys(lrResults).map(Number);
  const noResEl = document.getElementById("lrNoResults");
  if (!keys.length) {
    document.getElementById("lrResultsCard").style.display = "none";
    if (noResEl) noResEl.style.display = "";
    return;
  }
  document.getElementById("lrResultsCard").style.display = "";
  if (noResEl) noResEl.style.display = "none";

  // Table
  const th = document.getElementById("lrResTH");
  const tb = document.getElementById("lrResTB");
  th.innerHTML =
    "<th>Elektrode</th><th>Hz Links</th><th>Hz Rechts</th><th>Offset (dB)</th><th>Bedeutung</th>";
  tb.innerHTML = "";

  // Get all compared electrodes in order
  const count = Math.min(sideData["left"].nEl, sideData["right"].nEl);
  for (let i = 0; i < count; i++) {
    const v = lrResults[i];
    if (v === undefined) continue;
    const rightEl = i < sideData["right"].nEl ? i : sideData["right"].nEl - 1;
    const hzL = lrEffFreq("left", i);
    const hzR = lrEffFreq("right", rightEl);
    const leftLabel = withSide("left", () => "E" + dEN(i));
    const rightLabel = withSide("right", () => "E" + dEN(rightEl));
    const meaning =
      v > 0.1 ? "Rechts lauter" : v < -0.1 ? "Links lauter" : "Gleich";
    const color = v > 0.1 ? "#dc2626" : v < -0.1 ? "#2563eb" : "#666";
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td style="font-weight:600">${leftLabel} / ${rightLabel}</td>` +
      `<td>${Math.round(hzL)}</td><td>${Math.round(hzR)}</td>` +
      `<td style="color:${color}">${v >= 0 ? "+" : ""}${v.toFixed(1)}</td>` +
      `<td style="font-size:.82em;color:${color}">${meaning}</td>`;
    tb.appendChild(tr);
  }

  lrDrawChart();
}

function lrDrawChart() {
  const cv = document.getElementById("lrResChart");
  if (!cv) return;
  const wp = cv.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const W = wp.clientWidth,
    H = wp.clientHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const count = Math.min(sideData["left"].nEl, sideData["right"].nEl);
  const elIndices = [];
  for (let i = 0; i < count; i++) {
    if (lrResults[i] !== undefined) elIndices.push(i);
  }
  if (!elIndices.length) return;

  const vals = elIndices.map((i) => lrResults[i]);
  const absMax = Math.max(Math.ceil(Math.max(...vals.map(Math.abs), 2)), 3);

  const pad = { top: 20, right: 16, bottom: 44, left: 52 };
  const pW = W - pad.left - pad.right;
  const pH = H - pad.top - pad.bottom;
  const tX = (j) => pad.left + j * (pW / (elIndices.length - 1 || 1));
  const tY = (v) => pad.top + (absMax - v) * (pH / (2 * absMax));
  const zY = tY(0);

  // Grid
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  for (let s = -absMax; s <= absMax; s += Math.ceil(absMax / 3)) {
    const y = tY(s);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = "#999";
    ctx.font = "9px Consolas,monospace";
    ctx.textAlign = "right";
    ctx.fillText((s >= 0 ? "+" : "") + s.toFixed(0), pad.left - 6, y + 3);
  }
  // Zero line
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(pad.left, zY);
  ctx.lineTo(W - pad.right, zY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Bars
  const bW = Math.min((pW / elIndices.length) * 0.6, 28);
  elIndices.forEach((el, j) => {
    const v = vals[j];
    const x = tX(j) - bW / 2;
    const bH = (Math.abs(v) / absMax) * (pH / 2);
    const y = v >= 0 ? zY - bH : zY;
    ctx.fillStyle = v > 0.1 ? "#dc2626" : v < -0.1 ? "#2563eb" : "#9ca3af";
    ctx.fillRect(x, Math.min(zY, y), bW, bH || 1);

    // Label
    const rightEl = el < sideData["right"].nEl ? el : sideData["right"].nEl - 1;
    const leftLabel = withSide("left", () => "E" + dEN(el));
    ctx.fillStyle = "#555";
    ctx.font = "9px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(leftLabel, tX(j), H - pad.bottom + 12);
    const hzL = lrEffFreq("left", el);
    ctx.font = "7px Consolas,monospace";
    ctx.fillStyle = "#999";
    ctx.fillText(Math.round(hzL), tX(j), H - pad.bottom + 23);
  });

  // Line
  ctx.strokeStyle = "#2563eb44";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let first = true;
  elIndices.forEach((el, j) => {
    if (first) {
      ctx.moveTo(tX(j), tY(vals[j]));
      first = false;
    } else ctx.lineTo(tX(j), tY(vals[j]));
  });
  ctx.stroke();

  // Axis label
  ctx.save();
  ctx.translate(12, pad.top + pH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#666";
  ctx.font = "9px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("dB (R−L)", 0, 0);
  ctx.restore();
}

function lrCheckData() {
  const hasLeft = sideData["left"].bRes.length > 0;
  const hasRight = sideData["right"].bRes.length > 0;
  const nd = document.getElementById("lrNoData");
  if (nd) nd.style.display = hasLeft && hasRight ? "none" : "";
}

// ---- Event listeners ----
document.addEventListener("DOMContentLoaded", () => {
  // Called after main DOMContentLoaded — use a small delay to let main init run first
  setTimeout(() => {
    lrCheckData();

    document.getElementById("lrStartBtn").addEventListener("click", () => {
      lrBuildSequence();
      if (!lrSeq.length) {
        alert("Keine gemeinsamen aktiven Elektroden gefunden.");
        return;
      }
      lrRunning = true;
      lrUndoStack = [];
      document.getElementById("lrTestArea").style.display = "";
      document.getElementById("lrActiveArea").style.display = "";
      document.getElementById("lrStartBtn").disabled = true;
      document.getElementById("lrStopBtn").disabled = false;
      lrUpdateLockState(true);
      lrShowPair();
    });

    document.getElementById("lrStopBtn").addEventListener("click", lrStop);
    document.querySelectorAll(".lrSlModeBtn").forEach((b) => {
      b.addEventListener("click", () => lrUpdSliderMode(b.dataset.mode));
    });
    lrUpdSliderMode("right");
    document
      .getElementById("lrReplayBtn")
      .addEventListener("click", lrPlayCurrent);
    document.getElementById("lrConfBtn").addEventListener("click", lrConfirm);
    document.getElementById("lrUndoBtn").addEventListener("click", lrUndo);
    document.getElementById("lrClearBtn").addEventListener("click", () => {
      if (!confirm("LR-Vergleichsergebnisse löschen?")) return;
      lrResults = {};
      document.getElementById("lrResultsCard").style.display = "none";
    });

    document.getElementById("lrSwapBtn").addEventListener("click", () => {
      lrFlipped = !lrFlipped;
      lrPlayCurrent();
    });

    document.getElementById("lrSl").addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      document.getElementById("lrSlV").textContent =
        (v >= 0 ? "+" : "") + v.toFixed(1) + " dB";
    });

    // Keyboard in balance subtab
    document.addEventListener("keydown", (e) => {
      const balSubpanel = document.getElementById("subpanel-messungen-balance");
      if (!balSubpanel || !balSubpanel.classList.contains("active")) return;
      const messPanel = document.getElementById("panel-messungen");
      if (!messPanel || !messPanel.classList.contains("active")) return;
      if (!lrRunning) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      const step = e.shiftKey ? 0.1 : 0.5;
      const sl = document.getElementById("lrSl");
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        sl.value = Math.max(-60, parseFloat(sl.value) - step).toFixed(1);
        document.getElementById("lrSlV").textContent =
          (parseFloat(sl.value) >= 0 ? "+" : "") +
          parseFloat(sl.value).toFixed(1) +
          " dB";
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        sl.value = Math.min(60, parseFloat(sl.value) + step).toFixed(1);
        document.getElementById("lrSlV").textContent =
          (parseFloat(sl.value) >= 0 ? "+" : "") +
          parseFloat(sl.value).toFixed(1) +
          " dB";
      }
      if (e.key === " ") {
        e.preventDefault();
        lrPlayCurrent();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        lrConfirm();
      }
    });

    // Re-check when switching to balance tab
    const origSwitchTab = window.switchTab;
  }, 100);
});

// Hook into balance subtab activation
document
  .querySelector('.subtab[data-subtab="balance"][data-parent="messungen"]')
  ?.addEventListener("click", () => {
    setTimeout(() => {
      lrCheckData();
    }, 0);
  });

// Hook into lrresults subtab activation
document
  .querySelector('.subtab[data-subtab="lrresults"][data-parent="ergebnisse"]')
  ?.addEventListener("click", () => {
    setTimeout(() => {
      lrCheckData();
      lrDrawChart();
    }, 0);
  });
