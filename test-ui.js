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

// ---- Haupt-Builder ----
function buildTestPanel(parentEl, cfg) {
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
    var cgRun = _mkEl('div', 'control-group');
    var lblRun = _mkEl('label'); lblRun.dataset.t = rm.runKey;
    runSelect = _mkEl('select');
    (rm.runOptions || []).forEach(function(pair) {
      var opt = new Option('', pair[0]);
      opt.dataset.t = pair[1];
      runSelect.appendChild(opt);
    });
    cgRun.append(lblRun, runSelect);
    rowMode.append(cgMode, cgRun);
    presetsBox.appendChild(rowMode);
  }

  // runExplain box (für Test 1 updateRunExplain-Kompatibilität)
  var runExplainBox = null;
  if (runSelect) {
    runExplainBox = _mkEl('div', 'info-box');
    runExplainBox.id = 'runExplain';
    presetsBox.appendChild(runExplainBox);
  }

  // Zeile 2: Feineinstellung (preCorrect + refSelect)
  var preCorrectCb = null, refSelect = null;
  if (cfg.presets.rowFine && cfg.presets.rowFine.show) {
    var rf = cfg.presets.rowFine;
    var rowFine = _mkEl('div', 'controls-row');
    rowFine.dataset.row = 'fine';
    if (rf.preCorrect) {
      var lbl = _mkEl('label', 'control-group');
      lbl.style.cssText = 'font-size:0.85em;color:var(--text-muted);display:flex;align-items:center;gap:6px;cursor:pointer';
      preCorrectCb = _mkEl('input');
      preCorrectCb.type = 'checkbox';
      preCorrectCb.id = 'preCorrect';
      var span = _mkEl('span'); span.dataset.t = 'preCorrectLabel';
      lbl.append(preCorrectCb, span);
      rowFine.appendChild(lbl);
    }
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
        ['sine','toneSine'],['complex','toneComplex'],['noise','toneNoise'],
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

  return {
    id: id,
    explainBox: explainBox, presetsBox: presetsBox, testBox: testBox, exclOverlay: exclOverlay,
    // presets
    modeSelect: modeSelect, runSelect: runSelect, preCorrectCb: preCorrectCb, refSelect: refSelect,
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
    confirmBtn: confirmBtn, confRadios: confRadios,
    // excl modal
    exclConfirmBtn: exclConfirmBtn, exclCancelBtn: exclCancelBtn,
  };
}
