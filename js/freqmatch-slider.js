// ============================================================
// freqmatch-slider.js — Frequenzabgleich: Verfahren "Slider Round"
// ============================================================
// BA 206: Mehrfach-Runden, zufällige Reihenfolge pro Runde, Pause/Resume.
// Abhängigkeit: freqmatch.js (shared State, Hilfsfunktionen, Persistenz).

// --- UI-Anzeige ---

function frq_updateSliderDisplay() {
  if (!FRQ_els || frq_currentEl === null) return;
  const slRefs = FRQ_els.verfahren && FRQ_els.verfahren.slider;
  const centStr = (frq_centOffset >= 0 ? "+" : "") + Math.round(frq_centOffset);
  const centUnit = (typeof t === 'function' && t("FRQ_centUnit")) || "Cent";
  if (frq_symmetric) {
    const leftBase  = withSide('left',  function() { return FRQ_implantatEffektiv(frq_currentEl); });
    const rightBase = withSide('right', function() { return FRQ_implantatEffektiv(frq_currentEl); });
    const playL = leftBase  * Math.pow(2, -frq_centOffset / 2 / 1200);
    const playR = rightBase * Math.pow(2, +frq_centOffset / 2 / 1200);
    if (slRefs && slRefs.slider) {
      testUI.slider.setValueDisplay(
        slRefs.slider,
        centStr + " " + centUnit
          + " (L: " + playL.toFixed(0) + " Hz / R: " + playR.toFixed(0) + " Hz)"
      );
    }
    return;
  }
  const varHz = frq_varHz(frq_currentEl);
  const refHz = frq_freqFromCents(varHz, frq_centOffset);
  const hzStr = refHz.toFixed(2);
  if (slRefs && slRefs.slider) {
    testUI.slider.setValueDisplay(
      slRefs.slider,
      centStr + " " + centUnit + " (" + hzStr + " Hz)"
    );
  }
  const refSideLabel = FRQ_refSide === "left" ? t("sideLeft") : t("sideRight");
  const refText = refSideLabel + ": " + hzStr + " Hz, " + centStr + " " + centUnit;
  const pi = _frq_sliderPairIndicator();
  if (pi) {
    if (FRQ_refSide === "left") {
      testUI.pairIndicator.setLabels(pi, { leftText: refText });
    } else {
      testUI.pairIndicator.setLabels(pi, { rightText: refText });
    }
  }
}

function frq_showElectrode() {
  if (!FRQ_els || frq_currentEl === null) return;
  const slRefs = FRQ_els.verfahren && FRQ_els.verfahren.slider;
  const pi = _frq_sliderPairIndicator();
  if (frq_symmetric) {
    const leftHz  = withSide('left',  function() { return FRQ_implantatEffektiv(frq_currentEl); });
    const rightHz = withSide('right', function() { return FRQ_implantatEffektiv(frq_currentEl); });
    if (pi) {
      const leftLabel  = withSide('left',  function() { return dENPrefix() + dEN(frq_currentEl); });
      const rightLabel = withSide('right', function() { return dENPrefix() + dEN(frq_currentEl); });
      testUI.pairIndicator.setLabels(pi, {
        leftText:  leftLabel  + ", " + leftHz.toFixed(2)  + " Hz (" + t("sideLeft")  + ")",
        rightText: rightLabel + ", " + rightHz.toFixed(2) + " Hz (" + t("sideRight") + ")"
      });
    }
  } else {
    const varHz = frq_varHz(frq_currentEl);
    const varSideLabel = frq_varSide === "left" ? t("sideLeft") : t("sideRight");
    const varText = withSide(frq_varSide, () => dENPrefix()) + frq_varSideElectrodeLabel(frq_currentEl) + ", " +
      varHz.toFixed(2) + " Hz (" + varSideLabel + ")";
    if (pi) {
      if (frq_varSide === "left") {
        testUI.pairIndicator.setLabels(pi, { leftText: varText });
      } else {
        testUI.pairIndicator.setLabels(pi, { rightText: varText });
      }
    }
  }
  if (slRefs && slRefs.slider) {
    // BA 221: Slider-Range so erweitern, dass Marker und Min/Max des
    // Range-Hints reinpassen. Sonst blendet setRangeHint sie aus.
    var _markerAbs = _frq_sliderMarkerMaxAbs(frq_currentEl);
    testUI.slider.setValue(slRefs.slider, frq_centOffset, { minAbs: _markerAbs });
  }
  frq_updateSliderDisplay();
  _FRQ_updateSliderRangeMarker();
  frq_updateSliderProgress();
  const undoBtn = _frq_sliderUndo();
  if (undoBtn) undoBtn.disabled = frq_sequenceIdx === 0;
}

// BA 362: Maximaler Absolutbetrag aus cent/min/max dieser Elektrode —
// fuer minAbs in testUI.slider.setValue.
// Liefert 0, wenn keine Daten oder keine endlichen Werte vorliegen.
function _frq_sliderMarkerMaxAbs(elIdx) {
  const store = (sideData[frq_varSide] && sideData[frq_varSide].freqmatchAdaptive)
    ? sideData[frq_varSide].freqmatchAdaptive.sliderEstimates : null;
  if (!store) return 0;
  const e = store[String(elIdx)];
  if (!e) return 0;
  let m = 0;
  if (typeof e.cent === 'number' && isFinite(e.cent)) m = Math.max(m, Math.abs(e.cent));
  if (typeof e.min === 'number' && isFinite(e.min))   m = Math.max(m, Math.abs(e.min));
  if (typeof e.max === 'number' && isFinite(e.max))   m = Math.max(m, Math.abs(e.max));
  return m;
}

// BA 362: Dreieck aus .cent, Band aus min/max (falls vorhanden).
// Daten werden an testUI.slider.setRangeHint uebergeben — dort steckt die DOM-Logik.
function _FRQ_updateSliderRangeMarker() {
  if (!FRQ_els || frq_currentEl === null) return;
  const slRefs = FRQ_els.verfahren && FRQ_els.verfahren.slider;
  if (!slRefs || !slRefs.slider) return;

  const store = (sideData[frq_varSide] && sideData[frq_varSide].freqmatchAdaptive)
    ? sideData[frq_varSide].freqmatchAdaptive.sliderEstimates : null;
  const e = store ? store[String(frq_currentEl)] : null;

  if (!e || typeof e.cent !== 'number' || !isFinite(e.cent)) {
    testUI.slider.setRangeHint(slRefs.slider, null);
    return;
  }
  const hasBand = (typeof e.min === 'number' && isFinite(e.min)
                && typeof e.max === 'number' && isFinite(e.max)
                && e.min !== e.max);
  const labelText = (e.cent >= 0 ? "+" : "") + (Math.round(e.cent * 10) / 10) + " ct";
  testUI.slider.setRangeHint(slRefs.slider, {
    marker: e.cent,
    label:  labelText,
    min:    hasBand ? e.min : null,
    max:    hasBand ? e.max : null
  });
}

// --- Testablauf ---

// Synchronisiert sliderPass mit der User-Auswahl.
// Wird nach Auswahl-Änderung aufgerufen, wenn der Slider-Modus aktiv ist.
function _frq_applySelectionToSliderRun() {
  if (!sideData[frq_varSide]) return;
  var fa = sideData[frq_varSide].freqmatchAdaptive;
  if (!fa || !fa.sliderPass) return;
  var pass = fa.sliderPass;
  var freshSeq = frq_symmetric ? frq_buildSequenceSymmetric() : frq_buildSequence();
  if (!Array.isArray(freshSeq)) freshSeq = [];

  // order und remaining auf aktuelle Auswahl (Frequenz-Reihenfolge) aktualisieren.
  pass.order = freshSeq.slice();
  var freshSet = new Set(freshSeq);
  pass.remaining = (pass.remaining || []).filter(function(i) { return freshSet.has(i); });
  if (pass.remaining.length === 0) pass.remaining = freshSeq.slice();

  // frq_sequence spiegeln und frq_sequenceIdx nachjustieren.
  frq_sequence = pass.remaining.slice();
  if (frq_currentEl != null && freshSet.has(frq_currentEl)) {
    var pos = frq_sequence.indexOf(frq_currentEl);
    frq_sequenceIdx = pos >= 0 ? pos : 0;
  } else {
    frq_sequenceIdx = 0;
  }
}

function frq_startSlider() {
  if (!FRQ_els) return;
  _frq_initSides();
  if (frq_symmetric) {
    frq_sequence = frq_buildSequenceSymmetric();
    if (frq_sequence === null) {
      alert((typeof t === 'function' && t('FRQ_symmetricElMismatch'))
        || 'Symmetrischer Modus: Beide Seiten müssen dieselben aktiven Elektroden haben.');
      FRQ_els._stopTest();
      return;
    }
    if (frq_sequence.length === 0) {
      alert((typeof t === 'function' && t('FRQ_noActiveEl')) || 'Keine aktiven Elektroden.');
      FRQ_els._stopTest();
      return;
    }
  } else {
    if ((sideData.left  && sideData.left.config)  === 'ci' &&
        (sideData.right && sideData.right.config) === 'ci' &&
        frq_buildSequenceSymmetric() === null) {
      alert((typeof t === 'function' && t('FRQ_elMismatch'))
        || 'Frequenzabgleich nicht moeglich: Auf beiden Seiten müssen dieselben Elektroden aktiv sein.');
      FRQ_els._stopTest();
      return;
    }
    frq_sequence = frq_buildSequence();
    if (frq_sequence.length === 0) {
      alert((typeof t === 'function' && t('FRQ_noActiveEl')) || 'Keine aktiven Elektroden auf der variablen Seite.');
      FRQ_els._stopTest();
      return;
    }
  }
  testUI.sideCheck.run(
    { sides: 'both' },
    _frq_doStartSlider,
    function() { if (FRQ_els) FRQ_els._stopTest(); }
  );
}

function _frq_doStartSlider() {
  _frq_sliderPassEnsure();
  frq_sequenceIdx  = 0;
  FRQ_running = true;
  frq_loadElectrode();
  _frq_startTimer();
  _frq_startIdleSideCheck();
}

function _frq_sliderPassEnsure() {
  if (!sideData[frq_varSide]) return;
  const fa = sideData[frq_varSide].freqmatchAdaptive
    || (sideData[frq_varSide].freqmatchAdaptive = { runs: [], currentRunIdx: null, sliderEstimates: {} });
  if (!fa.sliderEstimates) fa.sliderEstimates = {};

  // Feste Reihenfolge = die bestehende Frequenz-Reihenfolge von
  // frq_buildSequence()/frq_buildSequenceSymmetric() (tiefste Frequenz zuerst). KEIN
  // Shuffle, KEIN Umsortieren.
  const elList = (frq_symmetric ? frq_buildSequenceSymmetric() : frq_buildSequence()).slice();

  let pass = fa.sliderPass;
  // Neuer Durchgang, wenn keiner existiert oder die Seiten-Kombination wechselt.
  if (!pass || pass.varSide !== frq_varSide || pass.refSide !== FRQ_refSide
      || pass.symmetric !== frq_symmetric) {
    pass = {
      varSide:   frq_varSide,
      refSide:   FRQ_refSide,
      symmetric: frq_symmetric,
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

  // frq_sequence spiegelt die noch offenen Elektroden in fester Reihenfolge.
  frq_sequence = pass.remaining.slice();
  frq_sequenceIdx = 0;
}

function frq_loadElectrode() {
  if (frq_sequenceIdx >= frq_sequence.length) {
    _frq_sliderFinish();   // Durchgang fertig (Schritt 4)
    return;
  }
  frq_currentEl = frq_sequence[frq_sequenceIdx];
  frq_centOffset = frq_prevCent(frq_currentEl);   // Start auf gespeichertem Wert
  frq_firstSide = Math.random() < 0.5 ? "ref" : "var";
  frq_showElectrode();
  setTimeout(() => { if (FRQ_running) frq_playCurrent(); }, 100);
}

function _frq_sliderFinish() {
  // Durchgang leeren, damit der nächste Start frisch ab Elektrode 1 beginnt.
  const fa = sideData[frq_varSide] && sideData[frq_varSide].freqmatchAdaptive;
  if (fa && fa.sliderPass) fa.sliderPass.remaining = [];

  if (FRQ_els && FRQ_els._stopTest) FRQ_els._stopTest();

  if (typeof testUI !== 'undefined' && testUI.completion) {
    testUI.completion.show({
      nameKey:   'compNameFmSlider',
      subtabKey: 'subTabFreqMatch',
      bodyKey:   'FRQ_doneExtra'
    });
  }
}

function frq_confirm() {
  if (!FRQ_running || frq_currentEl === null) return;
  // BA353: Offset bestaetigt -> Schieber wird aktiv.
  if (typeof FRQ_setActiveMethod === "function") FRQ_setActiveMethod("slider");
  const varHz = frq_varHz(frq_currentEl);
  const fa = sideData[frq_varSide] && sideData[frq_varSide].freqmatchAdaptive;
  if (!fa) return;
  if (!fa.sliderEstimates) fa.sliderEstimates = {};
  const now = Date.now();
  const cent = Math.round(frq_centOffset);

  const key = String(frq_currentEl);
  let entry = fa.sliderEstimates[key];
  if (!entry || typeof entry !== 'object') {
    entry = {
      cent:      cent,
      varSide:   frq_varSide,
      refSide:   frq_symmetric ? 'symmetric' : FRQ_refSide,
      varFreq:   varHz,
      timestamp: now
      // KEIN rounds[]. min/max nur, falls aus Migration/Uebertragung vorhanden.
    };
    fa.sliderEstimates[key] = entry;
  } else {
    // Ueberschreiben: nur cent + Metadaten neu; min/max bleiben unangetastet.
    entry.cent = cent;
  }
  entry.varSide   = frq_varSide;
  entry.refSide   = frq_symmetric ? 'symmetric' : FRQ_refSide;
  entry.varFreq   = varHz;
  entry.timestamp = now;

  const pass = fa.sliderPass;
  if (pass) {
    const idx = pass.remaining.indexOf(frq_currentEl);
    if (idx >= 0) pass.remaining.splice(idx, 1);
  }

  if (typeof pApplyWarpModeDefaultFromFm === "function") {
    pApplyWarpModeDefaultFromFm();
  }

  frq_sequenceIdx++;
  frq_loadElectrode();
  if (typeof renderFreqMatchResults === 'function') {
    try { renderFreqMatchResults(); } catch (e) {}
  }
  if (typeof depLockApply === 'function') depLockApply();
}

// BA 206: Pause — Lauf nicht abbrechen, nur stoppen.
function frq_pauseSlider() {
  if (!FRQ_running) return;
  if (FRQ_els && FRQ_els._stopTest) FRQ_els._stopTest();
}

// --- Fortschritt ---

function frq_updateSliderProgress() {
  if (!FRQ_els) return;
  const _sprog = FRQ_els.verfahren && FRQ_els.verfahren.slider && FRQ_els.verfahren.slider.progress;
  if (!_sprog) return;
  const fa = sideData[frq_varSide] && sideData[frq_varSide].freqmatchAdaptive;
  const pass = fa && fa.sliderPass;
  const total = pass ? (pass.order ? pass.order.length : 0) : (frq_sequence ? frq_sequence.length : 0);
  const done  = pass ? (total - (pass.remaining ? pass.remaining.length : 0)) : frq_sequenceIdx;
  const cur   = Math.min(done + 1, total);
  const frac  = total > 0 ? Math.min(cur / total, 1) : 0;
  const lbl = (typeof t === 'function' && t('FRQ_sliderProgress')) || 'Elektrode %C von %T';
  const txt = lbl.replace('%C', cur).replace('%T', total);
  testUI.progress.set(_sprog, { fraction: frac, text: txt });
}


