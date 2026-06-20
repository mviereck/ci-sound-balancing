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

// Synchronisiert sliderPass mit der User-Auswahl.
// Wird nach Auswahl-Änderung aufgerufen, wenn der Slider-Modus aktiv ist.
function _fmApplySelectionToSliderRun() {
  if (!sideData[fmVarSide]) return;
  var fa = sideData[fmVarSide].freqmatchAdaptive;
  if (!fa || !fa.sliderPass) return;
  var pass = fa.sliderPass;
  var freshSeq = fmSymmetric ? fmBuildSeqSymmetric() : fmBuildSeq();
  if (!Array.isArray(freshSeq)) freshSeq = [];

  // order und remaining auf aktuelle Auswahl (Frequenz-Reihenfolge) aktualisieren.
  pass.order = freshSeq.slice();
  var freshSet = new Set(freshSeq);
  pass.remaining = (pass.remaining || []).filter(function(i) { return freshSet.has(i); });
  if (pass.remaining.length === 0) pass.remaining = freshSeq.slice();

  // fmSeq spiegeln und fmSeqIdx nachjustieren.
  fmSeq = pass.remaining.slice();
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
  _fmSliderPassEnsure();
  fmSeqIdx  = 0;
  fmRunning = true;
  fmLoadElectrode();
  _fmStartTimer();
  _fmStartIdleSideCheck();
}

function _fmSliderPassEnsure() {
  if (!sideData[fmVarSide]) return;
  const fa = sideData[fmVarSide].freqmatchAdaptive
    || (sideData[fmVarSide].freqmatchAdaptive = { runs: [], currentRunIdx: null, sliderEstimates: {} });
  if (!fa.sliderEstimates) fa.sliderEstimates = {};

  // Feste Reihenfolge = die bestehende Frequenz-Reihenfolge von
  // fmBuildSeq()/fmBuildSeqSymmetric() (tiefste Frequenz zuerst). KEIN
  // Shuffle, KEIN Umsortieren.
  const elList = (fmSymmetric ? fmBuildSeqSymmetric() : fmBuildSeq()).slice();

  let pass = fa.sliderPass;
  // Neuer Durchgang, wenn keiner existiert oder die Seiten-Kombination wechselt.
  if (!pass || pass.varSide !== fmVarSide || pass.refSide !== fmRefSide
      || pass.symmetric !== fmSymmetric) {
    pass = {
      varSide:   fmVarSide,
      refSide:   fmRefSide,
      symmetric: fmSymmetric,
      order:     elList.slice(),
      remaining: elList.slice()
    };
    fa.sliderPass = pass;
  } else {
    // Fortsetzen: order auf aktuelle Auswahl aktualisieren, remaining auf
    // Schnittmenge mit der aktuellen Auswahl filtern.
    pass.order = elList.slice();
    const set = new Set(elList);
    pass.remaining = pass.remaining.filter(function(i) { return set.has(i); });
    // Falls remaining leer (voriger Durchgang fertig): neuen Durchgang starten.
    if (pass.remaining.length === 0) pass.remaining = elList.slice();
  }

  // fmSeq spiegelt die noch offenen Elektroden in fester Reihenfolge.
  fmSeq = pass.remaining.slice();
  fmSeqIdx = 0;
}

function fmLoadElectrode() {
  if (fmSeqIdx >= fmSeq.length) {
    _fmSliderFinish();   // Durchgang fertig (Schritt 4)
    return;
  }
  fmCurrentEl = fmSeq[fmSeqIdx];
  fmCentOffset = fmPrevCent(fmCurrentEl);   // Start auf gespeichertem Wert
  fmFirstSide = Math.random() < 0.5 ? "ref" : "var";
  fmShowElectrode();
  setTimeout(() => { if (fmRunning) fmPlayCurrent(); }, 100);
}

function _fmSliderFinish() {
  // Durchgang leeren, damit der nächste Start frisch ab Elektrode 1 beginnt.
  const fa = sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive;
  if (fa && fa.sliderPass) fa.sliderPass.remaining = [];

  if (fmEls && fmEls._stopTest) fmEls._stopTest();

  if (typeof testUI !== 'undefined' && testUI.completion) {
    testUI.completion.show({
      nameKey:   'compNameFmSlider',
      subtabKey: 'subTabFreqMatch',
      bodyKey:   'fmDoneExtra'
    });
  }
}

function fmConfirm() {
  if (!fmRunning || fmCurrentEl === null) return;
  // BA353: Offset bestaetigt -> Schieber wird aktiv.
  if (typeof fmSetActiveMethod === "function") fmSetActiveMethod("slider");
  const varHz = fmVarHz(fmCurrentEl);
  const fa = sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive;
  if (!fa) return;
  if (!fa.sliderEstimates) fa.sliderEstimates = {};
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
  entry.rounds.push({ cent: cent, ts: now });
  entry.varSide   = fmVarSide;
  entry.refSide   = fmSymmetric ? 'symmetric' : fmRefSide;
  entry.varFreq   = varHz;
  entry.timestamp = now;
  const agg = _fmAggregateCent(entry.rounds);
  if (agg != null) entry.cent = Math.round(agg * 10) / 10;

  const pass = fa.sliderPass;
  if (pass) {
    const idx = pass.remaining.indexOf(fmCurrentEl);
    if (idx >= 0) pass.remaining.splice(idx, 1);
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
  const pass = fa && fa.sliderPass;
  const total = pass ? pass.order.length : (fmSeq ? fmSeq.length : 0);
  const done  = pass ? (pass.order.length - pass.remaining.length) : fmSeqIdx;
  const cur   = Math.min(done + 1, total);
  const frac  = total > 0 ? Math.min(cur / total, 1) : 0;
  const lbl = (typeof t === 'function' && t('fmSliderRoundProgress')) || 'Runde %R · Elektrode %C von %T';
  const txt = lbl.replace('%R', 1).replace('%C', cur).replace('%T', total);
  testUI.progress.set(_sprog, { fraction: frac, text: txt });
}


