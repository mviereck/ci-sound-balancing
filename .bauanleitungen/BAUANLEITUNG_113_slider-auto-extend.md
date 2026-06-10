# BAUANLEITUNG 113 — Slider Auto-Extend

Ziel: Die Bereichs-Erweiterung des Test-Sliders vollständig in `test-ui.js`
verlagern. Der Slider erweitert sich automatisch, wenn der Nutzer den
aktuellen Maximalwert erreicht und loslässt (Maus, Touch) oder per Pfeiltaste
das Limit trifft. `freqmatch.js` braucht sich danach nicht mehr um `rangeIdx`
oder `FM_SLIDER_RANGES` zu kümmern.

Neue Slider-cfg statt `ranges: [...]`:
```
slider: { unit: 'cent', initialRange: 100, maxRange: 1200, ... }
```
- `initialRange` = Startbereich und Schrittweite bei jeder Erweiterung
- `maxRange` = absolute Grenze, nie überschritten
- Rückwärts-Kompatibilität: wenn `ranges` (altes Format) übergeben wird,
  wird `ranges[0]` als `initialRange` und `ranges[ranges.length-1]` als
  `maxRange` verwendet — kein Absturz, aber kein Auto-Extend

Visuell: der Slider-Track beginnt dick (initialRange) und wird mit jeder
Erweiterung etwas dünner — CSS-Custom-Property `--sl-range-step` steuert das.

## Schritt 0 — Version hochzählen

`js/version.js`:
```js
// vorher:
const APP_VERSION = "3.0.112-beta";
// nachher:
const APP_VERSION = "3.0.113-beta";
```

---

## Schritt 1 — Hilfsfunktion `_maybeExtendSlider` in test-ui.js

Direkt **vor** `function _buildTestPanelNew(parentEl, cfg) {` (Z. 654) einfügen:

```js
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
```

---

## Schritt 2 — Slider-Block in `_buildTestPanelNew` umbauen

Im Block `if (body.slider) {` in `_buildTestPanelNew`:

### 2a — Variablen-Init und Element-Erstellung

VORHER (Beginn des Slider-Blocks):
```js
    if (body.slider) {
      var slCfg = body.slider;
      var slUnit = slCfg.unit || 'dB';
      var slRanges = slCfg.ranges || [20];
      var slDefaultRangeIdx = slCfg.defaultRange || 0;
      var slRange = slRanges[slDefaultRangeIdx] || slRanges[0];
      var slWrap = _mkEl('div', 'slider-wrap');
      var slInput = _mkEl('input');
      slInput.type = 'range';
      slInput.className = 'big-slider';
      slInput.min = -slRange; slInput.max = slRange;
      slInput.step = (slUnit === 'cent' || slUnit === 'ms') ? '1' : '0.1';
      slInput.value = '0';
      var slExtendBtn = _mkEl('button', 'btn btn-sm extend-btn');
      slExtendBtn.hidden = true;
      _tEl(slExtendBtn, 'bExtend');
      slWrap.append(slInput, slExtendBtn);
      vWrap.appendChild(slWrap);
```

NACHHER:
```js
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
      slInput.step = (slUnit === 'cent' || slUnit === 'ms') ? '1' : '0.1';
      slInput.value = '0';
      slInput.style.setProperty('--sl-range-step', '0');
      slWrap.append(slInput);
      vWrap.appendChild(slWrap);
```

### 2b — refs.slider-Objekt

VORHER:
```js
      refs.slider = {
        input: slInput,
        extendBtn: slExtendBtn,
        lsHint: lsHint, lsHintBand: lsHintBand, lsHintMark: lsHintMark, lsHintLabel: lsHintLabel2,
        unit: slUnit,
        ranges: slRanges,
        rangeIdx: slDefaultRangeIdx
      };
```

NACHHER:
```js
      refs.slider = {
        input: slInput,
        lsHint: lsHint, lsHintBand: lsHintBand, lsHintMark: lsHintMark, lsHintLabel: lsHintLabel2,
        unit: slUnit,
        initialRange: slInitialRange,
        maxRange: slMaxRange,
        rangeIdx: 0
      };
```

### 2c — Event-Listener am Slider

VORHER:
```js
      slInput.addEventListener('change', function() { slInput.blur(); });
      slInput.addEventListener('mouseup', function() { slInput.blur(); });
      slInput.addEventListener('touchend', function() { slInput.blur(); });
```

NACHHER:
```js
      slInput.addEventListener('mouseup', function() { _maybeExtendSlider(refs.slider); slInput.blur(); });
      slInput.addEventListener('touchend', function() { _maybeExtendSlider(refs.slider); slInput.blur(); });
      slInput.addEventListener('change', function() { slInput.blur(); });
```

---

## Schritt 3 — Keydown-Handler anpassen

Im `_keyListener`-Block, im Abschnitt `// ← / → : Slider`:

### 3a — rangeMax aus input.max statt aus ranges-Array

VORHER:
```js
          var rangeMax = slRef.ranges[slRef.rangeIdx] || 20;
```

NACHHER:
```js
          var rangeMax = parseFloat(slRef.input.max) || 20;
```

### 3b — Auto-Extend nach onSlide-Hook

VORHER:
```js
          if (vCfg2.hooks && vCfg2.hooks.onSlide) vCfg2.hooks.onSlide(newVal);
          return;
```

NACHHER:
```js
          if (vCfg2.hooks && vCfg2.hooks.onSlide) vCfg2.hooks.onSlide(newVal);
          _maybeExtendSlider(slRef);
          return;
```

---

## Schritt 4 — testUI.slider.setValue hinzufügen

Im `var testUI = { ... }` Objekt (nach dem letzten bestehenden Schlüssel, vor
der schließenden `}`), folgenden Block einfügen:

```js
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
```

Achtung: das ist der letzte Schlüssel im `testUI`-Objekt. Vor dem vorherigen
letzten Schlüssel ein Komma einfügen, falls noch keins vorhanden.

---

## Schritt 5 — freqmatch.js aufräumen

### 5a — Modul-Konstanten entfernen (Datei-Anfang)

VORHER:
```js
const FM_SLIDER_RANGES = [100, 500, 1200];
let fmSlRangeIdx = 0;
```

NACHHER: beide Zeilen ersatzlos löschen.

### 5b — Funktion `_fmCheckExtend` entfernen

Die gesamte Funktion löschen:
```js
function _fmCheckExtend() {
  if (!fmEls) return;
  const slRefs = fmEls.verfahren && fmEls.verfahren.slider;
  const lim = FM_SLIDER_RANGES[fmSlRangeIdx];
  const atLimit = Math.abs(fmCentOffset) >= lim - 1;
  const hasNext = fmSlRangeIdx < FM_SLIDER_RANGES.length - 1;
  if (slRefs && slRefs.slider) slRefs.slider.extendBtn.hidden = !(atLimit && hasNext);
}
```

### 5c — `fmShowElectrode`: Slider-Bereich durch setValue ersetzen

VORHER (innerhalb von `fmShowElectrode`):
```js
  if (slRefs && slRefs.slider) {
    const lim = FM_SLIDER_RANGES[fmSlRangeIdx];
    slRefs.slider.input.min   = -lim;
    slRefs.slider.input.max   =  lim;
    slRefs.slider.input.value = Math.max(-lim, Math.min(lim, fmCentOffset));
    slRefs.slider.rangeIdx    = fmSlRangeIdx;
  }
  fmUpdateSliderDisplay();
  _fmCheckExtend();
```

NACHHER:
```js
  if (slRefs && slRefs.slider) {
    testUI.slider.setValue(slRefs.slider, fmCentOffset);
  }
  fmUpdateSliderDisplay();
```

### 5d — Funktion `_fmExtendRange` entfernen

Die gesamte Funktion löschen:
```js
function _fmExtendRange() {
  if (fmSlRangeIdx >= FM_SLIDER_RANGES.length - 1) return;
  fmSlRangeIdx++;
  const lim = FM_SLIDER_RANGES[fmSlRangeIdx];
  const slRef = fmEls && fmEls.verfahren && fmEls.verfahren.slider && fmEls.verfahren.slider.slider;
  if (slRef) {
    slRef.input.min   = -lim;
    slRef.input.max   =  lim;
    slRef.input.value = fmCentOffset;
    slRef.rangeIdx    = fmSlRangeIdx;
  }
  _fmCheckExtend();
}
```

### 5e — `fmHandleSlider`: `_fmCheckExtend`-Aufruf entfernen

VORHER:
```js
function fmHandleSlider(val) {
  fmCentOffset = parseFloat(val);
  fmUpdateSliderDisplay();
  _fmCheckExtend();
  fmRenderSliderStatusGrid();
}
```

NACHHER:
```js
function fmHandleSlider(val) {
  fmCentOffset = parseFloat(val);
  fmUpdateSliderDisplay();
  fmRenderSliderStatusGrid();
}
```

### 5f — `fmStartSlider`: `fmSlRangeIdx = 0` entfernen

VORHER (in `fmStartSlider`):
```js
  fmSeqIdx    = 0;
  fmSlRangeIdx = 0;
  fmRunning   = true;
```

NACHHER:
```js
  fmSeqIdx    = 0;
  fmRunning   = true;
```

### 5g — `fmLoadElectrode`: Range-Reset-Block entfernen

VORHER:
```js
  fmCurrentEl = fmSeq[fmSeqIdx];
  fmCentOffset = fmPrevCent(fmCurrentEl);
  fmSlRangeIdx = 0;
  const absEx = Math.abs(fmCentOffset);
  while (absEx > FM_SLIDER_RANGES[fmSlRangeIdx] && fmSlRangeIdx < FM_SLIDER_RANGES.length - 1) {
    fmSlRangeIdx++;
  }
  fmFirstSide = Math.random() < 0.5 ? "ref" : "var";
```

NACHHER:
```js
  fmCurrentEl = fmSeq[fmSeqIdx];
  fmCentOffset = fmPrevCent(fmCurrentEl);
  fmFirstSide = Math.random() < 0.5 ? "ref" : "var";
```

### 5h — cfg: `ranges` durch `initialRange`/`maxRange` ersetzen

In `fmCfg` (im DOMContentLoaded-Handler), im Slider-Verfahren-Block:

VORHER:
```js
          slider:        { unit: 'cent', ranges: [100, 500, 1200], touchStep: 5, touchFineStep: 1 },
```

NACHHER:
```js
          slider:        { unit: 'cent', initialRange: 100, maxRange: 1200, touchStep: 5, touchFineStep: 1 },
```

### 5i — Externer Listener im DOMContentLoaded entfernen

VORHER (nach `fmEls = buildTestPanel(parentEl, fmCfg);`):
```js
  const _slExtendBtn = fmEls.verfahren && fmEls.verfahren.slider
    && fmEls.verfahren.slider.slider && fmEls.verfahren.slider.slider.extendBtn;
  if (_slExtendBtn) _slExtendBtn.addEventListener('click', _fmExtendRange);
```

NACHHER: beide Zeilen ersatzlos löschen.

---

## Schritt 6 — style.css: Track-Dicke

Die bestehende Regel `.test-box .slider-wrap input[type="range"]`:

VORHER:
```css
.test-box .slider-wrap input[type="range"] {
  width: 100%;
  order: 1;
}
```

NACHHER:
```css
.test-box .slider-wrap input[type="range"] {
  width: 100%;
  order: 1;
  --sl-range-step: 0;
}
.test-box .slider-wrap input[type="range"]::-webkit-slider-runnable-track {
  height: max(4px, calc(10px - var(--sl-range-step) * 0.8px));
  border-radius: 3px;
  background: var(--border);
}
.test-box .slider-wrap input[type="range"]::-moz-range-track {
  height: max(4px, calc(10px - var(--sl-range-step) * 0.8px));
  border-radius: 3px;
  background: var(--border);
}
```

Erklärung: Step 0 → 10 px Track-Höhe, jede Erweiterung −0,8 px,
Minimum 4 px (wird nach ca. 7 Erweiterungen erreicht).
`--border` ist `#d4d0c8` (bereits im Theme definiert).

---

## Bau-Diagnose-Test

In `js/debug-tests-current.js` am Ende anhängen:

```js
/* BA113 — Slider Auto-Extend API */
(function() {
  if (typeof registerDebugTest !== 'function') return;
  registerDebugTest('build/BA113/slider-auto-extend', {
    label: 'Slider Auto-Extend API (BA113)',
    opts: { tab: 'messungen' },
    run: function() {
      var lines = [];
      function chk(label, val) { lines.push((val ? '✓' : '✗') + ' ' + label); }
      chk('testUI.slider.setValue vorhanden',
        typeof testUI !== 'undefined' && !!testUI.slider && typeof testUI.slider.setValue === 'function');
      chk('FM_SLIDER_RANGES entfernt',
        typeof FM_SLIDER_RANGES === 'undefined');
      chk('fmSlRangeIdx entfernt',
        typeof fmSlRangeIdx === 'undefined');
      var slRef = typeof fmEls !== 'undefined' && fmEls &&
        fmEls.verfahren && fmEls.verfahren.slider && fmEls.verfahren.slider.slider;
      chk('slider.initialRange === 100', !!slRef && slRef.initialRange === 100);
      chk('slider.maxRange === 1200', !!slRef && slRef.maxRange === 1200);
      chk('extendBtn nicht in slider-refs', !!slRef && !('extendBtn' in slRef));
      return lines.join('\n');
    }
  });
})();
```

Nach Abnahme: Sonnet aktiv nachfragen, ob der Test (a) entfernt oder
(b) nach `archive/debug-tests/BA113_slider-auto-extend.js` verschoben
werden soll.

---

## Akzeptanztest-Checkliste

1. **Seite laden** → Browser-Konsole prüfen: keine JS-Fehler.

2. **Tab Messungen → Sub-Tab Frequenzabgleich → Verfahren „Slider"**
   → Track des Sliders ist deutlich dicker als ein normaler Browser-Slider
   (ca. 10 px statt 4–6 px Standard).

3. **Test starten** (beliebige Elektrode).
   → Slider erscheint mit Bereich ±100 Cent.
   → Kein „Bereich erweitern"-Button sichtbar.

4. **Slider bis zum Anschlag (+100 oder −100) ziehen und loslassen.**
   → Slider-Bereich erweitert sich auf ±200 Cent.
   → Track wird leicht dünner.
   → Der eingestellte Wert (100 Cent) liegt jetzt näher zur Mitte des Tracks.

5. **Schrittweise weiter bis zum Anschlag → loslassen** (drei weitere Male).
   → Bereich wächst auf ±300, ±400, ±500 Cent.
   → Track wird mit jeder Erweiterung etwas dünner.

6. **Pfeiltaste → bis zum Anschlag drücken** (bei Bereich ±500, Wert auf 500 bringen).
   → Nach dem letzten Tastendruck (der den Wert auf 500 bringt): Bereich
   erweitert sich sofort auf ±600 Cent ohne Loslassen der Maus.

7. **Schrittweise bis maxRange 1200 Cent ausschöpfen.**
   → Bereich wächst maximal bis ±1200 Cent.
   → Jenseits von ±1200 passiert keine weitere Erweiterung.

8. **Test abbrechen → neuen Test starten.**
   → Slider beginnt wieder bei ±100 Cent (vollständiger Reset).

9. **Elektrode wechseln** (über Undo / Weiter im Test):
   → Slider-Bereich resettet auf das Minimum, das für den gespeicherten
   Vorwert dieser Elektrode benötigt wird (z. B. ±100 wenn Vorwert 0,
   ±200 wenn Vorwert 150 Cent).

10. **Tab Messungen → andere Sub-Tabs** unverändert nutzbar (kein
    Seiteneffekt durch die Änderungen).

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Zeile der folgenden Liste einzeln prüfen und
melden: **erfüllt / nicht erfüllt / unklar** mit Datei + Zeilennummer:

- `FM_SLIDER_RANGES` und `fmSlRangeIdx` sind aus `freqmatch.js` entfernt
- `_fmCheckExtend` ist aus `freqmatch.js` entfernt
- `_fmExtendRange` ist aus `freqmatch.js` entfernt
- `fmHandleSlider` enthält keinen `_fmCheckExtend`-Aufruf mehr
- `fmLoadElectrode` enthält keinen `fmSlRangeIdx`-Reset und keine
  `FM_SLIDER_RANGES`-While-Schleife mehr
- `fmShowElectrode` setzt den Slider via `testUI.slider.setValue`
- Externer `_fmExtendRange`-Listener im DOMContentLoaded entfernt
- `_maybeExtendSlider` ist vor `_buildTestPanelNew` definiert
- Keydown-Handler verwendet `parseFloat(slRef.input.max)` statt
  `slRef.ranges[slRef.rangeIdx]`
- Keydown-Handler ruft `_maybeExtendSlider(slRef)` nach `onSlide` auf
- `testUI.slider.setValue` ist im `testUI`-Objekt vorhanden
- `refs.slider` enthält `initialRange`, `maxRange`, `rangeIdx` statt
  `ranges`, `extendBtn`
- `style.css` enthält `::-webkit-slider-runnable-track` und
  `::-moz-range-track` Regeln mit `--sl-range-step`
- `APP_VERSION` ist `"3.0.113-beta"`
