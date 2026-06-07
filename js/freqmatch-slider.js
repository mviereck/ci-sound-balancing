// ============================================================
// freqmatch-slider.js — Frequenzabgleich: Verfahren "Slider Round"
// ============================================================
// BA 206: Mehrfach-Runden, zufällige Reihenfolge pro Runde, Pause/Resume.
// Abhängigkeit: freqmatch.js (shared State, Hilfsfunktionen, Persistenz).

// --- UI-Anzeige ---

function fmUpdateSliderDisplay() {
  if (!fmEls || fmCurrentEl === null) return;
  const slRefs = fmEls.verfahren && fmEls.verfahren.slider;
  const centStr = (fmCentOffset >= 0 ? "+" : "") + Math.round(fmCentOffset);
  const centUnit = (typeof t === 'function' && t("fmCentUnit")) || "Cent";
  if (fmSymmetric) {
    const leftBase  = withSide('left',  function() { return effFreq(fmCurrentEl); });
    const rightBase = withSide('right', function() { return effFreq(fmCurrentEl); });
    const playL = leftBase  * Math.pow(2, -fmCentOffset / 2 / 1200);
    const playR = rightBase * Math.pow(2, +fmCentOffset / 2 / 1200);
    if (slRefs && slRefs.slider) {
      testUI.slider.setValueDisplay(
        slRefs.slider,
        centStr + " " + centUnit
          + " (L: " + playL.toFixed(0) + " Hz / R: " + playR.toFixed(0) + " Hz)"
      );
    }
    return;
  }
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const hzStr = refHz.toFixed(2);
  if (slRefs && slRefs.slider) {
    testUI.slider.setValueDisplay(
      slRefs.slider,
      centStr + " " + centUnit + " (" + hzStr + " Hz)"
    );
  }
  const refSideLabel = fmRefSide === "left" ? t("sideLeft") : t("sideRight");
  const refText = refSideLabel + ": " + hzStr + " Hz, " + centStr + " " + centUnit;
  const pi = _fmSliderPI();
  if (pi) {
    if (fmRefSide === "left") {
      testUI.pairIndicator.setLabels(pi, { leftText: refText });
    } else {
      testUI.pairIndicator.setLabels(pi, { rightText: refText });
    }
  }
}

function fmShowElectrode() {
  if (!fmEls || fmCurrentEl === null) return;
  const slRefs = fmEls.verfahren && fmEls.verfahren.slider;
  const pi = _fmSliderPI();
  if (fmSymmetric) {
    const leftHz  = withSide('left',  function() { return effFreq(fmCurrentEl); });
    const rightHz = withSide('right', function() { return effFreq(fmCurrentEl); });
    if (pi) {
      const leftLabel  = withSide('left',  function() { return dENPrefix() + dEN(fmCurrentEl); });
      const rightLabel = withSide('right', function() { return dENPrefix() + dEN(fmCurrentEl); });
      testUI.pairIndicator.setLabels(pi, {
        leftText:  leftLabel  + ", " + leftHz.toFixed(2)  + " Hz (" + t("sideLeft")  + ")",
        rightText: rightLabel + ", " + rightHz.toFixed(2) + " Hz (" + t("sideRight") + ")"
      });
    }
  } else {
    const varHz = fmVarHz(fmCurrentEl);
    const varSideLabel = fmVarSide === "left" ? t("sideLeft") : t("sideRight");
    const varText = withSide(fmVarSide, () => dENPrefix()) + fmDEN(fmCurrentEl) + ", " +
      varHz.toFixed(2) + " Hz (" + varSideLabel + ")";
    if (pi) {
      if (fmVarSide === "left") {
        testUI.pairIndicator.setLabels(pi, { leftText: varText });
      } else {
        testUI.pairIndicator.setLabels(pi, { rightText: varText });
      }
    }
  }
  if (slRefs && slRefs.slider) {
    // BA 221: Slider-Range so erweitern, dass Marker und Min/Max des
    // Range-Hints reinpassen. Sonst blendet setRangeHint sie aus.
    var _markerAbs = _fmSliderMarkerMaxAbs(fmCurrentEl);
    testUI.slider.setValue(slRefs.slider, fmCentOffset, { minAbs: _markerAbs });
  }
  fmUpdateSliderDisplay();
  _fmUpdateSliderRangeMarker();
  fmUpdateSliderProgress();
  const undoBtn = _fmSliderUndo();
  if (undoBtn) undoBtn.disabled = fmSeqIdx === 0;
}

// BA 221: Maximaler Absolutbetrag aus bisherigen Slider-Runden fuer
// diese Elektrode — fuer minAbs in testUI.slider.setValue.
// Liefert 0, wenn keine Daten oder keine endlichen Werte vorliegen.
function _fmSliderMarkerMaxAbs(elIdx) {
  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  if (!store) return 0;
  const e = store[String(elIdx)];
  const rounds = (e && Array.isArray(e.rounds)) ? e.rounds : null;
  if (!rounds || rounds.length === 0) return 0;
  const agg = _fmAggregateCent(rounds);
  const range = _fmRangeCent(rounds);
  let m = 0;
  if (agg != null && isFinite(agg)) m = Math.max(m, Math.abs(agg));
  if (range) {
    if (isFinite(range.min)) m = Math.max(m, Math.abs(range.min));
    if (isFinite(range.max)) m = Math.max(m, Math.abs(range.max));
  }
  return m;
}

// BA 206/221: Min/Max-Band + Median-Dreieck unter dem Slider.
// Sichtbar ab dem ersten gespeicherten Wert; Band erst ab 2 unterschiedlichen Werten.
// Daten werden an testUI.slider.setRangeHint uebergeben — dort steckt die DOM-Logik.
function _fmUpdateSliderRangeMarker() {
  if (!fmEls || fmCurrentEl === null) return;
  const slRefs = fmEls.verfahren && fmEls.verfahren.slider;
  if (!slRefs || !slRefs.slider) return;

  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  const e = store ? store[String(fmCurrentEl)] : null;
  const rounds = (e && Array.isArray(e.rounds)) ? e.rounds : null;
  const agg = _fmAggregateCent(rounds);
  if (agg == null) {
    testUI.slider.setRangeHint(slRefs.slider, null);
    return;
  }
  const range = _fmRangeCent(rounds);
  const labelText = (agg >= 0 ? "+" : "") + (Math.round(agg * 10) / 10) + " ct";
  testUI.slider.setRangeHint(slRefs.slider, {
    marker: agg,
    label:  labelText,
    min:    (range && range.min !== range.max) ? range.min : null,
    max:    (range && range.min !== range.max) ? range.max : null
  });
}

// --- Testablauf ---

// BA 207: Synchronisiert sliderRoundRun mit der User-Auswahl.
// Wird nach Auswahl-Änderung aufgerufen, wenn der Slider-Modus aktiv ist.
// Wirkung:
//   - run.electrodeIdxList auf gefilterte Sequenz setzen
//   - remainingInRound auf Schnittmenge filtern
//   - totalInRound aktualisieren
//   - fmSeq spiegeln und fmSeqIdx auf passenden Index nachjustieren
function _fmApplySelectionToSliderRun() {
  if (!sideData[fmVarSide]) return;
  var fa = sideData[fmVarSide].freqmatchAdaptive;
  if (!fa || !fa.sliderRoundRun) return;
  var run = fa.sliderRoundRun;
  var freshSeq = fmSymmetric ? fmBuildSeqSymmetric() : fmBuildSeq();
  if (!Array.isArray(freshSeq)) freshSeq = [];
  run.electrodeIdxList = freshSeq.slice();
  var freshSet = new Set(freshSeq);
  run.remainingInRound = (run.remainingInRound || []).filter(function(i) { return freshSet.has(i); });
  run.totalInRound = run.electrodeIdxList.length;
  run.completedInRound = run.totalInRound - run.remainingInRound.length;

  // Aktive fmSeq-Sicht in Übereinstimmung mit verbliebenen Elektroden.
  fmSeq = run.remainingInRound.slice();
  // fmSeqIdx so setzen, daß fmCurrentEl (falls noch gültig) auf [0] sitzt;
  // sonst beginnt der Lauf bei [0] mit der nächsten verbliebenen.
  if (fmCurrentEl != null && freshSet.has(fmCurrentEl)) {
    var pos = fmSeq.indexOf(fmCurrentEl);
    fmSeqIdx = pos >= 0 ? pos : 0;
  } else {
    fmSeqIdx = 0;
  }
}

function fmStartSlider() {
  if (!fmEls) return;
  _fmInitSides();
  if (fmSymmetric) {
    fmSeq = fmBuildSeqSymmetric();
    if (fmSeq === null) {
      alert((typeof t === 'function' && t('fmSymmetricElMismatch'))
        || 'Symmetrischer Modus: Beide Seiten müssen dieselben aktiven Elektroden haben.');
      fmEls._stopTest();
      return;
    }
    if (fmSeq.length === 0) {
      alert((typeof t === 'function' && t('fmNoActiveEl')) || 'Keine aktiven Elektroden.');
      fmEls._stopTest();
      return;
    }
  } else {
    if ((sideData.left  && sideData.left.config)  === 'ci' &&
        (sideData.right && sideData.right.config) === 'ci' &&
        fmBuildSeqSymmetric() === null) {
      alert((typeof t === 'function' && t('fmElMismatch'))
        || 'Frequenzabgleich nicht moeglich: Auf beiden Seiten müssen dieselben Elektroden aktiv sein.');
      fmEls._stopTest();
      return;
    }
    fmSeq = fmBuildSeq();
    if (fmSeq.length === 0) {
      alert((typeof t === 'function' && t('fmNoActiveEl')) || 'Keine aktiven Elektroden auf der variablen Seite.');
      fmEls._stopTest();
      return;
    }
  }
  testUI.sideCheck.run(
    { sides: 'both' },
    _fmDoStartSlider,
    function() { if (fmEls) fmEls._stopTest(); }
  );
}

function _fmDoStartSlider() {
  _fmSliderRoundEnsureRun();
  _fmSliderRoundLoadOrStartRound();
  fmSeqIdx  = 0;
  fmRunning = true;
  fmLoadElectrode();
  _fmStartTimer();
  _fmStartIdleSideCheck();
}

// BA 206: stellt sicher, dass sliderRoundRun für die aktuelle Kombination existiert.
function _fmSliderRoundEnsureRun() {
  if (!sideData[fmVarSide]) return;
  const fa = sideData[fmVarSide].freqmatchAdaptive
    || (sideData[fmVarSide].freqmatchAdaptive = { runs: [], currentRunIdx: null, sliderEstimates: {} });
  if (!fa.sliderEstimates) fa.sliderEstimates = {};
  let run = fa.sliderRoundRun;
  const elList = fmSeq.slice();
  if (!run || run.varSide !== fmVarSide || run.refSide !== fmRefSide
      || run.symmetric !== fmSymmetric) {
    run = {
      runId:              new Date().toISOString(),
      startedAt:          Date.now(),
      lastUpdate:         Date.now(),
      varSide:            fmVarSide,
      refSide:            fmRefSide,
      symmetric:          fmSymmetric,
      currentRound:       0,
      totalInRound:       0,
      remainingInRound:   [],
      completedInRound:   0,
      electrodeIdxList:   elList
    };
    fa.sliderRoundRun = run;
  } else {
    run.electrodeIdxList = elList;
    const set = new Set(elList);
    run.remainingInRound = run.remainingInRound.filter(function(i) { return set.has(i); });
  }
}

// BA 206: Falls die aktuelle Runde noch offene Elektroden hat, wird sie
// fortgesetzt (Pause/Resume); sonst beginnt eine neue Runde.
function _fmSliderRoundLoadOrStartRound() {
  const fa = sideData[fmVarSide].freqmatchAdaptive;
  const run = fa.sliderRoundRun;
  const fullList = run.electrodeIdxList.slice();
  if (!run.remainingInRound || run.remainingInRound.length === 0) {
    run.currentRound      = (run.currentRound || 0) + 1;
    run.totalInRound      = fullList.length;
    run.completedInRound  = 0;
    run.remainingInRound  = _fmShuffle(fullList);
  } else {
    if (run.currentRound < 1) run.currentRound = 1;
    if (!run.totalInRound) run.totalInRound = fullList.length;
  }
  fmSeq = run.remainingInRound.slice();
}

function _fmShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function fmLoadElectrode() {
  if (fmSeqIdx >= fmSeq.length) {
    const fa = sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive;
    if (fa && fa.sliderRoundRun) fa.sliderRoundRun.remainingInRound = [];
    _fmSliderRoundLoadOrStartRound();
    fmSeqIdx = 0;
    fmRenderSliderStatusGrid();
    fmUpdateSliderProgress();
  }
  fmCurrentEl = fmSeq[fmSeqIdx];
  fmCentOffset = fmPrevCent(fmCurrentEl);
  fmFirstSide = Math.random() < 0.5 ? "ref" : "var";
  fmShowElectrode();
  fmRenderSliderStatusGrid();
  setTimeout(() => { if (fmRunning) fmPlayCurrent(); }, 100);
}

function fmConfirm() {
  if (!fmRunning || fmCurrentEl === null) return;
  const varHz = fmVarHz(fmCurrentEl);
  const fa = sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive;
  if (!fa) return;
  if (!fa.sliderEstimates) fa.sliderEstimates = {};
  const run = fa.sliderRoundRun;
  const roundNo = (run && run.currentRound) || 1;
  const now = Date.now();
  const cent = Math.round(fmCentOffset);

  const key = String(fmCurrentEl);
  let entry = fa.sliderEstimates[key];
  if (!entry || typeof entry !== 'object') {
    entry = {
      cent:      cent,
      varSide:   fmVarSide,
      refSide:   fmSymmetric ? 'symmetric' : fmRefSide,
      varFreq:   varHz,
      timestamp: now,
      rounds:    []
    };
    fa.sliderEstimates[key] = entry;
  }
  if (!Array.isArray(entry.rounds)) entry.rounds = [];
  entry.rounds.push({ cent: cent, ts: now, round: roundNo });
  entry.varSide   = fmVarSide;
  entry.refSide   = fmSymmetric ? 'symmetric' : fmRefSide;
  entry.varFreq   = varHz;
  entry.timestamp = now;
  // BA 206: Aggregat ins .cent-Feld schreiben.
  const agg = _fmAggregateCent(entry.rounds);
  if (agg != null) entry.cent = Math.round(agg * 10) / 10;

  if (run) {
    const idx = run.remainingInRound.indexOf(fmCurrentEl);
    if (idx >= 0) run.remainingInRound.splice(idx, 1);
    run.completedInRound = (run.totalInRound || 0) - run.remainingInRound.length;
    run.lastUpdate = now;
  }

  if (typeof pApplyWarpModeDefaultFromFm === "function") {
    pApplyWarpModeDefaultFromFm();
  }

  fmSeqIdx++;
  fmLoadElectrode();
  if (typeof renderFreqMatchResults === 'function') {
    try { renderFreqMatchResults(); } catch (e) {}
  }
  if (typeof depLockApply === 'function') depLockApply();
}

// BA 206: Skip — nur Reihenfolge weiter, KEIN Wert speichern.
function fmSkip() {
  if (!fmRunning) return;
  const fa = sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive;
  if (fa && fa.sliderRoundRun) {
    const run = fa.sliderRoundRun;
    const idx = run.remainingInRound.indexOf(fmCurrentEl);
    if (idx >= 0) run.remainingInRound.splice(idx, 1);
    run.completedInRound = (run.totalInRound || 0) - run.remainingInRound.length;
  }
  fmSeqIdx++;
  fmLoadElectrode();
}

// BA 206: Pause — Lauf nicht abbrechen, nur stoppen.
function fmPauseSlider() {
  if (!fmRunning) return;
  if (fmEls && fmEls._stopTest) fmEls._stopTest();
}

// --- Fortschritt ---

function fmUpdateSliderProgress() {
  if (!fmEls) return;
  const _sprog = fmEls.verfahren && fmEls.verfahren.slider && fmEls.verfahren.slider.progress;
  if (!_sprog) return;
  const fa = sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive;
  const run = fa && fa.sliderRoundRun;
  const total = run ? (run.totalInRound || 0) : (fmSeq ? fmSeq.length : 0);
  const cur   = run ? Math.min((run.completedInRound || 0) + 1, total) : (fmSeqIdx + 1);
  const frac  = total > 0 ? Math.min(cur / total, 1) : 0;
  const roundNo = run ? (run.currentRound || 1) : 1;
  const lbl = (typeof t === 'function' && t('fmSliderRoundProgress')) || 'Runde %R · Elektrode %C von %T';
  const txt = lbl.replace('%R', roundNo).replace('%C', cur).replace('%T', total);
  testUI.progress.set(_sprog, { fraction: frac, text: txt });
}

function fmRenderSliderStatusGrid() {
  if (!fmEls) return;
  const grid = fmEls.verfahren && fmEls.verfahren.slider && fmEls.verfahren.slider.statusGrid;
  if (!grid) return;

  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive
                 && sideData[fmVarSide].freqmatchAdaptive.sliderEstimates) || {};
  const fa  = sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive;
  const run = fa && fa.sliderRoundRun;
  const fullList = (run && run.electrodeIdxList) || fmSeq || [];

  const head =
    '<tr>' +
      '<th>' + (t('fmSliderRoundColEl')       || 'Elektrode')          + '</th>' +
      '<th>' + (t('fmSliderRoundColStartHz')  || 'Startfreq (Hz)')      + '</th>' +
      '<th>' + (t('fmSliderRoundColCount')    || 'Anzahl Werte')        + '</th>' +
      '<th>' + (t('fmSliderRoundColRange')    || 'Bereich (Cent)')      + '</th>' +
      '<th>' + (t('fmSliderRoundColAgg')      || 'Aktuelle Schaetzung') + '</th>' +
      '<th>' + (t('fmSliderRoundColAggHz')    || 'Schaetzung (Hz)')     + '</th>' +
      '<th>' + (t('fmSliderRoundColStatus')   || 'Status')              + '</th>' +
    '</tr>';

  const rows = [head];
  fullList.forEach(function(el) {
    const startHz = fmVarHz(el);
    const isCur   = (fmCurrentEl === el && fmRunning && !fmAdaptiveActive);
    const entry   = store[String(el)];
    const rounds  = (entry && Array.isArray(entry.rounds)) ? entry.rounds : [];
    const count   = rounds.length;
    const range   = _fmRangeCent(rounds);
    const agg     = _fmAggregateCent(rounds);

    const rangeCell = (range && count >= 2)
      ? ((range.min >= 0 ? '+' : '') + Math.round(range.min) + ' ... ' + (range.max >= 0 ? '+' : '') + Math.round(range.max))
      : '-';
    const aggCell = (agg != null)
      ? ((agg >= 0 ? '+' : '') + (Math.round(agg * 10) / 10) + ' ct')
      : '-';
    const aggHzCell = (agg != null)
      ? (Math.round(fmFreqFromCents(startHz, agg)) + ' Hz')
      : '-';
    const statusCell = count > 0 ? ('ok (' + count + ')') : '-';

    rows.push(
      '<tr' + (isCur ? ' class="current-row"' : '') + '>' +
        '<td>E' + el + '</td>' +
        '<td>' + Math.round(startHz) + ' Hz</td>' +
        '<td>' + count + '</td>' +
        '<td>' + rangeCell + '</td>' +
        '<td>' + aggCell + '</td>' +
        '<td>' + aggHzCell + '</td>' +
        '<td>' + statusCell + '</td>' +
      '</tr>'
    );
  });

  grid.innerHTML = '<table class="fm-slider-status">' + rows.join('') + '</table>';
}

// --- Debug-Simulation ---

function fmRunSliderDebugSim() {
  if (!fmRunning) {
    fmStartSlider();
    setTimeout(fmRunSliderDebugSim, 100);
    return;
  }
  const fa = sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive;
  if (!fa) return;
  if (!fa.sliderEstimates) fa.sliderEstimates = {};
  const run = fa.sliderRoundRun;
  const roundNo = (run && run.currentRound) || 1;
  const now = Date.now();
  (fmSeq || []).forEach(function(el) {
    const key = String(el);
    let entry = fa.sliderEstimates[key];
    if (!entry) {
      entry = { cent: 0, varSide: fmVarSide, refSide: fmRefSide, varFreq: fmVarHz(el),
                timestamp: now, rounds: [] };
      fa.sliderEstimates[key] = entry;
    }
    const cent = Math.round(-200 + Math.random() * 700);
    entry.rounds.push({ cent: cent, ts: now, round: roundNo });
    const agg = _fmAggregateCent(entry.rounds);
    if (agg != null) entry.cent = Math.round(agg * 10) / 10;
    entry.varFreq = fmVarHz(el);
    entry.timestamp = now;
  });
  if (run) {
    run.completedInRound = run.totalInRound;
    run.remainingInRound = [];
    run.lastUpdate = now;
  }
  if (typeof pApplyWarpModeDefaultFromFm === "function") pApplyWarpModeDefaultFromFm();
  _fmSliderRoundLoadOrStartRound();
  fmSeqIdx = 0;
  fmLoadElectrode();
  if (typeof renderFreqMatchResults === 'function') {
    try { renderFreqMatchResults(); } catch (e) {}
  }
}
