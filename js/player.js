// ============================================================
// PLAYER
// ============================================================
let pCtx = null,
  pBuf = null,
  pSourceBuf = null,
  pFileBuf = null,          // Audiodatei-Buffer (überlebt Sätze-Wiedergabe)
  pPlaybackMode = "music",   // "music" | "sentences" | "noise" | "audiobook" — aktive Kategorie (Buffer-Slot)
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
  pMonoBalGain = null,
  pMaplawOn = false,
  pMaplawSollC = 1000,
  pMaplawNode = null,
  pPlaying = false,
  pSeeking = false,
  pOff = 0,
  pT0 = 0,
  pWarpComputingPromise = null;  // Handle auf laufende Warp-Berechnung (für pPlay-Warten)

function gPC() {
  if (!pCtx) pCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (pCtx.state === "suspended") pCtx.resume();
  return pCtx;
}

// BA 306: Liefert den Mono-Downmix (Mittelwert aller Kanaele) eines
// AudioBuffers als Float32Array. Zentrale Quelle fuer alle Mono-Pfade
// (Einseiten-Wiedergabe, Beide-Seiten-Mono-Mischung, Warp-Eingang).
function _pDownmixMono(buf) {
  const n = buf.length;
  const ch = buf.numberOfChannels;
  const out = new Float32Array(n);
  for (let s = 0; s < n; s++) {
    let sum = 0;
    for (let c = 0; c < ch; c++) sum += buf.getChannelData(c)[s];
    out[s] = sum / ch;
  }
  return out;
}

function createLeftOnlyBuffer(buf) {
  const c = gPC();
  const m = c.createBuffer(2, buf.length, buf.sampleRate);
  // BA 306: Einseiten-Wiedergabe spielt jetzt den Mono-Downmix der Quelle
  // auf dem aktiven (linken) Ohr -- statt nur des linken Quellkanals --,
  // damit gegenseitig gepanntes Material nicht verloren geht.
  m.getChannelData(0).set(_pDownmixMono(buf));
  // rechter Kanal bleibt 0
  return m;
}

function createRightOnlyBuffer(buf) {
  const c = gPC();
  const m = c.createBuffer(2, buf.length, buf.sampleRate);
  // BA 306: Mono-Downmix auf dem rechten (aktiven) Ohr.
  m.getChannelData(1).set(_pDownmixMono(buf));
  // linker Kanal bleibt 0
  return m;
}

function createMonoBuffer(buf) {
  const c = gPC();
  const m = c.createBuffer(2, buf.length, buf.sampleRate);
  const mono = _pDownmixMono(buf);
  m.getChannelData(0).set(mono);
  m.getChannelData(1).set(mono);
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

  // BA 306: Im Mono-Misch-Modus ist auch der un-gewarpte Rueckfall der
  // Mono-Downmix (nicht die getrennten Stereo-Kanaele). Der Warp-Inhalt
  // selbst wurde bereits VOR dem Warping zu Mono gemischt (siehe
  // pComputeRubberbandWarpedBuffer in freq-warp.js) -- daher KEIN
  // Nach-Warp-Downmix mehr.
  let srcL, srcR;
  if (mode === "mono") {
    const mono = _pDownmixMono(pSourceBuf);
    srcL = mono;
    srcR = mono;
  } else {
    srcL = pSourceBuf.getChannelData(0);
    srcR = pSourceBuf.numberOfChannels > 1
      ? pSourceBuf.getChannelData(1)
      : srcL;
  }
  const srcLen = pSourceBuf.length;
  const copyLen = Math.min(len, srcLen);

  if (affected.warpsLeft)  outL.set(warpL.subarray(0, len));
  else                     outL.set(srcL.subarray(0, copyLen));

  if (affected.warpsRight) outR.set(warpR.subarray(0, len));
  else                     outR.set(srcR.subarray(0, copyLen));

  return out;
}

function pSetPlaybackMode(mode) {
  if (!["music", "sentences", "noise", "audiobook"].includes(mode)) return;
  pPlaybackMode = mode;
  if (mode === "music") {
    pSourceBuf = pFileBuf;
  } else if (mode === "sentences") {
    pSourceBuf = (typeof sSentenceBuf !== "undefined") ? sSentenceBuf : null;
  } else if (mode === "noise") {
    pSourceBuf = (typeof pNoiseBuf !== "undefined") ? pNoiseBuf : null;
  } else { // audiobook
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
    if (typeof pWarpTrigger === "function") {
      const p = pWarpTrigger();
      pWarpComputingPromise = p;
      if (p && typeof p.finally === "function") {
        p.finally(function () {
          if (pWarpComputingPromise === p) pWarpComputingPromise = null;
        });
      }
    }
  } else {
    pBuf = null;
  }
  // Zentrale Anzeige-Aktualisierung: Gesamtzeit + Slider-Reset.
  // Aufrufer dürfen Position danach überschreiben (z.B. Hörbuch-Position).
  const _totEl = document.getElementById("plTot");
  const _curEl = document.getElementById("plCur");
  const _tlEl  = document.getElementById("plTL");
  if (_totEl) _totEl.textContent = (pBuf && typeof pFmt === "function") ? pFmt(pBuf.duration) : "0:00";
  if (_curEl) _curEl.textContent = "0:00";
  if (_tlEl)  _tlEl.value = 0;
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
    case "mono":
      // BA 306: Beide-Seiten-Mono -- Inhalt zu Mono gemischt, beide
      // EQ-Ketten bekommen denselben (Mono-)Inhalt.
      if (!pMonoBuf) pMonoBuf = createMonoBuffer(pSourceBuf);
      return pMonoBuf;
    case "both":
      if (pSourceBuf.numberOfChannels > 1) return pSourceBuf;
      if (!pMonoBuf) pMonoBuf = createMonoBuffer(pSourceBuf);
      return pMonoBuf;
    default:
      if (!pMonoBuf) pMonoBuf = createMonoBuffer(pSourceBuf);
      return pMonoBuf;
  }
}

function computeGains() {
  const corr = elTestData().correction;
  const presetCurve = getTotalPresetCurve();
  const g = new Array(nEl).fill(0);
  for (let i = 0; i < nEl; i++) {
    // corr[i] ist bereits gegatet (ungemessen/ausgeschlossen/stumm => 0),
    // daher kein eigener hd-Check mehr noetig.
    const addMeas = plSrcMeas ? -corr[i] : 0;
    const addLvls = plSrcLevels ? -manualLevels[i] : 0;
    const addCurves = plSrcCurves ? -presetCurve[i] : 0;
    g[i] = addMeas + addLvls + addCurves;
  }
  return g;
}

// BA 316: Gemeinsamer Absenk-Betrag (dB) gegen Clipping/Uebersteuern.
// Hoechste noetige Anhebung ueber BEIDE Seiten, aber nur unter den
// REGULAEREN Elektroden (nicht stumm/fast stumm/deaktiviert/ausgeschlossen).
// Rueckgabe >= 0; 0 = keine Anhebung noetig => keine Absenkung.
// computeGains() liefert die negierte Korrektur (eqRaw-Konvention), die
// echte Korrektur (positiv = Anhebung) ist daher -g[i].
// BA 320: Kern — hoechste noetige Anhebung ueber die uebergebenen Seiten,
// UNABHAENGIG von plEqHeadroomBoth. Fuer den Vergleich gemeinsam vs.
// seitenweise (Audiologen-Auftrag).
function _eqHeadroomOffsetForSides(sides) {
  if (!plEqHeadroom || !plEqOn) return 0;
  let mx = 0;
  sides.forEach(function (s) {
    withSide(s, function () {
      const g = computeGains();
      for (let i = 0; i < nEl; i++) {
        if (elSt[i] === "mute" || elSt[i] === "almostMute") continue;
        if (elActive && elActive[i] === false) continue;
        if (elExDur[i] !== null) continue;
        const corr = -g[i];           // echte Korrektur, positiv = Anhebung
        if (corr > mx) mx = corr;
      }
    });
  });
  return mx;
}

// BA 319/320: tatsaechlich angewandter Absenk-Betrag fuer eine Seite.
// Bei "Beide Seiten beruecksichtigen" an (oder ohne scopeSide) ueber beide
// Seiten, sonst nur ueber scopeSide.
function _eqHeadroomOffset(scopeSide) {
  if (!plEqHeadroom || !plEqOn) return 0;
  const sides = (plEqHeadroomBoth || !scopeSide) ? ["left", "right"] : [scopeSide];
  return _eqHeadroomOffsetForSides(sides);
}

// BA 313: EINZIGE Wertquelle fuer die Player-Korrektur einer Seite.
// side: "left" | "right". Rueckgabe { eq:[...], balance:Zahl }, beides in
// natuerlicher Konvention (positiv = Anhebung am Ohr) und fertig berechnet:
//   - EQ-Schalter-Gate: bei plEqOn aus sind alle eq[] = 0 und balance = 0
//     (Weg A: der EQ-Schalter ist Master-Bypass fuer ALLES).
//   - plNHSim ("Simulation fuer Normalhoerende") spiegelt EQ UND Balance
//     (zeigt die Fehleinstellung statt der Korrektur, also invertiert).
// Klang, Graph, Ausdruck und System-EQ-Export lesen NUR hier; keiner
// rechnet eigene EQ-/Balance-Logik.
function getPlayerCorrection(side, applyNhSim) {
  if (applyNhSim === undefined) applyNhSim = true;   // BA 315: Ausdruck ruft mit false
  const eqRaw = withSide(side, computeGains);   // computeGains-Konvention (negierte Korrektur)
  if (!plEqOn) {
    return { eq: eqRaw.map(function () { return 0; }), balance: 0 };
  }
  const nhSim = applyNhSim && document.getElementById("plNHSim").checked;
  // Normal: -eqRaw (= Korrektur, Anhebung). nhSim: +eqRaw (Fehleinstellung).
  let eq = eqRaw.map(function (v) { return nhSim ? v : -v; });
  // BA 316: gemeinsame Absenkung. Derselbe Offset (ueber beide Seiten)
  // wird in BEIDEN Modi abgezogen — im nhSim ist das die Spiegelung um
  // die Absenkungslinie. Die fast stumme Elektrode wird mit-abgesenkt,
  // bestimmt den Offset aber nicht mit (siehe _eqHeadroomOffset).
  // BA 319: bei "Beide Seiten beruecksichtigen" aus den Betrag nur aus
  // dieser Seite bestimmen (CI unabhaengig).
  const off = _eqHeadroomOffset(side);
  if (off) eq = eq.map(function (v) { return v - off; });
  // BA 319: ist die Absenkung seitenweise (Headroom an, Beide-Seiten aus),
  // wird die Stereo-Balance ausgesetzt (binaurale Balance ist kein Ziel).
  const balSuppressed = plEqHeadroom && !plEqHeadroomBoth;
  const balG = getPlayerBalanceGains();          // {left,right} dB, 0 wenn plApplyBalance aus
  const bRaw = balSuppressed ? 0 : ((side === "right") ? balG.right : balG.left);
  const balance = nhSim ? -bRaw : bRaw;
  return { eq: eq, balance: balance };
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
      pSetPlaybackMode("music");
      // BA260: hochgeladene Datei als Musik-Provider-Item registrieren,
      // damit sie in der Bibliotheks-Liste erscheint und vom Filtering
      // erfasst wird.
      if (typeof amMusicLocalSetFile === "function") {
        const it = amMusicLocalSetFile(f);
        if (it && typeof plMusicSelectedId !== "undefined") plMusicSelectedId = it.id;
        if (typeof plMusicRefreshUI === "function") plMusicRefreshUI();
      }
      if (typeof plUpdDisplay === "function") plUpdDisplay();
      if (typeof plUpdTransportUI === "function") plUpdTransportUI();
      pBuildEQ();
      pDrawEQ();
      document.getElementById("plEqViz").style.display = "";
    } catch (err) {
      alert("Error: " + err.message);
    }
  });

// BA 306: Die Mono-Misch-Checkbox ist nur bedienbar, wenn "Beide Seiten"
// aktiv ist (sonst spielt ohnehin nur das aktive Ohr in Mono). Bei
// deaktiviertem "Beide Seiten" wird sie ausgegraut.
function plUpdMonoBox() {
  const both = document.getElementById("plBothSides");
  const mono = document.getElementById("plMonoEQ");
  if (!both || !mono) return;
  const on = !!both.checked;
  mono.disabled = !on;
  const lbl = mono.closest("label");
  if (lbl) lbl.style.opacity = on ? "" : "0.4";
}

// BA 316: Checkbox-Zustand und Sichtbarkeit der Erklaer-Zeile synchronisieren.
function plUpdHeadroomBox() {
  const cb = document.getElementById("plEqHeadroom");
  if (cb) {
    cb.checked = !!plEqHeadroom;
    const info = document.getElementById("plEqHeadroomInfo");
    if (info) info.classList.toggle("hidden", !plEqHeadroom);
  }
  // BA 319: untergeordnete Checkbox "Beide Seiten beruecksichtigen".
  // Ausgegraut, wenn "Uebersteuern vermeiden" aus ist. Erklaer-Zeile
  // sichtbar, wenn beide Haekchen gesetzt sind.
  const cb2 = document.getElementById("plEqHeadroomBoth");
  if (cb2) {
    cb2.checked = !!plEqHeadroomBoth;
    cb2.disabled = !plEqHeadroom;
    const lbl2 = cb2.closest("label");
    if (lbl2) lbl2.style.opacity = plEqHeadroom ? "" : "0.4";
    const info2 = document.getElementById("plEqHeadroomBothInfo");
    if (info2) info2.classList.toggle("hidden", !(plEqHeadroom && plEqHeadroomBoth));
  }
}

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
    if (wasPlaying) pPlay();
  }
  if (typeof plUpdMonoBox === "function") plUpdMonoBox();
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

// BA 306: Entscheidet, ob die getrennten Links/Rechts-EQ-Ketten
// (pChannelSplitter -> pEqFLeft/pEqFRight -> pChannelMerger) gebaut und
// genutzt werden. Gilt fuer "both" (echtes Stereo) UND "mono"
// (Mono-Inhalt, aber weiterhin getrennte Seiten-Korrektur pro Ohr).
function _pUseSplitChains(mode) {
  if (!pSourceBuf) return false;
  if (mode === "mono") return true;
  return mode === "both" && pSourceBuf.numberOfChannels > 1;
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
  pMonoBalGain && pMonoBalGain.disconnect();
  pMonoBalGain = null;
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
  const nhSim = document.getElementById("plNHSim").checked;
  if (_pUseSplitChains(mode)) {
    const corrL = getPlayerCorrection("left");
    const corrR = getPlayerCorrection("right");
    pChannelSplitter = c.createChannelSplitter(2);
    pChannelMerger = c.createChannelMerger(2);
    for (let i = 0; i < nEl; i++) {
      const lf = c.createBiquadFilter();
      lf.type = "peaking";
      lf.frequency.value = nhSim
        ? effFreqDisplay(i, "left")
        : withSide("left", () => effFreq(i));
      lf.Q.value = pCompQ(i);
      lf.gain.value = corrL.eq[i];
      pEqFLeft.push(lf);
      const rf = c.createBiquadFilter();
      rf.type = "peaking";
      rf.frequency.value = nhSim
        ? effFreqDisplay(i, "right")
        : withSide("right", () => effFreq(i));
      rf.Q.value = pCompQ(i);
      rf.gain.value = corrR.eq[i];
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
    pChannelLeftGain.gain.value = dB2G(corrL.balance);
    pChannelRightGain.gain.value = dB2G(corrR.balance);
    pEqFLeft[pEqFLeft.length - 1].connect(pChannelLeftGain);
    pEqFRight[pEqFRight.length - 1].connect(pChannelRightGain);
    pChannelLeftGain.connect(pChannelMerger, 0, 0);
    pChannelRightGain.connect(pChannelMerger, 0, 1);
    pEqF.push(pChannelMerger);
  } else {
    const corrSide = (mode === "left" || mode === "right") ? mode : activeSide;
    const corr = getPlayerCorrection(corrSide);
    for (let i = 0; i < nEl; i++) {
      const f = c.createBiquadFilter();
      f.type = "peaking";
      f.frequency.value = nhSim ? effFreqDisplay(i) : effFreq(i);
      f.Q.value = pCompQ(i);
      f.gain.value = corr.eq[i];
      pEqF.push(f);
    }
    for (let i = 0; i < pEqF.length - 1; i++) pEqF[i].connect(pEqF[i + 1]);
    if (pEqF.length > 0) {
      pMonoBalGain = c.createGain();
      pMonoBalGain.gain.value = dB2G(corr.balance);
      pEqF[pEqF.length - 1].connect(pMonoBalGain);
    }
  }
}

function pUpdEQ() {
  const mode = getPlayerSide();
  if (mode === "both" || mode === "mono") {
    const corrL = getPlayerCorrection("left");
    const corrR = getPlayerCorrection("right");
    for (let i = 0; i < pEqFLeft.length; i++) {
      pEqFLeft[i].gain.value = corrL.eq[i] || 0;
    }
    for (let i = 0; i < pEqFRight.length; i++) {
      pEqFRight[i].gain.value = corrR.eq[i] || 0;
    }
    if (pChannelLeftGain) pChannelLeftGain.gain.value = dB2G(corrL.balance);
    if (pChannelRightGain) pChannelRightGain.gain.value = dB2G(corrR.balance);
  } else {
    const corr = getPlayerCorrection(mode === "right" ? "right" : "left");
    for (let i = 0; i < pEqF.length; i++) {
      pEqF[i].gain.value = corr.eq[i] || 0;
    }
    if (pMonoBalGain) pMonoBalGain.gain.value = dB2G(corr.balance);
  }
  pDrawEQ();
  if (typeof _audiologUpdWarn === "function") _audiologUpdWarn();
}

function pToggle() {
  if (pCtx && pCtx.state === "suspended") pCtx.resume();
  // Wenn Sätze laufen: stoppen, in Datei-Modus wechseln, Datei starten.
  // Ein Klick reicht (vorher waren zwei nötig).
  if (typeof sActive !== "undefined" && sActive
      && typeof sStop === "function") {
    sStop();
    if (!pFileBuf) return;          // keine Datei geladen → nichts zu spielen
    pSetPlaybackMode("music");
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

  // Wenn Warp aktiv ist und ein Compute läuft (oder wartet): auf das
  // Ergebnis warten, sonst startet die Wiedergabe (z.B. via Auto-Advance
  // oder Buffer-Wechsel) ungewarpt. Bedingung über pWarpComputingPromise
  // statt pWarpBusy — deckt auch die Übergangsphase zwischen abgebrochenem
  // und neu gestartetem Trigger ab.
  if (typeof pWarpOn !== "undefined" && pWarpOn && plEqOn
      && pWarpComputingPromise) {
    try { await pWarpComputingPromise; } catch (e) {}
    if (gen !== pPlayGen) return;
  }

  const c = gPC();
  pBuf = getPlaybackBuffer();

  const mode = getPlayerSide();
  const stereoMode = _pUseSplitChains(mode) && pChannelSplitter;
  const firstNode = stereoMode
    ? pChannelSplitter
    : pEqF.length > 0
      ? pEqF[0]
      : pGain;
  const lastEq = stereoMode
    ? pChannelMerger
    : pMonoBalGain
      ? pMonoBalGain
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
  // Loop wird NICHT via pSrc.loop realisiert, sondern via onended-Restart mit
  // plPauseMs-Pause — sonst wird die eingestellte Pause ignoriert und ein
  // Loop-Abschalten würde erst nach dem aktuellen Source-Ende greifen.
  pSrc = c.createBufferSource();
  pSrc.buffer = pBuf;
  pSrc.connect(firstNode);
  pSrc.start(0, pOff);
  leadSrc = pSrc;

  if (leadSrc) {
    leadSrc.onended = function () {
      if (!pPlaying) return;
      pPlaying = false;
      pOff = 0;
      pUpdBtn();
      pUpdTL();

      // Sätze haben einen eigenen Handler (sentences.js) mit eigener
      // Loop-/Auto-Advance-/Stop-Logik.
      if (typeof sActive !== "undefined" && sActive
          && typeof sOnEnded === "function") {
        sOnEnded();
        return;
      }

      const ms = (typeof plPauseMs !== "undefined") ? plPauseMs : 0;

      // Loop hat Vorrang vor Auto-Advance: gleiches Stück nach Pause nochmal.
      if (typeof plLoop !== "undefined" && plLoop) {
        setTimeout(function () {
          if (!plLoop) return;  // wurde während der Pause ausgeschaltet
          if (typeof pPlay === "function") pPlay();
        }, ms);
        return;
      }

      // Auto-Advance einheitlich ueber Kategorie-Adapter (BA325 Lauf 2).
      // Sequenz-Ende-Stopp und Shuffle-Logik sind in den named functions
      // _plMusicAutoAdvance/_plNoiseAutoAdvance/_plBookAutoAdvance gekapselt.
      const cat = plCurrentCategory();
      if (cat && plAutoAdvance) cat.autoAdvance();
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
  if (pEqF.length > 0) pUpdEQ();
  else {
    pDrawEQ();
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
  // BA 313: gleiche Wertquelle wie der Klang. Balken = EQ + flache Balance
  // der angezeigten Seite (reine Addition gelieferter Werte).
  const corr = getPlayerCorrection(activeSide);
  const gains = corr.eq.map(function (v) { return v + corr.balance; });
  const allE = allEl();
  const act = new Set(actEl());
  let mxA = 1;
  for (const i of allE) {
    if (!act.has(i)) continue;
    const g = Math.abs(gains[i]);
    if (g > mxA) mxA = g;
  }
  mxA = Math.ceil(mxA / 2) * 2 + 2;
  const pad = { left: 40, right: 14, top: 14, bottom: 22 },
    pW = W - pad.left - pad.right,
    pH = H - pad.top - pad.bottom,
    zY = pad.top + pH / 2;
  const axis = buildCentAxis(allE, pad.left, pW, function (i) {
    return effFreqDisplay(i);
  });
  const bW = Math.max(5, Math.min((axis.minDx || 12) * 0.6, 22));
  const _hm = Math.ceil(bW / 2) + 2;
  const _cMin = Math.min.apply(null, axis.centArr);
  const _cSpan = (Math.max.apply(null, axis.centArr) - _cMin) || 1;
  const tX = function(j) {
    return pad.left + _hm + ((axis.centArr[j] - _cMin) / _cSpan) * (pW - _hm);
  };
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
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "9px Consolas,monospace";
    ctx.textAlign = "right";
    ctx.fillText("+" + dB.toFixed(0), pad.left - 4, zY - yO + 3);
    ctx.fillText("-" + dB.toFixed(0), pad.left - 4, zY + yO + 3);
    ctx.setLineDash([2, 4]);
  }
  ctx.setLineDash([]);
  ctx.fillStyle = "#1a1a1a";
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
    // BA 313: gains[] ist EQ + Balance aus getPlayerCorrection; bei EQ aus alles 0.
    let ag = isAct ? gains[i] : 0;
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
    ctx.fillStyle = isAct ? "#1a1a1a" : "#bbb";
    ctx.font = "11px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    const lbl = dENPrefix() + dEN(i);
    ctx.fillText(lbl, cx, H - pad.bottom + 15);
    const halfDx = Math.max(8, (axis.minDx || 12) / 2);
    cv._axisHits.push({
      x0: cx - halfDx, x1: cx + halfDx,
      y0: H - pad.bottom + 2, y1: H,
      label: lbl,
      hz: axis.hzArr[j],
      hzDec: 1,
      db: ag,
    });
  }
  _attachAxisTooltip(cv);
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

let _plNoisePrevId = null;     // BA258: 1x-Memory fuer Zufall-Zurueck

function plNoiseHasPrevMemory() {
  return !!_plNoisePrevId;
}

let _plBookPrevChIdx = null;   // BA258: 1x-Memory fuer Zufall-Zurueck bei Hoerbuechern

function plBookHasPrevMemory() {
  return _plBookPrevChIdx != null;
}

function _plNoiseStep(delta) {
  const sorted = plNoiseVisibleItems();
  if (sorted.length === 0) return;
  const idx = sorted.findIndex(function (x) { return x.id === plNoiseSelectedId; });

  let nextItem = null;
  const useRandom = (typeof plShuffle !== "undefined" && plShuffle);

  if (useRandom) {
    if (delta < 0) {
      // Zurueck: Memory verbrauchen, falls vorhanden.
      if (_plNoisePrevId) {
        nextItem = sorted.find(function (x) { return x.id === _plNoisePrevId; });
        _plNoisePrevId = null;
      }
      if (!nextItem) return;
    } else {
      // Vorwaerts: zufaelliges anderes Item.
      if (sorted.length === 1) { nextItem = sorted[0]; }
      else {
        let pick;
        do {
          pick = sorted[Math.floor(Math.random() * sorted.length)];
        } while (pick.id === plNoiseSelectedId);
        nextItem = pick;
      }
      _plNoisePrevId = plNoiseSelectedId;
    }
  } else {
    // Sequenz mit Wrap-around.
    const base = (idx < 0) ? 0 : idx;
    const n = sorted.length;
    const nextIdx = ((base + delta) % n + n) % n;
    nextItem = sorted[nextIdx];
  }
  if (!nextItem) return;

  plNoiseSelectedId = nextItem.id;
  const sel = document.getElementById("plNoiseItemSel");
  if (sel) sel.value = nextItem.id;
  if (typeof pPause === "function" && pPlaying) pPause();
  plNoiseLoadSelected().then(function () {
    // BA259: Prev/Next loesen immer Play aus; pOff=0 damit neues Stueck von vorn startet.
    pOff = 0;
    if (typeof pPlay === "function") pPlay();
  });
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
}

// ============================================================
// BA324: Kategorie-Adapter (Lauf 1 — 3A)
// plCategories[key] kapselt Prev/Next/hasNext/hasPrev/autoAdvance/
// onActivate/onDeactivate je Quelle. plCurrentCategory() liefert den
// aktiven Adapter. Die Auto-Advance-Logik aus pPlay-onended wird hier
// als named functions referenziert; die Original-Inline-Bloecke in
// pPlay-onended bleiben bis Lauf 2 unveraendert.
// ============================================================

// --- named autoAdvance-Extrakte (herauskopiert, Originale noch vorhanden) ---

function _plMusicAutoAdvance() {
  if (plActiveSource !== "music") return;
  const ms = (typeof plPauseMs !== "undefined") ? plPauseMs : 0;
  const visible = (typeof plMusicVisibleItems === "function") ? plMusicVisibleItems() : [];
  if (visible.length === 0) return;
  const useRandom = (typeof plShuffle !== "undefined" && plShuffle);
  let nextItem = null;
  if (useRandom) {
    if (visible.length === 1) { nextItem = visible[0]; }
    else {
      let pick;
      do {
        pick = visible[Math.floor(Math.random() * visible.length)];
      } while (pick.id === plMusicSelectedId);
      nextItem = pick;
    }
    _plMusicPrevId = plMusicSelectedId;
  } else {
    const idx = visible.findIndex(function (x) { return x.id === plMusicSelectedId; });
    if (idx >= 0 && idx < visible.length - 1) {
      nextItem = visible[idx + 1];
    }
    // Sequenzende: kein Schritt mehr.
  }
  if (!nextItem) return;
  setTimeout(function () {
    if (!plAutoAdvance || plLoop) return;
    if (plActiveSource !== "music") return;
    plMusicSelectedId = nextItem.id;
    const sel = document.getElementById("plMusicItemSel");
    if (sel) sel.value = nextItem.id;
    plMusicLoadSelected().then(function () {
      if (typeof pPlay === "function") pPlay();
    });
  }, ms);
}

function _plNoiseAutoAdvance() {
  if (plActiveSource !== "noise") return;
  const ms = (typeof plPauseMs !== "undefined") ? plPauseMs : 0;
  const sorted = plNoiseVisibleItems();
  if (sorted.length === 0) return;
  const idx = sorted.findIndex(function (x) { return x.id === plNoiseSelectedId; });
  const useRandom = (typeof plShuffle !== "undefined" && plShuffle);
  let next;
  if (useRandom) {
    if (sorted.length === 1) { next = sorted[0]; }
    else {
      let pick;
      do {
        pick = sorted[Math.floor(Math.random() * sorted.length)];
      } while (pick.id === plNoiseSelectedId);
      next = pick;
    }
    _plNoisePrevId = plNoiseSelectedId;
  } else {
    // Sequenzende: nur weiter wenn nicht letztes Item.
    if (idx >= 0 && idx < sorted.length - 1) {
      next = sorted[idx + 1];
    }
  }
  if (!next) return;
  setTimeout(function () {
    if (!plAutoAdvance || plLoop) return;
    if (plActiveSource !== "noise") return;
    plNoiseSelectedId = next.id;
    const sel = document.getElementById("plNoiseItemSel");
    if (sel) sel.value = next.id;
    plNoiseLoadSelected().then(function () {
      if (typeof pPlay === "function") pPlay();
    });
  }, ms);
}

function _plBookAutoAdvance() {
  if (plActiveSource !== "audiobook") return;
  const ms = (typeof plPauseMs !== "undefined") ? plPauseMs : 0;
  const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
  if (!col || !Array.isArray(col.items) || col.items.length === 0) return;
  const useRandom = (typeof plShuffle !== "undefined" && plShuffle);
  let next;
  if (useRandom) {
    if (col.items.length === 1) { next = 0; }
    else {
      let pick;
      do {
        pick = Math.floor(Math.random() * col.items.length);
      } while (pick === plBookChapterIdx);
      next = pick;
    }
  } else {
    next = plBookChapterIdx + 1;
    if (next >= col.items.length) next = -1;  // Buchende: still anhalten
  }
  if (next < 0) return;
  setTimeout(function () {
    if (!plAutoAdvance || plLoop) return;
    if (plActiveSource !== "audiobook") return;
    if (typeof plBookSavePosition === "function") plBookSavePosition();
    if (useRandom) _plBookPrevChIdx = plBookChapterIdx;
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

// --- Adapter-Objekte ---

const plCategories = {
  music: {
    hasPrev: function () {
      const visible = (typeof plMusicVisibleItems === "function") ? plMusicVisibleItems() : [];
      if (visible.length === 0) return false;
      if (typeof plShuffle !== "undefined" && plShuffle) {
        return (typeof plMusicHasPrevMemory === "function") ? plMusicHasPrevMemory() : false;
      }
      const idx = visible.findIndex(function (x) { return x.id === plMusicSelectedId; });
      return idx > 0;
    },
    hasNext: function () {
      const visible = (typeof plMusicVisibleItems === "function") ? plMusicVisibleItems() : [];
      if (visible.length === 0) return false;
      if (typeof plShuffle !== "undefined" && plShuffle) {
        return visible.length > 1;
      }
      const idx = visible.findIndex(function (x) { return x.id === plMusicSelectedId; });
      return idx >= 0 && idx < visible.length - 1;
    },
    prev: function () { _plMusicStep(-1); },
    next: function () { _plMusicStep(+1); },
    autoAdvance: function () { _plMusicAutoAdvance(); },
    onActivate: function () {
      pSetPlaybackMode("music");
      if (typeof plMusicRefreshUI === "function") plMusicRefreshUI();
      if (plMusicSelectedId && typeof plMusicLoadSelected === "function") plMusicLoadSelected();
    },
    onDeactivate: function () {}
  },

  sentences: {
    hasPrev: function () {
      const has = (typeof sHasItems === "function") ? sHasItems() : false;
      if (!has) return false;
      if (typeof plShuffle !== "undefined" && plShuffle) {
        return (typeof sHasPrevMemory === "function") ? sHasPrevMemory() : false;
      }
      return has;
    },
    hasNext: function () {
      return (typeof sHasItems === "function") ? sHasItems() : false;
    },
    prev: function () { if (typeof sPrev === "function") sPrev(); },
    next: function () { if (typeof sNext === "function") sNext(); },
    autoAdvance: function () { /* sOnEnded steuert selbst; No-Op */ },
    onActivate: function () {
      pSetPlaybackMode("sentences");
      if (typeof sUpdateUI === "function") sUpdateUI();
    },
    onDeactivate: function () {
      if (typeof sActive !== "undefined" && sActive && typeof sStop === "function") sStop();
    }
  },

  noise: {
    hasPrev: function () {
      const sorted = plNoiseVisibleItems();
      if (sorted.length === 0) return false;
      if (typeof plShuffle !== "undefined" && plShuffle) {
        return (typeof plNoiseHasPrevMemory === "function") ? plNoiseHasPrevMemory() : false;
      }
      const idx = sorted.findIndex(function (x) { return x.id === plNoiseSelectedId; });
      return idx > 0;
    },
    hasNext: function () {
      const sorted = plNoiseVisibleItems();
      if (sorted.length === 0) return false;
      if (typeof plShuffle !== "undefined" && plShuffle) {
        return sorted.length > 1;
      }
      const idx = sorted.findIndex(function (x) { return x.id === plNoiseSelectedId; });
      return idx >= 0 && idx < sorted.length - 1;
    },
    prev: function () { _plNoiseStep(-1); },
    next: function () { _plNoiseStep(+1); },
    autoAdvance: function () { _plNoiseAutoAdvance(); },
    onActivate: function () {
      if (typeof plNoiseRefreshUI === "function") plNoiseRefreshUI();
      if (typeof plNoiseLoadSelected === "function") plNoiseLoadSelected();
    },
    onDeactivate: function () {}
  },

  audiobook: {
    hasPrev: function () {
      const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
      if (!col || !col.items || col.items.length === 0) return false;
      if (typeof plShuffle !== "undefined" && plShuffle) {
        return (typeof plBookHasPrevMemory === "function") ? plBookHasPrevMemory() : false;
      }
      return plBookChapterIdx > 0;
    },
    hasNext: function () {
      const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
      if (!col || !col.items || col.items.length === 0) return false;
      if (typeof plShuffle !== "undefined" && plShuffle) {
        return col.items.length > 1;
      }
      return plBookChapterIdx < col.items.length - 1;
    },
    prev: function () {
      const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
      if (!col || !col.items) return;
      if (typeof plBookSavePosition === "function") plBookSavePosition();
      const useRandom = (typeof plShuffle !== "undefined" && plShuffle);
      if (useRandom) {
        if (_plBookPrevChIdx == null) return;
        plBookChapterIdx = _plBookPrevChIdx;
        _plBookPrevChIdx = null;
      } else {
        plBookChapterIdx = Math.max(0, plBookChapterIdx - 1);
      }
      const sel = document.getElementById("plBookChSel");
      if (sel) sel.value = String(plBookChapterIdx);
      if (typeof pPause === "function" && pPlaying) pPause();
      if (typeof plBookLoadSelected === "function") {
        plBookLoadSelected().then(function () {
          // BA259: Prev loest immer Play aus; pOff=0 damit neues Kapitel von vorn startet.
          pOff = 0;
          if (typeof pPlay === "function") pPlay();
        });
      }
      if (typeof plUpdTransportUI === "function") plUpdTransportUI();
    },
    next: function () {
      const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
      if (!col || !col.items) return;
      if (typeof plBookSavePosition === "function") plBookSavePosition();
      const useRandom = (typeof plShuffle !== "undefined" && plShuffle);
      if (useRandom) {
        if (col.items.length > 1) {
          _plBookPrevChIdx = plBookChapterIdx;
          let pick;
          do {
            pick = Math.floor(Math.random() * col.items.length);
          } while (pick === plBookChapterIdx);
          plBookChapterIdx = pick;
        }
      } else {
        plBookChapterIdx = Math.min(col.items.length - 1, plBookChapterIdx + 1);
      }
      const sel = document.getElementById("plBookChSel");
      if (sel) sel.value = String(plBookChapterIdx);
      if (typeof pPause === "function" && pPlaying) pPause();
      if (typeof plBookLoadSelected === "function") {
        plBookLoadSelected().then(function () {
          // BA259: Next loest immer Play aus; pOff=0 damit neues Kapitel von vorn startet.
          pOff = 0;
          if (typeof pPlay === "function") pPlay();
        });
      }
      if (typeof plUpdTransportUI === "function") plUpdTransportUI();
    },
    autoAdvance: function () { _plBookAutoAdvance(); },
    onActivate: function () {
      if (typeof plBookRefreshUI === "function") plBookRefreshUI();
      if (plBookSelectedId && typeof plBookLoadSelected === "function") plBookLoadSelected();
    },
    onDeactivate: function () {
      if (typeof plBookSavePosition === "function") plBookSavePosition();
    }
  }
};

function plCurrentCategory() {
  return plCategories[plActiveSource] || null;
}

// ============================================================
// END BA324: Kategorie-Adapter
// ============================================================

function plPrev() {
  const c = plCurrentCategory();
  if (c && c.hasPrev()) c.prev();
}

function plNext() {
  const c = plCurrentCategory();
  if (c && c.hasNext()) c.next();
}

function plToggleLoop() {
  plLoop = !plLoop;
  plUpdTransportUI();
}

function plToggleShuffle() {
  plShuffle = !plShuffle;
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
  const old = plCurrentCategory();
  if (old) old.onDeactivate();
  plStopAll();
  plActiveSource = src;
  plUpdSourceUI();
  plUpdTransportUI();
  const nu = plCurrentCategory();
  if (nu) nu.onActivate();
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
  const shBtn = document.getElementById("plShuffleBtn");
  if (shBtn) {
    shBtn.classList.toggle("active", plShuffle);
    shBtn.style.background = plShuffle ? "var(--accent, #6aa84f)" : "";
    shBtn.style.color      = plShuffle ? "#fff" : "";
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

  // hasNext/hasPrev kommen jetzt einheitlich vom Kategorie-Adapter.
  // Cursor-basiert: am Listen-/Werk-Ende false → Knopf wird ausgegraut.
  const c = plCurrentCategory();
  const hasNext = c ? c.hasNext() : false;
  const hasPrev = c ? c.hasPrev() : false;

  if (nextBtn) {
    nextBtn.disabled = !hasNext;
    nextBtn.style.opacity = hasNext ? "1" : "0.5";
    nextBtn.style.cursor  = hasNext ? "pointer" : "not-allowed";
  }
  if (prevBtn) {
    prevBtn.disabled = !hasPrev;
    prevBtn.style.opacity = hasPrev ? "1" : "0.5";
    prevBtn.style.cursor  = hasPrev ? "pointer" : "not-allowed";
  }
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
    const it = (typeof plMusicCurrentItem === "function") ? plMusicCurrentItem() : null;
    if (it) {
      const artist = (it.tags && it.tags.artist) || "";
      titleText = artist
        ? (artist + " — " + (it.title || it.id))
        : (it.title || it.id);
      const parts = [];
      if (it.tags && it.tags.album)  parts.push(it.tags.album);
      if (it.tags && Array.isArray(it.tags.genres) && it.tags.genres.length)
        parts.push(it.tags.genres.join(", "));
      if (it.tags && it.tags.year)   parts.push(String(it.tags.year));
      if (it.license)     parts.push(it.license);
      if (it.sourceTitle) parts.push(it.sourceTitle);
      metaParts = parts;
    } else {
      // Fallback: noch kein Provider-Item — vielleicht direkt File-Upload
      // ohne Provider-Registrierung (sollte mit BA260 nicht mehr vorkommen,
      // aber als Safety-Net behalten).
      const fi = document.getElementById("plAudio");
      const fname = (fi && fi.files && fi.files[0]) ? fi.files[0].name : "";
      titleText = fname || ((typeof t === "function") ? t("plDispEmpty") : "Nichts geladen");
    }
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
document.getElementById("plShuffleBtn").addEventListener("click", plToggleShuffle);
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

// BA262: Filter-Helfer fuer Geraeusche
function _plNoiseSearchMatch(it, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  const fields = [
    it.title || "",
    (it.tags && it.tags.kind) || "",
    (it.tags && it.tags.spectrum) || "",
    it.sourceTitle || ""
  ];
  for (const f of fields) {
    if (f && f.toLowerCase().indexOf(s) >= 0) return true;
  }
  return false;
}

function plNoiseAllItems() {
  return (typeof amCollectItems === "function") ? amCollectItems("geraeusche") : [];
}

function plNoiseVisibleItems() {
  const all = plNoiseAllItems();
  const filtered = all.filter(function (it) {
    if (!amItemMatchesCategory("geraeusche", plNoiseSortAxis, plNoiseCategory, it)) return false;
    return _plNoiseSearchMatch(it, plNoiseSearchQuery);
  });
  return amSortItems(filtered, "geraeusche", plNoiseSortAxis);
}

function plNoiseRefreshUI() {
  const sortSel = document.getElementById("plNoiseSortSel");
  const catSel  = document.getElementById("plNoiseCatSel");
  const itemSel = document.getElementById("plNoiseItemSel");
  const search  = document.getElementById("plNoiseSearchInput");
  const empty   = document.getElementById("plNoiseEmpty");
  if (!sortSel || !catSel || !itemSel) return;

  // Sortier-Achsen-Dropdown
  const axes = (typeof amSortAxesFor === "function") ? amSortAxesFor("geraeusche") : [];
  if (sortSel.options.length === 0) {
    for (const a of axes) {
      const opt = document.createElement("option");
      opt.value = a.key;
      opt.textContent = (typeof t === "function") ? t(a.labelKey) : a.labelDefault;
      sortSel.appendChild(opt);
    }
    sortSel.value = plNoiseSortAxis;
  } else {
    for (let i = 0; i < sortSel.options.length; i++) {
      const opt = sortSel.options[i];
      const a = axes.find(function (x) { return x.key === opt.value; });
      if (a) opt.textContent = (typeof t === "function") ? t(a.labelKey) : a.labelDefault;
    }
  }

  // Kategorie-Dropdown (abhaengig von Achse)
  const all = plNoiseAllItems();
  const buckets = amBucketsForAxis("geraeusche", plNoiseSortAxis, all);
  while (catSel.firstChild) catSel.removeChild(catSel.firstChild);
  const optAll = document.createElement("option");
  optAll.value = "_all";
  optAll.textContent = (typeof t === "function") ? t("plNoiseCatAll") : "(alle)";
  catSel.appendChild(optAll);
  for (const b of buckets) {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b;
    catSel.appendChild(opt);
  }
  if (buckets.indexOf(plNoiseCategory) >= 0 || plNoiseCategory === "_all") {
    catSel.value = plNoiseCategory;
  } else {
    catSel.value = "_all";
    plNoiseCategory = "_all";
  }
  catSel.disabled = (buckets.length === 0);
  catSel.style.opacity = catSel.disabled ? "0.5" : "1";

  // Suchfeld
  if (search && document.activeElement !== search) search.value = plNoiseSearchQuery || "";

  // Item-Dropdown aus gefilterter Sicht
  const visible = plNoiseVisibleItems();
  while (itemSel.firstChild) itemSel.removeChild(itemSel.firstChild);
  for (const it of visible) {
    const opt = document.createElement("option");
    opt.value = it.id;
    opt.textContent = it.title || it.id;
    itemSel.appendChild(opt);
  }
  if (visible.length === 0) {
    if (empty) empty.style.display = "";
    itemSel.disabled = true;
  } else {
    if (empty) empty.style.display = "none";
    itemSel.disabled = false;
    const has = visible.some(function (x) { return x.id === plNoiseSelectedId; });
    if (!has) {
      plNoiseSelectedId = visible[0].id;
    }
    itemSel.value = plNoiseSelectedId;
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
  if (typeof plUpdDisplay     === "function") plUpdDisplay();
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
  pBuildEQ();
  pDrawEQ();
  document.getElementById("plEqViz").style.display = "";
}

const _plNSortEl = document.getElementById("plNoiseSortSel");
const _plNCatEl  = document.getElementById("plNoiseCatSel");
const _plNItemEl = document.getElementById("plNoiseItemSel");
const _plNSearchEl = document.getElementById("plNoiseSearchInput");
if (_plNSortEl) {
  _plNSortEl.addEventListener("change", function () {
    plNoiseSortAxis = _plNSortEl.value;
    plNoiseCategory = "_all";  // Achswechsel resettet Kategorie
    plNoiseRefreshUI();
  });
}
if (_plNCatEl) {
  _plNCatEl.addEventListener("change", function () {
    plNoiseCategory = _plNCatEl.value;
    plNoiseRefreshUI();
  });
}
if (_plNSearchEl) {
  _plNSearchEl.addEventListener("input", function () {
    plNoiseSearchQuery = _plNSearchEl.value || "";
    plNoiseRefreshUI();
  });
}
if (_plNItemEl) {
  _plNItemEl.addEventListener("change", function () {
    plNoiseSelectedId = _plNItemEl.value;
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

// ============================================================
// BA260: Musik-Bibliothek (UI + Wiedergabe-Anbindung)
// ============================================================

let _plMusicPrevId = null;          // BA258-Memory-Helfer

function plMusicHasPrevMemory() {
  return !!_plMusicPrevId;
}

function plMusicAllItems() {
  return (typeof amCollectItems === "function") ? amCollectItems("musik") : [];
}

function _plMusicSearchMatch(it, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  const fields = [
    it.title || "",
    (it.tags && it.tags.artist) || "",
    (it.tags && it.tags.album)  || "",
    it.sourceTitle || ""
  ];
  for (const f of fields) {
    if (f && f.toLowerCase().indexOf(s) >= 0) return true;
  }
  return false;
}

// Liefert die gefilterte und sortierte Track-Liste fuer die aktuelle UI-Sicht.
function plMusicVisibleItems() {
  const all = plMusicAllItems();
  const filtered = all.filter(function (it) {
    if (!amItemMatchesCategory("musik", plMusicSortAxis, plMusicCategory, it)) return false;
    return _plMusicSearchMatch(it, plMusicSearchQuery);
  });
  return amSortItems(filtered, "musik", plMusicSortAxis);
}

function plMusicCurrentItem() {
  if (!plMusicSelectedId) return null;
  return plMusicAllItems().find(function (it) { return it.id === plMusicSelectedId; }) || null;
}

function _plMusicTrackLabel(it) {
  const artist = (it.tags && it.tags.artist) || "";
  if (artist) return artist + " — " + (it.title || it.id);
  return it.title || it.id;
}

function plMusicRefreshUI() {
  const sortSel = document.getElementById("plMusicSortSel");
  const catSel  = document.getElementById("plMusicCatSel");
  const itemSel = document.getElementById("plMusicItemSel");
  const search  = document.getElementById("plMusicSearchInput");
  const empty   = document.getElementById("plMusicEmpty");
  if (!sortSel || !catSel || !itemSel) return;

  // Sortier-Achsen-Dropdown
  const axes = (typeof amSortAxesFor === "function") ? amSortAxesFor("musik") : [];
  if (sortSel.options.length === 0) {
    for (const a of axes) {
      const opt = document.createElement("option");
      opt.value = a.key;
      opt.textContent = (typeof t === "function") ? t(a.labelKey) : a.labelDefault;
      sortSel.appendChild(opt);
    }
    sortSel.value = plMusicSortAxis;
  } else {
    for (let i = 0; i < sortSel.options.length; i++) {
      const opt = sortSel.options[i];
      const a = axes.find(function (x) { return x.key === opt.value; });
      if (a) opt.textContent = (typeof t === "function") ? t(a.labelKey) : a.labelDefault;
    }
  }

  // Kategorien-Dropdown (abhaengig von Achse)
  const all = plMusicAllItems();
  const buckets = amBucketsForAxis("musik", plMusicSortAxis, all);
  const prevCat = plMusicCategory;
  while (catSel.firstChild) catSel.removeChild(catSel.firstChild);
  const optAll = document.createElement("option");
  optAll.value = "_all";
  optAll.textContent = (typeof t === "function") ? t("plMusicCatAll") : "(alle)";
  catSel.appendChild(optAll);
  for (const b of buckets) {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b;
    catSel.appendChild(opt);
  }
  if (buckets.indexOf(prevCat) >= 0 || prevCat === "_all") {
    catSel.value = prevCat;
  } else {
    catSel.value = "_all";
    plMusicCategory = "_all";
  }
  // Achsen ohne sinnvolle Buckets: Kategorie ausgrauen.
  catSel.disabled = (buckets.length === 0);
  catSel.style.opacity = catSel.disabled ? "0.5" : "1";

  // Suchfeld
  if (search && document.activeElement !== search) search.value = plMusicSearchQuery || "";

  // Track-Dropdown
  const visible = plMusicVisibleItems();
  while (itemSel.firstChild) itemSel.removeChild(itemSel.firstChild);
  for (const it of visible) {
    const opt = document.createElement("option");
    opt.value = it.id;
    opt.textContent = _plMusicTrackLabel(it);
    itemSel.appendChild(opt);
  }
  if (visible.length === 0) {
    if (empty) empty.style.display = "";
    itemSel.disabled = true;
    plMusicSelectedId = null;
  } else {
    if (empty) empty.style.display = "none";
    itemSel.disabled = false;
    // bisherige Auswahl behalten, wenn moeglich
    const has = visible.some(function (x) { return x.id === plMusicSelectedId; });
    if (!has) {
      plMusicSelectedId = visible[0].id;
    }
    itemSel.value = plMusicSelectedId;
  }
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
  if (typeof plUpdDisplay === "function") plUpdDisplay();
}

// Laedt das aktuell ausgewaehlte Musik-Item in pFileBuf und ruft pBuildEQ.
// Lokaler Upload (audio === "local-music-file:...") nutzt das vorhandene
// File-Objekt; sonstige Items (Webspace, spaeter Ordner) per fetch.
async function plMusicLoadSelected() {
  const it = plMusicCurrentItem();
  if (!it) return;
  const c = gPC();
  try {
    let arrayBuf;
    if (typeof it.audio === "string" && it.audio.indexOf("local-music-file:") === 0) {
      const localItem = (typeof amMusicLocalCurrent === "function") ? amMusicLocalCurrent() : null;
      if (!localItem || !localItem._file) {
        console.warn("[player/musik] lokales File nicht mehr verfuegbar:", it.id);
        return;
      }
      arrayBuf = await localItem._file.arrayBuffer();
    } else if (typeof it.audio === "string" && it.audio.indexOf("local-music-folder:") === 0) {
      // BA261: Folder-Ref
      const f = (typeof amMusicResolveLocalFile === "function")
        ? amMusicResolveLocalFile(it.audio) : null;
      if (!f) {
        console.warn("[player/musik] Ordner-Datei nicht mehr verfuegbar:", it.audio);
        return;
      }
      arrayBuf = await f.arrayBuffer();
    } else if (/^(data:|https?:|blob:)/i.test(it.audio)) {
      const r = await fetch(it.audio, { mode: "cors" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      arrayBuf = await r.arrayBuffer();
    } else {
      throw new Error("Unbekanntes Audio-Format fuer Musik-Item: " + it.audio);
    }
    pFileBuf = await c.decodeAudioData(arrayBuf);
    pSetPlaybackMode("music");
    pOff = 0;
    pBuildEQ();
    pDrawEQ();
    document.getElementById("plEqViz").style.display = "";
    if (typeof plUpdDisplay     === "function") plUpdDisplay();
    if (typeof plUpdTransportUI === "function") plUpdTransportUI();
  } catch (err) {
    console.error("[player/musik] Laden fehlgeschlagen:", err);
  }
}

// Wahl im Item-Dropdown wechseln + ggf. abspielen
function plMusicSetSelected(id) {
  if (!id) return;
  plMusicSelectedId = id;
  plMusicLoadSelected();
}

function _plMusicStep(delta) {
  const visible = plMusicVisibleItems();
  if (visible.length === 0) return;
  const idx = visible.findIndex(function (x) { return x.id === plMusicSelectedId; });

  let nextItem = null;
  const useRandom = (typeof plShuffle !== "undefined" && plShuffle);

  if (useRandom) {
    if (delta < 0) {
      if (_plMusicPrevId) {
        nextItem = visible.find(function (x) { return x.id === _plMusicPrevId; });
        _plMusicPrevId = null;
      }
      if (!nextItem) return;
    } else {
      if (visible.length === 1) { nextItem = visible[0]; }
      else {
        let pick;
        do {
          pick = visible[Math.floor(Math.random() * visible.length)];
        } while (pick.id === plMusicSelectedId);
        nextItem = pick;
      }
      _plMusicPrevId = plMusicSelectedId;
    }
  } else {
    const nextIdx = (idx + delta + visible.length) % visible.length;
    nextItem = visible[nextIdx];
  }
  if (!nextItem) return;
  plMusicSelectedId = nextItem.id;
  const sel = document.getElementById("plMusicItemSel");
  if (sel) sel.value = nextItem.id;
  if (typeof pPause === "function" && pPlaying) pPause();
  plMusicLoadSelected().then(function () {
    // BA259: Prev/Next loesen immer Play aus.
    if (typeof pPlay === "function") pPlay();
  });
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
}

function plMusicRefreshLocalList() {
  const list = document.getElementById("plMusicLocalList");
  if (!list) return;
  list.innerHTML = "";
  const folders = (typeof amMusicListLocalFolders === "function")
    ? amMusicListLocalFolders() : [];
  if (folders.length === 0) {
    list.style.display = "";
    const span = document.createElement("span");
    span.style.color = "var(--text-muted)";
    span.textContent = (typeof t === "function") ? t("plMusicLocalNone") : "Keine lokalen Ordner geladen.";
    list.appendChild(span);
    return;
  }
  list.style.display = "";
  for (const coll of folders) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;padding:3px 0";
    const lbl = document.createElement("span");
    lbl.textContent = coll.label + "  (" + coll.items.length + ")";
    // BA323: Entfernen-Knopf entfällt — Ordner nur noch für die Laufzeit.
    row.appendChild(lbl);
    list.appendChild(row);
  }
}

// Event-Wiring (sobald DOM da ist; player.js laeuft eh nach DOMContentLoaded)
(function _plMusicWire() {
  const sortSel = document.getElementById("plMusicSortSel");
  const catSel  = document.getElementById("plMusicCatSel");
  const itemSel = document.getElementById("plMusicItemSel");
  const search  = document.getElementById("plMusicSearchInput");
  if (!sortSel || !catSel || !itemSel || !search) return;

  sortSel.addEventListener("change", function () {
    plMusicSortAxis = sortSel.value;
    plMusicCategory = "_all";  // Achswechsel resettet Kategorie
    plMusicRefreshUI();
  });
  catSel.addEventListener("change", function () {
    plMusicCategory = catSel.value;
    plMusicRefreshUI();
  });
  itemSel.addEventListener("change", function () {
    plMusicSetSelected(itemSel.value);
  });
  search.addEventListener("input", function () {
    plMusicSearchQuery = search.value || "";
    plMusicRefreshUI();
  });

  // BA261: Ordner-Upload
  const localAdd   = document.getElementById("plMusicLocalAddBtn");
  const localInput = document.getElementById("plMusicLocalInput");
  if (localAdd && localInput) {
    localAdd.addEventListener("click", function () {
      localInput.value = "";
      localInput.click();
    });
    localInput.addEventListener("change", async function (e) {
      try {
        const res = await amMusicIngestLocalFolder(e.target.files);
        if (res && res.cid) {
          const visible = plMusicVisibleItems();
          const firstOfFolder = visible.find(function (x) {
            return typeof x.audio === "string"
              && x.audio.indexOf("local-music-folder:" + res.cid + ":") === 0;
          });
          if (firstOfFolder) plMusicSelectedId = firstOfFolder.id;
        }
        plMusicRefreshLocalList();
        plMusicRefreshUI();
      } catch (err) {
        console.error("[player/musik] ingest folder failed:", err);
      }
    });
  }
  plMusicRefreshLocalList();
  plMusicRefreshUI();
})();

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
  // BA323: amRemoveLocalBookCollection entfällt — Sammlungen nur noch für die Laufzeit.

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
  pSetPlaybackMode("audiobook");

  // Gespeicherte Position ggf. wiederherstellen (überschreibt den
  // 0-Reset aus pSetPlaybackMode).
  const pos = (plBookPositions && plBookPositions[plBookSelectedId]) || null;
  if (pos && typeof pos.chapterIdx === "number" && pos.chapterIdx === plBookChapterIdx
      && typeof pos.posSeconds === "number" && pos.posSeconds > 0
      && pos.posSeconds < abuf.duration - 5) {
    pOff = pos.posSeconds;
    document.getElementById("plCur").textContent = pFmt(pOff);
    document.getElementById("plTL").value = (pOff / abuf.duration) * 1000;
  } else {
    pOff = 0;
  }

  if (typeof plUpdDisplay     === "function") plUpdDisplay();
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
  pBuildEQ();
  pDrawEQ();
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
// BA323: _plBookRmBtn-Handler entfernt — Entfernen-Knopf und amRemoveLocalBookCollection entfallen.
