// ============================================================
// FREQUENZABGLEICH – FREQUENCY MATCHING TEST
// ============================================================

// --- State ---
let fmRunning = false;
let fmEls = null;
let fmRefSide = "left";
let fmVarSide = "right";
let fmMode = 'adaptive';   // 'slider' | 'adaptive', Bauanleitung 02b/2
let fmSeq = [];
let fmSeqIdx = 0;
let fmCurrentEl = null;
let fmCentOffset = 0;
const FM_SLIDER_RANGES = [100, 500, 1200];
let fmSlRangeIdx = 0;
let fmFirstSide = "ref";
let fmIsPlay = false;
let fmPlayTO = null;

// Adaptiver Modus (Bauanleitung 02b/4)
let fmAdaptiveActive   = false;
let fmAwaitingResponse = false;
let fmTracks           = {};
let fmRoundQueue       = [];   // geshuffelter Round-Robin-State, Bauanleitung 84
let fmCurTrackId       = null;
let fmLastPickedTrackId = null;   // BA 97: Wiederholungs-Sperre für Anker-Randomisierung
let fmCurFirstSide     = 'ref';
let fmTrialStartTs     = 0;
// Catch-Trial-Info des aktuellen Trials (Bauanleitung 02b/6)
let fmCurCatchInfo = null;   // null | { direction: +500|-500, expectedResponse: 'var-higher'|'var-lower' }

// Undo-Support für adaptiven Modus
let _fmUndoSnapshot = null;  // Track-State-Snapshot vor letzter Antwort
let _fmNextTrialTO  = null;  // Timeout-Handle für fmNextAdaptiveTrial (canceln bei Undo)


// Debug-Simulation
let _fmSimActive  = false;
let _fmSimOffsets = {};   // electrodeIdx → simulierter Wahrnehmungs-Offset (Cent, pos oder neg)

// Live-Log-Brücke ins Debug-Panel — schreibt nur wenn dbg.flag('adaptiv.live') true ist.
function _fmDbg(msg) {
  if (typeof dbg !== 'undefined' && dbg.flag && dbg.flag('adaptiv.live')) {
    dbg.log(msg, 'info');
  }
}

// --- Track-Key-Schema (BA 94): "<electrodeIdx>:up" oder "<electrodeIdx>:down" ---
function fmTrackKey(electrodeIdx, direction) {
  return String(electrodeIdx) + ':' + direction;
}
function fmParseTrackKey(key) {
  const parts = String(key).split(':');
  return { electrodeIdx: parseInt(parts[0], 10), direction: parts[1] };
}

// --- Hilfsfunktionen ---
function fmCents(refHz, hz) {
  return 1200 * Math.log2(hz / refHz);
}
function fmFreqFromCents(refHz, c) {
  return refHz * Math.pow(2, c / 1200);
}

function fmGVol() {
  return fmEls ? Math.pow(parseInt(fmEls.volInput.value) / 100, 2) : 0.25;
}
function fmGDur() {
  return fmEls ? (parseInt(fmEls.durInput.value) || 1000) : 1000;
}
function fmGPau() {
  return fmEls ? (parseInt(fmEls.pauseInput.value) || 400) : 400;
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
  const existing = fRes.find(
    (r) => r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx
  );
  if (!existing) return 0;
  return Math.round(fmCents(existing.varFreq, existing.refFreq));
}

// --- UI-Update-Funktionen ---
function fmUpdateSliderDisplay() {
  if (!fmEls || fmCurrentEl === null) return;
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const centStr = (fmCentOffset >= 0 ? "+" : "") + Math.round(fmCentOffset);
  const hzStr = refHz.toFixed(2);
  const centUnit = (typeof t === 'function' && t("fmCentUnit")) || "Cent";
  if (fmEls.sliderValue) {
    fmEls.sliderValue.textContent = centStr + " " + centUnit + " (" + hzStr + " Hz)";
  }
  const refSideLabel = fmRefSide === "left" ? t("sideLeft") : t("sideRight");
  const refText = refSideLabel + ": " + hzStr + " Hz, " + centStr + " " + centUnit;
  if (fmRefSide === "left") {
    if (fmEls.pairLeft) fmEls.pairLeft.textContent = refText;
  } else {
    if (fmEls.pairRight) fmEls.pairRight.textContent = refText;
  }
}

function _fmCheckExtend() {
  if (!fmEls) return;
  const lim = FM_SLIDER_RANGES[fmSlRangeIdx];
  const atLimit = Math.abs(fmCentOffset) >= lim - 1;
  const hasNext = fmSlRangeIdx < FM_SLIDER_RANGES.length - 1;
  fmEls.extendBtn.hidden = !(atLimit && hasNext);
}

function fmShowElectrode() {
  if (!fmEls || fmCurrentEl === null) return;
  const varHz = fmVarHz(fmCurrentEl);
  const varSideLabel = fmVarSide === "left" ? t("sideLeft") : t("sideRight");
  const varText = withSide(fmVarSide, () => dENPrefix()) + fmDEN(fmCurrentEl) + ", " +
    varHz.toFixed(2) + " Hz (" + varSideLabel + ")";
  if (fmVarSide === "left") {
    if (fmEls.pairLeft) fmEls.pairLeft.textContent = varText;
  } else {
    if (fmEls.pairRight) fmEls.pairRight.textContent = varText;
  }
  const lim = FM_SLIDER_RANGES[fmSlRangeIdx];
  fmEls.slider.min = -lim;
  fmEls.slider.max = lim;
  fmEls.slider.value = Math.max(-lim, Math.min(lim, fmCentOffset));
  fmUpdateSliderDisplay();
  _fmCheckExtend();
  if (fmEls.progressText) {
    fmEls.progressText.textContent = (fmSeqIdx + 1) + " / " + fmSeq.length;
  }
  if (fmEls.progressFill) {
    fmEls.progressFill.style.width = (fmSeq.length > 0 ? (fmSeqIdx / fmSeq.length * 100) : 0) + "%";
  }
  if (fmEls.undoBtn) fmEls.undoBtn.disabled = fmSeqIdx === 0;
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
  function indRef() {
    const isLeft = fmRefSide === "left";
    if (fmEls && fmEls.pairLeft) fmEls.pairLeft.classList.toggle('playing', isLeft);
    if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.toggle('playing', !isLeft);
  }
  function indVar() {
    const isLeft = fmVarSide === "left";
    if (fmEls && fmEls.pairLeft) fmEls.pairLeft.classList.toggle('playing', isLeft);
    if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.toggle('playing', !isLeft);
  }
  function indOff() {
    if (fmEls && fmEls.pairLeft) fmEls.pairLeft.classList.remove('playing');
    if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.remove('playing');
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

async function fmPlaySimul() {
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
    if (fmEls && fmEls.pairLeft)  fmEls.pairLeft.classList.add('playing');
    if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.add('playing');
    await Promise.all([
      playToneTyped(c, refHz, refVol, ms, refPan, globalToneType),
      playToneTyped(c, varHz, varVol, ms, varPan, globalToneType)
    ]);
    if (fmEls && fmEls.pairLeft)  fmEls.pairLeft.classList.remove('playing');
    if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.remove('playing');
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
  if (fmEls && fmEls.pairLeft) fmEls.pairLeft.classList.add('playing');
  if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.add('playing');
  await Promise.all([
    playToneTyped(c, refHz, refVol, ms, refPan, globalToneType),
    playToneTyped(c, varHz, varVol, ms, varPan, globalToneType)
  ]);
  if (fmEls && fmEls.pairLeft) fmEls.pairLeft.classList.remove('playing');
  if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.remove('playing');
  isPlay = false;
}

// --- Adaptiver Modus (Bauanleitung 02b/4) ---

function fmEnableHeightButtons() {
  if (fmEls && fmEls.hjHigher) fmEls.hjHigher.disabled = false;
  if (fmEls && fmEls.hjLower)  fmEls.hjLower.disabled  = false;
}
function fmDisableHeightButtons() {
  setPlayingIndicator(null);
  if (fmEls && fmEls.hjHigher) fmEls.hjHigher.disabled = true;
  if (fmEls && fmEls.hjLower)  fmEls.hjLower.disabled  = true;
}

function setPlayingIndicator(which) {
  if (!fmEls) return;
  if (fmEls.pairLeft)  fmEls.pairLeft.classList.toggle('playing',  which === 'left');
  if (fmEls.pairRight) fmEls.pairRight.classList.toggle('playing', which === 'right');
}

// --- Persistenz (Bauanleitung 02b/5) ---

function _fmPersist() {
  if (!fmVarSide || !sideData[fmVarSide]) return;
  let fa = sideData[fmVarSide].freqmatchAdaptive;
  if (!fa || !Array.isArray(fa.runs)) {
    fa = { runs: [], currentRunIdx: null };
    sideData[fmVarSide].freqmatchAdaptive = fa;
  }

  let run = (fa.currentRunIdx != null) ? fa.runs[fa.currentRunIdx] : null;
  if (!run || run.completedAt != null) {
    // Kein aktiver Lauf → neuen Lauf anlegen
    run = {
      runId:            new Date().toISOString(),
      startedAt:        Date.now(),
      completedAt:      null,
      varSide:          fmVarSide,
      refSide:          fmRefSide,
      electrodeIdxList: Array.from(new Set(
        Object.keys(fmTracks).map(function(k) {
          return fmParseTrackKey(k).electrodeIdx;
        })
      )).sort(function(a, b) {
        const fa_ = withSide(fmVarSide, function() { return effFreq(a); });
        const fb_ = withSide(fmVarSide, function() { return effFreq(b); });
        return fa_ - fb_;
      }),
      tracks:           fmTracks,
      roundQueue:       fmRoundQueue.slice()
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
  const startBtn = fmEls.startBtn;
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

function _fmShowLauf2Hint(_visible) {
  // BA 93: Lauf-1-Hinweis entfällt im N-Läufe-System. Element bleibt im DOM, wird immer versteckt.
  const el = document.getElementById('fmLauf2HintEl');
  if (el) el.hidden = true;
}

function fmStartAdaptive() {
  if (!fmEls) return;

  // Anti-Überschreib-Check (BA 93): bei 2+ abgeschlossenen Läufen Bestätigungsdialog.
  const _refVal  = fmEls.refSelect.value;
  const _varSide = _refVal === 'left' ? 'right' : 'left';
  const _fa = (sideData[_varSide] && sideData[_varSide].freqmatchAdaptive) || null;
  if (_fa && Array.isArray(_fa.runs) && _fa.runs.length >= 2) {
    const lastRun  = _fa.runs[_fa.runs.length - 1];
    const lastDone = lastRun && lastRun.completedAt != null;
    if (lastDone) {
      const daysOld = Math.floor((Date.now() - lastRun.completedAt) / (1000 * 60 * 60 * 24));
      const baseMsg = (typeof t === 'function' && t('fmAntiOverwriteMsg'))
        || 'Sie haben bereits {N} Läufe gespeichert. Ein weiterer Lauf wird zum Datensatz '
         + 'hinzugefügt und in die kombinierte Auswertung einbezogen. Wenn Sie ganz neu '
         + 'beginnen wollen, drücken Sie „Messungen löschen".';
      let msg = baseMsg.replace('{N}', String(_fa.runs.length));
      if (daysOld >= 7) {
        const ageMsg = (typeof t === 'function' && t('fmAgeWarnMsg'))
          || 'Ihre letzte Messung ist {D} Tage alt. Pitch-Wahrnehmung kann sich durch '
           + 'Plastizität verschoben haben.';
        msg += '\n\n' + ageMsg.replace('{D}', String(daysOld));
      }
      if (!window.confirm(msg)) return;
    }
  }

  fmRefSide = fmEls.refSelect.value;
  fmVarSide = fmRefSide === 'left' ? 'right' : 'left';

  const elIdxList = fmBuildSeq();
  if (elIdxList.length === 0) {
    alert((typeof t === 'function' && t('fmNoActiveEl')) || 'Keine aktiven Elektroden auf der variablen Seite.');
    return;
  }

  if (_fmTryRestore(elIdxList)) {
    console.log('[freqmatch] Adaptiver Lauf fortgesetzt:', Object.keys(fmTracks).length, 'Tracks');
  } else {
    fmTracks = {};
    fmRoundQueue = [];
    elIdxList.forEach(function(idx) {
      fmTracks[fmTrackKey(idx, 'up')]   = fmCreateTrack(idx, 'up');
      fmTracks[fmTrackKey(idx, 'down')] = fmCreateTrack(idx, 'down');
    });
    _fmPersist();
  }

  fmRunning           = true;
  fmAdaptiveActive    = true;
  fmAwaitingResponse  = false;
  fmCurTrackId        = null;
  fmLastPickedTrackId = null;
  _fmUndoSnapshot     = null;
  if (fmEls.undoBtn) fmEls.undoBtn.disabled = true;

  updateTabLockState();
  fmEls.lockedHint.hidden = false;
  fmEls.testBox.hidden    = false;
  fmEls.startBtn.disabled = true;
  fmEls.stopBtn.disabled  = false;
  if (fmEls.modeSelect) fmEls.modeSelect.disabled = true;

  fmRenderStatusGrid();
  _fmDbg('start: ref=' + fmRefSide + ' var=' + fmVarSide
       + ', tracks=' + Object.keys(fmTracks).length);
  fmNextAdaptiveTrial();
}

function fmNextAdaptiveTrial() {
  if (!fmAdaptiveActive) return;
  if (fmEls.undoBtn) fmEls.undoBtn.disabled = true;

  const _rrState = { tracks: fmTracks, roundQueue: fmRoundQueue };
  fmCurTrackId = fmPickNextTrack(_rrState, undefined, fmLastPickedTrackId);
  if (fmCurTrackId !== null) fmLastPickedTrackId = fmCurTrackId;
  fmRoundQueue = _rrState.roundQueue;
  if (fmCurTrackId === null) {
    fmFinishAdaptive();
    return;
  }

  fmCurFirstSide     = (Math.random() < 0.5) ? 'ref' : 'var';
  fmAwaitingResponse = false;

  // --- Catch-Entscheidung: deterministisch pro Track ---
  // Jeder FM_CATCH_INTERVAL-te Trial eines Tracks ist ein Catch-Trial
  // (Trial-Indizes 5, 13, 21, … — gleichmäßige Verteilung je Elektrode).
  if ((fmTracks[fmCurTrackId].trialCount % FM_CATCH_INTERVAL) === FM_CATCH_PHASE) {
    // Adaptive Spreizung: bei großem Residuum wird ±500 ct nicht mehr
    // eindeutig hörbar. Spreizung mit dem Residuum mitwachsen lassen.
    const _t = fmTracks[fmCurTrackId];
    let _resForCatch = 0;
    if (_t.reversals && _t.reversals.length >= 2) {
      let _max = -Infinity, _min = Infinity;
      for (let _i = 0; _i < _t.reversals.length; _i++) {
        if (_t.reversals[_i] > _max) _max = _t.reversals[_i];
        if (_t.reversals[_i] < _min) _min = _t.reversals[_i];
      }
      _resForCatch = (_max - _min) / 2;
    }
    const _mag = Math.max(FM_CATCH_MAGNITUDE, 2 * _resForCatch);
    const dir = (Math.random() < 0.5) ? +_mag : -_mag;
    fmCurCatchInfo = {
      direction:        dir,
      expectedResponse: (dir > 0) ? 'var-higher' : 'var-lower'
    };
  } else {
    fmCurCatchInfo = null;
  }

  if (fmEls.pairLeft)  fmEls.pairLeft.textContent  = (typeof t === 'function' && t('fmTone1')) || 'Ton 1';
  if (fmEls.pairRight) fmEls.pairRight.textContent = (typeof t === 'function' && t('fmTone2')) || 'Ton 2';
  if (fmEls.pairFreq)  fmEls.pairFreq.textContent  = '';

  fmUpdateAdaptiveProgress();
  fmDisableHeightButtons();

  const track = fmTracks[fmCurTrackId];
  const _dbgVarHz = (typeof withSide === 'function' && typeof effFreq === 'function')
    ? withSide(fmVarSide, function() { return effFreq(track.electrodeIdx); }) : 0;
  _fmDbg('trial #' + (track.trialCount + 1)
       + ' track=' + fmCurTrackId
       + ' varHz=' + Math.round(_dbgVarHz)
       + ' offset=' + Math.round(track.currentOffset) + 'ct'
       + (fmCurCatchInfo ? ' [CATCH dir=' + fmCurCatchInfo.direction + ']' : ''));
  fmPlayAdaptiveTrial(track, fmCurFirstSide, fmCurCatchInfo).then(function() {
    if (!fmAdaptiveActive) return;
    fmAwaitingResponse = true;
    fmEnableHeightButtons();
    if (fmEls.undoBtn) fmEls.undoBtn.disabled = !_fmUndoSnapshot;
    fmTrialStartTs = Date.now();
  });
}

async function fmPlayAdaptiveTrial(track, firstSide, catchInfo) {
  if (_fmSimActive) { fmIsPlay = false; isPlay = false; return; }
  if (fmIsPlay) {
    fmIsPlay = false;
    if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
    await new Promise(function(r) { setTimeout(r, 60); });
  }

  const elFreq = withSide(fmVarSide, function() { return effFreq(track.electrodeIdx); });
  const refHz  = elFreq * Math.pow(2, track.currentOffset / 1200);
  // normaler Trial: varHz = elFreq (CI-Elektrode statisch)
  // Catch-Trial:    varHz = refHz * 2^(±500/1200) — ±500 cent von ref
  const varHz  = catchInfo
    ? refHz * Math.pow(2, catchInfo.direction / 1200)
    : elFreq;

  const vol = fmGVol();
  const ms  = fmGDur();
  const pau = fmGPau();

  const balG = (typeof getRawBalanceGains === 'function')
    ? getRawBalanceGains() : { left: 0, right: 0 };

  const c = gAC();

  function playOne(side, hz) {
    const pan    = (side === 'left') ? -1 : 1;
    const corr   = fmCorrGain(side, hz);
    const balDb  = (side === 'left') ? balG.left : balG.right;
    const effVol = isDeaf(side) ? 0 : vol * corr * dB2G(balDb);
    return playToneTyped(c, hz, effVol, ms, pan, globalToneType);
  }

  fmIsPlay = true;
  isPlay   = true;

  if (firstSide === 'ref') {
    setPlayingIndicator('left');
    await playOne(fmRefSide, refHz);
    setPlayingIndicator(null);
    if (!fmAdaptiveActive) { fmIsPlay = false; isPlay = false; return; }
    await new Promise(function(r) { fmPlayTO = setTimeout(r, pau); });
    if (!fmAdaptiveActive) { fmIsPlay = false; isPlay = false; return; }
    setPlayingIndicator('right');
    await playOne(fmVarSide, varHz);
    setPlayingIndicator(null);
  } else {
    setPlayingIndicator('left');
    await playOne(fmVarSide, varHz);
    setPlayingIndicator(null);
    if (!fmAdaptiveActive) { fmIsPlay = false; isPlay = false; return; }
    await new Promise(function(r) { fmPlayTO = setTimeout(r, pau); });
    if (!fmAdaptiveActive) { fmIsPlay = false; isPlay = false; return; }
    setPlayingIndicator('right');
    await playOne(fmRefSide, refHz);
    setPlayingIndicator(null);
  }

  fmIsPlay = false;
  isPlay   = false;
}

// userChoice: 'up' | 'down' — was der User über höher/tiefer-Buttons
//             oder ↑/↓-Tasten gewählt hat (bezogen auf den zweiten Ton)
function fmHandleHeight(userChoice) {
  if (!fmAdaptiveActive || !fmAwaitingResponse) return;
  fmAwaitingResponse = false;
  fmDisableHeightButtons();

  const response = _fmConvertHeight(userChoice, fmCurFirstSide);
  const track    = fmTracks[fmCurTrackId];

  const isCatch      = !!fmCurCatchInfo;
  const catchCorrect = isCatch && (response === fmCurCatchInfo.expectedResponse);
  const _prevStatus  = track.status;

  // Snapshot vor Staircase-Mutation — ermöglicht Undo bei Fehleingabe
  _fmUndoSnapshot = {
    trackId:    fmCurTrackId,
    trackState: {
      currentOffset:   track.currentOffset,
      stepSize:        track.stepSize,
      pendingResponse: track.pendingResponse,
      lastMoveDir:     track.lastMoveDir,
      trialCount:      track.trialCount,
      catchTotal:      track.catchTotal,
      catchErrors:     track.catchErrors,
      status:          track.status,
      match:           track.match,
      residual:        track.residual
    },
    reversals:    track.reversals.slice(),
    trialHistory: track.trialHistory.slice(),
    firstSide:    fmCurFirstSide,
    catchInfo:    fmCurCatchInfo
  };

  fmApplyResponse(track, response, isCatch, catchCorrect, fmCurFirstSide);

  // Hook C: Response-Log
  _fmDbg('response: ' + response
       + (isCatch ? ' catch=' + (catchCorrect ? 'ok' : 'miss') : '')
       + ' step=' + track.stepSize + ' reversals=' + (track.reversals || []).length);
  // Hook D: Status-Wechsel-Log
  if (track.status !== _prevStatus) {
    _fmDbg('status: track=' + fmCurTrackId + ' ' + _prevStatus + '→' + track.status
         + (track.status === 'not-perceivable'
              ? ' (catchErrors=' + (track.catchErrors || 0) + '/' + (track.catchTotal || 0) + ')'
              : ''));
  }

  // Catch-Info aufräumen (vor nächstem Trial)
  fmCurCatchInfo = null;

  if (track.status === 'converged' || track.status === 'converged-fair'
      || track.status === 'converged-wide' || track.status === 'unstable'
      || track.status === 'converged-noisy') {
    _fmWriteResult(track);
  } else if (track.status === 'not-perceivable') {
    _fmRemoveResult(track.electrodeIdx);
  }

  _fmPersist();
  fmRenderStatusGrid();
  if (fmEls.undoBtn) fmEls.undoBtn.disabled = false;

  _fmNextTrialTO = setTimeout(function() {
    _fmNextTrialTO = null;
    if (fmAdaptiveActive) fmNextAdaptiveTrial();
  }, _fmSimActive ? 30 : 200);
}

// firstSide='ref': Ton2=var. 'up'→var-higher, 'down'→var-lower
// firstSide='var': Ton2=ref. 'up'→var-lower,  'down'→var-higher
function _fmConvertHeight(userChoice, firstSide) {
  if (firstSide === 'ref') {
    return (userChoice === 'up') ? 'var-higher' : 'var-lower';
  } else {
    return (userChoice === 'up') ? 'var-lower' : 'var-higher';
  }
}

// Pro Lauf: Mittelwert von Track-up und Track-down einer Elektrode.
function _fmCombineTwoTracks(trackUp, trackDown) {
  if (!trackUp && !trackDown) {
    return { match: null, residual: null, status: 'aborted' };
  }
  const upSt   = trackUp   ? trackUp.status   : 'aborted';
  const downSt = trackDown ? trackDown.status : 'aborted';
  if (upSt === 'aborted' && downSt === 'aborted') {
    return { match: null, residual: null, status: 'aborted' };
  }
  // Noch aktive Tracks → Elektrode in-progress
  if (upSt === 'active' || downSt === 'active') {
    return { match: null, residual: null, status: 'in-progress' };
  }
  // Einer not-perceivable → Elektrode not-perceivable (SPEC)
  if (upSt === 'not-perceivable' || downSt === 'not-perceivable') {
    return { match: null, residual: null, status: 'not-perceivable' };
  }
  // Mindestens einer unstable → Elektrode unstable
  if (upSt === 'unstable' || downSt === 'unstable') {
    const ms = [trackUp, trackDown]
      .filter(function(t) { return t && t.match != null; })
      .map(function(t) { return t.match; });
    const m = ms.length ? ms.reduce(function(s, x) { return s + x; }, 0) / ms.length : null;
    const rs = [trackUp, trackDown]
      .filter(function(t) { return t && t.residual != null; })
      .map(function(t) { return t.residual; });
    const r = rs.length ? rs.reduce(function(s, x) { return s + x; }, 0) / rs.length : null;
    return { match: m, residual: r, status: 'unstable' };
  }
  // Beide haben Match
  const mu = trackUp   ? trackUp.match    : null;
  const md = trackDown ? trackDown.match  : null;
  const ru = trackUp   ? trackUp.residual  : null;
  const rd = trackDown ? trackDown.residual : null;
  const match    = (mu != null && md != null) ? (mu + md) / 2 : (mu != null ? mu : md);
  const residual = (ru != null && rd != null) ? (ru + rd) / 2 : (ru != null ? ru : rd);
  const RANK   = { 'converged': 0, 'converged-fair': 1, 'converged-wide': 2,
                   'unstable': 3, 'not-perceivable': 4, 'aborted': 5 };
  const STAGES = ['converged', 'converged-fair', 'converged-wide', 'unstable',
                  'not-perceivable', 'aborted'];
  let stage = STAGES[Math.max(RANK[upSt] || 0, RANK[downSt] || 0)];
  if (mu != null && md != null && Math.abs(mu - md) > 25 && RANK[stage] < 2) {
    stage = 'converged-wide';
  }
  return { match: match, residual: residual, status: stage };
}

// Aggregiert pro-Elektrode-Matches über alle Läufe einer Seite.
// In jedem Lauf werden zuerst die zwei Tracks (up + down) gemittelt.
// Gibt: { cent, meanResidual, combinedUncertainty, runsCount, status }
function _fmAggregateRunsForElectrode(side, electrodeIdx) {
  const fa = (sideData[side] && sideData[side].freqmatchAdaptive) || null;
  if (!fa || !Array.isArray(fa.runs)) {
    return { cent: null, meanResidual: null, combinedUncertainty: 0, runsCount: 0, status: null };
  }
  const matches   = [];
  const residuals = [];
  let worstStatus = null;
  const RANK = { 'converged': 0, 'converged-fair': 1, 'converged-wide': 2,
                 'unstable': 3, 'not-perceivable': 4, 'aborted': 5 };

  fa.runs.forEach(function(run) {
    const tu = run.tracks && run.tracks[fmTrackKey(electrodeIdx, 'up')];
    const td = run.tracks && run.tracks[fmTrackKey(electrodeIdx, 'down')];
    const combo = _fmCombineTwoTracks(tu, td);
    if (combo.match != null) {
      matches.push(combo.match);
      if (combo.residual != null) residuals.push(combo.residual);
    }
    if (combo.status &&
        (worstStatus == null || (RANK[combo.status] || 0) > (RANK[worstStatus] || 0))) {
      worstStatus = combo.status;
    }
  });

  const meanRes = residuals.length
    ? residuals.reduce(function(s, x) { return s + x; }, 0) / residuals.length
    : null;

  if (matches.length === 0) {
    return { cent: null, meanResidual: meanRes, combinedUncertainty: 0,
             runsCount: 0, status: worstStatus || null };
  }

  let cent;
  if (matches.length === 1) {
    cent = matches[0];
  } else if (matches.length === 2) {
    cent = (matches[0] + matches[1]) / 2;
  } else {
    const sorted = matches.slice().sort(function(a, b) { return a - b; });
    const mid = sorted.length >> 1;
    cent = (sorted.length & 1) ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  const matchSpread = (matches.length >= 2)
    ? Math.max.apply(null, matches) - Math.min.apply(null, matches)
    : 0;
  const meanResForCombined = (meanRes != null) ? meanRes : 0;
  const combinedUncertainty = Math.sqrt(
    meanResForCombined * meanResForCombined + (matchSpread / 2) * (matchSpread / 2)
  );

  return {
    cent:                cent,
    meanResidual:        meanRes,
    combinedUncertainty: combinedUncertainty,
    runsCount:           matches.length,
    status:              worstStatus || null
  };
}

function _fmRemoveResult(elIdx) {
  // Mit runs[] könnten andere Läufe ein Ergebnis geliefert haben → Aggregat prüfen.
  const agg = _fmAggregateRunsForElectrode(fmVarSide, elIdx);
  if (agg.cent != null) {
    // Mindestens ein anderer Lauf hat ein Ergebnis → aggregiertes Ergebnis in fRes schreiben
    const varHz = withSide(fmVarSide, function() { return effFreq(elIdx); });
    const refHz = varHz * Math.pow(2, agg.cent / 1200);
    const existingIdx = fRes.findIndex(function(r) {
      return r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx;
    });
    const entry = {
      varSide:               fmVarSide,
      refSide:               fmRefSide,
      elIdx:                 elIdx,
      varFreq:               varHz,
      refFreq:               refHz,
      timestamp:             Date.now(),
      fmStatus:              agg.status || 'converged',
      fmResidual:            agg.meanResidual,
      fmCombinedUncertainty: agg.combinedUncertainty,
      fmDelta:               null
    };
    if (existingIdx >= 0) fRes[existingIdx] = entry;
    else                  fRes.push(entry);
    _fmDbg('fRes keep via agg: side=' + fmVarSide + ' el=' + elIdx
         + ' (not-perceivable, andere Läufe haben Daten)');
    return;
  }
  const idx = fRes.findIndex(function(r) {
    return r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx;
  });
  if (idx >= 0) fRes.splice(idx, 1);
  _fmDbg('fRes remove: side=' + fmVarSide + ' el=' + elIdx + ' (not-perceivable)');
}

function _fmWriteResult(track) {
  const elIdx = track.electrodeIdx;
  const varHz = withSide(fmVarSide, function() { return effFreq(elIdx); });
  const agg   = _fmAggregateRunsForElectrode(fmVarSide, elIdx);

  const refHz = (agg.cent != null)
    ? varHz * Math.pow(2, agg.cent / 1200)
    : null;

  const existingIdx = fRes.findIndex(function(r) {
    return r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx;
  });
  const entry = {
    varSide:               fmVarSide,
    refSide:               fmRefSide,
    elIdx:                 elIdx,
    varFreq:               varHz,
    refFreq:               refHz,
    timestamp:             Date.now(),
    fmStatus:              agg.status || track.status,
    fmResidual:            agg.meanResidual,
    fmCombinedUncertainty: agg.combinedUncertainty,
    fmDelta:               null
  };
  if (existingIdx >= 0) fRes[existingIdx] = entry;
  else                  fRes.push(entry);
  _fmDbg('fRes write: side=' + fmVarSide + ' el=' + elIdx
       + ' cent=' + (agg.cent != null ? agg.cent.toFixed(1) : 'null')
       + ' unc=' + agg.combinedUncertainty.toFixed(1)
       + ' runs=' + agg.runsCount);
}

function fmReplayCurrent() {
  if (!fmAdaptiveActive) return;
  if (fmCurTrackId === null) return;
  const track = fmTracks[fmCurTrackId];
  fmDisableHeightButtons();
  fmAwaitingResponse = false;
  fmPlayAdaptiveTrial(track, fmCurFirstSide, fmCurCatchInfo).then(function() {
    if (!fmAdaptiveActive) return;
    fmAwaitingResponse = true;
    fmEnableHeightButtons();
  });
}

function fmFinishAdaptive() {
  let _cv = 0, _nv = 0, _np = 0;
  Object.keys(fmTracks).forEach(function(k) {
    const st = fmTracks[k].status;
    if (st === 'converged')            _cv++;
    else if (st === 'converged-noisy') _nv++;
    else if (st === 'not-perceivable') _np++;
  });
  const _fa = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive) || {};
  const _runNum = Array.isArray(_fa.runs) ? _fa.runs.length : '?';
  _fmDbg('finish run#' + _runNum + ': ' + _cv + ' converged, ' + _nv +
         ' noisy, ' + _np + ' not-perceivable');

  fmAdaptiveActive   = false;
  fmAwaitingResponse = false;
  fmIsPlay           = false;
  fmRunning          = false;
  fmCurTrackId       = null;
  updateTabLockState();
  setPlayingIndicator(null);

  _fmPersist();       // finale Tracks in runs[currentRunIdx] sichern
  _fmMarkCompleted(); // completedAt setzen
  _fmShowLauf2Hint(false);
  fmTracks     = {};
  fmRoundQueue = [];

  if (fmEls) {
    fmEls.testBox.hidden    = true;
    fmEls.lockedHint.hidden = true;
    fmEls.startBtn.disabled = false;
    fmEls.stopBtn.disabled  = true;
    if (fmEls.modeSelect) fmEls.modeSelect.disabled = false;
  }
  fmRefreshResumeHint();
  if (typeof renderFreqMatchResults === 'function') renderFreqMatchResults();
}

function fmRenderStatusGrid() {
  if (!fmEls || !fmEls.statusGrid) return;
  const grid = fmEls.statusGrid;
  grid.innerHTML = '';

  const head = _mkEl('div', 'fm-status-row fm-status-head');
  ['fmGridEl', 'fmGridStatus', 'fmGridMatch', 'fmGridResid', 'fmGridTrials', 'fmGridCatch']
    .forEach(function(key) {
      const c = _mkEl('div', 'fm-status-cell');
      c.dataset.t = key;
      head.appendChild(c);
    });
  grid.appendChild(head);

  const ids = Array.from(new Set(
    Object.keys(fmTracks).map(function(k) { return fmParseTrackKey(k).electrodeIdx; })
  ));
  ids.sort(function(a, b) {
    const fa = withSide(fmVarSide, function() { return effFreq(a); });
    const fb = withSide(fmVarSide, function() { return effFreq(b); });
    return fa - fb;
  });

  ids.forEach(function(idx) {
    const tu = fmTracks[fmTrackKey(idx, 'up')];
    const td = fmTracks[fmTrackKey(idx, 'down')];
    const combo = _fmCombineTwoTracks(tu, td);
    const comboStatus = combo.status || 'active';

    // CSS-Klasse: neue Stati auf vorhandene Klassen mappen
    const cssClass = (comboStatus === 'active' || comboStatus === 'in-progress') ? 'active'
      : (comboStatus === 'converged' || comboStatus === 'converged-fair') ? 'converged'
      : (comboStatus === 'converged-wide' || comboStatus === 'converged-noisy'
         || comboStatus === 'unstable') ? 'converged-noisy'
      : 'not-perceivable';
    const row = _mkEl('div', 'fm-status-row fm-status-' + cssClass);
    if (fmCurTrackId != null && fmParseTrackKey(fmCurTrackId).electrodeIdx === idx) {
      row.classList.add('fm-status-current');
    }

    const elName = withSide(fmVarSide, function() { return dENPrefix() + dEN(idx); });
    row.appendChild(_mkCell(elName));

    const iconMap = {
      'converged':       '✓ konvergiert',
      'converged-fair':  '◐ leichte Streuung',
      'converged-wide':  '◐ breite Streuung',
      'unstable':        '⚠ unstabil',
      'aborted':         '∅ abgebrochen',
      'not-perceivable': '✗ nicht wahrnehmbar',
      'converged-noisy': '◐ leichte Streuung'   // Backwards-Compat
    };
    let statusTxt;
    if (comboStatus === 'in-progress') {
      statusTxt = '⏳ vorläufig';
    } else if (comboStatus === 'active') {
      statusTxt = '⏳ läuft';
    } else {
      statusTxt = iconMap[comboStatus] || '?';
    }
    row.appendChild(_mkCell(statusTxt));

    // Match: aus combo, sonst vorläufig aus aktivem Track
    let matchTxt = '—', matchProv = false;
    if (combo.match != null) {
      matchTxt = (combo.match >= 0 ? '+' : '') + Math.round(combo.match) + ' ct';
    } else if (typeof fmComputeProvisional === 'function') {
      const provTrack = (tu && tu.status === 'active') ? tu
        : (td && td.status === 'active') ? td : null;
      if (provTrack) {
        const prov = fmComputeProvisional(provTrack);
        if (prov.match != null) {
          matchTxt = (prov.match >= 0 ? '+' : '') + Math.round(prov.match) + ' ct';
          matchProv = true;
        }
      }
    }
    const matchCell = _mkCell(matchTxt);
    if (matchProv) matchCell.classList.add('fm-status-provisional');
    row.appendChild(matchCell);

    // Residuum: aus combo, sonst vorläufig aus aktivem Track
    let residTxt = '—', residProv = false;
    if (combo.residual != null) {
      residTxt = '±' + Math.round(combo.residual) + ' ct';
    } else if (typeof fmComputeProvisional === 'function') {
      const provTrack = (tu && tu.status === 'active') ? tu
        : (td && td.status === 'active') ? td : null;
      if (provTrack) {
        const prov = fmComputeProvisional(provTrack);
        if (prov.residual != null) {
          residTxt = '±' + Math.round(prov.residual) + ' ct';
          residProv = true;
        }
      }
    }
    const residCell = _mkCell(residTxt);
    if (residProv) residCell.classList.add('fm-status-provisional');
    row.appendChild(residCell);

    // Trials und Catch: Summe beider Tracks
    const totalTrials    = (tu ? tu.trialCount   || 0 : 0) + (td ? td.trialCount   || 0 : 0);
    const totalCatchErr  = (tu ? tu.catchErrors  || 0 : 0) + (td ? td.catchErrors  || 0 : 0);
    const totalCatchAll  = (tu ? tu.catchTotal   || 0 : 0) + (td ? td.catchTotal   || 0 : 0);
    row.appendChild(_mkCell(String(totalTrials)));
    row.appendChild(_mkCell(totalCatchErr + '/' + totalCatchAll));

    grid.appendChild(row);
  });

  // i18n manuell anwenden (applyLang hat keinen root-Parameter)
  if (typeof t === 'function') {
    grid.querySelectorAll('[data-t]').forEach(function(el) {
      const v = t(el.dataset.t);
      if (v && v !== el.dataset.t) el.textContent = v;
    });
  }
}

function _mkCell(text) {
  const c = _mkEl('div', 'fm-status-cell');
  c.textContent = text;
  return c;
}

function fmUpdateAdaptiveProgress() {
  if (!fmEls) return;
  const fa      = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive) || null;
  const runNum  = (fa && Array.isArray(fa.runs)) ? fa.runs.length : 1;
  const ids     = Object.keys(fmTracks);
  const laufPfx = 'Lauf ' + runNum;

  // Erster Balken: aktueller Lauf
  if (ids.length > 0) {
    const stats = fmComputeProgressStats(fmTracks);
    if (fmEls.progressFill)  fmEls.progressFill.style.width  = stats.percent + '%';
    if (fmEls.progressText)  fmEls.progressText.textContent  =
      laufPfx + ': ' + stats.done + ' / ' + stats.total + ' · ' + Math.round(stats.percent) + ' %';
  } else {
    if (fmEls.progressFill)  fmEls.progressFill.style.width  = '0%';
    if (fmEls.progressText)  fmEls.progressText.textContent  = laufPfx + ': 0 / 0';
  }

  // Zweiter Balken: letzter abgeschlossener Lauf (falls vorhanden)
  if (!fmEls.progressFill2 || !fmEls.progressText2) return;
  let prevRun = null;
  let prevRunIdx = -1;
  if (fa && Array.isArray(fa.runs)) {
    for (let _i = fa.runs.length - 2; _i >= 0; _i--) {
      if (fa.runs[_i] && fa.runs[_i].completedAt != null) {
        prevRun = fa.runs[_i];
        prevRunIdx = _i;
        break;
      }
    }
  }
  if (prevRun) {
    const pStats = fmComputeProgressStats(prevRun.tracks || {});
    fmEls.progressFill2.style.width = '100%';
    fmEls.progressText2.textContent =
      'Lauf ' + (prevRunIdx + 1) + ': ' + pStats.done + ' / ' + pStats.total + ' · 100 %';
  } else {
    fmEls.progressFill2.style.width = '0%';
    fmEls.progressText2.textContent =
      (typeof t === 'function' && t('fmLblLauf2') || 'Lauf 2') + ': —';
  }
}

// Wiederverwendbare Fortschritts-Statistik. Auch genutzt von
// renderFreqMatchResults für den Ergebnis-Reiter-Balken.
//
// Pro Track:
//   - Endzustand    → Beitrag 1.0
//   - aktiv         → Beitrag min(reversals.length / FM_REVERSALS_REQ, 0.95)
function fmComputeProgressStats(tracks) {
  const allKeys = Object.keys(tracks);
  // Neues Key-Schema (BA 94) erkennen: Keys enthalten ':'
  const hasNewSchema = allKeys.some(function(k) { return k.indexOf(':') >= 0; });

  if (!hasNewSchema) {
    // Altes Schema (Slider-Modus oder alte gespeicherte Läufe): per-Track
    const total = allKeys.length;
    let done = 0, totalTrials = 0, contrib = 0;
    allKeys.forEach(function(k) {
      const tr = tracks[k];
      totalTrials += tr.trialCount || 0;
      if (tr.status !== 'active') { done++; contrib += 1.0; }
      else {
        const rev = (tr.reversals && tr.reversals.length) || 0;
        contrib += Math.min(rev / FM_REVERSALS_REQ, 0.95);
      }
    });
    return { total: total, done: done, totalTrials: totalTrials,
             percent: total > 0 ? (contrib / total) * 100 : 0 };
  }

  // Neues 2-Track-Schema: Elektroden-Ebene
  const elIdxSet = new Set();
  allKeys.forEach(function(k) { elIdxSet.add(fmParseTrackKey(k).electrodeIdx); });
  const elIdxList = Array.from(elIdxSet);
  const total = elIdxList.length;
  let done = 0, totalTrials = 0, contrib = 0;
  elIdxList.forEach(function(idx) {
    const tu = tracks[fmTrackKey(idx, 'up')];
    const td = tracks[fmTrackKey(idx, 'down')];
    totalTrials += (tu ? tu.trialCount || 0 : 0) + (td ? td.trialCount || 0 : 0);
    const tuDone = tu && tu.status !== 'active';
    const tdDone = td && td.status !== 'active';
    if (tuDone && tdDone) {
      done++;
      contrib += 1.0;
    } else {
      const revU = (tu && tu.reversals) ? tu.reversals.length : 0;
      const revD = (td && td.reversals) ? td.reversals.length : 0;
      const cU = tuDone ? 1.0 : Math.min(revU / FM_REVERSALS_REQ, 0.95);
      const cD = tdDone ? 1.0 : Math.min(revD / FM_REVERSALS_REQ, 0.95);
      contrib += (cU + cD) / 2;
    }
  });
  return {
    total:       total,
    done:        done,
    totalTrials: totalTrials,
    percent:     total > 0 ? (contrib / total) * 100 : 0
  };
}

// --- Testablauf ---
function fmStart() {
  if (!fmEls) return;
  fmRefSide = fmEls.refSelect.value;
  fmVarSide = fmRefSide === "left" ? "right" : "left";

  // Modus-Dispatch (Bauanleitung 02b/2)
  if (fmMode === 'adaptive') {
    fmStartAdaptive();
    return;
  }

  fmSeq = fmBuildSeq();
  if (fmSeq.length === 0) {
    alert((typeof t === 'function' && t("fmNoActiveEl")) || "Keine aktiven Elektroden auf der variablen Seite.");
    return;
  }
  fmSeqIdx = 0;
  fmSlRangeIdx = 0;
  fmRunning = true;
  updateTabLockState();
  fmEls.lockedHint.hidden = false;
  fmEls.testBox.hidden = false;
  fmEls.startBtn.disabled = true;
  fmEls.stopBtn.disabled = false;
  if (fmEls.modeSelect) fmEls.modeSelect.disabled = true;
  fmLoadElectrode();
}

function fmLoadElectrode() {
  if (fmSeqIdx >= fmSeq.length) {
    fmFinish();
    return;
  }
  fmCurrentEl = fmSeq[fmSeqIdx];
  fmCentOffset = fmPrevCent(fmCurrentEl);
  fmSlRangeIdx = 0;
  const absEx = Math.abs(fmCentOffset);
  while (absEx > FM_SLIDER_RANGES[fmSlRangeIdx] && fmSlRangeIdx < FM_SLIDER_RANGES.length - 1) {
    fmSlRangeIdx++;
  }
  fmFirstSide = Math.random() < 0.5 ? "ref" : "var";
  fmShowElectrode();
  if (fmEls && fmEls.confRadios && fmEls.confRadios.none) {
    fmEls.confRadios.none.checked = true;
  }
  setTimeout(() => { if (fmRunning) fmPlayCurrent(); }, 100);
}

function fmConfirm() {
  if (!fmRunning || fmCurrentEl === null) return;
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const existingIdx = fRes.findIndex(
    (r) => r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === fmCurrentEl
  );
  const entry = {
    varSide: fmVarSide,
    refSide: fmRefSide,
    elIdx: fmCurrentEl,
    varFreq: varHz,
    refFreq: refHz,
    timestamp: Date.now(),
  };
  if (existingIdx >= 0) {
    fRes[existingIdx] = entry;
  } else {
    fRes.push(entry);
  }
  fmSeqIdx++;
  fmLoadElectrode();
}

function fmUndoAdaptive() {
  if (!_fmUndoSnapshot) return;
  if (_fmNextTrialTO) { clearTimeout(_fmNextTrialTO); _fmNextTrialTO = null; }

  const snap      = _fmUndoSnapshot;
  _fmUndoSnapshot = null;

  const track = fmTracks[snap.trackId];
  Object.assign(track, snap.trackState);
  track.reversals    = snap.reversals.slice();
  track.trialHistory = snap.trialHistory.slice();

  fmCurTrackId   = snap.trackId;
  fmCurFirstSide = snap.firstSide;
  fmCurCatchInfo = snap.catchInfo;

  if (fmEls.undoBtn) fmEls.undoBtn.disabled = true;
  fmDisableHeightButtons();
  fmAwaitingResponse = false;
  fmPlayAdaptiveTrial(track, fmCurFirstSide, fmCurCatchInfo).then(function() {
    if (!fmAdaptiveActive) return;
    fmAwaitingResponse = true;
    fmEnableHeightButtons();
  });
}

function fmUndo() {
  if (fmAdaptiveActive) { fmUndoAdaptive(); return; }
  if (!fmRunning || fmSeqIdx === 0) return;
  fmSeqIdx--;
  const prevEl = fmSeq[fmSeqIdx];
  const idx = fRes.findIndex(
    (r) => r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === prevEl
  );
  if (idx >= 0) fRes.splice(idx, 1);
  fmLoadElectrode();
}

function fmSkip() {
  if (!fmRunning) return;
  fmSeqIdx++;
  fmLoadElectrode();
}

function fmAbort() {
  _fmSimActive = false;
  if (fmAdaptiveActive) {
    _fmPersist();
    _fmShowLauf2Hint(false);
    fmAdaptiveActive   = false;
    fmAwaitingResponse = false;
    fmIsPlay           = false;
    if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
    fmRunning          = false;
    fmCurTrackId       = null;
    updateTabLockState();
    if (fmEls) {
      fmEls.testBox.hidden    = true;
      fmEls.lockedHint.hidden = true;
      fmEls.startBtn.disabled = false;
      fmEls.stopBtn.disabled  = true;
      if (fmEls.modeSelect) fmEls.modeSelect.disabled = false;
    }
    fmRefreshResumeHint();
    return;
  }
  fmIsPlay = false;
  if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
  fmRunning = false;
  fmCurrentEl = null;
  updateTabLockState();
  if (fmEls) {
    fmEls.testBox.hidden = true;
    fmEls.lockedHint.hidden = true;
    fmEls.startBtn.disabled = false;
    fmEls.stopBtn.disabled = true;
    if (fmEls.modeSelect) fmEls.modeSelect.disabled = false;
  }
  fmRefreshResumeHint();
}

function fmFinish() {
  fmIsPlay = false;
  fmRunning = false;
  fmCurrentEl = null;
  updateTabLockState();
  if (fmEls) {
    fmEls.testBox.hidden = true;
    fmEls.lockedHint.hidden = true;
    fmEls.startBtn.disabled = false;
    fmEls.stopBtn.disabled = true;
    if (fmEls.modeSelect) fmEls.modeSelect.disabled = false;
  }
  if (typeof renderFreqMatchResults === "function") renderFreqMatchResults();
}

// --- Debug-Simulation ---

function fmRunDebugSim() {
  if (_fmSimActive) return;
  if (fmMode !== 'adaptive') return;
  _fmSimActive  = true;
  _fmSimOffsets = {};
  if (!fmAdaptiveActive) fmStart();
  _fmSimStep();
}

function _fmSimStep() {
  if (!_fmSimActive || !fmAdaptiveActive) { _fmSimActive = false; return; }
  if (!fmAwaitingResponse) { setTimeout(_fmSimStep, 80); return; }

  const track = fmTracks[fmCurTrackId];
  if (!track) { _fmSimActive = false; return; }

  if (_fmSimOffsets[track.electrodeIdx] === undefined) {
    const mag  = 20 + Math.random() * 130;
    _fmSimOffsets[track.electrodeIdx] = (Math.random() < 0.5 ? 1 : -1) * mag;
  }

  let choiceUD;
  if (fmCurCatchInfo) {
    const exp = fmCurCatchInfo.expectedResponse;
    choiceUD = (fmCurFirstSide === 'ref')
      ? (exp === 'var-higher' ? 'up' : 'down')
      : (exp === 'var-higher' ? 'down' : 'up');
  } else {
    const simOff = _fmSimOffsets[track.electrodeIdx];
    const gap    = track.currentOffset - simOff;
    const absGap = Math.abs(gap);
    let errProb;
    if (track.electrodeIdx === 0)      errProb = 0.50;   // E1: immer zufällig
    else if (track.electrodeIdx === 5) errProb = 0.25;   // E6: 75 % richtig
    else errProb = absGap < 30 ? 0.40 : absGap < 60 ? 0.20 : 0.02;
    let varResp = gap > 0 ? 'var-lower' : 'var-higher';
    if (Math.random() < errProb) varResp = varResp === 'var-higher' ? 'var-lower' : 'var-higher';
    choiceUD = (fmCurFirstSide === 'ref')
      ? (varResp === 'var-higher' ? 'up' : 'down')
      : (varResp === 'var-higher' ? 'down' : 'up');
  }

  setTimeout(function() {
    if (!_fmSimActive || !fmAdaptiveActive) { _fmSimActive = false; return; }
    fmHandleHeight(choiceUD);
    setTimeout(_fmSimStep, 50);
  }, 60 + Math.random() * 60);
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
  _fmCheckExtend();
}

function _fmExtendRange() {
  if (fmSlRangeIdx >= FM_SLIDER_RANGES.length - 1) return;
  fmSlRangeIdx++;
  const lim = FM_SLIDER_RANGES[fmSlRangeIdx];
  if (fmEls) {
    fmEls.slider.min = -lim;
    fmEls.slider.max = lim;
    fmEls.slider.value = fmCentOffset;
  }
  _fmCheckExtend();
}

// --- Tastatursteuerung ---
function fmHandleKey(e) {
  if (!fmRunning) return;
  const activeEl = document.activeElement;
  if (activeEl && fmEls && activeEl !== fmEls.slider &&
      (activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT" || activeEl.tagName === "TEXTAREA")) return;

  if (fmMode === 'adaptive') {
    // Adaptiv-Tasten (Bauanleitung 02b/2: Stubs, vollständig verdrahtet in 02b/4)
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      fmHandleHeight('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      fmHandleHeight('down');
    } else if (e.key === ' ') {
      e.preventDefault();
      fmReplayCurrent();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      fmAbort();
    }
    return;
  }

  // Slider-Tasten (bestehend, unverändert)
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const step = e.shiftKey ? dir * 1 : dir * 5;
    e.preventDefault();
    const lim = FM_SLIDER_RANGES[fmSlRangeIdx];
    fmCentOffset = Math.max(-lim, Math.min(lim, fmCentOffset + step));
    if (fmEls) fmEls.slider.value = fmCentOffset;
    fmHandleSlider(fmCentOffset);
  } else if (e.key === " ") {
    e.preventDefault();
    fmPlayCurrent();
  } else if (e.key === "Enter") {
    e.preventDefault();
    fmConfirm();
  } else if (e.key === "z" || e.key === "Z") {
    e.preventDefault();
    fmUndo();
  } else if (e.key === "b" || e.key === "B") {
    e.preventDefault();
    if (fmEls && fmEls.simulBtn) fmEls.simulBtn.click();
  }
}

// --- i18n-Aktualisierung ---
function fmApplyLang() {
  const subtabBtn = document.querySelector('.subtab[data-subtab="freqmatch"]');
  if (subtabBtn) subtabBtn.textContent = t("fmSubtabLabel");
  if (fmRunning) fmShowElectrode();
  if (fmEls) {
    const deafHint = fmEls.explainBox.querySelector('#fmDeafHintEl');
    if (deafHint) {
      const hasDeaf = (sideData.left.config || "ci") === "deaf"
                   || (sideData.right.config || "ci") === "deaf";
      deafHint.style.display = hasDeaf ? "" : "none";
      if (hasDeaf) deafHint.textContent = t("cfgHintDeafTest");
    }
  }
}

// --- Modus-Switch (Bauanleitung 02b/2) ---
function fmApplyMode() {
  if (!fmEls) return;

  const isSlider = (fmMode === 'slider');
  if (fmEls.slider)            fmEls.slider.hidden            = !isSlider;
  if (fmEls.extendBtn)         fmEls.extendBtn.hidden         = !isSlider || fmEls.extendBtn.hidden;
  if (fmEls.sliderValue)       fmEls.sliderValue.hidden       = !isSlider;
  if (fmEls.confirmBtn)        fmEls.confirmBtn.hidden        = !isSlider;
  if (fmEls.keyHintBox)        fmEls.keyHintBox.hidden        = !isSlider;
  const confRow = fmEls.testBox.querySelector('.confidence-row');
  const confLbl = fmEls.testBox.querySelector('.conf-quality-label');
  if (confRow) confRow.hidden = !isSlider;
  if (confLbl) confLbl.hidden = !isSlider;
  if (fmEls.seqSelect && fmEls.seqSelect.parentElement) {
    fmEls.seqSelect.parentElement.style.display = isSlider ? '' : 'none';
  }

  const isAdaptive = !isSlider;
  if (fmEls.hjContainer) fmEls.hjContainer.hidden = !isAdaptive;
  if (fmEls.statusGrid)  fmEls.statusGrid.hidden  = !isAdaptive;
}

let _fmDurStash_slider  = 400;
let _fmPauStash_slider  = 400;

function fmSetMode(newMode, opts) {
  opts = opts || {};
  if (newMode !== 'slider' && newMode !== 'adaptive') return;
  if (newMode === fmMode && !opts.force) return;
  if (fmRunning) return;

  if (fmEls && fmEls.durInput && fmEls.pauseInput) {
    if (fmMode === 'slider') {
      _fmDurStash_slider = parseInt(fmEls.durInput.value)   || 1000;
      _fmPauStash_slider = parseInt(fmEls.pauseInput.value) || 500;
    } else {
      const varSd = sideData[fmVarSide] || sideData.left;
      varSd.fmAdaptiveDur = parseInt(fmEls.durInput.value)   || 200;
      varSd.fmAdaptivePau = parseInt(fmEls.pauseInput.value) || 200;
    }
  }

  fmMode = newMode;

  if (sideData[fmVarSide]) sideData[fmVarSide].fmMode = newMode;

  if (fmEls && fmEls.durInput && fmEls.pauseInput) {
    if (newMode === 'slider') {
      fmEls.durInput.value   = _fmDurStash_slider;
      fmEls.pauseInput.value = _fmPauStash_slider;
    } else {
      const varSd = sideData[fmVarSide] || sideData.left;
      fmEls.durInput.value   = (varSd.fmAdaptiveDur != null) ? varSd.fmAdaptiveDur : 200;
      fmEls.pauseInput.value = (varSd.fmAdaptivePau != null) ? varSd.fmAdaptivePau : 200;
    }
  }

  fmApplyMode();
  if (fmEls && fmEls.modeSelect) fmEls.modeSelect.value = newMode;
}

function fmLoadModeFromSide() {
  const varSide = (fmEls && fmEls.refSelect)
    ? (fmEls.refSelect.value === 'left' ? 'right' : 'left')
    : 'right';
  const sd = sideData[varSide] || {};
  const wanted = (sd.fmMode === 'slider' || sd.fmMode === 'adaptive')
    ? sd.fmMode : 'adaptive';
  fmSetMode(wanted, { force: true });
  fmRefreshResumeHint();
}

// --- DOMContentLoaded ---
document.addEventListener("DOMContentLoaded", () => {
  const parentEl = document.getElementById("subpanel-messungen-freqmatch");
  if (!parentEl) return;

  const fmCfg = {
    id: 'freqmatch',
    explain: {
      titleKey: 'fmTitle',
      paragraphs: [
        { key: 'fmHintMethod', kind: 'plain' },
        { key: 'fmPrereqHint', kind: 'plain' },
        { key: 'fmHintWarn', kind: 'warn' }
      ]
    },
    presets: {
      rowMode: {
        show: true,
        modeKey: 'fmLblMode',
        modeOptions: [
          ['adaptive', 'fmModeAdaptive'],
          ['slider',   'fmModeSlider']
        ]
        // kein runOptions → kein runSelect
      },
      rowFine:     { show: true,
                     refSelect: { type: 'side', key: 'fmLblRef' } },
      rowVolume:   { show: true },
      rowSequence: {
        sequence: { show: true, source: 'global' },
        toneType: { show: true, source: 'global' },
        target:   { show: false }
      },
      startStop:   { show: true, startKey: 'fmLblStart' }
    },
    test: {
      subTitleKey:       'fmRunningTitle',
      subHintKey:        'fmRunningHint',
      progressBar:       true,
      progressFormat:    'simple',
      swapButton:        { show: false },
      pairDisplay:       { mode: 'electrode-vs-refside' },
      excludeButtons:    { show: false, target: 'electrodes' },
      actions:           ['undo', 'replay', 'simul'],
      keyHintBox:        { show: true, unitKey: 'sliderHintCent' },
      slider:            { unit: 'cent', ranges: [100, 500, 1200] },
      sliderValue:       true,
      cumulativeDisplay: { show: false },
      confirmButton:     { show: true, key: 'btnConfirmOffset' },
      confidence:        { show: true },
      heightJudgment:    { show: true },   // Bauanleitung 02b/1
      statusGrid:        { show: true }    // Bauanleitung 02b/1
    }
  };

  fmEls = buildTestPanel(parentEl, fmCfg);
  fmEls.durInput.value   = 400;
  fmEls.pauseInput.value = 400;

  // Hinweistext für Lauf-2-Empfehlung (nach Lauf-1-Abschluss)
  const _lauf2Hint = _mkEl('p', 'explain explain-info');
  _lauf2Hint.id = 'fmLauf2HintEl';
  _lauf2Hint.hidden = true;
  if (typeof t === 'function') _lauf2Hint.textContent = t('fmLblRun2Hint') || '';
  // Einfügen nach explainBox (vor testBox)
  fmEls.explainBox.insertAdjacentElement('afterend', _lauf2Hint);

  // Zweiter Fortschrittsbalken für Lauf 2
  const _lauf1Label = _mkEl('span', 'fm-lauf-label');
  _lauf1Label.dataset.t = 'fmLblLauf1';
  _lauf1Label.textContent = (typeof t === 'function' && t('fmLblLauf1')) || 'Lauf 1';
  _lauf1Label.style.cssText = 'font-size:.82em;color:#6b7280;display:block;margin-top:.4rem';

  const _lauf2Label = _mkEl('span', 'fm-lauf-label');
  _lauf2Label.dataset.t = 'fmLblLauf2';
  _lauf2Label.textContent = (typeof t === 'function' && t('fmLblLauf2')) || 'Lauf 2';
  _lauf2Label.style.cssText = 'font-size:.82em;color:#6b7280;display:block;margin-top:.6rem';

  const _pb2 = _mkEl('div', 'progress-bar');
  fmEls.progressFill2 = _mkEl('div', 'progress-fill');
  _pb2.appendChild(fmEls.progressFill2);
  fmEls.progressText2 = _mkEl('div', 'progress-text');
  fmEls.progressText2.textContent = (typeof t === 'function' && t('fmLblLauf2')) || 'Lauf 2';

  // Lauf-1-Label vor dem vorhandenen Balken einfügen
  const _existingBar = fmEls.progressFill.parentElement;
  _existingBar.insertAdjacentElement('beforebegin', _lauf1Label);
  // Lauf-2 nach dem vorhandenen Balken + progressText einfügen
  fmEls.progressText.insertAdjacentElement('afterend', fmEls.progressText2);
  fmEls.progressText.insertAdjacentElement('afterend', _pb2);
  fmEls.progressText.insertAdjacentElement('afterend', _lauf2Label);

  // Modus-Switch (Bauanleitung 02b/2)
  if (fmEls.modeSelect) {
    fmEls.modeSelect.addEventListener('change', function() {
      fmSetMode(fmEls.modeSelect.value);
    });
  }

  // Taube-Seite Hinweis dynamisch ins Erklärungs-Block einfügen
  const deafHint = _mkEl('p', 'explain explain-warn');
  deafHint.id = 'fmDeafHintEl';
  deafHint.style.display = 'none';
  fmEls.explainBox.appendChild(deafHint);

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

  // Events: Start / Stop
  fmEls.startBtn.addEventListener('click', fmStart);
  fmEls.stopBtn.addEventListener('click', fmAbort);

  // Events: Test-Aktionen
  if (fmEls.replayBtn) fmEls.replayBtn.addEventListener('click', () => fmPlayCurrent());
  if (fmEls.simulBtn)  fmEls.simulBtn.addEventListener('click', () => fmPlaySimul());
  if (fmEls.undoBtn)   fmEls.undoBtn.addEventListener('click', fmUndo);
  if (fmEls.confirmBtn) fmEls.confirmBtn.addEventListener('click', fmConfirm);

  // Events: Slider
  fmEls.slider.addEventListener('input', (e) => fmHandleSlider(e.target.value));
  buildSliderTouchCtrl(fmEls.slider, {
    step: 5,
    fineStep: 1,
    replay: function () { if (typeof fmPlayCurrent === 'function') fmPlayCurrent(); },
    labelReplay: '▶ ' + (t('bReplay') || 'Wiederholen')
  });
  if (fmEls.extendBtn) fmEls.extendBtn.addEventListener('click', _fmExtendRange);

  // Events: Elektroden-Ausschluss
  if (fmEls.excludeLeftBtn)  fmEls.excludeLeftBtn.addEventListener('click', _fmRequestExcl);
  if (fmEls.excludeRightBtn) fmEls.excludeRightBtn.addEventListener('click', _fmRequestExcl);

  // Adaptiv: Höher/Tiefer-Buttons (Bauanleitung 02b/2, Stubs)
  if (fmEls.hjHigher) fmEls.hjHigher.addEventListener('click', () => fmHandleHeight('up'));
  if (fmEls.hjLower)  fmEls.hjLower.addEventListener('click',  () => fmHandleHeight('down'));

  // Beim Wechsel der Referenzseite auch Modus der NEUEN var-Seite laden (Bauanleitung 02b/2)
  fmEls.refSelect.addEventListener('change', function() {
    setTimeout(fmLoadModeFromSide, 0);
  });

  // Event: Referenzohr-Wechsel (§6.10)
  let _fmPrevRefVal = fmEls.refSelect.value;
  fmEls.refSelect.addEventListener('change', function() {
    if (fRes.length > 0) {
      fmRCOkBtn.onclick = function() {
        fmRCDlg.hidden = true;
        fRes.splice(0, fRes.length);
        _fmClearPersist('left');
        _fmClearPersist('right');
        _fmPrevRefVal = fmEls.refSelect.value;
      };
      fmRCCancelBtn.onclick = function() {
        fmRCDlg.hidden = true;
        fmEls.refSelect.value = _fmPrevRefVal;
      };
      fmRCDlg.hidden = false;
    } else {
      _fmPrevRefVal = fmEls.refSelect.value;
    }
  });

  // Tastatursteuerung
  document.addEventListener("keydown", fmHandleKey);

  // DEBUG: Testlauf-Button (nur im Debug-Modus sichtbar)
  const _simBtn = _mkEl('button', 'btn dbg-only');
  _simBtn.style.marginTop = '1.5rem';
  _simBtn.textContent = 'DEBUG: Testlauf';
  _simBtn.addEventListener('click', fmRunDebugSim);
  parentEl.appendChild(_simBtn);

  // Texte initial setzen
  fmApplyLang();

  fmLoadModeFromSide();   // initialer Modus aus sideData lesen (Bauanleitung 02b/2)
  fmRefreshResumeHint();
});
