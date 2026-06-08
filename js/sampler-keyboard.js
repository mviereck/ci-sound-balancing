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
    whiteKeys[i] = key;
    _bindKey(key, i, hz);
    row.appendChild(key);
  });

  // Schwarze Zier-Tasten (n-1 Stueck, eine zwischen jedem weissen Paar)
  var whiteWidthPct = 100 / freqs.length;
  for (var i = 0; i < freqs.length - 1; i++) {
    var hzBlack = Math.sqrt(freqs[i] * freqs[i + 1]);
    var leftPct = (i + 1) * whiteWidthPct - whiteWidthPct / 4;
    var widthPct = whiteWidthPct / 2;
    var black = document.createElement('div');
    black.className = 'kb-key kb-black';
    black.style.cssText = 'position:absolute;top:0;'
      + 'left:' + leftPct.toFixed(3) + '%;'
      + 'width:' + widthPct.toFixed(3) + '%;'
      + 'height:60%;background:#222;border:1px solid #000;'
      + 'border-radius:0 0 3px 3px;cursor:pointer;';
    black.dataset.electrodeIdx = '-1';
    black.dataset.blackIdx     = String(i);
    black.dataset.hz           = String(hzBlack);
    blackKeys[i] = black;
    _bindKey(black, -1, hzBlack);
    row.appendChild(black);
  }

  wrap.appendChild(row);
  container.appendChild(wrap);

  // ---- Hilfsfunktionen ------------------------------------------------

  // Liefert das Tasten-Bundle, das beim Anschlag aufleuchten soll.
  // Schwarze Taste: sich selbst + beide weisse Nachbarn (sofern vorhanden).
  // Weisse Taste: nur sich selbst.
  function _keysToHighlight(el) {
    if (el.classList.contains('kb-white')) return [el];
    var bIdx = parseInt(el.dataset.blackIdx, 10);
    var arr = [el];
    if (whiteKeys[bIdx]     != null) arr.push(whiteKeys[bIdx]);
    if (whiteKeys[bIdx + 1] != null) arr.push(whiteKeys[bIdx + 1]);
    return arr;
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
