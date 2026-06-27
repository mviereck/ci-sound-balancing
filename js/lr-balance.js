// ============================================================
// LR BALANCE COMPARISON
// ============================================================

// State
let STB_results = {}; // {elIdx: offset_dB}  positive = right louder
// BA 156: Schnappschuß zum Zeitpunkt der ersten LR-Messung
let STB_snapshot = null;
let stb_seq = []; // sequence of electrode indices to test
let stb_seqIdx = 0;
let stb_currentEl = null; // current electrode index (left side numbering)
let stb_flipped = false; // if true, first tone is R then L
let STB_running = false;
let stb_undoStack = []; // [{el, prev}]
let stb_playTO = null;
let _lrKbT0 = 0;   // BA 293: Zeitpunkt des Klavier-Anschlags (Haltedauer)
let stb_isPlay = false;

// Element-Lookup (gebaut von buildTestPanel)
let STB_els = null;

// BA 245: Elektroden-Auswahl für den Test (null = alle testbaren).
let stb_selectedEls = null;

function _lrSliderVal() {
  if (!STB_els) return 0;
  var sl = STB_els.verfahren && STB_els.verfahren.stereobalance
    && STB_els.verfahren.stereobalance.slider && STB_els.verfahren.stereobalance.slider.input;
  return sl ? parseFloat(sl.value) : 0;
}

function _lrUpdCumulative(v) {
  if (!STB_els) return;
  var cd = STB_els.verfahren && STB_els.verfahren.stereobalance
    && STB_els.verfahren.stereobalance.cumulativeDisplay;
  if (!cd) return;
  const existing = stb_currentEl !== null ? STB_results[stb_currentEl] : undefined;
  if (existing !== undefined) {
    cd.textContent =
      t("cumulativeDb") + ": " + (existing >= 0 ? "+" : "") + existing.toFixed(1) + " dB";
    cd.style.display = "";
  } else {
    cd.style.display = "none";
  }
}


function STB_gVol() { return Math.pow((volume_global || 0) / 100, 2); }
function stb_gDur() { return duration_stereobalance || 1000; }
function stb_gPau() { return pause_stereobalance    || 400;  }

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
  for (var i = 0; i < n; i++) arr.push(stb_effFRQ(activeSide, i));
  return arr;
}
function _lrTpElectrodeLabels() {
  var n = _lrTpKbdN();
  if (n <= 0) return [];
  var arr = [];
  var prefix = dENPrefix(activeSide);
  for (var i = 0; i < n; i++) {
    arr.push(prefix + dEN(i, activeSide));
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
function STB_corrGain(side, elIdx) {
  return ELL_testData({ side }).correctionGain[elIdx];
}

// Get the effective frequency for electrode i on a given side
function stb_effFRQ(side, elIdx) {
  return withSide(side, () => FRQ_implantatEffektiv(elIdx));
}

// Get the electrode display number for a given side
function stb_dEN(side, elIdx) {
  return dEN(elIdx, side);
}

// BA 290: Pegel-Aufteilung fuer das Links/Rechts-Paar mit Deckelung
// "Variante A" (Gesamt-Unterschied). baseL/baseR sind die Grundpegel je
// Seite (vol * Elektrodenkorrektur). off = Slider in dB (positiv =
// rechts lauter / links leiser). Beide Seiten werden symmetrisch um
// ihren Grundpegel verschoben; ginge der lautere ueber 1.0, werden BEIDE
// proportional heruntergezogen, bis der lautere genau 1.0 ist (Verhaeltnis
// = hoerbarer Unterschied bleibt erhalten, kein Sprung am Anschlag).
// Rueckgabe { vL, vR, capped } mit capped = null | 'left' | 'right'.
function STB_pairGains(baseL, baseR, off) {
  var idealL = baseL * dB2G(-off / 2);
  var idealR = baseR * dB2G(off / 2);
  var m = Math.max(idealL, idealR);
  if (m <= 1) return { vL: idealL, vR: idealR, capped: null };
  return {
    vL: idealL / m,
    vR: idealR / m,
    capped: (idealR >= idealL) ? 'right' : 'left'
  };
}

// BA 290: Token-Liste fuer das aktuelle Links/Rechts-Paar. Liefert
// fertige Token { hz, pan, vol, durationMs, side } (vol inkl. Korrektur
// und Deckelung) und Pausen { pauseMs }. 'side' ('left'|'right') dient
// nur dem Aufleuchten (onStepStart). Reihenfolge folgt stb_flipped.
//   opts.aba === true -> erste Seite am Ende wiederholt.
function stb_sequence(opts) {
  opts = opts || {};
  var el = stb_currentEl;
  var slOff = _lrSliderVal();
  var vol = STB_gVol();
  var dur = stb_gDur();
  var pau = stb_gPau();
  var rightNEl = sideData["right"].nEl;
  var rightEl = el < rightNEl ? el : rightNEl - 1;
  var hzL = stb_effFRQ("left", el);
  var hzR = stb_effFRQ("right", rightEl);
  var corrL = STB_corrGain("left", el);
  var corrR = STB_corrGain("right", rightEl);
  var g = STB_pairGains(vol * corrL, vol * corrR, slOff);
  var tL = { hz: hzL, pan: -1, vol: g.vL, durationMs: dur, side: 'left' };
  var tR = { hz: hzR, pan:  1, vol: g.vR, durationMs: dur, side: 'right' };
  var first  = stb_flipped ? tR : tL;
  var second = stb_flipped ? tL : tR;
  var seq = [ first, { pauseMs: pau }, second ];
  if (opts.aba) {
    seq.push({ pauseMs: pau });
    seq.push(first);
  }
  return seq;
}

// Play the current LR comparison sequence
async function stb_playCurrent() {
  if (stb_currentEl === null) return;
  if (stb_isPlay) {
    stb_stopPlay();
    await new Promise((r) => setTimeout(r, 60));
  }
  var _lrPI = STB_els && STB_els.verfahren && STB_els.verfahren.stereobalance
    && STB_els.verfahren.stereobalance.pairIndicator;
  stb_isPlay = true;
  testUI.tonePlayer.playSequential(
    stb_sequence({ aba: sequence_stereobalance === 'aba' }),
    {
      toneType: toneType_stereobalance,
      onStepStart: function (index, token) {
        testUI.pairIndicator.setPlaying(_lrPI, (token && token.side) ? token.side : null);
      },
      onDone: function () {
        stb_isPlay = false;
        testUI.pairIndicator.setPlaying(_lrPI, null);
      }
    }
  );
}

function stb_playSimul() {
  if (stb_currentEl === null) return;
  stb_stopPlay();
  var _lrPI = STB_els && STB_els.verfahren && STB_els.verfahren.stereobalance
    && STB_els.verfahren.stereobalance.pairIndicator;
  stb_isPlay = true;
  testUI.pairIndicator.setPlaying(_lrPI, "both");
  testUI.tonePlayer.playSimultaneous(
    stb_sequence({ aba: false }),
    {
      toneType: toneType_stereobalance,
      onDone: function () {
        stb_isPlay = false;
        testUI.pairIndicator.setPlaying(_lrPI, null);
      }
    }
  );
}

function stb_stopPlay() {
  // BA 290: laufende Token-Sequenz der gemeinsamen Maschine abbrechen.
  if (typeof testUI !== 'undefined' && testUI.tonePlayer) {
    testUI.tonePlayer.stop();
  }
  if (runningSources && runningSources.length) {
    for (let k = 0; k < runningSources.length; k++) {
      try { runningSources[k].stop(); } catch (e) {}
    }
    runningSources = [];
  }
  if (stb_playTO) {
    clearTimeout(stb_playTO);
    stb_playTO = null;
  }
  stb_isPlay = false;
  if (STB_els && STB_els.verfahren && STB_els.verfahren.stereobalance
      && STB_els.verfahren.stereobalance.pairIndicator) {
    testUI.pairIndicator.setPlaying(STB_els.verfahren.stereobalance.pairIndicator, null);
  }
}

function stb_buildSequence() {
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
  if (stb_selectedEls === null) {
    filtered = available;
  } else {
    var selSet = new Set(stb_selectedEls);
    filtered = available.filter(function(i) { return selSet.has(i); });
  }
  const mode = (STB_els && STB_els.header && STB_els.header.modeSelect)
    ? STB_els.header.modeSelect.value : "random";
  if (mode === "ascending") {
    stb_seq = filtered.slice();
  } else if (mode === "descending") {
    stb_seq = filtered.slice().reverse();
  } else {
    const arr = filtered.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    stb_seq = arr;
  }
  stb_seqIdx = 0;
}

function stb_determineFlip() {
  const mode = (STB_els && STB_els.header && STB_els.header.runSelect)
    ? STB_els.header.runSelect.value : "random";
  if (mode === "lr") return false;
  if (mode === "rl") return true;
  return Math.random() < 0.5;
}

function stb_showPair() {
  if (stb_seqIdx >= stb_seq.length) {
    STB_finish();
    return;
  }
  const el = stb_seq[stb_seqIdx];
  stb_currentEl = el;
  stb_flipped = stb_determineFlip();

  // Slider: existing-Wert oder 0 setzen; Range wird über setValue automatisch erweitert
  var slRef = STB_els && STB_els.verfahren && STB_els.verfahren.stereobalance
    && STB_els.verfahren.stereobalance.slider;
  const existing = STB_results[el];
  if (slRef) {
    var startVal = (existing !== undefined && isFinite(existing)) ? existing : 0;
    testUI.slider.setValue(slRef, startVal);
    // setValue aktualisiert nur die Slider-Position, nicht die dB-Anzeige.
    // Wegen des onSlide-Hooks laeuft das Auto-Update in test-ui.js nicht,
    // daher hier explizit setzen (analog test.js, BA 285).
    testUI.slider.setValueDisplay(slRef, startVal.toFixed(1) + " dB");
  }

  // Update cumulative display (previous value)
  _lrUpdCumulative(0);

  // Progress über testUI-Helfer
  var prRef = STB_els && STB_els.verfahren && STB_els.verfahren.stereobalance
    && STB_els.verfahren.stereobalance.progress;
  if (prRef) {
    testUI.progress.set(prRef, {
      fraction: (stb_seqIdx + 1) / stb_seq.length,
      text: t("comp") + " " + (stb_seqIdx + 1) + " " + t("of") + " " + stb_seq.length
    });
  }

  // pairIndicator: Labels und Hz-Zeile setzen
  const leftLabel = dENPrefix("left") + dEN(el, "left");
  const rightEl = el < sideData["right"].nEl ? el : sideData["right"].nEl - 1;
  const rightLabel = dENPrefix("right") + dEN(rightEl, "right");
  const hzL = stb_effFRQ("left", el);
  const hzR = stb_effFRQ("right", rightEl);
  var piRef = STB_els && STB_els.verfahren && STB_els.verfahren.stereobalance
    && STB_els.verfahren.stereobalance.pairIndicator;
  if (piRef) {
    testUI.pairIndicator.setLabels(piRef, {
      leftText:  "L: " + leftLabel,
      rightText: "R: " + rightLabel,
      leftHz:    Math.round(hzL),
      rightHz:   Math.round(hzR)
    });
  }

  // Undo-Button-Zustand
  var undoBtn = STB_els && STB_els.verfahren && STB_els.verfahren.stereobalance
    && STB_els.verfahren.stereobalance.actions && STB_els.verfahren.stereobalance.actions.undo;
  if (undoBtn) undoBtn.disabled = stb_undoStack.length === 0;

  stb_playCurrent();
}

function stb_confirm() {
  if (stb_currentEl === null || !STB_running) return;
  const el = stb_currentEl;
  const val = _lrSliderVal();
  // Save undo
  stb_undoStack.push({ el, prev: STB_results[el] });
  STB_results[el] = val;
  // BA 156
  if (STB_snapshot === null && typeof implantSnapshot === 'function') {
    STB_snapshot = implantSnapshot();
  }
  stb_seqIdx++;
  STB_renderResults();
  STB_renderMean();
  stb_showPair();
}

function stb_undo() {
  if (!stb_undoStack.length) return;
  stb_stopPlay();
  const { el, prev } = stb_undoStack.pop();
  if (prev === undefined) delete STB_results[el];
  else STB_results[el] = prev;
  stb_seqIdx = Math.max(0, stb_seqIdx - 1);
  STB_renderResults();
  STB_renderMean();
  stb_showPair();
}

// Setzt die Vergleichsreihe vollstaendig zurueck: Reihenfolge, Position,
// aktuelle Elektrode und Undo-Stapel. Wird beim Loeschen der Ergebnisse
// (Clear-Button, resetAll) gebraucht, damit ein pausierter Fortschritt
// nicht in einen frischen Start hineinblutet (Stop = Pause, BA 245).
function STB_resetSequence() {
  stb_seq = [];
  stb_seqIdx = 0;
  stb_currentEl = null;
  stb_undoStack = [];
}

function STB_finish() {
  stb_stopPlay();
  STB_running = false;
  stb_seq = [];
  stb_seqIdx = 0;
  if (STB_els && STB_els._stopTest) STB_els._stopTest();
  lockTestTabs(false, null);
  if (typeof depLockApply === 'function') depLockApply();
  STB_renderResults();
  STB_renderMean();
  // BA 279: Abschluss-Box. STB_finish ist das natuerliche Sequenz-Ende
  // (aus stb_showPair, wenn stb_seqIdx >= stb_seq.length). stb_pause (Stop): KEINE Box.
  if (typeof testUI !== 'undefined' && testUI.completion) {
    testUI.completion.show({
      nameKey:   'tabSTB',
      subtabKey: 'tabSTB',
      bodyKey:   'STB_doneExtra'
    });
  }
}

// BA 245: "Stop" ist semantisch Pause — stb_seq und stb_seqIdx bleiben erhalten.
function stb_pause() {
  stb_stopPlay();
  STB_running = false;
  if (STB_els && STB_els._stopTest) STB_els._stopTest();
  lockTestTabs(false, null);
  if (typeof depLockApply === 'function') depLockApply();
  STB_renderResults();
}

function STB_renderMean() {
  // Mittelwert nur über aktive (nicht deaktivierte) Elektroden
  const activeKeys = Object.keys(STB_results).filter((k) => {
    const i = +k;
    const v = STB_results[i];
    if (!isFinite(v)) return false;
    // Eine Stereo-Messung gilt als deaktiviert, wenn die Elektrode auf
    // BEIDEN Seiten deaktiviert oder stumm-geschaltet ist
    const exL = sideData.left.elExDur[i]  !== null || sideData.left.elSt[i]  === 'mute';
    const exR = sideData.right.elExDur[i] !== null || sideData.right.elSt[i] === 'mute';
    return !(exL || exR);
  });
  if (!activeKeys.length) return;
  const vals = activeKeys.map((k) => STB_results[+k]);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  // Positive stb_result = right louder = right needs to be quieter = negative balance offset
  const balOffset = Math.max(-60, Math.min(60, parseFloat((-mean).toFixed(1))));

  // Mean-Anzeige
  const mvEl = document.getElementById("STB_medianValue");
  const mhEl = document.getElementById("STB_medianHint");
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
      mhEl.textContent = t('STB_balEqual');
    else if (balOffset > 0)
      mhEl.textContent = t('STB_rightLouder');
    else mhEl.textContent = t('STB_leftLouder');
  }
}

function STB_renderResults() {
  const keys = Object.keys(STB_results).map(Number);
  const noResEl = document.getElementById("STB_noResults");
  if (!keys.length) {
    document.getElementById("STB_resultsCard").style.display = "none";
    if (noResEl) noResEl.style.display = "";
    return;
  }
  document.getElementById("STB_resultsCard").style.display = "";
  if (noResEl) noResEl.style.display = "none";

  // Table
  const th = document.getElementById("STB_resTH");
  const tb = document.getElementById("STB_resTB");
  th.innerHTML =
    `<th>${t('audColEl')}</th><th>${t('STB_thHz1')}</th><th>${t('STB_thHz2')}</th><th>Offset (dB)</th><th>${t('STB_thMeaning')}</th>`;
  tb.innerHTML = "";

  const count = Math.min(sideData["left"].nEl, sideData["right"].nEl);
  for (let i = 0; i < count; i++) {
    const rightEl = i < sideData["right"].nEl ? i : sideData["right"].nEl - 1;
    const exL = sideData.left.elExDur[i]        !== null || sideData.left.elSt[i]        === 'mute';
    const exR = sideData.right.elExDur[rightEl] !== null || sideData.right.elSt[rightEl] === 'mute';
    const isDisabled = exL || exR;
    const v = STB_results[i];
    const hzL = stb_effFRQ("left", i);
    const hzR = stb_effFRQ("right", rightEl);
    const leftLabel  = dENPrefix("left")  + dEN(i, "left");
    const rightLabel = dENPrefix("right") + dEN(rightEl, "right");
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
        v > 0.1 ? t('STB_meaningRight') : v < -0.1 ? t('STB_meaningLeft') : t('STB_meaningEqual');
      const color = v > 0.1 ? "#dc2626" : v < -0.1 ? "#2563eb" : "#1a1a1a";
      tr.innerHTML =
        `<td style="font-weight:600">${leftLabel} / ${rightLabel}</td>` +
        `<td>${Math.round(hzL)}</td><td>${Math.round(hzR)}</td>` +
        `<td style="color:${color}">${v >= 0 ? "+" : ""}${v.toFixed(1)}</td>` +
        `<td style="font-size:.82em;color:${color}">${meaning}</td>`;
    }
    tb.appendChild(tr);
  }

  STB_drawChart();
  STB_renderMean();
  // BA 156
  if (typeof renderSnapshotHint === 'function' && STB_els && STB_els.snapHintBox) {
    renderSnapshotHint('stereobalance', STB_els.snapHintBox);
  }
}

function STB_drawChart() {
  const cv = document.getElementById("STB_resChart");
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
    else if (STB_results[i] !== undefined) status[i] = 'measured';
    else status[i] = 'unmeasured';
  }

  // Skala nur über gemessene aktive Werte
  const measuredVals = [];
  for (let i = 0; i < count; i++)
    if (status[i] === 'measured') measuredVals.push(STB_results[i]);
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
    return stb_effFRQ("left", i);
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
      const v = STB_results[i];
      const yV = tY(v);
      const col = v > 0.1 ? '#dc2626' : v < -0.1 ? '#2563eb' : '#9ca3af';
      ctx.fillStyle = col;
      ctx.fillRect(x, Math.min(zY, yV), bW, Math.abs(yV - zY) || 2);
    }

    // X-Achsenbeschriftung pro Elektrode (E / Hz)
    const leftLabel = dENPrefix("left") + dEN(i, "left");
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
      label: dENPrefix("left") + dEN(i, "left"),
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
    if (first) { ctx.moveTo(tX(i), tY(STB_results[i])); first = false; }
    else ctx.lineTo(tX(i), tY(STB_results[i]));
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

// BA 251: jRes entfaellt; Lautstaerke-Daten = ELL_results.
function _lrHasLvData(side) {
  const s = sideData[side];
  if (!s) return false;
  return (s.ELL_results && s.ELL_results.length > 0);
}

// Sichtbarkeit der dynamischen Vortest-Hinweise oben in der Erklaer-Box.
function _lrRenderPrereqHints() {
  const elsLeftEl  = document.getElementById('stb_prereqLvLeftPara');
  const elsRightEl = document.getElementById('stb_prereqLvRightPara');
  if (elsLeftEl)  elsLeftEl.style.display  = _lrHasLvData('left')  ? 'none' : '';
  if (elsRightEl) elsRightEl.style.display = _lrHasLvData('right') ? 'none' : '';
}

function STB_checkData() {
  const hasLeft = sideData["left"].ELL_results.length > 0;
  const hasRight = sideData["right"].ELL_results.length > 0;
  const nd = document.getElementById("stb_noData");
  if (nd) nd.style.display = hasLeft && hasRight ? "none" : "";
  // Deaf-Hinweis
  const deafHint = document.getElementById("stb_deafHintEl");
  if (deafHint) {
    const hasDeaf = (sideData.left.config || "ci") === "deaf"
                 || (sideData.right.config || "ci") === "deaf";
    deafHint.style.display = hasDeaf ? "" : "none";
    if (hasDeaf) deafHint.textContent = t("cfgHintDeafTest");
  }
  // BA 156
  if (typeof renderSnapshotHint === 'function' && STB_els && STB_els.snapHintBox) {
    renderSnapshotHint('stereobalance', STB_els.snapHintBox);
  }
  _lrRenderPrereqHints();
}

// ---- BA 245: testUI-Hooks ----

function stb_hookOnStart() {
  // BA 255: Seitenabfrage vor eigentlichem Start.
  testUI.sideCheck.run(
    { sides: 'both' },
    function() {
      _lrDoStart();
    },
    function() {
      if (STB_els && STB_els._stopTest) STB_els._stopTest();
    }
  );
}

function _lrDoStart() {
  if (typeof isSideUsable === 'function'
      && (!isSideUsable('left') || !isSideUsable('right'))) {
    alert(t('STB_blockedSideUnknown'));
    if (STB_els && STB_els._stopTest) STB_els._stopTest();
    return;
  }
  // Resume: Sequenz und Position erhalten, nur Zustand wieder hochfahren
  if (!stb_seq || !stb_seq.length || stb_seqIdx >= stb_seq.length) {
    stb_buildSequence();
  }
  if (!stb_seq.length) {
    alert(t("STB_noElMsg") || "Keine gemeinsamen aktiven Elektroden gefunden.");
    if (STB_els && STB_els._stopTest) STB_els._stopTest();
    return;
  }
  STB_running = true;
  stb_undoStack = [];
  lockTestTabs(true, 'stereobalance');
  stb_showPair();
}

function stb_hookOnStop() {
  stb_pause();
}

// BA 290: Deckelungs-Hinweis fuer Stereo-Balance (analog Test 1,
// ELL_updateClipHint). Nutzt STB_pairGains.capped.
function stb_updateClipHint(off) {
  var vref = STB_els && STB_els.verfahren && STB_els.verfahren.stereobalance;
  if (!vref || !vref.clipHint) return;
  if (stb_currentEl === null) { testUI.clipHint.set(vref.clipHint, null); return; }
  if (off == null) off = _lrSliderVal();
  var el = stb_currentEl;
  var rightNEl = sideData["right"].nEl;
  var rightEl = el < rightNEl ? el : rightNEl - 1;
  var vol = STB_gVol();
  var corrL = STB_corrGain("left", el);
  var corrR = STB_corrGain("right", rightEl);
  var g = STB_pairGains(vol * corrL, vol * corrR, off);
  if (!g.capped) { testUI.clipHint.set(vref.clipHint, null); return; }
  var capLabel   = (g.capped === 'left') ? t('sideLeft') : t('sideRight');
  var otherLabel = (g.capped === 'left') ? t('sideRight') : t('sideLeft');
  var txt = t('clipHintCapped').replace('{capped}', capLabel).replace('{other}', otherLabel);
  testUI.clipHint.set(vref.clipHint, txt);
}

function stb_hookOnSlide(v) {
  // onSlide-Hook ist verdrahtet -> Auto-dB-Anzeige in test-ui.js laeuft
  // nicht; die Anzeige hier setzen (analog test.js, BA 285).
  var slRef = STB_els && STB_els.verfahren && STB_els.verfahren.stereobalance
    && STB_els.verfahren.stereobalance.slider;
  if (slRef) testUI.slider.setValueDisplay(slRef, v.toFixed(1) + " dB");
  _lrUpdCumulative(v);
  stb_updateClipHint(v);
}

function stb_hookOnSwap() {
  stb_flipped = !stb_flipped;
  stb_playCurrent();
}

// ---- DOMContentLoaded — buildTestPanel + Event-Wiring ----

function _lrBuildExtraFragment() {
  // Wird mit extra.inline:true in rowSequence reingehaengt, daher nur
  // ein toter Container - die Children (control-groups) wandern um.
  var frag = document.createElement('div');
  frag.dataset.row = 'stb-extra';

  // Label und Select muessen Geschwister sein, sonst loescht applyLang
  // den Select beim Setzen von textContent des Labels.
  var cgMode = document.createElement('div');
  cgMode.className = 'control-group';
  var lblMode = document.createElement('label');
  lblMode.dataset.t = 'STB_orderLbl';
  var modeSelect = document.createElement('select');
  modeSelect.id = 'stb_orderSelect';
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
  lblSide.dataset.t = 'STB_sideLbl';
  var runSelect = document.createElement('select');
  runSelect.id = 'stb_sideSelect';
  [['random','optRandom'],['lr','optLR'],['rl','optRL']]
    .forEach(function(opt) {
      var o = document.createElement('option');
      o.value = opt[0]; o.dataset.t = opt[1];
      runSelect.appendChild(o);
    });
  cgSide.append(lblSide, runSelect);

  frag.append(cgSide, cgMode);
  frag._lrModeSelect = modeSelect;
  frag._lrRunSelect  = runSelect;
  return frag;
}

document.addEventListener("DOMContentLoaded", function() {
  var parentEl = document.getElementById("subpanel-messungen-stereobalance");
  if (!parentEl) return;

  var extraFrag = _lrBuildExtraFragment();

  var cfg = {
    id: 'stereobalance',
    explain: {
      titleKey: 'STB_title',
      paragraphs: [
        { key: 'STB_maturityHint', kind: 'info'  },
        { key: 'STB_desc',         kind: 'plain' },
        // Dynamische Vortest-Hinweise (Sichtbarkeit via _lrRenderPrereqHints)
        { key: 'FRQ_prereqLvLeft',  kind: 'warn', id: 'stb_prereqLvLeftPara'  },
        { key: 'FRQ_prereqLvRight', kind: 'warn', id: 'stb_prereqLvRightPara' }
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
          getToneType: function()   { return toneType_stereobalance; },
          setToneType: function(tt) { toneType_stereobalance = tt; },
          onToneSelected: function(tt) { _lrTpModalTone = tt; },
          onModalClose:   function()   { _lrTpModalTone = null; _lrTpCorrectVol = null; },
          onTogglesReady: function(fn) { _lrTpCorrectVol = fn; },
          // BA 304: Korrektur-Schalter auch in der Stereo-Balance zeigen.
          showToggles:  true,
          hintKey: 'tonePopupHint',
          showVolume:   true,
          showDuration: true,
          showPause:    true,
          getVolumePercent: function()  { return volume_global; },
          setVolumePercent: function(v) { volume_global = v; },
          getDurationMs:    function()  { return duration_stereobalance; },
          setDurationMs:    function(v) { duration_stereobalance = v; },
          getPauseMs:       function()  { return pause_stereobalance; },
          setPauseMs:       function(v) { pause_stereobalance = v; },
          getVolume:   function() { return STB_gVol(); },
          getPreviewSequence: function (lastHz) {
            if (STB_running && stb_currentEl !== null) {
              return stb_sequence({ aba: sequence_stereobalance === 'aba' });
            }
            // Kein Test: gemerkter Ton, beide Seiten nacheinander.
            // BA 301: jede Seite mit ihrer Korrektur (Elektrodenlautstaerke
            // + Balance) ueber die zentrale corrVol -- nicht mehr "gleich laut".
            var hz  = (typeof lastHz === 'number' && lastHz > 0) ? lastHz : 1000;
            var vol = STB_gVol();
            var dur = stb_gDur();
            var pau = stb_gPau();
            // BA 304: ueber die schalter-abhaengige Korrektor-fn (Default an).
            // pan kodiert die Seite (-1 = links, +1 = rechts).
            var volL = (typeof _lrTpCorrectVol === 'function') ? _lrTpCorrectVol(vol, hz, -1) : vol;
            var volR = (typeof _lrTpCorrectVol === 'function') ? _lrTpCorrectVol(vol, hz,  1) : vol;
            return [
              { hz: hz, pan: -1, vol: volL, durationMs: dur },
              { pauseMs: pau },
              { hz: hz, pan:  1, vol: volR, durationMs: dur }
            ];
          },
          // BA 253: Klavier mit beidseitiger Disabled-Logik.
          keyboardMode:          true,
          getElectrodeFreqs:     _lrTpElectrodeFreqs,
          getElectrodeLabels:    _lrTpElectrodeLabels,
          getDisabledElectrodes: _lrTpDisabledElectrodes,
          getHighlightMs: function() { return stb_gDur() * 2 + stb_gPau(); },
          onPress: function (electrodeIdx, hz) {
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (!c) return;
            _lrKbT0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            var tt   = (_lrTpModalTone !== null) ? _lrTpModalTone : toneType_stereobalance;
            var vol  = STB_gVol();
            var panA = (activeSide === 'left') ? -1 : 1;
            var hzA;
            if (electrodeIdx >= 0) {
              hzA = stb_effFRQ(activeSide, electrodeIdx);
            } else {
              hzA = hz;
            }
            // BA 304: ueber die schalter-abhaengige Korrektor-fn (Default an).
            var volA = (typeof _lrTpCorrectVol === 'function')
              ? _lrTpCorrectVol(vol, hzA, panA) : vol;
            try {
              playToneTyped(c, hzA, volA, 60000, panA, tt);
            } catch (e) { /* swallow */ }
          },
          onRelease: function (electrodeIdx, hz) {
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (typeof stopAll === 'function') stopAll();
            if (!c) return;
            var t1   = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            var held = Math.max(0, t1 - _lrKbT0);
            if (held <= 0) return;
            var tt    = (_lrTpModalTone !== null) ? _lrTpModalTone : toneType_stereobalance;
            var vol   = STB_gVol();
            var other = (activeSide === 'left') ? 'right' : 'left';
            var panB  = (activeSide === 'left') ? 1 : -1;
            var hzB;
            if (electrodeIdx >= 0) {
              var rN = sideData[other] ? sideData[other].nEl : 0;
              var oIdx = electrodeIdx < rN ? electrodeIdx : rN - 1;
              hzB = stb_effFRQ(other, oIdx);
            } else {
              hzB = hz;
            }
            // BA 304: ueber die schalter-abhaengige Korrektor-fn (Default an).
            var volB = (typeof _lrTpCorrectVol === 'function')
              ? _lrTpCorrectVol(vol, hzB, panB) : vol;
            try {
              playToneTyped(c, hzB, volB, held, panB, tt);
            } catch (e) { /* swallow */ }
          }
        },
        sequence:  { show: true, source: 'global' },
        electrodeSelection: {
          minSelected: 1,
          getSelection: function() { return stb_selectedEls; },
          setSelection: function(sel) { stb_selectedEls = sel.slice(); },
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
              var deL = sideData.left.elActive  && sideData.left.elActive[i]       === false;
              var deR = sideData.right.elActive && sideData.right.elActive[rightI] === false;
              if (exL || exR)                       excluded.push(i);
              else if (muL || muR || deL || deR)    muted.push(i);
              else                                  testable.push(i);
            }
            return { testable: testable, muted: muted, excluded: excluded };
          },
          electrodeLabel: function(i) {
            var leftLabel = dENPrefix("left") + dEN(i, "left");
            var hzL = stb_effFRQ("left", i);
            return leftLabel + " (" + Math.round(hzL) + " Hz)";
          }
        }
      },
      extra: { fragment: extraFrag, inline: true },
      startStop: { startKey: 'btnStartTest', stopKey: 'btnPauseTest', resumable: true }
    },
    verfahren: [{
      id: 'stereobalance',
      labelKey:   'STB_title',
      explainKey: null,
      body: {
        pairIndicator:     { variant: 'side' },
        progress:          { format: 'simple' },
        instruction:       { key: 'STB_runningHint' },
        keyHint:           { unitKey: 'sliderHintDb' },
        slider:            { unit: 'dB', initialRange: 20, maxRange: 60, touchStep: 0.5, touchFineStep: 0.1 },
        sliderValue:       { show: true },
        cumulativeDisplay: { key: 'cumulativeDb' },
        clipHint:          true,
        confirmButton:     { key: 'btnConfirmOffset' },
        actions:           ['undo','replay','simul','swap']
      },
      hooks: {
        onStart:   stb_hookOnStart,
        onStop:    stb_hookOnStop,
        onSlide:   stb_hookOnSlide,
        onConfirm: stb_confirm,
        onReplay:  stb_playCurrent,
        onUndo:    stb_undo,
        onSimul:   stb_playSimul,
        onSwap:    stb_hookOnSwap
      }
    }]
  };

  STB_els = buildTestPanel(parentEl, cfg);

  // Refs aus dem extra-Fragment in STB_els.header aufnehmen
  if (STB_els && STB_els.header) {
    STB_els.header.modeSelect = extraFrag._lrModeSelect;
    STB_els.header.runSelect  = extraFrag._lrRunSelect;
  }

  // Slider-Live-Anzeige aktualisiert auch das cumulativeDisplay
  var slInput = STB_els.verfahren && STB_els.verfahren.stereobalance
    && STB_els.verfahren.stereobalance.slider && STB_els.verfahren.stereobalance.slider.input;
  if (slInput) {
    slInput.addEventListener('input', function() {
      _lrUpdCumulative(parseFloat(this.value));
    });
  }

  // Clear-Button im Ergebnis-Sub-Tab
  var STB_clearBtn = document.getElementById('STB_clearBtn');
  if (STB_clearBtn) {
    STB_clearBtn.addEventListener('click', function() {
      if (!confirm(t("stb_clearConfirm") || "LR-Vergleichsergebnisse löschen?")) return;
      STB_results = {};
      STB_snapshot = null;
      STB_resetSequence();
      if (typeof depLockApply === 'function') depLockApply();
      var stb_rC = document.getElementById("STB_resultsCard");
      if (stb_rC) stb_rC.style.display = "none";
      var stb_nR = document.getElementById("STB_noResults");
      if (stb_nR) stb_nR.style.display = "";
    });
  }
});

// Wird von file.js/init.js nach loadSideData aufgerufen,
// damit die Elektroden-Summary sofort die korrekte Anzahl zeigt.
function STB_refreshElectrodeSelectionSummary() {
  if (STB_els && STB_els.header && typeof STB_els.header.electrodeSelectionUpdate === 'function') {
    STB_els.header.electrodeSelectionUpdate();
  }
}

// BA 281: Tonart-Label im Kopf nach Laden eines Stands aktualisieren.
function STB_refreshToneTypeLabel() {
  if (STB_els && STB_els.header && typeof STB_els.header.tonePopupUpdate === 'function') {
    STB_els.header.tonePopupUpdate();
  }
}

// Hook into balance subtab activation
document
  .querySelector('.subtab[data-subtab="stereobalance"][data-parent="messungen"]')
  ?.addEventListener('click', function() {
    setTimeout(function() { STB_checkData(); }, 0);
  });

// Hook into stereobalance subtab activation
document
  .querySelector('.subtab[data-subtab="stereobalance"][data-parent="ergebnisse"]')
  ?.addEventListener('click', function() {
    setTimeout(function() { STB_checkData(); STB_drawChart(); }, 0);
  });
