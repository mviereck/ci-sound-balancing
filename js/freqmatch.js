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
let fmModalTone = null;   // BA 230: live-Tonart waehrend des Tonauswahl-Modals; null = kein Modal offen
let fmKbdCorrectVol = null; // BA 239: Korrektorfunktion(vol,hz,pan) aus Modal-Toggles; null = kein Modal offen
let fmRunning = false;
let fmEls = null;
let fmRefSide = "left";
let fmVarSide = "right";
let fmSymmetric = false;   // true wenn refSelect.value === 'symmetric'
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

// BA 207: Selektion der zu testenden Elektroden.
// null  = Default (= alle aktiven Elektroden testen).
// []    = Nutzer hat explizit nichts ausgewählt (Test startet nicht).
// [...] = explizite Auswahl. Filter greift in fmBuildSeq / fmBuildSeqSymmetric.
// Die Auswahl gilt für beide Seiten gleichzeitig, weil FreqMatch
// links↔rechts vergleicht.
let freqmatchTestSelection = null;

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

// BA 206: Aggregat-Wert aus rounds[]-Historie berechnen.
// Regel: ≥3 Werte → Median, =2 → Mittelwert, =1 → der Wert selbst, 0 → null.
function _fmAggregateCent(rounds) {
  if (!Array.isArray(rounds) || rounds.length === 0) return null;
  const vals = rounds.map(function(r) { return r && typeof r.cent === 'number' ? r.cent : null; })
                     .filter(function(v) { return v != null && isFinite(v); });
  if (vals.length === 0) return null;
  if (vals.length === 1) return vals[0];
  if (vals.length === 2) return (vals[0] + vals[1]) / 2;
  const sorted = vals.slice().sort(function(a, b) { return a - b; });
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

// BA 206: Min/Max aus rounds[]-Historie. Rückgabe {min, max} oder null.
function _fmRangeCent(rounds) {
  if (!Array.isArray(rounds) || rounds.length === 0) return null;
  const vals = rounds.map(function(r) { return r && typeof r.cent === 'number' ? r.cent : null; })
                     .filter(function(v) { return v != null && isFinite(v); });
  if (vals.length === 0) return null;
  let mn = vals[0], mx = vals[0];
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] < mn) mn = vals[i];
    if (vals[i] > mx) mx = vals[i];
  }
  return { min: mn, max: mx };
}

// BA 206: Letzter Messwert dieser Elektrode (= Startwert für nächste Runde).
function _fmLastRoundCent(elIdx) {
  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  if (!store) return null;
  const e = store[String(elIdx)];
  if (!e || !Array.isArray(e.rounds) || e.rounds.length === 0) return null;
  const last = e.rounds[e.rounds.length - 1];
  return (last && typeof last.cent === 'number') ? last.cent : null;
}

// --- Hilfsfunktionen ---
function fmCents(refHz, hz) {
  return 1200 * Math.log2(hz / refHz);
}
function fmFreqFromCents(refHz, c) {
  return refHz * Math.pow(2, c / 1200);
}

function _fmShouldShowCochlearFatHint() {
  if (typeof fRes === 'undefined' || !Array.isArray(fRes)) return false;
  if (typeof sideData === 'undefined') return false;
  if (typeof COCHLEAR_FAT_CORRECTION_DATE !== 'number') return false;
  for (let i = 0; i < fRes.length; i++) {
    const e = fRes[i];
    if (!e || typeof e.timestamp !== 'number') continue;
    if (e.timestamp >= COCHLEAR_FAT_CORRECTION_DATE) continue;
    const sd = sideData[e.varSide];
    if (sd && sd.manufacturer === 'cochlear') return true;
  }
  return false;
}

function _fmRefreshCochlearFatHintVisibility() {
  if (!fmEls) return;
  const visible = _fmShouldShowCochlearFatHint();
  testUI.explain.setVisible(fmEls, 'fmCochlearFatHintPara', visible);
  // Datum in den Text einsetzen (jedes Mal frisch, falls Sprache wechselt).
  if (visible) {
    const el = fmEls.explainBox && fmEls.explainBox.querySelector('#fmCochlearFatHintPara');
    if (el) {
      const d = new Date(COCHLEAR_FAT_CORRECTION_DATE);
      const dateStr = d.getUTCFullYear() + '-'
        + String(d.getUTCMonth() + 1).padStart(2, '0') + '-'
        + String(d.getUTCDate()).padStart(2, '0');
      const txt = (typeof t === 'function') ? t('fmCochlearFatCorrectionInfo')
        : 'Cochlear-FAT wurde korrigiert.';
      el.textContent = txt.replace('{date}', dateStr);
    }
  }
}

function fmGVol() {
  return Math.pow(volume_global / 100, 2);
}
function fmGDur() {
  return duration_freqmatch || 750;
}
function fmGPau() {
  return pause_freqmatch || 400;
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
  return sequence_freqmatch === "aba";
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
      return isFinite(levels[0]) ? dB2G(levels[0]) : 1;
    }
    const lgFirst = Math.log(f[0]);
    const lgLast  = Math.log(f[n - 1]);
    const ascending = lgLast > lgFirst;
    if (ascending) {
      if (lg <= lgFirst) {
        return isFinite(levels[0]) ? dB2G(levels[0]) : 1;
      }
      if (lg >= lgLast) {
        return isFinite(levels[n - 1]) ? dB2G(levels[n - 1]) : 1;
      }
    } else {
      if (lg >= lgFirst) {
        return isFinite(levels[0]) ? dB2G(levels[0]) : 1;
      }
      if (lg <= lgLast) {
        return isFinite(levels[n - 1]) ? dB2G(levels[n - 1]) : 1;
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
        if (!isFinite(lvA)) return dB2G(lvB);
        if (!isFinite(lvB)) return dB2G(lvA);
        const tNum = lg - lgA;
        const tDen = lgB - lgA;
        const tt = (tDen === 0) ? 0 : (tNum / tDen);
        const lv = lvA + (lvB - lvA) * tt;
        return dB2G(lv);
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
// BA 207: Schneidet eine Elektroden-Sequenz auf die User-Auswahl.
// freqmatchTestSelection === null → keine Einschränkung (alle aktiven).
// freqmatchTestSelection !== null → Schnittmenge mit gewählten.
function _fmFilterSeqBySelection(seq) {
  if (freqmatchTestSelection == null) return seq;
  var selSet = new Set(freqmatchTestSelection);
  return seq.filter(function(i) { return selSet.has(i); });
}

function fmBuildSeq() {
  const elList = withSide(fmVarSide, () => {
    const result = [];
    for (let i = 0; i < nEl; i++) {
      // BA 164
      if (elActive[i] === false) continue;
      if (elExDur[i]) continue;
      result.push({ idx: i, hz: effFreq(i) });
    }
    return result;
  });
  elList.sort((a, b) => a.hz - b.hz);
  return _fmFilterSeqBySelection(elList.map((x) => x.idx));
}

// Symmetrische Sequenz: nur wenn beide Seiten dieselbe Menge aktiver
// Elektroden haben (selbe Indices). Rückgabe sonst null.
// Sortiert nach Durchschnitts-Mittenfrequenz (links/rechts gemittelt).
function fmBuildSeqSymmetric() {
  function activeList(side) {
    return withSide(side, function() {
      const r = [];
      for (let i = 0; i < nEl; i++) {
        // BA 164
        if (elActive[i] === false) continue;
        if (elExDur[i]) continue;
        r.push(i);
      }
      return r;
    });
  }
  const leftList  = activeList('left');
  const rightList = activeList('right');
  if (leftList.length !== rightList.length) return null;
  for (let j = 0; j < leftList.length; j++) {
    if (leftList[j] !== rightList[j]) return null;
  }
  const seq = leftList.map(function(idx) {
    const fl = withSide('left',  function() { return effFreq(idx); });
    const fr = withSide('right', function() { return effFreq(idx); });
    return { idx: idx, hz: (fl + fr) / 2 };
  });
  seq.sort(function(a, b) { return a.hz - b.hz; });
  return _fmFilterSeqBySelection(seq.map(function(x) { return x.idx; }));
}

// BA 207: Wird vom Auswahl-Dialog nach Confirm aufgerufen.
// Aufgaben:
//   - Adaptive: laufende Tracks mit neuer Auswahl synchronisieren
//   - Slider: laufenden Slider-Round-State synchronisieren
//   - Header-Zusammenfassung neu rendern
//   - Wenn nach Filter keine Elektrode mehr übrig: laufenden Test sauber beenden
function _fmOnSelectionChanged() {
  if (fmAdaptiveActive && typeof _fmApplySelectionToTracks === 'function') {
    _fmApplySelectionToTracks();
    // Statusgrid neu zeichnen, falls existiert.
    if (typeof fmRenderStatusGrid === 'function') fmRenderStatusGrid();
  }
  if (fmRunning && !fmAdaptiveActive && typeof _fmApplySelectionToSliderRun === 'function') {
    _fmApplySelectionToSliderRun();
    if (typeof fmRenderSliderStatusGrid === 'function') fmRenderSliderStatusGrid();
    if (typeof fmUpdateSliderProgress === 'function') fmUpdateSliderProgress();
  }

  // Header-Summary nach-rendern
  if (fmEls && fmEls.header && typeof fmEls.header.electrodeSelectionUpdate === 'function') {
    fmEls.header.electrodeSelectionUpdate();
  }

  // Wenn nach Filter keine testbare Elektrode mehr in der Auswahl ist
  // UND ein Test läuft: sauber beenden.
  if (fmRunning) {
    var freshSeq = fmSymmetric ? fmBuildSeqSymmetric() : fmBuildSeq();
    if (!Array.isArray(freshSeq) || freshSeq.length === 0) {
      var msg = (typeof t === 'function' && t('electrodeSelectionEmptyEnd'))
        || 'Test beendet: Keine ausgewählte Elektrode mehr verfügbar.';
      alert(msg);
      if (fmEls && fmEls._stopTest) fmEls._stopTest();
    }
  }
}

// BA 206: Startwert für eine Elektrode = letzter Wert aus rounds[].
function fmPrevCent(elIdx) {
  const last = _fmLastRoundCent(elIdx);
  if (last != null) return Math.round(last);

  const existing = fRes.find((r) => fmSymmetric
    ? (r.refSide === 'symmetric' && r.elIdx === elIdx)
    : (r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx)
  );
  if (!existing) return 0;
  if (fmSymmetric && typeof existing.cent === 'number' && isFinite(existing.cent)) {
    return Math.round(existing.cent);
  }
  return Math.round(fmCents(existing.varFreq, existing.refFreq));
}

// Gemeinsame Initialisierung zu Beginn jedes Verfahren-Starts
function _fmInitSides() {
  const val = fmEls.header.refSelect.value;
  fmSymmetric = (val === 'symmetric');
  if (fmSymmetric) {
    fmVarSide = 'left';
    fmRefSide = 'right';
  } else {
    fmRefSide = val;
    fmVarSide = (fmRefSide === 'left') ? 'right' : 'left';
  }
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
  if (isPlay) {
    isPlay = false;
    if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
    await new Promise((r) => setTimeout(r, 60));
  }
  let varHz, refHz;
  if (fmSymmetric) {
    const varBase = withSide('left',  function() { return effFreq(fmCurrentEl); });
    const refBase = withSide('right', function() { return effFreq(fmCurrentEl); });
    varHz = varBase * Math.pow(2, -fmCentOffset / 2 / 1200);
    refHz = refBase * Math.pow(2, +fmCentOffset / 2 / 1200);
  } else {
    varHz = fmVarHz(fmCurrentEl);
    refHz = fmFreqFromCents(varHz, fmCentOffset);
  }
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
    return playToneTyped(c, hz, effectiveVol, ms, pan, toneType_freqmatch);
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
    if (isPlay) {
      isPlay = false;
      if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
      await new Promise((r) => setTimeout(r, 60));
    }
    const track  = fmTracks[fmCurTrackId];
    let refHz, varHz;
    if (fmSymmetric) {
      const varBase = withSide('left',  function() { return effFreq(track.electrodeIdx); });
      const refBase = withSide('right', function() { return effFreq(track.electrodeIdx); });
      const halfOff = track.currentOffset / 2;
      if (fmCurCatchInfo) {
        const halfCatch = fmCurCatchInfo.direction / 2;
        varHz = varBase * Math.pow(2, (-halfOff - halfCatch) / 1200);
        refHz = refBase * Math.pow(2, (+halfOff + halfCatch) / 1200);
      } else {
        varHz = varBase * Math.pow(2, -halfOff / 1200);
        refHz = refBase * Math.pow(2, +halfOff / 1200);
      }
    } else {
      const elFreq = withSide(fmVarSide, function() { return effFreq(track.electrodeIdx); });
      refHz = elFreq * Math.pow(2, track.currentOffset / 1200);
      varHz = fmCurCatchInfo
        ? refHz * Math.pow(2, fmCurCatchInfo.direction / 1200)
        : elFreq;
    }
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
      playToneTyped(c, refHz, refVol, ms, refPan, toneType_freqmatch),
      playToneTyped(c, varHz, varVol, ms, varPan, toneType_freqmatch)
    ]);
    testUI.pairIndicator.setPlaying(_fmAdaptPI(), null);
    isPlay = false;
    return;
  }

  // --- Slider-Modus: unverändertes Altverhalten ---
  if (fmCurrentEl === null) return;
  if (isPlay) {
    isPlay = false;
    if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
    await new Promise((r) => setTimeout(r, 60));
  }
  const c = gAC();
  let varHz, refHz;
  if (fmSymmetric) {
    const varBase = withSide('left',  function() { return effFreq(fmCurrentEl); });
    const refBase = withSide('right', function() { return effFreq(fmCurrentEl); });
    varHz = varBase * Math.pow(2, -fmCentOffset / 2 / 1200);
    refHz = refBase * Math.pow(2, +fmCentOffset / 2 / 1200);
  } else {
    varHz = fmVarHz(fmCurrentEl);
    refHz = fmFreqFromCents(varHz, fmCentOffset);
  }
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
    playToneTyped(c, refHz, refVol, ms, refPan, toneType_freqmatch),
    playToneTyped(c, varHz, varVol, ms, varPan, toneType_freqmatch)
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

// Nach 5 Min Inaktivität die Seitenabfrage erneut auslösen (statt den Test
// kommentarlos zu stoppen). Bei Erfolg wird der Idle-Watch neu gestartet,
// damit der Mechanismus nach jeder Bestätigung wieder aktiv ist; bei Abbruch
// durch den Nutzer wird der Test gestoppt.
function _fmStartIdleSideCheck() {
  testUI.sideCheck.startIdleWatch(_fmParentEl, 5 * 60 * 1000, function() {
    if (!fmRunning) return;
    testUI.sideCheck.run(
      { sides: 'both' },
      function() { _fmStartIdleSideCheck(); },
      function() { if (fmEls) fmEls._stopTest(); }
    );
  });
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
  _fmRefreshHGWarningVisibility();
  _fmRefreshCochlearFatHintVisibility();
  _fmRenderPrereqHints();
}

function _fmEvalTestEligibility() {
  // BA 155: „Keine Angabe" / Hersteller-fehlend
  if (typeof isSideUsable === 'function') {
    if (!isSideUsable('left') || !isSideUsable('right')) {
      return { blocked: true, reason: 'sideUnknown' };
    }
  }
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  if (leftCfg === 'deaf' || rightCfg === 'deaf') {
    return { blocked: true, reason: 'sideDeaf' };
  }
  function isAcoustic(c) { return c === 'normal' || c === 'shoh' || c === 'hg'; }
  if (isAcoustic(leftCfg) && isAcoustic(rightCfg)) {
    return { blocked: true, reason: 'bothAcoustic' };
  }
  return { blocked: false, reason: null };
}

function _fmAutoSetRefMode() {
  if (!fmEls || !fmEls.header || !fmEls.header.refSelect) return;
  // Schutz: solange Daten vorliegen, refSelect nicht implizit umstellen —
  // ein manueller Wechsel ist durch depLock gesperrt (Popup mit Begründung).
  if (fRes.length > 0) return;
  if (_fmHasAdaptiveData()) return;
  if (_fmHasSliderEstimates()) return;
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  const leftIsCI  = (leftCfg  === 'ci');
  const rightIsCI = (rightCfg === 'ci');
  if (leftIsCI && !rightIsCI) {
    fmEls.header.refSelect.value = 'right';
  } else if (rightIsCI && !leftIsCI) {
    fmEls.header.refSelect.value = 'left';
  } else if (leftIsCI && rightIsCI) {
    // Beide CI: 'symmetric' setzen, sofern die Dropdown-Option existiert.
    const hasSym = Array.from(fmEls.header.refSelect.options).some(function(o) {
      return o.value === 'symmetric';
    });
    if (hasSym) fmEls.header.refSelect.value = 'symmetric';
  }
  // beide akustisch: kein Override (Sperre wird durch L1-Tab-Sperre BA 172 behandelt).
}

function _fmRefreshHGWarningVisibility() {
  if (!fmEls) return;
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  const hasHG = (leftCfg === 'hg') || (rightCfg === 'hg');
  // HG-Warnung nur zeigen, wenn Test nicht ohnehin geblockt ist.
  const blocked = _fmEvalTestEligibility().blocked;
  const visible = hasHG && !blocked;
  testUI.explain.setVisible(fmEls, 'fmHGWarnPara', visible);
}


// BA 251: jRes entfaellt; Lautstaerke-Daten = bRes.
function _fmHasLvData(side) {
  const s = sideData[side];
  if (!s) return false;
  return (s.bRes && s.bRes.length > 0);
}

function _fmRenderPrereqHints() {
  const lvLeftEl  = document.getElementById('fmPrereqLvLeftPara');
  const lvRightEl = document.getElementById('fmPrereqLvRightPara');
  const sbEl      = document.getElementById('fmPrereqSbHintPara');
  if (lvLeftEl)  lvLeftEl.style.display  = _fmHasLvData('left')  ? 'none' : '';
  if (lvRightEl) lvRightEl.style.display = _fmHasLvData('right') ? 'none' : '';
  if (sbEl) {
    const hasSb = typeof lrResults !== 'undefined'
               && lrResults
               && Object.keys(lrResults).length > 0;
    sbEl.style.display = hasSb ? 'none' : '';
  }
}

function _fmRefreshTabState() {
  if (!fmEls) return;
  if (!fmRunning) {
    _fmAutoSetRefMode();
    fmLoadVerfahrenFromSide();
  }
  if (typeof fmRefreshResumeHint === 'function') fmRefreshResumeHint();
  _fmRefreshHGWarningVisibility();
  _fmRefreshCochlearFatHintVisibility();
  _fmRenderPrereqHints();
}

function _fmHasSliderEstimates() {
  return ['left', 'right'].some(function(side) {
    const fa = sideData[side] && sideData[side].freqmatchAdaptive;
    const est = fa && typeof fa.sliderEstimates === 'object' && fa.sliderEstimates;
    return !!(est && Object.keys(est).length > 0);
  });
}

function _fmHasAdaptiveData() {
  return ['left', 'right'].some(function(side) {
    const fa = sideData[side] && sideData[side].freqmatchAdaptive;
    return !!(fa && Array.isArray(fa.runs) && fa.runs.some(function(r) {
      return r.tracks && Object.keys(r.tracks).some(function(k) {
        return r.tracks[k] && (r.tracks[k].trialCount || 0) > 0;
      });
    }));
  });
}

function fmUpdateSliderModeAvail() {
  if (!fmEls) return;
  const _refVal2 = (fmEls.header && fmEls.header.refSelect)
    ? fmEls.header.refSelect.value : null;
  const _varSide = (!_refVal2 || _refVal2 === 'symmetric')
    ? (_refVal2 === 'symmetric' ? 'left' : fmVarSide)
    : (_refVal2 === 'left' ? 'right' : 'left');
  const sd = sideData[_varSide] || {};
  const fa = sd.freqmatchAdaptive;
  const hasAnswers = !!(fa && Array.isArray(fa.runs) && fa.runs.some(function(r) {
    return r.tracks && Object.keys(r.tracks).some(function(k) {
      return r.tracks[k] && (r.tracks[k].trialCount || 0) > 0;
    });
  }));
  testUI.field.setEnabled(fmEls, 'verfahrenSelect.slider', !hasAnswers, {});
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

  // BA 240: Dur/Pau-Stash arbeitet jetzt auf State-Variablen statt DOM-Inputs.
  if (oldVerfahren === 'slider') {
    _fmDurStash_slider = duration_freqmatch || 400;
    _fmPauStash_slider = pause_freqmatch    || 400;
  }
  if (newVerfahren === 'slider') {
    duration_freqmatch = _fmDurStash_slider;
    pause_freqmatch    = _fmPauStash_slider;
  }

  testUI.verfahren.select(fmEls, newVerfahren);
  fmRefreshResumeHint();
}

function fmLoadVerfahrenFromSide() {
  if (!fmEls) return;
  const _refVal = fmEls.header.refSelect.value;
  fmSymmetric = (_refVal === 'symmetric');
  if (fmSymmetric) {
    fmVarSide = 'left';
    fmRefSide = 'right';
  } else {
    fmRefSide = _refVal;
    fmVarSide = (fmRefSide === 'left') ? 'right' : 'left';
  }

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
      // BA 220: preserveOrder, damit Gruppen-Headings, Methodentext und
      // zugehoerige Warnung visuell zusammenstehen statt durch die
      // Schwere-Sortierung gemischt zu werden.
      preserveOrder: true,
      paragraphs: [
        { key: 'fmMaturityHint',         kind: 'caution' },

        // Warn-Absaetze, deren Sichtbarkeit dynamisch umgeschaltet wird
        // (Initial hidden=true; testUI.explain.setVisible blendet bei Bedarf ein).
        { key: 'fmHGWarn',               kind: 'warn',    id: 'fmHGWarnPara',
                                         hidden: true },
        { key: 'fmCochlearFatCorrectionInfo', kind: 'warn', id: 'fmCochlearFatHintPara',
                                         hidden: true },

        // Voraussetzungen — bleiben bedingt sichtbar (durch _fmRenderPrereqHints).
        { key: 'fmPrereqLvLeft',         kind: 'warn',    id: 'fmPrereqLvLeftPara'    },
        { key: 'fmPrereqLvRight',        kind: 'warn',    id: 'fmPrereqLvRightPara'   },
        { key: 'fmPrereqSb',             kind: 'warn',    id: 'fmPrereqSbHintPara'    },

        // Gruppe 1: beidseitiges CI.
        { key: 'fmGroupBothCi',          kind: 'heading' },
        { key: 'fmHintMethodBothCI',     kind: 'plain' },
        { key: 'fmHintWarnBothCI',       kind: 'caution' },

        // Gruppe 2: CI + akustische Gegenseite.
        { key: 'fmGroupCiAcoustic',      kind: 'heading' },
        { key: 'fmHintMethodCiNatural',  kind: 'plain' },
        { key: 'fmHintWarn',             kind: 'caution' },

        { key: 'fmHintWorkflow',         kind: 'plain' }
      ]
    },
    header: {
      common: {
        refSelect:    { type: 'side', key: 'fmLblRef', includeSymmetric: true },
        // BA 240: Vol/Dur/Pau leben jetzt im Tonauswahl-Modal, nicht mehr im Header.
        volume:       false,
        duration:     false,
        pause:        false,
        // BA 209: Tonart-Dropdown durch tonePopupButton ersetzt.
        toneType:     false,
        tonePopupButton: {
          getToneType: function() { return toneType_freqmatch; },
          setToneType: function(tt) { toneType_freqmatch = tt; },
          // BA 230: Klavier-Bug-Fix — Modal teilt die aktuell angeklickte
          // Tonart mit; onPress liest fmModalTone mit Fallback auf toneType_freqmatch.
          onToneSelected:  function(tt) { fmModalTone = tt; },
          onModalClose:    function()   { fmModalTone = null; fmKbdCorrectVol = null; },
          onTogglesReady:  function(fn) { fmKbdCorrectVol = fn; },
          // BA 256: Korrektur-Toggles in Tests ausgeblendet — Wirkung bleibt aktiv.
          showToggles:  false,
          // BA 240: Vol/Dur/Pau-Felder in der Modal aktivieren.
          showVolume:   true,
          showDuration: true,
          showPause:    true,
          getVolumePercent: function() { return volume_global; },
          setVolumePercent: function(v) { volume_global = v; },
          getDurationMs:    function() { return duration_freqmatch; },
          setDurationMs:    function(v) { duration_freqmatch = v; },
          getPauseMs:       function() { return pause_freqmatch; },
          setPauseMs:       function(v) { pause_freqmatch = v; },
          // BA 240: Hint-Text fuer Test-Verfahren.
          hintKey: 'tonePopupHint',
          getVolume:   function() { return fmGVol(); },
          getPreviewSequence: function() {
            var hzLeft = 1000, hzRight = 1000;
            if (fmRunning && fmCurrentEl != null) {
              if (fmSymmetric) {
                var baseL = withSide('left',  function() { return effFreq(fmCurrentEl); });
                var baseR = withSide('right', function() { return effFreq(fmCurrentEl); });
                hzLeft  = baseL * Math.pow(2, -fmCentOffset / 2 / 1200);
                hzRight = baseR * Math.pow(2, +fmCentOffset / 2 / 1200);
              } else {
                var varHz = fmVarHz(fmCurrentEl);
                var refHz = fmFreqFromCents(varHz, fmCentOffset);
                if (fmVarSide === 'left') { hzLeft = varHz; hzRight = refHz; }
                else                       { hzLeft = refHz; hzRight = varHz; }
              }
            } else if (fmAdaptiveActive && fmCurTrackId != null
                       && fmTracks && fmTracks[fmCurTrackId]) {
              var tr = fmTracks[fmCurTrackId];
              if (fmSymmetric) {
                var bL = withSide('left',  function() { return effFreq(tr.electrodeIdx); });
                var bR = withSide('right', function() { return effFreq(tr.electrodeIdx); });
                var half = tr.currentOffset / 2;
                hzLeft  = bL * Math.pow(2, -half / 1200);
                hzRight = bR * Math.pow(2, +half / 1200);
              } else {
                var elHz = withSide(fmVarSide, function() { return effFreq(tr.electrodeIdx); });
                var refHz2 = elHz * Math.pow(2, tr.currentOffset / 1200);
                if (fmVarSide === 'left') { hzLeft = elHz;   hzRight = refHz2; }
                else                       { hzLeft = refHz2; hzRight = elHz;   }
              }
            }
            var dur = fmGDur();
            var pau = fmGPau();
            return [
              { hz: hzLeft,  pan: -1, durationMs: dur },
              { pauseMs: pau },
              { hz: hzRight, pan:  1, durationMs: dur }
            ];
          },
          // BA 228/229: Klavier-Widget in der Modalbox aktivieren.
          // BA 252: beidseitige Disabled-Logik, kein elActive-Filter hier.
          keyboardMode: true,
          getElectrodeFreqs: function() {
            // Anzahl Tasten = Minimum aus var- und ref-Seite.
            // Frequenzen kommen von der var-Seite (CI-Seite im
            // Frequenzabgleich-Kontext). Kein Filter auf
            // elActive/elExDur -- das macht getDisabledElectrodes.
            var vSide = (typeof fmVarSide === 'string' && fmVarSide)
              ? fmVarSide : activeSide;
            var rSide = (typeof fmRefSide === 'string' && fmRefSide)
              ? fmRefSide : (vSide === 'left' ? 'right' : 'left');
            var vN = sideData[vSide] ? sideData[vSide].nEl : 0;
            var rN = sideData[rSide] ? sideData[rSide].nEl : 0;
            var n  = Math.min(vN, rN);
            if (n <= 0) return [];
            var freqs = [];
            withSide(vSide, function() {
              for (var i = 0; i < n; i++) freqs.push(effFreq(i));
            });
            return freqs;
          },
          getElectrodeLabels: function() {
            var vSide = (typeof fmVarSide === 'string' && fmVarSide)
              ? fmVarSide : activeSide;
            var rSide = (typeof fmRefSide === 'string' && fmRefSide)
              ? fmRefSide : (vSide === 'left' ? 'right' : 'left');
            var vN = sideData[vSide] ? sideData[vSide].nEl : 0;
            var rN = sideData[rSide] ? sideData[rSide].nEl : 0;
            var n  = Math.min(vN, rN);
            if (n <= 0) return [];
            var labels = [];
            withSide(vSide, function() {
              var prefix = dENPrefix();
              for (var i = 0; i < n; i++) labels.push(prefix + dEN(i));
            });
            return labels;
          },
          getDisabledElectrodes: function() {
            // Disabled = auf var- ODER ref-Seite abgewaehlt
            // (elActive === false) oder ausgeschlossen (elExDur !== null).
            var vSide = (typeof fmVarSide === 'string' && fmVarSide)
              ? fmVarSide : activeSide;
            var rSide = (typeof fmRefSide === 'string' && fmRefSide)
              ? fmRefSide : (vSide === 'left' ? 'right' : 'left');
            var sdV = sideData[vSide], sdR = sideData[rSide];
            if (!sdV || !sdR) return [];
            var n = Math.min(sdV.nEl || 0, sdR.nEl || 0);
            var dis = [];
            for (var i = 0; i < n; i++) {
              var off = (sdV.elActive && sdV.elActive[i] === false)
                     || (sdV.elExDur  && sdV.elExDur[i]  != null)
                     || (sdR.elActive && sdR.elActive[i] === false)
                     || (sdR.elExDur  && sdR.elExDur[i]  != null);
              if (off) dis.push(i);
            }
            return dis;
          },
          // BA 229: Aufleucht-Dauer = volle Sequenz (Var-Burst + Pause +
          // Ref-Burst), passt zur Anschlag-Logik in onPress.
          getHighlightMs: function() { return fmGDur() * 2 + fmGPau(); },
          onPress: function(electrodeIdx, hz) {
            // Frequenzabgleich-Burst-Sequenz: Var-Seite-Burst,
            // kurze Pause, dann Ref-Seite-Burst (gleiche Frequenz).
            // Schwarze Zier-Tasten (electrodeIdx === -1) spielen
            // ihre Mittelfrequenz auch nach diesem Schema.
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (!c) return;
            var vol   = fmGVol();
            var durMs = fmGDur();
            var pauMs = fmGPau();
            var varSide = (typeof fmVarSide === 'string' && fmVarSide)
              ? fmVarSide : activeSide;
            var varPan = (varSide === 'left') ? -1 : 1;
            var refPan = -varPan;
            var tt = (fmModalTone !== null) ? fmModalTone : toneType_freqmatch;
            var cv = fmKbdCorrectVol;
            var varVol = (typeof cv === 'function') ? cv(vol, hz, varPan) : vol;
            var refVol = (typeof cv === 'function') ? cv(vol, hz, refPan) : vol;
            try {
              playToneTyped(c, hz, varVol, durMs, varPan, tt);
              setTimeout(function() {
                playToneTyped(c, hz, refVol, durMs, refPan, tt);
              }, durMs + pauMs);
            } catch (e) { /* swallow */ }
          }
        },
        sequence:     { show: true, source: 'global' },
        sliderTarget: false,
        // BA 207: Auswahl-Komponente. FreqMatch braucht >= 1 Elektrode.
        electrodeSelection: {
          minSelected: 1,
          getSelection: function() { return freqmatchTestSelection; },
          setSelection: function(sel) {
            freqmatchTestSelection = sel.slice();
            _fmOnSelectionChanged();
          },
          getElectrodeStatus: function() {
            var testable = [], muted = [], excluded = [];
            for (var i = 0; i < nEl; i++) {
              if (elExDur[i] != null)         excluded.push(i);
              else if (elActive[i] === false) muted.push(i);
              else                            testable.push(i);
            }
            return { testable: testable, muted: muted, excluded: excluded };
          },
          electrodeLabel: function(i) {
            return dENPrefix() + dEN(i);
          }
        }
      },
      startStop: { startKey: 'fmLblStart', stopKey: 'btnPauseTest', resumable: true }
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
          slider:        { unit: 'cent', initialRange: 100, maxRange: 1200, touchStep: 5, touchFineStep: 1, rangeHint: true },
          sliderValue:   { show: true },
          confirmButton: { key: 'btnConfirmOffset' },
          actions:       ['undo', 'replay', 'simul', 'pause'],
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
          onPause:    fmPauseSlider,
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
        // BA 222: Vortest-Empfehlung. Verletzt, wenn fuer keine einzige
        // testbare Elektrode eine Slider-Schaetzung vorliegt. TestUI
        // oeffnet vor onStart ein Modal mit drei Optionen.
        prerequisites: [
          {
            checkFn:    function() { return !_fmShouldOfferSliderEstimate(); },
            titleKey:   'fmSliderEstimateTitle',
            messageKey: 'fmSliderEstimateMsg',
            actions: [
              {
                labelKey: 'fmSliderEstimateBtnSlider',
                kind:     'custom',
                run:      function() { fmSetVerfahren('slider'); }
              },
              {
                labelKey: 'fmSliderEstimateBtnSkip',
                kind:     'continue'
              },
              {
                labelKey: 'fmSliderEstimateBtnCancel',
                kind:     'abort'
              }
            ]
          }
        ],
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

  // Events: Referenzseiten-Wechsel (BA 151: Sperre statt Custom-Dialog)
  fmEls.header.refSelect.addEventListener('change', function() {
    setTimeout(fmLoadVerfahrenFromSide, 0);
  });

  // Texte initial setzen
  fmApplyLang();

  if (!fmRunning) _fmAutoSetRefMode();
  fmLoadVerfahrenFromSide();
  fmRefreshResumeHint();
  _fmRefreshHGWarningVisibility();
  _fmRefreshCochlearFatHintVisibility();
});

function fmRefreshElectrodeSelectionSummary() {
  if (fmEls && fmEls.header && typeof fmEls.header.electrodeSelectionUpdate === 'function') {
    fmEls.header.electrodeSelectionUpdate();
  }
}

// BA 281: Tonart-Label im Kopf nach Laden eines Stands aktualisieren.
function fmRefreshToneTypeLabel() {
  if (fmEls && fmEls.header && typeof fmEls.header.tonePopupUpdate === 'function') {
    fmEls.header.tonePopupUpdate();
  }
}
