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
// BA 209: Mapping Tonart -> i18n-Schlüssel.
function _toneTypeKey(tt) {
  var map = {
    sine: 'toneSine', complex: 'toneComplex',
    pulsedComplex: 'tonePulsedComplex', richTone: 'toneRichTone',
    richAcc: 'toneRichAcc', richASax: 'toneRichASax',
    richBTb: 'toneRichBTb', richVa: 'toneRichVa',
    richBn: 'toneRichBn', richClBb: 'toneRichClBb',
    richCb: 'toneRichCb', richOb: 'toneRichOb',
    richTbn: 'toneRichTbn', richFl: 'toneRichFl',
    richTpC: 'toneRichTpC', richVn: 'toneRichVn',
    richVc: 'toneRichVc', richHn: 'toneRichHn',
    richCiH: 'toneRichCiH', richCiB: 'toneRichCiB',
    richCiHA: 'toneRichCiHA', richCiHS: 'toneRichCiHS', richCiHF: 'toneRichCiHF',
    richCiP: 'toneRichCiP', richCiBF: 'toneRichCiBF',
    richCiG: 'toneRichCiG', richCiS: 'toneRichCiS',
    richCiGVL: 'toneRichCiGVL', richCiGVN: 'toneRichCiGVN',
    richCiGVS: 'toneRichCiGVS',
    richCiGA1: 'toneRichCiGA1', richCiGA2: 'toneRichCiGA2',
    richCiGB:  'toneRichCiGB',
    richCiGD1: 'toneRichCiGD1', richCiGD2: 'toneRichCiGD2',
    noise: 'toneNoise', noiseAdaptive: 'toneNoiseAdaptive',
    irn: 'toneIRN', amSine: 'toneAmSine',
    warbleSine: 'toneWarbleSine', burstSine: 'toneBurstSine',
    wobbleSweep: 'toneWobbleSweep',
    neighborSine: 'toneNeighborSine',
    sineNoiseHalf: 'toneSineNoiseHalf', sineNoiseFull: 'toneSineNoiseFull',
    clusterHz2x3: 'toneClusterHz2x3', clusterHz4x3: 'toneClusterHz4x3',
    clusterHz2x8: 'toneClusterHz2x8', clusterHz4x8: 'toneClusterHz4x8',
    clusterCent2x10: 'toneClusterCent2x10', clusterCent4x10: 'toneClusterCent4x10',
    clusterCent2x30: 'toneClusterCent2x30', clusterCent4x30: 'toneClusterCent4x30'
  };
  if (map[tt]) return map[tt];
  // BA 231: smplr-Tonarten ueber die GROUPS-Tabelle in tone-popup.js aufloesen.
  if (typeof tt === 'string'
      && tt.indexOf('smplr:') === 0
      && typeof window.toneTypeI18nKey === 'function') {
    var k = window.toneTypeI18nKey(tt);
    if (k) return k;
  }
  if (typeof tt === 'string' && tt.indexOf('smplr:') === 0) return null;
  return 'toneComplex';
}

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
  // BA 278: Slider-Bereich wurde erweitert -> Voreinschaetzung mit den
  // zuletzt gesetzten Werten neu positionieren. Sonst behaelt das
  // Dreieck/Band seine alte Prozent-Position (falscher dB-Wert), und
  // eine zunaechst ausgeblendete Voreinschaetzung bliebe unsichtbar.
  // setRangeHint ist ein No-op fuer Slider ohne rangeHint-Konfiguration.
  testUI.slider.setRangeHint(slRef, slRef._rangeHintOpts);
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

  // BA 178: Default-Sortierung — oben Stufen-Block (error->caution->warn->info->ok),
  // unten Plain-Texte in Config-Reihenfolge.
  // BA 220: cfg.explain.preserveOrder = true => keine Sortierung, alles in
  // Config-Reihenfolge. Notwendig, wenn Gruppen-Headings und Warn-Texte
  // zusammengehoeren sollen.
  // BA 220: Neuer kind 'heading' => <h4 class="explain-heading">.
  var _preserveOrder = !!(cfg.explain && cfg.explain.preserveOrder);
  var _kindOrder = { error: 0, caution: 1, warn: 2, info: 3, ok: 4 };
  var _stagedHints = [];
  var _stagedPlain = [];
  var _stagedAll   = [];
  (cfg.explain.paragraphs || []).forEach(function(p, configIdx) {
    var kind = p.kind || 'plain';
    var el;
    if (kind === 'heading') {
      el = _mkEl('h4', 'explain-heading');
    } else {
      var cls;
      if (kind === 'plain') {
        cls = 'explain-plain';
      } else if (kind === 'warn' || kind === 'caution' || kind === 'error'
                 || kind === 'info' || kind === 'ok') {
        cls = 'explain explain-' + kind;
      } else {
        cls = 'explain-plain';
        kind = 'plain';
      }
      el = _mkEl('p', cls);
    }
    if (p.key) _tEl(el, p.key);
    if (p.id)  el.id = p.id;
    if (p.hidden) el.hidden = true; // BA 220
    if (_preserveOrder) {
      _stagedAll.push(el);
    } else if (kind === 'plain' || kind === 'heading') {
      _stagedPlain.push({ el: el, configIdx: configIdx });
    } else {
      _stagedHints.push({ el: el, kind: kind, configIdx: configIdx });
    }
  });
  if (_preserveOrder) {
    _stagedAll.forEach(function(el) { explainBox.appendChild(el); });
  } else {
    _stagedHints.sort(function(a, b) {
      var ka = _kindOrder[a.kind], kb = _kindOrder[b.kind];
      if (ka !== kb) return ka - kb;
      return a.configIdx - b.configIdx;
    });
    _stagedHints.forEach(function(h) { explainBox.appendChild(h.el); });
    _stagedPlain.forEach(function(p) { explainBox.appendChild(p.el); });
  }

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
    // BA356-fix: Browser-Formular-Wiederherstellung des Dropdowns unterbinden,
    // sonst kann der wiederhergestellte Wert vom intern aktiven Verfahren
    // abweichen (Dropdown zeigt X, Start faehrt Y).
    verfahrenSelect.autocomplete = 'off';
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
    if (_firstExplainKey) {
      _tEl(verfahrenExplainSpan, _firstExplainKey);
    } else {
      // BA 247fix: keine leere Box anzeigen, wenn das Verfahren keinen explainKey hat.
      verfahrenExplainBox.style.display = 'none';
    }
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
    refSelect.id = 'ELL_refEl_' + id;
    if (hc.refSelect.type === 'electrode') {
      refSelect.id = 'ELL_refEl';
      // Optionen werden nach Build durch aufrufendes Modul befüllt
    } else if (hc.refSelect.type === 'side') {
      ['left', 'right'].forEach(function(s) {
        var opt = new Option('', s);
        _tEl(opt, s === 'left' ? 'sideLeft' : 'sideRight');
        refSelect.appendChild(opt);
      });
      if (hc.refSelect.includeSymmetric) {
        var optSym = new Option('', 'symmetric');
        _tEl(optSym, 'FRQ_symmetricOption');
        refSelect.appendChild(optSym);
      }
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
      volInput = makeNumInput2('vol', 75, 0, 100, 1, 55);
      cgVol.append(lblVol, volInput, document.createTextNode('%'));
      rowVolume.appendChild(cgVol);
    }
    if (showDur) {
      var dOpts = (typeof hc.duration === 'object') ? hc.duration : {};
      var cgDur = _mkEl('div', 'control-group');
      var lblDur = _mkEl('label'); _tEl(lblDur, 'lblDur');
      durInput = makeNumInput2('dur',
        dOpts.default || 750, dOpts.min || 100, dOpts.max || 3000, dOpts.step || 50, 65);
      cgDur.append(lblDur, durInput, document.createTextNode(' ms'));
      rowVolume.appendChild(cgDur);
    }
    if (showPau) {
      var pOpts = (typeof hc.pause === 'object') ? hc.pause : {};
      var cgPau = _mkEl('div', 'control-group');
      var lblPau = _mkEl('label'); _tEl(lblPau, 'lblPau');
      pauseInput = makeNumInput2('pau',
        pOpts.default || 300, pOpts.min || 50, pOpts.max || 2000, pOpts.step || 50, 65);
      cgPau.append(lblPau, pauseInput, document.createTextNode(' ms'));
      rowVolume.appendChild(cgPau);
    }
    if (rowVolume.children.length) headerBox.appendChild(rowVolume);
    headerRefs.volInput = volInput;
    headerRefs.durInput = durInput;
    headerRefs.pauseInput = pauseInput;
  }

  // --- common: sequence / sliderTarget ---
  var seqSelect = null;
  var showSeq = hc.sequence && (hc.sequence === true || hc.sequence.show !== false);
  if (showSeq || hc.tonePopupButton) {
    var rowSequence = _mkEl('div', 'controls-row');
    rowSequence.dataset.row = 'sequence';

    // BA 209: Tonart-Popup-Button (generisch, optional pro Verfahren).
    var tonePopupBtn = null;
    if (hc.tonePopupButton) {
      var tpCfg = hc.tonePopupButton;
      var cgTP = _mkEl('div', 'control-group');
      var lblTP = _mkEl('label'); _tEl(lblTP, 'toneTypeLbl');
      tonePopupBtn = _mkEl('button', 'btn btn-small');
      tonePopupBtn.type = 'button';

      function _tpUpdateLabel() {
        var tt = tpCfg.getToneType();
        var key = _toneTypeKey(tt);
        if (key) {
          tonePopupBtn.dataset.t = key;
          if (typeof t === 'function') tonePopupBtn.textContent = t(key);
        } else {
          // BA 228 Fix .1: smplr-Token (Mellotron) haben keinen i18n-
          // Key. Den Variant-Namen direkt nach dem letzten ':' als
          // Label zeigen, data-t entfernen damit applyLang nicht
          // überschreibt.
          delete tonePopupBtn.dataset.t;
          var lastColon = (typeof tt === 'string') ? tt.lastIndexOf(':') : -1;
          tonePopupBtn.textContent = (lastColon >= 0)
            ? tt.substring(lastColon + 1)
            : (tt || '');
        }
      }
      cgTP.append(lblTP, tonePopupBtn);
      rowSequence.appendChild(cgTP);

      tonePopupBtn.addEventListener('click', function() {
        openToneSelectionDialog(tpCfg, _tpUpdateLabel);
      });

      _tpUpdateLabel();
      headerRefs.tonePopupBtn = tonePopupBtn;
      headerRefs.tonePopupUpdate = _tpUpdateLabel;
    }

    if (showSeq) {
      var cg = _mkEl('div', 'control-group');
      var lbl2 = _mkEl('label'); _tEl(lbl2, 'sequenceLbl');
      seqSelect = _mkEl('select');
      [['aba','ABA'],['ab','AB']].forEach(function(pair) {
        seqSelect.appendChild(new Option(pair[1], pair[0]));
      });
      var seqVal = (id === 'elektrodenlautstaerke') ? sequence_elektrodenlautstaerke
                 : (id === 'stereobalance') ? sequence_stereobalance
                 : (id === 'freqmatch') ? sequence_freqmatch
                 : 'ab';
      seqSelect.value = seqVal;
      cg.append(lbl2, seqSelect);
      rowSequence.appendChild(cg);
    }

    if (rowSequence.children.length) headerBox.appendChild(rowSequence);
    headerRefs.seqSelect = seqSelect;
  }

  // BA 207: Auswahl Testelektroden (generisch, optional pro Verfahren).
  if (hc.electrodeSelection) {
    var esCfg = hc.electrodeSelection;
    var rowES = _mkEl('div', 'controls-row');
    rowES.dataset.row = 'electrode-selection';
    var esSummary = _mkEl('span', 'electrode-selection-summary');
    var esBtn = _mkEl('button', 'btn btn-small');
    esBtn.type = 'button';
    esBtn.dataset.t = 'electrodeSelectionHeaderBtn';
    rowES.append(esBtn, esSummary);
    headerBox.appendChild(rowES);
    headerRefs.electrodeSelectionSummary = esSummary;
    headerRefs.electrodeSelectionBtn = esBtn;
    headerRefs.electrodeSelectionCfg = esCfg;

    function _esUpdateSummary() {
      var sel = esCfg.getSelection();
      var stat = esCfg.getElectrodeStatus();
      var testable = stat.testable.length;
      // Bug 0.4.279.3: Anzeige bleibt immer sichtbar — auch bei 0 waehlbaren
      // Elektroden steht "0 von 0 Elektroden gewaehlt" statt leerem Text.
      var selected;
      if (sel == null) selected = testable;
      else selected = sel.filter(function(i) { return stat.testable.indexOf(i) >= 0; }).length;
      var tpl = (typeof t === 'function' && t('electrodeSelectionHeaderSummary'))
        || '{m} von {n} Elektroden gewählt';
      var txt = tpl.replace('{m}', selected).replace('{n}', testable);
      if (selected < testable) txt += ' ⚠';
      esSummary.textContent = txt;
    }
    headerRefs.electrodeSelectionUpdate = _esUpdateSummary;

    esBtn.addEventListener('click', function() {
      _openElectrodeSelectionDialog(esCfg, _esUpdateSummary);
    });

    _esUpdateSummary();
  }

  // --- extra.fragment ---
  // inline: true haengt die Children des Fragments einzeln in die
  // rowSequence (toneType/sequence/sliderTarget), statt eine eigene
  // Zeile zu erzeugen. Voraussetzung: rowSequence existiert und ist
  // im DOM. Sonst Fallback auf eigene Zeile.
  if (cfg.header.extra && cfg.header.extra.fragment) {
    var ef = cfg.header.extra.fragment;
    if (cfg.header.extra.inline
        && typeof rowSequence !== 'undefined'
        && rowSequence && rowSequence.parentNode) {
      while (ef.firstChild) rowSequence.appendChild(ef.firstChild);
    } else {
      headerBox.appendChild(ef);
    }
    headerRefs.extraFragment = ef;
  }

  // --- startStop ---
  var startStopRow = _mkEl('div', 'btn-group');
  startStopRow.dataset.row = 'startstop';
  var startBtn = _mkEl('button', 'btn btn-primary btn-large');
  startBtn.dataset.action = 'start';
  _tEl(startBtn, cfg.header.startStop.startKey || 'btnStartTest');
  var stopBtn = _mkEl('button', 'btn btn-large');
  stopBtn.dataset.action = 'stop';
  _tEl(stopBtn, cfg.header.startStop.stopKey || 'btnStopTest');
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
      vWrap.append(pbWrap, pbText);
      // BA 247fix2: timer-Span entfaellt (niemand pflegt ihn aktiv).
      refs.progress = { fill: pbFill, text: pbText };
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

    // --- piano (BA354) ---
    if (body.piano) {
      var pnWrap = _mkEl("div", "tk-piano-wrap");
      pnWrap.style.cssText = "display:flex;align-items:stretch;gap:8px;margin:10px 0;";

      var pnLeft = _mkEl("button", "btn btn-sm tk-piano-arrow");
      pnLeft.type = "button";
      pnLeft.innerHTML = "&#9664;"; // ◀
      pnLeft.setAttribute("aria-label", "Bereich nach links");

      var pnRow = _mkEl("div", "tk-piano-row");
      pnRow.style.cssText = "position:relative;display:flex;flex:1;height:80px;"
        + "border:1px solid #444;border-radius:4px;overflow:hidden;"
        + "user-select:none;-webkit-user-select:none;touch-action:none;";

      var pnRight = _mkEl("button", "btn btn-sm tk-piano-arrow");
      pnRight.type = "button";
      pnRight.innerHTML = "&#9654;"; // ▶
      pnRight.setAttribute("aria-label", "Bereich nach rechts");

      var PN_WHITE_LABELS = ["A","S","D","F","G","H","J","K","L"];
      var PN_BLACK_LABELS = ["W","E","R","T","Z","U","I","O"];
      var PN_WHITE_CODES  = ["KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL"];
      var PN_BLACK_CODES  = ["KeyW","KeyE","KeyR","KeyT","KeyY","KeyU","KeyI","KeyO"];

      var pnWhite = [];
      var pnBlack = [];

      // Weisse Tasten (9).
      for (var _wi = 0; _wi < 9; _wi++) {
        var _wk = _mkEl("div", "tk-key tk-white");
        _wk.style.cssText = "flex:1;border-right:1px solid #888;background:#fff;"
          + "cursor:pointer;position:relative;display:flex;align-items:flex-end;"
          + "justify-content:center;padding-bottom:4px;font-size:.78em;color:#333;";
        _wk.textContent = PN_WHITE_LABELS[_wi];
        _wk.dataset.slot = String(_wi);
        _wk.dataset.black = "0";
        pnWhite[_wi] = _wk;
        pnRow.appendChild(_wk);
        (function (slotIdx) {
          _wk.addEventListener("click", function () { _pnPlaySlot(refs.piano, vCfg, slotIdx, false); });
        })(_wi);
      }

      // Schwarze Tasten (8), zwischen weiss i und i+1.
      var _pnWhitePct = 100 / 9;
      for (var _bi = 0; _bi < 8; _bi++) {
        var _bk = _mkEl("div", "tk-key tk-black");
        var _bLeft  = (_bi + 1) * _pnWhitePct - _pnWhitePct / 4;
        var _bWidth = _pnWhitePct / 2;
        _bk.style.cssText = "position:absolute;top:0;left:" + _bLeft.toFixed(3) + "%;"
          + "width:" + _bWidth.toFixed(3) + "%;height:60%;background:#222;"
          + "border:1px solid #000;border-radius:0 0 3px 3px;cursor:pointer;"
          + "display:flex;align-items:flex-end;justify-content:center;"
          + "padding-bottom:3px;font-size:.72em;color:#fff;";
        _bk.textContent = PN_BLACK_LABELS[_bi];
        _bk.dataset.slot = String(_bi);
        _bk.dataset.black = "1";
        pnBlack[_bi] = _bk;
        pnRow.appendChild(_bk);
        (function (slotIdx) {
          _bk.addEventListener("click", function () { _pnPlaySlot(refs.piano, vCfg, slotIdx, true); });
        })(_bi);
      }

      pnWrap.append(pnLeft, pnRow, pnRight);
      vWrap.appendChild(pnWrap);

      pnLeft.addEventListener("click",  function () { _pnShift(refs.piano, vCfg, -1); });
      pnRight.addEventListener("click", function () { _pnShift(refs.piano, vCfg,  1); });

      refs.piano = {
        wrap: pnWrap, row: pnRow,
        white: pnWhite, black: pnBlack,
        leftArrow: pnLeft, rightArrow: pnRight,
        whiteCodes: PN_WHITE_CODES, blackCodes: PN_BLACK_CODES,
        // Laufzeit-Modell (vom Verfahren via testUI.piano.setRound gesetzt).
        // Default: Stufe 250 ct, Mitte = 0 ct.
        stepCent: 250,
        originCent: -4 * 250,
        baseFreq: 0,
        markedAbsCent: null,
        markedBlack: false
      };
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


      // BA 206: Slider Round — Min/Max-Bereich + Median-Dreieck (eigene Klassen).
      var rangeHint = null, rangeHintBand = null, rangeHintMark = null, rangeHintLabel = null;
      if (vCfg.body.slider && vCfg.body.slider.rangeHint) {
        rangeHint = _mkEl('div', 'frq-range-hint');
        rangeHint.style.display = 'none';
        rangeHintBand  = _mkEl('div', 'frq-range-hint-band');
        rangeHintMark  = _mkEl('div', 'frq-range-hint-mark');
        rangeHintLabel = _mkEl('div', 'frq-range-hint-label');
        rangeHint.append(rangeHintBand, rangeHintMark, rangeHintLabel);
        slWrap.appendChild(rangeHint);
      }

      // Touch-Buttons (− / Fein / +) automatisch einhängen
      var _tStep     = slCfg.touchStep     != null ? slCfg.touchStep     : 5;
      var _tFineStep = slCfg.touchFineStep != null ? slCfg.touchFineStep : 1;
      if (typeof buildSliderTouchCtrl === 'function') {
        buildSliderTouchCtrl(slInput, { step: _tStep, fineStep: _tFineStep });
      }

      refs.slider = {
        input: slInput,
        rangeHint: rangeHint, rangeHintBand: rangeHintBand,
        rangeHintMark: rangeHintMark, rangeHintLabel: rangeHintLabel,
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
      // BA 219: Verlinkung in refs.slider, damit testUI.slider.setValueDisplay(slRef, ...)
      // ueber die Slider-Refs greifen kann.
      if (refs.slider) refs.slider.valueDisplay = svEl;
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
      // BA 247fix2: Fokus nach Klick entfernen, sonst loest Enter den Button
      // doppelt aus (Browser-Click + testUI-Keyboard).
      confirmButton.addEventListener('mouseup', function() { confirmButton.blur(); });
      if (vCfg.hooks && vCfg.hooks.onConfirm) {
        confirmButton.addEventListener('click', function() { vCfg.hooks.onConfirm(); });
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
      body.actions.forEach(function(actSpec) {
        // BA 246: Eintrag darf String oder { kind, labelKey } sein.
        var act      = (typeof actSpec === 'string') ? actSpec : actSpec.kind;
        var labelKey = (typeof actSpec === 'string') ? null    : actSpec.labelKey;
        var btn = _mkEl('button', 'btn btn-large');
        btn.dataset.action = act;
        // BA 247fix2: Fokus nach Klick entfernen, sonst loest die Leertaste
        // doppelt aus (Browser-Click auf focussierten Button + testUI-Keyboard).
        btn.addEventListener('mouseup', function() { btn.blur(); });
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
        } else if (act === 'pause') {
          _tEl(btn, 'btnPauseTest');
          actRefs.pause = btn;
          if (vCfg.hooks && vCfg.hooks.onPause) {
            btn.addEventListener('click', function() { vCfg.hooks.onPause(); });
          }
        } else if (act === 'swap') {
          // BA 246: labelKey ueberschreibt Default btnSwapLR.
          var swapKey = labelKey || 'btnSwapLR';
          btn.innerHTML = '&#x21C4; <span data-t="' + swapKey + '"></span> <span class="kbd">S</span>';
          actRefs.swap = btn;
          if (vCfg.hooks && vCfg.hooks.onSwap) {
            btn.addEventListener('click', function() { vCfg.hooks.onSwap(); });
          }
        }
        actRow.appendChild(btn);
      });
      vWrap.appendChild(actRow);
      refs.actions = actRefs;
    }

    // --- clipHint (BA 285): Deckelungs-Hinweis unter der Aktionszeile ---
    if (body.clipHint) {
      var clipEl = _mkEl('div', 'clip-hint');
      clipEl.style.display = 'none';
      vWrap.appendChild(clipEl);
      refs.clipHint = clipEl;
    }

    // --- statusGrid ---
    if (body.statusGrid && (body.statusGrid === true || body.statusGrid.show !== false)) {
      var sgEl = _mkEl('div', 'frq-status-grid');
      sgEl.hidden = true;
      vWrap.appendChild(sgEl);
      refs.statusGrid = sgEl;
    }

    // --- background (eigene Card außerhalb testBox) ---
    if (body.background) {
      var bg = body.background;
      var bgBox = _mkEl('div', 'card test-background-box');
      bgBox.hidden = (vId !== _activeVerfahren);
      var bgDetails = _mkEl('details', 'test-background');
      var bgSum = _mkEl('summary');
      var bgSumTitle = _mkEl('span'); bgSumTitle.dataset.t = bg.titleKey || 'testBackgroundTitle';
      var bgSumLabel = _mkEl('span'); bgSumLabel.dataset.t = vCfg.labelKey;
      bgSum.append(bgSumTitle, document.createTextNode(' – '), bgSumLabel);
      var bgBody = _mkEl('div', 'test-background-body');
      bgBody.dataset.t = bg.bodyKey;
      if (bg.bodyAsHtml) bgBody.dataset.bgHtml = '1';
      bgDetails.append(bgSum, bgBody);
      bgBox.appendChild(bgDetails);
      refs.background = { box: bgBox, details: bgDetails, summary: bgSum, body: bgBody };
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
      if (refs.actions && refs.actions.swap) {
        lockTargets.push(refs.actions.swap);
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

  // ===== Prerequisites-Modal (BA 219) =====
  var prereqOverlay = _mkEl('div', 'modal-overlay prereq-overlay');
  prereqOverlay.hidden = true;
  var prereqCard = _mkEl('div', 'card');
  var prereqTitle = _mkEl('h3');
  var prereqBody  = _mkEl('p');
  prereqBody.style.whiteSpace = 'pre-line';
  var prereqBtnGroup = _mkEl('div', 'btn-group');
  prereqCard.append(prereqTitle, prereqBody, prereqBtnGroup);
  prereqOverlay.appendChild(prereqCard);

  // Hilfsfunktion: Dialog mit gegebenem prereq-Eintrag oeffnen.
  // onContinue() wird aufgerufen, wenn der User 'continue' waehlt.
  function _openPrereqDialog(prereq, onContinue) {
    prereqTitle.textContent = '';
    if (prereq.titleKey) {
      _tEl(prereqTitle, prereq.titleKey);
    }
    prereqBody.textContent = '';
    if (prereq.messageKey) {
      _tEl(prereqBody, prereq.messageKey);
    }
    prereqBtnGroup.innerHTML = '';
    (prereq.actions || []).forEach(function(act) {
      var btn = _mkEl('button', 'btn');
      if (act.kind === 'abort')    btn.classList.add('btn-secondary');
      if (act.kind === 'continue') btn.classList.add('btn-primary');
      if (act.kind === 'custom')   btn.classList.add('btn-primary');
      if (act.labelKey) _tEl(btn, act.labelKey);
      btn.addEventListener('click', function() {
        prereqOverlay.classList.remove('active');
        if (act.kind === 'custom' && typeof act.run === 'function') {
          act.run();
        } else if (act.kind === 'continue') {
          onContinue();
        }
        // abort: nichts.
      });
      prereqBtnGroup.appendChild(btn);
    });
    _applyLangSubtree(prereqOverlay);
    prereqOverlay.classList.add('active');
  }

  // ===== Alles zusammenbauen =====
  parentEl.append(explainBox, headerBox, testBox);
  cfg.verfahren.forEach(function(v) {
    var vr = _verfahrenRefs[v.id];
    if (vr && vr.background && vr.background.box) parentEl.appendChild(vr.background.box);
  });
  parentEl.appendChild(exclOverlay);
  parentEl.appendChild(prereqOverlay); // BA 219

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
        var vr = _verfahrenRefs[v.id];
        if (vr && vr.background && vr.background.box) vr.background.box.hidden = (v.id !== newId);
      });
      // verfahren-explain aktualisieren
      var newVCfg = null;
      for (var _i = 0; _i < cfg.verfahren.length; _i++) {
        if (cfg.verfahren[_i].id === newId) { newVCfg = cfg.verfahren[_i]; break; }
      }
      if (headerRefs.verfahrenExplainSpan && newVCfg && newVCfg.explainKey) {
        _tEl(headerRefs.verfahrenExplainSpan, newVCfg.explainKey);
        if (headerRefs.verfahrenExplainBox) {
          headerRefs.verfahrenExplainBox.style.display = '';
        }
        _applyLangSubtree(headerRefs.verfahrenExplainBox);
      } else if (headerRefs.verfahrenExplainBox) {
        // BA 247fix: Box ausblenden, wenn das neue Verfahren keinen explainKey hat.
        headerRefs.verfahrenExplainBox.style.display = 'none';
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

  // Sequence-Dropdown Event-Listener (pro Test)
  if (seqSelect) {
    seqSelect.addEventListener('change', function() {
      if (id === 'elektrodenlautstaerke') sequence_elektrodenlautstaerke = seqSelect.value;
      if (id === 'stereobalance') sequence_stereobalance = seqSelect.value;
      if (id === 'freqmatch') sequence_freqmatch = seqSelect.value;
    });
  }

  // BA 219: Eigentliche Start-Sequenz aus dem Handler herausgezogen,
  // damit prerequisites davorgeschaltet werden koennen.
  function _doStartAfterPrereqs(vCfg2) {
    _testRunning = true;
    document.body.classList.add('test-running'); // BA 183
    // Tab-Sperre
    lockTestTabs(true, id);
    // Verfahren-Dropdown sperren
    if (verfahrenSelect) verfahrenSelect.disabled = true;
    if (refSelect) refSelect.disabled = true;
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
  }

  // Start-Button
  startBtn.addEventListener('click', function() {
    if (_testRunning) return;
    var vCfg2 = _getActiveVerfahrenCfg();
    if (!vCfg2) return;

    // BA 219: prerequisites vor onStart durchlaufen.
    // Erste verletzte Voraussetzung oeffnet den Dialog; alle weiteren
    // in dieser Runde werden ignoriert. Bei 'continue' laeuft die
    // Start-Sequenz; bei 'abort' oder 'custom' bleibt _testRunning false.
    var prereqs = vCfg2.prerequisites || [];
    for (var pi = 0; pi < prereqs.length; pi++) {
      var pr = prereqs[pi];
      var ok = true;
      try { ok = pr.checkFn ? !!pr.checkFn() : true; }
      catch (e) { ok = true; }
      if (!ok) {
        _openPrereqDialog(pr, function() {
          _doStartAfterPrereqs(vCfg2);
        });
        return;
      }
    }
    _doStartAfterPrereqs(vCfg2);
  });

  // Stop-Button
  stopBtn.addEventListener('click', function() {
    if (!_testRunning) return;
    _stopTest();
  });

  function _stopTest() {
    // Re-Entry-Schutz: onStop-Hooks dürfen _stopTest erneut aufrufen,
    // ohne dass die Routine inkl. Hook nochmal durchläuft (Rekursion).
    if (!_testRunning) return;
    var vCfg2 = _getActiveVerfahrenCfg();
    _testRunning = false;
    document.body.classList.remove('test-running'); // BA 183
    // Tab-Sperre aufheben
    lockTestTabs(false, null);
    // Verfahren-Dropdown entsperren
    if (verfahrenSelect) verfahrenSelect.disabled = false;
    if (refSelect) refSelect.disabled = false;
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

      // Klavier: Buchstaben-Tasten (physische Position via e.code) + Bereichs-Pfeile
      if (body.piano && vRefs && vRefs.piano) {
        var _p = vRefs.piano;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          _pnShift(_p, vCfg2, (e.key === "ArrowRight") ? 1 : -1);
          return;
        }
        var _wIdx = _p.whiteCodes.indexOf(e.code);
        if (_wIdx >= 0) { e.preventDefault(); _pnPlaySlot(_p, vCfg2, _wIdx, false); return; }
        var _bIdx = _p.blackCodes.indexOf(e.code);
        if (_bIdx >= 0) { e.preventDefault(); _pnPlaySlot(_p, vCfg2, _bIdx, true); return; }
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

      // S : swap (L↔R tauschen, Stereo-Balance)
      if (body.actions && body.actions.indexOf('swap') >= 0) {
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          if (vCfg2.hooks && vCfg2.hooks.onSwap) vCfg2.hooks.onSwap();
          return;
        }
      }

      // Enter : confirmButton.onConfirm ODER applyButton.onApply
      if (e.key === 'Enter') {
        if (body.confirmButton && vCfg2.hooks && vCfg2.hooks.onConfirm) {
          e.preventDefault();
          vCfg2.hooks.onConfirm();
        } else if (body.applyButton && vCfg2.hooks && vCfg2.hooks.onApply) {
          e.preventDefault();
          vCfg2.hooks.onApply();
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

// ===== Haupt-Builder =====
// BA 248: alte API entfaellt; Direktaufruf statt Signatur-Weiche.
function buildTestPanel(parentEl, cfg) {
  return _buildTestPanelNew(parentEl, cfg);
}

// ===== BA354: Klavier-Baustein (Helfer, globaler Scope) =====
// p = refs.piano (Laufzeit-Modell + DOM-Referenzen).

function _pnCellCent(p, slot, isBlack) {
  var c = p.originCent + slot * p.stepCent;
  if (isBlack) c += p.stepCent / 2;
  return c;
}

function _pnCellFreq(p, slot, isBlack) {
  if (!p.baseFreq) return 0;
  return p.baseFreq * Math.pow(2, _pnCellCent(p, slot, isBlack) / 1200);
}

function _pnRenderMark(p) {
  for (var i = 0; i < p.white.length; i++) p.white[i].style.boxShadow = "";
  for (var j = 0; j < p.black.length; j++) p.black[j].style.boxShadow = "";
  if (p.markedAbsCent == null) return;
  for (var s = 0; s < 9; s++) {
    if (Math.abs(_pnCellCent(p, s, false) - p.markedAbsCent) < 0.001) {
      p.white[s].style.boxShadow = "inset 0 0 0 3px var(--success)";
      return;
    }
  }
  for (var b = 0; b < 8; b++) {
    if (Math.abs(_pnCellCent(p, b, true) - p.markedAbsCent) < 0.001) {
      p.black[b].style.boxShadow = "inset 0 0 0 3px var(--success)";
      return;
    }
  }
}

function _pnMarkSlot(p, slot, isBlack) {
  p.markedAbsCent = _pnCellCent(p, slot, isBlack);
  p.markedBlack = !!isBlack;
  _pnRenderMark(p);
}

function _pnSetRound(p, opts) {
  opts = opts || {};
  if (typeof opts.stepCent === "number")   p.stepCent = opts.stepCent;
  if (typeof opts.centerCent === "number") p.originCent = opts.centerCent - 4 * p.stepCent;
  if (typeof opts.baseFreq === "number")   p.baseFreq = opts.baseFreq;
  p.markedAbsCent = null;
  _pnRenderMark(p);
}

function _pnShiftWindow(p, dir) {
  var newOrigin = p.originCent + dir * 5 * p.stepCent;
  if (p.markedAbsCent != null) {
    var lo = newOrigin, hi = newOrigin + 8 * p.stepCent;
    if (p.markedAbsCent < lo)      newOrigin = p.markedAbsCent;
    else if (p.markedAbsCent > hi) newOrigin = p.markedAbsCent - 8 * p.stepCent;
  }
  p.originCent = newOrigin;
  _pnRenderMark(p);
}

function _pnPlaySlot(p, vCfg, slot, isBlack) {
  _pnMarkSlot(p, slot, isBlack);
  if (vCfg && vCfg.hooks && vCfg.hooks.onPianoPlay) {
    vCfg.hooks.onPianoPlay({
      slot: slot,
      isBlack: !!isBlack,
      cent: _pnCellCent(p, slot, isBlack),
      freq: _pnCellFreq(p, slot, isBlack)
    });
  }
}

function _pnShift(p, vCfg, dir) {
  _pnShiftWindow(p, dir);
  if (vCfg && vCfg.hooks && vCfg.hooks.onPianoShift) vCfg.hooks.onPianoShift(dir);
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

  // ---- piano (BA354) ----
  // Vom Verfahren (Schritt 3) genutzte Steuer-API des Klavier-Bausteins.
  // p = refs.piano aus den Verfahren-Refs.
  piano: {
    // Runde setzen: { stepCent, centerCent, baseFreq } (alle optional).
    setRound:    function (p, opts) { _pnSetRound(p, opts); },
    // Markierung manuell setzen (sonst automatisch beim Anschlag).
    markSlot:    function (p, slot, isBlack) { _pnMarkSlot(p, slot, isBlack); },
    // Fenster verschieben (dir = -1 / +1).
    shiftWindow: function (p, dir) { _pnShiftWindow(p, dir); },
    // Cent-Wert / Frequenz eines Slots (isBlack = true fuer schwarze Taste).
    cellCent:    function (p, slot, isBlack) { return _pnCellCent(p, slot, isBlack); },
    cellFreq:    function (p, slot, isBlack) { return _pnCellFreq(p, slot, isBlack); }
  },

  // ---- clipHint (BA 285) ----
  clipHint: {
    /**
     * Deckelungs-Hinweis setzen oder ausblenden.
     * el:   refs.clipHint (aus Verfahren-Refs)
     * text: String zum Anzeigen, null/'' zum Ausblenden.
     */
    set: function(el, text) {
      if (!el) return;
      if (!text) { el.style.display = 'none'; el.textContent = ''; return; }
      el.textContent = text;
      el.style.display = '';
    }
  },

  // ---- tonePlayer (BA 286): gemeinsame Token-Abspielmaschine ----
  // Spielt eine Token-Liste ab. Token-Arten:
  //   Ton:   { hz, pan, vol, durationMs }   (vol = fertiger absoluter Gain)
  //   Pause: { pauseMs }
  // Zwei Modi: playSequential (nacheinander, mit Pausen) und
  // playSimultaneous (alle Ton-Token parallel, Pausen ignoriert).
  // Die Maschine rechnet KEINE Pegel/Korrekturen -- der Aufrufer liefert
  // fertige Token. Optionaler onStepStart-Hook fuer Aufleuchten/Indikator.
  tonePlayer: (function () {
    var _to     = null;   // aktueller setTimeout-Handle
    var _active = false;  // laeuft gerade?

    function _stop() {
      _active = false;
      if (_to) { clearTimeout(_to); _to = null; }
    }

    // onStepStart(index, token):
    //   index >= 0  -> Ton-Token startet (token = das Token)
    //   index === -1 -> Pause oder Sequenz-Ende (token = null)
    //   index === -2 -> Gleichzeitig-Block startet (token = Array der Toene)
    function _playSequential(tokens, opts) {
      opts = opts || {};
      var c = (typeof gAC === 'function') ? gAC() : null;
      if (!c || !Array.isArray(tokens) || tokens.length === 0) {
        if (typeof opts.onDone === 'function') opts.onDone();
        return;
      }
      _stop();
      _active = true;
      var idx = 0;
      function step() {
        if (!_active) return;
        if (idx >= tokens.length) {
          _active = false;
          if (typeof opts.onStepStart === 'function') opts.onStepStart(-1, null);
          if (typeof opts.onDone === 'function') opts.onDone();
          return;
        }
        var tk = tokens[idx++];
        if (tk && typeof tk.pauseMs === 'number') {
          if (typeof opts.onStepStart === 'function') opts.onStepStart(-1, null);
          _to = setTimeout(step, tk.pauseMs);
          return;
        }
        if (!tk || typeof tk.hz !== 'number' || typeof tk.durationMs !== 'number') {
          step();
          return;
        }
        var vol = (typeof tk.vol === 'number') ? tk.vol : 0.25;
        var pan = (typeof tk.pan === 'number') ? tk.pan : 0;
        if (typeof opts.onStepStart === 'function') opts.onStepStart(idx - 1, tk);
        try {
          playToneTyped(c, tk.hz, vol, tk.durationMs, pan, opts.toneType || 'sine');
        } catch (e) { /* swallow */ }
        _to = setTimeout(step, tk.durationMs);
      }
      step();
    }

    function _playSimultaneous(tokens, opts) {
      opts = opts || {};
      var c = (typeof gAC === 'function') ? gAC() : null;
      var tones = (Array.isArray(tokens) ? tokens : []).filter(function (tk) {
        return tk && typeof tk.hz === 'number' && typeof tk.durationMs === 'number';
      });
      if (!c || tones.length === 0) {
        if (typeof opts.onDone === 'function') opts.onDone();
        return;
      }
      _stop();
      _active = true;
      var maxDur = 0;
      tones.forEach(function (tk) {
        var vol = (typeof tk.vol === 'number') ? tk.vol : 0.25;
        var pan = (typeof tk.pan === 'number') ? tk.pan : 0;
        if (tk.durationMs > maxDur) maxDur = tk.durationMs;
        try {
          playToneTyped(c, tk.hz, vol, tk.durationMs, pan, opts.toneType || 'sine');
        } catch (e) { /* swallow */ }
      });
      if (typeof opts.onStepStart === 'function') opts.onStepStart(-2, tones);
      _to = setTimeout(function () {
        _active = false;
        if (typeof opts.onStepStart === 'function') opts.onStepStart(-1, null);
        if (typeof opts.onDone === 'function') opts.onDone();
      }, maxDur);
    }

    return {
      playSequential:   _playSequential,
      playSimultaneous: _playSimultaneous,
      stop:             _stop,
      isPlaying:        function () { return _active; }
    };
  })(),

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
        // BA 247fix2: Timer-Span entfaellt; Text darf den ganzen Inhalt setzen.
        els.text.textContent = opts.text;
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
        html += '<div class="frq-status-row frq-status-' + (e.status || '') + '">'
          + '<span class="frq-status-label">' + (e.label || '') + '</span>'
          + '<span class="frq-status-value">' + (e.value || '') + '</span>'
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
    /**
     * Slider-Wert setzen und Range auf das fuer Wert und ggf. opts.minAbs
     * noetige Minimum kalibrieren. Expandiert den Bereich, bis
     * max(|value|, opts.minAbs|0) hineinpasst, hoechstens bis maxRange.
     *
     * slRef: refs.slider aus _buildTestPanelNew
     * value: neuer numerischer Wert
     * opts:  optional { minAbs: number } — Mindest-Absolutbereich
     *        (z.B. Marker-Position aus setRangeHint).
     */
    setValue: function(slRef, value, opts) {
      if (!slRef || !slRef.input || !slRef.initialRange) return;
      var minAbs = (opts && isFinite(opts.minAbs)) ? Math.abs(opts.minAbs) : 0;
      var absVal = Math.max(Math.abs(value), minAbs);
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
    },

    /**
     * BA 219: Anzeigetext fuer den Slider-Wert setzen.
     * Inhalt wird vom Verfahren bestimmt (z.B. "+50 Cent (1234.56 Hz)",
     * "-3.2 dB", "200 ms"). No-op wenn sliderValue nicht im Body konfiguriert.
     *
     * slRef: refs.slider
     * text:  beliebiger String
     */
    setValueDisplay: function(slRef, text) {
      if (!slRef || !slRef.valueDisplay) return;
      slRef.valueDisplay.textContent = text;
    },

    /**
     * BA 219: Range-Hint unter dem Slider (Min/Max-Band + Marker-Dreieck).
     * Generischer Ersatz fuer die alte _FRQ_updateSliderRangeMarker-Logik
     * (freqmatch) und perspektivisch fuer ls-hint (lr-balance, alte API).
     * No-op wenn rangeHint nicht konfiguriert.
     *
     * slRef: refs.slider
     * opts:  null oder {} blendet aus.
     *        Sonst:
     *          marker: Zahl im Slider-Bereich (Position des Dreiecks). Pflicht.
     *          label:  String fuer das Dreieck-Label. Optional, default leer.
     *          min:    Zahl, Untergrenze des Bandes. Optional.
     *          max:    Zahl, Obergrenze des Bandes. Optional.
     *                  Band wird nur gezeigt, wenn min und max gesetzt und min < max.
     */
    setRangeHint: function(slRef, opts) {
      if (!slRef || !slRef.rangeHint) return;
      // BA 278: zuletzt uebergebene opts am Schieber-Ref merken, damit
      // _maybeExtendSlider die Voreinschaetzung nach einer Bereichs-
      // erweiterung mit denselben Werten neu positionieren kann.
      slRef._rangeHintOpts = opts || null;
      var hint = slRef.rangeHint;
      var band = slRef.rangeHintBand;
      var mark = slRef.rangeHintMark;
      var label = slRef.rangeHintLabel;
      // Aus / leer => verstecken.
      if (!opts || opts.marker == null || !isFinite(opts.marker)) {
        hint.style.display = 'none';
        return;
      }
      var input = slRef.input;
      if (!input) { hint.style.display = 'none'; return; }
      var minV = parseFloat(input.min), maxV = parseFloat(input.max);
      if (!isFinite(minV) || !isFinite(maxV) || maxV <= minV) {
        hint.style.display = 'none'; return;
      }
      var marker = opts.marker;
      if (marker < minV || marker > maxV) {
        hint.style.display = 'none'; return;
      }
      hint.style.display = '';
      var span = maxV - minV;
      var markPct = ((marker - minV) / span) * 100;
      if (mark)  mark.style.left  = markPct + '%';
      if (label) {
        label.style.left = markPct + '%';
        label.textContent = opts.label || '';
      }
      // Band nur wenn min/max sinnvoll.
      if (band) {
        if (opts.min == null || opts.max == null
            || !isFinite(opts.min) || !isFinite(opts.max)
            || opts.min === opts.max) {
          band.style.display = 'none';
        } else {
          band.style.display = '';
          var bandLeft  = Math.max(minV, Math.min(opts.min, opts.max));
          var bandRight = Math.min(maxV, Math.max(opts.min, opts.max));
          band.style.left  = (((bandLeft  - minV) / span) * 100) + '%';
          band.style.width = (((bandRight - bandLeft) / span) * 100) + '%';
        }
      }
    }
  },

  // ---- verfahren ----
  verfahren: {
    /**
     * Programmatisch das aktive Verfahren wechseln.
     * els:    Ergebnis von buildTestPanel
     * vId:    Ziel-Verfahren-Id (z.B. 'slider' | 'adaptive')
     * Setzt den Wert des verfahrenSelect und feuert das change-Event,
     * damit der einheitliche Wechsel-Handler (Panels, Explain,
     * runningTitle, _activeVerfahren) ausgeführt wird.
     */
    select: function(els, vId) {
      var sel = els && els.header && els.header.verfahrenSelect;
      if (!sel) return;
      if (sel.value === vId) return;
      sel.value = vId;
      sel.dispatchEvent(new Event('change'));
    }
  },

  // ---- explain (BA 219) ----
  explain: {
    /**
     * Sichtbarkeit eines Erklaer-Absatzes umschalten.
     * Sucht den Absatz mit der gegebenen id im Erklaerblock und setzt
     * sein hidden-Attribut.
     *
     * panelEls: Rueckgabewert von buildTestPanel (panelEls.explainBox).
     * id:       String, entspricht der id, die in
     *           cfg.explain.paragraphs[].id vergeben wurde.
     * visible:  bool. true => sichtbar, false => versteckt.
     *
     * No-op, wenn der Absatz nicht existiert.
     */
    setVisible: function(panelEls, id, visible) {
      if (!panelEls || !panelEls.explainBox || !id) return;
      var el = panelEls.explainBox.querySelector('#' + CSS.escape(id));
      if (!el) return;
      el.hidden = !visible;
    }
  }

};

// BA 207: Modal-Dialog „Testelektroden auswählen".
// cfg: {
//   minSelected:        number   - Mindestanzahl gewählter Elektroden (>=1)
//   getSelection:       () => number[] | null   - aktuelle Auswahl
//   setSelection:       (sel: number[]) => void - Auswahl setzen, Sync-Callbacks intern
//   getElectrodeStatus: () => { testable: number[], muted: number[], excluded: number[] }
//   electrodeLabel:     (i) => string  - Anzeigename z.B. "E3 (590 Hz)"
// }
function _openElectrodeSelectionDialog(cfg, onChange) {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.45);' +
    'display:flex;align-items:center;justify-content:center;z-index:9999;';

  var dlg = document.createElement('div');
  dlg.className = 'modal-dlg';
  dlg.style.cssText =
    'background:var(--bg,#fff);color:var(--fg,#000);padding:18px 22px;' +
    'border-radius:8px;min-width:320px;max-width:90vw;max-height:85vh;overflow:auto;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.3);';

  var title = document.createElement('h3');
  title.dataset.t = 'electrodeSelectionTitle';
  title.style.cssText = 'margin:0 0 8px 0;font-size:1.05em;';
  dlg.appendChild(title);

  var hint = document.createElement('p');
  hint.dataset.t = 'electrodeSelectionHint';
  hint.style.cssText = 'margin:0 0 12px 0;font-size:.92em;';
  dlg.appendChild(hint);

  var errBox = document.createElement('div');
  errBox.style.cssText = 'color:#c00;font-size:.88em;min-height:1.2em;margin-bottom:6px;';
  dlg.appendChild(errBox);

  var allRow = document.createElement('div');
  allRow.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;';
  var allOnBtn = document.createElement('button');
  allOnBtn.type = 'button';
  allOnBtn.className = 'btn btn-small';
  allOnBtn.dataset.t = 'electrodeSelectionSelectAll';
  var allOffBtn = document.createElement('button');
  allOffBtn.type = 'button';
  allOffBtn.className = 'btn btn-small';
  allOffBtn.dataset.t = 'electrodeSelectionDeselectAll';
  allRow.append(allOnBtn, allOffBtn);
  dlg.appendChild(allRow);

  var stat = cfg.getElectrodeStatus();
  var allIndices = [].concat(stat.testable, stat.muted, stat.excluded)
    .sort(function(a, b) { return a - b; });
  var cur = cfg.getSelection();
  var selSet;
  if (cur == null) selSet = new Set(stat.testable);
  else selSet = new Set(cur.filter(function(i) { return stat.testable.indexOf(i) >= 0; }));

  var nTotal = allIndices.length;
  var perCol = Math.ceil(nTotal / 2);
  var list = document.createElement('div');
  list.style.cssText =
    'display:grid;' +
    'grid-template-columns:1fr 1fr;' +
    'grid-template-rows:repeat(' + perCol + ', auto);' +
    'grid-auto-flow:column;' +
    'gap:4px 18px;' +
    'margin-bottom:14px;';
  var cbRefs = {};
  var mutedSuf  = (typeof t === 'function' && t('electrodeSelectionMutedSuffix'))      || 'stumm';
  var exclSuf   = (typeof t === 'function' && t('electrodeSelectionExcludedSuffix'))   || 'ausgeschlossen';
  var mutedSet = new Set(stat.muted);
  var exclSet  = new Set(stat.excluded);

  allIndices.forEach(function(i) {
    var lbl = document.createElement('label');
    var disabled = mutedSet.has(i) || exclSet.has(i);
    lbl.style.cssText =
      'display:flex;align-items:center;gap:6px;font-size:.92em;' +
      (disabled ? 'opacity:.45;cursor:not-allowed;' : 'cursor:pointer;');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = String(i);
    cb.checked = !disabled && selSet.has(i);
    cb.disabled = disabled;
    cbRefs[i] = cb;
    var sp = document.createElement('span');
    var baseTxt = cfg.electrodeLabel(i);
    if (mutedSet.has(i))     baseTxt += ' (' + mutedSuf + ')';
    else if (exclSet.has(i)) baseTxt += ' (' + exclSuf + ')';
    sp.textContent = baseTxt;
    lbl.append(cb, sp);
    list.appendChild(lbl);
  });
  dlg.appendChild(list);

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
  var cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn';
  cancelBtn.dataset.t = 'electrodeSelectionCancel';
  var confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.dataset.t = 'electrodeSelectionConfirm';
  btnRow.append(cancelBtn, confirmBtn);
  dlg.appendChild(btnRow);

  overlay.appendChild(dlg);
  document.body.appendChild(overlay);
  if (typeof applyLang === 'function') applyLang();

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }
  cancelBtn.addEventListener('click', close);

  allOnBtn.addEventListener('click', function() {
    stat.testable.forEach(function(i) { if (cbRefs[i]) cbRefs[i].checked = true; });
    errBox.textContent = '';
  });
  allOffBtn.addEventListener('click', function() {
    stat.testable.forEach(function(i) { if (cbRefs[i]) cbRefs[i].checked = false; });
  });

  confirmBtn.addEventListener('click', function() {
    var chosen = [];
    stat.testable.forEach(function(i) {
      if (cbRefs[i] && cbRefs[i].checked) chosen.push(i);
    });
    var minN = cfg.minSelected || 1;
    if (chosen.length < minN) {
      var tpl = (typeof t === 'function' && t('electrodeSelectionMinError'))
        || 'Mindestens {n} Elektrode(n) auswählen';
      errBox.textContent = tpl.replace('{n}', minN);
      return;
    }
    cfg.setSelection(chosen);
    if (typeof onChange === 'function') onChange();
    close();
  });
}

// ===== testUI.sideCheck — Seitenhörtest =====
(function() {
  var _shtEls     = null;
  var _shtCfg     = null;
  var _shtSuccess = null;
  var _shtAbort   = null;
  var _shtResult  = {};
  var _shtAskSide = null;

  // BA 276: Drei Breitband-Burst-Stufen, wiederverwendet aus dem
  // Latenztest (LTZ_buildBurstBuffer). hz/durMs exakt wie die dortigen
  // Klangtypen burst500 / burst1500 / burst4000 (js/latency.js Z. 91-93).
  var _SHT_BANDS = {
    low:  { hz: 500,  durMs: 6 },
    mid:  { hz: 1500, durMs: 4 },
    high: { hz: 4000, durMs: 3 }
  };
  // Tonfolge: 5 Bursts im 200-ms-Takt (rund 1 s), damit der kurze Burst
  // sicher hör- und ortbar ist.
  var _SHT_TRAIN_COUNT = 5;
  var _SHT_TRAIN_INTERVAL_S = 0.20;
  // Gain gegen Clipping: ein StereoPanner summiert bei hartem Pan (pan=-1
  // bzw. +1) BEIDE Buffer-Kanäle auf eine Seite. Der Burst-Buffer hat L=R
  // mit Amplitude 0.9 -> ohne Dämpfung läge die Spitze bei 1.8 und würde
  // clippen. 0.4 hält die Summe sicher unter 1.0.
  var _SHT_GAIN = 0.4;

  // BA 276: gewählte Stufe, persistent in localStorage ("ci-lb-shtBand").
  // Default "low" (Tief).
  var _shtBand = 'low';
  function _shtLoadBand() {
    try {
      var v = localStorage.getItem('ci-lb-shtBand');
      if (v === 'low' || v === 'mid' || v === 'high') _shtBand = v;
    } catch (e) { /* localStorage kann fehlen — Default behalten */ }
  }
  function _shtSetBand(band) {
    if (band !== 'low' && band !== 'mid' && band !== 'high') return;
    _shtBand = band;
    try {
      localStorage.setItem('ci-lb-shtBand', band);
    } catch (e) { /* ignorieren */ }
  }
  _shtLoadBand();

  var _shtIdleTimer   = null;
  var _shtIdleEl      = null;
  var _shtIdleMs      = 0;
  var _shtIdleCb      = null;
  var _shtIdleHandler = null;

  function _shtT(key) {
    return (typeof t === 'function' && t(key)) || key;
  }

  function _shtInitDom() {
    if (_shtEls) return;
    var overlay  = _mkEl('div', 'modal-overlay sht-modal');
    var box      = _mkEl('div', 'modal-box');
    var titleEl  = _mkEl('h2');
    titleEl.dataset.t   = 'shtTitle';
    titleEl.textContent = _shtT('shtTitle');
    var msgEl    = _mkEl('p');

    // BA 276: Tonhöhen-Wahl (Tief / Mittel / Hoch). Aktiver Knopf
    // bekommt zusätzlich die Klasse 'btn-primary'.
    var bandRow = _mkEl('div', 'btn-group sht-band-row');
    var bandLbl = _mkEl('span');
    bandLbl.dataset.t   = 'shtBandLabel';
    bandLbl.textContent = _shtT('shtBandLabel');
    bandLbl.style.marginRight = '0.5em';
    var bandBtnLow  = _mkEl('button', 'btn'); bandBtnLow.dataset.t  = 'shtBandLow';  bandBtnLow.textContent  = _shtT('shtBandLow');
    var bandBtnMid  = _mkEl('button', 'btn'); bandBtnMid.dataset.t  = 'shtBandMid';  bandBtnMid.textContent  = _shtT('shtBandMid');
    var bandBtnHigh = _mkEl('button', 'btn'); bandBtnHigh.dataset.t = 'shtBandHigh'; bandBtnHigh.textContent = _shtT('shtBandHigh');
    bandRow.append(bandLbl, bandBtnLow, bandBtnMid, bandBtnHigh);

    function _shtRefreshBandBtns() {
      bandBtnLow.className  = 'btn' + (_shtBand === 'low'  ? ' btn-primary' : '');
      bandBtnMid.className  = 'btn' + (_shtBand === 'mid'  ? ' btn-primary' : '');
      bandBtnHigh.className = 'btn' + (_shtBand === 'high' ? ' btn-primary' : '');
    }
    _shtRefreshBandBtns();

    function _shtPickBand(band) {
      _shtSetBand(band);
      _shtRefreshBandBtns();
      // Sofort zur Probe abspielen, mit der gerade geprüften Seite.
      _shtPlayTone(_shtAskSide);
    }
    bandBtnLow.onclick  = function() { _shtPickBand('low');  };
    bandBtnMid.onclick  = function() { _shtPickBand('mid');  };
    bandBtnHigh.onclick = function() { _shtPickBand('high'); };

    var replayRow = _mkEl('div', 'btn-group');
    var replayBtn = _mkEl('button', 'btn');
    replayBtn.dataset.t   = 'shtBtnReplay';
    replayBtn.textContent = _shtT('shtBtnReplay');
    replayRow.appendChild(replayBtn);

    var ansRow = _mkEl('div', 'btn-group');
    var btnL = _mkEl('button', 'btn'); btnL.dataset.t = 'shtBtnLeft';  btnL.textContent = _shtT('shtBtnLeft');
    var btnR = _mkEl('button', 'btn'); btnR.dataset.t = 'shtBtnRight'; btnR.textContent = _shtT('shtBtnRight');
    var btnB = _mkEl('button', 'btn'); btnB.dataset.t = 'shtBtnBoth';  btnB.textContent = _shtT('shtBtnBoth');
    var btnN = _mkEl('button', 'btn'); btnN.dataset.t = 'shtBtnNone';  btnN.textContent = _shtT('shtBtnNone');
    ansRow.append(btnL, btnR, btnB, btnN);

    var phaseBtns = _mkEl('div', 'sht-phase-btns');
    phaseBtns.style.marginTop = '0.8em';
    phaseBtns.append(bandRow, replayRow, ansRow);

    var errBtns = _mkEl('div', 'sht-err-btns');
    errBtns.hidden = true;
    errBtns.style.marginTop = '0.8em';
    var errRow = _mkEl('div', 'btn-group');
    var retryBtn = _mkEl('button', 'btn btn-primary');
    retryBtn.dataset.t   = 'shtBtnRetry';
    retryBtn.textContent = _shtT('shtBtnRetry');
    var abortBtn = _mkEl('button', 'btn');
    abortBtn.dataset.t   = 'shtBtnAbort';
    abortBtn.textContent = _shtT('shtBtnAbort');
    errRow.append(retryBtn, abortBtn);
    errBtns.appendChild(errRow);

    box.append(titleEl, msgEl, phaseBtns, errBtns);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    _shtEls = { overlay: overlay, msgEl: msgEl, replayBtn: replayBtn,
                phaseBtns: phaseBtns, errBtns: errBtns,
                retryBtn: retryBtn, abortBtn: abortBtn };

    btnL.onclick      = function() { _shtAnswer('left');  };
    btnR.onclick      = function() { _shtAnswer('right'); };
    btnB.onclick      = function() { _shtAnswer('both');  };
    btnN.onclick      = function() { _shtAnswer('none');  };
    replayBtn.onclick = function() { _shtPlayTone(_shtAskSide); };
    retryBtn.onclick  = function() { _shtRetry(); };
    abortBtn.onclick  = function() { _shtDoAbort(); };
  }

  function _shtPlayTone(side) {
    var c = (typeof gAC === 'function') ? gAC() : null;
    if (!c) return;
    if (typeof LTZ_buildBurstBuffer !== 'function') return;
    var band = _SHT_BANDS[_shtBand] || _SHT_BANDS.low;
    var buf = LTZ_buildBurstBuffer(c, band.hz, band.durMs);
    var pan = (side === 'left') ? -1 : 1;
    var t0 = c.currentTime + 0.02;
    for (var i = 0; i < _SHT_TRAIN_COUNT; i++) {
      var src = c.createBufferSource();
      src.buffer = buf;
      var g = c.createGain();
      g.gain.value = _SHT_GAIN;
      var p = c.createStereoPanner();
      p.pan.value = pan;
      src.connect(g);
      g.connect(p);
      p.connect(c.destination);
      try { src.start(t0 + i * _SHT_TRAIN_INTERVAL_S); } catch (e) { /* swallow */ }
    }
  }

  function _shtAsk(side) {
    _shtAskSide = side;
    var key = 'shtMsgOne';
    _shtEls.msgEl.textContent = _shtT(key);
    _shtEls.phaseBtns.hidden  = false;
    _shtEls.errBtns.hidden    = true;
    _shtPlayTone(side);
  }

  function _shtAnswer(answer) {
    _shtResult[_shtAskSide] = answer;
    if (_shtCfg.sides === 'both' && _shtAskSide === 'left') {
      _shtAsk('right');
    } else {
      _shtEval();
    }
  }

  function _shtEval() {
    var L = _shtResult.left;
    var R = _shtResult.right;
    var msg = '';
    var syms = [];

    if (_shtCfg.sides === 'one') {
      var ans = (_shtCfg.side === 'left') ? L : R;
      if (ans === _shtCfg.side)              { _shtSucceed(); return; }
      if (ans === 'left' || ans === 'right')   msg = _shtT('shtErrFlip');
      else if (ans === 'both')                 msg = _shtT('shtErrBilateral');
      else                                     msg = _shtT('shtErrNone');
    } else {
      if (L === 'left' && R === 'right')     { _shtSucceed(); return; }
      if (L === 'none' || R === 'none') {
        if (L === 'none' && R === 'none') {
          msg = _shtT('shtErrNone');
        } else {
          msg = _shtT('shtErrMissing');
          if (L === 'none') syms.push(_shtT('shtSymLeftNone'));
          if (R === 'none') syms.push(_shtT('shtSymRightNone'));
        }
      } else if (L === 'both' && R === 'both') {
        msg = _shtT('shtErrBilateral');
      } else if ((L === 'left'  && R === 'left') ||
                 (L === 'right' && R === 'right')) {
        msg = _shtT('shtErrAudiolink');
      } else if (L === 'right' && R === 'left') {
        msg = _shtT('shtErrFlip');
      } else {
        msg = _shtT('shtErrMixed');
        if (L === 'none')  syms.push(_shtT('shtSymLeftNone'));
        if (R === 'none')  syms.push(_shtT('shtSymRightNone'));
        if (L === 'both')  syms.push(_shtT('shtSymLeftBoth'));
        if (R === 'both')  syms.push(_shtT('shtSymRightBoth'));
        if (L === 'right') syms.push(_shtT('shtSymLeftWrong'));
        if (R === 'left')  syms.push(_shtT('shtSymRightWrong'));
      }
    }
    if (syms.length) msg += ' ' + syms.join(', ') + '.';
    _shtEls.msgEl.textContent = msg;
    _shtEls.phaseBtns.hidden  = true;
    _shtEls.errBtns.hidden    = false;
  }

  function _shtSucceed() {
    _shtEls.overlay.classList.remove('active');
    var cb = _shtSuccess;
    _shtSuccess = null; _shtAbort = null;
    if (cb) cb();
  }

  function _shtDoAbort() {
    _shtEls.overlay.classList.remove('active');
    var cb = _shtAbort;
    _shtSuccess = null; _shtAbort = null;
    if (cb) cb();
  }

  function _shtRetry() {
    _shtResult = {};
    _shtAsk((_shtCfg.sides === 'one') ? _shtCfg.side : 'left');
  }

  function _shtRun(cfg, onSuccess, onAbort) {
    _shtInitDom();
    _shtCfg     = cfg;
    _shtSuccess = onSuccess;
    _shtAbort   = onAbort;
    _shtResult  = {};
    _shtEls.overlay.classList.add('active');
    _shtAsk(cfg.sides === 'one' ? cfg.side : 'left');
  }

  function _shtResetTimer() {
    if (_shtIdleTimer) clearTimeout(_shtIdleTimer);
    _shtIdleTimer = setTimeout(function() {
      var cb = _shtIdleCb;
      if (cb) cb();
    }, _shtIdleMs);
  }

  function _shtStartIdleWatch(el, ms, onIdle) {
    _shtStopIdleWatch();
    // el wird nicht mehr für Event-Registrierung benutzt: keydown auf body
    // (Replay per Leertaste ohne Fokus im Panel) erreicht ein Capture-Listener
    // auf einem Sub-Element nicht. Reset-Handler hängen daher auf document.
    _shtIdleEl      = el;
    _shtIdleMs      = ms;
    _shtIdleCb      = onIdle;
    _shtIdleHandler = function() { _shtResetTimer(); };
    document.addEventListener('pointerdown', _shtIdleHandler, true);
    document.addEventListener('keydown',     _shtIdleHandler, true);
    document.addEventListener('click',       _shtIdleHandler, true);
    _shtResetTimer();
  }

  function _shtStopIdleWatch() {
    if (_shtIdleTimer) { clearTimeout(_shtIdleTimer); _shtIdleTimer = null; }
    if (_shtIdleHandler) {
      document.removeEventListener('pointerdown', _shtIdleHandler, true);
      document.removeEventListener('keydown',     _shtIdleHandler, true);
      document.removeEventListener('click',       _shtIdleHandler, true);
    }
    _shtIdleEl = null; _shtIdleHandler = null; _shtIdleCb = null;
  }

  testUI.sideCheck = {
    run:            _shtRun,
    startIdleWatch: _shtStartIdleWatch,
    stopIdleWatch:  _shtStopIdleWatch
  };
})();

// ===== testUI.completion — Abschluss-Box nach natuerlichem Testende =====
// BA 279: Wiederverwendbarer Testende-Hinweis. EINE Funktion; das
// Gemeinsame ist fest verdrahtet (Klang, Titelmuster, generischer
// Ergebnis-Satz), pro Aufruf werden nur die individuellen i18n-Keys
// uebergeben: nameKey (Verfahrensname), subtabKey (Messerg.-Subreiter),
// bodyKey (Zusatztext).
// Aufbau:  Titel   = testDoneTitle, {name}  ersetzt
//          Zeile 1 = testDoneResultHint, {subtab} ersetzt
//          Zeile 2 = bodyKey
// Die Textzeilen werden bei show() direkt gesetzt (Platzhalter ersetzt)
// und tragen KEIN data-t, sonst wuerde applyLang den Platzhalter-Ersatz
// ueberschreiben. Die Box ist transient; Sprachwechsel bei offener Box
// ist ein vernachlaessigbarer Edge-Case. Einblenden via 'modal-overlay'
// + '.active' wie testUI.sideCheck.
(function() {
  var _CMP_SOUND = 'assets/audio/810330__mokasza__triumphant-success.mp3';
  var _cmpEls    = null;
  var _cmpAudio  = null;

  function _cmpT(key) {
    return (typeof t === 'function' && t(key)) || key;
  }

  function _cmpInitDom() {
    if (_cmpEls) return;
    var overlay  = _mkEl('div', 'modal-overlay completion-modal');
    var box      = _mkEl('div', 'modal-box');
    var titleEl  = _mkEl('h2');
    var resultEl = _mkEl('p');
    var bodyEl   = _mkEl('p');
    var btnRow   = _mkEl('div', 'btn-group');
    var okBtn    = _mkEl('button', 'btn btn-primary');
    okBtn.dataset.t   = 'compBtnOk';
    okBtn.textContent = _cmpT('compBtnOk');
    btnRow.appendChild(okBtn);
    box.append(titleEl, resultEl, bodyEl, btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    _cmpEls = { overlay: overlay, titleEl: titleEl, resultEl: resultEl,
                bodyEl: bodyEl, okBtn: okBtn };
    okBtn.onclick = function() { _cmpClose(); };
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) _cmpClose();   // Klick auf dunklen Rand
    });
  }

  function _cmpClose() {
    if (!_cmpEls) return;
    _cmpEls.overlay.classList.remove('active');
    if (_cmpAudio) {
      try { _cmpAudio.pause(); } catch (e) { /* ignorieren */ }
      _cmpAudio = null;
    }
  }

  // opts: { nameKey, subtabKey, bodyKey }  — alle drei i18n-Keys, Pflicht.
  function _cmpShow(opts) {
    opts = opts || {};
    _cmpInitDom();

    var name = _cmpT(opts.nameKey);
    _cmpEls.titleEl.textContent =
      _cmpT('testDoneTitle').replace('{name}', name);

    var sub = _cmpT(opts.subtabKey);
    _cmpEls.resultEl.textContent =
      _cmpT('testDoneResultHint').replace('{subtab}', sub);

    _cmpEls.bodyEl.textContent = _cmpT(opts.bodyKey);

    _cmpEls.overlay.classList.add('active');
    if (typeof safeFocus === 'function') safeFocus(_cmpEls.okBtn);
    else _cmpEls.okBtn.focus();

    try {
      _cmpAudio = new Audio(_CMP_SOUND);
      var pr = _cmpAudio.play();   // Promise; bei blockiertem Autoplay still abfangen
      if (pr && typeof pr.catch === 'function') {
        pr.catch(function() { /* Autoplay evtl. blockiert — Box bleibt sichtbar */ });
      }
    } catch (e) { /* Audio nicht verfuegbar — Box bleibt stumm */ }
  }

  testUI.completion = { show: _cmpShow, close: _cmpClose };
})();
