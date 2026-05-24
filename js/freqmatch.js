// ============================================================
// FREQUENZABGLEICH – FREQUENCY MATCHING TEST
// ============================================================

// --- State ---
let fmRunning = false;
let fmEls = null;
let fmRefSide = "left";
let fmVarSide = "right";
let fmSeq = [];
let fmSeqIdx = 0;
let fmCurrentEl = null;
let fmCentOffset = 0;
const FM_SLIDER_RANGES = [100, 500, 1200];
let fmSlRangeIdx = 0;
let fmFirstSide = "ref";
let fmIsPlay = false;
let fmPlayTO = null;

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

// --- Testablauf ---
function fmStart() {
  if (!fmEls) return;
  fmRefSide = fmEls.refSelect.value;
  fmVarSide = fmRefSide === "left" ? "right" : "left";
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

function fmUndo() {
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
  }
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
  }
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
      rowMode:     { show: false },
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
      confidence:        { show: true }
    }
  };

  fmEls = buildTestPanel(parentEl, fmCfg);

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

  // Event: Referenzohr-Wechsel (§6.10)
  let _fmPrevRefVal = fmEls.refSelect.value;
  fmEls.refSelect.addEventListener('change', function() {
    if (fRes.length > 0) {
      fmRCOkBtn.onclick = function() {
        fmRCDlg.hidden = true;
        fRes.splice(0, fRes.length);
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

  // Texte initial setzen
  fmApplyLang();
});
