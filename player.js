// ============================================================
// PLAYER
// ============================================================
let pCtx = null,
  pBuf = null,
  pSourceBuf = null,
  pMonoBuf = null,
  pLeftOnlyBuf = null,
  pRightOnlyBuf = null,
  pSrc = null,
  pCurrentPlayback = null,   // { sources, stop() } für Variante B/A
  pPlayGen = 0,              // erhöht sich bei jedem pPlay/pPause; schützt den Vocoder-Await
  pGain = null,
  pEqF = [],
  pEqFLeft = [],
  pEqFRight = [],
  pChannelSplitter = null,
  pChannelMerger = null,
  pChannelLeftGain = null,
  pChannelRightGain = null,
  pMaplawOn = false,
  pMaplawSollC = 1000,
  pMaplawNode = null,
  pPlaying = false,
  pOff = 0,
  pT0 = 0;

function gPC() {
  if (!pCtx) pCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (pCtx.state === "suspended") pCtx.resume();
  return pCtx;
}

function createLeftOnlyBuffer(buf) {
  const c = gPC();
  const m = c.createBuffer(2, buf.length, buf.sampleRate);
  const leftData = m.getChannelData(0);
  const rightData = m.getChannelData(1);
  const srcLeft = buf.numberOfChannels > 0 ? buf.getChannelData(0) : null;
  for (let s = 0; s < buf.length; s++) {
    leftData[s] = srcLeft ? srcLeft[s] : 0;
    rightData[s] = 0;
  }
  return m;
}

function createRightOnlyBuffer(buf) {
  const c = gPC();
  const m = c.createBuffer(2, buf.length, buf.sampleRate);
  const leftData = m.getChannelData(0);
  const rightData = m.getChannelData(1);
  const srcRight =
    buf.numberOfChannels > 1
      ? buf.getChannelData(1)
      : buf.numberOfChannels > 0
        ? buf.getChannelData(0)
        : null;
  for (let s = 0; s < buf.length; s++) {
    leftData[s] = 0;
    rightData[s] = srcRight ? srcRight[s] : 0;
  }
  return m;
}

function createMonoBuffer(buf) {
  const c = gPC();
  const m = c.createBuffer(2, buf.length, buf.sampleRate);
  const leftData = m.getChannelData(0);
  const rightData = m.getChannelData(1);
  for (let s = 0; s < buf.length; s++) {
    let sum = 0;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      sum += buf.getChannelData(ch)[s];
    }
    const val = sum / buf.numberOfChannels;
    leftData[s] = val;
    rightData[s] = val;
  }
  return m;
}

// Baut den abzuspielenden Stereo-Buffer aus pWarpedBuf gemäß Player-Side.
// - "left":  linker Kanal aus pWarpedBuf, rechter stumm
// - "right": rechter Kanal aus pWarpedBuf, linker stumm
// - "both":  betroffene Seite aus pWarpedBuf, andere Seite aus pSourceBuf
// - "mono":  wie "both", aber Downmix
function _buildWarpedPlaybackBuffer(mode) {
  const c = gPC();
  const len = pWarpedBuf.length;
  const sr = pWarpedBuf.sampleRate;
  const out = c.createBuffer(2, len, sr);
  const outL = out.getChannelData(0);
  const outR = out.getChannelData(1);
  const warpL = pWarpedBuf.getChannelData(0);
  const warpR = pWarpedBuf.numberOfChannels > 1
    ? pWarpedBuf.getChannelData(1)
    : pWarpedBuf.getChannelData(0);

  if (mode === "left") {
    outL.set(warpL);
    // outR bleibt 0
    return out;
  }
  if (mode === "right") {
    outR.set(warpR);
    // outL bleibt 0
    return out;
  }

  // mode "both" oder "mono"
  const affected = typeof pWarpAffected !== "undefined"
    ? pWarpAffected
    : { warpsLeft: true, warpsRight: true };

  const srcL = pSourceBuf.getChannelData(0);
  const srcR = pSourceBuf.numberOfChannels > 1
    ? pSourceBuf.getChannelData(1)
    : srcL;
  const srcLen = pSourceBuf.length;
  const copyLen = Math.min(len, srcLen);

  if (affected.warpsLeft)  outL.set(warpL.subarray(0, len));
  else                     outL.set(srcL.subarray(0, copyLen));

  if (affected.warpsRight) outR.set(warpR.subarray(0, len));
  else                     outR.set(srcR.subarray(0, copyLen));

  if (mode === "mono") {
    for (let i = 0; i < len; i++) {
      const v = (outL[i] + outR[i]) * 0.5;
      outL[i] = v;
      outR[i] = v;
    }
  }
  return out;
}

function getPlaybackBuffer() {
  const mode = getPlayerSide();
  if (!pSourceBuf) return null;

  const _warpMethodEl = document.getElementById("plWarpMethod");
  const _warpMethod = _warpMethodEl ? _warpMethodEl.value : "offline";
  // EQ-Toggle wirkt als Master: wenn EQ aus, ist auch der Warp-Pfad bypass.
  const warpReady = typeof pWarpOn !== "undefined"
                  && pWarpOn && plEqOn && pWarpedBuf && !pWarpBusy
                  && _warpMethod === "offline";

  if (warpReady) {
    return _buildWarpedPlaybackBuffer(mode);
  }

  switch (mode) {
    case "left":
      if (!pLeftOnlyBuf) pLeftOnlyBuf = createLeftOnlyBuffer(pSourceBuf);
      return pLeftOnlyBuf;
    case "right":
      if (!pRightOnlyBuf) pRightOnlyBuf = createRightOnlyBuffer(pSourceBuf);
      return pRightOnlyBuf;
    case "both":
    case "mono":
      if (pSourceBuf.numberOfChannels > 1) return pSourceBuf;
      if (!pMonoBuf) pMonoBuf = createMonoBuffer(pSourceBuf);
      return pMonoBuf;
    default:
      if (!pMonoBuf) pMonoBuf = createMonoBuffer(pSourceBuf);
      return pMonoBuf;
  }
}

function computeGains() {
  const { levels } = compWLS();
  const presetCurve = getTotalPresetCurve();
  const g = new Array(nEl).fill(0);
  for (let i = 0; i < nEl; i++) {
    const hd = bRes.some(
      (r) =>
        (r.a === i || r.b === i) &&
        elSt[r.a] !== "excluded" &&
        elSt[r.a] !== "mute" &&
        elSt[r.b] !== "excluded" &&
        elSt[r.b] !== "mute",
    );
    const addMeas = plSrcMeas && hd ? levels[i] : 0;
    const addLvls = plSrcLevels ? -manualLevels[i] : 0;
    const addCurves = plSrcCurves ? -presetCurve[i] : 0;
    g[i] = addMeas + addLvls + addCurves;
  }
  return g;
}

function getPlayerGains() {
  const mode = getPlayerSide();
  if (mode === "left") return withSide("left", computeGains);
  if (mode === "right") return withSide("right", computeGains);
  if (mode === "mono") return withSide(activeSide, computeGains);
  return {
    left: withSide("left", computeGains),
    right: withSide("right", computeGains),
  };
}

function documentHasStereoAudio() {
  return pSourceBuf && pSourceBuf.numberOfChannels > 1;
}

document
  .getElementById("plAudio")
  .addEventListener("change", async function (e) {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const c = gPC();
      const buf = await f.arrayBuffer();
      pSourceBuf = await c.decodeAudioData(buf);
      pMonoBuf = null;
      pLeftOnlyBuf = null;
      pRightOnlyBuf = null;
      // Warp-Buffer invalidieren – neue Datei erfordert neue Vorberechnung
      if (typeof pWarpedBuf !== "undefined") {
        pWarpedBuf = null;
        if (typeof pWarpUpdUI === "function") pWarpUpdUI();
      }
      pBuf = getPlaybackBuffer();
      document.getElementById("plTot").textContent = pFmt(pBuf.duration);
      document.getElementById("plCur").textContent = "0:00";
      document.getElementById("plTL").value = 0;
      document.getElementById("plCtrl").style.display = "";
      pBuildEQ();
      pDrawEQ();
      pBuildTbl();
      document.getElementById("plEqViz").style.display = "";
      // Warp neu berechnen wenn aktiv
      if (typeof pWarpOn !== "undefined" && pWarpOn) {
        pWarpTrigger();
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  });

function updatePlayerForSideChange() {
  if (pSourceBuf) {
    const wasPlaying = pPlaying;
    if (wasPlaying) pPause();
    pMonoBuf = null;
    pLeftOnlyBuf = null;
    pRightOnlyBuf = null;
    pBuf = getPlaybackBuffer();
    pBuildEQ();
    pDrawEQ();
    pBuildTbl();
    if (wasPlaying) pPlay();
  }
  plCheck();
}

function pCompQ(i) {
  const ef = effFreq(i),
    ef0 = effFreq(0),
    ef1 = effFreq(Math.min(1, nEl - 1)),
    efN = effFreq(nEl - 1),
    efNm1 = effFreq(Math.max(0, nEl - 2));
  let fL, fH;
  if (i === 0) {
    fL = (ef0 * ef0) / (ef1 || ef0);
    fH = ef1 || ef0;
  } else if (i === nEl - 1) {
    fL = efNm1;
    fH = (ef * ef) / efNm1;
  } else {
    fL = effFreq(i - 1);
    fH = effFreq(i + 1);
  }
  const bw = Math.log2(Math.sqrt(ef * fH)) - Math.log2(Math.sqrt(fL * ef));
  return ef / (ef * (Math.pow(2, bw / 2) - Math.pow(2, -bw / 2)));
}

function pBuildEQ() {
  const c = gPC();
  pEqF.forEach((f) => f.disconnect());
  pEqF = [];
  pEqFLeft.forEach((f) => f.disconnect());
  pEqFLeft = [];
  pEqFRight.forEach((f) => f.disconnect());
  pEqFRight = [];
  pChannelSplitter && pChannelSplitter.disconnect();
  pChannelSplitter = null;
  pChannelMerger && pChannelMerger.disconnect();
  pChannelMerger = null;
  pChannelLeftGain && pChannelLeftGain.disconnect();
  pChannelLeftGain = null;
  pChannelRightGain && pChannelRightGain.disconnect();
  pChannelRightGain = null;
  if (!pGain) {
    pGain = c.createGain();
    pGain.gain.value = parseInt(document.getElementById("plVol").value) / 100;
    pGain.connect(c.destination);
  }
  const mode = getPlayerSide();
  const str = parseInt(document.getElementById("plStr").value) / 100;
  const nhSim = document.getElementById("plNHSim").checked;
  if (mode === "both" && pSourceBuf && pSourceBuf.numberOfChannels > 1) {
    const leftGains = withSide("left", computeGains);
    const rightGains = withSide("right", computeGains);
    pChannelSplitter = c.createChannelSplitter(2);
    pChannelMerger = c.createChannelMerger(2);
    for (let i = 0; i < nEl; i++) {
      const lf = c.createBiquadFilter();
      lf.type = "peaking";
      lf.frequency.value = effFreq(i);
      lf.Q.value = pCompQ(i);
      lf.gain.value = 0;
      if (plEqOn) {
        lf.gain.value = nhSim ? leftGains[i] * str : -leftGains[i] * str;
      }
      pEqFLeft.push(lf);
      const rf = c.createBiquadFilter();
      rf.type = "peaking";
      rf.frequency.value = effFreq(i);
      rf.Q.value = pCompQ(i);
      rf.gain.value = 0;
      if (plEqOn) {
        rf.gain.value = nhSim ? rightGains[i] * str : -rightGains[i] * str;
      }
      pEqFRight.push(rf);
    }
    for (let i = 0; i < pEqFLeft.length - 1; i++) {
      pEqFLeft[i].connect(pEqFLeft[i + 1]);
      pEqFRight[i].connect(pEqFRight[i + 1]);
    }
    pChannelSplitter.connect(pEqFLeft[0], 0);
    pChannelSplitter.connect(pEqFRight[0], 1);
    pChannelLeftGain = c.createGain();
    pChannelRightGain = c.createGain();
    const balance = getPlayerBalance();
    pChannelLeftGain.gain.value = dB2G(balance);
    pChannelRightGain.gain.value = dB2G(-balance);
    pEqFLeft[pEqFLeft.length - 1].connect(pChannelLeftGain);
    pEqFRight[pEqFRight.length - 1].connect(pChannelRightGain);
    pChannelLeftGain.connect(pChannelMerger, 0, 0);
    pChannelRightGain.connect(pChannelMerger, 0, 1);
    pEqF.push(pChannelMerger);
  } else {
    const gains =
      mode === "left" || mode === "right"
        ? withSide(mode, computeGains)
        : mode === "mono"
          ? withSide(activeSide, computeGains)
          : withSide("left", computeGains);
    for (let i = 0; i < nEl; i++) {
      const f = c.createBiquadFilter();
      f.type = "peaking";
      f.frequency.value = effFreq(i);
      f.Q.value = pCompQ(i);
      f.gain.value = 0;
      if (plEqOn) {
        f.gain.value = nhSim ? gains[i] * str : -gains[i] * str;
      }
      pEqF.push(f);
    }
    for (let i = 0; i < pEqF.length - 1; i++) pEqF[i].connect(pEqF[i + 1]);
  }
}

function pUpdEQ() {
  const gains = getPlayerGains();
  const str = parseInt(document.getElementById("plStr").value) / 100;
  const nhSim = document.getElementById("plNHSim").checked;
  if (typeof gains.left !== "undefined") {
    for (let i = 0; i < pEqFLeft.length; i++) {
      pEqFLeft[i].gain.value = plEqOn
        ? nhSim
          ? gains.left[i] * str
          : -gains.left[i] * str
        : 0;
    }
    for (let i = 0; i < pEqFRight.length; i++) {
      pEqFRight[i].gain.value = plEqOn
        ? nhSim
          ? gains.right[i] * str
          : -gains.right[i] * str
        : 0;
    }
    if (pChannelLeftGain)
      pChannelLeftGain.gain.value = dB2G(getPlayerBalance());
    if (pChannelRightGain)
      pChannelRightGain.gain.value = dB2G(-getPlayerBalance());
  } else {
    for (let i = 0; i < pEqF.length; i++) {
      const g = gains[i] || 0;
      if (plEqOn) {
        pEqF[i].gain.value = nhSim ? g * str : -g * str;
      } else {
        pEqF[i].gain.value = 0;
      }
    }
  }
  pDrawEQ();
  pBuildTbl();
}

function pToggle() {
  if (!pBuf) return;
  if (pCtx.state === "suspended") pCtx.resume();
  if (pPlaying) pPause();
  else pPlay();
}

async function pPlay() {
  const gen = ++pPlayGen;

  if (pSrc) {
    try { pSrc.stop(); } catch (e) {}
    pSrc = null;
  }
  if (pCurrentPlayback) {
    pCurrentPlayback.stop();
    pCurrentPlayback = null;
  }

  const c = gPC();
  pBuf = getPlaybackBuffer();

  const mode = getPlayerSide();
  const stereoMode =
    mode === "both" &&
    pSourceBuf &&
    pSourceBuf.numberOfChannels > 1 &&
    pChannelSplitter;
  const firstNode = stereoMode
    ? pChannelSplitter
    : pEqF.length > 0
      ? pEqF[0]
      : pGain;
  const lastEq = stereoMode
    ? pChannelMerger
    : pEqF.length > 0
      ? pEqF[pEqF.length - 1]
      : null;
  // MAPLAW: zwischen letztem EQ-Knoten und pGain einhängen, wenn aktiv, EQ an und MED-EL.
  // EQ-Toggle wirkt als Master-Bypass (analog Frequenz-Warping).
  const mapApplies = pMaplawOn && plEqOn && pMaplawIsApplicable();
  if (mapApplies) {
    await pInitMaplawWorklet(c);
    if (gen !== pPlayGen) {
      return;
    }
    pMaplawNode = pBuildMaplawNode(c, {
      istC: pMaplawGetIstC(),
      sollC: pMaplawSollC,
      active: true,
    });
    if (lastEq) lastEq.connect(pMaplawNode);
    pMaplawNode.connect(pGain);
  } else {
    if (lastEq) lastEq.connect(pGain);
    pMaplawNode = null;
  }

  const methodSel = document.getElementById("plWarpMethod");
  const method = methodSel ? methodSel.value : "offline";

  let leadSrc = null;

  // EQ-Toggle ist Master: Warp-Pfade nur, wenn EQ an. Warp-Checkbox-Zustand
  // bleibt als User-Intent erhalten und greift wieder, sobald EQ wieder an.
  if (pWarpOn && plEqOn && method === "bandshift" && fRes && fRes.length > 0 && pSourceBuf) {
    // Variante B: Live Bandweise Pitch-Shift
    pBuf = pSourceBuf;
    const pb = pBuildWarpedGraph(
      c, pSourceBuf, firstNode, pWarpMode, pWarpStrength, fRes, 0, pOff
    );
    pCurrentPlayback = pb;
    leadSrc = pb.sources[0] || null;

  } else if (pWarpOn && plEqOn && (method === "vocoder" || method === "sinmodel") && fRes && fRes.length > 0 && pSourceBuf) {
    // Variante A: Phasen-Vocoder (async wegen erstem Worklet-Laden)
    pBuf = pSourceBuf;
    let pb;
    try {
      pb = await pBuildVocoderGraph(
        c, pSourceBuf, firstNode, pWarpMode, pWarpStrength, fRes, 0, pOff
      );
    } catch (err) {
      console.error("Vocoder-Fehler:", err);
      return;
    }
    // Prüfen ob Pause/Stop während Worklet-Laden gedrückt wurde
    if (gen !== pPlayGen) {
      pb.stop();
      return;
    }
    pCurrentPlayback = pb;
    leadSrc = pb.sources[0] || null;

  } else {
    // Normal oder Offline-Warp (Variante C)
    pSrc = c.createBufferSource();
    pSrc.buffer = pBuf;
    pSrc.connect(firstNode);
    pSrc.start(0, pOff);
    leadSrc = pSrc;
  }

  if (leadSrc) {
    leadSrc.onended = function () {
      if (pPlaying) {
        pPlaying = false;
        pOff = 0;
        pUpdBtn();
        pUpdTL();
      }
    };
  }

  pT0 = c.currentTime - pOff;
  pPlaying = true;
  pUpdBtn();
  requestAnimationFrame(pTick);
}

function pPause() {
  pPlayGen++;   // invalidiert laufenden Vocoder-Await in pPlay
  if (pSrc) {
    pSrc.onended = null;
    try { pSrc.stop(); } catch (e) {}
    pSrc = null;
  }
  if (pCurrentPlayback) {
    // onended der Vocoder/Bandshift-Sources nullen — sonst feuert der alte
    // 'end-of-track'-Handler asynchron nach src.stop() und setzt pPlaying/pOff
    // im neuen Zustand zurück (Slider auf 0, Ton spielt aber weiter).
    if (pCurrentPlayback.sources) {
      for (const s of pCurrentPlayback.sources) {
        if (s) s.onended = null;
      }
    }
    pCurrentPlayback.stop();
    pCurrentPlayback = null;
  }
  if (pMaplawNode) {
    try { pMaplawNode.disconnect(); } catch (e) {}
    pMaplawNode = null;
  }
  if (pCtx && pBuf) {
    pOff = pCtx.currentTime - pT0;
    if (pOff > pBuf.duration) pOff = 0;
  }
  pPlaying = false;
  pUpdBtn();
}

function pStopReset() {
  // Auch greifen, wenn pPlaying im Zwischenzustand false ist (z.B. während ein
  // async Vocoder-pPlay im await hängt), aber Sources schon laufen — sonst
  // bleibt der Ton hängen und der Stop-Button wirkt nicht.
  if (pPlaying || pSrc || pCurrentPlayback) pPause();
  pOff = 0;
  pUpdBtn();
  pUpdTL();
}

function pTick() {
  if (!pPlaying) return;
  pUpdTL();
  requestAnimationFrame(pTick);
}

function pUpdTL() {
  if (!pBuf) return;
  const c = pPlaying ? pCtx.currentTime - pT0 : pOff,
    cl = Math.min(c, pBuf.duration);
  document.getElementById("plCur").textContent = pFmt(cl);
  document.getElementById("plTL").value = (cl / pBuf.duration) * 1000;
}

function pUpdBtn() {
  document.getElementById("plPlay").textContent = pPlaying
    ? "\u23F8"
    : "\u25B6";
}

function pFmt(s) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60),
    sec = Math.floor(s % 60);
  return m + ":" + (sec < 10 ? "0" : "") + sec;
}

function pMaplawGetIstC() {
  const s = sideData[activeSide];
  if (s && s.implant && typeof s.implant.cValue === "number" && s.implant.cValue > 0) {
    return s.implant.cValue;
  }
  return 1000;
}

function pMaplawIsApplicable() {
  if (mfr === "medel") return true;
  const mode = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  if (mode === "both" || mode === "mono") {
    const other = activeSide === "left" ? "right" : "left";
    if (sideData[other] && sideData[other].manufacturer === "medel") return true;
  }
  return false;
}

function plCheck() {
  const hMeas = bRes.length > 0;
  const hLv = manualLevels.some((v) => v !== 0);
  const hCur = presets.some((p) => p.on && p.strength !== 0);
  const hasData =
    (plSrcMeas && hMeas) ||
    (plSrcLevels && hLv) ||
    (plSrcCurves && hCur);
  document
    .getElementById("plNoD")
    .classList.toggle("hidden", hasData || hMeas || hLv || hCur);
  if (pEqF.length > 0) pUpdEQ();
  else {
    pDrawEQ();
    pBuildTbl();
  }
  document.getElementById("plEqViz").style.display = "";
  document
    .getElementById("plNHInfo")
    .classList.toggle("hidden", !document.getElementById("plNHSim").checked);
  // Deaf-Hinweis
  const deafHint = document.getElementById("plDeafHintEl");
  if (deafHint) {
    const hasDeaf = (sideData.left.config || "ci") === "deaf"
                 || (sideData.right.config || "ci") === "deaf";
    deafHint.style.display = hasDeaf ? "" : "none";
    if (hasDeaf) deafHint.textContent = t("cfgHintDeaf");
  }
}

document.getElementById("plPlay").addEventListener("click", pToggle);
document.getElementById("plStop").addEventListener("click", pStopReset);
document.getElementById("plTL").addEventListener("input", function () {
  if (!pBuf) return;
  pOff = (this.value / 1000) * pBuf.duration;
  document.getElementById("plCur").textContent = pFmt(pOff);
  if (pPlaying) {
    pPause();
    pPlay();
  }
});

function pDrawEQ() {
  const cv = document.getElementById("plEqCv");
  if (!cv) return;
  const wp = cv.parentElement,
    dpr = window.devicePixelRatio || 1,
    W = wp.clientWidth,
    H = wp.clientHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  let gains = getPlayerGains();
  if (typeof gains.left !== "undefined") {
    gains = gains.left;
  }
  const str = parseInt(document.getElementById("plStr").value) / 100;
  const nhSim = document.getElementById("plNHSim").checked;
  const allE = allEl();
  const act = new Set(actEl());
  let mxA = 1;
  for (const i of allE) {
    if (!act.has(i)) continue;
    const g = Math.abs(gains[i]) * str;
    if (g > mxA) mxA = g;
  }
  mxA = Math.ceil(mxA / 2) * 2 + 2;
  const pad = { left: 40, right: 14, top: 14, bottom: 26 },
    pW = W - pad.left - pad.right,
    pH = H - pad.top - pad.bottom,
    zY = pad.top + pH / 2;
  const bW = Math.max(5, (pW / allE.length) * 0.6),
    gW = pW / allE.length;
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.left, zY);
  ctx.lineTo(W - pad.right, zY);
  ctx.stroke();
  const steps = Math.min(4, Math.floor(mxA / 2));
  for (let s = 1; s <= steps; s++) {
    const dB = s * (mxA / steps),
      yO = (dB / mxA) * (pH / 2);
    ctx.beginPath();
    ctx.moveTo(pad.left, zY - yO);
    ctx.lineTo(W - pad.right, zY - yO);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad.left, zY + yO);
    ctx.lineTo(W - pad.right, zY + yO);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#999";
    ctx.font = "9px Consolas,monospace";
    ctx.textAlign = "right";
    ctx.fillText("+" + dB.toFixed(0), pad.left - 4, zY - yO + 3);
    ctx.fillText("-" + dB.toFixed(0), pad.left - 4, zY + yO + 3);
    ctx.setLineDash([2, 4]);
  }
  ctx.setLineDash([]);
  ctx.fillStyle = "#999";
  ctx.font = "9px Consolas,monospace";
  ctx.textAlign = "right";
  ctx.fillText("0", pad.left - 4, zY + 3);
  for (let j = 0; j < allE.length; j++) {
    const i = allE[j],
      x = pad.left + j * gW + (gW - bW) / 2;
    const isAct = act.has(i);
    let ag = isAct && plEqOn ? (nhSim ? gains[i] * str : -gains[i] * str) : 0;
    const bH = (Math.abs(ag) / mxA) * (pH / 2),
      y = ag >= 0 ? zY - bH : zY;
    if (!isAct) {
      ctx.fillStyle = "#d1d5db";
      ctx.fillRect(x, zY - 0.5, bW, 1);
    } else {
      ctx.fillStyle = ag === 0 ? "#ccc" : ag >= 0 ? "#16a34a" : "#dc2626";
      if (bH > 0.5) ctx.fillRect(x, y, bW, bH);
      else {
        ctx.fillStyle = "#ccc";
        ctx.fillRect(x, zY - 0.5, bW, 1);
      }
    }
    ctx.fillStyle = isAct ? "#666" : "#bbb";
    ctx.font = "8px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(dENPrefix() + dEN(i), pad.left + j * gW + gW / 2, H - pad.bottom + 10);
    ctx.font = "7px Consolas,monospace";
    ctx.fillStyle = "#999";
    const ef_i = effFreq(i);
    ctx.fillText(
      ef_i >= 1000 ? (ef_i / 1000).toFixed(1) + "k" : ef_i,
      pad.left + j * gW + gW / 2,
      H - pad.bottom + 20,
    );
  }
}

function pBuildTbl() {
  let gains = getPlayerGains();
  if (typeof gains.left !== "undefined") {
    gains = gains.left;
  }
  const str = parseInt(document.getElementById("plStr").value) / 100;
  const nhSim = document.getElementById("plNHSim").checked;
  const h = document.getElementById("plEqH"),
    lv = document.getElementById("plEqLv"),
    gn = document.getElementById("plEqGn");
  h.innerHTML = "<th></th>";
  lv.innerHTML =
    '<td style="color:var(--text-muted);font-size:.78em">Pegel</td>';
  gn.innerHTML =
    '<td style="color:var(--text-muted);font-size:.78em">Gain</td>';
  for (let i = 0; i < nEl; i++) {
    h.innerHTML += `<th>${dENPrefix()}${dEN(i)}</th>`;
    const v = gains[i];
    lv.innerHTML += `<td style="color:${v > 0.05 ? "#2563eb" : v < -0.05 ? "#dc2626" : "#666"}">${v >= 0 ? "+" : ""}${v.toFixed(1)}</td>`;
    const g = plEqOn ? (nhSim ? v * str : -v * str) : 0;
    gn.innerHTML += `<td style="color:${g > 0.05 ? "#16a34a" : g < -0.05 ? "#dc2626" : "#666"}">${g >= 0 ? "+" : ""}${g.toFixed(1)}</td>`;
  }
}

function pMaplawTrigger() {
  if (!pPlaying) return;

  const shouldBeOn = pMaplawOn && plEqOn && pMaplawIsApplicable();
  const isOn = !!pMaplawNode;

  if (shouldBeOn && isOn) {
    pMaplawApplyParams(pMaplawNode, {
      istC: pMaplawGetIstC(),
      sollC: pMaplawSollC,
      active: true,
    });
    return;
  }

  if (shouldBeOn !== isOn) {
    const offSec = pCtx ? Math.max(0, pCtx.currentTime - pT0) : 0;
    pPause();
    pOff = offSec;
    pPlay();
  }
}

function pMaplawUpdUI() {
  const cardOn   = document.getElementById("plMaplawOn");
  const sollIn   = document.getElementById("plMaplawSollInput");
  const istEl    = document.getElementById("plMaplawIstVal");
  const cfgBox   = document.getElementById("plMaplawConfig");
  const hintBox  = document.getElementById("plMaplawNotApplicableHint");
  if (!cardOn) return;

  const applicable = (typeof pMaplawIsApplicable === "function")
    ? pMaplawIsApplicable() : false;

  cardOn.disabled = !applicable;
  if (cfgBox) cfgBox.style.opacity = applicable ? "1" : "0.4";
  if (cfgBox) {
    cfgBox.querySelectorAll("button, input").forEach((el) => {
      el.disabled = !applicable;
    });
  }
  if (hintBox) hintBox.style.display = applicable ? "none" : "";

  cardOn.checked = !!pMaplawOn;

  if (istEl) {
    const ist = (typeof pMaplawGetIstC === "function") ? pMaplawGetIstC() : null;
    istEl.textContent = ist != null ? String(ist) : "—";
  }

  if (sollIn) sollIn.value = String(pMaplawSollC);
}

window.addEventListener("resize", () => {
  if (bRes.length > 0) {
    pDrawEQ();
    if (document.getElementById("resC").style.display !== "none")
      renderResults();
  }
  if (document.getElementById("panel-levels").classList.contains("active"))
    drawLvChart();
  if (document.getElementById("subpanel-ergebnisse-lrresults")?.classList.contains("active"))
    lrDrawChart();
});
