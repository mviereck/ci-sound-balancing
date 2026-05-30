// ============================================================
// TEST-UI — einheitlicher Builder für die drei Test-Reiter
// ============================================================
// Kein IIFE, kein Modul-System. Alles globaler Scope.

// Aktuell laufende Test-Instanz
let _activeTestId = null;

// ---- Hilfsfunktion: Element erzeugen ----
function _mkEl(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

// ---- Globale Dropdowns synchronisieren ----
function _syncGlobalDropdowns(type, val) {
  document.querySelectorAll('[data-global="' + type + '"]').forEach(function(sel) {
    if (sel.value !== val) sel.value = val;
  });
}

// Nach loadJson: alle globalen Dropdowns auf aktuellen State setzen
function syncAllGlobalDropdowns() {
  _syncGlobalDropdowns('sequence', globalSequence);
  _syncGlobalDropdowns('toneType', globalToneType);
}

// ---- Tab-Sperre ----
function lockTestTabs(active, activeTestId) {
  if (active) _activeTestId = activeTestId;
  else _activeTestId = null;

  // Alle Top-Level-Tabs außer messungen sperren
  document.querySelectorAll('.tab:not([data-tab="messungen"])').forEach(function(tab) {
    tab.disabled = active;
    tab.setAttribute('aria-disabled', active ? 'true' : 'false');
  });
  // Alle Sub-Tabs in messungen außer dem aktiven sperren
  document.querySelectorAll('.subtab[data-parent="messungen"]').forEach(function(sub) {
    var isActive = sub.dataset.subtab === activeTestId;
    sub.disabled = active && !isActive;
  });
  // Seiten-Buttons sperren
  var sL = document.getElementById('sideLeftBtn');
  var sR = document.getElementById('sideRightBtn');
  if (sL) sL.disabled = active;
  if (sR) sR.disabled = active;
}

// ---- Bestätigungs-Dialog für Elektroden-Ausschluss ----
function setTestExclConfirm(exclOverlay, electrodeLabel, onConfirm) {
  var ok = exclOverlay.querySelector('[data-action="excl-confirm"]');
  var cancel = exclOverlay.querySelector('[data-action="excl-cancel"]');
  // Einmalige Listener durch Klonen
  var newOk = ok.cloneNode(true);
  var newCancel = cancel.cloneNode(true);
  ok.parentNode.replaceChild(newOk, ok);
  cancel.parentNode.replaceChild(newCancel, cancel);
  newOk.addEventListener('click', function() {
    exclOverlay.hidden = true;
    onConfirm();
  });
  newCancel.addEventListener('click', function() {
    exclOverlay.hidden = true;
  });
  exclOverlay.hidden = false;
}

// ===== ALTE API (unverändert) =====

function _buildTestPanelOld(parentEl, cfg) {
  parentEl.innerHTML = '';
  var id = cfg.id;

  // -------- BLOCK 1: Erklärungen --------
  var explainBox = _mkEl('div', 'card explain-box');
  var h2 = _mkEl('h2');
  h2.dataset.t = cfg.explain.titleKey;
  explainBox.appendChild(h2);
  (cfg.explain.paragraphs || []).forEach(function(p) {
    var cls;
    if (p.kind === 'plain') cls = 'explain-plain';
    else cls = 'explain' + (p.kind === 'warn' ? ' explain-warn' : '');
    var el = _mkEl('p', cls);
    el.dataset.t = p.key;
    explainBox.appendChild(el);
  });

  // -------- BLOCK 2: Voreinstellungen --------
  var presetsBox = _mkEl('div', 'card presets-box');

  // Zeile 1: Modus / Run
  var modeSelect = null, runSelect = null;
  if (cfg.presets.rowMode && cfg.presets.rowMode.show) {
    var rm = cfg.presets.rowMode;
    var rowMode = _mkEl('div', 'controls-row');
    rowMode.dataset.row = 'mode';
    var cgMode = _mkEl('div', 'control-group');
    var lblMode = _mkEl('label'); lblMode.dataset.t = rm.modeKey;
    modeSelect = _mkEl('select');
    (rm.modeOptions || []).forEach(function(pair) {
      var opt = new Option('', pair[0]);
      opt.dataset.t = pair[1];
      modeSelect.appendChild(opt);
    });
    if (rm.hideModeControl) cgMode.style.display = 'none';
    cgMode.append(lblMode, modeSelect);
    rowMode.appendChild(cgMode);
    if (rm.runOptions && rm.runOptions.length) {
      var cgRun = _mkEl('div', 'control-group');
      var lblRun = _mkEl('label'); lblRun.dataset.t = rm.runKey;
      runSelect = _mkEl('select');
      rm.runOptions.forEach(function(pair) {
        var opt = new Option('', pair[0]);
        opt.dataset.t = pair[1];
        runSelect.appendChild(opt);
      });
      cgRun.append(lblRun, runSelect);
      rowMode.appendChild(cgRun);
    }
    presetsBox.appendChild(rowMode);
  }

  // runExplain box (für Test 1 updateRunExplain-Kompatibilität)
  var runExplainBox = null;
  if (runSelect) {
    runExplainBox = _mkEl('div', 'info-box');
    runExplainBox.id = 'runExplain';
    presetsBox.appendChild(runExplainBox);
  }

  // Zeile 2: refSelect (preCorrect entfernt — Bauanleitung 61)
  var refSelect = null;
  if (cfg.presets.rowFine && cfg.presets.rowFine.show) {
    var rf = cfg.presets.rowFine;
    var rowFine = _mkEl('div', 'controls-row');
    rowFine.dataset.row = 'fine';
    if (rf.refSelect) {
      var cgRef = _mkEl('div', 'control-group');
      var lblRef = _mkEl('label'); lblRef.dataset.t = rf.refSelect.key;
      refSelect = _mkEl('select');
      if (rf.refSelect.type === 'electrode') refSelect.id = 'refEl';
      if (rf.refSelect.type === 'side') {
        ['left', 'right'].forEach(function(s) {
          var opt = new Option('', s);
          opt.dataset.t = s === 'left' ? 'sideLeft' : 'sideRight';
          refSelect.appendChild(opt);
        });
      }
      // type === 'electrode': wird nach buildTestPanel durch aufrufendes Modul befüllt
      if (rf.refSelect && rf.refSelect.hidden) cgRef.style.display = 'none';
      cgRef.append(lblRef, refSelect);
      rowFine.appendChild(cgRef);
    }
    if (rowFine.children.length) presetsBox.appendChild(rowFine);
  }

  // Zeile 3: Lautstärke / Dauer / Pause
  var volInput = null, durInput = null, pauseInput = null;
  if (cfg.presets.rowVolume && cfg.presets.rowVolume.show) {
    var rowVolume = _mkEl('div', 'controls-row');
    rowVolume.dataset.row = 'volume';
    var makeNumInput = function(idSuffix, val, min, max, step, w) {
      var inp = _mkEl('input');
      inp.type = 'number';
      inp.id = idSuffix + '_' + id;
      inp.value = val; inp.min = min; inp.max = max; inp.step = step;
      inp.style.cssText = 'width:' + w + 'px;padding:3px 5px;border:1px solid var(--border);border-radius:4px;text-align:center;font-family:var(--mono);font-size:0.88em';
      return inp;
    };
    var cgVol = _mkEl('div', 'control-group');
    var lblVol = _mkEl('label'); lblVol.dataset.t = 'lblVol';
    volInput = makeNumInput('vol', 50, 0, 100, 1, 55);
    cgVol.append(lblVol, volInput, document.createTextNode('%'));
    var cgDur = _mkEl('div', 'control-group');
    var lblDur = _mkEl('label'); lblDur.dataset.t = 'lblDur';
    durInput = makeNumInput('dur', 1000, 100, 3000, 50, 65);
    cgDur.append(lblDur, durInput, document.createTextNode(' ms'));
    var cgPau = _mkEl('div', 'control-group');
    var lblPau = _mkEl('label'); lblPau.dataset.t = 'lblPau';
    pauseInput = makeNumInput('pau', 500, 50, 2000, 50, 65);
    cgPau.append(lblPau, pauseInput, document.createTextNode(' ms'));
    rowVolume.append(cgVol, cgDur, cgPau);
    presetsBox.appendChild(rowVolume);
  }

  // Zeile 4: Tonfolge / Tonart / Target
  var seqSelect = null, toneSelect = null, targetSelect = null;
  if (cfg.presets.rowSequence) {
    var rs = cfg.presets.rowSequence;
    var rowSequence = _mkEl('div', 'controls-row');
    rowSequence.dataset.row = 'sequence';

    if (rs.sequence && rs.sequence.show) {
      var cg = _mkEl('div', 'control-group');
      var lbl2 = _mkEl('label'); lbl2.dataset.t = 'sequenceLbl';
      seqSelect = _mkEl('select');
      seqSelect.dataset.global = 'sequence';
      [['aba','ABA'],['ab','AB']].forEach(function(pair) {
        seqSelect.appendChild(new Option(pair[1], pair[0]));
      });
      seqSelect.value = globalSequence;
      cg.append(lbl2, seqSelect);
      rowSequence.appendChild(cg);
    }

    if (rs.toneType && rs.toneType.show) {
      var cg2 = _mkEl('div', 'control-group');
      var lbl3 = _mkEl('label'); lbl3.dataset.t = 'toneTypeLbl';
      toneSelect = _mkEl('select');
      toneSelect.dataset.global = 'toneType';
      [
        ['sine','toneSine'],['complex','toneComplex'],
        ['pulsedComplex','tonePulsedComplex'],['noise','toneNoise'],
        ['noiseAdaptive','toneNoiseAdaptive'],['amSine','toneAmSine'],
        ['warbleSine','toneWarbleSine'],['burstSine','toneBurstSine'],
        ['wobbleSweep','toneWobbleSweep']
      ].forEach(function(pair) {
        var opt = new Option('', pair[0]);
        opt.dataset.t = pair[1];
        toneSelect.appendChild(opt);
      });
      toneSelect.value = globalToneType;
      cg2.append(lbl3, toneSelect);
      rowSequence.appendChild(cg2);
    }

    if (rs.target && rs.target.show) {
      var cg3 = _mkEl('div', 'control-group');
      var lbl4 = _mkEl('label'); lbl4.dataset.t = 'targetLbl';
      targetSelect = _mkEl('select');
      var curTarget = (id === 'test') ? slTarget_test : (id === 'balance') ? slTarget_balance : null;
      var keyMap = {
        'a': 'targetA', 'b': 'targetB', 'balance': 'targetBalance',
        'left': 'targetLeft', 'right': 'targetRight', 'both': 'targetBoth'
      };
      (rs.target.options || []).forEach(function(key) {
        var opt = new Option('', key);
        opt.dataset.t = keyMap[key] || key;
        targetSelect.appendChild(opt);
      });
      if (curTarget) targetSelect.value = curTarget;
      cg3.append(lbl4, targetSelect);
      rowSequence.appendChild(cg3);
    }

    if (rowSequence.children.length) presetsBox.appendChild(rowSequence);
  }

  // manualSel (für Test 1 manual-Modus)
  var manualSel = null, manA = null, manB = null, manPlayBtn = null;
  if (cfg.presets.rowMode && cfg.presets.rowMode.show &&
      (cfg.presets.rowMode.runOptions || []).some(function(p) { return p[0] === 'manual'; })) {
    manualSel = _mkEl('div', 'hidden');
    manualSel.style.marginTop = '8px';
    var cgMan = _mkEl('div', 'control-group');
    var lblA = _mkEl('label'); lblA.textContent = 'A:';
    manA = _mkEl('select'); manA.id = 'manA';
    var lblB2 = _mkEl('label'); lblB2.textContent = 'B:'; lblB2.style.marginLeft = '10px';
    manB = _mkEl('select'); manB.id = 'manB';
    manPlayBtn = _mkEl('button', 'btn');
    manPlayBtn.style.marginLeft = '10px';
    manPlayBtn.textContent = '▶';
    cgMan.append(lblA, manA, lblB2, manB, manPlayBtn);
    manualSel.appendChild(cgMan);
    presetsBox.appendChild(manualSel);
  }

  // Zeile 5: Start/Stop
  var startStopRow = _mkEl('div', 'btn-group');
  startStopRow.dataset.row = 'startstop';
  var startBtn = _mkEl('button', 'btn btn-primary btn-large');
  startBtn.dataset.action = 'start';
  startBtn.dataset.t = cfg.presets.startStop.startKey;
  var stopBtn = _mkEl('button', 'btn btn-large');
  stopBtn.dataset.action = 'stop';
  stopBtn.dataset.t = 'btnStopTest';
  stopBtn.disabled = true;
  startStopRow.append(startBtn, stopBtn);

  var lockedHint = _mkEl('div', 'info-box tab-locked-hint');
  lockedHint.hidden = true;
  lockedHint.dataset.t = cfg.presets.startStop.resumable ? 'testTabLockedHint' : 'testTabLockedHintNoResume';

  presetsBox.append(startStopRow, lockedHint);

  // -------- BLOCK 3: Aktiver Test --------
  var testBox = _mkEl('div', 'card test-box');
  testBox.hidden = true;
  testBox.style.textAlign = 'center';

  // Untertitel
  var subTitle = _mkEl('h3', 'test-subtitle');
  if (cfg.test.subTitleKey) subTitle.dataset.t = cfg.test.subTitleKey;
  testBox.appendChild(subTitle);
  if (cfg.test.subHintKey) {
    var subHint = _mkEl('p', 'test-hint');
    subHint.dataset.t = cfg.test.subHintKey;
    testBox.appendChild(subHint);
  }

  // Fortschrittsbalken
  var progressFill = null, progressText = null, timerDisplay = null;
  if (cfg.test.progressBar) {
    var pb = _mkEl('div', 'progress-bar');
    progressFill = _mkEl('div', 'progress-fill');
    pb.appendChild(progressFill);
    progressText = _mkEl('div', 'progress-text');
    var timerEl = _mkEl('span', 'timer-display');
    timerEl.textContent = '0:00';
    timerDisplay = timerEl;
    progressText.appendChild(timerEl);
    testBox.append(pb, progressText);
  }

  // Swap-Button
  var swapBtn = null;
  if (cfg.test.swapButton && cfg.test.swapButton.show) {
    var swapRow = _mkEl('div', 'swap-row');
    swapBtn = _mkEl('button', 'btn btn-sm');
    swapBtn.dataset.action = 'swap';
    swapBtn.dataset.t = cfg.test.swapButton.labelKey;
    swapRow.appendChild(swapBtn);
    testBox.appendChild(swapRow);
  }

  // Status-Grid (Bauanleitung 02b/1, für adaptiven Frequenzabgleich)
  // Befüllung zur Laufzeit durch freqmatch.js (Bauanleitung 02b/4)
  var statusGrid = null;
  if (cfg.test.statusGrid && cfg.test.statusGrid.show) {
    statusGrid = _mkEl('div', 'fm-status-grid');
    statusGrid.hidden = true;
    testBox.appendChild(statusGrid);
  }

  // Paar-Anzeige
  var pairIndicator = _mkEl('div', 'pair-indicator');
  var pairLeft = _mkEl('span', 'tone-label-left');
  var vsSpan = _mkEl('span', 'vs'); vsSpan.textContent = 'vs.';
  var pairRight = _mkEl('span', 'tone-label-right');
  pairIndicator.append(pairLeft, vsSpan, pairRight);
  var pairFreq = _mkEl('div', 'pair-freq');
  testBox.append(pairIndicator, pairFreq);

  // Ausschluss-Buttons
  var excludeLeftBtn = null, excludeRightBtn = null;
  if (cfg.test.excludeButtons && cfg.test.excludeButtons.show) {
    var excRow = _mkEl('div', 'exclude-row');
    excludeLeftBtn = _mkEl('button', 'btn btn-danger');
    excludeLeftBtn.dataset.action = 'exclude-left';
    excludeLeftBtn.dataset.t = 'btnExcludeA';
    excludeRightBtn = _mkEl('button', 'btn btn-danger');
    excludeRightBtn.dataset.action = 'exclude-right';
    excludeRightBtn.dataset.t = 'btnExcludeB';
    excRow.append(excludeLeftBtn, excludeRightBtn);
    testBox.appendChild(excRow);
  }

  // Aktions-Buttons
  var actionRow = _mkEl('div', 'action-row');
  var undoBtn = null, replayBtn = null, simulBtn = null;
  (cfg.test.actions || []).forEach(function(act) {
    var btn = _mkEl('button', 'btn btn-large');
    btn.dataset.action = act;
    if (act === 'undo') {
      undoBtn = btn;
      btn.disabled = true;
      btn.innerHTML = '&#9664; <span data-t="bBack"></span> <span class="kbd">Z</span>';
    } else if (act === 'replay') {
      replayBtn = btn;
      btn.innerHTML = '&#9654; <span data-t="bReplay"></span> <span class="kbd" data-t="kSpace"></span>';
    } else if (act === 'simul') {
      simulBtn = btn;
      btn.innerHTML = '&#x2016; <span data-t="bSimul"></span> <span class="kbd">B</span>';
    }
    actionRow.appendChild(btn);
  });
  testBox.appendChild(actionRow);

  // Optionaler Instruktionstext über den Entscheidungsbuttons (cfg.test.instructionKey)
  var instructionEl = null;
  if (cfg.test.instructionKey) {
    instructionEl = _mkEl('p', 'test-instruction');
    instructionEl.dataset.t = cfg.test.instructionKey;
    testBox.appendChild(instructionEl);
  }

  // Height-Judgment-Buttons (Bauanleitung 02b/1, für adaptiven Frequenzabgleich)
  var hjContainer = null, hjHigher = null, hjLower = null;
  if (cfg.test.heightJudgment && cfg.test.heightJudgment.show) {
    hjContainer = _mkEl('div', 'hj-buttons');
    hjContainer.hidden = true;
    hjHigher = _mkEl('button', 'btn btn-large hj-up');
    hjHigher.dataset.action = 'hj-up';
    hjHigher.innerHTML =
      '&uarr; <span data-t="bHigher"></span> ' +
      '<span class="kbd">&uarr;</span>';
    hjLower = _mkEl('button', 'btn btn-large hj-down');
    hjLower.dataset.action = 'hj-down';
    hjLower.innerHTML =
      '&darr; <span data-t="bLower"></span> ' +
      '<span class="kbd">&darr;</span>';
    hjContainer.append(hjHigher, hjLower);
    testBox.appendChild(hjContainer);
  }

  // Judgment-Buttons (nur wenn modeOptions judgment enthält)
  var jdgContainer = null, jdgA = null, jdgEq = null, jdgB = null;
  if (cfg.presets.rowMode && cfg.presets.rowMode.show &&
      (cfg.presets.rowMode.modeOptions || []).some(function(p) { return p[0] === 'judgment'; })) {
    jdgContainer = _mkEl('div', 'judgment-buttons');
    jdgContainer.style.display = 'none';
    jdgA = _mkEl('button', 'btn btn-large');
    jdgA.innerHTML = 'A <span data-t="bLoud"></span> <span class="kbd">1</span>';
    jdgEq = _mkEl('button', 'btn btn-large');
    jdgEq.innerHTML = '<span data-t="bEqual"></span> <span class="kbd">2</span>';
    jdgB = _mkEl('button', 'btn btn-large');
    jdgB.innerHTML = 'B <span data-t="bLoud2"></span> <span class="kbd">3</span>';
    jdgContainer.append(jdgA, jdgEq, jdgB);
    testBox.appendChild(jdgContainer);
  }

  // Pfeiltasten-Hinweis
  var keyHintBox = null;
  if (cfg.test.keyHintBox && cfg.test.keyHintBox.show) {
    keyHintBox = _mkEl('div', 'info-box key-hint');
    var strong = _mkEl('strong'); strong.dataset.t = 'sliderControl';
    var kLeft = _mkEl('span', 'kbd'); kLeft.innerHTML = '&larr;';
    var kRight = _mkEl('span', 'kbd'); kRight.innerHTML = '&rarr;';
    var isCent = cfg.test.keyHintBox.unitKey === 'sliderHintCent';
    var stepSpan = _mkEl('span'); stepSpan.dataset.t = isCent ? 'sliderHintCent' : 'sliderStep';
    var midDot = document.createTextNode(' · ');
    var holdSpan = _mkEl('span'); holdSpan.dataset.t = 'sliderHold';
    var kShift = _mkEl('span', 'kbd'); kShift.textContent = 'Shift';
    var fineSpan = _mkEl('span'); fineSpan.dataset.t = isCent ? 'sliderHintCentFine' : 'sliderStepFine';
    keyHintBox.append(
      strong, document.createTextNode(' '),
      kLeft, document.createTextNode(' '), kRight, document.createTextNode(' '),
      stepSpan, midDot, holdSpan, document.createTextNode(' '), kShift, document.createTextNode(' '), fineSpan
    );
    testBox.appendChild(keyHintBox);
  }

  // Slider
  var sliderWrap = _mkEl('div', 'slider-wrap');
  var slider = _mkEl('input');
  slider.type = 'range';
  slider.className = 'big-slider';
  var slRange = cfg.test.slider.ranges[0];
  slider.min = -slRange; slider.max = slRange;
  slider.step = cfg.test.slider.unit === 'cent' ? '1' : '0.1';
  slider.value = '0';
  var extendBtn = _mkEl('button', 'btn btn-sm extend-btn');
  extendBtn.hidden = true;
  extendBtn.dataset.t = 'bExtend';
  sliderWrap.append(slider, extendBtn);
  testBox.appendChild(sliderWrap);

  // LS-Hint: Dreieck-Marke + Bandbereich für die LS-Schätzung (Bauanleitung 61)
  // Hängt in sliderWrap; CSS-order bringt es optisch zwischen Slider und Touch-Buttons.
  var lsHint = _mkEl('div', 'ls-hint');
  lsHint.style.display = 'none';
  var lsHintBand = _mkEl('div', 'ls-hint-band');
  var lsHintMark = _mkEl('div', 'ls-hint-mark');
  var lsHintLabel = _mkEl('div', 'ls-hint-label');
  lsHint.append(lsHintBand, lsHintMark, lsHintLabel);
  sliderWrap.appendChild(lsHint);

  // Slider-Wert-Anzeige
  var sliderValue = null;
  if (cfg.test.sliderValue) {
    sliderValue = _mkEl('div', 'slider-value-large');
    sliderValue.textContent = cfg.test.slider.unit === 'cent' ? '0 Cent' : '0.0 dB';
    testBox.appendChild(sliderValue);
  }

  // Kumulativer Offset
  var cumulativeDisplay = null;
  if (cfg.test.cumulativeDisplay && cfg.test.cumulativeDisplay.show) {
    cumulativeDisplay = _mkEl('div', 'cumulative-small');
    testBox.appendChild(cumulativeDisplay);
  }

  // Bestätigen-Button
  var confirmBtn = null;
  if (cfg.test.confirmButton && cfg.test.confirmButton.show) {
    confirmBtn = _mkEl('button', 'btn btn-primary btn-large');
    confirmBtn.dataset.action = 'confirm';
    confirmBtn.dataset.t = cfg.test.confirmButton.key;
    testBox.appendChild(confirmBtn);
  }

  // Confidence-Radios
  var confRadios = {};
  if (cfg.test.confidence && cfg.test.confidence.show) {
    var qualLabel = _mkEl('p', 'conf-quality-label');
    qualLabel.dataset.t = 'confQualityLabel';
    testBox.appendChild(qualLabel);
    var confRow = _mkEl('div', 'confidence-row');
    [
      ['none', 'confidenceLabelNone'],
      ['sure', 'confidenceLabelSure'],
      ['medium', 'confidenceLabelMedium'],
      ['unsure', 'confidenceLabelUnsure'],
      ['invalid', 'confidenceLabelInvalid']
    ].forEach(function(pair) {
      var val = pair[0], key = pair[1];
      var lbl = _mkEl('label');
      var radio = _mkEl('input');
      radio.type = 'radio';
      radio.name = 'conf-' + id;
      radio.value = val;
      if (val === 'none') radio.checked = true;
      var sp = _mkEl('span'); sp.dataset.t = key;
      lbl.append(radio, document.createTextNode(' '), sp);
      confRow.appendChild(lbl);
      confRadios[val] = radio;
    });
    var confNote = _mkEl('p', 'muted small');
    confNote.dataset.t = 'confidenceNotStored';
    confRow.appendChild(confNote);
    testBox.appendChild(confRow);
  }

  // -------- Ausschluss-Modal --------
  var exclOverlay = _mkEl('div', 'modal-overlay exclude-confirm-overlay');
  exclOverlay.hidden = true;
  var exclCard = _mkEl('div', 'card');
  var exclTitle = _mkEl('h3'); exclTitle.dataset.t = 'excludeConfirmTitle';
  var exclBody = _mkEl('p'); exclBody.dataset.t = 'excludeConfirmBody';
  var exclNote = _mkEl('p', 'muted small'); exclNote.dataset.t = 'excludeConfirmNote';
  var exclBtnGroup = _mkEl('div', 'btn-group');
  var exclConfirmBtn = _mkEl('button', 'btn btn-danger');
  exclConfirmBtn.dataset.action = 'excl-confirm';
  exclConfirmBtn.dataset.t = 'excludeConfirmOk';
  var exclCancelBtn = _mkEl('button', 'btn');
  exclCancelBtn.dataset.action = 'excl-cancel';
  exclCancelBtn.dataset.t = 'excludeConfirmCancel';
  exclBtnGroup.append(exclConfirmBtn, exclCancelBtn);
  exclCard.append(exclTitle, exclBody, exclNote, exclBtnGroup);
  exclOverlay.appendChild(exclCard);

  // -------- Alles zusammenbauen --------
  parentEl.append(explainBox, presetsBox, testBox, exclOverlay);

  // applyLang auf alle neuen Elemente anwenden
  parentEl.querySelectorAll('[data-t]').forEach(function(el) {
    var key = el.dataset.t;
    if (key && typeof t === 'function') {
      var val = t(key);
      if (val) el.textContent = val;
    }
  });
  // data-t-Elemente mit Kinder-Spans (action-row) nicht überschreiben
  actionRow.querySelectorAll('[data-t]').forEach(function(el) {
    var key = el.dataset.t;
    if (key && typeof t === 'function') {
      var val = t(key);
      if (val) el.textContent = val;
    }
  });

  // Globale Dropdowns: Event-Listener und Synchronisation
  if (seqSelect) {
    seqSelect.addEventListener('change', function() {
      globalSequence = seqSelect.value;
      _syncGlobalDropdowns('sequence', seqSelect.value);
    });
  }
  if (toneSelect) {
    toneSelect.addEventListener('change', function() {
      globalToneType = toneSelect.value;
      _syncGlobalDropdowns('toneType', toneSelect.value);
      playTone(1000, gVol(), 750);
    });
  }
  if (targetSelect) {
    targetSelect.addEventListener('change', function() {
      if (id === 'test') slTarget_test = targetSelect.value;
      if (id === 'balance') slTarget_balance = targetSelect.value;
    });
  }

  // Fokus-Blur nach Klick auf Button/Select/Checkbox/Radio im test-box
  testBox.addEventListener('click', function(e) {
    var t2 = e.target.closest('button, select, input[type=checkbox], input[type=radio]');
    if (!t2) return;
    if (t2.matches('input[type=range]')) return;
    t2.blur();
  });

  applyMobileReadonly(parentEl);

  return {
    id: id,
    explainBox: explainBox, presetsBox: presetsBox, testBox: testBox, exclOverlay: exclOverlay,
    // presets
    modeSelect: modeSelect, runSelect: runSelect, refSelect: refSelect,
    volInput: volInput, durInput: durInput, pauseInput: pauseInput,
    seqSelect: seqSelect, toneSelect: toneSelect, targetSelect: targetSelect,
    startBtn: startBtn, stopBtn: stopBtn, lockedHint: lockedHint,
    manualSel: manualSel, manA: manA, manB: manB, manPlayBtn: manPlayBtn,
    runExplainBox: runExplainBox,
    // test
    subTitle: subTitle, progressFill: progressFill, progressText: progressText, timerDisplay: timerDisplay,
    swapBtn: swapBtn,
    pairLeft: pairLeft, pairRight: pairRight, pairFreq: pairFreq,
    excludeLeftBtn: excludeLeftBtn, excludeRightBtn: excludeRightBtn,
    undoBtn: undoBtn, replayBtn: replayBtn, simulBtn: simulBtn,
    jdgContainer: jdgContainer, jdgA: jdgA, jdgEq: jdgEq, jdgB: jdgB,
    keyHintBox: keyHintBox, slider: slider, extendBtn: extendBtn,
    sliderValue: sliderValue, cumulativeDisplay: cumulativeDisplay,
    lsHint: lsHint, lsHintBand: lsHintBand, lsHintMark: lsHintMark, lsHintLabel: lsHintLabel,
    confirmBtn: confirmBtn, confRadios: confRadios,
    // Adaptiver Frequenzabgleich (Bauanleitung 02b/1)
    instructionEl: instructionEl,
    hjContainer: hjContainer, hjHigher: hjHigher, hjLower: hjLower,
    statusGrid: statusGrid,
    // excl modal
    exclConfirmBtn: exclConfirmBtn, exclCancelBtn: exclCancelBtn,
  };
}

// ===== NEUE API =====

// ---- Helfer: i18n-Text auf ein Element setzen ----
function _tEl(el, key) {
  el.dataset.t = key;
  if (key && typeof t === 'function') {
    var val = t(key);
    if (val) el.textContent = val;
  }
}

// ---- Helfer: Alle data-t-Elemente innerhalb root übersetzen,
//      ohne Elemente mit Kinder-Elementen zu überschreiben ----
function _applyLangSubtree(root) {
  root.querySelectorAll('[data-t]').forEach(function(el) {
    // Nicht überschreiben wenn Kinder-Elemente vorhanden (HTML-Inhalt)
    if (el.children.length > 0) return;
    var key = el.dataset.t;
    if (key && typeof t === 'function') {
      var val = t(key);
      if (val) {
        if (el.dataset.bgHtml === '1') el.innerHTML = val;
        else el.textContent = val;
      }
    }
  });
}

// ---- Neue Implementation ----
function _maybeExtendSlider(slRef) {
  if (!slRef || !slRef.initialRange) return;
  var val = parseFloat(slRef.input.value) || 0;
  var curMax = parseFloat(slRef.input.max);
  if (Math.abs(val) < curMax) return;
  if (curMax >= slRef.maxRange) return;
  var newMax = Math.min(curMax + slRef.initialRange, slRef.maxRange);
  slRef.rangeIdx++;
  slRef.input.min = String(-newMax);
  slRef.input.max = String(newMax);
  slRef.input.style.setProperty('--sl-range-step', slRef.rangeIdx);
}

function _buildTestPanelNew(parentEl, cfg) {
  parentEl.innerHTML = '';
  var id = cfg.id;

  // Keyboard-Listener handle (pro Instanz)
  var _keyListener = null;
  // Ob ein Test gerade läuft
  var _testRunning = false;
  // Aktives Verfahren (id-String)
  var _activeVerfahren = cfg.verfahren[0] ? cfg.verfahren[0].id : null;
  // Refs-Objekte der Verfahren: { id: {...refs} }
  var _verfahrenRefs = {};

  // ===== BLOCK 1: Erklärungen =====
  var explainBox = _mkEl('div', 'card explain-box');
  var h2 = _mkEl('h2');
  _tEl(h2, cfg.explain.titleKey);
  explainBox.appendChild(h2);
  (cfg.explain.paragraphs || []).forEach(function(p) {
    var cls;
    if (p.kind === 'plain') cls = 'explain-plain';
    else cls = 'explain' + (p.kind === 'warn' ? ' explain-warn' : '');
    var el = _mkEl('p', cls);
    _tEl(el, p.key);
    explainBox.appendChild(el);
  });

  // ===== BLOCK 2: Header (Voreinstellungen) =====
  var headerBox = _mkEl('div', 'card presets-box');
  var headerRefs = {};

  // --- Verfahren-Dropdown (nur wenn > 1 Verfahren) ---
  var verfahrenSelect = null;
  if (cfg.verfahren.length > 1) {
    var rowVerf = _mkEl('div', 'controls-row');
    rowVerf.dataset.row = 'verfahren';
    var cgVerf = _mkEl('div', 'control-group');
    var lblVerf = _mkEl('label');
    _tEl(lblVerf, 'lblVerfahren');
    verfahrenSelect = _mkEl('select');
    verfahrenSelect.id = 'verfahrenSelect_' + id;
    cfg.verfahren.forEach(function(v) {
      var opt = new Option('', v.id);
      _tEl(opt, v.labelKey);
      verfahrenSelect.appendChild(opt);
    });
    verfahrenSelect.value = _activeVerfahren;
    cgVerf.append(lblVerf, verfahrenSelect);
    rowVerf.appendChild(cgVerf);
    headerBox.appendChild(rowVerf);
    headerRefs.verfahrenSelect = verfahrenSelect;

    // --- verfahren-explain Info-Box (nur wenn > 1 Verfahren) ---
    var verfahrenExplainBox = _mkEl('div', 'info-box verfahren-explain');
    var verfahrenExplainSpan = _mkEl('span');
    verfahrenExplainBox.appendChild(verfahrenExplainSpan);
    headerBox.appendChild(verfahrenExplainBox);
    headerRefs.verfahrenExplainBox = verfahrenExplainBox;
    headerRefs.verfahrenExplainSpan = verfahrenExplainSpan;
    var _firstExplainKey = cfg.verfahren[0] && cfg.verfahren[0].explainKey;
    if (_firstExplainKey) _tEl(verfahrenExplainSpan, _firstExplainKey);
  }

  // --- common: refSelect ---
  var refSelect = null;
  var hc = cfg.header.common || {};

  if (hc.refSelect) {
    var rowFine = _mkEl('div', 'controls-row');
    rowFine.dataset.row = 'fine';
    var cgRef = _mkEl('div', 'control-group');
    var lblRef = _mkEl('label');
    _tEl(lblRef, hc.refSelect.key || 'lblRef');
    refSelect = _mkEl('select');
    refSelect.id = 'refEl_' + id;
    if (hc.refSelect.type === 'electrode') {
      refSelect.id = 'refEl';
      // Optionen werden nach Build durch aufrufendes Modul befüllt
    } else if (hc.refSelect.type === 'side') {
      ['left', 'right'].forEach(function(s) {
        var opt = new Option('', s);
        _tEl(opt, s === 'left' ? 'sideLeft' : 'sideRight');
        refSelect.appendChild(opt);
      });
    }
    if (hc.refSelect.disabled) refSelect.disabled = true;
    cgRef.append(lblRef, refSelect);
    if (hc.refSelect.hidden) cgRef.style.display = 'none';
    rowFine.appendChild(cgRef);
    if (rowFine.children.length) headerBox.appendChild(rowFine);
    headerRefs.refSelect = refSelect;
  }

  // --- common: volume / duration / pause ---
  var volInput = null, durInput = null, pauseInput = null;
  var showVol = hc.volume && (hc.volume === true || hc.volume.show !== false);
  var showDur = hc.duration && (hc.duration === true || hc.duration.show !== false);
  var showPau = hc.pause && (hc.pause === true || hc.pause.show !== false);
  if (showVol || showDur || showPau) {
    var rowVolume = _mkEl('div', 'controls-row');
    rowVolume.dataset.row = 'volume';
    var makeNumInput2 = function(idSuffix, val, min, max, step, w) {
      var inp = _mkEl('input');
      inp.type = 'number';
      inp.id = idSuffix + '_' + id;
      inp.value = val; inp.min = min; inp.max = max; inp.step = step;
      inp.style.cssText = 'width:' + w + 'px;padding:3px 5px;border:1px solid var(--border);border-radius:4px;text-align:center;font-family:var(--mono);font-size:0.88em';
      return inp;
    };
    if (showVol) {
      var cgVol = _mkEl('div', 'control-group');
      var lblVol = _mkEl('label'); _tEl(lblVol, 'lblVol');
      volInput = makeNumInput2('vol', 50, 0, 100, 1, 55);
      cgVol.append(lblVol, volInput, document.createTextNode('%'));
      rowVolume.appendChild(cgVol);
    }
    if (showDur) {
      var dOpts = (typeof hc.duration === 'object') ? hc.duration : {};
      var cgDur = _mkEl('div', 'control-group');
      var lblDur = _mkEl('label'); _tEl(lblDur, 'lblDur');
      durInput = makeNumInput2('dur',
        dOpts.default || 1000, dOpts.min || 100, dOpts.max || 3000, dOpts.step || 50, 65);
      cgDur.append(lblDur, durInput, document.createTextNode(' ms'));
      rowVolume.appendChild(cgDur);
    }
    if (showPau) {
      var pOpts = (typeof hc.pause === 'object') ? hc.pause : {};
      var cgPau = _mkEl('div', 'control-group');
      var lblPau = _mkEl('label'); _tEl(lblPau, 'lblPau');
      pauseInput = makeNumInput2('pau',
        pOpts.default || 500, pOpts.min || 50, pOpts.max || 2000, pOpts.step || 50, 65);
      cgPau.append(lblPau, pauseInput, document.createTextNode(' ms'));
      rowVolume.appendChild(cgPau);
    }
    if (rowVolume.children.length) headerBox.appendChild(rowVolume);
    headerRefs.volInput = volInput;
    headerRefs.durInput = durInput;
    headerRefs.pauseInput = pauseInput;
  }

  // --- common: toneType / sequence / sliderTarget ---
  var seqSelect = null, toneSelect = null, targetSelect = null;
  var showSeq = hc.sequence && (hc.sequence === true || hc.sequence.show !== false);
  var showTone = hc.toneType && (hc.toneType === true || hc.toneType.show !== false);
  var showTarget = hc.sliderTarget && (hc.sliderTarget !== false);
  if (showSeq || showTone || showTarget) {
    var rowSequence = _mkEl('div', 'controls-row');
    rowSequence.dataset.row = 'sequence';

    if (showSeq) {
      var cg = _mkEl('div', 'control-group');
      var lbl2 = _mkEl('label'); _tEl(lbl2, 'sequenceLbl');
      seqSelect = _mkEl('select');
      seqSelect.dataset.global = 'sequence';
      [['aba','ABA'],['ab','AB']].forEach(function(pair) {
        seqSelect.appendChild(new Option(pair[1], pair[0]));
      });
      seqSelect.value = globalSequence;
      cg.append(lbl2, seqSelect);
      rowSequence.appendChild(cg);
    }

    if (showTone) {
      var cg2 = _mkEl('div', 'control-group');
      var lbl3 = _mkEl('label'); _tEl(lbl3, 'toneTypeLbl');
      toneSelect = _mkEl('select');
      toneSelect.dataset.global = 'toneType';
      [
        ['sine','toneSine'],['complex','toneComplex'],
        ['pulsedComplex','tonePulsedComplex'],['noise','toneNoise'],
        ['noiseAdaptive','toneNoiseAdaptive'],['amSine','toneAmSine'],
        ['warbleSine','toneWarbleSine'],['burstSine','toneBurstSine'],
        ['wobbleSweep','toneWobbleSweep']
      ].forEach(function(pair) {
        var opt = new Option('', pair[0]);
        _tEl(opt, pair[1]);
        toneSelect.appendChild(opt);
      });
      toneSelect.value = globalToneType;
      cg2.append(lbl3, toneSelect);
      rowSequence.appendChild(cg2);
    }

    if (showTarget) {
      var tOpts = (typeof hc.sliderTarget === 'object') ? hc.sliderTarget : {};
      var cg3 = _mkEl('div', 'control-group');
      var lbl4 = _mkEl('label'); _tEl(lbl4, 'targetLbl');
      targetSelect = _mkEl('select');
      var curTarget = (id === 'test') ? slTarget_test : (id === 'balance') ? slTarget_balance : null;
      var keyMap = {
        'a': 'targetA', 'b': 'targetB', 'balance': 'targetBalance',
        'left': 'targetLeft', 'right': 'targetRight', 'both': 'targetBoth',
        'ref': 'targetRef', 'var': 'targetVar'
      };
      (tOpts.options || ['a','b','balance']).forEach(function(key) {
        var opt = new Option('', key);
        _tEl(opt, keyMap[key] || key);
        targetSelect.appendChild(opt);
      });
      if (tOpts.default && targetSelect.querySelector('option[value="' + tOpts.default + '"]')) {
        targetSelect.value = tOpts.default;
      } else if (curTarget) {
        targetSelect.value = curTarget;
      }
      if (tOpts.disabled) {
        targetSelect.disabled = true;
        cg3.dataset.staticDisabled = 'true';
      }
      cg3.append(lbl4, targetSelect);
      // Optionaler statischer Hinweis (hintKey)
      if (tOpts.hintKey) {
        var hintSpan = _mkEl('span', 'muted small');
        _tEl(hintSpan, tOpts.hintKey);
        cg3.appendChild(hintSpan);
      }
      rowSequence.appendChild(cg3);
    }

    if (rowSequence.children.length) headerBox.appendChild(rowSequence);
    headerRefs.seqSelect = seqSelect;
    headerRefs.toneSelect = toneSelect;
    headerRefs.targetSelect = targetSelect;
  }

  // --- extra.fragment ---
  if (cfg.header.extra && cfg.header.extra.fragment) {
    headerBox.appendChild(cfg.header.extra.fragment);
    headerRefs.extraFragment = cfg.header.extra.fragment;
  }

  // --- startStop ---
  var startStopRow = _mkEl('div', 'btn-group');
  startStopRow.dataset.row = 'startstop';
  var startBtn = _mkEl('button', 'btn btn-primary btn-large');
  startBtn.dataset.action = 'start';
  _tEl(startBtn, cfg.header.startStop.startKey || 'btnStartTest');
  var stopBtn = _mkEl('button', 'btn btn-large');
  stopBtn.dataset.action = 'stop';
  _tEl(stopBtn, 'btnStopTest');
  stopBtn.disabled = true;
  startStopRow.append(startBtn, stopBtn);

  var lockedHint = _mkEl('div', 'info-box tab-locked-hint');
  lockedHint.hidden = true;
  _tEl(lockedHint, cfg.header.startStop.resumable ? 'testTabLockedHint' : 'testTabLockedHintNoResume');

  headerBox.append(startStopRow, lockedHint);
  headerRefs.startBtn = startBtn;
  headerRefs.stopBtn = stopBtn;
  headerRefs.lockedHint = lockedHint;

  // Auto-Blur: alle Selects im Header geben Fokus nach change ab,
  // damit Pfeiltasten/Leertaste sofort wieder die Testaktionen auslösen.
  headerBox.addEventListener('change', function(e) {
    if (e.target.tagName === 'SELECT') e.target.blur();
  }, true);

  // ===== BLOCK 3: Test-Box (enthält Verfahren-Bodies) =====
  var testBox = _mkEl('div', 'card test-box');
  testBox.hidden = true;
  testBox.style.textAlign = 'center';

  // Fokus-Blur nach Button-Klick im testBox
  testBox.addEventListener('click', function(e) {
    var t2 = e.target.closest('button, select, input[type=checkbox], input[type=radio]');
    if (!t2) return;
    if (t2.matches('input[type=range]')) return;
    t2.blur();
  });

  // ===== Verfahren-Bodies =====
  cfg.verfahren.forEach(function(vCfg) {
    var vId = vCfg.id;
    var body = vCfg.body || {};
    var refs = { _vId: vId };
    var vWrap = _mkEl('div', 'verfahren-body');
    vWrap.dataset.verfahren = vId;
    // Sichtbarkeit: nur erstes Verfahren sichtbar
    vWrap.hidden = (vId !== _activeVerfahren);

    // --- runningTitle (testUI-intern, nicht über cfg konfigurierbar) ---
    var rtEl = _mkEl('h3', 'test-running-title');
    rtEl.hidden = true;
    var rtSpanTitle = _mkEl('span'); _tEl(rtSpanTitle, cfg.explain.titleKey);
    var rtSpanTest = _mkEl('span'); _tEl(rtSpanTest, 'testRunningTitleWord_test');
    rtEl.appendChild(rtSpanTitle);
    rtEl.appendChild(document.createTextNode('-'));
    rtEl.appendChild(rtSpanTest);
    rtEl.appendChild(document.createTextNode(' '));
    if (cfg.verfahren.length > 1 && vCfg.labelKey) {
      rtEl.appendChild(document.createTextNode("'"));
      var rtSpanLabel = _mkEl('span', 'rt-label'); _tEl(rtSpanLabel, vCfg.labelKey);
      rtEl.appendChild(rtSpanLabel);
      rtEl.appendChild(document.createTextNode("' "));
    }
    var rtSpanRun = _mkEl('span'); _tEl(rtSpanRun, 'testRunningTitleWord_running');
    rtEl.appendChild(rtSpanRun);
    vWrap.appendChild(rtEl);
    refs.runningTitle = rtEl;

    // --- progress ---
    if (body.progress) {
      var pbWrap = _mkEl('div', 'progress-bar');
      var pbFill = _mkEl('div', 'progress-fill');
      pbWrap.appendChild(pbFill);
      var pbText = _mkEl('div', 'progress-text');
      var pbTimer = _mkEl('span', 'timer-display');
      pbTimer.textContent = '0:00';
      pbText.appendChild(pbTimer);
      vWrap.append(pbWrap, pbText);
      refs.progress = { fill: pbFill, text: pbText, timer: pbTimer };
    }

    // --- pairIndicator ---
    if (body.pairIndicator) {
      var piCfg = body.pairIndicator;
      var piWrap = _mkEl('div', 'pair-indicator');
      var piLeft = _mkEl('span', 'tone-label-left');
      var piVs = _mkEl('span', 'vs'); piVs.textContent = 'vs.';
      var piRight = _mkEl('span', 'tone-label-right');
      piWrap.append(piLeft, piVs, piRight);

      // Hz-Zeile: nur für electrode und side
      var piFreq = null;
      if (piCfg.variant === 'electrode' || piCfg.variant === 'side') {
        piFreq = _mkEl('div', 'pair-freq');
      }

      // Initiale Labels je nach variant
      if (piCfg.variant === 'token') {
        if (piCfg.leftKey) _tEl(piLeft, piCfg.leftKey);
        if (piCfg.rightKey) _tEl(piRight, piCfg.rightKey);
      } else if (piCfg.variant === 'electrode') {
        piLeft.textContent = 'A';
        piRight.textContent = 'B';
      } else if (piCfg.variant === 'side') {
        _tEl(piLeft, 'sideLeft');
        _tEl(piRight, 'sideRight');
      }

      vWrap.appendChild(piWrap);
      if (piFreq) vWrap.appendChild(piFreq);

      refs.pairIndicator = {
        wrap: piWrap,
        left: piLeft,
        right: piRight,
        freq: piFreq,
        variant: piCfg.variant,
        // Buttons die gesperrt werden sollen (Replay-Sperre) — wird nach Bau der anderen Elemente befüllt
        _lockTargets: []
      };
    }

    // --- instruction ---
    if (body.instruction) {
      var instrEl = _mkEl('p', 'test-instruction');
      _tEl(instrEl, body.instruction.key);
      vWrap.appendChild(instrEl);
      refs.instruction = instrEl;
    }

    // --- decisionButtons ---
    if (body.decisionButtons) {
      var dbWrap = _mkEl('div', 'hj-buttons');
      dbWrap.hidden = false;
      var dbUp = _mkEl('button', 'btn btn-large hj-up');
      dbUp.dataset.action = 'decision-up';
      dbUp.innerHTML = '&uarr; <span data-t="bHigher"></span> <span class="kbd">&uarr;</span>';
      var dbDown = _mkEl('button', 'btn btn-large hj-down');
      dbDown.dataset.action = 'decision-down';
      dbDown.innerHTML = '&darr; <span data-t="bLower"></span> <span class="kbd">&darr;</span>';
      dbWrap.append(dbUp, dbDown);
      vWrap.appendChild(dbWrap);
      refs.decisionButtons = { wrap: dbWrap, up: dbUp, down: dbDown };
      // Verdrahten mit Hook
      if (vCfg.hooks && vCfg.hooks.onDecision) {
        dbUp.addEventListener('click', function() { vCfg.hooks.onDecision('up'); });
        dbDown.addEventListener('click', function() { vCfg.hooks.onDecision('down'); });
      }
    }

    // --- keyHint ---
    if (body.keyHint) {
      var khBox = _mkEl('div', 'info-box key-hint');
      var khStrong = _mkEl('strong'); _tEl(khStrong, 'sliderControl');
      var khLeft = _mkEl('span', 'kbd'); khLeft.innerHTML = '&larr;';
      var khRight = _mkEl('span', 'kbd'); khRight.innerHTML = '&rarr;';
      var isCent = body.keyHint.unitKey === 'sliderHintCent';
      var khStep = _mkEl('span'); _tEl(khStep, isCent ? 'sliderHintCent' : 'sliderStep');
      var khDot = document.createTextNode(' · ');
      var khHold = _mkEl('span'); _tEl(khHold, 'sliderHold');
      var khShift = _mkEl('span', 'kbd'); khShift.textContent = 'Shift';
      var khFine = _mkEl('span'); _tEl(khFine, isCent ? 'sliderHintCentFine' : 'sliderStepFine');
      khBox.append(
        khStrong, document.createTextNode(' '),
        khLeft, document.createTextNode(' '), khRight, document.createTextNode(' '),
        khStep, khDot, khHold, document.createTextNode(' '), khShift, document.createTextNode(' '), khFine
      );
      vWrap.appendChild(khBox);
      refs.keyHint = khBox;
    }

    // --- slider ---
    if (body.slider) {
      var slCfg = body.slider;
      var slUnit = slCfg.unit || 'dB';
      var slInitialRange = slCfg.initialRange || (slCfg.ranges && slCfg.ranges[0]) || 20;
      var slMaxRange = slCfg.maxRange || (slCfg.ranges && slCfg.ranges[slCfg.ranges.length - 1]) || slInitialRange;
      var slWrap = _mkEl('div', 'slider-wrap');
      var slInput = _mkEl('input');
      slInput.type = 'range';
      slInput.className = 'big-slider';
      slInput.min = -slInitialRange; slInput.max = slInitialRange;
      // Schrittweite: cent → 1, ms → 1, dB → 0.1
      slInput.step = (slUnit === 'cent' || slUnit === 'ms') ? '1' : '0.1';
      slInput.value = '0';
      slInput.style.setProperty('--sl-range-step', '0');
      slWrap.append(slInput);
      vWrap.appendChild(slWrap);

      // LS-Hint nur bei dB-Slider (cent-Slider braucht ihn nicht)
      var lsHint = null, lsHintBand = null, lsHintMark = null, lsHintLabel2 = null;
      if (slUnit === 'dB') {
        lsHint = _mkEl('div', 'ls-hint');
        lsHint.style.display = 'none';
        lsHintBand = _mkEl('div', 'ls-hint-band');
        lsHintMark = _mkEl('div', 'ls-hint-mark');
        lsHintLabel2 = _mkEl('div', 'ls-hint-label');
        lsHint.append(lsHintBand, lsHintMark, lsHintLabel2);
        slWrap.appendChild(lsHint);
      }

      // Touch-Buttons (− / Fein / +) automatisch einhängen
      var _tStep     = slCfg.touchStep     != null ? slCfg.touchStep     : 5;
      var _tFineStep = slCfg.touchFineStep != null ? slCfg.touchFineStep : 1;
      if (typeof buildSliderTouchCtrl === 'function') {
        buildSliderTouchCtrl(slInput, { step: _tStep, fineStep: _tFineStep });
      }

      refs.slider = {
        input: slInput,
        lsHint: lsHint, lsHintBand: lsHintBand, lsHintMark: lsHintMark, lsHintLabel: lsHintLabel2,
        unit: slUnit,
        initialRange: slInitialRange,
        maxRange: slMaxRange,
        rangeIdx: 0
      };

      // Slider verdrahten mit Hook
      if (vCfg.hooks && vCfg.hooks.onSlide) {
        slInput.addEventListener('input', function() {
          vCfg.hooks.onSlide(parseFloat(slInput.value));
        });
      }
      slInput.addEventListener('mouseup', function() { _maybeExtendSlider(refs.slider); slInput.blur(); });
      slInput.addEventListener('touchend', function() { _maybeExtendSlider(refs.slider); slInput.blur(); });
      slInput.addEventListener('change', function() { slInput.blur(); });
    }

    // --- sliderValue ---
    if (body.sliderValue && (body.sliderValue === true || body.sliderValue.show !== false)) {
      var svEl = _mkEl('div', 'slider-value-large');
      var svUnit = (body.slider && body.slider.unit) || 'dB';
      svEl.textContent = (svUnit === 'cent') ? '0 Cent' : (svUnit === 'ms') ? '0 ms' : '0.0 dB';
      vWrap.appendChild(svEl);
      refs.sliderValue = svEl;
      // Auto-Update nur wenn kein onSlide-Hook vorhanden (der Hook setzt detailliertere Anzeige)
      if (refs.slider && !(vCfg.hooks && vCfg.hooks.onSlide)) {
        refs.slider.input.addEventListener('input', function() {
          var v = parseFloat(refs.slider.input.value);
          if (svUnit === 'cent') svEl.textContent = v.toFixed(0) + ' Cent';
          else if (svUnit === 'ms') svEl.textContent = v.toFixed(1) + ' ms';
          else svEl.textContent = v.toFixed(1) + ' dB';
        });
      }
    }

    // --- cumulativeDisplay ---
    if (body.cumulativeDisplay) {
      var cdEl = _mkEl('div', 'cumulative-small');
      if (body.cumulativeDisplay.key) _tEl(cdEl, body.cumulativeDisplay.key);
      vWrap.appendChild(cdEl);
      refs.cumulativeDisplay = cdEl;
    }

    // --- confirmButton ---
    var confirmButton = null;
    if (body.confirmButton) {
      confirmButton = _mkEl('button', 'btn btn-primary btn-large');
      confirmButton.dataset.action = 'confirm';
      _tEl(confirmButton, body.confirmButton.key || 'btnConfirmOffset');
      vWrap.appendChild(confirmButton);
      refs.confirmButton = confirmButton;
      if (vCfg.hooks && vCfg.hooks.onConfirm) {
        confirmButton.addEventListener('click', function() { vCfg.hooks.onConfirm(); });
      }
    }

    // --- excludeButtons ---
    if (body.excludeButtons) {
      var exBtnCfg = body.excludeButtons;
      var exRow = _mkEl('div', 'exclude-row');
      var exLeft = _mkEl('button', 'btn btn-danger');
      exLeft.dataset.action = 'exclude-left';
      _tEl(exLeft, 'btnExcludeA');
      var exRight = _mkEl('button', 'btn btn-danger');
      exRight.dataset.action = 'exclude-right';
      _tEl(exRight, 'btnExcludeB');
      exRow.append(exLeft, exRight);
      vWrap.appendChild(exRow);
      refs.excludeButtons = { left: exLeft, right: exRight };
      if (vCfg.hooks && vCfg.hooks.onExclude) {
        exLeft.addEventListener('click', function() { vCfg.hooks.onExclude('left'); });
        exRight.addEventListener('click', function() { vCfg.hooks.onExclude('right'); });
      }
    }

    // --- applyButton ---
    if (body.applyButton) {
      var applyBtn = _mkEl('button', 'btn btn-primary btn-large');
      applyBtn.dataset.action = 'apply';
      _tEl(applyBtn, body.applyButton.key || 'btnApply');
      vWrap.appendChild(applyBtn);
      refs.applyButton = applyBtn;
      if (vCfg.hooks && vCfg.hooks.onApply) {
        applyBtn.addEventListener('click', function() { vCfg.hooks.onApply(); });
      }
    }

    // --- extraFragment ---
    if (body.extraFragment && body.extraFragment.fragment) {
      vWrap.appendChild(body.extraFragment.fragment);
      refs.extraFragment = body.extraFragment.fragment;
    }

    // --- actions ---
    if (body.actions && body.actions.length) {
      var actRow = _mkEl('div', 'action-row');
      var actRefs = {};
      body.actions.forEach(function(act) {
        var btn = _mkEl('button', 'btn btn-large');
        btn.dataset.action = act;
        if (act === 'undo') {
          btn.disabled = true;
          btn.innerHTML = '&#9664; <span data-t="bBack"></span> <span class="kbd">&#x232B;</span>';
          actRefs.undo = btn;
          if (vCfg.hooks && vCfg.hooks.onUndo) {
            btn.addEventListener('click', function() { vCfg.hooks.onUndo(); });
          }
        } else if (act === 'replay') {
          btn.innerHTML = '&#9654; <span data-t="bReplay"></span> <span class="kbd" data-t="kSpace"></span>';
          actRefs.replay = btn;
          if (vCfg.hooks && vCfg.hooks.onReplay) {
            btn.addEventListener('click', function() { vCfg.hooks.onReplay(); });
          }
        } else if (act === 'simul') {
          btn.innerHTML = '&#x2016; <span data-t="bSimul"></span> <span class="kbd">B</span>';
          actRefs.simul = btn;
          if (vCfg.hooks && vCfg.hooks.onSimul) {
            btn.addEventListener('click', function() { vCfg.hooks.onSimul(); });
          }
        }
        actRow.appendChild(btn);
      });
      vWrap.appendChild(actRow);
      refs.actions = actRefs;
    }

    // --- statusGrid ---
    if (body.statusGrid && (body.statusGrid === true || body.statusGrid.show !== false)) {
      var sgEl = _mkEl('div', 'fm-status-grid');
      sgEl.hidden = true;
      vWrap.appendChild(sgEl);
      refs.statusGrid = sgEl;
    }

    // --- background ---
    if (body.background) {
      var bg = body.background;
      var bgDetails = _mkEl('details', 'test-background');
      var bgSum = _mkEl('summary');
      bgSum.dataset.t = bg.titleKey;
      var bgBody = _mkEl('div', 'test-background-body');
      bgBody.dataset.t = bg.bodyKey;
      if (bg.bodyAsHtml) bgBody.dataset.bgHtml = '1';
      bgDetails.append(bgSum, bgBody);
      vWrap.appendChild(bgDetails);
      refs.background = { details: bgDetails, summary: bgSum, body: bgBody };
    }

    // --- debugRun ---
    if (body.debugRun) {
      var dbgBtn = _mkEl('button', 'btn dbg-only');
      dbgBtn.dataset.action = 'debug-run';
      dbgBtn.dataset.t = body.debugRun.key || 'btnDebugRun';
      if (body.debugRun.cssClass) dbgBtn.classList.add(body.debugRun.cssClass);
      vWrap.appendChild(dbgBtn);
      refs.debugRun = dbgBtn;
      if (vCfg.hooks && vCfg.hooks.onDebugRun) {
        dbgBtn.addEventListener('click', function() { vCfg.hooks.onDebugRun(refs); });
      }
    }

    // Replay-Sperre: Buttons die beim Abspielen disabled werden
    // (decisionButtons.up/down + confirmButton)
    if (refs.pairIndicator) {
      var lockTargets = refs.pairIndicator._lockTargets;
      if (refs.decisionButtons) {
        lockTargets.push(refs.decisionButtons.up, refs.decisionButtons.down);
      }
      if (refs.confirmButton) {
        lockTargets.push(refs.confirmButton);
      }
    }

    testBox.appendChild(vWrap);
    _verfahrenRefs[vId] = refs;
  }); // end forEach verfahren

  // ===== Ausschluss-Modal =====
  var exclOverlay = _mkEl('div', 'modal-overlay exclude-confirm-overlay');
  exclOverlay.hidden = true;
  var exclCard = _mkEl('div', 'card');
  var exclTitle2 = _mkEl('h3'); _tEl(exclTitle2, 'excludeConfirmTitle');
  var exclBody2 = _mkEl('p'); _tEl(exclBody2, 'excludeConfirmBody');
  var exclNote2 = _mkEl('p', 'muted small'); _tEl(exclNote2, 'excludeConfirmNote');
  var exclBtnGroup2 = _mkEl('div', 'btn-group');
  var exclConfirmBtn2 = _mkEl('button', 'btn btn-danger');
  exclConfirmBtn2.dataset.action = 'excl-confirm';
  _tEl(exclConfirmBtn2, 'excludeConfirmOk');
  var exclCancelBtn2 = _mkEl('button', 'btn');
  exclCancelBtn2.dataset.action = 'excl-cancel';
  _tEl(exclCancelBtn2, 'excludeConfirmCancel');
  exclBtnGroup2.append(exclConfirmBtn2, exclCancelBtn2);
  exclCard.append(exclTitle2, exclBody2, exclNote2, exclBtnGroup2);
  exclOverlay.appendChild(exclCard);

  // ===== Alles zusammenbauen =====
  parentEl.append(explainBox, headerBox, testBox, exclOverlay);

  // i18n auf alle neuen Elemente anwenden
  _applyLangSubtree(parentEl);

  // ===== Lifecycle-Verdrahtung =====

  // Verfahren-Dropdown Event-Listener
  if (verfahrenSelect) {
    verfahrenSelect.addEventListener('change', function() {
      if (_testRunning) return; // Während Test keine Änderung
      var newId = verfahrenSelect.value;
      _activeVerfahren = newId;
      cfg.verfahren.forEach(function(v) {
        var vWrap2 = testBox.querySelector('[data-verfahren="' + v.id + '"]');
        if (vWrap2) vWrap2.hidden = (v.id !== newId);
      });
      // verfahren-explain aktualisieren
      var newVCfg = null;
      for (var _i = 0; _i < cfg.verfahren.length; _i++) {
        if (cfg.verfahren[_i].id === newId) { newVCfg = cfg.verfahren[_i]; break; }
      }
      if (headerRefs.verfahrenExplainSpan && newVCfg && newVCfg.explainKey) {
        _tEl(headerRefs.verfahrenExplainSpan, newVCfg.explainKey);
        _applyLangSubtree(headerRefs.verfahrenExplainBox);
      }
      // runningTitle-Label im neuen Verfahren-Body aktualisieren
      var newVRefs = _verfahrenRefs[newId];
      if (newVRefs && newVRefs.runningTitle && newVCfg && newVCfg.labelKey) {
        var rtLabel = newVRefs.runningTitle.querySelector('.rt-label');
        if (rtLabel) {
          _tEl(rtLabel, newVCfg.labelKey);
          _applyLangSubtree(newVRefs.runningTitle);
        }
      }
    });
  }

  // Globale Dropdowns Event-Listener
  if (seqSelect) {
    seqSelect.addEventListener('change', function() {
      globalSequence = seqSelect.value;
      _syncGlobalDropdowns('sequence', seqSelect.value);
    });
  }
  if (toneSelect) {
    toneSelect.addEventListener('change', function() {
      globalToneType = toneSelect.value;
      _syncGlobalDropdowns('toneType', toneSelect.value);
      playTone(1000, gVol(), 750);
    });
  }
  if (targetSelect) {
    targetSelect.addEventListener('change', function() {
      if (id === 'test') slTarget_test = targetSelect.value;
      if (id === 'balance') slTarget_balance = targetSelect.value;
    });
  }

  // Start-Button
  startBtn.addEventListener('click', function() {
    if (_testRunning) return;
    var vCfg2 = _getActiveVerfahrenCfg();
    if (!vCfg2) return;

    _testRunning = true;
    // Tab-Sperre
    lockTestTabs(true, id);
    // Verfahren-Dropdown sperren
    if (verfahrenSelect) verfahrenSelect.disabled = true;
    // Start-/Stop-Button-Zustand
    startBtn.disabled = true;
    stopBtn.disabled = false;
    // Locked-Hint zeigen
    lockedHint.hidden = false;
    // testBox zeigen
    testBox.hidden = false;
    // Pfeiltasten-Listener installieren
    _installKeyListener(vCfg2);
    // runningTitle einblenden
    var _activeVRefs = _verfahrenRefs[_activeVerfahren];
    if (_activeVRefs && _activeVRefs.runningTitle) _activeVRefs.runningTitle.hidden = false;
    // Hook aufrufen
    if (vCfg2.hooks && vCfg2.hooks.onStart) {
      vCfg2.hooks.onStart();
    }
  });

  // Stop-Button
  stopBtn.addEventListener('click', function() {
    if (!_testRunning) return;
    _stopTest();
  });

  function _stopTest() {
    var vCfg2 = _getActiveVerfahrenCfg();
    _testRunning = false;
    // Tab-Sperre aufheben
    lockTestTabs(false, null);
    // Verfahren-Dropdown entsperren
    if (verfahrenSelect) verfahrenSelect.disabled = false;
    // Start-/Stop-Button-Zustand
    startBtn.disabled = false;
    stopBtn.disabled = true;
    // Locked-Hint ausblenden
    lockedHint.hidden = true;
    // testBox ausblenden
    testBox.hidden = true;
    // Pfeiltasten-Listener entfernen
    _removeKeyListener();
    // runningTitle ausblenden
    Object.keys(_verfahrenRefs).forEach(function(vid) {
      var vr = _verfahrenRefs[vid];
      if (vr && vr.runningTitle) vr.runningTitle.hidden = true;
    });
    // Hook aufrufen
    if (vCfg2 && vCfg2.hooks && vCfg2.hooks.onStop) {
      vCfg2.hooks.onStop();
    }
  }

  function _getActiveVerfahrenCfg() {
    for (var i = 0; i < cfg.verfahren.length; i++) {
      if (cfg.verfahren[i].id === _activeVerfahren) return cfg.verfahren[i];
    }
    return null;
  }

  // ===== Pfeiltasten-Routing =====

  function _installKeyListener(vCfg2) {
    _removeKeyListener(); // Sicherheitshalber erst entfernen
    var body = vCfg2.body || {};
    var vRefs = _verfahrenRefs[vCfg2.id];

    _keyListener = function(e) {
      // Nur aktiv wenn testBox sichtbar
      if (testBox.hidden) return;
      // Nicht feuern wenn in Text-Input / Select (außer Range)
      var activeEl = document.activeElement;
      if (activeEl && activeEl !== document.body) {
        var tag = activeEl.tagName;
        if ((tag === 'INPUT' && activeEl.type !== 'range') ||
            tag === 'SELECT' || tag === 'TEXTAREA') return;
      }

      // ← / → : Slider
      if (body.slider && vRefs && vRefs.slider) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          var slRef = vRefs.slider;
          var slUnit = slRef.unit || 'dB';
          var dir = (e.key === 'ArrowRight') ? 1 : -1;
          // Schrittweiten: cent → 5 coarse / 1 fine; dB → 0.5 coarse / 0.1 fine; ms → 1 coarse / 0.1 fine
          var coarseStep, fineStep;
          if (slUnit === 'cent') {
            coarseStep = 5; fineStep = 1;
          } else if (slUnit === 'ms') {
            coarseStep = 1; fineStep = 0.1;
          } else {
            coarseStep = 0.5; fineStep = 0.1;
          }
          var step = e.shiftKey ? fineStep : coarseStep;
          var curVal = parseFloat(slRef.input.value) || 0;
          var rangeMax = parseFloat(slRef.input.max) || 20;
          var newVal = Math.max(-rangeMax, Math.min(rangeMax, curVal + dir * step));
          // Auf step-Genauigkeit runden
          var factor = 1 / step;
          newVal = Math.round(newVal * factor) / factor;
          slRef.input.value = String(newVal);
          // sliderValue aktualisieren
          if (vRefs.sliderValue) {
            if (slUnit === 'cent') vRefs.sliderValue.textContent = newVal.toFixed(0) + ' Cent';
            else if (slUnit === 'ms') vRefs.sliderValue.textContent = newVal.toFixed(1) + ' ms';
            else vRefs.sliderValue.textContent = newVal.toFixed(1) + ' dB';
          }
          // Hook
          if (vCfg2.hooks && vCfg2.hooks.onSlide) vCfg2.hooks.onSlide(newVal);
          _maybeExtendSlider(slRef);
          return;
        }
      }

      // ↑ / ↓ : decisionButtons
      if (body.decisionButtons && vRefs && vRefs.decisionButtons) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (vCfg2.hooks && vCfg2.hooks.onDecision) vCfg2.hooks.onDecision('up');
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (vCfg2.hooks && vCfg2.hooks.onDecision) vCfg2.hooks.onDecision('down');
          return;
        }
      }

      // Leertaste : replay
      if (body.actions && body.actions.indexOf('replay') >= 0) {
        if (e.key === ' ') {
          e.preventDefault();
          if (vCfg2.hooks && vCfg2.hooks.onReplay) vCfg2.hooks.onReplay();
          return;
        }
      }

      // Backspace : undo
      if (body.actions && body.actions.indexOf('undo') >= 0) {
        if (e.key === 'Backspace') {
          e.preventDefault();
          if (vCfg2.hooks && vCfg2.hooks.onUndo) vCfg2.hooks.onUndo();
          return;
        }
      }

      // B : simul (beide Töne gleichzeitig, Nutzer-Vergleichshilfe)
      if (body.actions && body.actions.indexOf('simul') >= 0) {
        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          if (vCfg2.hooks && vCfg2.hooks.onSimul) vCfg2.hooks.onSimul();
          return;
        }
      }

      // Enter : confirmButton / onConfirm
      if (e.key === 'Enter') {
        if (body.confirmButton && vCfg2.hooks && vCfg2.hooks.onConfirm) {
          e.preventDefault();
          vCfg2.hooks.onConfirm();
        }
        return;
      }

    };

    document.addEventListener('keydown', _keyListener);
  }

  function _removeKeyListener() {
    if (_keyListener) {
      document.removeEventListener('keydown', _keyListener);
      _keyListener = null;
    }
  }

  applyMobileReadonly(parentEl);

  // ===== Rückgabe =====
  return {
    id: id,
    explainBox: explainBox,
    headerBox: headerBox,
    testBox: testBox,
    exclOverlay: exclOverlay,
    header: headerRefs,
    verfahren: _verfahrenRefs,
    // Intern: Stop-Funktion für externe Nutzung (z.B. Tab-Wechsel)
    _stopTest: _stopTest
  };
}

// ===== Haupt-Builder: Signatur-Weiche =====
function buildTestPanel(parentEl, cfg) {
  // Neue API erkennen: hat header UND verfahren
  if (cfg.header && cfg.verfahren) {
    return _buildTestPanelNew(parentEl, cfg);
  }
  // Alte API: hat presets UND test
  return _buildTestPanelOld(parentEl, cfg);
}

// ===== testUI Helfer-API =====

var testUI = {

  // ---- pairIndicator ----
  pairIndicator: {
    /**
     * Labels und Hz-Zeile setzen.
     * els: refs.pairIndicator (aus Verfahren-Refs)
     * opts: { leftText, rightText, leftHz, rightHz }
     *   oder bei variant='token': { leftText, rightText } (keine Hz-Zeile)
     */
    setLabels: function(els, opts) {
      if (!els) return;
      if (opts.leftText !== undefined) els.left.textContent = opts.leftText;
      if (opts.rightText !== undefined) els.right.textContent = opts.rightText;
      if (els.freq) {
        var parts = [];
        if (opts.leftHz !== undefined) parts.push(opts.leftHz + ' Hz');
        if (opts.rightHz !== undefined) parts.push(opts.rightHz + ' Hz');
        els.freq.textContent = parts.join(' vs. ');
      }
    },

    /**
     * Aufleuchten steuern und Replay-Sperre.
     * els: refs.pairIndicator
     * which: 'left' | 'right' | 'both' | null
     */
    setPlaying: function(els, which) {
      if (!els) return;
      // CSS-Klasse .playing setzen
      els.left.classList.toggle('playing', which === 'left' || which === 'both');
      els.right.classList.toggle('playing', which === 'right' || which === 'both');
      // Replay-Sperre
      var isPlaying = (which !== null && which !== undefined);
      (els._lockTargets || []).forEach(function(btn) {
        btn.disabled = isPlaying;
      });
    }
  },

  // ---- progress ----
  progress: {
    /**
     * Fortschrittsbalken aktualisieren.
     * els: refs.progress
     * opts: { fraction (0..1), text (string), timer (string '0:00') }
     */
    set: function(els, opts) {
      if (!els) return;
      if (opts.fraction !== undefined && els.fill) {
        els.fill.style.width = Math.max(0, Math.min(1, opts.fraction)) * 100 + '%';
      }
      if (opts.text !== undefined && els.text) {
        // text ersetzt den Inhalt (Timer bleibt als separates Element)
        // Nur Textknoten aktualisieren, timer-Span bleibt
        var tn = els.text.firstChild;
        if (tn && tn.nodeType === 3) {
          tn.textContent = opts.text + ' ';
        } else {
          els.text.insertBefore(document.createTextNode(opts.text + ' '), els.text.firstChild);
        }
      }
      if (opts.timer !== undefined && els.timer) {
        els.timer.textContent = opts.timer;
      }
    }
  },

  // ---- statusGrid ----
  statusGrid: {
    /**
     * Status-Grid befüllen.
     * els: refs.statusGrid (das DOM-Element)
     * entries: Array von { label, status, value } oder HTML-String
     */
    setEntries: function(els, entries) {
      if (!els) return;
      if (typeof entries === 'string') {
        els.innerHTML = entries;
        return;
      }
      // Array von Objekten
      var html = '';
      (entries || []).forEach(function(e) {
        html += '<div class="fm-status-row fm-status-' + (e.status || '') + '">'
          + '<span class="fm-status-label">' + (e.label || '') + '</span>'
          + '<span class="fm-status-value">' + (e.value || '') + '</span>'
          + '</div>';
      });
      els.innerHTML = html;
      els.hidden = (entries && entries.length === 0);
    }
  },

  // ---- field ----
  field: {
    /**
     * Ein einzelnes Feld aktivieren/deaktivieren.
     * els: Ergebnis von buildTestPanel (das result-Objekt)
     * path: dot-getrennter Pfad, z.B. 'verfahrenSelect.slider'
     *       oder 'header.volume' oder 'header.targetSelect'
     * enabled: bool
     * opts: { reason } — für künftige Hint-Erweiterung reserviert (derzeit ignoriert)
     *   // TODO: opts.reason für Tooltip/Hint-Anzeige neben gesperrtem Feld (Schritt 2+)
     */
    setEnabled: function(els, path, enabled, opts) {
      if (!els) return;
      var parts = path.split('.');
      if (parts[0] === 'verfahrenSelect') {
        // Einzelne Option im Verfahren-Dropdown sperren
        var sel = els.header && els.header.verfahrenSelect;
        if (!sel) return;
        var verfahrenId = parts[1];
        var opt = sel.querySelector('option[value="' + verfahrenId + '"]');
        if (opt) opt.disabled = !enabled;
      } else if (parts[0] === 'header') {
        // Header-Feld
        var fieldName = parts[1];
        var fieldEl = els.header && els.header[fieldName];
        if (fieldEl && fieldEl.disabled !== undefined) {
          fieldEl.disabled = !enabled;
        }
      }
      // Weitere Pfad-Formen können hier ergänzt werden (Schritt 2+)
    }
  },

  // ---- cumulativeDisplay ----
  cumulativeDisplay: {
    /**
     * Kumulativen Offset anzeigen.
     * els: refs.cumulativeDisplay (DOM-Element)
     * opts: { html } oder { text }
     */
    set: function(els, opts) {
      if (!els) return;
      if (opts && opts.html !== undefined) {
        els.innerHTML = opts.html;
      } else if (opts && opts.text !== undefined) {
        els.textContent = opts.text;
      }
    }
  },

  // ---- slider ----
  slider: {
    /**
     * Slider-Wert setzen und Range auf Minimum zurücksetzen.
     * Expandiert den Bereich, falls abs(value) > initialRange.
     * slRef: refs.slider aus _buildTestPanelNew
     * value: neuer numerischer Wert
     */
    setValue: function(slRef, value) {
      if (!slRef || !slRef.input || !slRef.initialRange) return;
      var absVal = Math.abs(value);
      var needed = slRef.initialRange;
      var stepIdx = 0;
      while (absVal > needed && needed < slRef.maxRange) {
        needed = Math.min(needed + slRef.initialRange, slRef.maxRange);
        stepIdx++;
      }
      slRef.rangeIdx = stepIdx;
      slRef.input.min = String(-needed);
      slRef.input.max = String(needed);
      slRef.input.value = String(Math.max(-needed, Math.min(needed, value)));
      slRef.input.style.setProperty('--sl-range-step', stepIdx);
    }
  }

};
