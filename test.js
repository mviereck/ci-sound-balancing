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
// PRE-CORRECTION for fine-tuning
// ============================================================
function getPreCorrOffset(a, b) {
  // Returns the LS-predicted offset for pair a,b (level[a]-level[b])
  if (!document.getElementById("preCorrect").checked || bRes.length === 0)
    return 0;
  const { levels } = compWLS();
  return levels[a] - levels[b];
}

// ============================================================
// TEST
// ============================================================
function startTest() {
  const pt = document.getElementById("pairType").value;
  testMode = document.getElementById("testMode").value;
  refEl = +document.getElementById("refEl").value;
  if (pt === "manual") return;
  let p;
  if (pt === "full") {
    // Round-Robin: persistentes Fortsetzen
    const s = sideData[activeSide];
    const rrTable = ROUND_ROBIN[nEl];
    const maxRounds = rrTable ? rrTable.length : 0;
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
      // Nur Paare mit aktiven Elektroden
      const actSet = new Set(actEl());
      const available = roundPairs.filter(
        ([a, b]) => actSet.has(a) && actSet.has(b),
      );
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
    document.getElementById("startBtn").disabled = true;
    document.getElementById("stopTBtn").disabled = false;
    document.getElementById("testArea").style.display = "block";
    document.getElementById("exclDlg").classList.add("hidden");
    document.getElementById("roundInfo").classList.remove("hidden");
    updFullSweepInfo();
    updateTabLockState();
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
  document.getElementById("startBtn").disabled = true;
  document.getElementById("stopTBtn").disabled = false;
  document.getElementById("testArea").style.display = "block";
  document.getElementById("exclDlg").classList.add("hidden");
  if (convRnd > 0) {
    const ri = document.getElementById("roundInfo");
    ri.textContent = `${t("round")} ${convRnd} – ${testPairs.length} ${t("comp")}`;
    ri.classList.remove("hidden");
  } else document.getElementById("roundInfo").classList.add("hidden");
  updateTabLockState();
  startTmr();
  showMode();
  showCurPair();
}
function endTest() {
  stopAll();
  testAct = false;
  curPlayed = false;
  document.getElementById("startBtn").disabled = false;
  document.getElementById("stopTBtn").disabled = true;
  document.getElementById("testArea").style.display = "none";
  document.getElementById("exclDlg").classList.add("hidden");
  updateTabLockState();
  stopTmr();
}
function showMode() {
  const j = testMode === "judgment";
  document.getElementById("jdgC").style.display = j ? "" : "none";
  document.getElementById("balC").style.display = j ? "none" : "";
  document.getElementById("swapBtn").style.display = j ? "none" : "";
}
function showCurPair() {
  if (testIdx >= testPairs.length) {
    if (document.getElementById("pairType").value === "full") {
      return nextFullRound();
    }
    if (convRnd > 0) return nextConvRnd();
    endTest();
    switchTab("ergebnisse");
    renderResults();
    return;
  }
  const [a, b] = testPairs[testIdx];
  curA = a;
  curB = b;
  document.getElementById("progLbl").textContent =
    `${t("comp")} ${testIdx + 1} ${t("of")} ${testPairs.length}${convRnd > 0 ? ` (${t("round")} ${convRnd})` : ""}`;
  document.getElementById("tAL").innerHTML =
    `<span class="aba-label">A (Ref)</span>E${dEN(a)}`;
  document.getElementById("tBL").innerHTML =
    `<span class="aba-label">B (Slider)</span>E${dEN(b)}`;
  document.getElementById("pairF").textContent =
    `${Math.round(effFreq(a))} Hz vs. ${Math.round(effFreq(b))} Hz`;
  if (testMode === "balance") {
    // Get existing offset for this pair
    const ex = bRes.find(
      (r) => (r.a === a && r.b === b) || (r.a === b && r.b === a),
    );
    const prevOff = ex ? (ex.a === a ? ex.offset : -ex.offset) : 0;
    // Pre-correction: use LS values to pre-correct the tones
    const preCorr = getPreCorrOffset(a, b);
    // Slider shows real offset: start at preCorr if pre-correction is on, else at prevOff's slider portion
    if (document.getElementById("preCorrect").checked && bRes.length > 0) {
      curBase = preCorr;
      rstSlR();
      document.getElementById("balSl").value = 0;
      document.getElementById("balV").textContent = "0.0 dB";
      // Hint: Abweichung vorheriger Wert vom Schätzwert
      const hintEl = document.getElementById("balAbs");
      if (ex && hintEl) {
        const diff = prevOff - preCorr;
        hintEl.textContent = t("preCorrHint").replace(
          "{v}",
          (diff >= 0 ? "+" : "") + diff.toFixed(1),
        );
        hintEl.style.display = "";
      } else if (hintEl) hintEl.style.display = "none";
    } else {
      curBase = prevOff; // existing offset as base
      rstSlR();
      document.getElementById("balSl").value = 0;
      document.getElementById("balV").textContent = "0.0 dB";
    }
    updBalAbs(0);
  }
  curPlayed = false;
  updUndo();
  playCur();
}
function playCur() {
  if (testIdx >= testPairs.length) return;
  stopAll();
  isPlay = true;
  if (testMode === "balance")
    playSeq(
      curA,
      curB,
      curBase + parseFloat(document.getElementById("balSl").value),
    );
  else playSeq(curA, curB, 0);
  curPlayed = true;
}
function recJdg(r) {
  if (!testAct || testIdx >= testPairs.length || !curPlayed) return;
  const a = curA,
    b = curB,
    ne = { a, b, result: r, timestamp: Date.now() };
  const ei = jRes.findIndex(
    (x) => (x.a === a && x.b === b) || (x.a === b && x.b === a),
  );
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
  const a = curA,
    b = curB,
    tot = curBase + parseFloat(document.getElementById("balSl").value);
  const ne = { a, b, offset: tot, timestamp: Date.now() };
  const ei = bRes.findIndex(
    (x) => (x.a === a && x.b === b) || (x.a === b && x.b === a),
  );
  if (ei >= 0) {
    undoSt.push({ t: "b", a: "r", e: ne, p: { ...bRes[ei] } });
    bRes[ei] = ne;
  } else {
    undoSt.push({ t: "b", a: "a", e: ne });
    bRes.push(ne);
  }
  // Vollständig: gemessenes Paar als erledigt markieren
  if (document.getElementById("pairType").value === "full") {
    const ka = Math.min(a, b),
      kb = Math.max(a, b);
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
  }
  updUndo();
  showCurPair();
}
function updUndo() {
  document.getElementById("undoBtn").disabled = testIdx <= 0 || !undoSt.length;
}
function updFullSweepInfo() {
  const s = sideData[activeSide];
  const rrTable = ROUND_ROBIN[nEl];
  if (!rrTable) return;
  const maxRounds = rrTable.length;
  const totalPairs = (nEl * (nEl - 1)) / 2;
  const pairsPerRound = rrTable[0].length;
  const completedRounds = s.fullSweepRound - 1;
  const doneInRound = s.fullSweepDonePairs.length;
  const N = completedRounds * pairsPerRound + doneInRound;
  const M = pairsPerRound - doneInRound;
  const ri = document.getElementById("roundInfo");
  ri.textContent = `${t("comp")} ${N} ${t("of")} ${totalPairs} (${t("round")} ${s.fullSweepRound} ${t("of")} ${maxRounds}), ${M} ${t("pairsRem")}`;
  ri.classList.remove("hidden");
}
function nextFullRound() {
  const s = sideData[activeSide];
  const rrTable = ROUND_ROBIN[nEl];
  const maxRounds = rrTable ? rrTable.length : 0;
  // Runde abgeschlossen
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
    switchTab("ergebnisse");
    renderResults();
    return;
  }
  // Nächste Runde starten
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
    switchTab("ergebnisse");
    renderResults();
    return;
  }
  convRnd++;
  const sr = [...vr].sort((a, b) => b.residual - a.residual);
  const tp = sr
    .slice(0, Math.max(5, Math.ceil(sr.length * 0.2)))
    .map((r) => [r.a, r.b]);
  const ap = allPairs(),
    ex = shuffle(ap).slice(
      0,
      Math.min(Math.max(3, Math.floor(ap.length * 0.1)), 8),
    );
  const seen = new Set(),
    mg = [];
  [...tp, ...ex].forEach((p) => {
    const k = Math.min(p[0], p[1]) + "-" + Math.max(p[0], p[1]);
    if (!seen.has(k)) {
      seen.add(k);
      mg.push(p);
    }
  });
  testPairs = randAB(shuffle(mg));
  testIdx = 0;
  undoSt = [];
  document.getElementById("roundInfo").textContent =
    `${t("round")} ${convRnd} – ${mg.length} (max res: ${mx.toFixed(1)} dB)`;
  document.getElementById("roundInfo").classList.remove("hidden");
  showCurPair();
}
function showExclDlg() {
  if (!testAct || testIdx >= testPairs.length) return;
  stopAll();
  document.getElementById("exclInfo").textContent =
    `E${dEN(curA)} (${Math.round(effFreq(curA))} Hz) vs. E${dEN(curB)} (${Math.round(effFreq(curB))} Hz)`;
  document.getElementById("exclA").textContent = `E${dEN(curA)} ${t("bExcl")}`;
  document.getElementById("exclB").textContent = `E${dEN(curB)} ${t("bExcl")}`;
  document.getElementById("exclA").onclick = () => doExcl(curA);
  document.getElementById("exclB").onclick = () => doExcl(curB);
  document.getElementById("exclDlg").classList.remove("hidden");
}
function doExcl(i) {
  elExDur[i] = Date.now();
  const rem = testPairs.slice(testIdx).filter(([a, b]) => a !== i && b !== i);
  testPairs = [...testPairs.slice(0, testIdx), ...rem];
  document.getElementById("exclDlg").classList.add("hidden");
  buildFreqTable();
  document.getElementById("roundInfo").textContent =
    `E${dEN(i)} ${t("exclDuring")}. ${testPairs.length - testIdx} ${t("pairsRem")}.`;
  document.getElementById("roundInfo").classList.remove("hidden");
  if (testIdx >= testPairs.length) {
    endTest();
    switchTab("ergebnisse");
    renderResults();
  } else showCurPair();
}
function updBalAbs(sv) {
  const ae = document.getElementById("balAbs"),
    ew = document.getElementById("extWrap");
  if (curBase !== 0) {
    const tot = curBase + sv;
    ae.textContent = `${t("total")}: ${tot >= 0 ? "+" : ""}${tot.toFixed(1)} dB (${t("prev")}: ${curBase >= 0 ? "+" : ""}${curBase.toFixed(1)} dB)`;
    ae.style.display = "";
  } else ae.style.display = "none";
  const s = document.getElementById("balSl");
  ew.style.display =
    !slExt && Math.abs(parseFloat(s.value)) >= parseFloat(s.max) - 0.5
      ? ""
      : "none";
}
function rstSlR() {
  const s = document.getElementById("balSl");
  slExt = false;
  s.min = "-20";
  s.max = "20";
  s.step = "0.1";
  document.getElementById("extWrap").style.display = "none";
}
function extSlR() {
  document.getElementById("balSl").min = "-40";
  document.getElementById("balSl").max = "40";
  slExt = true;
  document.getElementById("extWrap").style.display = "none";
}
function startTmr() {
  tStart = Date.now();
  tInt = setInterval(updTmr, 1000);
  updTmr();
}
function stopTmr() {
  if (tInt) {
    clearInterval(tInt);
    tInt = null;
  }
}
function updTmr() {
  const e = Math.floor((Date.now() - tStart) / 1000);
  document.getElementById("timerD").textContent =
    `${Math.floor(e / 60)}:${String(e % 60).padStart(2, "0")}`;
}
function playManPair() {
  const a = parseInt(document.getElementById("manA").value),
    b = parseInt(document.getElementById("manB").value);
  if (a === b) return;
  const [pa, pb] = Math.random() < 0.5 ? [a, b] : [b, a];
  testAct = true;
  testPairs = [[pa, pb]];
  testIdx = 0;
  undoSt = [];
  testMode = document.getElementById("testMode").value;
  convRnd = 0;
  document.getElementById("testArea").style.display = "block";
  document.getElementById("stopTBtn").disabled = false;
  document.getElementById("roundInfo").classList.add("hidden");
  showMode();
  document.getElementById("progLbl").textContent = t("manComp");
  curA = pa;
  curB = pb;
  document.getElementById("tAL").innerHTML =
    `<span class="aba-label">A</span>E${dEN(pa)}`;
  document.getElementById("tBL").innerHTML =
    `<span class="aba-label">B</span>E${dEN(pb)}`;
  document.getElementById("pairF").textContent =
    `${Math.round(effFreq(pa))} Hz vs. ${Math.round(effFreq(pb))} Hz`;
  if (testMode === "balance") {
    const ex = bRes.find(
      (r) => (r.a === pa && r.b === pb) || (r.a === pb && r.b === pa),
    );
    curBase = ex ? (ex.a === pa ? ex.offset : -ex.offset) : 0;
    rstSlR();
    document.getElementById("balSl").value = 0;
    document.getElementById("balV").textContent = "0.0 dB";
    updBalAbs(0);
  }
  curPlayed = false;
  startTmr();
  playCur();
}
function afterManRes() {
  stopTmr();
  document.getElementById("testArea").style.display = "none";
  testAct = false;
  curPlayed = false;
  updateTabLockState();
  renderResults();
}

