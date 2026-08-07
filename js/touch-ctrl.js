// touch-ctrl.js – Touch-Bedienleisten für Slider und Canvas-Stepper.
// Kein State außer pro-Element. Nutzt keine externen Module außer
// `safeFocus` aus mobile.js (optional; fallback eingebaut).

// Long-Press-Konfiguration: initialer Delay, dann Intervall.
var _TC_PRESS_INITIAL_MS = 400;
var _TC_PRESS_REPEAT_MS  = 100;

function attachLongPress(btn, onStep) {
  // onStep wird beim Klick (1x) und bei Long-Press (wiederholt) gerufen.
  var timer = null;
  var interval = null;
  function clear() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (interval) { clearInterval(interval); interval = null; }
  }
  function start(ev) {
    ev.preventDefault();
    onStep();
    timer = setTimeout(function () {
      interval = setInterval(onStep, _TC_PRESS_REPEAT_MS);
    }, _TC_PRESS_INITIAL_MS);
  }
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', clear);
  btn.addEventListener('pointerleave', clear);
  btn.addEventListener('pointercancel', clear);
}

function buildValueTouchCtrl(adapter, opts) {
  // adapter: { get, set, step, fineStep }
  // opts: { labelMinus, labelPlus, labelFine, replay (Funktion|null),
  //         labelReplay, fineForced (bool, default false) }
  // Liefert eine .touch-ctrl-DOM-Box (Aufrufer haengt sie selbst ein)
  // plus Steuer-API. Kennt keine Grenzen/Bedeutung -- nur den Adapter.
  opts = opts || {};
  var fineMode = false;
  // fineForced: Fein ist dauerhaft an, der Umschalter ist wirkungslos
  // (z.B. Gehoerrichtig/ISO 226). Der Fein-Button wird dann als aktiv
  // dargestellt und nicht umschaltbar.
  var fineForced = !!opts.fineForced;

  function activeStep() {
    return (fineForced || fineMode) ? adapter.fineStep : adapter.step;
  }

  var box = document.createElement('div');
  box.className = 'touch-ctrl';

  function mkBtn(label, cls) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'touch-btn' + (cls ? ' ' + cls : '');
    b.innerHTML = label;
    return b;
  }

  var btnMinus = mkBtn(opts.labelMinus || '−', 'touch-minus');
  var btnPlus  = mkBtn(opts.labelPlus  || '+', 'touch-plus');
  var btnFine  = mkBtn(opts.labelFine  || 'Fein', 'touch-fine');
  btnFine.setAttribute('aria-pressed', fineForced ? 'true' : 'false');
  if (fineForced) {
    btnFine.classList.add('fine-active');
    btnFine.disabled = true;
  }

  function applyDelta(dir) {
    var cur = adapter.get();
    if (typeof cur !== 'number' || !isFinite(cur)) cur = 0;
    adapter.set(+(cur + dir * activeStep()).toFixed(4));
  }

  attachLongPress(btnMinus, function () { applyDelta(-1); });
  attachLongPress(btnPlus,  function () { applyDelta(+1); });

  btnFine.addEventListener('click', function () {
    if (fineForced) return;
    fineMode = !fineMode;
    btnFine.classList.toggle('fine-active', fineMode);
    btnFine.setAttribute('aria-pressed', fineMode ? 'true' : 'false');
  });

  box.appendChild(btnMinus);
  box.appendChild(btnFine);
  box.appendChild(btnPlus);

  if (typeof opts.replay === 'function') {
    var btnRep = mkBtn(opts.labelReplay || '▶ Wdh.', 'touch-replay');
    btnRep.addEventListener('click', function (ev) {
      ev.preventDefault();
      opts.replay();
    });
    box.appendChild(btnRep);
  }

  return {
    box: box,
    btnMinus: btnMinus,
    btnPlus: btnPlus,
    btnFine: btnFine,
    isFine: function () { return fineForced || fineMode; },
    setFine: function (on) {
      if (fineForced) return;
      fineMode = !!on;
      btnFine.classList.toggle('fine-active', fineMode);
      btnFine.setAttribute('aria-pressed', fineMode ? 'true' : 'false');
    }
  };
}

function buildSliderTouchCtrl(slider, opts) {
  // Duenner Wrapper: erzeugt einen Slider-Adapter und delegiert an
  // buildValueTouchCtrl. Verhalten unveraendert gegenueber frueher.
  // opts: { step, fineStep, replay, labelMinus, labelPlus, labelFine,
  //         labelReplay, dispatchInput (bool, default true) }
  if (!slider) return null;
  var dispatch = opts.dispatchInput !== false;

  var adapter = {
    get: function () { return parseNum(slider.value) || 0; },
    set: function (raw) {
      var min = parseFloat(slider.min);
      var max = parseFloat(slider.max);
      var nv = raw;
      if (isFinite(min)) nv = Math.max(min, nv);
      if (isFinite(max)) nv = Math.min(max, nv);
      slider.value = nv;
      if (dispatch) {
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
    step: opts.step,
    fineStep: opts.fineStep
  };

  var ctrl = buildValueTouchCtrl(adapter, {
    labelMinus: opts.labelMinus,
    labelPlus: opts.labelPlus,
    labelFine: opts.labelFine,
    replay: opts.replay,
    labelReplay: opts.labelReplay
  });

  // Box direkt nach dem Slider einhaengen (wie frueher).
  if (slider.parentNode) {
    if (slider.nextSibling) slider.parentNode.insertBefore(ctrl.box, slider.nextSibling);
    else slider.parentNode.appendChild(ctrl.box);
  }

  return {
    box: ctrl.box,
    btnMinus: ctrl.btnMinus,
    btnPlus: ctrl.btnPlus,
    btnFine: ctrl.btnFine,
    setFine: ctrl.setFine
  };
}

function buildStepperPair(opts) {
  // opts: { labelDec, labelInc, onDec, onInc, longPress (bool, default true) }
  // Liefert eine .touch-ctrl-Box mit zwei Buttons. Aufrufer hängt sie selbst ein.
  var box = document.createElement('div');
  box.className = 'touch-ctrl';

  var bDec = document.createElement('button');
  bDec.type = 'button';
  bDec.className = 'touch-btn';
  bDec.innerHTML = opts.labelDec;

  var bInc = document.createElement('button');
  bInc.type = 'button';
  bInc.className = 'touch-btn';
  bInc.innerHTML = opts.labelInc;

  if (opts.longPress === false) {
    bDec.addEventListener('click', function (ev) { ev.preventDefault(); opts.onDec(); });
    bInc.addEventListener('click', function (ev) { ev.preventDefault(); opts.onInc(); });
  } else {
    attachLongPress(bDec, opts.onDec);
    attachLongPress(bInc, opts.onInc);
  }

  box.appendChild(bDec);
  box.appendChild(bInc);
  return { box: box, btnDec: bDec, btnInc: bInc };
}

function bindKeyAdjust(getAdapter, opts) {
  // getAdapter(): liefert den aktuell aktiven Wert-Adapter
  //   { get, set, step, fineStep } -- oder null (dann passiert nichts).
  // opts: { isActive (Funktion(e) -> bool, default: immer true),
  //         fineForced (Funktion(adapter) -> bool, default: false) }
  // Rueckgabe: keydown-Handler-Funktion. Der Aufrufer registriert sie
  //   selbst (document- oder element-weit) und entfernt sie selbst.
  opts = opts || {};
  var isActive   = opts.isActive   || function () { return true; };
  var fineForced = opts.fineForced || function () { return false; };

  return function (e) {
    if (!isActive(e)) return;

    var dir = 0;
    // Links / Minus = kleiner; Rechts / Plus = groesser.
    // + / - auf Haupttastatur UND Nummernblock.
    if (e.key === 'ArrowLeft'  || e.key === '-' || e.code === 'NumpadSubtract') dir = -1;
    else if (e.key === 'ArrowRight' || e.key === '+' || e.code === 'NumpadAdd') dir = +1;
    else return;

    var adapter = getAdapter();
    if (!adapter) return;

    e.preventDefault();
    var fine = e.shiftKey || fineForced(adapter);
    var s = fine ? adapter.fineStep : adapter.step;
    var cur = adapter.get();
    if (typeof cur !== 'number' || !isFinite(cur)) cur = 0;
    adapter.set(+(cur + dir * s).toFixed(4));
  };
}
