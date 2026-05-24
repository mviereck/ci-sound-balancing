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

function buildSliderTouchCtrl(slider, opts) {
  // opts: { step, fineStep, replay (Funktion|null), labelMinus, labelPlus,
  //         labelFine, labelReplay, dispatchInput (bool, default true) }
  // Plaziert direkt nach dem Slider eine .touch-ctrl-DOM-Box.
  if (!slider) return null;
  var step      = opts.step;
  var fineStep  = opts.fineStep;
  var fineMode  = false;
  var dispatch  = opts.dispatchInput !== false;

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
  btnFine.setAttribute('aria-pressed', 'false');

  function applyDelta(dir) {
    var min = parseFloat(slider.min);
    var max = parseFloat(slider.max);
    var cur = parseFloat(slider.value) || 0;
    var s   = fineMode ? fineStep : step;
    var nv  = Math.max(min, Math.min(max, +(cur + dir * s).toFixed(4)));
    slider.value = nv;
    if (dispatch) {
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  attachLongPress(btnMinus, function () { applyDelta(-1); });
  attachLongPress(btnPlus,  function () { applyDelta(+1); });

  btnFine.addEventListener('click', function () {
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

  // Box direkt nach dem Slider einhängen.
  if (slider.parentNode) {
    if (slider.nextSibling) slider.parentNode.insertBefore(box, slider.nextSibling);
    else slider.parentNode.appendChild(box);
  }

  return {
    box: box,
    btnMinus: btnMinus,
    btnPlus: btnPlus,
    btnFine: btnFine,
    setFine: function (on) { fineMode = !!on; btnFine.classList.toggle('fine-active', fineMode); }
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
