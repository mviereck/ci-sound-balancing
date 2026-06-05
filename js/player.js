// ============================================================
// PLAYER
// ============================================================
let pCtx = null,
  pBuf = null,
  pSourceBuf = null,
  pFileBuf = null,          // Audiodatei-Buffer (überlebt Sätze-Wiedergabe)
  pPlaybackMode = "file",   // "file" | "sentence" — Aktiver Buffer-Slot
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
  pSeeking = false,
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

function pSetPlaybackMode(mode) {
  if (!["file", "sentence", "noise", "book"].includes(mode)) return;
  pPlaybackMode = mode;
  if (mode === "file") {
    pSourceBuf = pFileBuf;
  } else if (mode === "sentence") {
    pSourceBuf = (typeof sSentenceBuf !== "undefined") ? sSentenceBuf : null;
  } else if (mode === "noise") {
    pSourceBuf = (typeof pNoiseBuf !== "undefined") ? pNoiseBuf : null;
  } else { // book
    pSourceBuf = (typeof pBookBuf !== "undefined") ? pBookBuf : null;
  }
  pMonoBuf = null;
  pLeftOnlyBuf = null;
  pRightOnlyBuf = null;
  if (typeof pWarpedBuf !== "undefined") {
    pWarpedBuf = null;
    if (typeof pWarpUpdUI === "function") pWarpUpdUI();
  }
  if (pSourceBuf) {
    pBuf = getPlaybackBuffer();
    pBuildEQ();
    if (typeof pWarpTrigger === "function") pWarpTrigger();
  } else {
    pBuf = null;
  }
}

function getPlaybackBuffer() {
  const mode = getPlayerSide();
  if (!pSourceBuf) return null;

  // EQ-Toggle wirkt als Master: wenn EQ aus, ist auch der Warp-Pfad bypass.
  const warpReady = typeof pWarpOn !== "undefined"
                  && pWarpOn && plEqOn && pWarpedBuf && !pWarpBusy;

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
        elExDur[r.a] === null &&
        elSt[r.a] !== "mute" &&
        elExDur[r.b] === null &&
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
    if (typeof sActive !== "undefined" && sActive
        && typeof sStop === "function") {
      sStop();
    }
    // Laufende Datei-Wiedergabe sauber stoppen, bevor die neue Datei
    // dekodiert wird. Kein Autostart — der Nutzer drückt Play selbst.
    if (pPlaying || pSrc || pCurrentPlayback) {
      pStopReset();
    }
    try {
      const c = gPC();
      const buf = await f.arrayBuffer();
      pFileBuf = await c.decodeAudioData(buf);
      pSetPlaybackMode("file");
      document.getElementById("plTot").textContent = pFmt(pBuf.duration);
      document.getElementById("plCur").textContent = "0:00";
      document.getElementById("plTL").value = 0;
      if (typeof plUpdDisplay === "function") plUpdDisplay();
      if (typeof plUpdTransportUI === "function") plUpdTransportUI();
      pBuildEQ();
      pDrawEQ();
      pBuildTbl();
      document.getElementById("plEqViz").style.display = "";
    } catch (err) {
      alert("Error: " + err.message);
    }
  });

function updatePlayerForSideChange() {
  if (typeof sActive !== "undefined" && sActive
      && typeof sStop === "function") {
    sStop();
  }
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
  const ef = effFreqDisplay(i),
    ef0 = effFreqDisplay(0),
    ef1 = effFreqDisplay(Math.min(1, nEl - 1)),
    efN = effFreqDisplay(nEl - 1),
    efNm1 = effFreqDisplay(Math.max(0, nEl - 2));
  let fL, fH;
  if (i === 0) {
    fL = (ef0 * ef0) / (ef1 || ef0);
    fH = ef1 || ef0;
  } else if (i === nEl - 1) {
    fL = efNm1;
    fH = (ef * ef) / efNm1;
  } else {
    fL = effFreqDisplay(i - 1);
    fH = effFreqDisplay(i + 1);
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
    // Latenz-Kette zwischen pGain und destination einhängen
    if (typeof latInitGraph === "function") {
      latInitGraph(c);
      pGain.connect(pLatSplitter);
    } else {
      pGain.connect(c.destination);
    }
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
      lf.frequency.value = nhSim
        ? effFreqDisplay(i, "left")
        : withSide("left", () => effFreq(i));
      lf.Q.value = pCompQ(i);
      lf.gain.value = 0;
      if (plEqOn) {
        lf.gain.value = nhSim ? leftGains[i] * str : -leftGains[i] * str;
      }
      pEqFLeft.push(lf);
      const rf = c.createBiquadFilter();
      rf.type = "peaking";
      rf.frequency.value = nhSim
        ? effFreqDisplay(i, "right")
        : withSide("right", () => effFreq(i));
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
    const balG = getPlayerBalanceGains();
    pChannelLeftGain.gain.value = dB2G(balG.left);
    pChannelRightGain.gain.value = dB2G(balG.right);
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
      f.frequency.value = nhSim ? effFreqDisplay(i) : effFreq(i);
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
    if (pChannelLeftGain || pChannelRightGain) {
      const balG = getPlayerBalanceGains();
      if (pChannelLeftGain) pChannelLeftGain.gain.value = dB2G(balG.left);
      if (pChannelRightGain) pChannelRightGain.gain.value = dB2G(balG.right);
    }
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
  if (pCtx && pCtx.state === "suspended") pCtx.resume();
  // Wenn Sätze laufen: stoppen, in Datei-Modus wechseln, Datei starten.
  // Ein Klick reicht (vorher waren zwei nötig).
  if (typeof sActive !== "undefined" && sActive
      && typeof sStop === "function") {
    sStop();
    if (!pFileBuf) return;          // keine Datei geladen → nichts zu spielen
    pSetPlaybackMode("file");
    pOff = 0;
    pPlay();
    return;
  }
  if (!pBuf) return;                // kein Buffer → ignorieren
  if (pPlaying) pPause();
  else pPlay();
}

async function pPlay() {
  const gen = ++pPlayGen;

  if (pSrc) {
    pSrc.onended = null;
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
  // Alte ausgehende Verbindung vom Ende der EQ-Chain trennen, bevor neu
  // verdrahtet wird. Sonst überlagert eine frühere lastEq→pGain Direkt-
  // verbindung das neue lastEq→pMaplawNode→pGain (Doppelpfad → MAPLAW-
  // Effekt vom Originalsignal verschluckt).
  if (lastEq) {
    try { lastEq.disconnect(); } catch (e) {}
  }

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

  let leadSrc = null;

  // Nur ein Pfad: BufferSource auf pBuf (original oder Rubberband-Vorberechnung).
  pSrc = c.createBufferSource();
  pSrc.buffer = pBuf;
  if (typeof plLoop !== "undefined" && plLoop) {
    pSrc.loop = true;
  }
  pSrc.connect(firstNode);
  pSrc.start(0, pOff);
  leadSrc = pSrc;

  if (leadSrc) {
    leadSrc.onended = function () {
      if (pPlaying) {
        pPlaying = false;
        pOff = 0;
        pUpdBtn();
        pUpdTL();
        if (typeof sActive !== "undefined" && sActive
            && typeof sOnEnded === "function") {
          sOnEnded();
        }
        // BA193: Auto-Advance bei Geraeuschen
        if (plActiveSource === "noise" && plAutoAdvance && !plLoop) {
          const ms = (typeof plPauseMs !== "undefined") ? plPauseMs : 0;
          setTimeout(function () {
            const all = amCollectItems("geraeusche");
            const sorted = amSortItems(all, "geraeusche", plNoiseSortAxis);
            if (sorted.length === 0) return;
            const idx = sorted.findIndex(function (x) { return x.id === plNoiseSelectedId; });
            const next = sorted[(idx + 1) % sorted.length];
            if (!next) return;
            plNoiseSelectedId = next.id;
            const sel = document.getElementById("plNoiseItemSel");
            if (sel) sel.value = next.id;
            plNoiseLoadSelected().then(function () {
              if (typeof pPlay === "function") pPlay();
            });
          }, ms);
        }
        // BA195: Auto-Advance bei Hoerbuechern (Kapitel-fuer-Kapitel)
        if (plActiveSource === "audiobook" && plAutoAdvance && !plLoop) {
          const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
          if (col && Array.isArray(col.items)) {
            const next = plBookChapterIdx + 1;
            if (next < col.items.length) {
              const ms = (typeof plPauseMs !== "undefined") ? plPauseMs : 0;
              setTimeout(function () {
                if (typeof plBookSavePosition === "function") plBookSavePosition();
                plBookChapterIdx = next;
                const sel = document.getElementById("plBookChSel");
                if (sel) sel.value = String(next);
                if (plBookPositions[plBookSelectedId]) {
                  plBookPositions[plBookSelectedId].chapterIdx = next;
                  plBookPositions[plBookSelectedId].posSeconds = 0;
                }
                plBookLoadSelected().then(function () {
                  if (typeof pPlay === "function") pPlay();
                });
              }, ms);
            }
          }
        }
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
  if (!pSeeking) document.getElementById("plTL").value = (cl / pBuf.duration) * 1000;
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
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
}

document.getElementById("plPlay").addEventListener("click", function () {
  if (typeof plPlayPauseToggle === "function") plPlayPauseToggle(); else pToggle();
});
document.getElementById("plStop").addEventListener("click", function () {
  if (typeof plStopAll === "function") plStopAll(); else pStopReset();
});
document.getElementById("plTL").addEventListener("pointerdown", () => { pSeeking = true; });
document.getElementById("plTL").addEventListener("pointerup",   () => { pSeeking = false; });
document.getElementById("plTL").addEventListener("pointercancel", () => { pSeeking = false; });
document.getElementById("plTL").addEventListener("input", function () {
  if (!pBuf) return;
  pOff = (this.value / 1000) * pBuf.duration;
  document.getElementById("plCur").textContent = pFmt(pOff);
  if (pPlaying) {
    const seekTo = pOff;
    pPause();
    pOff = seekTo;
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
    gains = (activeSide === "right") ? gains.right : gains.left;
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
  const pad = { left: 40, right: 14, top: 14, bottom: 38 },
    pW = W - pad.left - pad.right,
    pH = H - pad.top - pad.bottom,
    zY = pad.top + pH / 2;
  const axis = buildCentAxis(allE, pad.left, pW, function (i) {
    return effFreqDisplay(i);
  });
  const tX = axis.tX;
  const bW = Math.max(5, Math.min((axis.minDx || 12) * 0.6, 22));
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
  if (typeof refEl !== "undefined" && refEl !== null) {
    const jRef = allE.indexOf(refEl);
    if (jRef >= 0) {
      _drawRefElLabel(ctx, tX(jRef), pad.top - 3, 10);
    }
  }
  cv._axisHits = [];
  for (let j = 0; j < allE.length; j++) {
    const i = allE[j],
      cx = tX(j),
      x = cx - bW / 2;
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
    const lbl = dENPrefix() + dEN(i);
    ctx.fillText(lbl, cx, H - pad.bottom + 10);
    ctx.font = "7px Consolas,monospace";
    ctx.fillStyle = "#999";
    const ef_i = axis.hzArr[j];
    ctx.fillText(
      ef_i >= 1000 ? (ef_i / 1000).toFixed(1) + "k" : Math.round(ef_i),
      cx,
      H - pad.bottom + 20,
    );
    if (j % axis.step === 0 || j === 0 || j === allE.length - 1) {
      const c = Math.round(axis.centArr[j]);
      ctx.fillText((c >= 0 ? "+" : "") + c + " ¢", cx, H - pad.bottom + 30);
    }
    const halfDx = Math.max(8, (axis.minDx || 12) / 2);
    cv._axisHits.push({
      x0: cx - halfDx, x1: cx + halfDx,
      y0: H - pad.bottom + 2, y1: H - pad.bottom + 36,
      label: lbl,
      hz: axis.hzArr[j],
      cent: axis.centArr[j],
    });
  }
  _attachAxisTooltip(cv);
}

function pBuildTbl() {
  let gains = getPlayerGains();
  if (typeof gains.left !== "undefined") {
    gains = (activeSide === "right") ? gains.right : gains.left;
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

// Wendet den Zustand von plShowExperimental auf die UI an: Checkbox-State,
// Sichtbarkeit der MAPLAW- und Warping-Cards sowie des Hinweistexts.
// Wird beim DOMContentLoaded, beim Checkbox-Change und nach JSON-Load aufgerufen.
function pApplyShowExperimental() {
  const on = !!plShowExperimental;
  const cb = document.getElementById("plShowExperimental");
  const ht = document.getElementById("plExperimentalHint");
  if (cb) cb.checked = on;
  if (ht) ht.style.display = on ? "" : "none";
  const locked = !!pMaplawOn;
  if (cb) cb.disabled = locked;
}

function pMaplawUpdUI() {
  const cardOn     = document.getElementById("plMaplawOn");
  const sollIn     = document.getElementById("plMaplawSollInput");
  const istEl      = document.getElementById("plMaplawIstVal");
  const maplawRow  = document.getElementById("plMaplawRow");
  const settingsBox = document.getElementById("plMaplawSettingsBox");
  if (!cardOn) return;

  const applicable = (typeof pMaplawIsApplicable === "function") ? pMaplawIsApplicable() : false;

  if (maplawRow) maplawRow.style.display = applicable ? "" : "none";
  if (settingsBox) settingsBox.style.display = (pMaplawOn && applicable) ? "" : "none";

  cardOn.disabled = !applicable;
  if (pMaplawOn && applicable) {
    cardOn.textContent = t("plMaplawEnableOn");
    cardOn.style.background = "var(--success)";
    cardOn.style.color = "#fff";
    cardOn.style.borderColor = "var(--success)";
  } else {
    cardOn.textContent = t("plMaplawEnableOff");
    cardOn.style.background = "#e5e7eb";
    cardOn.style.color = "var(--text)";
    cardOn.style.borderColor = "var(--border)";
  }

  if (istEl) {
    const ist = (typeof pMaplawGetIstC === "function") ? pMaplawGetIstC() : null;
    istEl.textContent = ist != null ? String(ist) : "—";
  }

  const sollDisplay = document.getElementById("plMaplawSollDisplayVal");
  if (sollDisplay) {
    sollDisplay.textContent = (typeof pMaplawSollC === "number") ? String(pMaplawSollC) : "—";
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

// ============================================================
// BA 173: PLAYER-BEREICH-SPERRE L3 — eine Seite taub
// ------------------------------------------------------------
// Disabled die drei seitenabhängigen Player-Bereiche
// (Stereo-Balance, Latenzausgleich, Frequenz-Warping) und
// blendet daneben einen Inline-Hinweis ein, sobald mindestens
// eine Seite auf „Taub" steht.
// ============================================================
function playerLockApply() {
  const deaf = (typeof evalDeafState === "function") ? evalDeafState() : { hasDeaf: false };
  const off = deaf.hasDeaf;
  const setDisabled = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = off;
    if (off) el.style.opacity = "0.4";
    else el.style.opacity = "";
  };
  setDisabled("plBalApplyBtn");
  setDisabled("plBalModeSelect");
  setDisabled("plLatApplyBtn");
  setDisabled("plWarpOn");
  // Inline-Hinweise
  ["plLockHintBal", "plLockHintLat", "plLockHintWarp"].forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (off) {
      el.textContent = (typeof t === "function") ? t("plLockHintSideDeaf") : "Nicht verfügbar — Seite als taub eingetragen.";
      el.style.display = "inline";
    } else {
      el.style.display = "none";
    }
  });
}

// ===== BA192: zentrale Wiedergabe-Steuerung =====

function plPlayPauseToggle() {
  if (plActiveSource === "sentences") {
    if (typeof sActive !== "undefined" && sActive && typeof pPlaying !== "undefined" && pPlaying) {
      if (typeof pPause === "function") pPause();
      return;
    }
    if (typeof sActive !== "undefined" && sActive && typeof pPlaying !== "undefined" && !pPlaying && pBuf) {
      if (typeof pPlay === "function") pPlay();
      return;
    }
    if (typeof sPlay === "function") sPlay();
    return;
  }
  if (plActiveSource === "noise") {
    if (!pNoiseBuf || !pBuf) {
      plNoiseLoadSelected().then(function () {
        if (typeof pToggle === "function") pToggle();
      });
      return;
    }
    if (typeof pToggle === "function") pToggle();
    return;
  }
  if (plActiveSource === "audiobook") {
    if (!pBookBuf || !pBuf) {
      if (typeof plBookLoadSelected === "function") {
        plBookLoadSelected().then(function () {
          if (typeof pToggle === "function") pToggle();
        });
      }
      return;
    }
    if (typeof pToggle === "function") pToggle();
    return;
  }
  if (typeof pToggle === "function") pToggle();
}

function plStopAll() {
  if (plActiveSource === "audiobook" && typeof plBookSavePosition === "function") plBookSavePosition();
  if (typeof sActive !== "undefined" && sActive && typeof sStop === "function") sStop();
  if (typeof pStopReset === "function") pStopReset();
  _plAutoAdvCancel();
}

function plPrev() {
  if (plActiveSource === "sentences" && typeof sNext === "function") {
    sNext();
    return;
  }
  if (plActiveSource === "audiobook") {
    const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
    if (!col || !col.items) return;
    if (typeof plBookSavePosition === "function") plBookSavePosition();
    plBookChapterIdx = Math.max(0, plBookChapterIdx - 1);
    const sel = document.getElementById("plBookChSel");
    if (sel) sel.value = String(plBookChapterIdx);
    if (typeof plBookLoadSelected === "function") plBookLoadSelected();
    return;
  }
  if (typeof pStopReset === "function") {
    pStopReset();
    if (typeof pToggle === "function") pToggle();
  }
}

function plNext() {
  if (plActiveSource === "sentences" && typeof sNext === "function") {
    sNext();
    return;
  }
  if (plActiveSource === "audiobook") {
    const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
    if (!col || !col.items) return;
    if (typeof plBookSavePosition === "function") plBookSavePosition();
    plBookChapterIdx = Math.min(col.items.length - 1, plBookChapterIdx + 1);
    const sel = document.getElementById("plBookChSel");
    if (sel) sel.value = String(plBookChapterIdx);
    if (typeof plBookLoadSelected === "function") plBookLoadSelected();
    return;
  }
}

function plToggleLoop() {
  plLoop = !plLoop;
  plUpdTransportUI();
}

function plToggleAutoAdvance() {
  plAutoAdvance = !plAutoAdvance;
  plUpdTransportUI();
  if (!plAutoAdvance) _plAutoAdvCancel();
}

function plSetPause(ms) {
  plPauseMs = ms;
  plUpdTransportUI();
}

function plSetSource(src) {
  if (!["music", "sentences", "noise", "audiobook"].includes(src)) return;
  if (src === plActiveSource) return;
  if (plActiveSource === "audiobook" && typeof plBookSavePosition === "function") plBookSavePosition();
  plStopAll();
  plActiveSource = src;
  plUpdSourceUI();
  plUpdTransportUI();
  if (src === "noise") {
    plNoiseRefreshUI();
    plNoiseLoadSelected();
  } else if (src === "audiobook") {
    if (typeof plBookRefreshUI === "function") plBookRefreshUI();
    if (plBookSelectedId && typeof plBookLoadSelected === "function") plBookLoadSelected();
  }
  plUpdDisplay();
}

function plUpdSourceUI() {
  const btnM = document.getElementById("plSrcMusicBtn");
  const btnS = document.getElementById("plSrcSentencesBtn");
  const btnN = document.getElementById("plSrcNoiseBtn");
  const btnA = document.getElementById("plSrcAudiobookBtn");
  const subM = document.getElementById("plSubMusic");
  const subS = document.getElementById("plSubSentences");
  const subN = document.getElementById("plSubNoise");
  const subA = document.getElementById("plSubAudiobook");
  function setActive(btn, on) {
    if (!btn) return;
    btn.classList.toggle("active", on);
    btn.style.background = on ? "var(--accent, #6aa84f)" : "";
    btn.style.color      = on ? "#fff" : "";
  }
  setActive(btnM, plActiveSource === "music");
  setActive(btnS, plActiveSource === "sentences");
  setActive(btnN, plActiveSource === "noise");
  setActive(btnA, plActiveSource === "audiobook");
  if (subM) subM.style.display = (plActiveSource === "music")     ? "" : "none";
  if (subS) subS.style.display = (plActiveSource === "sentences") ? "" : "none";
  if (subN) subN.style.display = (plActiveSource === "noise")     ? "" : "none";
  if (subA) subA.style.display = (plActiveSource === "audiobook") ? "" : "none";
}

function plUpdTransportUI() {
  const loopBtn = document.getElementById("plLoopBtn");
  if (loopBtn) {
    loopBtn.classList.toggle("active", plLoop);
    loopBtn.style.background = plLoop ? "var(--accent, #6aa84f)" : "";
    loopBtn.style.color      = plLoop ? "#fff" : "";
  }
  const aaBtn = document.getElementById("plAutoAdvBtn");
  if (aaBtn) {
    aaBtn.classList.toggle("active", plAutoAdvance);
    aaBtn.style.background = plAutoAdvance ? "var(--accent, #6aa84f)" : "";
    aaBtn.style.color      = plAutoAdvance ? "#fff" : "";
  }
  document.querySelectorAll(".pl-pause-btn").forEach(function (b) {
    const v = parseInt(b.dataset.ms, 10);
    const active = (v === plPauseMs);
    b.classList.toggle("active", active);
    b.style.background = active ? "var(--accent, #6aa84f)" : "";
    b.style.color      = active ? "#fff" : "";
    b.disabled = false;
    b.style.opacity = "1";
    b.style.cursor  = "pointer";
  });
  const prevBtn = document.getElementById("plPrev");
  const nextBtn = document.getElementById("plNext");
  const hasNext = (plActiveSource === "sentences" || plActiveSource === "audiobook");
  [prevBtn, nextBtn].forEach(function (b) {
    if (!b) return;
    b.disabled = !hasNext;
    b.style.opacity = hasNext ? "1" : "0.5";
    b.style.cursor  = hasNext ? "pointer" : "not-allowed";
  });
}

function plUpdDisplay() {
  const title = document.getElementById("plDispTitle");
  const meta  = document.getElementById("plDispMeta");
  const textToggleWrap = document.getElementById("plSentTextToggleWrap");
  if (!title || !meta) return;

  let titleText = "";
  let metaParts = [];
  let showTextToggle = false;

  if (plActiveSource === "sentences") {
    showTextToggle = true;
    if (typeof sCurRec !== "undefined" && sCurRec) {
      const speakerLabel = sCurRec.title || (sCurRec.tags && sCurRec.tags.speaker_id) || "";
      const sourceLabel  = sCurRec.sourceTitle || "";
      if (sourceLabel && speakerLabel && sourceLabel !== speakerLabel) {
        titleText = sourceLabel + " — " + speakerLabel;
      } else if (speakerLabel) {
        titleText = speakerLabel;
      } else if (sourceLabel) {
        titleText = sourceLabel;
      } else {
        titleText = (typeof t === "function") ? t("plDispEmpty") : "Nichts geladen";
      }
      if (sCurRec.tags && sCurRec.tags.lang)   metaParts.push(sCurRec.tags.lang);
      if (sCurRec.license)                      metaParts.push(sCurRec.license);
      if (sCurRec.credit)                       metaParts.push(sCurRec.credit);
    } else {
      titleText = (typeof t === "function") ? t("plDispEmpty") : "Nichts geladen";
    }
  } else if (plActiveSource === "music") {
    const fi = document.getElementById("plAudio");
    const fname = (fi && fi.files && fi.files[0]) ? fi.files[0].name : "";
    titleText = fname || ((typeof t === "function") ? t("plDispEmpty") : "Nichts geladen");
  } else if (plActiveSource === "noise") {
    const it = (typeof plNoiseCurrentItem === "function") ? plNoiseCurrentItem() : null;
    if (it) {
      titleText = it.title || it.id;
      const parts = [];
      if (it.tags && it.tags.kind)     parts.push(it.tags.kind);
      if (it.tags && it.tags.spectrum) parts.push(it.tags.spectrum);
      if (it.license)     parts.push(it.license);
      if (it.sourceTitle) parts.push(it.sourceTitle);
      metaParts = parts;
    } else {
      titleText = (typeof t === "function") ? t("plDispEmpty") : "Nichts geladen";
    }
  } else if (plActiveSource === "audiobook") {
    const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
    const ch  = (typeof plBookCurrentChapter    === "function") ? plBookCurrentChapter()    : null;
    if (col && ch) {
      titleText = (ch.title || "Kapitel") + " — " + (col.title || "");
      const parts = [];
      if (col.tags && col.tags.work_author) parts.push(col.tags.work_author);
      if (col.tags && col.tags.reader)      parts.push("Sprecher: " + col.tags.reader);
      if (col.lang)                          parts.push(col.lang);
      if (col.license)                       parts.push(col.license);
      metaParts = parts;
    } else {
      titleText = (typeof t === "function") ? t("plDispEmpty") : "Nichts geladen";
    }
  } else {
    titleText = (typeof t === "function") ? t("plDispEmpty") : "Nichts geladen";
  }

  title.textContent = titleText;
  meta.textContent  = metaParts.length ? metaParts.join(" · ") : "";
  if (textToggleWrap) textToggleWrap.style.display = showTextToggle ? "inline-flex" : "none";

  const tb = document.getElementById("plSentTextBox");
  const tx = document.getElementById("plSentText");
  const cb = document.getElementById("plSentShowText");
  if (cb) cb.checked = !!plSentShowText;
  if (tb) tb.style.display = (plActiveSource === "sentences" && plSentShowText) ? "" : "none";
  if (tx && plActiveSource === "sentences") {
    tx.textContent = (typeof sCurRec !== "undefined" && sCurRec && sCurRec.text) ? sCurRec.text : "";
  }
}

function plRefreshTooltips() {
  document.querySelectorAll("[data-tip]").forEach(function (el) {
    const k = el.getAttribute("data-tip");
    if (k && typeof t === "function") el.title = t(k);
  });
}

let _plIdleTimer = null;
const _PL_IDLE_MS = 30 * 60 * 1000;

function _plArmIdleTimer() {
  _plClearIdleTimer();
  _plIdleTimer = setTimeout(function () {
    if (plAutoAdvance) {
      console.log("[player] Auto-Advance gestoppt: 30 min ohne Bedienung");
      plStopAll();
    }
  }, _PL_IDLE_MS);
}
function _plClearIdleTimer() {
  if (_plIdleTimer) { clearTimeout(_plIdleTimer); _plIdleTimer = null; }
}
function _plNoteInteraction() {
  if (plAutoAdvance && (pPlaying || (typeof sActive !== "undefined" && sActive))) {
    _plArmIdleTimer();
  }
}
function _plAutoAdvCancel() {
  _plClearIdleTimer();
}

document.addEventListener("click",      _plNoteInteraction, true);
document.addEventListener("keydown",    _plNoteInteraction, true);
document.addEventListener("touchstart", _plNoteInteraction, true);

// BA192: Quellen-Top-Toggle
document.getElementById("plSrcMusicBtn").addEventListener("click",
  function () { plSetSource("music"); });
document.getElementById("plSrcSentencesBtn").addEventListener("click",
  function () { plSetSource("sentences"); });
document.getElementById("plSrcNoiseBtn").addEventListener("click",
  function () { plSetSource("noise"); });
document.getElementById("plSrcAudiobookBtn").addEventListener("click",
  function () { plSetSource("audiobook"); });

// BA192: Transport-Knoepfe
document.getElementById("plPrev").addEventListener("click", plPrev);
document.getElementById("plNext").addEventListener("click", plNext);
document.getElementById("plLoopBtn").addEventListener("click", plToggleLoop);
document.getElementById("plAutoAdvBtn").addEventListener("click", plToggleAutoAdvance);

document.querySelectorAll(".pl-pause-btn").forEach(function (b) {
  b.addEventListener("click", function () {
    const v = parseInt(b.dataset.ms, 10);
    if (Number.isFinite(v)) plSetPause(v);
  });
});

const _plSentTxtCb = document.getElementById("plSentShowText");
if (_plSentTxtCb) {
  _plSentTxtCb.addEventListener("change", function () {
    plSentShowText = !!_plSentTxtCb.checked;
    plUpdDisplay();
  });
}

// ============================================================
// BA193: Lautstärke-Schnellbuttons
// ============================================================

function plUpdVolBtns() {
  const cur = parseInt(document.getElementById("plVol").value, 10);
  document.querySelectorAll(".pl-vol-btn").forEach(function (b) {
    const v = parseInt(b.dataset.v, 10);
    const active = (v === cur);
    b.classList.toggle("active", active);
    b.style.background = active ? "var(--accent, #6aa84f)" : "";
    b.style.color      = active ? "#fff" : "";
  });
}

document.querySelectorAll(".pl-vol-btn").forEach(function (b) {
  b.addEventListener("click", function () {
    const v = parseInt(b.dataset.v, 10);
    if (!Number.isFinite(v)) return;
    const el = document.getElementById("plVol");
    el.value = v;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    plUpdVolBtns();
  });
});

// ============================================================
// BA193: Geraeusche-Quelle
// ============================================================

function plNoiseRefreshUI() {
  const sortSel = document.getElementById("plNoiseSortSel");
  const itemSel = document.getElementById("plNoiseItemSel");
  const empty   = document.getElementById("plNoiseEmpty");
  if (!sortSel || !itemSel) return;

  // Sortier-Achsen-Dropdown
  const axes = (typeof amSortAxesFor === "function") ? amSortAxesFor("geraeusche") : [];
  if (sortSel.options.length === 0) {
    for (const a of axes) {
      const opt = document.createElement("option");
      opt.value = a.key;
      opt.textContent = (typeof t === "function") ? t(a.labelKey) : a.labelDefault;
      sortSel.appendChild(opt);
    }
    if (typeof plNoiseSortAxis !== "undefined" && plNoiseSortAxis) {
      sortSel.value = plNoiseSortAxis;
    }
  } else {
    // Labels ggf. nach Sprachwechsel neu setzen
    for (let i = 0; i < sortSel.options.length; i++) {
      const opt = sortSel.options[i];
      const a = axes.find(function (x) { return x.key === opt.value; });
      if (a) opt.textContent = (typeof t === "function") ? t(a.labelKey) : a.labelDefault;
    }
  }

  // Items sammeln, sortieren, einsetzen
  const all = (typeof amCollectItems === "function") ? amCollectItems("geraeusche") : [];
  const sorted = (typeof amSortItems === "function")
    ? amSortItems(all, "geraeusche", sortSel.value)
    : all;

  const prev = itemSel.value;
  while (itemSel.firstChild) itemSel.removeChild(itemSel.firstChild);
  for (const it of sorted) {
    const opt = document.createElement("option");
    opt.value = it.id;
    opt.textContent = it.title || it.id;
    itemSel.appendChild(opt);
  }
  // vorherige Auswahl wiederherstellen, sonst gespeicherte oder erste
  if (sorted.find(function (it) { return it.id === prev; })) {
    itemSel.value = prev;
  } else if (typeof plNoiseSelectedId !== "undefined" && plNoiseSelectedId
             && sorted.find(function (it) { return it.id === plNoiseSelectedId; })) {
    itemSel.value = plNoiseSelectedId;
  } else if (sorted.length > 0) {
    itemSel.value = sorted[0].id;
  }
  if (empty) empty.style.display = (sorted.length === 0) ? "" : "none";

  // gemerkten State updaten
  if (typeof plNoiseSelectedId !== "undefined" && itemSel.value) {
    plNoiseSelectedId = itemSel.value;
  }
  if (typeof plSentBgRefreshUI === "function") plSentBgRefreshUI();
}

function plNoiseCurrentItem() {
  const all = (typeof amCollectItems === "function") ? amCollectItems("geraeusche") : [];
  return all.find(function (it) { return it.id === plNoiseSelectedId; }) || null;
}

async function plNoiseLoadSelected() {
  const it = plNoiseCurrentItem();
  if (!it) return;
  const ctx = gPC();
  const abuf = await amGetItemBuffer(ctx, it);
  if (!abuf) return;

  pNoiseBuf = abuf;
  pSetPlaybackMode("noise");
  document.getElementById("plTot").textContent = pFmt(pBuf ? pBuf.duration : 0);
  document.getElementById("plCur").textContent = "0:00";
  document.getElementById("plTL").value = 0;
  if (typeof plUpdDisplay     === "function") plUpdDisplay();
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
  pBuildEQ();
  pDrawEQ();
  pBuildTbl();
  document.getElementById("plEqViz").style.display = "";
}

const _plNSortEl = document.getElementById("plNoiseSortSel");
const _plNItemEl = document.getElementById("plNoiseItemSel");
if (_plNSortEl) {
  _plNSortEl.addEventListener("change", function () {
    plNoiseSortAxis = _plNSortEl.value;
    plNoiseRefreshUI();
  });
}
if (_plNItemEl) {
  _plNItemEl.addEventListener("change", function () {
    plNoiseSelectedId = _plNItemEl.value;
    // Wenn Player gerade Geraeusche aktiv hat: sofort umladen
    if (plActiveSource === "noise") {
      const wasPlaying = (typeof pPlaying !== "undefined") ? pPlaying : false;
      if (wasPlaying) { if (typeof pPause === "function") pPause(); }
      plNoiseLoadSelected().then(function () {
        if (wasPlaying && typeof pPlay === "function") pPlay();
      });
    }
    if (typeof plUpdDisplay === "function") plUpdDisplay();
  });
}

// Erstaufbau
plUpdSourceUI();
plUpdTransportUI();
plUpdDisplay();
plRefreshTooltips();
plUpdVolBtns();

// ============================================================
// BA194: Hintergrund-Geraeusch fuer Saetze
// ============================================================

function plSentBgRefreshUI() {
  const block  = document.getElementById("plSentBgBlock");
  const toggle = document.getElementById("plSentBgToggleBtn");
  const ctrls  = document.getElementById("plSentBgControls");
  const sel    = document.getElementById("plSentBgSel");
  if (!block || !toggle || !ctrls || !sel) return;

  const onLabel  = (typeof t === "function") ? t("plSentBgOn")  : "An";
  const offLabel = (typeof t === "function") ? t("plSentBgOff") : "Aus";
  const span = toggle.querySelector("[data-t]");
  if (span) span.textContent = plSentBgEnabled ? onLabel : offLabel;
  toggle.classList.toggle("active", !!plSentBgEnabled);
  toggle.style.background = plSentBgEnabled ? "var(--accent, #6aa84f)" : "";
  toggle.style.color      = plSentBgEnabled ? "#fff" : "";

  ctrls.style.opacity      = plSentBgEnabled ? "1" : "0.5";
  ctrls.style.pointerEvents = plSentBgEnabled ? "" : "none";

  const all  = (typeof amCollectItems === "function") ? amCollectItems("geraeusche") : [];
  const prev = sel.value || plSentBgItemId;
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  for (const it of all) {
    const opt = document.createElement("option");
    opt.value = it.id;
    opt.textContent = it.title || it.id;
    sel.appendChild(opt);
  }
  if (all.find(function (it) { return it.id === prev; })) {
    sel.value = prev;
  } else if (all.length > 0) {
    sel.value = all[0].id;
    plSentBgItemId = all[0].id;
  }

  document.querySelectorAll(".pl-snr-btn").forEach(function (b) {
    const v = parseInt(b.dataset.snr, 10);
    const active = (v === plSentBgSnrDb);
    b.classList.toggle("active", active);
    b.style.background = active ? "var(--accent, #6aa84f)" : "";
    b.style.color      = active ? "#fff" : "";
  });
}

function plSentBgToggle() {
  plSentBgEnabled = !plSentBgEnabled;
  if (typeof amMixCacheClear === "function") amMixCacheClear();
  plSentBgRefreshUI();
}

function plSentBgSetItem(id) {
  if (!id) return;
  plSentBgItemId = id;
  if (typeof amMixCacheClear === "function") amMixCacheClear();
  plSentBgRefreshUI();
}

function plSentBgSetSnr(db) {
  const v = parseInt(db, 10);
  if (!Number.isFinite(v)) return;
  plSentBgSnrDb = v;
  if (typeof amMixCacheClear === "function") amMixCacheClear();
  plSentBgRefreshUI();
}

const _plSBgToggle = document.getElementById("plSentBgToggleBtn");
if (_plSBgToggle) _plSBgToggle.addEventListener("click", plSentBgToggle);

const _plSBgSel = document.getElementById("plSentBgSel");
if (_plSBgSel) _plSBgSel.addEventListener("change", function () {
  plSentBgSetItem(_plSBgSel.value);
});

document.querySelectorAll(".pl-snr-btn").forEach(function (b) {
  b.addEventListener("click", function () {
    plSentBgSetSnr(b.dataset.snr);
  });
});

// ============================================================
// BA195: Hoerbuch-Quelle (lokal)
// ============================================================

const AM_AUDIO_EXT = /\.(mp3|wav|flac|ogg|opus|m4a|m4b|mp4)$/i;

async function plBookHandleUpload(fileList) {
  const files = Array.from(fileList || []).filter(function (f) {
    return AM_AUDIO_EXT.test(f.name);
  });
  if (files.length === 0) {
    alert(t("plBookUploadNoAudio") || "Keine Audiodateien gefunden.");
    return;
  }
  files.sort(function (a, b) {
    const na = a.webkitRelativePath || a.name;
    const nb = b.webkitRelativePath || b.name;
    return na < nb ? -1 : (na > nb ? 1 : 0);
  });

  const firstPath = files[0].webkitRelativePath || files[0].name;
  const folderName = (firstPath.indexOf("/") >= 0)
    ? firstPath.split("/")[0]
    : "Hoerbuch";

  const bookId = "local-book:" + folderName + ":" + files.length;
  if (typeof amRemoveLocalBookCollection === "function") {
    amRemoveLocalBookCollection(bookId);
  }

  const items = files.map(function (f, i) {
    return {
      id: bookId + "#ch" + String(i + 1).padStart(3, "0"),
      title: f.name.replace(/\.[^.]+$/, ""),
      audio: URL.createObjectURL(f),
      duration: null,
      tags: { chapter_no: i + 1 }
    };
  });

  const collection = {
    schema: "ci-sb-corpus/2",
    kind: "collection",
    category: "hoerbuecher",
    id: bookId,
    title: folderName,
    lang: null,
    tags: { reader: null, work_author: null, genres: [] },
    items: items,
    _isLocal: true
  };

  amAddLocalBookCollection(collection);
  plBookSelectedId = bookId;
  plBookChapterIdx = 0;
  plBookRefreshUI();
}

function plBookCurrentCollection() {
  const all = (typeof amCollectCollections === "function")
    ? amCollectCollections("hoerbuecher") : [];
  return all.find(function (c) { return c.id === plBookSelectedId; }) || null;
}

function plBookCurrentChapter() {
  const col = plBookCurrentCollection();
  if (!col || !col.items || col.items.length === 0) return null;
  const idx = Math.max(0, Math.min(plBookChapterIdx, col.items.length - 1));
  return col.items[idx];
}

function plBookRefreshUI() {
  const sortSel = document.getElementById("plBookSortSel");
  const bookSel = document.getElementById("plBookSel");
  const chSel   = document.getElementById("plBookChSel");
  const empty   = document.getElementById("plBookEmpty");
  if (!sortSel || !bookSel || !chSel) return;

  const axes = (typeof amCollectionSortAxesFor === "function")
    ? amCollectionSortAxesFor("hoerbuecher") : [];
  if (sortSel.options.length === 0) {
    for (const a of axes) {
      const opt = document.createElement("option");
      opt.value = a.key;
      opt.textContent = (typeof t === "function") ? t(a.labelKey) : a.labelDefault;
      sortSel.appendChild(opt);
    }
  }
  sortSel.value = plBookSortAxis;

  const all = (typeof amCollectCollections === "function")
    ? amCollectCollections("hoerbuecher") : [];
  const sorted = (typeof amSortCollections === "function")
    ? amSortCollections(all, "hoerbuecher", plBookSortAxis)
    : all;

  while (bookSel.firstChild) bookSel.removeChild(bookSel.firstChild);
  for (const c of sorted) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.title || c.id;
    bookSel.appendChild(opt);
  }
  if (sorted.find(function (c) { return c.id === plBookSelectedId; })) {
    bookSel.value = plBookSelectedId;
  } else if (sorted.length > 0) {
    plBookSelectedId = sorted[0].id;
    bookSel.value = plBookSelectedId;
  } else {
    plBookSelectedId = null;
  }

  while (chSel.firstChild) chSel.removeChild(chSel.firstChild);
  const col = plBookCurrentCollection();
  if (col && Array.isArray(col.items)) {
    for (let i = 0; i < col.items.length; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = (i + 1) + ". " + (col.items[i].title || ("Kapitel " + (i + 1)));
      chSel.appendChild(opt);
    }
    if (plBookChapterIdx >= col.items.length) plBookChapterIdx = 0;
    chSel.value = String(plBookChapterIdx);
  }

  if (empty) empty.style.display = sorted.length === 0 ? "" : "none";

  if (typeof plUpdDisplay === "function") plUpdDisplay();
}

async function plBookLoadSelected() {
  const ch = plBookCurrentChapter();
  if (!ch) return;
  const ctx = gPC();
  let abuf = null;
  try {
    const r = await fetch(ch.audio);
    const ab = await r.arrayBuffer();
    abuf = await ctx.decodeAudioData(ab);
  } catch (e) {
    console.error("[book] Kapitel-Lade-Fehler:", e);
    alert("Kapitel konnte nicht geladen werden: " + e.message);
    return;
  }
  if (!abuf) return;

  pBookBuf = abuf;
  pSetPlaybackMode("book");
  document.getElementById("plTot").textContent = pFmt(pBuf ? pBuf.duration : 0);

  const pos = (plBookPositions && plBookPositions[plBookSelectedId]) || null;
  if (pos && typeof pos.chapterIdx === "number" && pos.chapterIdx === plBookChapterIdx
      && typeof pos.posSeconds === "number" && pos.posSeconds > 0
      && pos.posSeconds < abuf.duration - 5) {
    pOff = pos.posSeconds;
    document.getElementById("plCur").textContent = pFmt(pOff);
    document.getElementById("plTL").value = (pOff / abuf.duration) * 1000;
  } else {
    pOff = 0;
    document.getElementById("plCur").textContent = "0:00";
    document.getElementById("plTL").value = 0;
  }

  if (typeof plUpdDisplay     === "function") plUpdDisplay();
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
  pBuildEQ();
  pDrawEQ();
  pBuildTbl();
  document.getElementById("plEqViz").style.display = "";
}

function plBookSavePosition() {
  if (!plBookSelectedId || !plBookCurrentChapter()) return;
  const cur = (typeof pCtx !== "undefined" && pCtx && pPlaying)
    ? (pCtx.currentTime - pT0)
    : pOff;
  plBookPositions[plBookSelectedId] = {
    chapterIdx: plBookChapterIdx,
    posSeconds: Math.max(0, cur)
  };
}

const _plBookUpBtn = document.getElementById("plBookUploadBtn");
const _plBookUpInp = document.getElementById("plBookUploadInput");
const _plBookSortS = document.getElementById("plBookSortSel");
const _plBookSelS  = document.getElementById("plBookSel");
const _plBookChS   = document.getElementById("plBookChSel");
const _plBookRmBtn = document.getElementById("plBookRemoveBtn");

if (_plBookUpBtn && _plBookUpInp) {
  _plBookUpBtn.addEventListener("click", function () { _plBookUpInp.click(); });
  _plBookUpInp.addEventListener("change", function (e) {
    plBookHandleUpload(e.target.files);
    e.target.value = "";
  });
}
if (_plBookSortS) {
  _plBookSortS.addEventListener("change", function () {
    plBookSortAxis = _plBookSortS.value;
    plBookRefreshUI();
  });
}
if (_plBookSelS) {
  _plBookSelS.addEventListener("change", function () {
    plBookSavePosition();
    plBookSelectedId = _plBookSelS.value;
    const pos = plBookPositions && plBookPositions[plBookSelectedId];
    plBookChapterIdx = (pos && typeof pos.chapterIdx === "number") ? pos.chapterIdx : 0;
    plBookRefreshUI();
    if (plActiveSource === "audiobook") plBookLoadSelected();
  });
}
if (_plBookChS) {
  _plBookChS.addEventListener("change", function () {
    plBookSavePosition();
    plBookChapterIdx = parseInt(_plBookChS.value, 10) || 0;
    if (typeof plUpdDisplay === "function") plUpdDisplay();
    if (plActiveSource === "audiobook") plBookLoadSelected();
  });
}
if (_plBookRmBtn) {
  _plBookRmBtn.addEventListener("click", function () {
    if (!plBookSelectedId) return;
    if (!confirm(t("plBookRemoveConfirm") || "Diese Hoerbuch-Auswahl entfernen?")) return;
    const id = plBookSelectedId;
    delete plBookPositions[id];
    if (typeof amRemoveLocalBookCollection === "function") amRemoveLocalBookCollection(id);
    plBookSelectedId = null;
    plBookChapterIdx = 0;
    plBookRefreshUI();
  });
}
