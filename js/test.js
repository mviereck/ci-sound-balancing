const ROUND_ROBIN = {
  12: [
    [
      [0, 1],
      [2, 11],
      [3, 10],
      [4, 9],
      [5, 8],
      [6, 7],
    ],
    [
      [0, 11],
      [1, 10],
      [2, 9],
      [3, 8],
      [4, 7],
      [5, 6],
    ],
    [
      [0, 10],
      [9, 11],
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 5],
    ],
    [
      [0, 9],
      [8, 10],
      [7, 11],
      [1, 6],
      [2, 5],
      [3, 4],
    ],
    [
      [0, 8],
      [7, 9],
      [6, 10],
      [5, 11],
      [1, 4],
      [2, 3],
    ],
    [
      [0, 7],
      [6, 8],
      [5, 9],
      [4, 10],
      [3, 11],
      [1, 2],
    ],
    [
      [0, 6],
      [5, 7],
      [4, 8],
      [3, 9],
      [2, 10],
      [1, 11],
    ],
    [
      [0, 5],
      [4, 6],
      [3, 7],
      [2, 8],
      [1, 9],
      [10, 11],
    ],
    [
      [0, 4],
      [3, 5],
      [2, 6],
      [1, 7],
      [8, 11],
      [9, 10],
    ],
    [
      [0, 3],
      [2, 4],
      [1, 5],
      [6, 11],
      [7, 10],
      [8, 9],
    ],
    [
      [0, 2],
      [1, 3],
      [4, 11],
      [5, 10],
      [6, 9],
      [7, 8],
    ],
  ],
  16: [
    [
      [0, 1],
      [2, 15],
      [3, 14],
      [4, 13],
      [5, 12],
      [6, 11],
      [7, 10],
      [8, 9],
    ],
    [
      [0, 15],
      [1, 14],
      [2, 13],
      [3, 12],
      [4, 11],
      [5, 10],
      [6, 9],
      [7, 8],
    ],
    [
      [0, 14],
      [13, 15],
      [1, 12],
      [2, 11],
      [3, 10],
      [4, 9],
      [5, 8],
      [6, 7],
    ],
    [
      [0, 13],
      [12, 14],
      [11, 15],
      [1, 10],
      [2, 9],
      [3, 8],
      [4, 7],
      [5, 6],
    ],
    [
      [0, 12],
      [11, 13],
      [10, 14],
      [9, 15],
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 5],
    ],
    [
      [0, 11],
      [10, 12],
      [9, 13],
      [8, 14],
      [7, 15],
      [1, 6],
      [2, 5],
      [3, 4],
    ],
    [
      [0, 10],
      [9, 11],
      [8, 12],
      [7, 13],
      [6, 14],
      [5, 15],
      [1, 4],
      [2, 3],
    ],
    [
      [0, 9],
      [8, 10],
      [7, 11],
      [6, 12],
      [5, 13],
      [4, 14],
      [3, 15],
      [1, 2],
    ],
    [
      [0, 8],
      [7, 9],
      [6, 10],
      [5, 11],
      [4, 12],
      [3, 13],
      [2, 14],
      [1, 15],
    ],
    [
      [0, 7],
      [6, 8],
      [5, 9],
      [4, 10],
      [3, 11],
      [2, 12],
      [1, 13],
      [14, 15],
    ],
    [
      [0, 6],
      [5, 7],
      [4, 8],
      [3, 9],
      [2, 10],
      [1, 11],
      [12, 15],
      [13, 14],
    ],
    [
      [0, 5],
      [4, 6],
      [3, 7],
      [2, 8],
      [1, 9],
      [10, 15],
      [11, 14],
      [12, 13],
    ],
    [
      [0, 4],
      [3, 5],
      [2, 6],
      [1, 7],
      [8, 15],
      [9, 14],
      [10, 13],
      [11, 12],
    ],
    [
      [0, 3],
      [2, 4],
      [1, 5],
      [6, 15],
      [7, 14],
      [8, 13],
      [9, 12],
      [10, 11],
    ],
    [
      [0, 2],
      [1, 3],
      [4, 15],
      [5, 14],
      [6, 13],
      [7, 12],
      [8, 11],
      [9, 10],
    ],
  ],
  22: [
    [
      [0, 1],
      [2, 21],
      [3, 20],
      [4, 19],
      [5, 18],
      [6, 17],
      [7, 16],
      [8, 15],
      [9, 14],
      [10, 13],
      [11, 12],
    ],
    [
      [0, 21],
      [1, 20],
      [2, 19],
      [3, 18],
      [4, 17],
      [5, 16],
      [6, 15],
      [7, 14],
      [8, 13],
      [9, 12],
      [10, 11],
    ],
    [
      [0, 20],
      [19, 21],
      [1, 18],
      [2, 17],
      [3, 16],
      [4, 15],
      [5, 14],
      [6, 13],
      [7, 12],
      [8, 11],
      [9, 10],
    ],
    [
      [0, 19],
      [18, 20],
      [17, 21],
      [1, 16],
      [2, 15],
      [3, 14],
      [4, 13],
      [5, 12],
      [6, 11],
      [7, 10],
      [8, 9],
    ],
    [
      [0, 18],
      [17, 19],
      [16, 20],
      [15, 21],
      [1, 14],
      [2, 13],
      [3, 12],
      [4, 11],
      [5, 10],
      [6, 9],
      [7, 8],
    ],
    [
      [0, 17],
      [16, 18],
      [15, 19],
      [14, 20],
      [13, 21],
      [1, 12],
      [2, 11],
      [3, 10],
      [4, 9],
      [5, 8],
      [6, 7],
    ],
    [
      [0, 16],
      [15, 17],
      [14, 18],
      [13, 19],
      [12, 20],
      [11, 21],
      [1, 10],
      [2, 9],
      [3, 8],
      [4, 7],
      [5, 6],
    ],
    [
      [0, 15],
      [14, 16],
      [13, 17],
      [12, 18],
      [11, 19],
      [10, 20],
      [9, 21],
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 5],
    ],
    [
      [0, 14],
      [13, 15],
      [12, 16],
      [11, 17],
      [10, 18],
      [9, 19],
      [8, 20],
      [7, 21],
      [1, 6],
      [2, 5],
      [3, 4],
    ],
    [
      [0, 13],
      [12, 14],
      [11, 15],
      [10, 16],
      [9, 17],
      [8, 18],
      [7, 19],
      [6, 20],
      [5, 21],
      [1, 4],
      [2, 3],
    ],
    [
      [0, 12],
      [11, 13],
      [10, 14],
      [9, 15],
      [8, 16],
      [7, 17],
      [6, 18],
      [5, 19],
      [4, 20],
      [3, 21],
      [1, 2],
    ],
    [
      [0, 11],
      [10, 12],
      [9, 13],
      [8, 14],
      [7, 15],
      [6, 16],
      [5, 17],
      [4, 18],
      [3, 19],
      [2, 20],
      [1, 21],
    ],
    [
      [0, 10],
      [9, 11],
      [8, 12],
      [7, 13],
      [6, 14],
      [5, 15],
      [4, 16],
      [3, 17],
      [2, 18],
      [1, 19],
      [20, 21],
    ],
    [
      [0, 9],
      [8, 10],
      [7, 11],
      [6, 12],
      [5, 13],
      [4, 14],
      [3, 15],
      [2, 16],
      [1, 17],
      [18, 21],
      [19, 20],
    ],
    [
      [0, 8],
      [7, 9],
      [6, 10],
      [5, 11],
      [4, 12],
      [3, 13],
      [2, 14],
      [1, 15],
      [16, 21],
      [17, 20],
      [18, 19],
    ],
    [
      [0, 7],
      [6, 8],
      [5, 9],
      [4, 10],
      [3, 11],
      [2, 12],
      [1, 13],
      [14, 21],
      [15, 20],
      [16, 19],
      [17, 18],
    ],
    [
      [0, 6],
      [5, 7],
      [4, 8],
      [3, 9],
      [2, 10],
      [1, 11],
      [12, 21],
      [13, 20],
      [14, 19],
      [15, 18],
      [16, 17],
    ],
    [
      [0, 5],
      [4, 6],
      [3, 7],
      [2, 8],
      [1, 9],
      [10, 21],
      [11, 20],
      [12, 19],
      [13, 18],
      [14, 17],
      [15, 16],
    ],
    [
      [0, 4],
      [3, 5],
      [2, 6],
      [1, 7],
      [8, 21],
      [9, 20],
      [10, 19],
      [11, 18],
      [12, 17],
      [13, 16],
      [14, 15],
    ],
    [
      [0, 3],
      [2, 4],
      [1, 5],
      [6, 21],
      [7, 20],
      [8, 19],
      [9, 18],
      [10, 17],
      [11, 16],
      [12, 15],
      [13, 14],
    ],
    [
      [0, 2],
      [1, 3],
      [4, 21],
      [5, 20],
      [6, 19],
      [7, 18],
      [8, 17],
      [9, 16],
      [10, 15],
      [11, 14],
      [12, 13],
    ],
  ],
};

// ============================================================
// PAIRS & WEIGHTED LEAST SQUARES
// ============================================================
function actEl() {
  return [...Array(nEl).keys()].filter(
    (i) => elExDur[i] === null && elSt[i] !== "mute",
  );
}
function allEl() {
  return [...Array(nEl).keys()];
}
function allPairs() {
  const a = actEl(),
    p = [];
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++) p.push([a[i], a[j]]);
  return p;
}
function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
function randAB(p) {
  return p.map(([x, y]) => (Math.random() < 0.5 ? [x, y] : [y, x]));
}
function gWt(i) {
  const s = elSt[i];
  if (elExDur[i] !== null || s === "mute") return 0;
  if (s === "almostMute") return 0.05;
  if (s === "noisyHeavy") return 0.15;
  if (s === "noisyMore") return 0.4;
  if (s === "noisyLess") return 0.8;
  return 1;
}
function compWLS() {
  const n = nEl,
    lv = new Array(n).fill(0);
  const valid = bRes.filter(
    (r) =>
      r.a >= 0 &&
      r.a < n &&
      r.b >= 0 &&
      r.b < n &&
      elExDur[r.a] === null &&
      elSt[r.a] !== "mute" &&
      elExDur[r.b] === null &&
      elSt[r.b] !== "mute",
  );
  if (!valid.length)
    return {
      levels: lv,
      residuals: [],
      elRes: new Array(n).fill(0),
      elWt: new Array(n).fill(1),
    };
  for (let it = 0; it < 80; it++) {
    const su = new Array(n).fill(0),
      wt = new Array(n).fill(0);
    for (const r of valid) {
      const w = Math.min(gWt(r.a), gWt(r.b));
      su[r.b] += (lv[r.a] - r.offset) * w;
      wt[r.b] += w;
      su[r.a] += (lv[r.b] + r.offset) * w;
      wt[r.a] += w;
    }
    for (let i = 0; i < n; i++) {
      if (i === refEl) {
        lv[i] = 0;
        continue;
      }
      if (wt[i] > 0) lv[i] = su[i] / wt[i];
    }
  }
  const res = valid.map((r) => ({
    ...r,
    residual: Math.abs(r.offset - (lv[r.a] - lv[r.b])),
  }));
  const ea = new Array(n).fill(null).map(() => []);
  for (const r of res) {
    ea[r.a].push(r.residual);
    ea[r.b].push(r.residual);
  }
  const elRes = ea.map((a) =>
    a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0,
  );
  return {
    levels: lv,
    residuals: res,
    elRes,
    elWt: new Array(n).fill(0).map((_, i) => gWt(i)),
  };
}

function getConvPairs(fast) {
  if (fast && bRes.length > 0) {
    const { residuals } = compWLS();
    const act = new Set(actEl());
    const vr = residuals
      .filter((r) => act.has(r.a) && act.has(r.b))
      .sort((a, b) => b.residual - a.residual);
    const tp = vr
      .slice(0, Math.max(5, Math.ceil(vr.length * 0.2)))
      .map((r) => [r.a, r.b]);
    const ap = allPairs(),
      ex = shuffle(ap).slice(0, Math.min(5, ap.length));
    const seen = new Set(),
      mg = [];
    [...tp, ...ex].forEach((p) => {
      const k = Math.min(p[0], p[1]) + "-" + Math.max(p[0], p[1]);
      if (!seen.has(k)) {
        seen.add(k);
        mg.push(p);
      }
    });
    return mg;
  }
  return allPairs();
}

// ============================================================
// LS-HINT: Schätzung und Unsicherheit für Paar (a, b)
// ============================================================
function getLsEstimate(a, b) {
  if (bRes.length === 0) return { estimate: 0, halfWidth: 0, hasData: false };
  const { levels, elRes } = compWLS();
  const wA = gWt(a), wB = gWt(b);
  if (wA <= 0 || wB <= 0) return { estimate: 0, halfWidth: 0, hasData: false };
  const nA = bRes.filter(r => r.a === a || r.b === a).length;
  const nB = bRes.filter(r => r.a === b || r.b === b).length;
  const N = Math.min(nA, nB);
  const resTerm = Math.max(elRes[a] || 0, elRes[b] || 0);
  const prior = LS_HINT_BASIS_DB * LS_HINT_K / (LS_HINT_K + N);
  const halfWidth = Math.sqrt(resTerm * resTerm + prior * prior);
  return { estimate: levels[a] - levels[b], halfWidth, hasData: true };
}

// ============================================================
// TEST — Element-Lookup via testEls (gebaut von buildTestPanel)
// ============================================================
let testEls = null;
// Slider-Extend-Stufen: [20,40,60] dB
const TEST_SLIDER_RANGES = [20, 40, 60];
let testSlRangeIdx = 0; // aktueller Stufen-Index
// LS-Hint Parameter (Bauanleitung 61)
const LS_HINT_BASIS_DB = 2.5;
const LS_HINT_K = 3;

// ---- Slider-Helfer ----
function _testRstSlR() {
  if (!testEls) return;
  slExt = false;
  testSlRangeIdx = 0;
  const s = testEls.slider;
  const r = TEST_SLIDER_RANGES[0];
  s.min = String(-r); s.max = String(r); s.step = "0.1";
  if (testEls.extendBtn) testEls.extendBtn.hidden = true;
}
function _testExtSlider() {
  if (!testEls) return;
  testSlRangeIdx = Math.min(testSlRangeIdx + 1, TEST_SLIDER_RANGES.length - 1);
  const r = TEST_SLIDER_RANGES[testSlRangeIdx];
  testEls.slider.min = String(-r);
  testEls.slider.max = String(r);
  slExt = true;
  if (testEls.extendBtn) {
    testEls.extendBtn.hidden = (testSlRangeIdx >= TEST_SLIDER_RANGES.length - 1);
  }
  _testUpdLsHint();
}
function _testCheckExtend(sv) {
  if (!testEls || !testEls.extendBtn) return;
  const r = TEST_SLIDER_RANGES[testSlRangeIdx];
  const atLimit = Math.abs(sv) >= r - 0.5;
  const canExtend = testSlRangeIdx < TEST_SLIDER_RANGES.length - 1;
  testEls.extendBtn.hidden = !(atLimit && canExtend && !slExt);
}
function _testUpdCumulative(sv) {
  if (!testEls || !testEls.cumulativeDisplay) return;
  if (curBase !== 0) {
    const tot = curBase + sv;
    testEls.cumulativeDisplay.textContent =
      `${t("total")}: ${tot >= 0 ? "+" : ""}${tot.toFixed(1)} dB (${t("prev")}: ${curBase >= 0 ? "+" : ""}${curBase.toFixed(1)} dB)`;
    testEls.cumulativeDisplay.style.display = "";
  } else {
    testEls.cumulativeDisplay.style.display = "none";
  }
  _testCheckExtend(sv);
}
function _testUpdLsHint() {
  if (!testEls || !testEls.lsHint) return;
  if (testMode !== "balance" || !testAct || testIdx >= testPairs.length) {
    testEls.lsHint.style.display = "none";
    return;
  }
  const lsEst = getLsEstimate(curA, curB);
  if (!lsEst.hasData) {
    testEls.lsHint.style.display = "none";
    return;
  }
  const xLs = lsEst.estimate - curBase;
  const r = TEST_SLIDER_RANGES[testSlRangeIdx];
  const markPct = ((xLs + r) / (2 * r)) * 100;
  if (markPct < 0 || markPct > 100) {
    testEls.lsHint.style.display = "none";
    return;
  }
  testEls.lsHint.style.display = "";
  testEls.lsHintMark.style.left = markPct + "%";
  testEls.lsHintLabel.style.left = markPct + "%";
  testEls.lsHintLabel.textContent =
    (xLs >= 0 ? "+" : "") + xLs.toFixed(1) + " dB";
  const hw = lsEst.halfWidth;
  const bandLeft = Math.max(-r, xLs - hw);
  const bandRight = Math.min(r, xLs + hw);
  const bandLeftPct = ((bandLeft + r) / (2 * r)) * 100;
  const bandWidthPct = ((bandRight - bandLeft) / (2 * r)) * 100;
  testEls.lsHintBand.style.left = bandLeftPct + "%";
  testEls.lsHintBand.style.width = bandWidthPct + "%";
}
function _testSliderVal() {
  return testEls ? parseFloat(testEls.slider.value) : 0;
}

// ---- Ausschluss-Helfer ----
function _testRequestExcl(elIdx) {
  if (!testEls) return;
  stopAll();
  const label = `${dENPrefix()}${dEN(elIdx)} (${Math.round(effFreq(elIdx))} Hz)`;
  setTestExclConfirm(testEls.exclOverlay, label, function() {
    doExcl(elIdx);
  });
}

// ---- Swap-Helfer ----
function _testSwap() {
  if (!testAct || testIdx >= testPairs.length || !testEls) return;
  stopAll();
  const slVal = _testSliderVal();
  const totOff = curBase + slVal;
  [curA, curB] = [curB, curA];
  testPairs[testIdx] = [curA, curB];
  curBase = 0;
  _testRstSlR();
  const newSlVal = -totOff;
  const s = testEls.slider;
  const absV = Math.abs(newSlVal);
  // Expand range if needed
  while (absV > TEST_SLIDER_RANGES[testSlRangeIdx] && testSlRangeIdx < TEST_SLIDER_RANGES.length - 1) {
    testSlRangeIdx++;
  }
  const r = TEST_SLIDER_RANGES[testSlRangeIdx];
  s.min = String(-r); s.max = String(r);
  s.value = String(newSlVal);
  if (testEls.sliderValue) testEls.sliderValue.textContent = newSlVal.toFixed(1) + " dB";
  _testUpdCumulative(newSlVal);
  testEls.pairLeft.innerHTML = `<span class="aba-label">A</span>${dENPrefix()}${dEN(curA)}`;
  testEls.pairRight.innerHTML = `<span class="aba-label">B</span>${dENPrefix()}${dEN(curB)}`;
  testEls.pairFreq.textContent = `${Math.round(effFreq(curA))} Hz vs. ${Math.round(effFreq(curB))} Hz`;
  playCur();
}

function startTest() {
  // BA 155
  if (typeof isSideUsable === 'function' && !isSideUsable(activeSide)) {
    alert(t('testBlockedSideUnknown'));
    return;
  }
  if (!testEls) return;
  const pt = testEls.runSelect ? testEls.runSelect.value : "full";
  testMode = testEls.modeSelect ? testEls.modeSelect.value : "balance";
  if (pt === "manual") return;
  let p;
  if (pt === "full") {
    // Round-Robin: persistentes Fortsetzen
    const s = sideData[activeSide];
    const rrTable = ROUND_ROBIN[nEl];
    if (!rrTable) {
      p = allPairs();
    } else {
      if (s.fullSweepRound === null) {
        s.fullSweepRound = 1;
        s.fullSweepDonePairs = [];
      }
      fullSweepRound = s.fullSweepRound;
      fullSweepDonePairs = s.fullSweepDonePairs;
      const roundPairs = rrTable[fullSweepRound - 1];
      const actSet = new Set(actEl());
      const available = roundPairs.filter(([a, b]) => actSet.has(a) && actSet.has(b));
      const doneSet = new Set(fullSweepDonePairs.map(([a, b]) => a + "-" + b));
      const open = available.filter(([a, b]) => !doneSet.has(a + "-" + b));
      p = open;
    }
    testPairs = randAB(shuffle(p));
    testIdx = 0;
    undoSt = [];
    testAct = true;
    curPlayed = false;
    compCnt = 0;
    convRnd = 0;
    tStart = Date.now();
    testEls.startBtn.disabled = true;
    testEls.stopBtn.disabled = false;
    testEls.testBox.hidden = false;
    if (testEls.subTitle) testEls.subTitle.textContent = t("testRunningTitle") || "";
    updFullSweepInfo();
    lockTestTabs(true, 'test');
    startTmr();
    showMode();
    showCurPair();
    return;
  }
  if (pt === "conv_fast") p = getConvPairs(true);
  else p = allPairs();
  testPairs = randAB(shuffle(p));
  testIdx = 0;
  undoSt = [];
  testAct = true;
  curPlayed = false;
  compCnt = 0;
  convRnd = pt === "conv_fast" ? 1 : 0;
  tStart = Date.now();
  testEls.startBtn.disabled = true;
  testEls.stopBtn.disabled = false;
  testEls.testBox.hidden = false;
  if (convRnd > 0) {
    if (testEls.progressText)
      testEls.progressText.textContent = `${t("round")} ${convRnd} – ${testPairs.length} ${t("comp")}`;
  } else {
    if (testEls.progressText) testEls.progressText.textContent = "";
  }
  lockTestTabs(true, 'test');
  startTmr();
  showMode();
  showCurPair();
}
function endTest() {
  stopAll();
  testAct = false;
  curPlayed = false;
  if (testEls) {
    testEls.startBtn.disabled = false;
    testEls.stopBtn.disabled = true;
    testEls.testBox.hidden = true;
  }
  lockTestTabs(false, null);
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  stopTmr();
}
function showMode() {
  if (!testEls) return;
  const j = testMode === "judgment";
  if (testEls.jdgContainer) testEls.jdgContainer.style.display = j ? "" : "none";
  if (testEls.confirmBtn) testEls.confirmBtn.style.display = j ? "none" : "";
  if (testEls.swapBtn) testEls.swapBtn.style.display = j ? "none" : "";
}
function showCurPair() {
  if (!testEls) return;
  const pt = testEls.runSelect ? testEls.runSelect.value : "full";
  if (testIdx >= testPairs.length) {
    if (pt === "full") return nextFullRound();
    if (convRnd > 0) return nextConvRnd();
    endTest();
    renderResults();
    return;
  }
  const [a, b] = testPairs[testIdx];
  curA = a;
  curB = b;
  if (testEls.progressText) {
    if (pt === "full") {
      const s = sideData[activeSide];
      const rrTable = ROUND_ROBIN[nEl];
      if (rrTable) {
        const maxRounds = rrTable.length;
        const pairsPerRound = rrTable[0].length;
        const completedRounds = s.fullSweepRound - 1;
        const totalPairs = maxRounds * pairsPerRound;
        const n = completedRounds * pairsPerRound + testIdx + 1;
        testEls.progressText.textContent =
          `${t("comp")} ${n} ${t("of")} ${totalPairs}. ${t("round")} ${s.fullSweepRound} ${t("of")} ${maxRounds}. ${t("testInRound")} ${testIdx + 1} ${t("of")} ${testPairs.length}`;
      }
    } else {
      testEls.progressText.textContent = `${t("comp")} ${testIdx + 1} ${t("of")} ${testPairs.length}${convRnd > 0 ? ` (${t("round")} ${convRnd})` : ""}`;
    }
  }
  testEls.pairLeft.innerHTML = `<span class="aba-label">A</span>${dENPrefix()}${dEN(a)}`;
  testEls.pairRight.innerHTML = `<span class="aba-label">B</span>${dENPrefix()}${dEN(b)}`;
  testEls.pairFreq.textContent = `${Math.round(effFreq(a))} Hz vs. ${Math.round(effFreq(b))} Hz`;
  if (testMode === "balance") {
    const ex = bRes.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
    const lsEst = getLsEstimate(a, b);
    if (ex) {
      curBase = ex.a === a ? ex.offset : -ex.offset;
    } else if (lsEst.hasData) {
      curBase = lsEst.estimate;
    } else {
      curBase = 0;
    }
    _testRstSlR();
    const absBase = Math.abs(curBase);
    while (absBase > TEST_SLIDER_RANGES[testSlRangeIdx] && testSlRangeIdx < TEST_SLIDER_RANGES.length - 1) {
      testSlRangeIdx++;
    }
    testEls.slider.value = "0";
    if (testEls.sliderValue) testEls.sliderValue.textContent = "0.0 dB";
    _testUpdCumulative(0);
    _testUpdLsHint();
  }
  // Reset confidence
  if (testEls.confRadios && testEls.confRadios['none']) testEls.confRadios['none'].checked = true;
  curPlayed = false;
  updUndo();
  playCur();
}
function playCur() {
  if (testIdx >= testPairs.length) return;
  stopAll();
  isPlay = true;
  if (testMode === "balance")
    playSeq(curA, curB, curBase + _testSliderVal());
  else playSeq(curA, curB, 0);
  curPlayed = true;
}
function recJdg(r) {
  if (!testAct || testIdx >= testPairs.length || !curPlayed) return;
  const a = curA, b = curB, ne = { a, b, result: r, timestamp: Date.now() };
  const ei = jRes.findIndex((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  if (ei >= 0) {
    undoSt.push({ t: "j", a: "r", e: ne, p: { ...jRes[ei] } });
    jRes[ei] = ne;
  } else {
    undoSt.push({ t: "j", a: "a", e: ne });
    jRes.push(ne);
  }
  testIdx++;
  compCnt++;
  updUndo();
  showCurPair();
}
function recBal() {
  if (!testAct || testIdx >= testPairs.length) return;
  const a = curA, b = curB, tot = curBase + _testSliderVal();
  const ne = { a, b, offset: tot, timestamp: Date.now() };
  const ei = bRes.findIndex((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  if (ei >= 0) {
    undoSt.push({ t: "b", a: "r", e: ne, p: { ...bRes[ei] } });
    bRes[ei] = ne;
  } else {
    undoSt.push({ t: "b", a: "a", e: ne });
    bRes.push(ne);
  }
  // Vollständig: gemessenes Paar als erledigt markieren
  const pt = testEls ? testEls.runSelect.value : "";
  if (pt === "full") {
    const ka = Math.min(a, b), kb = Math.max(a, b);
    const s = sideData[activeSide];
    if (!s.fullSweepDonePairs.some(([x, y]) => x === ka && y === kb)) {
      s.fullSweepDonePairs.push([ka, kb]);
    }
    fullSweepDonePairs = s.fullSweepDonePairs;
  }
  testIdx++;
  compCnt++;
  updUndo();
  showCurPair();
}
function undoL() {
  if (!testAct || !undoSt.length || testIdx <= 0) return;
  stopAll();
  testIdx--;
  compCnt = Math.max(0, compCnt - 1);
  const u = undoSt.pop();
  if (u.t === "j") {
    if (u.a === "a") {
      const i = jRes.findIndex((x) => x.timestamp === u.e.timestamp);
      if (i >= 0) jRes.splice(i, 1);
    } else {
      const i = jRes.findIndex((x) => x.a === u.e.a && x.b === u.e.b);
      if (i >= 0) jRes[i] = u.p;
    }
  } else {
    if (u.a === "a") {
      const i = bRes.findIndex((x) => x.timestamp === u.e.timestamp);
      if (i >= 0) bRes.splice(i, 1);
    } else {
      const i = bRes.findIndex((x) => x.a === u.e.a && x.b === u.e.b);
      if (i >= 0) bRes[i] = u.p;
    }
    // Bug-Fix §6.9: Bei full-Modus auch aus fullSweepDonePairs entfernen
    const pt = testEls ? testEls.runSelect.value : "";
    if (pt === "full") {
      const ka = Math.min(u.e.a, u.e.b);
      const kb = Math.max(u.e.a, u.e.b);
      const s = sideData[activeSide];
      const idx = s.fullSweepDonePairs.findIndex(([x, y]) => x === ka && y === kb);
      if (idx >= 0) s.fullSweepDonePairs.splice(idx, 1);
      fullSweepDonePairs = s.fullSweepDonePairs;
    }
  }
  updUndo();
  showCurPair();
}
function updUndo() {
  if (testEls && testEls.undoBtn)
    testEls.undoBtn.disabled = testIdx <= 0 || !undoSt.length;
}
function updFullSweepInfo() {}
function nextFullRound() {
  const s = sideData[activeSide];
  const rrTable = ROUND_ROBIN[nEl];
  const maxRounds = rrTable ? rrTable.length : 0;
  s.fullSweepRound++;
  s.fullSweepDonePairs = [];
  fullSweepRound = s.fullSweepRound;
  fullSweepDonePairs = [];
  if (s.fullSweepRound > maxRounds) {
    s.fullSweepRound = null;
    s.fullSweepDonePairs = [];
    fullSweepRound = null;
    fullSweepDonePairs = [];
    endTest();
    renderResults();
    return;
  }
  const actSet = new Set(actEl());
  const roundPairs = rrTable[s.fullSweepRound - 1].filter(
    ([a, b]) => actSet.has(a) && actSet.has(b),
  );
  testPairs = randAB(shuffle(roundPairs));
  testIdx = 0;
  undoSt = [];
  updFullSweepInfo();
  showCurPair();
}
function nextConvRnd() {
  const { residuals } = compWLS();
  const act = new Set(actEl());
  const vr = residuals.filter((r) => act.has(r.a) && act.has(r.b));
  const mx = vr.length ? Math.max(...vr.map((r) => r.residual)) : 0;
  if (mx < 1) {
    endTest();
    renderResults();
    return;
  }
  convRnd++;
  const sr = [...vr].sort((a, b) => b.residual - a.residual);
  const tp = sr
    .slice(0, Math.max(5, Math.ceil(sr.length * 0.2)))
    .map((r) => [r.a, r.b]);
  const ap = allPairs(),
    ex = shuffle(ap).slice(0, Math.min(Math.max(3, Math.floor(ap.length * 0.1)), 8));
  const seen = new Set(), mg = [];
  [...tp, ...ex].forEach((p) => {
    const k = Math.min(p[0], p[1]) + "-" + Math.max(p[0], p[1]);
    if (!seen.has(k)) { seen.add(k); mg.push(p); }
  });
  testPairs = randAB(shuffle(mg));
  testIdx = 0;
  undoSt = [];
  if (testEls && testEls.progressText)
    testEls.progressText.textContent = `${t("round")} ${convRnd} – ${mg.length} (max res: ${mx.toFixed(1)} dB)`;
  showCurPair();
}
function doExcl(i) {
  elExDur[i] = Date.now();
  const rem = testPairs.slice(testIdx).filter(([a, b]) => a !== i && b !== i);
  testPairs = [...testPairs.slice(0, testIdx), ...rem];
  buildFreqTable();
  if (testEls && testEls.progressText)
    testEls.progressText.textContent = `${dENPrefix()}${dEN(i)} ${t("exclDuring")}. ${testPairs.length - testIdx} ${t("pairsRem")}.`;
  if (testIdx >= testPairs.length) {
    endTest();
    renderResults();
  } else showCurPair();
}
function startTmr() {
  tStart = Date.now();
  tInt = setInterval(updTmr, 1000);
  updTmr();
}
function stopTmr() {
  if (tInt) { clearInterval(tInt); tInt = null; }
}
function updTmr() {
  const e = Math.floor((Date.now() - tStart) / 1000);
  if (testEls && testEls.timerDisplay)
    testEls.timerDisplay.textContent = `${Math.floor(e / 60)}:${String(e % 60).padStart(2, "0")}`;
}
function playManPair() {
  if (!testEls) return;
  const a = parseInt(testEls.manA.value), b = parseInt(testEls.manB.value);
  if (a === b) return;
  const [pa, pb] = Math.random() < 0.5 ? [a, b] : [b, a];
  testAct = true;
  testPairs = [[pa, pb]];
  testIdx = 0;
  undoSt = [];
  testMode = testEls.modeSelect ? testEls.modeSelect.value : "balance";
  convRnd = 0;
  testEls.testBox.hidden = false;
  testEls.stopBtn.disabled = false;
  if (testEls.progressText) testEls.progressText.textContent = "";
  showMode();
  if (testEls.progressText) testEls.progressText.textContent = t("manComp");
  curA = pa;
  curB = pb;
  testEls.pairLeft.innerHTML = `<span class="aba-label">A</span>${dENPrefix()}${dEN(pa)}`;
  testEls.pairRight.innerHTML = `<span class="aba-label">B</span>${dENPrefix()}${dEN(pb)}`;
  testEls.pairFreq.textContent = `${Math.round(effFreq(pa))} Hz vs. ${Math.round(effFreq(pb))} Hz`;
  if (testMode === "balance") {
    const ex = bRes.find((r) => (r.a === pa && r.b === pb) || (r.a === pb && r.b === pa));
    curBase = ex ? (ex.a === pa ? ex.offset : -ex.offset) : 0;
    _testRstSlR();
    const absBaseM = Math.abs(curBase);
    while (absBaseM > TEST_SLIDER_RANGES[testSlRangeIdx] && testSlRangeIdx < TEST_SLIDER_RANGES.length - 1) {
      testSlRangeIdx++;
    }
    testEls.slider.value = "0";
    if (testEls.sliderValue) testEls.sliderValue.textContent = "0.0 dB";
    _testUpdCumulative(0);
  }
  curPlayed = false;
  startTmr();
  playCur();
}
function afterManRes() {
  stopTmr();
  if (testEls) testEls.testBox.hidden = true;
  testAct = false;
  curPlayed = false;
  lockTestTabs(false, null);
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  renderResults();
}

// ============================================================
// updateRunExplain — Erklärungstext für den Run-Modus
// ============================================================
function updateRunExplain() {
  const box = testEls ? testEls.runExplainBox : document.getElementById("runExplain");
  if (!box) return;
  const pt = testEls ? (testEls.runSelect ? testEls.runSelect.value : "full") : "full";
  const explain = {
    full: t("runExplFull"),
    conv_fast: t("runExplCF"),
    manual: t("runExplMan"),
  };
  box.textContent = explain[pt] || "";
}

// ============================================================
// DOMContentLoaded — buildTestPanel + Event-Wiring
// ============================================================
document.addEventListener("DOMContentLoaded", function() {
  var parentEl = document.getElementById("subpanel-messungen-test");
  if (!parentEl) return;

  var testCfg = {
    id: 'test',
    explain: {
      titleKey: 'testExplainTitle',
      paragraphs: [
        { key: 'testIntro', kind: 'plain' },
        { key: 'testExplainRecommend' },
        { key: 'testExplainVarious', kind: 'plain' }
      ]
    },
    presets: {
      rowMode: {
        show: true,
        hideModeControl: true,
        modeKey: 'lblMode',
        modeOptions: [['balance','optBal'],['judgment','optJdg']],
        runKey: 'lblRun',
        runOptions: [['full','optFull'],['conv_fast','optCF'],['manual','optMan']]
      },
      rowFine: {
        show: true,
      },
      rowVolume: { show: true },
      rowSequence: {
        sequence: { show: true, source: 'global' },
        toneType: { show: true, source: 'global' },
        target: {
          show: true,
          options: ['a','b','balance'],
          stateKey: 'slTarget_test',
          default: 'balance'
        }
      },
      startStop: { show: true, startKey: 'btnStartTest', resumable: true }
    },
    test: {
      subTitleKey: 'testRunningTitle',
      subHintKey: 'testRunningHint',
      progressBar: true,
      progressFormat: 'rounds',
      swapButton: { show: true, labelKey: 'btnSwapAB' },
      pairDisplay: { mode: 'electrode-vs-electrode', labelLeft: 'A', labelRight: 'B' },
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

  testEls = buildTestPanel(parentEl, testCfg);

  // manA/manB befüllen
  function _fillManSels() {
    if (!testEls.manA || !testEls.manB) return;
    [testEls.manA, testEls.manB].forEach(function(sel, idx) {
      var prev = sel.value;
      sel.innerHTML = '';
      for (var i = 0; i < nEl; i++) {
        var opt = document.createElement('option');
        opt.value = i;
        opt.textContent = dENPrefix() + dEN(i);
        sel.appendChild(opt);
      }
      if (prev && sel.querySelector('option[value="' + prev + '"]')) sel.value = prev;
      else sel.value = idx === 0 ? '0' : String(Math.min(1, nEl - 1));
    });
  }
  _fillManSels();
  window._testFillManSels = _fillManSels;

  // runExplain initial
  updateRunExplain();

  // ---- Event-Listener ----
  testEls.startBtn.addEventListener('click', function() {
    var pt = testEls.runSelect ? testEls.runSelect.value : 'full';
    if (pt === 'manual') {
      playManPair();
    } else {
      startTest();
    }
  });
  testEls.stopBtn.addEventListener('click', function() {
    endTest();
    renderResults();
  });

  if (testEls.runSelect) {
    testEls.runSelect.addEventListener('change', function() {
      if (testEls.manualSel)
        testEls.manualSel.classList.toggle('hidden', this.value !== 'manual');
      updateRunExplain();
    });
  }
  if (testEls.swapBtn) testEls.swapBtn.addEventListener('click', _testSwap);
  if (testEls.replayBtn) testEls.replayBtn.addEventListener('click', playCur);
  if (testEls.undoBtn) testEls.undoBtn.addEventListener('click', undoL);
  if (testEls.manPlayBtn) testEls.manPlayBtn.addEventListener('click', playManPair);

  // Exclude buttons
  if (testEls.excludeLeftBtn) {
    testEls.excludeLeftBtn.addEventListener('click', function() {
      if (!testAct) return;
      _testRequestExcl(curA);
    });
  }
  if (testEls.excludeRightBtn) {
    testEls.excludeRightBtn.addEventListener('click', function() {
      if (!testAct) return;
      _testRequestExcl(curB);
    });
  }

  // Confirm button
  if (testEls.confirmBtn) {
    testEls.confirmBtn.addEventListener('click', function() {
      var pt = testEls.runSelect ? testEls.runSelect.value : '';
      if (pt === 'manual') { recBal(); afterManRes(); } else recBal();
    });
  }

  // Judgment buttons
  var jH = function(r) {
    return function() {
      var pt = testEls.runSelect ? testEls.runSelect.value : '';
      if (pt === 'manual') { recJdg(r); afterManRes(); } else recJdg(r);
    };
  };
  if (testEls.jdgA) testEls.jdgA.addEventListener('click', jH('a'));
  if (testEls.jdgEq) testEls.jdgEq.addEventListener('click', jH('equal'));
  if (testEls.jdgB) testEls.jdgB.addEventListener('click', jH('b'));

  // Extend button
  if (testEls.extendBtn) {
    testEls.extendBtn.addEventListener('click', function() {
      _testExtSlider();
      _testUpdCumulative(_testSliderVal());
    });
  }

  // Slider input
  if (testEls.slider) {
    testEls.slider.addEventListener('input', function() {
      var v = parseFloat(this.value);
      if (testEls.sliderValue) testEls.sliderValue.textContent = v.toFixed(1) + " dB";
      _testUpdCumulative(v);
    });
    testEls.slider.addEventListener('change', function() { this.blur(); });
    testEls.slider.addEventListener('mouseup', function() { this.blur(); });
    testEls.slider.addEventListener('touchend', function() { this.blur(); });
    buildSliderTouchCtrl(testEls.slider, {
      step: 0.5,
      fineStep: 0.1,
      replay: function () { if (typeof playCur === 'function') playCur(); },
      labelReplay: '▶ ' + (t('bReplay') || 'Wiederholen')
    });
  }

  // Simul button
  if (testEls.simulBtn) {
    testEls.simulBtn.addEventListener('click', function() {
      if (!testAct || testIdx >= testPairs.length) return;
      stopAll();
      isPlay = true;
      var tot = curBase + _testSliderVal();
      var vol = gVol();
      var dur = gDur();
      var vA = Math.max(Math.min(vol * (tot < 0 ? dB2G(tot) : 1), 1), 0);
      var vB = Math.max(Math.min(vol * (tot > 0 ? dB2G(-tot) : 1), 1), 0);
      var p1 = playTone(effFreq(curA), vA, dur);
      var p2 = playTone(effFreq(curB), vB, dur);
      if (testEls.pairLeft) testEls.pairLeft.classList.add('playing');
      if (testEls.pairRight) testEls.pairRight.classList.add('playing');
      Promise.all([p1, p2]).then(function() {
        if (testEls.pairLeft) testEls.pairLeft.classList.remove('playing');
        if (testEls.pairRight) testEls.pairRight.classList.remove('playing');
        isPlay = false;
      });
      curPlayed = true;
    });
  }

  // modeSelect → showMode
  if (testEls.modeSelect) {
    testEls.modeSelect.addEventListener('change', function() {
      testMode = this.value;
      showMode();
    });
  }
});

