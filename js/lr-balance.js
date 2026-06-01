// ============================================================
// LR BALANCE COMPARISON
// ============================================================

// State
let lrResults = {}; // {elIdx: offset_dB}  positive = right louder
// BA 156: Schnappschuß zum Zeitpunkt der ersten LR-Messung
let lrSnapshot = null;
let lrSeq = []; // sequence of electrode indices to test
let lrSeqIdx = 0;
let lrCurrentEl = null; // current electrode index (left side numbering)
let lrFlipped = false; // if true, first tone is R then L
let lrRunning = false;
let lrUndoStack = []; // [{el, prev}]
let lrPlayTO = null;
let lrIsPlay = false;

// Element-Lookup (gebaut von buildTestPanel)
let lrEls = null;

// Slider-Extend-Stufen: [20, 40, 60] dB
const LR_SLIDER_RANGES = [20, 40, 60];
let lrSlRangeIdx = 0;

// ---- Slider-Helfer ----
function _lrRstSlR() {
  if (!lrEls) return;
  lrSlRangeIdx = 0;
  const s = lrEls.slider;
  const r = LR_SLIDER_RANGES[0];
  s.min = String(-r); s.max = String(r); s.step = "0.1";
  if (lrEls.extendBtn) lrEls.extendBtn.hidden = true;
}

function _lrExtSlider() {
  if (!lrEls) return;
  lrSlRangeIdx = Math.min(lrSlRangeIdx + 1, LR_SLIDER_RANGES.length - 1);
  const r = LR_SLIDER_RANGES[lrSlRangeIdx];
  lrEls.slider.min = String(-r);
  lrEls.slider.max = String(r);
  if (lrEls.extendBtn) {
    lrEls.extendBtn.hidden = (lrSlRangeIdx >= LR_SLIDER_RANGES.length - 1);
  }
}

function _lrCheckExtend(sv) {
  if (!lrEls || !lrEls.extendBtn) return;
  const r = LR_SLIDER_RANGES[lrSlRangeIdx];
  const atLimit = Math.abs(sv) >= r - 0.5;
  const canExtend = lrSlRangeIdx < LR_SLIDER_RANGES.length - 1;
  lrEls.extendBtn.hidden = !(atLimit && canExtend);
}

function _lrSliderVal() {
  return lrEls ? parseFloat(lrEls.slider.value) : 0;
}

function _lrUpdSliderDisplay(v) {
  if (!lrEls) return;
  if (lrEls.sliderValue)
    lrEls.sliderValue.textContent = (v >= 0 ? "+" : "") + v.toFixed(1) + " dB";
  _lrCheckExtend(v);
}

function _lrUpdCumulative(v) {
  if (!lrEls || !lrEls.cumulativeDisplay) return;
  const existing = lrCurrentEl !== null ? lrResults[lrCurrentEl] : undefined;
  if (existing !== undefined) {
    lrEls.cumulativeDisplay.textContent =
      t("cumulativeDb") + ": " + (existing >= 0 ? "+" : "") + existing.toFixed(1) + " dB";
    lrEls.cumulativeDisplay.style.display = "";
  } else {
    lrEls.cumulativeDisplay.style.display = "none";
  }
}

// Get current slider mode from target dropdown
function _lrGetMode() {
  return slTarget_balance || "both";
}

function lrPlayTone(hz, vol, ms, pan) {
  const c = gAC();
  return playToneTyped(c, hz, vol, ms, pan, globalToneType);
}

function lrGVol() {
  if (lrEls && lrEls.volInput) return Math.pow(parseInt(lrEls.volInput.value) / 100, 2);
  return Math.pow(50 / 100, 2);
}
function lrGDur() {
  if (lrEls && lrEls.durInput) return parseInt(lrEls.durInput.value) || 1000;
  return 1000;
}
function lrGPau() {
  if (lrEls && lrEls.pauseInput) return parseInt(lrEls.pauseInput.value) || 400;
  return 400;
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
  const slOff = _lrSliderVal(); // positive = slider side louder
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
  const mode = _lrGetMode();
  let volL, volR;
  if (mode === "right") {
    volL = vol * corrL;
    volR = vol * corrR * dB2G(slOff);
  } else if (mode === "left") {
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
  if (globalSequence === "aba" && lrIsPlay) {
    await new Promise((r) => (lrPlayTO = setTimeout(r, pau)));
    if (!lrIsPlay) return;
    lrSetSideActive(firstSide);
    await lrPlayTone(firstHz, firstVol, dur, firstPan);
    lrSetSideActive(null);
  }
  lrIsPlay = false;
}

function lrPlaySimul() {
  if (lrCurrentEl === null) return;
  lrStopPlay();
  const el = lrCurrentEl;
  const slOff = _lrSliderVal();
  const vol = lrGVol();
  const dur = lrGDur();
  const rightNEl = sideData["right"].nEl;
  const rightEl = el < rightNEl ? el : rightNEl - 1;
  const hzL = lrEffFreq("left", el);
  const hzR = lrEffFreq("right", rightEl);
  const corrL = lrCorrGain("left", el);
  const corrR = lrCorrGain("right", rightEl);
  const mode = _lrGetMode();
  let volL, volR;
  if (mode === "right") {
    volL = vol * corrL;
    volR = vol * corrR * dB2G(slOff);
  } else if (mode === "left") {
    volL = vol * corrL * dB2G(slOff);
    volR = vol * corrR;
  } else {
    volL = vol * corrL * dB2G(-slOff / 2);
    volR = vol * corrR * dB2G(slOff / 2);
  }
  const ac = gAC();
  lrSetSideActive("both");
  var p1 = playToneTyped(ac, hzL, volL, dur, -1, globalToneType);
  var p2 = playToneTyped(ac, hzR, volR, dur, 1, globalToneType);
  Promise.all([p1, p2]).then(function() { lrSetSideActive(null); });
}

function lrStopPlay() {
  if (curOsc) {
    try { curOsc.stop(); } catch (e) {}
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
  if (!lrEls) return;
  const l = lrEls.pairLeft;
  const r = lrEls.pairRight;
  if (!l || !r) return;
  if (side === "left") {
    l.style.background = "var(--accent-light)";
    l.style.borderColor = "var(--accent)";
    l.style.color = "var(--accent)";
    r.style.background = "";
    r.style.borderColor = "";
    r.style.color = "";
  } else if (side === "right") {
    r.style.background = "var(--accent-light)";
    r.style.borderColor = "var(--accent)";
    r.style.color = "var(--accent)";
    l.style.background = "";
    l.style.borderColor = "";
    l.style.color = "";
  } else if (side === "both") {
    l.style.background = "var(--accent-light)";
    l.style.borderColor = "var(--accent)";
    l.style.color = "var(--accent)";
    r.style.background = "var(--accent-light)";
    r.style.borderColor = "var(--accent)";
    r.style.color = "var(--accent)";
  } else {
    l.style.background = "";
    l.style.borderColor = "";
    l.style.color = "";
    r.style.background = "";
    r.style.borderColor = "";
    r.style.color = "";
  }
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
  const mode = lrEls && lrEls.modeSelect ? lrEls.modeSelect.value : "random";
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
  const mode = lrEls && lrEls.runSelect ? lrEls.runSelect.value : "random";
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
  lrSlRangeIdx = 0;

  // Slider: load existing result if any, otherwise reset to 0
  const existing = lrResults[el];
  if (lrEls && lrEls.slider) {
    _lrRstSlR();
    if (existing !== undefined && isFinite(existing)) {
      // Extend range if existing value exceeds default range
      const absEx = Math.abs(existing);
      while (absEx > LR_SLIDER_RANGES[lrSlRangeIdx] - 0.5 &&
             lrSlRangeIdx < LR_SLIDER_RANGES.length - 1) {
        _lrExtSlider();
      }
      lrEls.slider.value = String(existing);
      _lrUpdSliderDisplay(existing);
    } else {
      lrEls.slider.value = "0";
      _lrUpdSliderDisplay(0);
    }
  }

  // Update cumulative display (previous value)
  _lrUpdCumulative(0);

  // Update progress
  if (lrEls && lrEls.progressText) {
    lrEls.progressText.textContent =
      t("comp") + " " + (lrSeqIdx + 1) + " " + t("of") + " " + lrSeq.length;
  }

  // Electrode labels — show both sides
  const leftLabel = withSide("left", () => dENPrefix("left") + dEN(el));
  const rightEl = el < sideData["right"].nEl ? el : sideData["right"].nEl - 1;
  const rightLabel = withSide("right", () => dENPrefix("right") + dEN(rightEl));
  if (lrEls && lrEls.pairLeft) {
    lrEls.pairLeft.textContent = "L: " + leftLabel;
  }
  if (lrEls && lrEls.pairRight) {
    lrEls.pairRight.textContent = "R: " + rightLabel;
  }

  const hzL = lrEffFreq("left", el);
  const hzR = lrEffFreq("right", rightEl);
  if (lrEls && lrEls.pairFreq) {
    lrEls.pairFreq.textContent =
      Math.round(hzL) + " Hz  ·  " + Math.round(hzR) + " Hz";
  }

  // Undo button state
  if (lrEls && lrEls.undoBtn) lrEls.undoBtn.disabled = lrUndoStack.length === 0;

  // Reset confidence
  if (lrEls && lrEls.confRadios && lrEls.confRadios['none'])
    lrEls.confRadios['none'].checked = true;

  lrPlayCurrent();
}

function lrConfirm() {
  if (lrCurrentEl === null || !lrRunning) return;
  const el = lrCurrentEl;
  const val = _lrSliderVal();
  // Save undo
  lrUndoStack.push({ el, prev: lrResults[el] });
  lrResults[el] = val;
  // BA 156
  if (lrSnapshot === null && typeof implantSnapshot === 'function') {
    lrSnapshot = implantSnapshot();
  }
  lrSeqIdx++;
  lrRenderResults();
  lrApplyMeanToBalance();
  lrShowPair();
}

function lrUndo() {
  if (!lrUndoStack.length) return;
  lrStopPlay();
  const { el, prev } = lrUndoStack.pop();
  if (prev === undefined) delete lrResults[el];
  else lrResults[el] = prev;
  lrSeqIdx = Math.max(0, lrSeqIdx - 1);
  lrRenderResults();
  lrApplyMeanToBalance();
  lrShowPair();
}

function _lrRequestExcl(elIdx) {
  if (!lrEls) return;
  lrStopPlay();
  const leftLabel = withSide("left", () => dENPrefix("left") + dEN(elIdx) + " (" + Math.round(lrEffFreq("left", elIdx)) + " Hz)");
  setTestExclConfirm(lrEls.exclOverlay, leftLabel, function() {
    // Exclude electrode on both sides
    const now = Date.now();
    if (sideData["left"].elExDur[elIdx] === null)
      sideData["left"].elExDur[elIdx] = now;
    if (sideData["right"].elExDur[elIdx] === null)
      sideData["right"].elExDur[elIdx] = now;
    // Remove remaining pairs with this electrode from sequence
    lrSeq = lrSeq.filter(function(i) { return i !== elIdx; });
    if (lrSeqIdx >= lrSeq.length) {
      lrFinish();
    } else {
      lrShowPair();
    }
  });
}

function lrFinish() {
  lrStopPlay();
  lrRunning = false;
  if (lrEls) {
    lrEls.testBox.hidden = true;
    lrEls.startBtn.disabled = false;
    lrEls.stopBtn.disabled = true;
  }
  lockTestTabs(false, null);
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  lrRenderResults();
  lrApplyMeanToBalance();
}

function lrStop() {
  lrStopPlay();
  lrRunning = false;
  if (lrEls) {
    lrEls.testBox.hidden = true;
    lrEls.startBtn.disabled = false;
    lrEls.stopBtn.disabled = true;
  }
  lockTestTabs(false, null);
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  lrRenderResults();
}

function lrApplyMeanToBalance() {
  // Mittelwert nur über aktive (nicht deaktivierte) Elektroden
  const activeKeys = Object.keys(lrResults).filter((k) => {
    const i = +k;
    const v = lrResults[i];
    if (!isFinite(v)) return false;
    // Eine Stereo-Messung gilt als deaktiviert, wenn die Elektrode auf
    // BEIDEN Seiten deaktiviert oder stumm-geschaltet ist
    const exL = sideData.left.elExDur[i]  !== null || sideData.left.elSt[i]  === 'mute';
    const exR = sideData.right.elExDur[i] !== null || sideData.right.elSt[i] === 'mute';
    return !(exL || exR);
  });
  if (!activeKeys.length) return;
  const vals = activeKeys.map((k) => lrResults[+k]);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  // Positive lrResult = right louder = right needs to be quieter = negative balance offset
  const balOffset = Math.max(-60, Math.min(60, parseFloat((-mean).toFixed(1))));

  // Mean-Anzeige
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
      mhEl.textContent = t('lrBalEqual');
    else if (balOffset > 0)
      mhEl.textContent = t('lrRightLouder');
    else mhEl.textContent = t('lrLeftLouder');
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
    `<th>${t('audColEl')}</th><th>${t('lrThHz1')}</th><th>${t('lrThHz2')}</th><th>Offset (dB)</th><th>${t('lrThMeaning')}</th>`;
  tb.innerHTML = "";

  const count = Math.min(sideData["left"].nEl, sideData["right"].nEl);
  for (let i = 0; i < count; i++) {
    const rightEl = i < sideData["right"].nEl ? i : sideData["right"].nEl - 1;
    const exL = sideData.left.elExDur[i]        !== null || sideData.left.elSt[i]        === 'mute';
    const exR = sideData.right.elExDur[rightEl] !== null || sideData.right.elSt[rightEl] === 'mute';
    const isDisabled = exL || exR;
    const v = lrResults[i];
    const hzL = lrEffFreq("left", i);
    const hzR = lrEffFreq("right", rightEl);
    const leftLabel  = withSide("left",  () => dENPrefix("left")  + dEN(i));
    const rightLabel = withSide("right", () => dENPrefix("right") + dEN(rightEl));
    const tr = document.createElement("tr");

    if (isDisabled) {
      tr.style.opacity = "0.4";
      tr.innerHTML =
        `<td style="font-weight:600">${leftLabel} / ${rightLabel}</td>` +
        `<td>${Math.round(hzL)}</td><td>${Math.round(hzR)}</td>` +
        `<td>—</td>` +
        `<td style="font-size:.82em">${t('excludedSkipped')}</td>`;
    } else if (v === undefined) {
      tr.innerHTML =
        `<td style="font-weight:600">${leftLabel} / ${rightLabel}</td>` +
        `<td>${Math.round(hzL)}</td><td>${Math.round(hzR)}</td>` +
        `<td style="color:#9ca3af">—</td>` +
        `<td style="font-size:.82em;color:#9ca3af">${t('notMeasured')}</td>`;
    } else {
      const meaning =
        v > 0.1 ? t('lrMeaningRight') : v < -0.1 ? t('lrMeaningLeft') : t('lrMeaningEqual');
      const color = v > 0.1 ? "#dc2626" : v < -0.1 ? "#2563eb" : "#666";
      tr.innerHTML =
        `<td style="font-weight:600">${leftLabel} / ${rightLabel}</td>` +
        `<td>${Math.round(hzL)}</td><td>${Math.round(hzR)}</td>` +
        `<td style="color:${color}">${v >= 0 ? "+" : ""}${v.toFixed(1)}</td>` +
        `<td style="font-size:.82em;color:${color}">${meaning}</td>`;
    }
    tb.appendChild(tr);
  }

  lrDrawChart();
  lrApplyMeanToBalance();
  // BA 156
  if (typeof renderSnapshotHint === 'function' && lrEls && lrEls.snapHintBox) {
    renderSnapshotHint('lr', lrEls.snapHintBox);
  }
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
  if (count === 0) return;

  // Status pro Index ermitteln
  const status = [];   // 'measured' | 'unmeasured' | 'disabled'
  for (let i = 0; i < count; i++) {
    const rightEl = i < sideData["right"].nEl ? i : sideData["right"].nEl - 1;
    const exL = sideData.left.elExDur[i]        !== null || sideData.left.elSt[i]        === 'mute';
    const exR = sideData.right.elExDur[rightEl] !== null || sideData.right.elSt[rightEl] === 'mute';
    if (exL || exR) status[i] = 'disabled';
    else if (lrResults[i] !== undefined) status[i] = 'measured';
    else status[i] = 'unmeasured';
  }

  // Skala nur über gemessene aktive Werte
  const measuredVals = [];
  for (let i = 0; i < count; i++)
    if (status[i] === 'measured') measuredVals.push(lrResults[i]);
  if (!measuredVals.length && !status.includes('unmeasured')) return;
  const absMax = measuredVals.length
    ? Math.max(Math.ceil(Math.max(...measuredVals.map(Math.abs), 2)), 3)
    : 3;

  const pad = { top: 20, right: 16, bottom: 46, left: 52 };
  const pW = W - pad.left - pad.right;
  const pH = H - pad.top - pad.bottom;
  const idxArr = [];
  for (let i = 0; i < count; i++) idxArr.push(i);
  const axis = buildLinearAxis(idxArr, pad.left, pW, function (i) {
    return lrEffFreq("left", i);
  });
  const tX = axis.tX;
  const tY = (v) => pad.top + (absMax - v) * (pH / (2 * absMax));
  const zY = tY(0);
  const yTop = pad.top, yBot = pad.top + pH;
  const bW = Math.min((axis.minDx || 12) * 0.6, 28);

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

  // Balken/Marker für alle Indizes
  for (let i = 0; i < count; i++) {
    const x = tX(i) - bW / 2;
    if (status[i] === 'disabled') {
      drawDisabledBar(ctx, x, yTop, yBot, bW);
    } else if (status[i] === 'unmeasured') {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x + bW / 2, yTop);
      ctx.lineTo(x + bW / 2, yBot);
      ctx.stroke();
      ctx.setLineDash([]);
      // kleines Querstrich-Symbol auf der Null-Linie
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + bW * 0.25, zY);
      ctx.lineTo(x + bW * 0.75, zY);
      ctx.stroke();
    } else {
      const v = lrResults[i];
      const yV = tY(v);
      const col = v > 0.1 ? '#dc2626' : v < -0.1 ? '#2563eb' : '#9ca3af';
      ctx.fillStyle = col;
      ctx.fillRect(x, Math.min(zY, yV), bW, Math.abs(yV - zY) || 2);
    }

    // X-Achsenbeschriftung pro Elektrode (E / Hz)
    const leftLabel = withSide("left", () => dENPrefix("left") + dEN(i));
    ctx.fillStyle = "#555";
    ctx.font = "9px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(leftLabel, tX(i), H - pad.bottom + 12);
    const hzL = axis.hzArr[i];
    ctx.font = "7px Consolas,monospace";
    ctx.fillStyle = "#999";
    ctx.fillText(Math.round(hzL), tX(i), H - pad.bottom + 23);
  }
  cv._axisHits = [];
  for (let i = 0; i < count; i++) {
    const halfDx = Math.max(8, (axis.minDx || 12) / 2);
    cv._axisHits.push({
      x0: tX(i) - halfDx, x1: tX(i) + halfDx,
      y0: H - pad.bottom + 2, y1: H - pad.bottom + 32,
      label: withSide("left", () => dENPrefix("left") + dEN(i)),
      hz: axis.hzArr[i],
      // cent fehlt absichtlich — Tooltip zeigt seit BA 67 nur noch Hz
    });
  }
  _attachAxisTooltip(cv);

  // Verbindungslinie zwischen gemessenen Punkten
  ctx.strokeStyle = "#2563eb44";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let first = true;
  for (let i = 0; i < count; i++) {
    if (status[i] !== 'measured') continue;
    if (first) { ctx.moveTo(tX(i), tY(lrResults[i])); first = false; }
    else ctx.lineTo(tX(i), tY(lrResults[i]));
  }
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
  // Deaf-Hinweis
  const deafHint = document.getElementById("lrDeafHintEl");
  if (deafHint) {
    const hasDeaf = (sideData.left.config || "ci") === "deaf"
                 || (sideData.right.config || "ci") === "deaf";
    deafHint.style.display = hasDeaf ? "" : "none";
    if (hasDeaf) deafHint.textContent = t("cfgHintDeafTest");
  }
  // BA 156
  if (typeof renderSnapshotHint === 'function' && lrEls && lrEls.snapHintBox) {
    renderSnapshotHint('lr', lrEls.snapHintBox);
  }
}

// ---- DOMContentLoaded — buildTestPanel + Event-Wiring ----
document.addEventListener("DOMContentLoaded", function() {
  var parentEl = document.getElementById("subpanel-messungen-balance");
  if (!parentEl) return;

  var balanceCfg = {
    id: 'balance',
    explain: {
      titleKey: 'lrTitle',
      paragraphs: [
        { key: 'lrDesc', kind: 'plain' },
        { key: 'lrPrereqHint', kind: 'plain' }
      ]
    },
    presets: {
      rowMode: {
        show: true,
        modeKey: 'lrOrderLbl',
        modeOptions: [['random','optRandom'],['ascending','optAsc'],['descending','optDesc']],
        runKey: 'lrSideLbl',
        runOptions: [['random','optRandom'],['lr','optLR'],['rl','optRL']]
      },
      rowFine: { show: false },
      rowVolume: { show: true },
      rowSequence: {
        sequence: { show: true, source: 'global' },
        toneType: { show: true, source: 'global' },
        target: {
          show: true,
          options: ['left','right','both'],
          stateKey: 'slTarget_balance',
          default: 'both'
        }
      },
      startStop: { show: true, startKey: 'btnStartTest', resumable: false }
    },
    test: {
      subTitleKey: 'lrRunningTitle',
      subHintKey: 'lrRunningHint',
      progressBar: true,
      progressFormat: 'simple',
      swapButton: { show: true, labelKey: 'btnSwapLR' },
      pairDisplay: { mode: 'side-vs-side', labelLeft: 'L', labelRight: 'R' },
      excludeButtons: { show: false, target: 'electrodes' },
      actions: ['undo','replay','simul'],
      keyHintBox: { show: true, unitKey: 'sliderHintDb' },
      slider: { unit: 'dB', ranges: [20, 40, 60] },
      sliderValue: true,
      cumulativeDisplay: { show: true, key: 'cumulativeDb' },
      confirmButton: { show: true, key: 'btnConfirmOffset' },
      confidence: { show: true }
    }
  };

  lrEls = buildTestPanel(parentEl, balanceCfg);

  // ---- Event-Listener ----

  // Start
  lrEls.startBtn.addEventListener('click', function() {
    // BA 155: Voraussetzungs-Sperre
    if (typeof isSideUsable === 'function'
        && (!isSideUsable('left') || !isSideUsable('right'))) {
      alert(t('lrBlockedSideUnknown'));
      return;
    }
    lrBuildSequence();
    if (!lrSeq.length) {
      alert(t("lrNoElMsg") || "Keine gemeinsamen aktiven Elektroden gefunden.");
      return;
    }
    lrRunning = true;
    lrUndoStack = [];
    lrSlRangeIdx = 0;
    lrEls.startBtn.disabled = true;
    lrEls.stopBtn.disabled = false;
    lrEls.testBox.hidden = false;
    lockTestTabs(true, 'balance');
    lrShowPair();
  });

  // Stop
  lrEls.stopBtn.addEventListener('click', lrStop);

  // Swap L↔R
  if (lrEls.swapBtn) {
    lrEls.swapBtn.addEventListener('click', function() {
      lrFlipped = !lrFlipped;
      lrPlayCurrent();
    });
  }

  // Replay
  if (lrEls.replayBtn) lrEls.replayBtn.addEventListener('click', lrPlayCurrent);

  // Simul
  if (lrEls.simulBtn) lrEls.simulBtn.addEventListener('click', lrPlaySimul);

  // Confirm
  if (lrEls.confirmBtn) lrEls.confirmBtn.addEventListener('click', lrConfirm);

  // Undo
  if (lrEls.undoBtn) lrEls.undoBtn.addEventListener('click', lrUndo);

  // Exclude buttons
  if (lrEls.excludeLeftBtn) {
    lrEls.excludeLeftBtn.addEventListener('click', function() {
      if (!lrRunning || lrCurrentEl === null) return;
      _lrRequestExcl(lrCurrentEl);
    });
  }
  if (lrEls.excludeRightBtn) {
    lrEls.excludeRightBtn.addEventListener('click', function() {
      if (!lrRunning || lrCurrentEl === null) return;
      _lrRequestExcl(lrCurrentEl);
    });
  }

  // Extend button
  if (lrEls.extendBtn) {
    lrEls.extendBtn.addEventListener('click', function() {
      _lrExtSlider();
      _lrUpdSliderDisplay(_lrSliderVal());
    });
  }

  // Slider input
  if (lrEls.slider) {
    lrEls.slider.addEventListener('input', function() {
      var v = parseFloat(this.value);
      _lrUpdSliderDisplay(v);
      _lrUpdCumulative(v);
    });
    lrEls.slider.addEventListener('change', function() { this.blur(); });
    lrEls.slider.addEventListener('mouseup', function() { this.blur(); });
    lrEls.slider.addEventListener('touchend', function() { this.blur(); });
    buildSliderTouchCtrl(lrEls.slider, {
      step: 0.5,
      fineStep: 0.1,
      replay: function () { if (typeof lrPlayCurrent === 'function') lrPlayCurrent(); },
      labelReplay: '▶ ' + (t('bReplay') || 'Wiederholen')
    });
  }

  // Keyboard in balance subtab
  document.addEventListener('keydown', function(e) {
    var balSubpanel = document.getElementById('subpanel-messungen-balance');
    if (!balSubpanel || !balSubpanel.classList.contains('active')) return;
    var messPanel = document.getElementById('panel-messungen');
    if (!messPanel || !messPanel.classList.contains('active')) return;
    if (!lrRunning) return;
    const activeEl = document.activeElement;
    const isSlider = lrEls && lrEls.slider && activeEl === lrEls.slider;
    if (!isSlider && activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA')) return;

    const step = e.shiftKey ? 0.1 : 0.5;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      var sl = lrEls ? lrEls.slider : null;
      if (!sl) return;
      var r = LR_SLIDER_RANGES[lrSlRangeIdx];
      var nv = Math.max(-r, parseFloat(sl.value) - step);
      sl.value = nv.toFixed(1);
      _lrUpdSliderDisplay(nv);
      _lrUpdCumulative(nv);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      var sl = lrEls ? lrEls.slider : null;
      if (!sl) return;
      var r = LR_SLIDER_RANGES[lrSlRangeIdx];
      var nv = Math.min(r, parseFloat(sl.value) + step);
      sl.value = nv.toFixed(1);
      _lrUpdSliderDisplay(nv);
      _lrUpdCumulative(nv);
    } else if (e.key === ' ') {
      e.preventDefault();
      lrPlayCurrent();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      lrConfirm();
    } else if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      lrUndo();
    } else if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      if (lrEls && lrEls.simulBtn) lrEls.simulBtn.click();
    }
  });

  // Clear results button (in results tab, static HTML)
  var lrClearBtn = document.getElementById('lrClearBtn');
  if (lrClearBtn) {
    lrClearBtn.addEventListener('click', function() {
      if (!confirm(t("lrClearConfirm") || "LR-Vergleichsergebnisse löschen?")) return;
      lrResults = {};
      lrSnapshot = null; // BA 156
      // BA 151
      if (typeof depLockApply === 'function') depLockApply();
      var lrRC = document.getElementById("lrResultsCard");
      if (lrRC) lrRC.style.display = "none";
      var lrNR = document.getElementById("lrNoResults");
      if (lrNR) lrNR.style.display = "";
    });
  }
});

// Hook into balance subtab activation
document
  .querySelector('.subtab[data-subtab="balance"][data-parent="messungen"]')
  ?.addEventListener('click', function() {
    setTimeout(function() {
      lrCheckData();
    }, 0);
  });

// Hook into lrresults subtab activation
document
  .querySelector('.subtab[data-subtab="lrresults"][data-parent="ergebnisse"]')
  ?.addEventListener('click', function() {
    setTimeout(function() {
      lrCheckData();
      lrDrawChart();
    }, 0);
  });
