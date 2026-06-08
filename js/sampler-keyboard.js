// ============================================================
// SAMPLER-KEYBOARD — Klavier-Widget fuer die Tonart-Modalbox
// ============================================================
// Rendert ein einfaches Klavier mit einer weissen Taste pro
// uebergebener Elektroden-Frequenz. Jede weisse Taste ist mit
// einer Aufrufer-gelieferten Beschriftung versehen (z. B. "E1").
// Zwischen je zwei weissen Tasten sitzt eine schwarze Zier-Taste
// auf dem geometrischen Mittel der Nachbarfrequenzen.
//
// Zwei Modi, implizit aus den Callbacks abgeleitet:
//
//   Burst-Modus (Default):
//     opts.onPress(idx, hz)       -> Aufrufer spielt selbst
//     opts.getHighlightMs() -> ms -> Aufleucht-Dauer pro Anschlag
//
//   Hold-Modus (wenn onRelease vorhanden):
//     opts.onPress(idx, hz)       -> Pointerdown
//     opts.onRelease(idx, hz)     -> Pointerup/cancel/leave
//
// Schwarze Zier-Tasten rufen mit electrodeIdx = -1 auf und
// leuchten zusammen mit ihren beiden weissen Nachbarn auf,
// solange der Anschlag aktiv ist.
//
// Bei smplr-Tonart die noch nicht geladen ist: Anschlag bleibt
// stumm, Hinweistext "Laedt ..." wird eingeblendet, Lade-Trigger
// laeuft im Hintergrund. Es wird weder onPress noch onRelease
// gerufen.
//
// Exportiert ins globale Scope:
//   renderSamplerKeyboard(container, opts)

function renderSamplerKeyboard(container, opts) {
  if (!container || !opts) return;
  var freqs  = (typeof opts.getElectrodeFreqs  === 'function') ? opts.getElectrodeFreqs()  : [];
  var labels = (typeof opts.getElectrodeLabels === 'function') ? opts.getElectrodeLabels() : [];
  if (!Array.isArray(freqs) || freqs.length === 0) return;

  // BA 241: Indizes der deaktivierten / ausgeschlossenen weissen Tasten.
  var disabledRaw = (typeof opts.getDisabledElectrodes === 'function')
    ? opts.getDisabledElectrodes() : [];
  var disabledSet = new Set(Array.isArray(disabledRaw) ? disabledRaw : []);

  var isHold = (typeof opts.onRelease === 'function');

  // Aussen-Wrap
  var wrap = document.createElement('div');
  wrap.className = 'sampler-keyboard';
  wrap.style.cssText = 'margin:6px 0 12px 0;';

  // Lade-Hinweis ueber dem Klavier
  var loadHint = document.createElement('div');
  loadHint.className = 'sampler-keyboard-loadhint';
  loadHint.dataset.t = 'samplerKeyboardLoading';
  loadHint.style.cssText = 'display:none;text-align:center;font-size:.9em;'
    + 'color:#d8a200;padding:2px 0 4px 0;font-style:italic;';
  loadHint.textContent = 'Laedt ...';   // wird durch applyLang ueberschrieben
  wrap.appendChild(loadHint);

  // Klavier-Reihe (relative, damit schwarze Tasten absolut positioniert werden koennen)
  var row = document.createElement('div');
  row.style.cssText = 'position:relative;display:flex;height:80px;'
    + 'border:1px solid #444;border-radius:4px;overflow:hidden;'
    + 'user-select:none;-webkit-user-select:none;touch-action:none;';

  // Tasten-Referenzen sammeln, damit das Nachbar-Highlight beim
  // schwarzen Anschlag ohne DOM-Selector auskommt.
  var whiteKeys = [];                                // index = electrodeIdx
  var blackKeys = new Array(freqs.length - 1);       // index = 0..n-2

  // Weisse Tasten
  freqs.forEach(function(hz, i) {
    var key = document.createElement('div');
    key.className = 'kb-key kb-white';
    key.style.cssText = 'flex:1;border-right:1px solid #888;background:#fff;'
      + 'cursor:pointer;position:relative;display:flex;align-items:flex-end;'
      + 'justify-content:center;padding-bottom:4px;font-size:.78em;color:#333;';
    key.textContent = labels[i] != null ? String(labels[i]) : String(i + 1);
    key.dataset.electrodeIdx = String(i);
    key.dataset.hz = String(hz);
    if (disabledSet.has(i)) {
      key.classList.add('kb-key--disabled');
      key.style.background = '#d1d5db';
      key.style.color      = '#6b7280';
      key.style.cursor     = 'not-allowed';
      var xOv = document.createElement('span');
      xOv.style.cssText = 'position:absolute;inset:0;pointer-events:none;'
        + 'background-image:linear-gradient(to top right, transparent calc(50% - 1px), '
        + '#4b5563 calc(50% - 1px), #4b5563 calc(50% + 1px), transparent calc(50% + 1px)),'
        + 'linear-gradient(to top left, transparent calc(50% - 1px), '
        + '#4b5563 calc(50% - 1px), #4b5563 calc(50% + 1px), transparent calc(50% + 1px));';
      key.appendChild(xOv);
    }
    whiteKeys[i] = key;
    if (!disabledSet.has(i)) {
      _bindKey(key, i, hz);
    }
    row.appendChild(key);
  });

  // BA 241: Schwarze Tasten mit Gruppen-Logik.
  var whiteWidthPct = 100 / freqs.length;
  var blackGroups = {};  // key "left:right" -> { blackEls: [], leftAnchor, rightAnchor }

  for (var bi = 0; bi < freqs.length - 1; bi++) {
    var leftAnchor  = bi;
    while (leftAnchor >= 0 && disabledSet.has(leftAnchor))   leftAnchor--;
    var rightAnchor = bi + 1;
    while (rightAnchor < freqs.length && disabledSet.has(rightAnchor)) rightAnchor++;

    var leftPct  = (bi + 1) * whiteWidthPct - whiteWidthPct / 4;
    var widthPct = whiteWidthPct / 2;
    var black    = document.createElement('div');
    black.className = 'kb-key kb-black';
    black.style.cssText = 'position:absolute;top:0;'
      + 'left:' + leftPct.toFixed(3) + '%;'
      + 'width:' + widthPct.toFixed(3) + '%;'
      + 'height:60%;background:#222;border:1px solid #000;'
      + 'border-radius:0 0 3px 3px;cursor:pointer;';
    black.dataset.electrodeIdx = '-1';
    black.dataset.blackIdx     = String(bi);
    blackKeys[bi] = black;

    var noAnchor = (leftAnchor < 0) || (rightAnchor >= freqs.length);
    if (noAnchor) {
      black.classList.add('kb-key--disabled');
      black.style.background = '#9ca3af';
      black.style.cursor     = 'not-allowed';
      var xOvB = document.createElement('span');
      xOvB.style.cssText = 'position:absolute;inset:0;pointer-events:none;'
        + 'background-image:linear-gradient(to top right, transparent calc(50% - 1px), '
        + '#1f2937 calc(50% - 1px), #1f2937 calc(50% + 1px), transparent calc(50% + 1px)),'
        + 'linear-gradient(to top left, transparent calc(50% - 1px), '
        + '#1f2937 calc(50% - 1px), #1f2937 calc(50% + 1px), transparent calc(50% + 1px));';
      black.appendChild(xOvB);
      black.dataset.hz = '0';
      row.appendChild(black);
      continue;
    }

    var hzBlack = Math.sqrt(freqs[leftAnchor] * freqs[rightAnchor]);
    black.dataset.hz = String(hzBlack);

    var grpKey = leftAnchor + ':' + rightAnchor;
    if (!blackGroups[grpKey]) {
      blackGroups[grpKey] = { blackEls: [], leftAnchor: leftAnchor, rightAnchor: rightAnchor };
    }
    blackGroups[grpKey].blackEls.push(black);
    black.dataset.grpKey = grpKey;

    _bindKey(black, -1, hzBlack);
    row.appendChild(black);
  }

  // BA 241: Verbindungs-Balken fuer Gruppen mit >= 2 schwarzen Tasten.
  Object.keys(blackGroups).forEach(function(grpKey) {
    var grp = blackGroups[grpKey];
    if (grp.blackEls.length < 2) return;
    var firstStyle = grp.blackEls[0].style;
    var lastStyle  = grp.blackEls[grp.blackEls.length - 1].style;
    var firstLeft  = parseFloat(firstStyle.left);
    var firstWidth = parseFloat(firstStyle.width);
    var lastLeft   = parseFloat(lastStyle.left);
    var lastWidth  = parseFloat(lastStyle.width);
    var barLeftPct  = firstLeft + firstWidth / 2;
    var barRightPct = lastLeft  + lastWidth  / 2;
    var bar = document.createElement('div');
    bar.className = 'kb-bar';
    bar.dataset.grpKey = grpKey;
    bar.style.cssText = 'position:absolute;top:25%;height:15px;'
      + 'left:'  + barLeftPct.toFixed(3) + '%;'
      + 'width:' + (barRightPct - barLeftPct).toFixed(3) + '%;'
      + 'background:#222;border-top:1px solid #000;border-bottom:1px solid #000;'
      + 'pointer-events:none;';
    grp.barEl = bar;
    row.appendChild(bar);
  });

  wrap.appendChild(row);
  container.appendChild(wrap);

  // BA 241: Externes Highlight-Handle fuer Sweep.
  return {
    highlightElectrode: function(idx, on) {
      var k = whiteKeys[idx];
      if (!k) return;
      if (on) _highlightOn([k]);
      else    _highlightOff([k]);
    }
  };

  // ---- Hilfsfunktionen ------------------------------------------------

  // BA 241: Tasten-Bundle fuer Highlight.
  function _keysToHighlight(el) {
    if (el.classList.contains('kb-white')) return [el];
    var grpKey = el.dataset.grpKey;
    if (grpKey && blackGroups[grpKey]) {
      var grp = blackGroups[grpKey];
      var arr = grp.blackEls.slice();
      if (grp.barEl) arr.push(grp.barEl);
      if (whiteKeys[grp.leftAnchor]  != null) arr.push(whiteKeys[grp.leftAnchor]);
      if (whiteKeys[grp.rightAnchor] != null) arr.push(whiteKeys[grp.rightAnchor]);
      return arr;
    }
    // Fallback fuer schwarze Tasten ohne Gruppen-Daten.
    var bIdx = parseInt(el.dataset.blackIdx, 10);
    var arr2 = [el];
    if (whiteKeys[bIdx]     != null) arr2.push(whiteKeys[bIdx]);
    if (whiteKeys[bIdx + 1] != null) arr2.push(whiteKeys[bIdx + 1]);
    return arr2;
  }

  function _highlightOn(els) {
    els.forEach(function(e) {
      if (e._origBg == null) e._origBg = e.style.background || '';
      e.style.background = e.classList.contains('kb-black') ? '#666' : '#ffe98b';
    });
  }
  function _highlightOff(els) {
    els.forEach(function(e) {
      if (e._origBg != null) {
        e.style.background = e._origBg;
        e._origBg = null;
      }
    });
  }

  // Pruefung auf nicht-geladenen smplr-Sampler. Returnwert true =
  // Anschlag bleibt stumm, Aufrufer-Callbacks werden nicht gefeuert.
  function _smplrBlocksPress() {
    var toneType = (typeof opts.getCurrentToneType === 'function')
      ? opts.getCurrentToneType() : '';
    if (typeof toneType !== 'string' || toneType.indexOf('smplr:') !== 0) return false;
    if (typeof smplrSamplerIsReady !== 'function') return false;
    if (smplrSamplerIsReady(toneType)) return false;
    // nicht ready -> Lade-Hinweis + Trigger im Hintergrund
    loadHint.style.display = 'block';
    if (typeof loadSamplerByToken === 'function') {
      var c = (typeof gAC === 'function') ? gAC() : null;
      if (c) {
        loadSamplerByToken(c, toneType).then(function () {
          loadHint.style.display = 'none';
        }).catch(function () {
          loadHint.style.display = 'none';
        });
      }
    }
    return true;
  }

  // ---- Trigger-Bindung pro Taste -------------------------------------

  function _bindKey(el, idx, hz) {
    var hlEls = _keysToHighlight(el);

    if (isHold) {
      var active = false;
      function down(ev) {
        if (active) return;
        ev.preventDefault();
        if (_smplrBlocksPress()) return;
        active = true;
        if (typeof el.setPointerCapture === 'function' && ev.pointerId != null) {
          try { el.setPointerCapture(ev.pointerId); } catch (e) {}
        }
        _highlightOn(hlEls);
        try { opts.onPress(idx, hz); } catch (e) {}
      }
      function up() {
        if (!active) return;
        active = false;
        _highlightOff(hlEls);
        try { opts.onRelease(idx, hz); } catch (e) {}
      }
      el.addEventListener('pointerdown',   down);
      el.addEventListener('pointerup',     up);
      el.addEventListener('pointercancel', up);
      // pointerleave als Sicherheitsnetz, falls setPointerCapture
      // im Browser nicht greift.
      el.addEventListener('pointerleave',  up);
      return;
    }

    // Burst-Modus
    function press(ev) {
      ev.preventDefault();
      if (_smplrBlocksPress()) return;
      var ms = (typeof opts.getHighlightMs === 'function') ? opts.getHighlightMs() : 0;
      _highlightOn(hlEls);
      if (ms > 0) {
        setTimeout(function () { _highlightOff(hlEls); }, ms);
      } else {
        _highlightOff(hlEls);
      }
      try { opts.onPress(idx, hz); } catch (e) {}
    }
    el.addEventListener('pointerdown', press);
  }
}
