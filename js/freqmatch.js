// ============================================================
// freqmatch.js — Frequenzabgleich: gemeinsame Basis
// ============================================================
// Architektur: Pro Testverfahren eine eigene Datei.
//   freqmatch.js          — shared State, Hilfsfunktionen, Persistenz, Audio
//   freqmatch-adaptive.js — Adaptives Verfahren (Staircase/Bracketing)
//   freqmatch-slider.js   — Slider-Verfahren (manuelle Schätzung)
// Ladereihenfolge: freqmatch.js zuerst, dann die Verfahren-Dateien.
// Diese Konvention gilt für alle Messungen-Sub-Tabs: jedes Testverfahren
// bekommt seine eigene Datei; gemeinsame Infrastruktur bleibt in der
// Basis-Datei des jeweiligen Sub-Tabs.

// --- State ---
let fmRunning = false;
let fmEls = null;
let fmRefSide = "left";
let fmVarSide = "right";
let fmVerfahren = 'adaptive';   // 'slider' | 'adaptive'
let fmSeq = [];
let fmSeqIdx = 0;
let fmCurrentEl = null;
let fmCentOffset = 0;
let fmFirstSide = "ref";
let fmIsPlay = false;
let fmPlayTO = null;

// Adaptiver Modus (Bauanleitung 02b/4)
let fmAdaptiveActive   = false;
let fmAwaitingResponse = false;
let fmTracks           = {};
let fmRoundQueue       = [];   // geshuffelter Round-Robin-State
let fmCurTrackId       = null;
let fmLastPickedTrackId = null;   // Wiederholungs-Sperre für Anker-Randomisierung
let fmCurFirstSide     = 'ref';
let fmTrialStartTs     = 0;
// Gepaartes Bracketing-State für den aktuell startenden/laufenden Lauf
// (wird in fmStartAdaptive berechnet und in _fmPersist in den Lauf geschrieben).
let fmCurPairedToPrevious = false;
// Catch-Trial-Info des aktuellen Trials (Bauanleitung 02b/6)
let fmCurCatchInfo = null;   // null | { direction: +500|-500, expectedResponse: 'var-higher'|'var-lower' }

// Undo-Support für adaptiven Modus
let _fmUndoSnapshot = null;  // Track-State-Snapshot vor letzter Antwort
let _fmNextTrialTO  = null;  // Timeout-Handle für fmNextAdaptiveTrial (canceln bei Undo)

// Debug-Simulation
let _fmSimActive  = false;
let _fmSimOffsets = {};   // electrodeIdx → simulierter Wahrnehmungs-Offset (Cent, pos oder neg)
let _fmParentEl = null;   // gesetzt im DOMContentLoaded

// Live-Log-Brücke ins Debug-Panel — schreibt nur wenn dbg.flag('adaptiv.live') true ist.
function _fmDbg(msg) {
  if (typeof dbg !== 'undefined' && dbg.flag && dbg.flag('adaptiv.live')) {
    dbg.log(msg, 'info');
  }
}

// Liefert true, wenn der Empfehlungs-Dialog vor dem adaptiven Start
// gezeigt werden soll: noch kein Lauf, keine sliderEstimates vorhanden.
function _fmShouldOfferSliderEstimate() {
  const sd = sideData[fmVarSide];
  if (!sd) return false;
  const fa = sd.freqmatchAdaptive;
  if (fa && Array.isArray(fa.runs) && fa.runs.length > 0) return false;
  const store = _fmEnsureSliderStore(fmVarSide);
  if (!store) return false;
  const seq = fmBuildSeq();
  for (var i = 0; i < seq.length; i++) {
    if (store[String(seq[i])] != null) return false;
  }
  return seq.length > 0;
}

// --- Track-Key-Schema: Key = String(electrodeIdx). Pro Lauf eine
// Staircase je Elektrode (Bracketing über Läufe statt parallel).
function fmTrackKey(electrodeIdx) {
  return String(electrodeIdx);
}
function fmParseTrackKey(key) {
  return { electrodeIdx: parseInt(String(key), 10) };
}

// Stellt sicher, daß sideData[side].freqmatchAdaptive existiert und
// ein gültiges sliderEstimates-Feld hat.
function _fmEnsureSliderStore(side) {
  const sd = sideData[side];
  if (!sd) return null;
  if (!sd.freqmatchAdaptive) {
    sd.freqmatchAdaptive = { runs: [], currentRunIdx: null, sliderEstimates: {} };
  }
  if (!sd.freqmatchAdaptive.sliderEstimates ||
      typeof sd.freqmatchAdaptive.sliderEstimates !== 'object') {
    sd.freqmatchAdaptive.sliderEstimates = {};
  }
  return sd.freqmatchAdaptive.sliderEstimates;
}

// --- Hilfsfunktionen ---
function fmCents(refHz, hz) {
  return 1200 * Math.log2(hz / refHz);
}
function fmFreqFromCents(refHz, c) {
  return refHz * Math.pow(2, c / 1200);
}

function fmGVol() {
  return (fmEls && fmEls.header) ? Math.pow(parseInt(fmEls.header.volInput.value) / 100, 2) : 0.25;
}
function fmGDur() {
  return (fmEls && fmEls.header) ? (parseInt(fmEls.header.durInput.value) || 1000) : 1000;
}
function fmGPau() {
  return (fmEls && fmEls.header) ? (parseInt(fmEls.header.pauseInput.value) || 400) : 400;
}

// Helfer: Verfahren-Refs
function _fmAdaptPI() {
  return fmEls && fmEls.verfahren && fmEls.verfahren.adaptive && fmEls.verfahren.adaptive.pairIndicator;
}
function _fmSliderPI() {
  return fmEls && fmEls.verfahren && fmEls.verfahren.slider && fmEls.verfahren.slider.pairIndicator;
}
function _fmAdaptUndo() {
  return fmEls && fmEls.verfahren && fmEls.verfahren.adaptive && fmEls.verfahren.adaptive.actions && fmEls.verfahren.adaptive.actions.undo;
}
function _fmSliderUndo() {
  return fmEls && fmEls.verfahren && fmEls.verfahren.slider && fmEls.verfahren.slider.actions && fmEls.verfahren.slider.actions.undo;
}
function fmGAba() {
  return (typeof globalSequence !== 'undefined') ? globalSequence === "aba" : true;
}

function fmCorrGain(side, hz) {
  return withSide(side, () => {
    if (typeof bRes === "undefined" || !bRes || bRes.length === 0) return 1;
    if (typeof compWLS !== "function") return 1;
    const f = (typeof freqs !== "undefined" && freqs) ? freqs : null;
    if (!f || f.length === 0) return 1;
    const { levels } = compWLS();
    if (!levels || !levels.length) return 1;

    const n = f.length;
    const lg = Math.log(hz);

    if (n === 1) {
      return isFinite(levels[0]) ? dB2G(-levels[0]) : 1;
    }
    const lgFirst = Math.log(f[0]);
    const lgLast  = Math.log(f[n - 1]);
    const ascending = lgLast > lgFirst;
    if (ascending) {
      if (lg <= lgFirst) {
        return isFinite(levels[0]) ? dB2G(-levels[0]) : 1;
      }
      if (lg >= lgLast) {
        return isFinite(levels[n - 1]) ? dB2G(-levels[n - 1]) : 1;
      }
    } else {
      if (lg >= lgFirst) {
        return isFinite(levels[0]) ? dB2G(-levels[0]) : 1;
      }
      if (lg <= lgLast) {
        return isFinite(levels[n - 1]) ? dB2G(-levels[n - 1]) : 1;
      }
    }

    for (let i = 0; i < n - 1; i++) {
      const lgA = Math.log(f[i]);
      const lgB = Math.log(f[i + 1]);
      const lo = Math.min(lgA, lgB);
      const hi = Math.max(lgA, lgB);
      if (lg >= lo && lg <= hi) {
        const lvA = levels[i];
        const lvB = levels[i + 1];
        if (!isFinite(lvA) && !isFinite(lvB)) return 1;
        if (!isFinite(lvA)) return dB2G(-lvB);
        if (!isFinite(lvB)) return dB2G(-lvA);
        const tNum = lg - lgA;
        const tDen = lgB - lgA;
        const tt = (tDen === 0) ? 0 : (tNum / tDen);
        const lv = lvA + (lvB - lvA) * tt;
        return dB2G(-lv);
      }
    }
    return 1;
  });
}

// Frequenz der variablen Seite (CI) für Elektrode elIdx
function fmVarHz(elIdx) {
  return withSide(fmVarSide, () => effFreq(elIdx));
}
// Anzeigenummer der Elektrode
function fmDEN(elIdx) {
  return withSide(fmVarSide, () => dEN(elIdx));
}
// Alle aktiven Elektroden der variablen Seite (aufsteigend nach Frequenz)
function fmBuildSeq() {
  const elList = withSide(fmVarSide, () => {
    const result = [];
    for (let i = 0; i < nEl; i++) {
      if (elSt[i] === "deactivated") continue;
      if (elExDur[i]) continue;
      result.push({ idx: i, hz: effFreq(i) });
    }
    return result;
  });
  elList.sort((a, b) => a.hz - b.hz);
  return elList.map((x) => x.idx);
}

// Vorherige Messung für diese Elektrode (in Cent), falls vorhanden
function fmPrevCent(elIdx) {
  // 1) Vorhandene Slider-Vor-Schätzung hat höchste Priorität.
  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  if (store && store[String(elIdx)] != null) {
    const c = store[String(elIdx)].cent;
    if (typeof c === 'number' && isFinite(c)) return Math.round(c);
  }
  // 2) Sonst fRes-Eintrag.
  const existing = fRes.find(
    (r) => r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx
  );
  if (!existing) return 0;
  return Math.round(fmCents(existing.varFreq, existing.refFreq));
}

// Gemeinsame Initialisierung zu Beginn jedes Verfahren-Starts
function _fmInitSides() {
  fmRefSide = fmEls.header.refSelect.value;
  fmVarSide = fmRefSide === 'left' ? 'right' : 'left';
}

// --- Tonwiedergabe ---
async function fmPlayCurrent() {
  // --- Adaptive-Modus: Replay des aktuellen Trials über fmPlayAdaptiveTrial ---
  if (fmAdaptiveActive) {
    if (fmCurTrackId === null || !fmTracks || !fmTracks[fmCurTrackId]) return;
    const track = fmTracks[fmCurTrackId];
    // fmPlayAdaptiveTrial mutiert KEINEN Track-State — pure Wiedergabe-Routine.
    // fmAwaitingResponse bleibt true, Antwort-Buttons bleiben aktiv.
    await fmPlayAdaptiveTrial(track, fmCurFirstSide, fmCurCatchInfo);
    return;
  }

  // --- Slider-Modus: unverändertes Altverhalten ---
  if (fmCurrentEl === null) return;
  if (fmIsPlay) {
    fmIsPlay = false;
    if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
    await new Promise((r) => setTimeout(r, 60));
  }
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const vol = fmGVol();
  const ms = fmGDur();
  const pau = fmGPau();
  const aba = fmGAba();

  const balG = (typeof getRawBalanceGains === "function")
    ? getRawBalanceGains() : { left: 0, right: 0 };

  const c = gAC();
  function playOne(side, hz) {
    const pan = side === "left" ? -1 : 1;
    const corr = fmCorrGain(side, hz);
    const balDb = side === "left" ? balG.left : balG.right;
    const effectiveVol = isDeaf(side) ? 0 : vol * corr * dB2G(balDb);
    return playToneTyped(c, hz, effectiveVol, ms, pan, globalToneType);
  }
  const _spi = _fmSliderPI();
  function indRef() {
    testUI.pairIndicator.setPlaying(_spi, fmRefSide === "left" ? 'left' : 'right');
  }
  function indVar() {
    testUI.pairIndicator.setPlaying(_spi, fmVarSide === "left" ? 'left' : 'right');
  }
  function indOff() {
    testUI.pairIndicator.setPlaying(_spi, null);
  }

  isPlay = true;
  if (fmFirstSide === "ref") {
    indRef();
    await playOne(fmRefSide, refHz);
    if (!isPlay) { indOff(); return; }
    indOff();
    await new Promise((r) => { playTO = setTimeout(r, 50 + pau); });
    if (!isPlay) return;
    indVar();
    await playOne(fmVarSide, varHz);
    if (!isPlay) { indOff(); return; }
    if (aba && isPlay) {
      indOff();
      await new Promise((r) => { playTO = setTimeout(r, 50 + pau); });
      if (!isPlay) return;
      indRef();
      await playOne(fmRefSide, refHz);
    }
  } else {
    indVar();
    await playOne(fmVarSide, varHz);
    if (!isPlay) { indOff(); return; }
    indOff();
    await new Promise((r) => { playTO = setTimeout(r, 50 + pau); });
    if (!isPlay) return;
    indRef();
    await playOne(fmRefSide, refHz);
    if (!isPlay) { indOff(); return; }
    if (aba && isPlay) {
      indOff();
      await new Promise((r) => { playTO = setTimeout(r, 50 + pau); });
      if (!isPlay) return;
      indVar();
      await playOne(fmVarSide, varHz);
    }
  }
  indOff();
  isPlay = false;
}

async function fmPlaySimultaneous() {
  // --- Adaptive-Modus: Ref- und Var-Ton gleichzeitig mit aktuellem Track-Offset ---
  if (fmAdaptiveActive) {
    if (fmCurTrackId === null || !fmTracks || !fmTracks[fmCurTrackId]) return;
    if (fmIsPlay) {
      fmIsPlay = false;
      if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
      await new Promise((r) => setTimeout(r, 60));
    }
    const track  = fmTracks[fmCurTrackId];
    const elFreq = withSide(fmVarSide, function() { return effFreq(track.electrodeIdx); });
    const refHz  = elFreq * Math.pow(2, track.currentOffset / 1200);
    const varHz  = fmCurCatchInfo
      ? refHz * Math.pow(2, fmCurCatchInfo.direction / 1200)
      : elFreq;
    const vol    = fmGVol();
    const ms     = fmGDur();
    const refPan = fmRefSide === "left" ? -1 : 1;
    const varPan = fmVarSide === "left" ? -1 : 1;

    const balG = (typeof getRawBalanceGains === "function")
      ? getRawBalanceGains() : { left: 0, right: 0 };
    const refCorr  = fmCorrGain(fmRefSide, refHz);
    const varCorr  = fmCorrGain(fmVarSide, varHz);
    const refBalDb = fmRefSide === "left" ? balG.left : balG.right;
    const varBalDb = fmVarSide === "left" ? balG.left : balG.right;
    const refVol   = isDeaf(fmRefSide) ? 0 : vol * refCorr * dB2G(refBalDb);
    const varVol   = isDeaf(fmVarSide) ? 0 : vol * varCorr * dB2G(varBalDb);

    const c = gAC();
    isPlay = true;
    testUI.pairIndicator.setPlaying(_fmAdaptPI(), 'both');
    await Promise.all([
      playToneTyped(c, refHz, refVol, ms, refPan, globalToneType),
      playToneTyped(c, varHz, varVol, ms, varPan, globalToneType)
    ]);
    testUI.pairIndicator.setPlaying(_fmAdaptPI(), null);
    isPlay = false;
    return;
  }

  // --- Slider-Modus: unverändertes Altverhalten ---
  if (fmCurrentEl === null) return;
  if (fmIsPlay) {
    fmIsPlay = false;
    if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
    await new Promise((r) => setTimeout(r, 60));
  }
  const c = gAC();
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const vol = fmGVol();
  const ms = fmGDur();
  const refPan = fmRefSide === "left" ? -1 : 1;
  const varPan = fmVarSide === "left" ? -1 : 1;

  const balG = (typeof getRawBalanceGains === "function")
    ? getRawBalanceGains() : { left: 0, right: 0 };
  const refCorr = fmCorrGain(fmRefSide, refHz);
  const varCorr = fmCorrGain(fmVarSide, varHz);
  const refBalDb = fmRefSide === "left" ? balG.left : balG.right;
  const varBalDb = fmVarSide === "left" ? balG.left : balG.right;
  const refVol = isDeaf(fmRefSide) ? 0 : vol * refCorr * dB2G(refBalDb);
  const varVol = isDeaf(fmVarSide) ? 0 : vol * varCorr * dB2G(varBalDb);

  isPlay = true;
  testUI.pairIndicator.setPlaying(_fmSliderPI(), 'both');
  await Promise.all([
    playToneTyped(c, refHz, refVol, ms, refPan, globalToneType),
    playToneTyped(c, varHz, varVol, ms, varPan, globalToneType)
  ]);
  testUI.pairIndicator.setPlaying(_fmSliderPI(), null);
  isPlay = false;
}

// --- Persistenz (Bauanleitung 02b/5) ---

function _fmPersist() {
  if (!fmVarSide || !sideData[fmVarSide]) return;
  let fa = sideData[fmVarSide].freqmatchAdaptive;
  if (!fa || !Array.isArray(fa.runs)) {
    const prevEst = (fa && typeof fa.sliderEstimates === 'object' && fa.sliderEstimates) ? fa.sliderEstimates : {};
    fa = { runs: [], currentRunIdx: null, sliderEstimates: prevEst };
    sideData[fmVarSide].freqmatchAdaptive = fa;
  }
  if (!fa.sliderEstimates || typeof fa.sliderEstimates !== 'object') {
    fa.sliderEstimates = {};
  }

  let run = (fa.currentRunIdx != null) ? fa.runs[fa.currentRunIdx] : null;
  if (!run || run.completedAt != null) {
    // Kein aktiver Lauf → neuen Lauf anlegen.
    // startSigns/pairedToPrevious werden in fmStartAdaptive vorher berechnet
    // und in fmCurStartSigns/fmCurPairedToPrevious zwischengespeichert.
    const elList = Array.from(new Set(
      Object.keys(fmTracks).map(function(k) {
        return fmParseTrackKey(k).electrodeIdx;
      })
    )).sort(function(a, b) {
      const fa_ = withSide(fmVarSide, function() { return effFreq(a); });
      const fb_ = withSide(fmVarSide, function() { return effFreq(b); });
      return fa_ - fb_;
    });
    // startSigns aus den Track-Objekten extrahieren (single source of truth)
    const ssg = {};
    Object.keys(fmTracks).forEach(function(k) {
      ssg[fmTracks[k].electrodeIdx] = fmTracks[k].startSign || +1;
    });
    run = {
      runId:             new Date().toISOString(),
      startedAt:         Date.now(),
      completedAt:       null,
      varSide:           fmVarSide,
      refSide:           fmRefSide,
      electrodeIdxList:  elList,
      startSigns:        ssg,
      pairedToPrevious:  !!fmCurPairedToPrevious,
      tracks:            fmTracks,
      roundQueue:        fmRoundQueue.slice()
    };
    fa.runs.push(run);
    fa.currentRunIdx = fa.runs.length - 1;
  } else {
    // Bestehenden Lauf aktualisieren (Pause/Resume-Fall)
    run.tracks     = fmTracks;
    run.roundQueue = fmRoundQueue.slice();
  }

  _fmDbg('persist: run#' + fa.currentRunIdx + ', tracks=' + Object.keys(fmTracks).length);
}

function _fmMarkCompleted() {
  if (!fmVarSide || !sideData[fmVarSide]) return;
  const fa = sideData[fmVarSide].freqmatchAdaptive;
  if (!fa || fa.currentRunIdx == null) return;
  const run = fa.runs[fa.currentRunIdx];
  if (run) run.completedAt = Date.now();
  fmUpdateSliderModeAvail();
}

function _fmClearPersist(side) {
  side = side || fmVarSide;
  if (side && sideData[side]) sideData[side].freqmatchAdaptive = null;
}

function _fmTryRestore(currentElIdxList) {
  if (!sideData[fmVarSide]) return false;
  const fa = sideData[fmVarSide].freqmatchAdaptive;
  if (!fa || !Array.isArray(fa.runs) || fa.runs.length === 0) return false;

  const run = (fa.currentRunIdx != null) ? fa.runs[fa.currentRunIdx] : null;
  if (!run) return false;
  if (run.completedAt != null) return false;            // letzter Lauf war fertig
  if (run.varSide !== fmVarSide || run.refSide !== fmRefSide) return false;
  if (!run.tracks) return false;

  const saved = (run.electrodeIdxList || []).slice().sort(function(a, b) { return a - b; });
  const now   = currentElIdxList.slice().sort(function(a, b) { return a - b; });
  if (saved.length !== now.length) return false;
  for (let i = 0; i < saved.length; i++) if (saved[i] !== now[i]) return false;

  const hasActive = Object.keys(run.tracks).some(function(k) {
    return run.tracks[k].status === 'active';
  });
  if (!hasActive) return false;

  fmTracks     = run.tracks;
  fmRoundQueue = Array.isArray(run.roundQueue) ? run.roundQueue.slice() : [];
  _fmDbg('restore: run#' + fa.currentRunIdx + ', ' + Object.keys(fmTracks).length + ' tracks');
  return true;
}

function fmRefreshResumeHint() {
  if (!fmEls) return;
  const startBtn = fmEls.header && fmEls.header.startBtn;
  if (!startBtn) return;
  const fa = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive) || null;

  if (!fa || !Array.isArray(fa.runs) || fa.runs.length === 0) {
    startBtn.textContent = (typeof t === 'function' && t('fmLblStart')) || 'Test starten';
    return;
  }

  const run = (fa.currentRunIdx != null) ? fa.runs[fa.currentRunIdx] : null;
  const hasActive = run && run.tracks && Object.keys(run.tracks).some(function(k) {
    return run.tracks[k].status === 'active';
  });

  if (hasActive) {
    startBtn.textContent = (typeof t === 'function' && t('fmLblResume')) || 'Test fortsetzen';
  } else {
    startBtn.textContent = (typeof t === 'function' && t('fmLblNewRun')) || 'Weiteren Lauf starten';
  }
}

// onStart-Hook für adaptive verfahren — ruft nach Dialog-Check _fmDoStartAdaptive.
let _fmTimerInterval = null;
let _fmTimerStartTs  = 0;

function _fmStartTimer() {
  _fmTimerStartTs = Date.now();
  _fmStopTimer();
  _fmTimerInterval = setInterval(_fmTickTimer, 1000);
  _fmTickTimer();
}
function _fmStopTimer() {
  if (_fmTimerInterval) {
    clearInterval(_fmTimerInterval);
    _fmTimerInterval = null;
  }
}
function _fmActiveProgress() {
  if (!fmEls || !fmEls.verfahren) return null;
  if (fmAdaptiveActive && fmEls.verfahren.adaptive)
    return fmEls.verfahren.adaptive.progress;
  if (fmRunning && fmEls.verfahren.slider)
    return fmEls.verfahren.slider.progress;
  return null;
}
function _fmTickTimer() {
  const secs = Math.floor((Date.now() - _fmTimerStartTs) / 1000);
  const mm   = Math.floor(secs / 60);
  const ss   = secs % 60;
  const txt  = mm + ':' + (ss < 10 ? '0' : '') + ss;
  const _prog = _fmActiveProgress();
  if (_prog && _prog.timer) _prog.timer.textContent = txt;
}

// --- Shared Dispatchers ---

function fmUndo() {
  if (fmAdaptiveActive) { fmUndoAdaptive(); return; }
  if (!fmRunning || fmSeqIdx === 0) return;
  fmSeqIdx--;
  const prevEl = fmSeq[fmSeqIdx];
  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  if (store) delete store[String(prevEl)];
  fmRenderSliderStatusGrid();
  fmUpdateSliderProgress();
  fmLoadElectrode();
  if (typeof renderFreqMatchResults === 'function') {
    try { renderFreqMatchResults(); } catch (e) {}
  }
}

function fmAbort() {
  testUI.sideCheck.stopIdleWatch();
  _fmSimActive = false;
  if (fmAdaptiveActive) {
    _fmPersist();
    fmAdaptiveActive   = false;
    fmAwaitingResponse = false;
    fmIsPlay           = false;
    if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
    fmRunning          = false;
    fmCurTrackId       = null;
    _fmStopTimer();
    fmRefreshResumeHint();
    fmUpdateSliderModeAvail();
    return;
  }
  fmIsPlay = false;
  if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
  _fmStopTimer();
  fmRunning   = false;
  fmCurrentEl = null;
  fmRefreshResumeHint();
}

function fmFinish() {
  fmIsPlay    = false;
  _fmStopTimer();
  fmRunning   = false;
  fmCurrentEl = null;
  if (fmEls && fmEls._stopTest) fmEls._stopTest();
  if (typeof renderFreqMatchResults === "function") renderFreqMatchResults();
}

// --- Elektroden-Ausschluss ---
function _fmRequestExcl() {
  if (!fmRunning || fmCurrentEl === null || !fmEls) return;
  setTestExclConfirm(fmEls.exclOverlay, fmDEN(fmCurrentEl), function() {
    withSide(fmVarSide, () => { elExDur[fmCurrentEl] = true; });
    fmSkip();
  });
}

// --- Slider-Handler ---
function fmHandleSlider(val) {
  fmCentOffset = parseFloat(val);
  fmUpdateSliderDisplay();
  fmRenderSliderStatusGrid();
}

// --- i18n-Aktualisierung ---
function fmApplyLang() {
  if (!fmEls) return;
  if (fmEls.header && fmEls.header.startBtn) {
    fmRefreshResumeHint();
  }
}

function fmUpdateSliderModeAvail() {
  if (!fmEls) return;
  const _varSide = (fmEls.header && fmEls.header.refSelect)
    ? (fmEls.header.refSelect.value === 'left' ? 'right' : 'left')
    : fmVarSide;
  const sd = sideData[_varSide] || {};
  const fa = sd.freqmatchAdaptive;
  const hasAnswers = !!(fa && Array.isArray(fa.runs) && fa.runs.some(function(r) {
    return r.tracks && Object.keys(r.tracks).some(function(k) {
      return r.tracks[k] && (r.tracks[k].trialCount || 0) > 0;
    });
  }));
  testUI.field.setEnabled(fmEls, 'verfahrenSelect.slider', !hasAnswers,
                          { reason: 'fmAdaptiveExists' });
  if (hasAnswers && fmVerfahren === 'slider' && !fmRunning) {
    fmSetVerfahren('adaptive', { force: true });
  }
}

let _fmDurStash_slider  = 400;
let _fmPauStash_slider  = 400;

function fmSetVerfahren(newVerfahren, opts) {
  opts = opts || {};
  if (newVerfahren !== 'slider' && newVerfahren !== 'adaptive') return;
  if (newVerfahren === fmVerfahren && !opts.force) return;

  const oldVerfahren = fmVerfahren;
  fmVerfahren = newVerfahren;

  if (!fmEls || !fmEls.header) return;

  // Dur/Pau stashen und wiederherstellen je nach Wechsel
  const durInp = fmEls.header.durInput;
  const pauInp = fmEls.header.pauseInput;

  if (oldVerfahren === 'slider' && durInp) _fmDurStash_slider = parseInt(durInp.value) || 400;
  if (oldVerfahren === 'slider' && pauInp) _fmPauStash_slider = parseInt(pauInp.value) || 400;

  if (newVerfahren === 'slider' && durInp) durInp.value = _fmDurStash_slider;
  if (newVerfahren === 'slider' && pauInp) pauInp.value = _fmPauStash_slider;

  testUI.verfahren.select(fmEls, newVerfahren);
  fmRefreshResumeHint();
}

function fmLoadVerfahrenFromSide() {
  if (!fmEls) return;
  fmRefSide = fmEls.header.refSelect.value;
  fmVarSide = fmRefSide === 'left' ? 'right' : 'left';

  const fa = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive) || null;
  const hasAdaptive = !!(fa && Array.isArray(fa.runs) && fa.runs.some(function(r) {
    return r.tracks && Object.keys(r.tracks).some(function(k) {
      return r.tracks[k] && (r.tracks[k].trialCount || 0) > 0;
    });
  }));

  fmUpdateSliderModeAvail();

  if (hasAdaptive) {
    fmSetVerfahren('adaptive', { force: true });
  }

  fmRefreshResumeHint();
}

// --- DOMContentLoaded ---
document.addEventListener("DOMContentLoaded", () => {
  const parentEl = document.getElementById("subpanel-messungen-freqmatch");
  if (!parentEl) return;
  _fmParentEl = parentEl;

  const fmCfg = {
    id: 'freqmatch',
    explain: {
      titleKey: 'fmTitle',
      paragraphs: [
        { key: 'fmHintMethod',   kind: 'plain' },
        { key: 'fmPrereqHint',  kind: 'warn'  },
        { key: 'fmHintWarn',    kind: 'warn'  },
        { key: 'fmHintWorkflow', kind: 'plain' }
      ]
    },
    header: {
      common: {
        refSelect:    { type: 'side', key: 'fmLblRef' },
        volume:       { show: true },
        duration:     { show: true, default: 400, min: 100, max: 3000, step: 50 },
        pause:        { show: true, default: 400, min: 50,  max: 2000, step: 50 },
        toneType:     { show: true, source: 'global' },
        sequence:     { show: true, source: 'global' },
        sliderTarget: {
          options:  ['ref','var','balance'],
          default:  'ref',
          disabled: true,
          hintKey:  'fmSliderTargetDisabledHint'
        }
      },
      startStop: { startKey: 'fmLblStart', resumable: true }
    },
    verfahren: [
      {
        id: 'slider',
        labelKey:   'fmModeSlider',
        explainKey: 'fmExplainSlider',
        body: {
          pairIndicator: { variant: 'token', leftKey: 'fmTone1', rightKey: 'fmTone2' },
          progress:      { format: 'simple' },
          instruction:   { key: 'fmSliderInstruction' },
          keyHint:       { unitKey: 'sliderHintCent' },
          slider:        { unit: 'cent', initialRange: 100, maxRange: 1200, touchStep: 5, touchFineStep: 1 },
          sliderValue:   { show: true },
          confirmButton: { key: 'btnConfirmOffset' },
          actions:       ['undo', 'replay', 'simul'],
          statusGrid:    { show: true },
          background: {
            bodyKey:    'fmExplainSliderScience',
            bodyAsHtml: true
          },
          debugRun:      { key: 'btnDebugRun' }
        },
        hooks: {
          onStart:    fmStartSlider,
          onStop:     fmAbort,
          onSlide:    fmHandleSlider,
          onConfirm:  fmConfirm,
          onReplay:   fmPlayCurrent,
          onUndo:     fmUndo,
          onSimul:    fmPlaySimultaneous,
          onDebugRun: fmRunSliderDebugSim
        }
      },
      {
        id: 'adaptive',
        labelKey:   'fmModeAdaptive',
        explainKey: 'fmExplainAdaptive',
        body: {
          pairIndicator:   { variant: 'token', leftKey: 'fmTone1', rightKey: 'fmTone2' },
          progress:        { format: 'simple' },
          instruction:     { key: 'hjPrompt' },
          decisionButtons: { variant: 'updown' },
          statusGrid:      { show: true },
          actions:         ['undo','replay','simul'],
          background: {
            bodyKey:    'fmExplainAdaptiveScience',
            bodyAsHtml: true
          },
          debugRun: { key: 'btnDebugRun' }
        },
        hooks: {
          onStart:    fmStartAdaptive,
          onStop:     fmAbort,
          onDecision: fmHandleHeight,
          onReplay:   fmPlayCurrent,
          onUndo:     fmUndoAdaptive,
          onSimul:    fmPlaySimultaneous,
          onDebugRun: fmRunDebugSim
        }
      }
    ]
  };

  fmEls = buildTestPanel(parentEl, fmCfg);

  // --- Slider-Empfehlungs-Dialog (BA 102) ---
  const fmSEDlg = _mkEl('div', 'modal-overlay');
  fmSEDlg.hidden = true;
  const fmSECard = _mkEl('div', 'card');
  const fmSETitle = _mkEl('h3');
  fmSETitle.dataset.t = 'fmSliderEstimateTitle';
  const fmSEMsg = _mkEl('p');
  fmSEMsg.dataset.t = 'fmSliderEstimateMsg';
  const fmSEBtnRow = _mkEl('div', 'controls-row');
  const fmSEBtnSlider = _mkEl('button', 'btn btn-primary');
  fmSEBtnSlider.dataset.t = 'fmSliderEstimateBtnSlider';
  const fmSEBtnSkip = _mkEl('button', 'btn');
  fmSEBtnSkip.dataset.t = 'fmSliderEstimateBtnSkip';
  const fmSEBtnCancel = _mkEl('button', 'btn');
  fmSEBtnCancel.dataset.t = 'fmSliderEstimateBtnCancel';
  fmSEBtnRow.append(fmSEBtnSlider, fmSEBtnSkip, fmSEBtnCancel);
  fmSECard.append(fmSETitle, fmSEMsg, fmSEBtnRow);
  fmSEDlg.appendChild(fmSECard);
  document.body.appendChild(fmSEDlg);

  fmSEBtnSlider.addEventListener('click', function() {
    fmSEDlg.classList.remove('active');
    if (fmEls && fmEls._stopTest) fmEls._stopTest();
    fmSetVerfahren('slider');
  });
  fmSEBtnSkip.addEventListener('click', function() {
    fmSEDlg.classList.remove('active');
    testUI.sideCheck.run(
      { sides: 'both' },
      _fmDoStartAdaptive,
      function() { if (fmEls) fmEls._stopTest(); }
    );
  });
  fmSEBtnCancel.addEventListener('click', function() {
    fmSEDlg.classList.remove('active');
    if (fmEls && fmEls._stopTest) fmEls._stopTest();
  });

  fmEls.sliderEstimateDlg = fmSEDlg;

  // Referenzwechsel-Dialog
  const fmRCDlg = _mkEl('div', 'modal-overlay');
  fmRCDlg.hidden = true;
  const fmRCCard = _mkEl('div', 'card');
  const fmRCMsg = _mkEl('p');
  fmRCMsg.dataset.t = 'fmRefChangeConfirm';
  if (typeof t === 'function') fmRCMsg.textContent = t('fmRefChangeConfirm') || fmRCMsg.textContent;
  const fmRCBtns = _mkEl('div', 'btn-group');
  const fmRCOkBtn = _mkEl('button', 'btn btn-danger');
  fmRCOkBtn.dataset.t = 'fmRefChangeConfirmOk';
  if (typeof t === 'function') fmRCOkBtn.textContent = t('fmRefChangeConfirmOk') || fmRCOkBtn.textContent;
  const fmRCCancelBtn = _mkEl('button', 'btn');
  fmRCCancelBtn.dataset.t = 'fmRefChangeConfirmCancel';
  if (typeof t === 'function') fmRCCancelBtn.textContent = t('fmRefChangeConfirmCancel') || fmRCCancelBtn.textContent;
  fmRCBtns.append(fmRCOkBtn, fmRCCancelBtn);
  fmRCCard.append(fmRCMsg, fmRCBtns);
  fmRCDlg.appendChild(fmRCCard);
  parentEl.appendChild(fmRCDlg);

  // Events: Referenzseiten-Wechsel
  let _fmPrevRefVal = fmEls.header.refSelect.value;
  fmEls.header.refSelect.addEventListener('change', function() {
    setTimeout(fmLoadVerfahrenFromSide, 0);
  });
  fmEls.header.refSelect.addEventListener('change', function() {
    if (fRes.length > 0) {
      fmRCOkBtn.onclick = function() {
        fmRCDlg.classList.remove('active');
        fRes.splice(0, fRes.length);
        _fmClearPersist('left');
        _fmClearPersist('right');
        _fmPrevRefVal = fmEls.header.refSelect.value;
        fmUpdateSliderModeAvail();
      };
      fmRCCancelBtn.onclick = function() {
        fmRCDlg.classList.remove('active');
        fmEls.header.refSelect.value = _fmPrevRefVal;
      };
      fmRCDlg.classList.add('active');
    } else {
      _fmPrevRefVal = fmEls.header.refSelect.value;
    }
  });

  // Texte initial setzen
  fmApplyLang();

  fmLoadVerfahrenFromSide();
  fmRefreshResumeHint();
});
