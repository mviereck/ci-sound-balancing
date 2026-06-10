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

// BA 245: Elektroden-Auswahl für den Test (null = alle testbaren).
let lrSelectedEls = null;

function _lrSliderVal() {
  if (!lrEls) return 0;
  var sl = lrEls.verfahren && lrEls.verfahren.balance
    && lrEls.verfahren.balance.slider && lrEls.verfahren.balance.slider.input;
  return sl ? parseFloat(sl.value) : 0;
}

function _lrUpdCumulative(v) {
  if (!lrEls) return;
  var cd = lrEls.verfahren && lrEls.verfahren.balance
    && lrEls.verfahren.balance.cumulativeDisplay;
  if (!cd) return;
  const existing = lrCurrentEl !== null ? lrResults[lrCurrentEl] : undefined;
  if (existing !== undefined) {
    cd.textContent =
      t("cumulativeDb") + ": " + (existing >= 0 ? "+" : "") + existing.toFixed(1) + " dB";
    cd.style.display = "";
  } else {
    cd.style.display = "none";
  }
}

// Get current slider mode from target dropdown
function _lrGetMode() {
  return slTarget_balance || "both";
}

function lrPlayTone(hz, vol, ms, pan) {
  const c = gAC();
  return playToneTyped(c, hz, vol, ms, pan, toneType_balance);
}

function lrGVol() { return Math.pow((volume_balance || 0) / 100, 2); }
function lrGDur() { return duration_balance || 1000; }
function lrGPau() { return pause_balance    || 400;  }

// BA 253: Klavier-Helfer fuer die Tonauswahl-Modalbox des
// Stereo-Balance-Tests. Tasten bis Min(leftN, rightN); disabled
// sobald auf einer der beiden Seiten abgewaehlt (elActive===false)
// oder ausgeschlossen (elExDur!=null). 'mute' zaehlt nicht als
// disabled. Frequenzen und Labels werden von der aktiven Seite
// genommen (Anzeige-Konvention).
function _lrTpKbdN() {
  var lN = (sideData.left  && sideData.left.nEl)  || 0;
  var rN = (sideData.right && sideData.right.nEl) || 0;
  return Math.min(lN, rN);
}
function _lrTpElectrodeFreqs() {
  var n = _lrTpKbdN();
  if (n <= 0) return [];
  var arr = [];
  for (var i = 0; i < n; i++) arr.push(lrEffFreq(activeSide, i));
  return arr;
}
function _lrTpElectrodeLabels() {
  var n = _lrTpKbdN();
  if (n <= 0) return [];
  var arr = [];
  var prefix = withSide(activeSide, function() { return dENPrefix(); });
  for (var i = 0; i < n; i++) {
    arr.push(prefix + withSide(activeSide, function() { return dEN(i); }));
  }
  return arr;
}
function _lrTpDisabledElectrodes() {
  var n = _lrTpKbdN();
  if (n <= 0) return [];
  var sdL = sideData.left, sdR = sideData.right;
  var dis = [];
  for (var i = 0; i < n; i++) {
    var off = (sdL.elActive && sdL.elActive[i] === false)
           || (sdL.elExDur  && sdL.elExDur[i]  != null)
           || (sdR.elActive && sdR.elActive[i] === false)
           || (sdR.elExDur  && sdR.elExDur[i]  != null);
    if (off) dis.push(i);
  }
  return dis;
}

// BA 253: State fuer den Modal-Korrektur-Toggle und die aktuell
// im Modal angeklickte Tonart (analog freqmatch/test).
var _lrTpCorrectVol = null;
var _lrTpModalTone  = null;

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

  var _lrPI = lrEls && lrEls.verfahren && lrEls.verfahren.balance
    && lrEls.verfahren.balance.pairIndicator;
  testUI.pairIndicator.setPlaying(_lrPI, firstSide);
  lrIsPlay = true;

  await lrPlayTone(firstHz, firstVol, dur, firstPan);
  if (!lrIsPlay) return;
  testUI.pairIndicator.setPlaying(_lrPI, null);
  await new Promise((r) => (lrPlayTO = setTimeout(r, pau)));
  if (!lrIsPlay) return;
  testUI.pairIndicator.setPlaying(_lrPI, secondSide);
  await lrPlayTone(secondHz, secondVol, dur, secondPan);
  testUI.pairIndicator.setPlaying(_lrPI, null);
  if (sequence_balance === "aba" && lrIsPlay) {
    await new Promise((r) => (lrPlayTO = setTimeout(r, pau)));
    if (!lrIsPlay) return;
    testUI.pairIndicator.setPlaying(_lrPI, firstSide);
    await lrPlayTone(firstHz, firstVol, dur, firstPan);
    testUI.pairIndicator.setPlaying(_lrPI, null);
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
  var _lrPI = lrEls && lrEls.verfahren && lrEls.verfahren.balance
    && lrEls.verfahren.balance.pairIndicator;
  testUI.pairIndicator.setPlaying(_lrPI, "both");
  var p1 = playToneTyped(ac, hzL, volL, dur, -1, toneType_balance);
  var p2 = playToneTyped(ac, hzR, volR, dur, 1, toneType_balance);
  Promise.all([p1, p2]).then(function() { testUI.pairIndicator.setPlaying(_lrPI, null); });
}

function lrStopPlay() {
  if (runningSources && runningSources.length) {
    for (let k = 0; k < runningSources.length; k++) {
      try { runningSources[k].stop(); } catch (e) {}
    }
    runningSources = [];
  }
  if (lrPlayTO) {
    clearTimeout(lrPlayTO);
    lrPlayTO = null;
  }
  lrIsPlay = false;
  if (lrEls && lrEls.verfahren && lrEls.verfahren.balance
      && lrEls.verfahren.balance.pairIndicator) {
    testUI.pairIndicator.setPlaying(lrEls.verfahren.balance.pairIndicator, null);
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
  // BA 245: Filter gegen Nutzer-Auswahl
  var filtered;
  if (lrSelectedEls === null) {
    filtered = available;
  } else {
    var selSet = new Set(lrSelectedEls);
    filtered = available.filter(function(i) { return selSet.has(i); });
  }
  const mode = (lrEls && lrEls.header && lrEls.header.modeSelect)
    ? lrEls.header.modeSelect.value : "random";
  if (mode === "ascending") {
    lrSeq = filtered.slice();
  } else if (mode === "descending") {
    lrSeq = filtered.slice().reverse();
  } else {
    const arr = filtered.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    lrSeq = arr;
  }
  lrSeqIdx = 0;
}

function lrDetermineFlip() {
  const mode = (lrEls && lrEls.header && lrEls.header.runSelect)
    ? lrEls.header.runSelect.value : "random";
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

  // Slider: existing-Wert oder 0 setzen; Range wird über setValue automatisch erweitert
  var slRef = lrEls && lrEls.verfahren && lrEls.verfahren.balance
    && lrEls.verfahren.balance.slider;
  const existing = lrResults[el];
  if (slRef) {
    var startVal = (existing !== undefined && isFinite(existing)) ? existing : 0;
    testUI.slider.setValue(slRef, startVal);
  }

  // Update cumulative display (previous value)
  _lrUpdCumulative(0);

  // Progress über testUI-Helfer
  var prRef = lrEls && lrEls.verfahren && lrEls.verfahren.balance
    && lrEls.verfahren.balance.progress;
  if (prRef) {
    testUI.progress.set(prRef, {
      fraction: (lrSeqIdx + 1) / lrSeq.length,
      text: t("comp") + " " + (lrSeqIdx + 1) + " " + t("of") + " " + lrSeq.length
    });
  }

  // pairIndicator: Labels und Hz-Zeile setzen
  const leftLabel = withSide("left", () => dENPrefix("left") + dEN(el));
  const rightEl = el < sideData["right"].nEl ? el : sideData["right"].nEl - 1;
  const rightLabel = withSide("right", () => dENPrefix("right") + dEN(rightEl));
  const hzL = lrEffFreq("left", el);
  const hzR = lrEffFreq("right", rightEl);
  var piRef = lrEls && lrEls.verfahren && lrEls.verfahren.balance
    && lrEls.verfahren.balance.pairIndicator;
  if (piRef) {
    testUI.pairIndicator.setLabels(piRef, {
      leftText:  "L: " + leftLabel,
      rightText: "R: " + rightLabel,
      leftHz:    Math.round(hzL),
      rightHz:   Math.round(hzR)
    });
  }

  // Undo-Button-Zustand
  var undoBtn = lrEls && lrEls.verfahren && lrEls.verfahren.balance
    && lrEls.verfahren.balance.actions && lrEls.verfahren.balance.actions.undo;
  if (undoBtn) undoBtn.disabled = lrUndoStack.length === 0;

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

function lrFinish() {
  lrStopPlay();
  lrRunning = false;
  lrSeq = [];
  lrSeqIdx = 0;
  if (lrEls && lrEls._stopTest) lrEls._stopTest();
  lockTestTabs(false, null);
  if (typeof depLockApply === 'function') depLockApply();
  lrRenderResults();
  lrApplyMeanToBalance();
}

// BA 245: "Stop" ist semantisch Pause — lrSeq und lrSeqIdx bleiben erhalten.
function lrPause() {
  lrStopPlay();
  lrRunning = false;
  if (lrEls && lrEls._stopTest) lrEls._stopTest();
  lockTestTabs(false, null);
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

// BA 251: jRes entfaellt; Lautstaerke-Daten = bRes.
function _lrHasLvData(side) {
  const s = sideData[side];
  if (!s) return false;
  return (s.bRes && s.bRes.length > 0);
}

// Sichtbarkeit der dynamischen Vortest-Hinweise oben in der Erklaer-Box.
function _lrRenderPrereqHints() {
  const lvLeftEl  = document.getElementById('lrPrereqLvLeftPara');
  const lvRightEl = document.getElementById('lrPrereqLvRightPara');
  if (lvLeftEl)  lvLeftEl.style.display  = _lrHasLvData('left')  ? 'none' : '';
  if (lvRightEl) lvRightEl.style.display = _lrHasLvData('right') ? 'none' : '';
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
  _lrRenderPrereqHints();
}

// ---- BA 245: testUI-Hooks ----

function lrHookOnStart() {
  // BA 255: Seitenabfrage vor eigentlichem Start.
  testUI.sideCheck.run(
    { sides: 'both' },
    function() {
      _lrDoStart();
    },
    function() {
      if (lrEls && lrEls._stopTest) lrEls._stopTest();
    }
  );
}

function _lrDoStart() {
  if (typeof isSideUsable === 'function'
      && (!isSideUsable('left') || !isSideUsable('right'))) {
    alert(t('lrBlockedSideUnknown'));
    if (lrEls && lrEls._stopTest) lrEls._stopTest();
    return;
  }
  // Resume: Sequenz und Position erhalten, nur Zustand wieder hochfahren
  if (!lrSeq || !lrSeq.length || lrSeqIdx >= lrSeq.length) {
    lrBuildSequence();
  }
  if (!lrSeq.length) {
    alert(t("lrNoElMsg") || "Keine gemeinsamen aktiven Elektroden gefunden.");
    if (lrEls && lrEls._stopTest) lrEls._stopTest();
    return;
  }
  lrRunning = true;
  lrUndoStack = [];
  lockTestTabs(true, 'balance');
  lrShowPair();
}

function lrHookOnStop() {
  lrPause();
}

function lrHookOnSlide(v) {
  _lrUpdCumulative(v);
}

function lrHookOnSwap() {
  lrFlipped = !lrFlipped;
  lrPlayCurrent();
}

// ---- DOMContentLoaded — buildTestPanel + Event-Wiring ----

function _lrBuildExtraFragment() {
  // Wird mit extra.inline:true in rowSequence reingehaengt, daher nur
  // ein toter Container - die Children (control-groups) wandern um.
  var frag = document.createElement('div');
  frag.dataset.row = 'lr-extra';

  // Label und Select muessen Geschwister sein, sonst loescht applyLang
  // den Select beim Setzen von textContent des Labels.
  var cgMode = document.createElement('div');
  cgMode.className = 'control-group';
  var lblMode = document.createElement('label');
  lblMode.dataset.t = 'lrOrderLbl';
  var modeSelect = document.createElement('select');
  modeSelect.id = 'lrOrderSelect';
  [['random','optRandom'],['ascending','optAsc'],['descending','optDesc']]
    .forEach(function(opt) {
      var o = document.createElement('option');
      o.value = opt[0]; o.dataset.t = opt[1];
      modeSelect.appendChild(o);
    });
  cgMode.append(lblMode, modeSelect);

  var cgSide = document.createElement('div');
  cgSide.className = 'control-group';
  var lblSide = document.createElement('label');
  lblSide.dataset.t = 'lrSideLbl';
  var runSelect = document.createElement('select');
  runSelect.id = 'lrSideSelect';
  [['random','optRandom'],['lr','optLR'],['rl','optRL']]
    .forEach(function(opt) {
      var o = document.createElement('option');
      o.value = opt[0]; o.dataset.t = opt[1];
      runSelect.appendChild(o);
    });
  cgSide.append(lblSide, runSelect);

  frag.append(cgMode, cgSide);
  frag._lrModeSelect = modeSelect;
  frag._lrRunSelect  = runSelect;
  return frag;
}

document.addEventListener("DOMContentLoaded", function() {
  var parentEl = document.getElementById("subpanel-messungen-balance");
  if (!parentEl) return;

  var extraFrag = _lrBuildExtraFragment();

  var cfg = {
    id: 'balance',
    explain: {
      titleKey: 'lrTitle',
      paragraphs: [
        { key: 'lrMaturityHint', kind: 'info'  },
        { key: 'lrDesc',         kind: 'plain' },
        // Dynamische Vortest-Hinweise (Sichtbarkeit via _lrRenderPrereqHints)
        { key: 'fmPrereqLvLeft',  kind: 'warn', id: 'lrPrereqLvLeftPara'  },
        { key: 'fmPrereqLvRight', kind: 'warn', id: 'lrPrereqLvRightPara' }
      ]
    },
    header: {
      common: {
        refSelect: false,
        // BA 253: Lautstaerke/Tondauer/Tonpause leben jetzt im
        // Tonauswahl-Modal, nicht mehr im Header.
        volume:    false,
        duration:  false,
        pause:     false,
        // BA 253: Tonart-Dropdown durch tonePopupButton ersetzt.
        toneType:  false,
        tonePopupButton: {
          getToneType: function()   { return toneType_balance; },
          setToneType: function(tt) { toneType_balance = tt; },
          onToneSelected: function(tt) { _lrTpModalTone = tt; },
          onModalClose:   function()   { _lrTpModalTone = null; _lrTpCorrectVol = null; },
          onTogglesReady: function(fn) { _lrTpCorrectVol = fn; },
          hintKey: 'tonePopupHint',
          showVolume:   true,
          showDuration: true,
          showPause:    true,
          getVolumePercent: function()  { return volume_balance; },
          setVolumePercent: function(v) { volume_balance = v; },
          getDurationMs:    function()  { return duration_balance; },
          setDurationMs:    function(v) { duration_balance = v; },
          getPauseMs:       function()  { return pause_balance; },
          setPauseMs:       function(v) { pause_balance = v; },
          getVolume:   function() { return lrGVol(); },
          getPreviewSequence: function() {
            var dur  = lrGDur();
            var pau  = lrGPau();
            var panA = (activeSide === 'left') ? -1 : 1;
            var panB = -panA;
            return [
              { hz: 1000, pan: panA, durationMs: dur },
              { pauseMs: pau },
              { hz: 1000, pan: panB, durationMs: dur }
            ];
          },
          // BA 253: Klavier mit beidseitiger Disabled-Logik.
          keyboardMode:          true,
          getElectrodeFreqs:     _lrTpElectrodeFreqs,
          getElectrodeLabels:    _lrTpElectrodeLabels,
          getDisabledElectrodes: _lrTpDisabledElectrodes,
          getHighlightMs: function() { return lrGDur() * 2 + lrGPau(); },
          onPress: function(electrodeIdx, hz) {
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (!c) return;
            var dur  = lrGDur();
            var pau  = lrGPau();
            var vol  = lrGVol();
            var panA = (activeSide === 'left') ? -1 : 1;
            var panB = -panA;
            var tt   = (_lrTpModalTone !== null) ? _lrTpModalTone : toneType_balance;
            var hzA, hzB;
            if (electrodeIdx >= 0) {
              hzA = lrEffFreq(activeSide, electrodeIdx);
              var otherSide = (activeSide === 'left') ? 'right' : 'left';
              var rN = sideData[otherSide] ? sideData[otherSide].nEl : 0;
              var otherIdx = electrodeIdx < rN ? electrodeIdx : rN - 1;
              hzB = lrEffFreq(otherSide, otherIdx);
            } else {
              hzA = hz;
              hzB = hz;
            }
            var volA = (typeof _lrTpCorrectVol === 'function') ? _lrTpCorrectVol(vol, hzA, panA) : vol;
            var volB = (typeof _lrTpCorrectVol === 'function') ? _lrTpCorrectVol(vol, hzB, panB) : vol;
            try {
              playToneTyped(c, hzA, volA, dur, panA, tt);
              setTimeout(function() {
                playToneTyped(c, hzB, volB, dur, panB, tt);
              }, dur + pau);
            } catch (e) { /* swallow */ }
          }
        },
        sequence:  { show: true, source: 'global' },
        sliderTarget: {
          options:  ['left','right','both'],
          stateKey: 'slTarget_balance',
          default:  'both'
        },
        electrodeSelection: {
          minSelected: 1,
          getSelection: function() { return lrSelectedEls; },
          setSelection: function(sel) { lrSelectedEls = sel.slice(); },
          getElectrodeStatus: function() {
            var leftN  = sideData.left.nEl;
            var rightN = sideData.right.nEl;
            var count  = Math.min(leftN, rightN);
            var testable = [], muted = [], excluded = [];
            for (var i = 0; i < count; i++) {
              var rightI = i < rightN ? i : rightN - 1;
              var exL = sideData.left.elExDur[i]       !== null;
              var exR = sideData.right.elExDur[rightI] !== null;
              var muL = sideData.left.elSt[i]          === 'mute';
              var muR = sideData.right.elSt[rightI]    === 'mute';
              if (exL || exR)      excluded.push(i);
              else if (muL || muR) muted.push(i);
              else                 testable.push(i);
            }
            return { testable: testable, muted: muted, excluded: excluded };
          },
          electrodeLabel: function(i) {
            var leftLabel = withSide("left", function() { return dENPrefix("left") + dEN(i); });
            var hzL = lrEffFreq("left", i);
            return leftLabel + " (" + Math.round(hzL) + " Hz)";
          }
        }
      },
      extra: { fragment: extraFrag, inline: true },
      startStop: { startKey: 'btnStartTest', stopKey: 'btnPauseTest', resumable: true }
    },
    verfahren: [{
      id: 'balance',
      labelKey:   'lrTitle',
      explainKey: null,
      body: {
        pairIndicator:     { variant: 'side' },
        progress:          { format: 'simple' },
        instruction:       { key: 'lrRunningHint' },
        keyHint:           { unitKey: 'sliderHintDb' },
        slider:            { unit: 'dB', initialRange: 20, maxRange: 60, touchStep: 0.5, touchFineStep: 0.1 },
        sliderValue:       { show: true },
        cumulativeDisplay: { key: 'cumulativeDb' },
        confirmButton:     { key: 'btnConfirmOffset' },
        actions:           ['undo','replay','simul','swap']
      },
      hooks: {
        onStart:   lrHookOnStart,
        onStop:    lrHookOnStop,
        onSlide:   lrHookOnSlide,
        onConfirm: lrConfirm,
        onReplay:  lrPlayCurrent,
        onUndo:    lrUndo,
        onSimul:   lrPlaySimul,
        onSwap:    lrHookOnSwap
      }
    }]
  };

  lrEls = buildTestPanel(parentEl, cfg);

  // Refs aus dem extra-Fragment in lrEls.header aufnehmen
  if (lrEls && lrEls.header) {
    lrEls.header.modeSelect = extraFrag._lrModeSelect;
    lrEls.header.runSelect  = extraFrag._lrRunSelect;
  }

  // Slider-Live-Anzeige aktualisiert auch das cumulativeDisplay
  var slInput = lrEls.verfahren && lrEls.verfahren.balance
    && lrEls.verfahren.balance.slider && lrEls.verfahren.balance.slider.input;
  if (slInput) {
    slInput.addEventListener('input', function() {
      _lrUpdCumulative(parseFloat(this.value));
    });
  }

  // Clear-Button im Ergebnis-Sub-Tab
  var lrClearBtn = document.getElementById('lrClearBtn');
  if (lrClearBtn) {
    lrClearBtn.addEventListener('click', function() {
      if (!confirm(t("lrClearConfirm") || "LR-Vergleichsergebnisse löschen?")) return;
      lrResults = {};
      lrSnapshot = null;
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
    setTimeout(function() { lrCheckData(); }, 0);
  });

// Hook into lrresults subtab activation
document
  .querySelector('.subtab[data-subtab="lrresults"][data-parent="ergebnisse"]')
  ?.addEventListener('click', function() {
    setTimeout(function() { lrCheckData(); lrDrawChart(); }, 0);
  });
