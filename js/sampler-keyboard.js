// ============================================================
// SAMPLER-KEYBOARD — Klavier-Widget fuer die Tonart-Modalbox
// ============================================================
// Rendert ein einfaches Klavier mit Tastenanzahl = Anzahl der
// uebergebenen Elektroden-Frequenzen. Jede weisse Taste ist mit
// einer Elektroden-Beschriftung (z. B. Nummer) versehen und spielt
// beim Anschlag die ihr zugeordnete Frequenz. Zwischen je zwei
// weissen Tasten sitzt eine schwarze Zier-Taste auf dem
// geometrischen Mittel der Nachbarfrequenzen — sie spielt diese
// Mittelfrequenz, ist aber keiner Elektrode zugeordnet.
//
// Anschlag-Verhalten: Burst (nicht Hold). Beim mousedown / touchstart
// wird `opts.onKeyPress(electrodeIdx, hz, durationMs)` aufgerufen.
// Der Aufrufer entscheidet, wie der Ton genau gespielt wird (welche
// Seite, mit welcher Tonart, welche Pause zwischen Var/Ref).
// Schwarze Zier-Tasten rufen mit `electrodeIdx = -1` auf.
//
// Bei smplr-Tonart die noch nicht geladen ist: Tasten klingen stumm,
// Hinweistext "Laedt ..." wird eingeblendet, Lade-Trigger laeuft im
// Hintergrund. Sobald geladen: Hinweis verschwindet, kuenftige
// Anschlaege klingen.
//
// Exportiert ins globale Scope:
//   renderSamplerKeyboard(container, opts)

function renderSamplerKeyboard(container, opts) {
  if (!container || !opts) return;
  var freqs  = (typeof opts.getElectrodeFreqs  === 'function') ? opts.getElectrodeFreqs()  : [];
  var labels = (typeof opts.getElectrodeLabels === 'function') ? opts.getElectrodeLabels() : [];
  if (!Array.isArray(freqs) || freqs.length === 0) return;

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
    _bindKey(key, i, hz);
    row.appendChild(key);
  });

  // Schwarze Zier-Tasten (n-1 Stueck, eine zwischen jedem weissen Paar)
  // Position: zentriert auf der Grenze zwischen weissen Taste i und i+1.
  var whiteWidthPct = 100 / freqs.length;
  for (var i = 0; i < freqs.length - 1; i++) {
    var hzBlack = Math.sqrt(freqs[i] * freqs[i + 1]);
    var leftPct = (i + 1) * whiteWidthPct - whiteWidthPct / 4;  // 1/4 nach links
    var widthPct = whiteWidthPct / 2;
    var black = document.createElement('div');
    black.className = 'kb-key kb-black';
    black.style.cssText = 'position:absolute;top:0;'
      + 'left:' + leftPct.toFixed(3) + '%;'
      + 'width:' + widthPct.toFixed(3) + '%;'
      + 'height:60%;background:#222;border:1px solid #000;'
      + 'border-radius:0 0 3px 3px;cursor:pointer;';
    black.dataset.electrodeIdx = '-1';
    black.dataset.hz = String(hzBlack);
    _bindKey(black, -1, hzBlack);
    row.appendChild(black);
  }

  wrap.appendChild(row);
  container.appendChild(wrap);

  function _bindKey(el, idx, hz) {
    function press(ev) {
      ev.preventDefault();
      _highlight(el);
      _onPress(idx, hz);
    }
    el.addEventListener('mousedown', press);
    el.addEventListener('touchstart', press, { passive: false });
  }

  function _highlight(el) {
    var orig = el.style.background;
    el.style.background = (el.classList.contains('kb-black')) ? '#666' : '#ffe98b';
    setTimeout(function () { el.style.background = orig; }, 120);
  }

  function _onPress(idx, hz) {
    var toneType = (typeof opts.getCurrentToneType === 'function')
      ? opts.getCurrentToneType() : '';
    // smplr-Tonart die noch nicht geladen ist: stumm + Lade-Trigger + Hinweis
    if (typeof toneType === 'string'
        && toneType.indexOf('smplr:') === 0
        && typeof smplrSamplerIsReady === 'function'
        && !smplrSamplerIsReady(toneType)) {
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
      return;
    }
    // Normal: an Aufrufer delegieren
    var dur = (typeof opts.getDuration === 'function') ? opts.getDuration() : 1000;
    if (typeof opts.onKeyPress === 'function') {
      try { opts.onKeyPress(idx, hz, dur); } catch (e) { /* swallow */ }
    }
  }
}
