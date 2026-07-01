// ============================================================
// PLAYER
// ============================================================
let pCtx = null,
  pBuf = null,
  pSourceBuf = null,
  pFileBuf = null,          // Audiodatei-Buffer (überlebt Sätze-Wiedergabe)
  pPlaybackMode = "musik",   // "musik" | "saetze" | "geraeusche" | "hoerbuecher" — aktive Kategorie (Buffer-Slot)
  pMonoBuf = null,
  pLeftOnlyBuf = null,
  pRightOnlyBuf = null,
  pSrc = null,
  pCurrentPlayback = null,   // { sources, stop() } für Variante B/A
  pPlayGen = 0,              // erhöht sich bei jedem pPlay/pPause; schützt den Vocoder-Await
  pGain = null,
  pPlayerMuteGain = null,   // BA391: Player-Mute fuer Latenztest (1=hoerbar,0=stumm)
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

let pPlayWish = false;   // SW (BA378): gemerkter Play-Wunsch. true = Nutzer
                         // will spielen, Wiedergabe startet sobald Gate offen.
                         // Einzige Schreibstellen: _pSetPlayWish().

// SW (BA378): einzige Schreibstelle fuer pPlayWish. wish=true -> Play
// angefordert; wish=false -> Wunsch zurueckgenommen (kein Auto-Start).
// Aktualisiert die Button-Optik (amber im Warten) zentral mit.
function _pSetPlayWish(wish) {
  pPlayWish = !!wish;
  pUpdBtn();
}

// SW (BA378): Start-Gate. Gibt true zurueck, wenn an der aktuellen
// Abspielposition abgespielt werden darf:
//  - Streaming (Schnell/Mittel): sobald der gemessene Vorlauf erreicht ist.
//  - "Beste" waehrend Berechnung: erst wenn pWarpedBuf fertig (nicht bei
//    blossem pBuf -- der koennte noch ungewarpt sein).
//  - Warp aus / fertig: sobald pBuf vorliegt.
// pWarpBusy allein sperrt NICHT mehr (Button bleibt bedienbar).
function _pGateOpen() {
  const warpActive = (typeof pWarpOn !== "undefined") && pWarpOn
                  && (typeof plEqOn === "undefined" || plEqOn);

  // Fall 1: Streaming-Modus (Schnell/Mittel) mit laufender Berechnung.
  const streaming = warpActive
                 && (typeof _warpUseStreamingForMode === "function")
                 && _warpUseStreamingForMode()
                 && (typeof pWarpBusy !== "undefined") && pWarpBusy;
  if (streaming) {
    return _streamRFinal
        && _streamDoneSec >= _streamReleaseSec
        && _streamDoneSec >= _streamStartPos;
  }

  // Fall 2: "Beste" mit laufender Berechnung -- warten bis pWarpedBuf fertig.
  if (warpActive && (typeof pWarpBusy !== "undefined") && pWarpBusy) {
    return (typeof pWarpedBuf !== "undefined") && !!pWarpedBuf;
  }

  // Fall 3: Kein Warp / Berechnung fertig: Gate offen sobald abspielbarer Buffer da.
  return !!pBuf;
}

// BA371: Streaming-Wiedergabe-State (Streaming-Pfad, Modi "fast"/"mid").
// Aktiv während erstem Durchlauf eines Stücks im Streaming-Modus.
let _streamSources = [];       // laufende Abschnitts-BufferSources
let _streamNextStart = 0;      // AudioContext-Zeit fuer den naechsten Abschnitt
let _streamFirstReady = false; // wurde Wiedergabe fuer diesen Streaming-Lauf gestartet?
let _streamTargetBuf = null;   // Referenz auf pWarpedBuf waehrend Streaming
let _streamSampleRate = 0;     // SampleRate des laufenden Streaming-Bufs
let _streamActiveGen = -1;     // Generation-Zaehler; matcht pWarpGen
let _streamPendingPlay = null; // pOff fuer aufgeschobenes pPlay (Seek waehrend Streaming)
// BA376: Adaptiver Vorlauf-Gate -- Felder.
let _streamMeasuredR = null;   // endgueltig verwendetes r
let _streamReleaseSec = 0;     // ab dieser fertigen Audiodauer (Sek) darf gestartet werden
let _streamDoneSec = 0;        // bislang zusammenhaengend fertige Audiodauer (Sek)
let _streamStartPos = 0;       // p (Abspiel-Startposition in Sek) fuer diesen Lauf
// BA376.1: r-Sammlung fuer robuste Messung.
let _streamRSamples = [];      // gesammelte r-Messungen (erste 1 oder 4 Abschnitte)
let _streamRFinal = false;     // r endgueltig festgelegt?

// BA371: Hilfsfunktion -- liefert firstNode der aktuellen EQ-Kette
// (analog zu pPlay:546-552). Genutzt von _streamScheduleSegment.
function _pGetFirstNode() {
  const mode = (typeof getPlayerSide === "function") ? getPlayerSide() : "both";
  const stereoMode = (typeof _pUseSplitChains === "function") && _pUseSplitChains(mode) && pChannelSplitter;
  return stereoMode
    ? pChannelSplitter
    : pEqF.length > 0
      ? pEqF[0]
      : pGain;
}

// BA371: Einen Abschnitts-AudioBuffer als BufferSource terminieren und abspielen.
// segBuf: kurzer Stereo-AudioBuffer (Abschnittslaenge)
// startTime: AudioContext.currentTime, ab dem der Abschnitt starten soll
// gen: Generation-Zaehler -- veraltete Callbacks ignorieren.
function _streamScheduleSegment(segBuf, startTime, gen, isLastPlayback) {
  if (gen !== _streamActiveGen) return;
  const c = gPC();
  const src = c.createBufferSource();
  src.buffer = segBuf;
  const firstNode = _pGetFirstNode();
  src.connect(firstNode);
  src.start(startTime);
  _streamSources.push(src);
  // Aufgeräumte Sources aus dem Array entfernen, wenn beendet.
  src.onended = function() {
    const idx = _streamSources.indexOf(src);
    if (idx >= 0) _streamSources.splice(idx, 1);
    // SW (BA377): letzter abgespielter Abschnitt -> gemeinsamer Ende-Handler.
    // Nur, wenn dieser Lauf noch aktuell ist (kein Stop/Pause/neuer Gen).
    if (isLastPlayback && gen === _streamActiveGen) {
      _pOnPlaybackEnded();
    }
  };
}

// BA371: Streaming-State zurücksetzen (vor neuem Streaming-Lauf aufrufen).
function _streamResetState() {
  _streamStopAll();
  _streamSources = [];
  _streamNextStart = 0;
  _streamFirstReady = false;
  _streamTargetBuf = null;
  _streamSampleRate = 0;
  _streamActiveGen = -1;
  _streamPendingPlay = null;
  // BA376: Vorlauf-Gate-Felder zuruecksetzen.
  _streamMeasuredR = null;
  _streamReleaseSec = 0;
  _streamDoneSec = 0;
  _streamStartPos = 0;
  // BA376.1: r-Sammlung zuruecksetzen.
  _streamRSamples = [];
  _streamRFinal = false;
}

// BA376: Startposition fuer diesen Lauf setzen (von pWarpTrigger vor _streamResetState).
function _streamSetStartPos(posSec) {
  _streamStartPos = (typeof posSec === "number" && posSec > 0) ? posSec : 0;
}

// BA376.1: r-Messung je Abschnitt sammeln; nach genuegend Messungen Vorlauf-Schwelle setzen.
// Modus "mid" (R3) sammelt 4 Abschnitte; alle anderen 1 (R2 ist stabil genug).
function _streamSetMeasuredR(rMeasured, segIndex) {
  if (_streamRFinal) return;
  _streamRSamples.push(rMeasured);
  const need = (typeof pWarpCalcMode !== "undefined" && pWarpCalcMode === "mid") ? 4 : 1;
  if (_streamRSamples.length < need) return;   // noch nicht genug -> weiter sammeln

  const r = Math.max.apply(null, _streamRSamples);   // hoechster gemessener Wert
  _streamRFinal = true;
  _streamMeasuredR = r;

  const T = pSourceBuf ? (pSourceBuf.length / pSourceBuf.sampleRate) : 0;
  const p = _streamStartPos;
  const rEff = 1.05 * r;                       // 5 % Sicherheitszuschlag
  let V = (T - p) * (1 - 1 / rEff);
  if (!(V > 0)) V = 0;
  _streamReleaseSec = p + V;
  console.log("[Warp-Vorlauf] r=" + r.toFixed(2) + " (aus " + _streamRSamples.length
    + " Abschnitten) T=" + T.toFixed(1) + "s p=" + p.toFixed(1)
    + "s -> V=" + V.toFixed(1) + "s, Start ab fertig=" + _streamReleaseSec.toFixed(1) + "s");
}

// BA371: Alle laufenden Abschnitts-Sources stoppen und State aufräumen.
function _streamStopAll() {
  for (let i = 0; i < _streamSources.length; i++) {
    try { _streamSources[i].stop(); } catch (e) {}
  }
  _streamSources = [];
}

// BA371: Gibt an, ob gerade ein Streaming-Lauf aktiv ist (Abschnitte laufen).
function _streamIsActive() {
  return _streamFirstReady && _streamSources.length > 0;
}

// BA371: Einen Abschnittsbereich aus pWarpedBuf als kurzen Stereo-Buffer bauen.
// Analog zu _buildWarpedPlaybackBuffer, aber fuer einen Teilbereich [segStart, segStart+segLen).
// Nutzt pWarpAffected und pSourceBuf -- muss also nach buildWarpStage aufgerufen werden
// (buildWarpStage setzt pWarpAffected).
function _buildWarpedSegmentBuffer(segStart, segLen) {
  const c = gPC();
  const sr = pWarpedBuf.sampleRate;
  const out = c.createBuffer(2, segLen, sr);
  const outL = out.getChannelData(0);
  const outR = out.getChannelData(1);

  const warpL = pWarpedBuf.getChannelData(0);
  const warpR = pWarpedBuf.numberOfChannels > 1
    ? pWarpedBuf.getChannelData(1)
    : pWarpedBuf.getChannelData(0);

  const mode = (typeof getPlayerSide === "function") ? getPlayerSide() : "both";

  if (mode === "left") {
    outL.set(warpL.subarray(segStart, segStart + segLen));
    // outR bleibt 0
    return out;
  }
  if (mode === "right") {
    outR.set(warpR.subarray(segStart, segStart + segLen));
    // outL bleibt 0
    return out;
  }

  // mode "both" oder "mono"
  const affected = (typeof pWarpAffected !== "undefined")
    ? pWarpAffected
    : { warpsLeft: true, warpsRight: true };

  let srcL, srcR;
  if (mode === "mono" && pSourceBuf) {
    const mono = _pDownmixMono(pSourceBuf);
    srcL = mono;
    srcR = mono;
  } else if (pSourceBuf) {
    srcL = pSourceBuf.getChannelData(0);
    srcR = pSourceBuf.numberOfChannels > 1
      ? pSourceBuf.getChannelData(1)
      : srcL;
  } else {
    srcL = warpL;
    srcR = warpR;
  }

  const srcLen = pSourceBuf ? pSourceBuf.length : segLen;
  const segEnd = segStart + segLen;

  if (affected.warpsLeft) {
    outL.set(warpL.subarray(segStart, segEnd));
  } else {
    const srcStart = Math.min(segStart, srcLen);
    const copyEnd = Math.min(segEnd, srcLen);
    if (copyEnd > srcStart) outL.set(srcL.subarray(srcStart, copyEnd));
  }

  if (affected.warpsRight) {
    outR.set(warpR.subarray(segStart, segEnd));
  } else {
    const srcStart = Math.min(segStart, srcLen);
    const copyEnd = Math.min(segEnd, srcLen);
    if (copyEnd > srcStart) outR.set(srcR.subarray(srcStart, copyEnd));
  }

  return out;
}

// BA371: Callback aus pWarpTrigger/streamFillBuffer -- ein Abschnitt ist fertig.
// segIndex: laufende Nummer, segStart/segLen in Samples, gen: Generation-Zaehler.
// Startet Wiedergabe beim ersten Abschnitt, terminiert Folgeabschnitte lueckenlos.
// BA371.2: async, weil _pWireOutputChain beim ersten Abschnitt awaited wird.
async function _streamOnSegmentReady(segIndex, segStart, segLen, gen) {
  if (!pWarpedBuf) return;
  if (typeof pWarpGen !== "undefined" && gen !== pWarpGen) return;
  if (typeof pWarpOn !== "undefined" && !pWarpOn) return;  // BA374: Warp aus -> nur rechnen, nicht abspielen

  // BA376: fertige zusammenhaengende Audiodauer fortschreiben.
  const sr0 = pWarpedBuf.sampleRate;
  _streamDoneSec = (segStart + segLen) / sr0;

  if (!_streamFirstReady) {
    // SW (BA378): Ohne Play-Wunsch nur rechnen, nicht abspielen.
    // (Auto-Play bei bloszem Auswaehlen ist damit beseitigt.)
    if (!pPlayWish) return;

    // BA376: Abschnitte, die komplett vor der Startposition p liegen:
    // nur zaehlen, kein Ton. (segStart+segLen)/sr0 <= p bedeutet, der
    // Abschnitt endet spaetestens bei p -- nichts davon abspielen.
    if (_streamDoneSec <= _streamStartPos) return;

    // BA376.1: Vorlauf-Gate: warten bis r final und Freigabe-Schwelle erreicht.
    const ready = _streamRFinal
      && _streamDoneSec >= _streamReleaseSec
      && _streamDoneSec >= _streamStartPos;
    if (!ready) return;
  }

  const c = gPC();
  const sr = pWarpedBuf.sampleRate;

  // BA372 (S2): Kopie xfLen frueher enden lassen (ausser letzter Abschnitt),
  // damit die Naht zwischen den Wiedergabe-Kopien VOR der Blendzone liegt
  // und der geblendete Kopf des Folgeabschnitts (steht in pWarpedBuf)
  // vollstaendig von dessen Kopie getragen wird. So ist der Uebergang im
  // 1. Durchlauf identisch zu Loop/Zurueckspringen.
  const xfLen = (typeof STREAM_CROSSFADE_SECONDS === "number")
    ? Math.max(0, Math.round(STREAM_CROSSFADE_SECONDS * sr))
    : 0;
  const isLast = (segStart + segLen) >= pWarpedBuf.length;

  if (!_streamFirstReady) {
    // BA376: Erster abgespielter Buffer: ab Sample p starten, nicht ab segStart.
    // Damit hoert man nie Ton vor der Startposition.
    const pSample = Math.round(_streamStartPos * sr);
    // Restlaenge dieses Abschnitts ab p (bis zur naechsten Abschnittsgrenze).
    const segEnd = segStart + segLen;
    const playStart = Math.max(pSample, segStart);  // sollte = pSample sein (p liegt in diesem Abschnitt)
    const rawLen = segEnd - playStart;
    const playLen = (!isLast && rawLen > xfLen) ? (rawLen - xfLen) : rawLen;
    const segDuration = playLen / sr;

    if (playLen <= 0) return;  // Sicherheit: Abschnitt komplett in der Crossfade-Zone

    let segBuf;
    try {
      segBuf = _buildWarpedSegmentBuffer(playStart, playLen);
    } catch (e) {
      console.error("_streamOnSegmentReady: Segment-Buffer-Fehler (erster ab p)", e);
      return;
    }

    // Kette verdrahten und Wiedergabe starten.
    // BA371.2: _pWireOutputChain einmal aufrufen -- verbindet
    // firstNode -> EQ -> (MAPLAW ->) pGain -> destination.
    // playGen = null: kein pPlay-Konkurrenz-Guard noetig.
    _streamActiveGen = gen;
    _streamTargetBuf = pWarpedBuf;
    _streamSampleRate = sr;

    const wired = await _pWireOutputChain(c, null);
    // Nach dem await nochmals pruefen (Gen koennte sich geaendert haben).
    if (!wired || (typeof pWarpGen !== "undefined" && gen !== pWarpGen)) return;

    const startTime = c.currentTime + 0.1;  // etwas Vorlauf nach MAPLAW-await
    _streamScheduleSegment(segBuf, startTime, gen, isLast);
    // BA376: _streamNextStart zeigt auf die naechste volle Abschnittsgrenze
    // (segEnd - xfLen, falls nicht letzter Abschnitt). Die Folgeabschnitte
    // haengen dort an, normal verkettend.
    _streamNextStart = startTime + segDuration;
    _streamFirstReady = true;

    // pPlaying-State setzen (damit Pause/Stop-Buttons und pTick korrekt sind).
    // BA376: pT0 = currentTime - p (nicht - pOff), damit Slider bei p startet.
    if (typeof _pSetPlayWish === "function") _pSetPlayWish(false);  // SW (BA378): Wunsch erfuellt
    pPlaying = true;
    pT0 = c.currentTime - _streamStartPos;
    if (typeof pUpdBtn === "function") pUpdBtn();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(typeof pTick === "function" ? pTick : function() {});
    }
  } else {
    // Folgeabschnitt: lueckenlos hinter dem vorherigen terminieren.
    if (gen !== _streamActiveGen) return;

    const playLen = (!isLast && segLen > xfLen) ? (segLen - xfLen) : segLen;
    const segDuration = playLen / sr;

    let segBuf;
    try {
      segBuf = _buildWarpedSegmentBuffer(segStart, playLen);
    } catch (e) {
      console.error("_streamOnSegmentReady: Segment-Buffer-Fehler", e);
      return;
    }

    let startTime = _streamNextStart;
    // Unterlauf-Schutz: wenn wir zu spaet sind, kleiner Puffer.
    if (c.currentTime > startTime) {
      startTime = c.currentTime + 0.01;
    }
    _streamScheduleSegment(segBuf, startTime, gen, isLast);
    _streamNextStart = startTime + segDuration;
  }
}

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
  // BA347.1: Kanal-Arrays EINMAL vor der Schleife holen. Vorher wurde
  // buf.getChannelData(c) pro Sample x Kanal aufgerufen (~23 Mio Aufrufe
  // bei 4-min-Stereo) -> 160-750 ms UI-Block je Titel. Jetzt ch Aufrufe.
  const chans = [];
  for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
  for (let s = 0; s < n; s++) {
    let sum = 0;
    for (let c = 0; c < ch; c++) sum += chans[c][s];
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
  if (!plCategories[mode]) return;
  // BA386: pSetPlaybackMode ist wunsch-neutral. Es laedt einen Buffer als
  // aktives Stueck -- es loescht den Play-Wunsch NICHT mehr. Frueher (BA379)
  // loeschte es hier bedingungslos; das zerstoerte beim Erst-Laden aus einem
  // Play-Klick den gerade gesetzten Wunsch (Streaming-Gate startete nie).
  // Wunsch-Beendigung liegt jetzt bei den Wegen, die sie wirklich bedeuten:
  // pStopReset (Stop/Quellen-Wechsel), plPlayPauseToggle (Pause-Klick),
  // plNavAfterFilterChange (Stueck faellt aus Filter), sStop (Saetze-Stopp).
  pPlaybackMode = mode;
  pSourceBuf = (typeof plCategories[mode].currentBuffer === "function")
    ? plCategories[mode].currentBuffer()
    : null;
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

function ELL_computeGains() {
  const corr = ELL_testData({ ctx: ELL_ctx("global") }).correction;
  const presetCurve = kurvenELLSumme();
  const g = new Array(nEl).fill(0);
  for (let i = 0; i < nEl; i++) {
    // corr[i] ist bereits gegatet (ungemessen/ausgeschlossen/stumm => 0),
    // daher kein eigener hd-Check mehr noetig.
    const addMeas = plSrcMeas ? -corr[i] : 0;
    const addLvls = plSrcLevels ? -schieberELL[i] : 0;
    const addCurves = plSrcCurves ? -presetCurve[i] : 0;
    g[i] = addMeas + addLvls + addCurves;
  }
  return g;
}

// BA 316: Gemeinsamer Absenk-Betrag (dB) gegen Clipping/Uebersteuern.
// Hoechste noetige Anhebung ueber BEIDE Seiten, aber nur unter den
// REGULAEREN Elektroden (nicht stumm/fast stumm/deaktiviert/ausgeschlossen).
// Rueckgabe >= 0; 0 = keine Anhebung noetig => keine Absenkung.
// ELL_computeGains() liefert die negierte Korrektur (eqRaw-Konvention), die
// echte Korrektur (positiv = Anhebung) ist daher -g[i].
// BA 320: Kern — hoechste noetige Anhebung ueber die uebergebenen Seiten,
// UNABHAENGIG von plEqHeadroomBoth. Fuer den Vergleich gemeinsam vs.
// seitenweise (Audiologen-Auftrag).
function _eqHeadroomOffsetForSides(sides) {
  if (!plEqHeadroom || !plEqOn) return 0;
  let mx = 0;
  sides.forEach(function (s) {
    withSide(s, function () {
      const g = ELL_computeGains();
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
  const eqRaw = withSide(side, ELL_computeGains);   // ELL_computeGains-Konvention (negierte Korrektur)
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
  const balG = getPlayerSTBGains();          // {left,right} dB, 0 wenn plApplyBalance aus
  const bRaw = balSuppressed ? 0 : ((side === "right") ? balG.right : balG.left);
  const balance = nhSim ? -bRaw : bRaw;
  return { eq: eq, balance: balance };
}

function documentHasStereoAudio() {
  return pSourceBuf && pSourceBuf.numberOfChannels > 1;
}

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

// BA385: Blendet alle vom Master-Button (Equalizer) gesteuerten Box-Zeilen
// aus, wenn der Master aus ist. Der untere Block "Beide Seiten"/"Stereo zu
// Mono" und der Master-Button selbst bleiben immer sichtbar (sie sind vom
// Master unabhaengig). Die mit .pl-master-row markierten Container werden
// passend ein-/ausgeblendet; bei Master=an wird die normale Sichtbarkeit
// (z.B. Erklaer-Zeilen je nach Checkbox) wiederhergestellt.
function plUpdMasterVisibility() {
  const on = (typeof plEqOn === "undefined") ? true : plEqOn;
  const rows = document.querySelectorAll(".pl-master-row");
  rows.forEach(function (el) {
    el.style.display = on ? "" : "none";
  });
  // Bei Master=an die feinere Sichtbarkeit der Erklaer-Zeilen wiederherstellen,
  // die sonst von ihren eigenen Update-Funktionen gesetzt wird.
  if (on) {
    if (typeof plUpdHeadroomBox === "function") plUpdHeadroomBox();
  }
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
  // Kein Implantat konfiguriert (Hersteller „—") -> nEl = 0 -> keine
  // Elektroden-Filter zu bauen. Ohne diesen Riegel liefe pBuildEQ in den
  // Doppel-Ketten-Zweig, baute eine leere Filterliste und scheiterte an
  // pChannelSplitter.connect(pEqFLeft[0], …) (pEqFLeft[0] === undefined).
  // false -> Signal läuft unbearbeitet durch (Quelle -> pGain).
  if (typeof nEl !== "number" || nEl <= 0) return false;
  if (mode === "mono") return true;
  return mode === "both" && pSourceBuf.numberOfChannels > 1;
}

// BA390: Stellt pGain und die Latenz-Delay-Kette her, ohne EQ-Filter und
// ohne Wiedergabe. Idempotent (baut nur, wenn pGain noch fehlt). Wird vom
// Warmlauf beim Seitenaufruf UND aus pBuildEQ genutzt -- eine Schreibstelle
// fuer die Graph-Grundstruktur.
function pEnsureOutputBase(c) {
  if (pGain) return;
  pGain = c.createGain();
  pGain.gain.value = parseInt(document.getElementById("plVol").value) / 100;
  // BA391: EINZIGE Player-Mute-Stelle -- hinter pGain, an dessen einzigem
  // Ausgang. pGain bleibt exklusiv der Lautstaerke-Pegel.
  pPlayerMuteGain = c.createGain();
  pPlayerMuteGain.gain.value = 1; // Default hoerbar
  pGain.connect(pPlayerMuteGain);
  // Latenz-Kette zwischen pPlayerMuteGain und destination einhaengen
  if (typeof LTZ_initGraph === "function") {
    LTZ_initGraph(c);
    pPlayerMuteGain.connect(pLatSplitter);
  } else {
    pPlayerMuteGain.connect(c.destination);
  }
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
  pEnsureOutputBase(c);
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
        : withSide("left", () => FRQ_implantatEffektiv(i));
      lf.Q.value = pCompQ(i);
      lf.gain.value = corrL.eq[i];
      pEqFLeft.push(lf);
      const rf = c.createBiquadFilter();
      rf.type = "peaking";
      rf.frequency.value = nhSim
        ? effFreqDisplay(i, "right")
        : withSide("right", () => FRQ_implantatEffektiv(i));
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
      f.frequency.value = nhSim ? effFreqDisplay(i) : FRQ_implantatEffektiv(i);
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
}

function pToggle() {
  if (pCtx && pCtx.state === "suspended") pCtx.resume();
  if (!pBuf) return;                // kein Buffer → ignorieren
  if (pPlaying) pPause();
  else pPlay();
}

// BA371.2: Verdrahtet lastEq -> (MAPLAW ->) pGain. Gemeinsame Logik fuer
// pPlay und den Streaming-Pfad (_streamOnSegmentReady). Gibt { firstNode,
// lastEq } zurueck. Der optionale Parameter playGen wird nur fuer den
// MAPLAW-await-Guard genutzt (pPlay uebergibt pPlayGen; Streaming
// uebergibt null -> Guard uebersprungen, da kein konkurrierender Aufruf).
async function _pWireOutputChain(c, playGen) {
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
  // Alte ausgehende Verbindung trennen, bevor neu verdrahtet wird.
  // Verhindert Doppelpfad lastEq->pGain + lastEq->pMaplawNode->pGain.
  if (lastEq) {
    try { lastEq.disconnect(); } catch (e) {}
  }

  // MAPLAW: zwischen letztem EQ-Knoten und pGain einhaengen, wenn aktiv.
  const mapApplies = pMaplawOn && plEqOn && pMaplawIsApplicable();
  if (mapApplies) {
    await pInitMaplawWorklet(c);
    // Guard nur wenn playGen gesetzt (pPlay-Kontext mit Konkurrenz-Risiko).
    if (playGen !== null && playGen !== pPlayGen) return null;
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

  return { firstNode, lastEq };
}

// SW (BA377): Gemeinsamer Ende-Handler fuer ALLE Wiedergabe-Modi (Voll +
// Streaming). Wird aufgerufen, wenn die Wiedergabe das Stueckende erreicht.
// Loop hat Vorrang vor Auto-Advance; ohne beides wird sauber gestoppt.
function _pOnPlaybackEnded() {
  if (!pPlaying) return;
  pPlaying = false;
  pOff = 0;
  pUpdBtn();
  pUpdTL();

  const ms = (typeof plPauseMs !== "undefined") ? plPauseMs : 0;

  // Loop hat Vorrang vor Auto-Advance: gleiches Stueck nach Pause nochmal.
  if (typeof plLoop !== "undefined" && plLoop) {
    setTimeout(function () {
      if (!plLoop) return;  // wurde waehrend der Pause ausgeschaltet
      if (typeof pPlay === "function") pPlay();
    }, ms);
    return;
  }

  // Auto-Advance einheitlich ueber Kategorie-Adapter.
  const cat = plCurrentCategory();
  if (cat && plAutoAdvance) cat.autoAdvance();
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
    // BA371.2: Streaming-Pfad hat Wiedergabe ggf. schon gestartet (waehrend
    // wir auf pWarpComputingPromise gewartet haben). Nicht nochmal starten.
    if (typeof _streamFirstReady !== "undefined" && _streamFirstReady) return;
  }

  const c = gPC();
  pBuf = getPlaybackBuffer();

  const wired = await _pWireOutputChain(c, gen);
  if (!wired) return;  // von neuem pPlay/pPause ueberholt (MAPLAW-await)
  const { firstNode } = wired;

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
    leadSrc.onended = _pOnPlaybackEnded;
  }

  pT0 = c.currentTime - pOff;
  pPlaying = true;
  if (typeof _pSetPlayWish === "function") _pSetPlayWish(false);  // SW (BA378): Wunsch erfuellt
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
  // BA371: Streaming-Sources stoppen (falls Streaming-Wiedergabe aktiv).
  _streamStopAll();
  if (pMaplawNode) {
    try { pMaplawNode.disconnect(); } catch (e) {}
    pMaplawNode = null;
  }
  if (pCtx && pBuf) {
    pOff = pCtx.currentTime - pT0;
    if (pOff > pBuf.duration) pOff = 0;
  }
  pPlaying = false;
  // SW (BA382): pPause loescht den Play-Wunsch NICHT mehr. "Pause" wird auch
  // intern zum kurzen Anhalten (Neuberechnen/Pfadwechsel) genutzt; dort muss
  // der Wunsch erhalten bleiben. Nur die echten Nutzer-/Stopp-/Stueck-/Kategorie-
  // Wechsel-Wege loeschen ihn explizit (plPlayPauseToggle Pause-Zweig, pStopReset,
  // _plNavGoTo, plNavAfterFilterChange, sStop). BA386: pSetPlaybackMode ist
  // nicht mehr in dieser Liste -- es ist jetzt wunsch-neutral.
  pUpdBtn();
}

function pStopReset() {
  // Auch greifen, wenn pPlaying im Zwischenzustand false ist (z.B. während ein
  // async Vocoder-pPlay im await hängt), aber Sources schon laufen — sonst
  // bleibt der Ton hängen und der Stop-Button wirkt nicht.
  if (pPlaying || pSrc || pCurrentPlayback) pPause();
  if (typeof _pSetPlayWish === "function") _pSetPlayWish(false);  // SW (BA378): Stop bricht Warten ab
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
  const btn = document.getElementById("plPlay");
  if (!btn) return;
  btn.textContent = pPlaying ? "\u23F8" : "\u25B6";
  // SW (BA378): Warte-Zustand = Play-Wunsch liegt vor, aber es spielt noch
  // nicht (Gate zu). Dann Play-Symbol gedaempft amber statt schwarz.
  const waiting = !pPlaying && (typeof pPlayWish !== "undefined") && pPlayWish;
  btn.style.color = waiting ? "#d97706" : "";   // amber-600; "" = Default (schwarz)
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

  // SW (BA379): Seek = nur Position aendern, NIE neu berechnen.
  if (pPlaying) {
    // Laeuft -> an neuer Position fortsetzen. pPlay nutzt den vorhandenen
    // Buffer; im Streaming greift bei noch-unberechneter Stelle das Gate
    // (amber warten, dann weiter) -- Wunsch setzen, damit das Gate startet.
    const seekTo = pOff;
    if (typeof _pSetPlayWish === "function") _pSetPlayWish(true);
    pPause();
    pOff = seekTo;
    pPlay();
  } else if (typeof pPlayWish !== "undefined" && pPlayWish) {
    // Wartet (amber): Wunsch bleibt, Gate wartet jetzt auf die neue Position.
    // Streaming-Startposition nachfuehren, damit das Vorlauf-Gate ab hier misst.
    if (typeof _streamSetStartPos === "function") _streamSetStartPos(pOff);
  }
  // sonst: pausiert ohne Wunsch -> nur Position gemerkt, nichts weiter.
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
  if (typeof ELL_refEl !== "undefined" && ELL_refEl !== null) {
    const jRef = allE.indexOf(ELL_refEl);
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

// BA385: MAPLAW-UI ist ausgeblendet. Diese Funktion und die MAPLAW-Mechanik
// (Worklet, pMaplawTrigger) duerfen NUR fuer MED-EL verwendet werden.
function pMaplawUpdUI() {
  const cardOn     = document.getElementById("plMaplawOn");
  const sollIn     = document.getElementById("plMaplawSollInput");
  const istEl      = document.getElementById("plMaplawIstVal");
  const maplawRow  = document.getElementById("plMaplawRow");
  const settingsBox = document.getElementById("plMaplawSettingsBox");
  if (!cardOn) return;

  const applicable = (typeof pMaplawIsApplicable === "function") ? pMaplawIsApplicable() : false;

  // BA385: MAPLAW-UI dauerhaft ausgeblendet (Funktion derzeit unzulaenglich,
  // wird spaeter weiterentwickelt). Logik/Worklet/Trigger bleiben vollstaendig
  // erhalten. ACHTUNG: pMaplawUpdUI und die gesamte MAPLAW-Mechanik duerfen
  // NUR fuer MED-EL verwendet werden (pMaplawIsApplicable()).
  if (maplawRow) maplawRow.style.display = "none";
  if (settingsBox) settingsBox.style.display = "none";

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
  if (ELL_results.length > 0) {
    pDrawEQ();
    if (document.getElementById("ELL_resC").style.display !== "none")
      ELL_renderResults();
  }
  if (document.getElementById("panel-kurven").classList.contains("active"))
    kurvenELLChartZeichnen();
  if (document.getElementById("subpanel-ergebnisse-stereobalance")?.classList.contains("active"))
    STB_drawChart();
});

// Einzige Schreibstelle fuer den Sperr-Zustand des Stereo-Balance-Buttons.
// Zwei Sperrgruende, Vorrang Taub > seitenweise Absenkung:
//   - Taub: mindestens eine Seite als taub eingetragen (BA173)
//   - Absenkung pro Seite: Headroom an, Beide-Seiten aus (BA319) -> die
//     Stereo-Balance ist in diesem Modus ausgesetzt
// Gesperrt = nur optisch grau (opacity 0.4), KEIN disabled-Attribut. Der
// Klick wird im Button-Handler (init.js) ueber das Flag plBalLocked
// geschluckt; so bleibt der Button hoverbar und der Inline-Hinweis sichtbar.
let plBalLocked = false;
function plUpdBalLock() {
  const btn = document.getElementById("plBalApplyBtn");
  const hint = document.getElementById("plLockHintBal");
  const deaf = (typeof evalDeafState === "function") ? evalDeafState() : { hasDeaf: false };
  const suppressed = (typeof plEqHeadroom !== "undefined" && plEqHeadroom)
                  && (typeof plEqHeadroomBoth !== "undefined" && !plEqHeadroomBoth);
  let reason = null;
  if (deaf.hasDeaf) reason = "deaf";
  else if (suppressed) reason = "suppressed";
  plBalLocked = (reason !== null);
  if (btn) {
    btn.style.opacity = plBalLocked ? "0.4" : "";
    btn.style.cursor  = plBalLocked ? "not-allowed" : "";
  }
  if (hint) {
    if (reason === "deaf") {
      hint.textContent = (typeof t === "function") ? t("plLockHintSideDeaf") : "Nicht verfügbar — Seite als taub eingetragen.";
      hint.style.display = "inline";
    } else if (reason === "suppressed") {
      hint.textContent = (typeof t === "function") ? t("plBalSuppressedTitle") : "Nicht verfügbar mit Elektrodenlautstärke absenken, ohne beide Seiten zu berücksichtigen.";
      hint.style.display = "inline";
    } else {
      hint.style.display = "none";
    }
  }
  // Dropdown (Sym/Links/Rechts) nur sichtbar, wenn Balance aktiv UND nicht gesperrt
  const row = document.getElementById("plBalModeRow");
  if (row) {
    const apply = (typeof plApplyBalance === "undefined") ? true : plApplyBalance;
    row.style.display = (apply && !plBalLocked) ? "" : "none";
  }
}

// Einzige Schreibstelle fuer den Sperr-Zustand des Latenz-Buttons.
// Einziger Sperrgrund: Taub (mindestens eine Seite als taub eingetragen).
// Gesperrt = nur optisch grau (opacity 0.4), KEIN disabled; der Klick wird
// im Button-Handler (init.js) ueber plLatLocked geschluckt.
let plLatLocked = false;
function plUpdLatLock() {
  const btn = document.getElementById("plLatApplyBtn");
  const hint = document.getElementById("plLockHintLat");
  const deaf = (typeof evalDeafState === "function") ? evalDeafState() : { hasDeaf: false };
  plLatLocked = !!deaf.hasDeaf;
  if (btn) {
    btn.style.opacity = plLatLocked ? "0.4" : "";
    btn.style.cursor  = plLatLocked ? "not-allowed" : "";
  }
  if (hint) {
    if (plLatLocked) {
      hint.textContent = (typeof t === "function") ? t("plLockHintSideDeaf") : "Nicht verfügbar — Seite als taub eingetragen.";
      hint.style.display = "inline";
    } else {
      hint.style.display = "none";
    }
  }
}

// Einzige Schreibstelle fuer den Sperr-Zustand des Warping-Buttons.
// Einziger Sperrgrund: Taub. (Die "nur im Stereo-Modus bedienbar"-Logik
// bleibt unberuehrt anderswo; sie ist KEINE Button-Sperre.)
let plWarpLocked = false;
function plUpdWarpLock() {
  const btn = document.getElementById("plWarpOn");
  const hint = document.getElementById("plLockHintWarp");
  const deaf = (typeof evalDeafState === "function") ? evalDeafState() : { hasDeaf: false };
  plWarpLocked = !!deaf.hasDeaf;
  if (btn) {
    btn.style.opacity = plWarpLocked ? "0.4" : "";
    btn.style.cursor  = plWarpLocked ? "not-allowed" : "";
  }
  if (hint) {
    if (plWarpLocked) {
      hint.textContent = (typeof t === "function") ? t("plLockHintSideDeaf") : "Nicht verfügbar — Seite als taub eingetragen.";
      hint.style.display = "inline";
    } else {
      hint.style.display = "none";
    }
  }
}

// ===== BA192: zentrale Wiedergabe-Steuerung =====

function plPlayPauseToggle() {
  // Laeuft -> pausieren. SW (BA382): echte Nutzer-Pause loescht den Wunsch.
  if (typeof pPlaying !== "undefined" && pPlaying) {
    if (typeof _pSetPlayWish === "function") _pSetPlayWish(false);
    if (typeof pPause === "function") pPause();
    return;
  }
  // SW (BA378): Wartet schon auf das Gate -> erneuter Klick bricht den
  // Wunsch ab (kein Auto-Start, Berechnung laeuft im Hintergrund weiter).
  if (pPlayWish) {
    if (typeof _pSetPlayWish === "function") _pSetPlayWish(false);
    return;
  }
  // SW (BA378): Play-Wunsch setzen. pPlay() bzw. der Streaming-Pfad
  // entscheiden ueber das Gate, ob sofort Ton kommt oder gewartet wird.
  if (typeof _pSetPlayWish === "function") _pSetPlayWish(true);

  // Pausiert mit geladenem Puffer -> an gemerkter Position fortsetzen.
  if (pBuf) {
    if (typeof pPlay === "function") pPlay();
    return;
  }
  // Kein Puffer -> aktuellen Zeiger sicherstellen, laden, abspielen.
  const cat = plCurrentCategory();
  if (!cat) { if (typeof _pSetPlayWish === "function") _pSetPlayWish(false); return; }
  if (typeof plNavEnsureCursor === "function") plNavEnsureCursor();
  if (!cat.current || !cat.current()) {        // leere Liste -> nichts
    if (typeof _pSetPlayWish === "function") _pSetPlayWish(false);
    return;
  }
  Promise.resolve(cat.load()).then(function () {
    if (typeof pPlay === "function") pPlay();
  }).catch(function (err) { console.error("[player] Play-Laden:", err); });
}

function plStopAll() {
  const cat = plCurrentCategory();
  if (cat && typeof cat.onStop === "function") cat.onStop();
  if (typeof pStopReset === "function") pStopReset();
  _plAutoAdvCancel();
}

// ============================================================
// BA324: Kategorie-Adapter (Lauf 1 — 3A)
// plCategories[key] kapselt Prev/Next/hasNext/hasPrev/autoAdvance/
// onActivate/onDeactivate je Quelle. plCurrentCategory() liefert den
// aktiven Adapter.
// ============================================================

// --- Adapter-Objekte ---

const plCategories = {
  musik: {
    // --- Vertrag ---
    list: function () { return plMusicVisibleItems(); },
    current: function () { return plMusicCurrentItem(); },
    select: function (item) {
      if (!item) return;
      plMusicSelectedId = item.id;
      const sel = document.getElementById("plMusicItemSel");
      if (sel) sel.value = item.id;
    },
    load: function () { return plMusicLoadSelected(); },
    // --- Anzeige (unveraendert) ---
    currentItem: function () {
      const it = (typeof plMusicCurrentItem === "function") ? plMusicCurrentItem() : null;
      if (!it) return null;
      return {
        title:   it.title  || it.id || "",
        artist:  (it.tags && it.tags.artist) || "",
        album:   (it.tags && it.tags.album)  || "",
        genre:   (it.tags && Array.isArray(it.tags.genres) && it.tags.genres.length) ? it.tags.genres.join(", ") : "",
        year:    (it.tags && it.tags.year)   ? String(it.tags.year) : "",
        source:  it.sourceTitle || "",
        license: it.license     || ""
      };
    },
    title: function (ctx) {
      return ctx.artist ? (ctx.artist + " — " + ctx.title) : ctx.title;
    },
    currentBuffer: function () { return pFileBuf; },
    // --- Navigation ueber die Engine ---
    hasPrev: function () { return plNavHasPrev(); },
    hasNext: function () { return plNavHasNext(); },
    prev: function () { plNavPrev(); },
    next: function () { plNavNext(); },
    autoAdvance: function () { plNavAutoAdvance(); },
    // --- Lebenszyklus ---
    onActivate: function () {
      pSetPlaybackMode("musik");
      plNavEnsureCursor();
      if (typeof plMusicRefreshUI === "function") plMusicRefreshUI();
      if (plMusicCurrentItem()) {
        Promise.resolve(plMusicLoadSelected()).then(function () {
          plNavRestorePos();
        });
      }
    },
    onDeactivate: function () {}
  },

  saetze: {
    // --- Vertrag --- (Liste = Satz-Pool; bei gewaehltem Sprecher dessen Pool,
    // sonst die sortierte Gesamt-Sequenz; Zeiger = sCurRec)
    list: function () {
      const spkSel = (typeof plSentSpeakerSel !== "undefined") ? plSentSpeakerSel : "any";
      if (spkSel && spkSel !== "any") return sBuildRecordingPool(spkSel);
      return sBuildSequencePool();
    },
    current: function () { return (typeof sCurRec !== "undefined") ? sCurRec : null; },
    select: function (item) { if (item) sCurRec = item; },
    load: function () { return sLoadAndPlayCurrent(); },
    // --- Anzeige (unveraendert) ---
    currentItem: function () {
      if (typeof sCurRec === "undefined" || !sCurRec) return null;
      return {
        source:  sCurRec.sourceTitle || "",
        speaker: sCurRec.title || (sCurRec.tags && sCurRec.tags.speaker_id) || "",
        lang:    (sCurRec.tags && sCurRec.tags.lang) || "",
        license: sCurRec.license || "",
        credit:  sCurRec.credit  || "",
        text:    sCurRec.text    || ""
      };
    },
    title: function (ctx) {
      if (ctx.source && ctx.speaker && ctx.source !== ctx.speaker) {
        return ctx.source + " — " + ctx.speaker;
      }
      return ctx.source || ctx.speaker || "";
    },
    currentBuffer: function () { return (typeof sSentenceBuf !== "undefined") ? sSentenceBuf : null; },
    fillReveal: function (textEl, ctx, revealFields) {
      if (typeof sUpdateTextBox === "function") sUpdateTextBox();
    },
    // --- Navigation ueber die Engine ---
    hasPrev: function () { return plNavHasPrev(); },
    hasNext: function () { return plNavHasNext(); },
    prev: function () { plNavPrev(); },
    next: function () { plNavNext(); },
    autoAdvance: function () { plNavAutoAdvance(); },
    // --- Lebenszyklus ---
    onActivate: function () {
      pSetPlaybackMode("saetze");
      plNavEnsureCursor();
      if (typeof sUpdateUI === "function") sUpdateUI();
      if (typeof sCurRec !== "undefined" && sCurRec) {
        Promise.resolve(sLoadAndPlayCurrent()).then(function () {
          plNavRestorePos();
        }).catch(function (err) { console.error("[sentences] onActivate load:", err); });
      }
    },
    onDeactivate: function () {
      if (typeof pStopReset === "function") pStopReset();
    }
  },

  geraeusche: {
    // --- Vertrag ---
    list: function () { return plNoiseVisibleItems(); },
    current: function () { return plNoiseCurrentItem(); },
    select: function (item) {
      if (!item) return;
      plNoiseSelectedId = item.id;
      const sel = document.getElementById("plNoiseItemSel");
      if (sel) sel.value = item.id;
    },
    load: function () { return plNoiseLoadSelected(); },
    // --- Anzeige (unveraendert: Indexnummer "n / gesamt") ---
    currentItem: function () {
      const it = (typeof plNoiseCurrentItem === "function") ? plNoiseCurrentItem() : null;
      const sorted = (typeof plNoiseVisibleItems === "function") ? plNoiseVisibleItems() : [];
      const total = sorted.length;
      const pos = it ? sorted.findIndex(function (x) { return x.id === it.id; }) : -1;
      const indexStr = (it && pos >= 0) ? (String(pos + 1) + " / " + String(total)) : ("– / " + String(total));
      if (!it) return { index: indexStr, name: "", kind: "", spectrum: "", source: "", license: "" };
      return {
        index:    indexStr,
        name:     it.title || it.id || "",
        kind:     (it.tags && it.tags.kind)     || "",
        spectrum: (it.tags && it.tags.spectrum)  || "",
        source:   it.sourceTitle || "",
        license:  it.license     || ""
      };
    },
    title: function (ctx) {
      return ctx.index || "";
    },
    currentBuffer: function () { return (typeof pNoiseBuf !== "undefined") ? pNoiseBuf : null; },
    fillReveal: function (textEl, ctx, revealFields) {
      if (!textEl || !ctx) return;
      const lines = [];
      revealFields.forEach(function (f) {
        const val = f.getValue(ctx);
        if (val) lines.push((typeof t === "function" ? t(f.labelKey) : f.labelKey) + ": " + val);
      });
      textEl.style.whiteSpace = "pre-line";
      textEl.textContent = lines.join("\n");
    },
    // --- Navigation ueber die Engine ---
    hasPrev: function () { return plNavHasPrev(); },
    hasNext: function () { return plNavHasNext(); },
    prev: function () { plNavPrev(); },
    next: function () { plNavNext(); },
    autoAdvance: function () { plNavAutoAdvance(); },
    // --- Lebenszyklus ---
    onActivate: function () {
      pSetPlaybackMode("geraeusche");
      plNavEnsureCursor();
      if (typeof plNoiseRefreshUI === "function") plNoiseRefreshUI();
      if (plNoiseCurrentItem()) {
        Promise.resolve(plNoiseLoadSelected()).then(function () {
          plNavRestorePos();
        });
      }
    },
    onDeactivate: function () {}
  },

  hoerbuecher: {
    // --- Vertrag --- (Liste = Kapitel des aktuellen Werks; Zeiger = Kapitel)
    list: function () {
      const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
      return (col && Array.isArray(col.items)) ? col.items : [];
    },
    current: function () {
      return (typeof plBookCurrentChapter === "function") ? plBookCurrentChapter() : null;
    },
    select: function (item) {
      const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
      if (!col || !Array.isArray(col.items)) return;
      const idx = col.items.indexOf(item);
      if (idx < 0) return;
      plBookChapterIdx = idx;
      const sel = document.getElementById("plBookChSel");
      if (sel) sel.value = String(idx);
    },
    load: function () { return plBookLoadSelected(); },
    // --- Anzeige (unveraendert) ---
    currentItem: function () {
      const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
      const ch  = (typeof plBookCurrentChapter    === "function") ? plBookCurrentChapter()    : null;
      if (!col || !ch) return null;
      return {
        chapter: ch.title  || "",
        work:    col.title || "",
        author:  (col.tags && col.tags.work_author) || "",
        reader:  (col.tags && col.tags.reader)      || "",
        lang:    col.lang    || "",
        license: col.license || "",
        pdfUrl:  col.pdfUrl  || ""
      };
    },
    title: function (ctx) {
      return ctx.chapter ? (ctx.chapter + " — " + ctx.work) : ctx.work;
    },
    currentBuffer: function () { return (typeof pBookBuf !== "undefined") ? pBookBuf : null; },
    onStop: function () {
      if (typeof plBookSavePosition === "function") plBookSavePosition();
    },
    // --- Navigation ueber die Engine ---
    hasPrev: function () { return plNavHasPrev(); },
    hasNext: function () { return plNavHasNext(); },
    prev: function () { plNavPrev(); },
    next: function () { plNavNext(); },
    autoAdvance: function () { plNavAutoAdvance(); },
    // --- Lebenszyklus ---
    onActivate: function () {
      pSetPlaybackMode("hoerbuecher");
      plNavEnsureCursor();
      if (typeof plBookRefreshUI === "function") plBookRefreshUI();
      if (plBookCurrentChapter()) {
        // plBookLoadSelected stellt die Pro-Werk-Position selbst wieder her
        // (plBookPositions). KEIN plNavRestorePos hier.
        plBookLoadSelected();
      }
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

// ============================================================
// BA338: Zentrale Liste+Zeiger-Engine
// Arbeitet NUR ueber den Kategorie-Vertrag (list/current/select/load)
// und plCurrentCategory(). Kennt KEINE Kategorie-Namen.
// ============================================================

let _plNavPrevItem = null;     // 1-Schritt-Zufalls-Memory (Item-Referenz)
const plNavSavedPos = {};      // key -> Sekunde, sitzungsweit, NICHT persistiert

function _plNavSameItem(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  return !!(a.id && b.id && a.id === b.id);
}

function plNavList() {
  const cat = plCurrentCategory();
  return (cat && typeof cat.list === "function") ? (cat.list() || []) : [];
}

function plNavCurrent() {
  const cat = plCurrentCategory();
  return (cat && typeof cat.current === "function") ? cat.current() : null;
}

function plNavIndex() {
  const list = plNavList();
  const cur  = plNavCurrent();
  if (!cur) return -1;
  for (let i = 0; i < list.length; i++) {
    if (_plNavSameItem(list[i], cur)) return i;
  }
  return -1;
}

function _plNavPickRandom(list, exclude) {
  if (!list || list.length === 0) return null;
  if (list.length === 1) return list[0];
  let pick;
  do {
    pick = list[Math.floor(Math.random() * list.length)];
  } while (_plNavSameItem(pick, exclude) && list.length > 1);
  return pick;
}

function plNavHasNext() {
  const n = plNavList().length;
  if (n === 0) return false;
  if (typeof plShuffle !== "undefined" && plShuffle) return n > 1;
  return plNavIndex() < n - 1;
}

function plNavHasPrev() {
  const n = plNavList().length;
  if (n === 0) return false;
  if (typeof plShuffle !== "undefined" && plShuffle) return _plNavPrevItem != null;
  return plNavIndex() > 0;
}

// Zeiger auf item setzen, laden, von vorn abspielen (Vor/Zurueck loesen
// immer Play aus). select setzt NUR den Zeiger; load laedt; pOff=0 = von vorn.
// Zeiger auf item setzen, laden, danach abspielen NUR wenn vorher
// gespielt wurde (Auswahl wie Vor/Zurueck folgen demselben Verhalten).
// Die Abspiel-Position (0 s bzw. Hoerbuch-Sekunde) bestimmt cat.load(),
// NICHT diese Funktion -- darum kein pOff hier.
// SW (BA379): opts.keepPlaying = true  -> wenn vorher gespielt wurde, spielt das
//   neue Stueck automatisch weiter (Weiter/Zurueck = Playlist-Skip).
//   keepPlaying = false/weggelassen -> neues Stueck bleibt still (Dropdown-Wahl).
function _plNavGoTo(item, opts) {
  const cat = plCurrentCategory();
  if (!cat || !item) return;
  const keepPlaying = !!(opts && opts.keepPlaying);
  const wasPlaying = (typeof pPlaying !== "undefined") ? pPlaying : false;

  cat.select(item);
  if (wasPlaying && typeof pPause === "function") pPause();
  // BA386: pPause loescht den Wunsch NICHT (BA382), pSetPlaybackMode ab jetzt
  // auch nicht. Nur beim Playlist-Skip mit vorher laufender Wiedergabe wird
  // der Wunsch fuer das neue Stueck gesetzt -> Gate startet (kurz amber, dann
  // Ton). Sonst bleibt still (kein Wunsch -> kein Auto-Start).
  const resume = keepPlaying && wasPlaying;
  if (resume && typeof _pSetPlayWish === "function") _pSetPlayWish(true);

  Promise.resolve(cat.load()).then(function () {
    // Voll-Pfad braucht den expliziten pPlay-Anstosz; im Streaming startet
    // _streamOnSegmentReady ueber den gesetzten Wunsch + Vorlauf selbst.
    if (resume && typeof pPlay === "function") pPlay();
  });
  if (typeof plUpdDisplay     === "function") plUpdDisplay();
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
}

function plNavNext() {
  const list = plNavList();
  if (list.length === 0) return;
  const cur = plNavCurrent();
  let next = null;
  if (typeof plShuffle !== "undefined" && plShuffle) {
    next = _plNavPickRandom(list, cur);
    _plNavPrevItem = cur;
  } else {
    const i = plNavIndex();
    if (i >= 0 && i < list.length - 1) next = list[i + 1];
  }
  if (!next) return;            // Ende der Reihe -> Schluss
  _plNavGoTo(next, { keepPlaying: true });
}

function plNavPrev() {
  const list = plNavList();
  if (list.length === 0) return;
  let target = null;
  if (typeof plShuffle !== "undefined" && plShuffle) {
    if (_plNavPrevItem) {
      for (let i = 0; i < list.length; i++) {
        if (_plNavSameItem(list[i], _plNavPrevItem)) { target = list[i]; break; }
      }
      _plNavPrevItem = null;   // 1x-Memory verbraucht
    }
  } else {
    const i = plNavIndex();
    if (i > 0) target = list[i - 1];
  }
  if (!target) return;
  _plNavGoTo(target, { keepPlaying: true });
}

// Stellt sicher, dass der Zeiger ein gueltiges Item der aktuellen Liste ist.
// Faellt der bisherige Zeiger aus der Liste (oder fehlt), wird neu gewaehlt:
// erstes bzw. (bei Zufall) gewuerfeltes Item. Ist der Zeiger noch gueltig,
// bleibt er unveraendert.
function plNavEnsureCursor() {
  const cat = plCurrentCategory();
  if (!cat) return;
  const list = plNavList();
  if (list.length === 0) return;
  const cur = plNavCurrent();
  if (cur) {
    for (let i = 0; i < list.length; i++) {
      if (_plNavSameItem(list[i], cur)) return;   // Zeiger noch gueltig
    }
  }
  const first = (typeof plShuffle !== "undefined" && plShuffle)
    ? _plNavPickRandom(list, null)
    : list[0];
  if (first) cat.select(first);
}

// Nach einer Filter-/Sprecher-Aenderung der AKTIVEN Kategorie aufrufen.
// before = Zeiger VOR dem Refresh. plBuildFilterChain hat den Zeiger bereits
// validiert/neu gewaehlt. Hat er sich geaendert (altes Stueck rausgefallen):
// Wiedergabe anhalten und das neue Stueck pausiert bereitstellen. Sonst laeuft
// das Stueck unveraendert weiter.
function plNavAfterFilterChange(before) {
  const cat = plCurrentCategory();
  if (!cat) return;
  const after = plNavCurrent();
  if (!_plNavSameItem(before, after)) {
    if (typeof _pSetPlayWish === "function") _pSetPlayWish(false);  // SW (BA379)
    if (typeof pPlaying !== "undefined" && pPlaying && typeof pPause === "function") pPause();
    pOff = 0;
    if (cat.current && cat.current()) {
      Promise.resolve(cat.load()).then(function () {
        pOff = 0;
        if (typeof plUpdDisplay     === "function") plUpdDisplay();
        if (typeof plUpdTransportUI === "function") plUpdTransportUI();
      }).catch(function (e) { console.error("[plNav] Filter-Neuwahl laden:", e); });
      return;
    }
  }
  if (typeof plUpdDisplay     === "function") plUpdDisplay();
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
}

// Einheitliche Behandlung einer Filter-Aenderung (Sortierung/Kategorie/Suche/
// Sprecher): Zeiger vorher merken, State setzen, neu aufbauen, Neuwahl-Folge.
function _plNavApplyFilterChange(catDecl, applyState) {
  const active = (catDecl.category === plActiveSource);
  const before = active ? plNavCurrent() : null;
  applyState();
  plBuildFilterChain(catDecl);
  if (active) plNavAfterFilterChange(before);
}

// Auto-Weiter: wie plNavNext, aber mit plPauseMs-Verzoegerung und
// Ende-Stopp (Reihe). Ersetzt _plMusicAutoAdvance & Co.
function plNavAutoAdvance() {
  const cat = plCurrentCategory();
  if (!cat) return;
  if (!plAutoAdvance || plLoop) return;
  const list = plNavList();
  if (list.length === 0) return;
  const cur = plNavCurrent();
  let next = null;
  if (typeof plShuffle !== "undefined" && plShuffle) {
    next = _plNavPickRandom(list, cur);
  } else {
    const i = plNavIndex();
    if (i >= 0 && i < list.length - 1) next = list[i + 1];
  }
  if (!next) return;            // Ende der Reihe -> Stopp
  const ms = (typeof plPauseMs !== "undefined") ? plPauseMs : 0;
  setTimeout(function () {
    if (!plAutoAdvance || plLoop) return;
    if (plCurrentCategory() !== cat) return;   // Kategorie gewechselt -> abbrechen
    if (typeof plShuffle !== "undefined" && plShuffle) _plNavPrevItem = cur;
    cat.select(next);
    if (typeof plUpdDisplay === "function") plUpdDisplay();
    Promise.resolve(cat.load()).then(function () {
      pOff = 0;
      // SW (BA379): Auto-Advance spielt automatisch -> Play-Wunsch setzen,
      // damit auch der Streaming-Pfad ueber das Gate startet (kurz amber,
      // dann Ton). Voll-Pfad startet ueber pPlay() (wartet bis Buffer fertig).
      if (typeof _pSetPlayWish === "function") _pSetPlayWish(true);
      if (typeof pPlay === "function") pPlay();
    });
  }, ms);
}

// Position (Sekunde) sitzungsweit je Kategorie merken / wiederherstellen.
// key ist ein opaker String (plActiveSource), KEINE Verzweigung.
function plNavSavePos(key) {
  if (!key) return;
  const sec = (typeof pCtx !== "undefined" && pCtx && typeof pPlaying !== "undefined" && pPlaying)
    ? (pCtx.currentTime - pT0)
    : pOff;
  plNavSavedPos[key] = Math.max(0, sec || 0);
}

function plNavRestorePos() {
  const sec = plNavSavedPos[plActiveSource] || 0;
  pOff = sec > 0 ? sec : 0;
  if (typeof pUpdTL === "function") pUpdTL();
}

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
  if (!plCategories[src]) return;
  if (src === plActiveSource) return;
  const old = plCurrentCategory();
  if (old) {
    plNavSavePos(plActiveSource);   // BA338: Sekunde der alten Kategorie merken
    old.onDeactivate();
  }
  plStopAll();
  plActiveSource = src;
  plUpdSourceUI();
  plUpdTransportUI();
  const nu = plCurrentCategory();
  if (nu) nu.onActivate();
  plUpdDisplay();
}

const PL_SOURCE_TABS = [
  { key: "musik",       btnId: "plSrcMusicBtn",     subId: "plSubMusic" },
  { key: "saetze",      btnId: "plSrcSentencesBtn", subId: "plSubSentences" },
  { key: "geraeusche",  btnId: "plSrcNoiseBtn",     subId: "plSubNoise" },
  { key: "hoerbuecher", btnId: "plSrcAudiobookBtn", subId: "plSubAudiobook" }
];

function plUpdSourceUI() {
  PL_SOURCE_TABS.forEach(function (tab) {
    const on = (plActiveSource === tab.key);
    const btn = document.getElementById(tab.btnId);
    if (btn) {
      btn.classList.toggle("active", on);
      btn.style.background = on ? "var(--accent, #6aa84f)" : "";
      btn.style.color      = on ? "#fff" : "";
    }
    const sub = document.getElementById(tab.subId);
    if (sub) sub.style.display = on ? "" : "none";
  });
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
  const titleEl  = document.getElementById("plDispTitle");
  const metaEl   = document.getElementById("plDispMeta");
  const detailEl = document.getElementById("plDispDetail");
  const textToggleWrap = document.getElementById("plSentTextToggleWrap");
  if (!titleEl || !metaEl) return;

  const cat   = plCurrentCategory();
  const decl  = (PL_FILTER_DECL[plActiveSource] || {}).fieldDecl || [];
  const ctx   = cat ? cat.currentItem() : null;

  // --- Titelzeile (ueber den Vertrag: cat.title) ---
  let titleText = "";
  if (ctx && cat && typeof cat.title === "function") {
    titleText = cat.title(ctx) || "";
  }
  if (!titleText) {
    titleText = (typeof t === "function") ? t("plDispEmpty") : "Nichts geladen";
  }
  titleEl.textContent = titleText;

  // --- Kern-Meta: role creator / source / license, visibility always ---
  const metaParts = [];
  decl.forEach(function (f) {
    if (f.visibility !== "always") return;
    if (f.role !== "creator" && f.role !== "source" && f.role !== "license") return;
    const val = ctx ? f.getValue(ctx) : "";
    if (val) metaParts.push(val);
  });
  metaEl.textContent = metaParts.join(" · ");

  // --- Detail-Zeile: role detail, visibility always ---
  const detailParts = [];
  decl.forEach(function (f) {
    if (f.visibility !== "always") return;
    if (f.role !== "detail") return;
    const val = ctx ? f.getValue(ctx) : "";
    if (val) detailParts.push(val);
  });
  if (detailEl) {
    if (detailParts.length) {
      detailEl.textContent = detailParts.join(" · ");
      detailEl.style.display = "";
    } else {
      detailEl.textContent = "";
      detailEl.style.display = "none";
    }
  }

  // --- Aufdeckbarer Bereich ---
  // Toggle sichtbar wenn reveal-Felder vorhanden UND ctx != null
  const revealFields = decl.filter(function (f) { return f.visibility === "reveal"; });
  const showTextToggle = revealFields.length > 0 && ctx !== null;
  if (textToggleWrap) textToggleWrap.style.display = showTextToggle ? "inline-flex" : "none";

  const cb = document.getElementById("plSentShowText");
  const tb = document.getElementById("plSentTextBox");
  if (cb) cb.checked = !!plSentShowText;

  const showBox = showTextToggle && !!plSentShowText;
  if (tb) tb.style.display = showBox ? "" : "none";

  if (showBox) {
    const tx = document.getElementById("plSentText");
    if (cat && typeof cat.fillReveal === "function") cat.fillReveal(tx, ctx, revealFields);
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
  if (plAutoAdvance && pPlaying) {
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
  function () { plSetSource("musik"); });
document.getElementById("plSrcSentencesBtn").addEventListener("click",
  function () { plSetSource("saetze"); });
document.getElementById("plSrcNoiseBtn").addEventListener("click",
  function () { plSetSource("geraeusche"); });
document.getElementById("plSrcAudiobookBtn").addEventListener("click",
  function () { plSetSource("hoerbuecher"); });

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
// BA330: Generische Filter-Ketten-Mechanik (Musik + Geraeusche)
// ============================================================

// PL_FILTER_DECL[cat]: Deklaration der Filter-Stages je Kategorie.
// Stages werden von plBuildFilterChain generisch gebaut/verdrahtet.
// collection-sel / chapter-sel / speaker-sel kommen in BA331/332.
var PL_FILTER_DECL = {};

// Generische Mechanik: baut/befuellt/verdrahtet die existierenden DOM-Elemente
// gemaess catDecl. Event-Wiring nur einmalig (Flag catDecl._wired).
function plBuildFilterChain(catDecl) {
  if (!catDecl) return;
  var stages = catDecl.stages || [];

  // Early-Exit-Guard: pruefen ob alle noetigen DOM-Elemente vorhanden sind.
  for (var i = 0; i < stages.length; i++) {
    var st = stages[i];
    if (st.domId) {
      var el = document.getElementById(st.domId);
      if (!el) return;
    }
  }

  // BA342: Fuer die AKTIVE Kategorie zuerst den Zeiger gegen die aktuell
  // gefilterte Liste validieren -> zentrale, einzige Zeiger-Neuwahl (bei Zufall
  // gewuerfelt), bevor die Dropdown-Werte gesetzt werden. Die Stage-Eigenwahl
  // (item-sel/collection-sel visible[0]) bleibt nur Fallback fuer INAKTIVE
  // Kategorien.
  if (catDecl.category === plActiveSource && typeof plNavEnsureCursor === "function") {
    plNavEnsureCursor();
  }

  // --- Befuellen / Label-Refresh ---
  for (var si = 0; si < stages.length; si++) {
    var stage = stages[si];
    if (!stage.domId) continue;
    var domEl = document.getElementById(stage.domId);
    if (!domEl) continue;

    if (stage.kind === "axis-sel") {
      // Sortier-Achsen-Dropdown
      var axesFn = stage.axesSource || (typeof amSortAxesFor === "function" ? amSortAxesFor : null);
      var axes = axesFn ? axesFn(catDecl.category) : [];
      if (domEl.options.length === 0) {
        // Erste Befuellung: Optionen erzeugen
        for (var ai = 0; ai < axes.length; ai++) {
          var a = axes[ai];
          var opt = document.createElement("option");
          opt.value = a.key;
          opt.textContent = (typeof t === "function") ? t(a.labelKey) : a.labelDefault;
          domEl.appendChild(opt);
        }
        domEl.value = catDecl.stateRef.getSortAxis();
      } else {
        // Spater: nur Labels aktualisieren
        for (var oi = 0; oi < domEl.options.length; oi++) {
          var op = domEl.options[oi];
          var ax = axes.find(function (x) { return x.key === op.value; });
          if (ax) op.textContent = (typeof t === "function") ? t(ax.labelKey) : ax.labelDefault;
        }
      }

    } else if (stage.kind === "bucket-sel") {
      // Kategorie-Dropdown (abhaengig von aktueller Sortier-Achse)
      var allItems = (typeof amCollectItems === "function") ? amCollectItems(catDecl.category) : [];
      var buckets = (typeof amBucketsForAxis === "function")
        ? amBucketsForAxis(catDecl.category, catDecl.stateRef.getSortAxis(), allItems) : [];
      var prevCatVal = catDecl.stateRef.getCategory();
      // Immer neu aufbauen (bucket-Liste haengt von Achse ab)
      while (domEl.firstChild) domEl.removeChild(domEl.firstChild);
      var optAll2 = document.createElement("option");
      optAll2.value = "_all";
      optAll2.textContent = (typeof t === "function") ? t(stage.allLabelKey || "plCatAll") : "(alle)";
      domEl.appendChild(optAll2);
      for (var bi = 0; bi < buckets.length; bi++) {
        var bk = buckets[bi];
        var bopt = document.createElement("option");
        bopt.value = bk;
        bopt.textContent = bk;
        domEl.appendChild(bopt);
      }
      if (buckets.indexOf(prevCatVal) >= 0 || prevCatVal === "_all") {
        domEl.value = prevCatVal;
      } else {
        domEl.value = "_all";
        catDecl.stateRef.setCategory("_all");
      }
      domEl.disabled = (buckets.length === 0);
      domEl.style.opacity = domEl.disabled ? "0.5" : "1";

    } else if (stage.kind === "search") {
      // Suchfeld: nur schreiben wenn nicht fokussiert
      if (document.activeElement !== domEl) {
        domEl.value = catDecl.stateRef.getSearchQuery() || "";
      }

    } else if (stage.kind === "item-sel") {
      // Item-Dropdown aus gefilterter/sortierter Sicht
      var emptyEl = stage.emptyDomId ? document.getElementById(stage.emptyDomId) : null;
      var visible = catDecl.visibleItems();
      while (domEl.firstChild) domEl.removeChild(domEl.firstChild);
      for (var vi = 0; vi < visible.length; vi++) {
        var vit = visible[vi];
        var vopt = document.createElement("option");
        vopt.value = vit.id;
        vopt.textContent = stage.getItemLabel ? stage.getItemLabel(vit) : (vit.title || vit.id);
        domEl.appendChild(vopt);
      }
      if (visible.length === 0) {
        if (emptyEl) emptyEl.style.display = "";
        domEl.disabled = true;
        if (stage.onEmpty) stage.onEmpty();
      } else {
        if (emptyEl) emptyEl.style.display = "none";
        domEl.disabled = false;
        var hasId = visible.some(function (x) { return x.id === catDecl.stateRef.getSelectedId(); });
        if (!hasId) {
          catDecl.stateRef.setSelectedId(visible[0].id);
        }
        domEl.value = catDecl.stateRef.getSelectedId();
      }

    } else if (stage.kind === "collection-sel") {
      // Sammlung-Dropdown (Hoerbuch: sortierte Liste aller Collections)
      var colEmptyEl = stage.emptyDomId ? document.getElementById(stage.emptyDomId) : null;
      var allCols = (typeof amCollectCollections === "function")
        ? amCollectCollections(catDecl.category) : [];
      // BA336: Vor-Filter nach Inhalts-Sprache fuer sprach-sensible Kategorien
      if (catDecl.languageSensitive) {
        var _cLang = (typeof plContentLang !== "undefined") ? plContentLang : "de";
        allCols = allCols.filter(function (c) { return !c.lang || c.lang === _cLang; });
      }
      var sortedCols = (typeof amSortCollections === "function")
        ? amSortCollections(allCols, catDecl.category, catDecl.stateRef.getSortAxis())
        : allCols;
      while (domEl.firstChild) domEl.removeChild(domEl.firstChild);
      for (var ci = 0; ci < sortedCols.length; ci++) {
        var coll = sortedCols[ci];
        var copt = document.createElement("option");
        copt.value = coll.id;
        copt.textContent = coll.title || coll.id;
        domEl.appendChild(copt);
      }
      if (sortedCols.length === 0) {
        if (colEmptyEl) colEmptyEl.style.display = "";
        catDecl.stateRef.setSelectedId(null);
      } else {
        if (colEmptyEl) colEmptyEl.style.display = "none";
        var curColId = catDecl.stateRef.getSelectedId();
        var colExists = sortedCols.some(function (c) { return c.id === curColId; });
        if (!colExists) {
          catDecl.stateRef.setSelectedId(sortedCols[0].id);
        }
        domEl.value = catDecl.stateRef.getSelectedId();
      }

    } else if (stage.kind === "chapter-sel") {
      // Kapitel-Dropdown (Hoerbuch: Kapitel der aktuell gewaehlten Collection)
      var curCol = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
      while (domEl.firstChild) domEl.removeChild(domEl.firstChild);
      if (curCol && Array.isArray(curCol.items)) {
        for (var ki = 0; ki < curCol.items.length; ki++) {
          var kopt = document.createElement("option");
          kopt.value = String(ki);
          kopt.textContent = (ki + 1) + ". " + (curCol.items[ki].title || ("Kapitel " + (ki + 1)));
          domEl.appendChild(kopt);
        }
        var chIdx = catDecl.stateRef.getChapterIdx();
        if (chIdx >= curCol.items.length) {
          chIdx = 0;
          catDecl.stateRef.setChapterIdx(0);
        }
        domEl.value = String(chIdx);
      }

    } else if (stage.kind === "speaker-sel") {
      // Sprecher-Dropdown (Saetze): speakerMap aus amCollectItems gefiltert nach Inhalts-Sprache
      var spkAll = (typeof amCollectItems === "function") ? amCollectItems("saetze") : [];
      var spkLang = (typeof plContentLang !== "undefined") ? plContentLang : "de";
      var spkInLang = spkAll.filter(function (it) {
        // BA351: lang_any-Items (Dateiupload) immer sichtbar
        return it.tags && (it.tags.lang === spkLang || it.tags.lang_any === "y");
      });
      // speakerMap aufbauen (Reihenfolge stabil: nach erstem Auftreten)
      var speakerMap = new Map();
      for (var spki = 0; spki < spkInLang.length; spki++) {
        var spkit = spkInLang[spki];
        var spkid = spkit.tags.speaker_id || "unbekannt";
        if (!speakerMap.has(spkid)) {
          speakerMap.set(spkid, {
            label: spkit.title || spkid,
            sourceTitle: spkit.sourceTitle || ""
          });
        }
      }
      while (domEl.firstChild) domEl.removeChild(domEl.firstChild);
      var optAny = document.createElement("option");
      optAny.value = "any";
      optAny.textContent = (typeof t === "function") ? t("sentSpkAll") : "Alle";
      domEl.appendChild(optAny);
      speakerMap.forEach(function (meta, sid) {
        var sopt = document.createElement("option");
        sopt.value = sid;
        sopt.textContent = (meta.sourceTitle && meta.sourceTitle !== meta.label)
          ? (meta.label + " — " + meta.sourceTitle)
          : meta.label;
        domEl.appendChild(sopt);
      });
      // Auswahl wiederherstellen: State-Wert, falls noch gueltig
      var prevSpk = catDecl.stateRef.getSpeakerSel();
      var spkKeys = Array.from(speakerMap.keys());
      if (spkKeys.indexOf(prevSpk) >= 0 || prevSpk === "any") {
        domEl.value = prevSpk;
      } else {
        domEl.value = "any";
        catDecl.stateRef.setSpeakerSel("any");
      }
    } else if (stage.kind === "upload") {
      // BA349: Upload-Box generisch rendern + verdrahten (einmalig).
      if (domEl.childElementCount === 0) {
        var _fBtn = stage.domId + "-folder-btn";
        var _xBtn = stage.domId + "-file-btn";
        var _fIn  = stage.domId + "-folder-in";
        var _xIn  = stage.domId + "-file-in";
        var html = "";
        html += "<div class=\"pl-upload-title\" data-t=\"" + stage.titleKey + "\"></div>";
        html += "<div class=\"pl-upload-btns\">";
        if (stage.allowFolder) {
          html += "<button class=\"btn\" type=\"button\" id=\"" + _fBtn + "\" style=\"font-size:0.85em\">"
                + "<span data-t=\"" + stage.folderLabelKey + "\"></span></button>";
        }
        if (stage.allowFile) {
          html += "<button class=\"btn\" type=\"button\" id=\"" + _xBtn + "\" style=\"font-size:0.85em\">"
                + "<span data-t=\"" + stage.fileLabelKey + "\"></span></button>";
        }
        html += "</div>";
        if (stage.allowFolder) {
          html += "<input type=\"file\" id=\"" + _fIn + "\" webkitdirectory multiple style=\"display:none\" />";
        }
        if (stage.allowFile) {
          html += "<input type=\"file\" id=\"" + _xIn + "\" accept=\""
                + (stage.accept || ".mp3,.wav,.flac,.ogg,.m4a,.mp4,audio/*") + "\" style=\"display:none\" />";
        }
        domEl.innerHTML = html;
        if (typeof applyLang === "function") applyLang();
        plWireUploadBlock({
          allowFolder: !!stage.allowFolder,
          addBtnId:    _fBtn,
          folderInputId: _fIn,
          onFolder:    stage.onFolder,
          allowFile:   !!stage.allowFile,
          fileBtnId:   _xBtn,
          fileInputId: _xIn,
          onFile:      stage.onFile
        });
      }
    }
  }

  // Nach vollstaendigem Refresh: kategorie-spezifische Callbacks
  if (catDecl.afterRefresh) catDecl.afterRefresh();

  // --- Event-Wiring (einmalig) ---
  if (catDecl._wired) return;
  catDecl._wired = true;

  for (var wi = 0; wi < stages.length; wi++) {
    (function (wstage) {
      if (!wstage.domId) return;
      var wel = document.getElementById(wstage.domId);
      if (!wel) return;

      if (wstage.kind === "axis-sel") {
        wel.addEventListener("change", function () {
          _plNavApplyFilterChange(catDecl, function () {
            catDecl.stateRef.setSortAxis(wel.value);
            catDecl.stateRef.setCategory("_all"); // Achswechsel resettet Kategorie
          });
        });

      } else if (wstage.kind === "bucket-sel") {
        wel.addEventListener("change", function () {
          _plNavApplyFilterChange(catDecl, function () {
            catDecl.stateRef.setCategory(wel.value);
          });
        });

      } else if (wstage.kind === "search") {
        wel.addEventListener("input", function () {
          _plNavApplyFilterChange(catDecl, function () {
            catDecl.stateRef.setSearchQuery(wel.value || "");
          });
        });

      } else if (wstage.kind === "item-sel") {
        wel.addEventListener("change", function () {
          catDecl.stateRef.setSelectedId(wel.value);
          if (wstage.onItemSelect) wstage.onItemSelect(wel.value);
        });

      } else if (wstage.kind === "collection-sel") {
        wel.addEventListener("change", function () {
          if (wstage.onCollectionSelect) wstage.onCollectionSelect(wel.value);
          else {
            catDecl.stateRef.setSelectedId(wel.value);
            plBuildFilterChain(catDecl);
          }
        });

      } else if (wstage.kind === "chapter-sel") {
        wel.addEventListener("change", function () {
          var idx = parseInt(wel.value, 10) || 0;
          catDecl.stateRef.setChapterIdx(idx);
          if (wstage.onChapterSelect) wstage.onChapterSelect(idx);
        });

      } else if (wstage.kind === "speaker-sel") {
        wel.addEventListener("change", function () {
          _plNavApplyFilterChange(catDecl, function () {
            catDecl.stateRef.setSpeakerSel(wel.value);
          });
          if (wstage.onSpeakerSelect) wstage.onSpeakerSelect(wel.value);
        });
      }
    })(stages[wi]);
  }

  // Zusaetzliches Extra-Wiring je Kategorie (z.B. Ordner-Upload fuer Musik)
  if (catDecl.extraWiring) catDecl.extraWiring();
}

// ============================================================
// BA336: Inhalts-Sprache Setter/Getter
// Setzt plContentLang, persistiert in localStorage, loest sprach-sensible Refreshes aus.
function plSetContentLang(code) {
  if (typeof plContentLang !== "undefined") plContentLang = code;
  try { localStorage.setItem("ci-lb-content-lang", code); } catch (e) {}
  if (typeof sUpdateUI === "function") sUpdateUI();
  if (typeof plBookRefreshUI === "function") plBookRefreshUI();
  plUpdContentLangBtn();
}

function plGetContentLang() {
  return (typeof plContentLang !== "undefined") ? plContentLang : "de";
}

// ============================================================
// BA337: Flaggen-Modalbox — Sprach-Maps, Helfer, Modal-Logik
// ============================================================

var LANG_TO_FLAG = {
  "de": "🇩🇪",  // DE
  "en": "🇬🇧",  // GB
  "en-GB": "🇬🇧",
  "en-US": "🇺🇸",
  "es": "🇪🇸",  // ES
  "fr": "🇫🇷",  // FR
  "it": "🇮🇹",  // IT
  "pt": "🇵🇹",  // PT
  "pt-BR": "🇧🇷",
  "nl": "🇳🇱",  // NL
  "pl": "🇵🇱",  // PL
  "ru": "🇷🇺",  // RU
  "tr": "🇹🇷",  // TR
  "sv": "🇸🇪",  // SE
  "da": "🇩🇰",  // DK
  "fi": "🇫🇮",  // FI
  "nb": "🇳🇴",  // NO
  "no": "🇳🇴",
  "cs": "🇨🇿",  // CZ
  "sk": "🇸🇰",  // SK
  "hu": "🇭🇺",  // HU
  "ro": "🇷🇴",  // RO
  "bg": "🇧🇬",  // BG
  "hr": "🇭🇷",  // HR
  "sr": "🇷🇸",  // RS
  "el": "🇬🇷",  // GR
  "ar": "🇸🇦",  // SA
  "he": "🇮🇱",  // IL
  "zh": "🇨🇳",  // CN
  "zh-CN": "🇨🇳",
  "zh-TW": "🇹🇼",
  "ja": "🇯🇵",  // JP
  "ko": "🇰🇷"   // KR
};

var LANG_NAMES = {
  "de": "Deutsch",
  "en": "English",
  "en-GB": "English (UK)",
  "en-US": "English (US)",
  "es": "Español",
  "fr": "Français",
  "it": "Italiano",
  "pt": "Português",
  "pt-BR": "Português (BR)",
  "nl": "Nederlands",
  "pl": "Polski",
  "ru": "Русский",
  "tr": "Türkçe",
  "sv": "Svenska",
  "da": "Dansk",
  "fi": "Suomi",
  "nb": "Norsk",
  "no": "Norsk",
  "cs": "Čeština",
  "sk": "Slovenčina",
  "hu": "Magyar",
  "ro": "Română",
  "bg": "Български",
  "hr": "Hrvatski",
  "sr": "Srpski",
  "el": "Ελληνικά",
  "ar": "العربية",
  "he": "עברית",
  "zh": "中文",
  "zh-CN": "中文（简体）",
  "zh-TW": "中文（繁體）",
  "ja": "日本語",
  "ko": "한국어"
};

// Gibt die Flaggen-Emoji fuer einen BCP-47-Code zurueck.
// Exaktes Match -> LANG_TO_FLAG[code]; Primary-Tag-Fallback; sonst Globus.
function plLangFlag(code) {
  if (!code) return "🌐";
  if (LANG_TO_FLAG[code]) return LANG_TO_FLAG[code];
  var primary = code.split("-")[0].toLowerCase();
  if (LANG_TO_FLAG[primary]) return LANG_TO_FLAG[primary];
  return "🌐";
}

// Gibt den ausgeschriebenen Sprachnamen zurueck (exakt oder Primary-Tag-Fallback oder code).
function plLangName(code) {
  if (!code) return code;
  if (LANG_NAMES[code]) return LANG_NAMES[code];
  var primary = code.split("-")[0].toLowerCase();
  if (LANG_NAMES[primary]) return LANG_NAMES[primary];
  return code;
}

// Gibt ein Array der verfuegbaren Inhalts-Sprachen zurueck (Codes, dedupliziert).
// Quellen: tags.lang aus saetze-Items + col.lang aus hoerbuecher-Collections.
function plContentLangAvailable() {
  var seen = {};
  var out = [];
  function add(code) {
    if (!code || code === "zzz-unbekannt" || seen[code]) return;
    seen[code] = true;
    out.push(code);
  }
  if (typeof amCollectItems === "function") {
    var items = amCollectItems("saetze");
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it && it.tags && it.tags.lang) add(it.tags.lang);
    }
  }
  if (typeof amCollectCollections === "function") {
    var cols = amCollectCollections("hoerbuecher");
    for (var j = 0; j < cols.length; j++) {
      var c = cols[j];
      if (c && c.lang) add(c.lang);
    }
  }
  out.sort(function (a, b) {
    var known = Object.keys(LANG_NAMES);
    var ia = known.indexOf(a);
    var ib = known.indexOf(b);
    if (ia < 0 && ib < 0) return a < b ? -1 : a > b ? 1 : 0;
    if (ia < 0) return 1;
    if (ib < 0) return -1;
    return ia - ib;
  });
  return out;
}

// Aktualisiert den Beschriftungs-Knopf mit aktueller Sprache.
function plUpdContentLangBtn() {
  var btn = document.getElementById("plContentLangBtn");
  if (!btn) return;
  var code = plGetContentLang();
  btn.textContent = plLangFlag(code) + " " + plLangName(code) + " ▾";
}

// Oeffnet die Flaggen-Modalbox.
function plOpenContentLangModal() {
  var modal = document.getElementById("plContentLangModal");
  if (!modal) return;
  var listEl = document.getElementById("plContentLangList");
  var searchEl = document.getElementById("plContentLangSearch");
  if (searchEl) searchEl.value = "";
  // Liste aufbauen
  if (listEl) {
    listEl.innerHTML = "";
    var langs = plContentLangAvailable();
    var currentCode = plGetContentLang();
    if (langs.length === 0) {
      var emptyEl = document.createElement("div");
      emptyEl.style.cssText = "padding:10px;color:var(--text-muted);text-align:center;font-size:0.9em";
      emptyEl.setAttribute("data-t", "plContentLangEmpty");
      emptyEl.textContent = (typeof t === "function") ? t("plContentLangEmpty") : "—";
      listEl.appendChild(emptyEl);
    } else {
      for (var i = 0; i < langs.length; i++) {
        (function (code) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn btn-sm pl-lang-btn";
          btn.dataset.langCode = code;
          btn.textContent = plLangFlag(code) + " " + plLangName(code) +
            (LANG_TO_FLAG[code] || LANG_TO_FLAG[code.split("-")[0]] ? "" : " (" + code + ")");
          if (code === currentCode) {
            btn.style.cssText = "border-color:var(--accent);color:var(--accent);font-weight:600";
          }
          btn.addEventListener("click", function () {
            plSetContentLang(code);
            plCloseContentLangModal();
          });
          listEl.appendChild(btn);
        })(langs[i]);
      }
    }
    // Suchfeld-Filter verdrahten
    if (searchEl) {
      searchEl.oninput = function () {
        var q = searchEl.value.trim().toLowerCase();
        var btns = listEl.querySelectorAll(".pl-lang-btn");
        for (var k = 0; k < btns.length; k++) {
          var code2 = btns[k].dataset.langCode || "";
          var name2 = plLangName(code2).toLowerCase();
          var match = !q || name2.indexOf(q) >= 0 || code2.toLowerCase().indexOf(q) >= 0;
          btns[k].style.display = match ? "" : "none";
        }
      };
    }
  }
  modal.classList.add("active");
}

// Schliesst die Flaggen-Modalbox.
function plCloseContentLangModal() {
  var modal = document.getElementById("plContentLangModal");
  if (modal) modal.classList.remove("active");
}

// BA334: gemeinsamer Upload-Block-Verdrahter
// ============================================================
// Verdrahtet Klick-auf-Button -> Input-Oeffnen, und change -> Callback.
// spec: { fileInputId, folderInputId, addBtnId, allowFile, allowFolder,
//         onFile(file), onFolder(fileList) }
function plWireUploadBlock(spec) {
  if (spec.allowFile && spec.fileInputId) {
    var fileEl = document.getElementById(spec.fileInputId);
    if (fileEl) {
      // BA349: optionaler Knopf, der die versteckte Datei-Eingabe oeffnet
      if (spec.fileBtnId) {
        var fileBtn = document.getElementById(spec.fileBtnId);
        if (fileBtn) {
          fileBtn.addEventListener("click", function () {
            fileEl.value = "";
            fileEl.click();
          });
        }
      }
      fileEl.addEventListener("change", async function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        e.target.value = "";
        try {
          if (spec.onFile) await spec.onFile(f);
        } catch (err) {
          console.error("[plWireUploadBlock] onFile failed:", err);
        }
      });
    }
  }
  if (spec.allowFolder && spec.folderInputId && spec.addBtnId) {
    var addBtn = document.getElementById(spec.addBtnId);
    var folderEl = document.getElementById(spec.folderInputId);
    if (addBtn && folderEl) {
      addBtn.addEventListener("click", function () {
        folderEl.value = "";
        folderEl.click();
      });
      folderEl.addEventListener("change", async function (e) {
        try {
          if (spec.onFolder) await spec.onFolder(e.target.files);
        } catch (err) {
          console.error("[plWireUploadBlock] onFolder failed:", err);
        }
      });
    }
  }
}

// Deklaration: Musik
PL_FILTER_DECL.musik = {
  category: "musik",
  _wired: false,
  fieldDecl: [
    { key: "title",   labelKey: "plDispFieldTitle",   getValue: function (ctx) { return ctx.title   || ""; }, role: "title",   inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "artist",  labelKey: "plDispFieldArtist",  getValue: function (ctx) { return ctx.artist  || ""; }, role: "creator", inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "album",   labelKey: "plDispFieldAlbum",   getValue: function (ctx) { return ctx.album   || ""; }, role: "detail",  inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "genre",   labelKey: "plDispFieldGenre",   getValue: function (ctx) { return ctx.genre   || ""; }, role: "detail",  inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "year",    labelKey: "plDispFieldYear",    getValue: function (ctx) { return ctx.year    || ""; }, role: "detail",  inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "source",  labelKey: "plDispFieldSource",  getValue: function (ctx) { return ctx.source  || ""; }, role: "source",  inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "license", labelKey: "plDispFieldLicense", getValue: function (ctx) { return ctx.license || ""; }, role: "license", inFilter: false, inDisplay: true,  visibility: "always" }
  ],
  stateRef: {
    getSortAxis:    function () { return plMusicSortAxis; },
    setSortAxis:    function (v) { plMusicSortAxis = v; },
    getCategory:    function () { return plMusicCategory; },
    setCategory:    function (v) { plMusicCategory = v; },
    getSearchQuery: function () { return plMusicSearchQuery; },
    setSearchQuery: function (v) { plMusicSearchQuery = v; },
    getSelectedId:  function () { return plMusicSelectedId; },
    setSelectedId:  function (v) { plMusicSelectedId = v; }
  },
  visibleItems: function () { return plMusicVisibleItems(); },
  stages: [
    {
      id: "upload", kind: "upload", domId: "plMusicUpload",
      allowFile: true, allowFolder: true,
      titleKey: "plUploadTitle",
      folderLabelKey: "plUploadFolder", fileLabelKey: "plUploadFile",
      accept: ".mp3,.wav,.flac,.ogg,.m4a,.mp4,audio/*",
      onFile: async function (file) {
        var it = (typeof amMusicAddLocalFile === "function") ? amMusicAddLocalFile(file) : null;
        if (it) plMusicSelectedId = it.id;
        plMusicRefreshUI();
        if (plActiveSource === "musik") plMusicLoadSelected();
      },
      onFolder: async function (fileList) {
        var res = await amMusicIngestLocalFolder(fileList);
        if (res && res.cid) {
          var visible = plMusicVisibleItems();
          var firstOfFolder = visible.find(function (x) {
            return typeof x.audio === "string"
              && x.audio.indexOf("local-music-folder:" + res.cid + ":") === 0;
          });
          if (firstOfFolder) plMusicSelectedId = firstOfFolder.id;
        }
        plMusicRefreshUI();
      }
    },
    {
      id: "sort", kind: "axis-sel", domId: "plMusicSortSel"
    },
    {
      id: "cat", kind: "bucket-sel", domId: "plMusicCatSel",
      allLabelKey: "plMusicCatAll"
    },
    {
      id: "search", kind: "search", domId: "plMusicSearchInput"
    },
    {
      id: "item", kind: "item-sel", domId: "plMusicItemSel",
      emptyDomId: "plMusicEmpty",
      getItemLabel: function (it) { return _plMusicTrackLabel(it); },
      onEmpty: function () { plMusicSelectedId = null; },
      onItemSelect: function (id) { plMusicSetSelected(id); }
    }
  ],
  afterRefresh: function () {
    if (typeof plUpdTransportUI === "function") plUpdTransportUI();
    if (typeof plUpdDisplay     === "function") plUpdDisplay();
  },
  extraWiring: function () {
    plMusicRefreshUI();
  }
};

// Deklaration: Geraeusche
PL_FILTER_DECL.geraeusche = {
  category: "geraeusche",
  _wired: false,
  fieldDecl: [
    { key: "index",    labelKey: "plDispFieldIndex",    getValue: function (ctx) { return ctx.index    || ""; }, role: "title",   inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "name",     labelKey: "plDispFieldNoiseName", getValue: function (ctx) { return ctx.name    || ""; }, role: "detail",  inFilter: false, inDisplay: true,  visibility: "reveal" },
    { key: "kind",     labelKey: "plDispFieldNoiseKind", getValue: function (ctx) { return ctx.kind    || ""; }, role: "detail",  inFilter: false, inDisplay: true,  visibility: "reveal" },
    { key: "spectrum", labelKey: "plDispFieldSpectrum",  getValue: function (ctx) { return ctx.spectrum || ""; }, role: "detail",  inFilter: false, inDisplay: true,  visibility: "reveal" },
    { key: "source",   labelKey: "plDispFieldSource",    getValue: function (ctx) { return ctx.source  || ""; }, role: "source",  inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "license",  labelKey: "plDispFieldLicense",   getValue: function (ctx) { return ctx.license || ""; }, role: "license", inFilter: false, inDisplay: true,  visibility: "always" }
  ],
  stateRef: {
    getSortAxis:    function () { return plNoiseSortAxis; },
    setSortAxis:    function (v) { plNoiseSortAxis = v; },
    getCategory:    function () { return plNoiseCategory; },
    setCategory:    function (v) { plNoiseCategory = v; },
    getSearchQuery: function () { return plNoiseSearchQuery; },
    setSearchQuery: function (v) { plNoiseSearchQuery = v; },
    getSelectedId:  function () { return plNoiseSelectedId; },
    setSelectedId:  function (v) { plNoiseSelectedId = v; }
  },
  visibleItems: function () { return plNoiseVisibleItems(); },
  stages: [
    {
      id: "upload", kind: "upload", domId: "plNoiseUpload",
      allowFile: true, allowFolder: true,
      titleKey: "plUploadTitle",
      folderLabelKey: "plUploadFolder", fileLabelKey: "plUploadFile",
      accept: ".mp3,.wav,.flac,.ogg,.m4a,.mp4,audio/*",
      onFile: async function (file) {
        var it = (typeof amNoiseAddLocalFile === "function") ? amNoiseAddLocalFile(file) : null;
        if (it) plNoiseSelectedId = it.id;
        plNoiseRefreshUI();
        if (plActiveSource === "geraeusche") await plNoiseLoadSelected();
      },
      onFolder: async function (fileList) {
        var res = (typeof amNoiseIngestLocalFolder === "function")
          ? await amNoiseIngestLocalFolder(fileList) : null;
        if (res && res.cid) {
          var visible = plNoiseVisibleItems();
          var firstOfFolder = visible.find(function (x) {
            return typeof x.audio === "string"
              && x.audio.indexOf("local-noise-folder:" + res.cid + ":") === 0;
          });
          if (firstOfFolder) plNoiseSelectedId = firstOfFolder.id;
        }
        plNoiseRefreshUI();
      }
    },
    {
      id: "sort", kind: "axis-sel", domId: "plNoiseSortSel"
    },
    {
      id: "cat", kind: "bucket-sel", domId: "plNoiseCatSel",
      allLabelKey: "plNoiseCatAll"
    },
    {
      id: "search", kind: "search", domId: "plNoiseSearchInput"
    },
    {
      id: "item", kind: "item-sel", domId: "plNoiseItemSel",
      emptyDomId: "plNoiseEmpty",
      getItemLabel: function (it) { return it.title || it.id; },
      onItemSelect: function (id) {
        if (plActiveSource !== "geraeusche") { plNoiseSelectedId = id; return; }
        var item = (typeof plNoiseVisibleItems === "function")
          ? plNoiseVisibleItems().find(function (it) { return it.id === id; })
          : null;
        if (item) _plNavGoTo(item);
      }
    }
  ],
  afterRefresh: function () {
    if (typeof plSentBgRefreshUI === "function") plSentBgRefreshUI();
  },
  extraWiring: function () {
    plNoiseRefreshUI();
  }
};

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
  plBuildFilterChain(PL_FILTER_DECL.geraeusche);
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
  pSetPlaybackMode("geraeusche");
  pOff = 0;
  if (typeof plUpdDisplay     === "function") plUpdDisplay();
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
  pBuildEQ();
  pDrawEQ();
  document.getElementById("plEqViz").style.display = "";
}

// ============================================================
// BA260: Musik-Bibliothek (UI + Wiedergabe-Anbindung)
// ============================================================

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
  plBuildFilterChain(PL_FILTER_DECL.musik);
}

// Laedt das aktuell ausgewaehlte Musik-Item in pFileBuf und ruft pBuildEQ.
// Lokaler Upload (audio === "local-music-folder:...", inkl. Sammlung "upload"
// fuer Einzeldateien) nutzt das File-Objekt; sonstige Items (Webspace) per fetch.
async function plMusicLoadSelected() {
  const it = plMusicCurrentItem();
  if (!it) return;
  const c = gPC();
  try {
    let arrayBuf;
    if (typeof it.audio === "string" && it.audio.indexOf("local-music-folder:") === 0) {
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
    pSetPlaybackMode("musik");
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

// Wahl im Item-Dropdown -> ueber die zentrale Engine (select/load/Play).
function plMusicSetSelected(id) {
  if (!id) return;
  const item = plMusicAllItems().find(function (it) { return it.id === id; });
  if (!item) return;
  _plNavGoTo(item);
}

// Erstaufbau Musik-UI (Wiring + initiale Befuellung via plBuildFilterChain)
plMusicRefreshUI();

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
  const allFiles = Array.from(fileList || []);
  // BA335: PDF im fileList per Endung erkennen (f.type ist bei webkitdirectory unzuverlaessig)
  const pdfFile = allFiles.find(function (f) { return /\.pdf$/i.test(f.name); });

  const files = allFiles.filter(function (f) {
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

  // BA335: Einzeldatei-Fallback — kein Pfad-Separator → Werktitel aus Dateiname
  const firstPath = files[0].webkitRelativePath || files[0].name;
  const folderName = (firstPath.indexOf("/") >= 0)
    ? firstPath.split("/")[0]
    : files[0].name.replace(/\.[^.]+$/, "");

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
    // BA335: PDF per Endung erkannt; URL.createObjectURL nur wenn vorhanden (kein Button/Anzeige)
    pdfUrl: pdfFile ? URL.createObjectURL(pdfFile) : null,
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

// Deklaration: Hoerbuecher
PL_FILTER_DECL.hoerbuecher = {
  category: "hoerbuecher",
  languageSensitive: true,
  _wired: false,
  fieldDecl: [
    { key: "chapter", labelKey: "plDispFieldChapter",  getValue: function (ctx) { return ctx.chapter  || ""; }, role: "title",   inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "work",    labelKey: "plDispFieldWork",     getValue: function (ctx) { return ctx.work     || ""; }, role: "source",  inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "author",  labelKey: "plDispFieldAuthor",   getValue: function (ctx) { return ctx.author   || ""; }, role: "creator", inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "reader",  labelKey: "plDispFieldReader",   getValue: function (ctx) { return ctx.reader   || ""; }, role: "creator", inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "lang",    labelKey: "plDispFieldLang",     getValue: function (ctx) { return ctx.lang     || ""; }, role: "detail",  inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "license", labelKey: "plDispFieldLicense",  getValue: function (ctx) { return ctx.license  || ""; }, role: "license", inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "pdfUrl",  labelKey: "plDispFieldPdf",      getValue: function (ctx) { return ctx.pdfUrl   || ""; }, role: "pdf",     inFilter: false, inDisplay: false, visibility: "never"  }
  ],
  stateRef: {
    getSortAxis:   function () { return plBookSortAxis; },
    setSortAxis:   function (v) { plBookSortAxis = v; },
    getSelectedId: function () { return plBookSelectedId; },
    setSelectedId: function (v) { plBookSelectedId = v; },
    getChapterIdx: function () { return plBookChapterIdx; },
    setChapterIdx: function (v) { plBookChapterIdx = v; }
  },
  stages: [
    {
      id: "upload", kind: "upload", domId: "plBookUploadBox",
      allowFile: true, allowFolder: true,
      titleKey: "plUploadTitle",
      folderLabelKey: "plUploadBookFolder", fileLabelKey: "plUploadBookFile",
      accept: ".mp3,.wav,.flac,.ogg,.m4a,.mp4,audio/*",
      onFile: async function (file) {
        await plBookHandleUpload([file]);
      },
      onFolder: async function (fileList) {
        await plBookHandleUpload(fileList);
      }
    },
    {
      id: "sort", kind: "axis-sel", domId: "plBookSortSel",
      axesSource: (typeof amCollectionSortAxesFor === "function") ? amCollectionSortAxesFor : null
    },
    {
      id: "collection", kind: "collection-sel", domId: "plBookSel",
      emptyDomId: "plBookEmpty",
      onCollectionSelect: function (id) {
        plBookSavePosition();
        plBookSelectedId = id;
        var pos = plBookPositions && plBookPositions[id];
        plBookChapterIdx = (pos && typeof pos.chapterIdx === "number") ? pos.chapterIdx : 0;
        plBuildFilterChain(PL_FILTER_DECL.hoerbuecher);
        if (plActiveSource === "hoerbuecher") plBookLoadSelected();
      }
    },
    {
      id: "chapter", kind: "chapter-sel", domId: "plBookChSel",
      onChapterSelect: function (idx) {
        plBookSavePosition();
        var col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
        var item = (col && Array.isArray(col.items)) ? col.items[idx] : null;
        if (plActiveSource !== "hoerbuecher") {
          plBookChapterIdx = idx;
          if (typeof plUpdDisplay === "function") plUpdDisplay();
          return;
        }
        if (item) _plNavGoTo(item);
        else if (typeof plUpdDisplay === "function") plUpdDisplay();
      }
    }
  ],
  afterRefresh: function () {
    if (typeof plUpdDisplay === "function") plUpdDisplay();
  }
};

// Buendelt die vier Bibliotheks-Listen-Refresher in fester Reihenfolge.
// Gruppe E des zentralen Player-Sync (siehe 00-player-sync-architektur.md).
// Jeder Refresher ist parameterlos und idempotent.
function plSyncLibraries() {
  if (typeof plMusicRefreshUI  === "function") plMusicRefreshUI();
  if (typeof plNoiseRefreshUI  === "function") plNoiseRefreshUI();
  if (typeof plSentBgRefreshUI === "function") plSentBgRefreshUI();
  if (typeof plBookRefreshUI   === "function") plBookRefreshUI();
}

// ============================================================
// ZENTRALER PLAYER-UI-SYNC (00-player-sync-architektur.md)
// ------------------------------------------------------------
// Zeichnet die gesamte sichtbare Player-Oberflaeche deterministisch aus
// dem State, unabhaengig vom ausloesenden Ereignis. Ebene 1 (UI-Spiegelung)
// laeuft IMMER in fester Reihenfolge; Ebene 2 (teure Audio-Neuberechnung)
// nur auf ausdrueckliche Anforderung via Flags. Graph zuletzt.
//
// HINWEIS BA388: Die Einzelfunktionen rufen aktuell teils noch einander auf
// (Verschachtelung). Das ist harmlos (alle idempotent) und wird in BA390
// aufgeloest, sobald alle externen Aufrufstellen auf plSyncUI umgestellt sind.
// ============================================================
function plSyncUI(opts) {
  opts = opts || {};
  var rebuildEQ     = !!opts.rebuildEQ;
  var rebuildSide   = !!opts.rebuildSide;
  var retriggerWarp = !!opts.retriggerWarp;

  // --- Ebene 1: UI-Spiegelung (immer, feste Reihenfolge) ---

  // A. Grundgeruest der Box
  if (typeof plUpdMasterVisibility === "function") plUpdMasterVisibility();
  if (typeof updEqToggleBtn        === "function") updEqToggleBtn();
  if (typeof updPlSrcButtons       === "function") updPlSrcButtons();

  // B. Korrektur-Optionen
  if (typeof plUpdHeadroomBox === "function") plUpdHeadroomBox();
  if (typeof plUpdMonoBox     === "function") plUpdMonoBox();
  if (typeof updBalApplyBtn   === "function") updBalApplyBtn();
  if (typeof updLatApplyBtn   === "function") updLatApplyBtn();
  if (typeof pWarpUpdUI       === "function") pWarpUpdUI();
  if (typeof pMaplawUpdUI     === "function") pMaplawUpdUI();
  if (typeof pApplyShowExperimental === "function") pApplyShowExperimental();

  // C. Sperren (NACH B: duerfen Button-Optik zuletzt setzen, damit sie
  //    nicht von einem spaeteren Box-Schritt ueberschrieben werden)
  if (typeof plUpdBalLock  === "function") plUpdBalLock();
  if (typeof plUpdLatLock  === "function") plUpdLatLock();
  if (typeof plUpdWarpLock === "function") plUpdWarpLock();

  // D. Wiedergabe-Karte
  if (typeof plUpdSourceUI      === "function") plUpdSourceUI();
  if (typeof plUpdTransportUI   === "function") plUpdTransportUI();
  if (typeof plUpdDisplay       === "function") plUpdDisplay();
  if (typeof plRefreshTooltips  === "function") plRefreshTooltips();
  if (typeof plUpdVolBtns       === "function") plUpdVolBtns();
  if (typeof plUpdContentLangBtn === "function") plUpdContentLangBtn();

  // E. Bibliotheks-Listen
  if (typeof plSyncLibraries === "function") plSyncLibraries();

  // F. Audiologen-Box: Warnhinweise (BA425)
  if (typeof _audiologUpdWarn === "function") _audiologUpdWarn();

  // --- Ebene 2: teure Neuberechnung (nur auf Anforderung) ---
  // Reihenfolge: rebuildSide vor retriggerWarp ist am realen Code belegt
  // (plBothSides-Handler: updatePlayerForSideChange -> pWarpTrigger).
  // rebuildEQ dazwischen ist in BA388 unkritisch, da noch KEIN Pfad
  // rebuildEQ mit rebuildSide kombiniert (Side-Change baut den EQ via
  // pBuildEQ ohnehin intern). Die finale Reihenfolge bei kombinierten
  // Flags wird in BA389/390 an den realen Kombinationspfaden festgelegt.
  if (rebuildSide   && typeof updatePlayerForSideChange === "function") updatePlayerForSideChange();
  if (rebuildEQ     && typeof pUpdEQ        === "function") pUpdEQ();
  if (retriggerWarp && typeof pWarpTrigger  === "function") pWarpTrigger();

  // --- Zuletzt: Graph zeichnen (stellt das ggf. neu berechnete Ergebnis dar) ---
  // Hinweis: updatePlayerForSideChange zeichnet den Graph bereits intern
  // (pDrawEQ). Bei rebuildSide ist dieser abschliessende Aufruf also ein
  // zweiter, idempotenter Redraw -- bewusst in Kauf genommen (billig). Die
  // internen pDrawEQ-Aufrufe werden in BA390 entwirrt, nicht hier.
  if (typeof pDrawEQ === "function") pDrawEQ();
}

function plBookRefreshUI() {
  plBuildFilterChain(PL_FILTER_DECL.hoerbuecher);
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
  pSetPlaybackMode("hoerbuecher");

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

// BA323: _plBookRmBtn-Handler entfernt — Entfernen-Knopf und amRemoveLocalBookCollection entfallen.
// BA331: Sort/Sel/Ch-Event-Handler durch plBuildFilterChain-Mechanik (PL_FILTER_DECL.hoerbuecher) ersetzt.
// BA350: Upload (Ordner + Einzeldatei) ist eine `upload`-Stage in PL_FILTER_DECL.hoerbuecher; ruft plBookHandleUpload.

// Deklaration: Saetze (BA332)
// Nur eine Stage speaker-sel; kein item-sel (Pool entsteht zur Laufzeit via sBuildRecordingPool).
PL_FILTER_DECL.saetze = {
  category: "saetze",
  languageSensitive: true,
  _wired: false,
  fieldDecl: [
    { key: "source",  labelKey: "plDispFieldSource",   getValue: function (ctx) { return ctx.source  || ""; }, role: "title",   inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "speaker", labelKey: "plDispFieldSpeaker",  getValue: function (ctx) { return ctx.speaker || ""; }, role: "creator", inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "lang",    labelKey: "plDispFieldLang",     getValue: function (ctx) { return ctx.lang    || ""; }, role: "detail",  inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "license", labelKey: "plDispFieldLicense",  getValue: function (ctx) { return ctx.license || ""; }, role: "license", inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "credit",  labelKey: "plDispFieldCredit",   getValue: function (ctx) { return ctx.credit  || ""; }, role: "source",  inFilter: false, inDisplay: true,  visibility: "always" },
    { key: "text",    labelKey: "plDispFieldText",     getValue: function (ctx) { return ctx.text    || ""; }, role: "text",    inFilter: false, inDisplay: true,  visibility: "reveal" }
  ],
  stateRef: {
    getSpeakerSel: function () { return plSentSpeakerSel; },
    setSpeakerSel: function (v) { plSentSpeakerSel = v; }
  },
  stages: [
    {
      id: "upload", kind: "upload", domId: "plSentUpload",
      allowFile: true, allowFolder: true,
      titleKey: "plUploadTitle",
      folderLabelKey: "plUploadFolder", fileLabelKey: "plUploadFile",
      accept: ".mp3,.wav,.flac,.ogg,.m4a,.mp4,audio/*",
      onFile: async function (file) {
        if (typeof sAddLocalFile === "function") sAddLocalFile(file);
        if (typeof sRefreshSpeakerDropdown === "function") sRefreshSpeakerDropdown();
        if (typeof sUpdateUI === "function") sUpdateUI();
      },
      onFolder: async function (fileList) {
        if (typeof sIngestLocalFolder === "function") await sIngestLocalFolder(fileList);
        if (typeof sRefreshSpeakerDropdown === "function") sRefreshSpeakerDropdown();
        if (typeof sUpdateUI === "function") sUpdateUI();
      }
    },
    {
      id: "speaker", kind: "speaker-sel", domId: "plSentSpeaker",
      onSpeakerSelect: function () {
        if (typeof sUpdateUI === "function") sUpdateUI();
      }
    }
  ]
};
// BA332: sRefreshSpeakerDropdown delegiert an plBuildFilterChain(PL_FILTER_DECL.saetze).

// BA390: Player-Warmlauf -- Audiograph beim Seitenaufruf still aufbauen,
// damit pGain und die Latenz-Kette bereitstehen, bevor der Latenz-Test sie
// braucht. KEIN abgespielter Ton; nur Knoten-Erzeugung. Ein evtl.
// suspendierter AudioContext ist hier unkritisch (kein Audio laeuft).
document.addEventListener("DOMContentLoaded", function() {
  try {
    const c = gPC();
    pEnsureOutputBase(c);
  } catch (e) {
    // Warmlauf ist Best-Effort: scheitert er, baut der normale pPlay-Pfad
    // den Graphen spaeter wie bisher auf.
    console.warn("BA390 Player-Warmlauf uebersprungen:", e);
  }
});
