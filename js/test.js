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
// LS-Hint Parameter (Bauanleitung 61)
const LS_HINT_BASIS_DB = 2.5;
const LS_HINT_K = 3;

function _testSliderVal() {
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  return (vref && vref.slider && vref.slider.input)
    ? parseFloat(vref.slider.input.value) : 0;
}

// ---- Ausschluss-Helfer ----
// BA 247: Exclude-Modal entfaellt; Bestaetigung erfolgt im
// Implantat-Reiter. Aktuell wird `_testRequestExcl` nach BA 247 nicht
// mehr aufgerufen — die alten Listener excludeLeftBtn/excludeRightBtn
// sind im neuen DOMContentLoaded weg. Funktion bleibt vorerst als
// Stub, weil sie in BA 248 mit dem Aufraeumen entfernt wird.
function _testRequestExcl(elIdx) {
  if (!testEls) return;
  stopAll();
  doExcl(elIdx);
}

// ---- Swap-Helfer ----
function _testSwap() {
  if (!testAct || testIdx >= testPairs.length || !testEls) return;
  stopAll();
  var oldVal = _testSliderVal();
  var swapped = [curB, curA];
  curA = swapped[0]; curB = swapped[1];
  testPairs[testIdx] = [curA, curB];
  var newVal = -oldVal;
  var vref = testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.slider) {
    testUI.slider.setValue(vref.slider, newVal);
    testUI.slider.setValueDisplay(vref.slider, newVal.toFixed(1) + " dB");
  }
  if (vref && vref.pairIndicator) {
    // BA 247fix2: korrekte Property-Namen der testUI-setLabels-API.
    testUI.pairIndicator.setLabels(vref.pairIndicator, {
      leftText:  dENPrefix() + dEN(curA),
      rightText: dENPrefix() + dEN(curB),
      leftHz:    Math.round(effFreq(curA)),
      rightHz:   Math.round(effFreq(curB))
    });
  }
  _testUpdateRangeHint();
}

// BA 247: Round-Robin-Start (frueher 'full' in startTest)
function startTestFull() {
  if (!testEls) return;
  testMode = "balance";
  var s = sideData[activeSide];
  var rrTable = ROUND_ROBIN[nEl];
  var p;
  if (!rrTable) {
    p = allPairs();
  } else {
    if (s.fullSweepRound === null) {
      s.fullSweepRound = 1;
      s.fullSweepDonePairs = [];
    }
    fullSweepRound = s.fullSweepRound;
    fullSweepDonePairs = s.fullSweepDonePairs;
    var roundPairs = rrTable[fullSweepRound - 1];
    var actSet = new Set(actEl());
    var available = roundPairs.filter(function(p) {
      return actSet.has(p[0]) && actSet.has(p[1]);
    });
    var doneSet = new Set(fullSweepDonePairs.map(function(p) {
      return p[0] + "-" + p[1];
    }));
    p = available.filter(function(p) {
      return !doneSet.has(p[0] + "-" + p[1]);
    });
  }
  // BA 247: Elektroden-Auswahl im Header filtert die Sequenz.
  p = _testFilterByElectrodeSelection(p);
  testPairs = randAB(shuffle(p));
  testIdx = 0;
  undoSt = [];
  testAct = true;
  curPlayed = false;
  compCnt = 0;
  convRnd = 0;
  tStart = Date.now();
  lockTestTabs(true, 'test');
  startTmr();
  showCurPair();
}

// BA 247: Konvergenz-Start (frueher 'conv_fast' in startTest)
function startTestConv() {
  if (!testEls) return;
  testMode = "balance";
  var p = getConvPairs(true);
  p = _testFilterByElectrodeSelection(p);
  testPairs = randAB(shuffle(p));
  testIdx = 0;
  undoSt = [];
  testAct = true;
  curPlayed = false;
  compCnt = 0;
  convRnd = 1;
  tStart = Date.now();
  lockTestTabs(true, 'test');
  startTmr();
  showCurPair();
}

// BA 247: Sequenz auf die im Header gewaehlten Elektroden filtern.
// BA 247fix: UND-Logik statt ODER. Es werden nur Paare gespielt,
// in denen BEIDE Elektroden in der Auswahl stehen. Konsequenz: ein
// Paarvergleich braucht mindestens zwei ausgewaehlte Elektroden
// (vgl. minSelected: 2 im electrodeSelection-Block).
function _testFilterByElectrodeSelection(pairs) {
  var sel = _testSelectedEls;
  if (!sel || !sel.length) return pairs;
  var s = new Set(sel);
  return pairs.filter(function(p) {
    return s.has(p[0]) && s.has(p[1]);
  });
}
function endTest() {
  stopAll();
  testAct = false;
  curPlayed = false;
  lockTestTabs(false, null);
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  stopTmr();
}
function showCurPair() {
  if (!testEls) return;
  if (testIdx >= testPairs.length) {
    if (convRnd === 0) return nextFullRound();
    if (convRnd > 0)  return nextConvRnd();
    endTest();
    renderResults();
    return;
  }
  var pair = testPairs[testIdx];
  curA = pair[0];
  curB = pair[1];

  _testUpdateProgress();

  var vref = testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.pairIndicator) {
    // BA 247fix2: korrekte Property-Namen der testUI-setLabels-API.
    testUI.pairIndicator.setLabels(vref.pairIndicator, {
      leftText:  dENPrefix() + dEN(curA),
      rightText: dENPrefix() + dEN(curB),
      leftHz:    Math.round(effFreq(curA)),
      rightHz:   Math.round(effFreq(curB))
    });
  }

  // BA 247: curBase ist immer 0. Slider sitzt auf dem gespeicherten
  // Wert (falls vorhanden), sonst 0 dB.
  curBase = 0;
  var ex = bRes.find(function(r) {
    return (r.a === curA && r.b === curB) || (r.a === curB && r.b === curA);
  });
  var startVal = 0;
  if (ex) startVal = (ex.a === curA) ? ex.offset : -ex.offset;
  if (vref && vref.slider) {
    testUI.slider.setValue(vref.slider, startVal);
    testUI.slider.setValueDisplay(vref.slider, startVal.toFixed(1) + " dB");
  }

  _testUpdateRangeHint();

  curPlayed = false;
  updUndo();
  playCur();
}

// BA 247: Helfer fuer showCurPair, ehemals inline.
let _testActiveVerfahren = "full";

function _testUpdateProgress() {
  var vref = testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (!vref || !vref.progress) return;
  if (_testActiveVerfahren === "full") {
    var s = sideData[activeSide];
    var rrTable = ROUND_ROBIN[nEl];
    if (rrTable) {
      var maxRounds = rrTable.length;
      var pairsPerRound = rrTable[0].length;
      var completedRounds = (s.fullSweepRound || 1) - 1;
      var totalPairs = maxRounds * pairsPerRound;
      var n = completedRounds * pairsPerRound + testIdx + 1;
      // BA 247fix2: progress.set erwartet ein opts-Objekt, kein String.
      testUI.progress.set(vref.progress, {
        text: t("comp") + " " + n + " " + t("of") + " " + totalPairs +
              ". " + t("round") + " " + (s.fullSweepRound || 1) + " " + t("of") + " " + maxRounds,
        fraction: n / totalPairs
      });
    }
  } else {
    testUI.progress.set(vref.progress, {
      text: t("comp") + " " + (testIdx + 1) + " " + t("of") + " " + testPairs.length +
            (convRnd > 0 ? " (" + t("round") + " " + convRnd + ")" : ""),
      fraction: (testIdx + 1) / Math.max(1, testPairs.length)
    });
  }
}

function _testUpdateRangeHint() {
  var vref = testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (!vref || !vref.slider) return;
  if (!testAct || testIdx >= testPairs.length) {
    testUI.slider.setRangeHint(vref.slider, null);
    return;
  }
  var est = getLsEstimate(curA, curB);
  if (!est.hasData) {
    testUI.slider.setRangeHint(vref.slider, null);
    return;
  }
  testUI.slider.setRangeHint(vref.slider, {
    marker: est.estimate,
    label:  (est.estimate >= 0 ? "+" : "") + est.estimate.toFixed(1) + " dB",
    min:    est.estimate - est.halfWidth,
    max:    est.estimate + est.halfWidth
  });
}
function playCur() {
  if (testIdx >= testPairs.length) return;
  stopAll();
  isPlay = true;
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  // BA 247fix2: setPlaying('both') setzt die Replay-Sperre (lock_targets:
  // confirm, swap). Das Aufleuchten der einzelnen Box (left|right) macht
  // updInd in playSeq weiter. Am Ende der Sequenz wird die Sperre via
  // setPlaying(null) wieder aufgehoben.
  if (vref && vref.pairIndicator) {
    testUI.pairIndicator.setPlaying(vref.pairIndicator, 'both');
  }
  curPlayed = true;
  playSeq(curA, curB, _testSliderVal()).then(function() {
    if (vref && vref.pairIndicator) {
      testUI.pairIndicator.setPlaying(vref.pairIndicator, null);
    }
  });
}
function recBal() {
  if (!testAct || testIdx >= testPairs.length) return;
  // BA 247: curBase ist immer 0.
  const a = curA, b = curB, tot = _testSliderVal();
  const ne = { a, b, offset: tot, timestamp: Date.now() };
  const ei = bRes.findIndex((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  if (ei >= 0) {
    undoSt.push({ t: "b", a: "r", e: ne, p: { ...bRes[ei] } });
    bRes[ei] = ne;
  } else {
    undoSt.push({ t: "b", a: "a", e: ne });
    bRes.push(ne);
  }
  // BA 247: Vollstaendig: gemessenes Paar als erledigt markieren.
  if (_testActiveVerfahren === "full") {
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
  // BA 247: nur noch der b-Pfad (balance); j-Pfad entfaellt mit judgment.
  if (u.a === "a") {
    const i = bRes.findIndex(function(x) { return x.timestamp === u.e.timestamp; });
    if (i >= 0) bRes.splice(i, 1);
  } else {
    const i = bRes.findIndex(function(x) { return x.a === u.e.a && x.b === u.e.b; });
    if (i >= 0) bRes[i] = u.p;
  }
  // Bug-Fix §6.9: Bei full-Verfahren auch aus fullSweepDonePairs entfernen.
  if (_testActiveVerfahren === "full") {
    const ka = Math.min(u.e.a, u.e.b);
    const kb = Math.max(u.e.a, u.e.b);
    const s = sideData[activeSide];
    const idx = s.fullSweepDonePairs.findIndex(function(p) { return p[0] === ka && p[1] === kb; });
    if (idx >= 0) s.fullSweepDonePairs.splice(idx, 1);
    fullSweepDonePairs = s.fullSweepDonePairs;
  }
  updUndo();
  showCurPair();
}
function updUndo() {
  // BA 247fix2: Undo-Button liegt in der neuen API unter
  // testEls.verfahren[<id>].actions.undo, nicht direkt auf testEls.
  if (!testEls || !testEls.verfahren) return;
  var vref = testEls.verfahren[_testActiveVerfahren];
  var btn = vref && vref.actions && vref.actions.undo;
  if (btn) btn.disabled = testIdx <= 0 || !undoSt.length;
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
  // BA 247fix: Elektroden-Auswahl im Header gilt auch ab der zweiten
  // Runde, nicht nur beim Start (startTestFull).
  const filtered = _testFilterByElectrodeSelection(roundPairs);
  testPairs = randAB(shuffle(filtered));
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
  // BA 247fix2: progress.set erwartet ein opts-Objekt.
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.progress) {
    testUI.progress.set(vref.progress, {
      text: t("round") + " " + convRnd + " – " + mg.length + " (max res: " + mx.toFixed(1) + " dB)",
      fraction: 0
    });
  }
  showCurPair();
}
function doExcl(i) {
  elExDur[i] = Date.now();
  const rem = testPairs.slice(testIdx).filter(function(p) { return p[0] !== i && p[1] !== i; });
  testPairs = [].concat(testPairs.slice(0, testIdx), rem);
  buildFreqTable();
  // BA 247fix2: progress.set erwartet ein opts-Objekt.
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.progress) {
    testUI.progress.set(vref.progress, {
      text: dENPrefix() + dEN(i) + " " + t("exclDuring") + ". " +
            (testPairs.length - testIdx) + " " + t("pairsRem") + "."
    });
  }
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
  // BA 247: testUI bietet keinen separaten timerDisplay; reiner Timer-Tick
  // wird nicht mehr gerendert. Hauptprogress kommt aus _testUpdateProgress
  // nach Trial-Aktionen.
}

// ============================================================
// BA 247: DOMContentLoaded — buildTestPanel (neue testUI-API)
// ============================================================
// BA 247fix: null = "alle testable ausgewaehlt" (Konvention aus
// test-ui.js Z. 2270 und aus lr-balance). Leeres Array waere im
// Modal als "keine ausgewaehlt" interpretiert.
let _testSelectedEls = null;

document.addEventListener("DOMContentLoaded", function() {
  var parentEl = document.getElementById("subpanel-messungen-test");
  if (!parentEl) return;

  // Gemeinsamer Body fuer beide Verfahren (Round Robin und Konvergenz
  // unterscheiden sich nur im Start-/Sequenz-Aufbau, nicht in der UI).
  function _testBody() {
    return {
      pairIndicator:  { variant: 'electrode' },
      progress:       { format: 'rounds' },
      keyHint:        { unitKey: 'sliderHintDb' },
      slider:         {
        unit: 'dB',
        initialRange: 20,
        maxRange: 60,
        rangeHint: true,
        touchStep: 0.5,
        touchFineStep: 0.1
      },
      sliderValue:    { show: true },
      confirmButton:  { key: 'btnConfirmOffset' },
      actions:        [
        'undo',
        'replay',
        'simul',
        { kind: 'swap', labelKey: 'btnSwapAB' }
      ],
      statusGrid:     { show: true }
    };
  }

  function _testHooksCommon() {
    return {
      onStop:    function() { endTest(); renderResults(); },
      onConfirm: function() { recBal(); },
      onReplay:  function() { playCur(); },
      onUndo:    function() { undoL(); },
      onSimul:   function() { _testPlaySimul(); },
      onSwap:    function() { _testSwap(); }
    };
  }

  var cfg = {
    id: 'test',
    explain: {
      titleKey: 'testExplainTitle',
      paragraphs: [
        { key: 'testMaturityHint', kind: 'ok'    },
        { key: 'testIntro',        kind: 'plain' }
      ]
    },
    header: {
      common: {
        refSelect: false,
        volume:    { show: true },
        duration:  { show: true },
        pause:     { show: true },
        toneType:  false,
        tonePopupButton: {
          getToneType: function()   { return toneType_test; },
          setToneType: function(tt) { toneType_test = tt; },
          getVolume:   function()   { return gVol(); },
          getPreviewSequence: function() {
            var hz = 1000;
            var dur = gDur();
            var pau = gPau();
            return [
              { hz: hz, durationMs: dur },
              { pauseMs: pau },
              { hz: hz, durationMs: dur }
            ];
          }
        },
        sequence:     { show: true, source: 'global' },
        sliderTarget: {
          options:  ['a','b','balance'],
          stateKey: 'slTarget_test',
          default:  'balance'
        },
        electrodeSelection: {
          // BA 247fix: zwei Elektroden noetig, sonst kein Paar.
          minSelected: 2,
          getSelection:    function()    { return _testSelectedEls ? _testSelectedEls.slice() : null; },
          setSelection:    function(sel) { _testSelectedEls = sel.slice(); },
          getElectrodeStatus: function() {
            // BA 247: Filter NUR auf aktive Seite.
            var testable = [], muted = [], excluded = [];
            for (var i = 0; i < nEl; i++) {
              if (elExDur[i] !== null)  excluded.push(i);
              else if (elSt[i] === 'mute') muted.push(i);
              else                          testable.push(i);
            }
            return { testable: testable, muted: muted, excluded: excluded };
          },
          electrodeLabel: function(i) {
            return dENPrefix() + dEN(i) + " (" + Math.round(effFreq(i)) + " Hz)";
          }
        }
      },
      startStop: { startKey: 'btnStartTest', stopKey: 'btnPauseTest', resumable: true }
    },
    verfahren: [
      {
        id: 'full',
        labelKey:   'testVerfahrenFull',
        explainKey: null,
        body: _testBody(),
        hooks: Object.assign({
          onStart: function() {
            _testActiveVerfahren = 'full';
            startTestFull();
          }
        }, _testHooksCommon())
      },
      {
        id: 'conv',
        labelKey:   'testVerfahrenConv',
        explainKey: null,
        body: _testBody(),
        hooks: Object.assign({
          onStart: function() {
            _testActiveVerfahren = 'conv';
            startTestConv();
          }
        }, _testHooksCommon())
      }
    ]
  };

  testEls = buildTestPanel(parentEl, cfg);
});

// BA 247: "beide Toene gleichzeitig" (frueher inline am Simul-Button).
function _testPlaySimul() {
  if (!testAct || testIdx >= testPairs.length) return;
  stopAll();
  isPlay = true;
  var tot = _testSliderVal();
  var vol = gVol();
  var dur = gDur();
  var vA = Math.max(Math.min(vol * (tot < 0 ? dB2G(tot)  : 1), 1), 0);
  var vB = Math.max(Math.min(vol * (tot > 0 ? dB2G(-tot) : 1), 1), 0);
  var p1 = playTone(effFreq(curA), vA, dur);
  var p2 = playTone(effFreq(curB), vB, dur);
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.pairIndicator) testUI.pairIndicator.setPlaying(vref.pairIndicator, 'both');
  Promise.all([p1, p2]).then(function() {
    if (vref && vref.pairIndicator) testUI.pairIndicator.setPlaying(vref.pairIndicator, null);
    isPlay = false;
  });
  curPlayed = true;
}

