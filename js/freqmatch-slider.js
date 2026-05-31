// ============================================================
// freqmatch-slider.js — Frequenzabgleich: Slider-Verfahren
// ============================================================
// Abhängigkeit: freqmatch.js (shared State, Hilfsfunktionen, Persistenz)

// --- UI-Anzeige ---

function fmUpdateSliderDisplay() {
  if (!fmEls || fmCurrentEl === null) return;
  const slRefs = fmEls.verfahren && fmEls.verfahren.slider;
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const centStr = (fmCentOffset >= 0 ? "+" : "") + Math.round(fmCentOffset);
  const hzStr = refHz.toFixed(2);
  const centUnit = (typeof t === 'function' && t("fmCentUnit")) || "Cent";
  if (slRefs && slRefs.sliderValue) {
    slRefs.sliderValue.textContent = centStr + " " + centUnit + " (" + hzStr + " Hz)";
  }
  const refSideLabel = fmRefSide === "left" ? t("sideLeft") : t("sideRight");
  const refText = refSideLabel + ": " + hzStr + " Hz, " + centStr + " " + centUnit;
  const pi = _fmSliderPI();
  if (pi) {
    if (fmRefSide === "left") pi.left.textContent = refText;
    else                      pi.right.textContent = refText;
  }
}

function fmShowElectrode() {
  if (!fmEls || fmCurrentEl === null) return;
  const slRefs = fmEls.verfahren && fmEls.verfahren.slider;
  const varHz = fmVarHz(fmCurrentEl);
  const varSideLabel = fmVarSide === "left" ? t("sideLeft") : t("sideRight");
  const varText = withSide(fmVarSide, () => dENPrefix()) + fmDEN(fmCurrentEl) + ", " +
    varHz.toFixed(2) + " Hz (" + varSideLabel + ")";
  const pi = _fmSliderPI();
  if (pi) {
    if (fmVarSide === "left") pi.left.textContent = varText;
    else                      pi.right.textContent = varText;
  }
  if (slRefs && slRefs.slider) {
    testUI.slider.setValue(slRefs.slider, fmCentOffset);
  }
  fmUpdateSliderDisplay();
  if (slRefs && slRefs.progress) {
    const pText = slRefs.progress.text;
    const pFill = slRefs.progress.fill;
    if (pText) {
      const tn = pText.firstChild;
      if (tn && tn.nodeType === 3) tn.textContent = ((fmSeqIdx + 1) + " / " + fmSeq.length) + ' ';
    }
    if (pFill) pFill.style.width = (fmSeq.length > 0 ? (fmSeqIdx / fmSeq.length * 100) : 0) + "%";
  }
  const undoBtn = _fmSliderUndo();
  if (undoBtn) undoBtn.disabled = fmSeqIdx === 0;
}

// --- Testablauf ---

function fmStartSlider() {
  if (!fmEls) return;
  _fmInitSides();
  fmSeq = fmBuildSeq();
  if (fmSeq.length === 0) {
    alert((typeof t === 'function' && t('fmNoActiveEl')) || 'Keine aktiven Elektroden auf der variablen Seite.');
    fmEls._stopTest();
    return;
  }
  testUI.sideCheck.run(
    { sides: 'both' },
    _fmDoStartSlider,
    function() { if (fmEls) fmEls._stopTest(); }
  );
}

function _fmDoStartSlider() {
  fmSeqIdx  = 0;
  fmRunning = true;
  fmLoadElectrode();
  _fmStartTimer();
  testUI.sideCheck.startIdleWatch(_fmParentEl, 5 * 60 * 1000, function() {
    if (fmEls) fmEls._stopTest();
  });
}

function fmLoadElectrode() {
  if (fmSeqIdx >= fmSeq.length) {
    fmFinish();
    return;
  }
  fmCurrentEl = fmSeq[fmSeqIdx];
  fmCentOffset = fmPrevCent(fmCurrentEl);
  fmFirstSide = Math.random() < 0.5 ? "ref" : "var";
  fmShowElectrode();
  fmUpdateSliderProgress();
  fmRenderSliderStatusGrid();
  setTimeout(() => { if (fmRunning) fmPlayCurrent(); }, 100);
}

function fmConfirm() {
  if (!fmRunning || fmCurrentEl === null) return;
  const varHz = fmVarHz(fmCurrentEl);
  const store = _fmEnsureSliderStore(fmVarSide);
  if (store) {
    store[String(fmCurrentEl)] = {
      cent:    Math.round(fmCentOffset),
      varSide: fmVarSide,
      refSide: fmRefSide,
      varFreq: varHz,
      timestamp: Date.now(),
    };
  }
  fmSeqIdx++;
  fmRenderSliderStatusGrid();
  fmUpdateSliderProgress();
  fmLoadElectrode();
  if (typeof renderFreqMatchResults === 'function') {
    try { renderFreqMatchResults(); } catch (e) {}
  }
}

function fmSkip() {
  if (!fmRunning) return;
  fmSeqIdx++;
  fmLoadElectrode();
}

// --- Fortschritt ---

function fmUpdateSliderProgress() {
  if (!fmEls) return;
  const _sprog = fmEls.verfahren && fmEls.verfahren.slider && fmEls.verfahren.slider.progress;
  if (!_sprog) return;
  const total = fmSeq ? fmSeq.length : 0;
  const cur   = fmSeqIdx + 1;
  const frac  = total > 0 ? Math.min(cur / total, 1) : 0;
  testUI.progress.set(_sprog, {
    fraction: frac,
    text:     'Elektrode ' + cur + ' von ' + total
  });
}

function fmRenderSliderStatusGrid() {
  if (!fmEls) return;
  const grid = fmEls.verfahren && fmEls.verfahren.slider && fmEls.verfahren.slider.statusGrid;
  if (!grid) return;

  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive
                 && sideData[fmVarSide].freqmatchAdaptive.sliderEstimates) || {};

  const rows = [];
  rows.push(
    '<tr>' +
      '<th>Elektrode</th>' +
      '<th>Startwert (Hz)</th>' +
      '<th>Differenz (cent)</th>' +
      '<th>Differenz (Hz)</th>' +
      '<th>Schätzung mit Slider (Hz)</th>' +
      '<th>Status</th>' +
    '</tr>'
  );

  (fmSeq || []).forEach(function(el) {
    const startHz = fmVarHz(el);
    const isCur   = (fmCurrentEl === el && fmRunning && !fmAdaptiveActive);
    const saved   = store[String(el)];

    let curCentCell  = '—';
    let curDiffCell  = '—';
    let estimateCell = '—';
    let statusCell   = '✗';

    if (isCur) {
      const cents = Math.round(fmCentOffset);
      curCentCell = (cents >= 0 ? '+' : '') + cents + ' cent';
      const diffHz = Math.round(startHz * (Math.pow(2, cents / 1200) - 1));
      curDiffCell = (diffHz >= 0 ? '+' : '') + diffHz + ' Hz';
    }
    if (saved) {
      const finalHz = Math.round(fmFreqFromCents(startHz, saved.cent));
      estimateCell  = finalHz + ' Hz';
      statusCell    = '✓';
    }

    rows.push(
      '<tr' + (isCur ? ' class="current-row"' : '') + '>' +
        '<td>E' + el + '</td>' +
        '<td>' + Math.round(startHz) + ' Hz</td>' +
        '<td>' + curCentCell + '</td>' +
        '<td>' + curDiffCell + '</td>' +
        '<td>' + estimateCell + '</td>' +
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
  const store = _fmEnsureSliderStore(fmVarSide);
  if (!store) return;
  fmSeq.forEach(function(el) {
    store[String(el)] = {
      cent:      Math.round(-200 + Math.random() * 700),   // [-200, +500]
      varSide:   fmVarSide,
      refSide:   fmRefSide,
      varFreq:   fmVarHz(el),
      timestamp: Date.now()
    };
  });
  fmSeqIdx = fmSeq.length;
  fmLoadElectrode();
  if (typeof renderFreqMatchResults === 'function') {
    try { renderFreqMatchResults(); } catch (e) {}
  }
}
