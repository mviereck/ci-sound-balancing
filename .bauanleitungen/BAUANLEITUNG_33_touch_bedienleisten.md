# Bauanleitung 33: Mobile-Tauglichkeit — Touch-Bedienleisten

Dritte von drei Bauanleitungen zur Smartphone-Tauglichkeit. Größter
Brocken; bewußt **als eine Datei**, weil das Hilfsmodul und seine
Anwendung sehr homogen sind.

> **Aufteilbarkeit für Sonnet**: Falls der Kontext für einen Chat zu
> groß wird, kann diese Anleitung in drei aufeinander folgende
> Sonnet-Sitzungen zerlegt werden:
> - Phase A (Schritte 1–2): Helper-Modul + CSS
> - Phase B (Schritte 3a–3c): Test-Slider 1/2/3
> - Phase C (Schritte 3d–3f): Latenz, Player-Stärke, Schieber-Tab
>
> Jede Phase ist eigenständig testbar (siehe Akzeptanztest am Ende).

## Problem

Pfeiltasten- und Space-Steuerung gibt's auf Smartphones nicht. Der
native Range-Slider per Touch ist zu ungenau. Wiederholen mit Space
in den Tests ist nicht erreichbar.

## Ziel

Pro Slider eine **sichtbare Touch-Bedienleiste**, auch auf Desktop:

- **−** und **+** Buttons (Grobschritt, Long-Press = Auto-Repeat)
- **Fein**-Toggle (Modifier, ersetzt Shift)
- **Replay**-Button (nur bei den drei Tests)

Schieber-Tab (kein range-Slider, sondern Canvas) bekommt analog zwei
Stepper-Paare: `◀ Elektrode ▶` und `▼ dB ▲`.

Betroffene Stellen:

| Stelle | Datei | Slider/Element | Step / Fein | Replay |
|---|---|---|---|---|
| Test 1 (Balance) | test-ui.js Slider in `testBox` | `testEls.slider` | 0,5 / 0,1 dB | `playCur()` (init.js Z. 986) |
| Test 2 (LR) | lr-balance.js | `lrEls.slider` | 0,5 / 0,1 dB | `lrPlayCurrent()` |
| Test 3 (Frequenz) | freqmatch.js | `fmEls.slider` | 5 / 1 cent | `fmPlayCurrent()` |
| Latenz | latency.js | `latEls.slider` | 1 / 0,1 ms (kein Ctrl-Modus mehr per Touch) | — |
| Player-Stärke | index.html `#plStr` | number-Input | 1 / 5 % | — |
| Schieber-Tab | levels-tab.js | Canvas | dB ±0,5/0,1 oder qu-Step | — |

Hinweis Latenz: Die bisherige Drei-Stufen-Steuerung (1 / 0,1 / 10 ms)
kann auf Mobile nicht mit Modifier-Tasten umgesetzt werden. Lösung:
nur **zwei** Stufen (1 ms grob, 0,1 ms fein) — der 10-ms-Modus
entfällt für Touch-Bedienung. Pfeiltasten-Handler auf Desktop bleibt
unverändert.

## Schritt 1 — Neues Modul `touch-ctrl.js`

Neue Datei `touch-ctrl.js` im Repo-Root anlegen:

```javascript
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
```

Im Loader-Array von `index.html` Z. 25–30 `'touch-ctrl.js'` direkt
**nach** `'mobile.js'` ergänzen:

**Vorher** (nach Anleitung 32):
```javascript
var scripts = [
  'version.js', 'mobile.js', 'i18n.js', 'core.js', ...
];
```

**Nachher**:
```javascript
var scripts = [
  'version.js', 'mobile.js', 'touch-ctrl.js', 'i18n.js', 'core.js', ...
];
```

## Schritt 2 — CSS in `style.css`

Am Ende von `style.css` (vor der schließenden `}` der Mobile-Media-
Query — oder ans Ende der Datei, beides geht) folgenden Block einfügen:

```css
.touch-ctrl {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  margin-bottom: 4px;
  align-items: center;
}
.touch-btn {
  min-width: 44px;
  min-height: 44px;
  padding: 6px 14px;
  font-size: 1.1em;
  font-weight: 600;
  background: var(--surface);
  color: var(--text);
  border: 2px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  font-family: var(--font);
  user-select: none;
  touch-action: manipulation;
  transition: background 0.1s, border-color 0.1s;
}
.touch-btn:hover { background: var(--accent-light); }
.touch-btn:active { background: var(--accent-light); border-color: var(--accent); }
.touch-btn.fine-active {
  background: var(--accent-light);
  border-color: var(--accent);
  color: var(--accent);
}
.touch-btn.touch-replay {
  background: var(--success);
  color: #fff;
  border-color: var(--success);
}
.touch-btn.touch-replay:hover { background: #15803d; }
```

Größe (`min-width/min-height: 44px`) entspricht Apple-/Google-
Empfehlung für tappbare Elemente. Wirkt auf Desktop nicht störend
(reines Padding nach unten).

## Schritt 3 — Anwendung an den Slider-Stellen

### 3a. Test 1 (Elektrodenlautstärke) — `test.js`

Suche in `test.js` den Block ab Z. 1273 (`// Slider input`), in dem
der `input`-Listener am `testEls.slider` registriert wird. Direkt
**nach** dem schließenden `}` aller drei zusätzlichen Listener
(`change`/`mouseup`/`touchend`, Z. 1280–1282), einen neuen Block
ergänzen:

```javascript
    // Touch-Bedienleiste
    buildSliderTouchCtrl(testEls.slider, {
      step: 0.5,
      fineStep: 0.1,
      replay: function () { if (typeof playCur === 'function') playCur(); },
      labelReplay: '▶ ' + (t('bReplay') || 'Wiederholen')
    });
```

**Wichtig**: Die i18n-Beschriftung `bReplay` existiert bereits
(test-ui.js Z. 368, i18n.js durchsuchen falls Zweifel). `t()` aus
i18n.js ist zur Aufruf-Zeit verfügbar, weil dieser Block erst beim
ersten Test-Start ausgeführt wird (DOMContentLoaded-Phase der i18n
ist da abgeschlossen).

Anmerkung Sprachwechsel: Die Beschriftung wird einmalig beim Aufbau
gesetzt; Sprachwechsel zur Laufzeit aktualisiert sie nicht
automatisch. Das ist für diesen Build akzeptabel (User-Workflow
selten: Test starten → Sprache wechseln → Replay-Label lesen). Falls
gewünscht, kann später in `applyLang()` ein Refresh ergänzt werden —
nicht Teil dieser Anleitung.

### 3b. Test 2 (Stereo-Balance) — `lr-balance.js`

In `lr-balance.js`, **nach** Z. 818 (Ende des `input`-Listeners auf
`lrEls.slider`):

```javascript
    // Touch-Bedienleiste
    buildSliderTouchCtrl(lrEls.slider, {
      step: 0.5,
      fineStep: 0.1,
      replay: function () { if (typeof lrPlayCurrent === 'function') lrPlayCurrent(); },
      labelReplay: '▶ ' + (t('bReplay') || 'Wiederholen')
    });
```

### 3c. Test 3 (Frequenzabgleich) — `freqmatch.js`

In `freqmatch.js`, **nach** Z. 491 (`fmEls.slider.addEventListener('input', …)`):

```javascript
    // Touch-Bedienleiste
    buildSliderTouchCtrl(fmEls.slider, {
      step: 5,
      fineStep: 1,
      replay: function () { if (typeof fmPlayCurrent === 'function') fmPlayCurrent(); },
      labelReplay: '▶ ' + (t('bReplay') || 'Wiederholen')
    });
```

### 3d. Latenz — `latency.js`

In `latency.js`, **nach** Z. 330 (Ende des `input`-Listeners auf
`latEls.slider`), aber **vor** dem nächsten Block:

```javascript
  // Touch-Bedienleiste (kein Replay; Latenz hat keine Wiederholfunktion)
  buildSliderTouchCtrl(latEls.slider, {
    step: 1,
    fineStep: 0.1
  });
```

Hinweis: Auf Mobile fehlt damit die `Ctrl+Pfeil = 10 ms`-Beschleuni-
gung. Long-Press auf + / − liefert nach 400 ms 10 Schritte/Sek; bei
1-ms-Schrittweite sind das ebenfalls 10 ms/Sek effektiv. Reicht in der
Praxis.

### 3e. Player-Stärke — `init.js`

`plStr` in `index.html` Z. 1008 ist ein `<input type="number">`, kein
range-Slider. Der existierende Pfeiltasten-Handler (init.js Z. 771–789)
ruft `pUpdEQ()`. Wir können `buildSliderTouchCtrl` nicht direkt
verwenden, weil es ein `input`-Event an einem `type="range"` erwartet
und der `plStr` keinen `input`-Listener hat.

Lösung: Direkt nach dem Block der `plStrBtn`-Listener-Verdrahtung
(init.js, Suche nach `plStrBtn` — Z. ca. 792, direkt unter dem
Pfeiltasten-Block), folgenden Block einfügen:

```javascript
  // Touch-Bedienleiste für Player-Stärke
  (function () {
    var plStr = document.getElementById('plStr');
    if (!plStr) return;
    // Wir simulieren einen Slider-Wrapper: 'input' an einem number-Input
    // löst kein pUpdEQ aus, deshalb eigener applyDelta-Callback.
    var box = document.createElement('div');
    box.className = 'touch-ctrl';

    function step(dir, fine) {
      var v = parseInt(plStr.value) || 100;
      var st = fine ? 1 : 5;
      v = Math.max(0, Math.min(300, v + dir * st));
      plStr.value = v;
      pUpdEQ();
    }
    var fineMode = false;

    var bMin  = document.createElement('button');
    bMin.type = 'button'; bMin.className = 'touch-btn'; bMin.innerHTML = '−';
    var bFine = document.createElement('button');
    bFine.type = 'button'; bFine.className = 'touch-btn'; bFine.innerHTML = 'Fein';
    var bPlus = document.createElement('button');
    bPlus.type = 'button'; bPlus.className = 'touch-btn'; bPlus.innerHTML = '+';

    attachLongPress(bMin,  function () { step(-1, fineMode); });
    attachLongPress(bPlus, function () { step(+1, fineMode); });
    bFine.addEventListener('click', function () {
      fineMode = !fineMode;
      bFine.classList.toggle('fine-active', fineMode);
    });

    box.append(bMin, bFine, bPlus);
    // Direkt nach dem plStr-Eingabefeld einfügen
    if (plStr.parentNode) plStr.parentNode.insertBefore(box, plStr.nextSibling);
  })();
```

Hinweis Schrittweite: Grob 5 % (entspricht den `plStrBtn`-Quick-
Steps), Fein 1 %. Wenn Sonnet hier eine andere Logik bevorzugt, im
Selbstcheck dokumentieren.

### 3f. Schieber-Tab — `levels-tab.js`

Hier gibt es keinen range-Slider; die ←/→/↑/↓-Logik steckt in
init.js Z. 954–981 (Dispatcher) und in `levels-tab.js` selbst
(`lvTabStepAbsolute`, `lvTabOnSchieberChange`, `lvTabNavigableEl`).

**Ziel**: Zwei Stepper-Paare unter (oder über) dem Canvas:
- **Elektrode**: `◀` / `▶` — wechselt `lvTabFocus` via `lvTabNavigableEl()`
- **dB**: `▼` / `▲` — ändert `manualLevels[lvTabFocus]` (relativ) bzw.
  `lvTabStepAbsolute` (absolut)

In `levels-tab.js`, am Ende des bestehenden DOMContentLoaded-
Handlers (Suche nach dem Block, der focus/blur-Listener auf
`#lvTabCv` registriert), folgenden Block einfügen:

```javascript
  // Touch-Bedienleisten: Elektrode wechseln + dB ändern
  (function () {
    var cv = document.getElementById('lvTabCv');
    if (!cv) return;
    var host = cv.parentNode;
    if (!host) return;

    var ctrlRow = document.createElement('div');
    ctrlRow.className = 'lv-tab-touch-row';
    ctrlRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-top:10px;';

    var lblE = document.createElement('span');
    lblE.textContent = (typeof t === 'function' ? t('lvTabElLabel') : 'Elektrode') + ':';
    lblE.style.cssText = 'align-self:center;font-weight:600;';

    var stepE = buildStepperPair({
      labelDec: '◀',
      labelInc: '▶',
      onDec: function () { _lvTabTouchEl(-1); },
      onInc: function () { _lvTabTouchEl(+1); }
    });

    var lblV = document.createElement('span');
    lblV.textContent = (typeof t === 'function' ? t('lvTabVlLabel') : 'Wert') + ':';
    lblV.style.cssText = 'align-self:center;font-weight:600;';

    var fineMode = false;
    var bFine = document.createElement('button');
    bFine.type = 'button';
    bFine.className = 'touch-btn';
    bFine.innerHTML = 'Fein';
    bFine.addEventListener('click', function () {
      fineMode = !fineMode;
      bFine.classList.toggle('fine-active', fineMode);
    });

    var stepV = buildStepperPair({
      labelDec: '▼',
      labelInc: '▲',
      onDec: function () { _lvTabTouchVal(-1, fineMode); },
      onInc: function () { _lvTabTouchVal(+1, fineMode); }
    });

    var groupE = document.createElement('div');
    groupE.style.cssText = 'display:flex;gap:6px;align-items:center;';
    groupE.append(lblE, stepE.box);

    var groupV = document.createElement('div');
    groupV.style.cssText = 'display:flex;gap:6px;align-items:center;';
    groupV.append(lblV, stepV.box, bFine);

    ctrlRow.append(groupE, groupV);
    host.appendChild(ctrlRow);
  })();

  function _lvTabTouchEl(dir) {
    var nav = (typeof lvTabNavigableEl === 'function') ? lvTabNavigableEl() : actEl();
    if (!nav.length) return;
    var ci = nav.indexOf(lvTabFocus);
    if (ci < 0) ci = 0;
    if (dir < 0) ci = Math.max(0, ci - 1);
    else ci = Math.min(nav.length - 1, ci + 1);
    lvTabFocus = nav[ci];
    lvTabDraw();
  }

  function _lvTabTouchVal(dir, fine) {
    if (lvTabMode === 'abs') {
      lvTabStepAbsolute(lvTabFocus, dir, fine);
    } else {
      var st = fine ? 0.1 : 0.5;
      var cur = manualLevels[lvTabFocus] || 0;
      lvTabOnSchieberChange(lvTabFocus, cur + dir * st);
    }
  }
```

Zusätzlich in `i18n.js` zwei neue Keys ergänzen (alle vier Sprachen),
falls die Labels gewünscht sind:

```javascript
// de
lvTabElLabel: "Elektrode",
lvTabVlLabel: "Wert",
// en
lvTabElLabel: "Electrode",
lvTabVlLabel: "Value",
// fr
lvTabElLabel: "Électrode",
lvTabVlLabel: "Valeur",
// es
lvTabElLabel: "Electrodo",
lvTabVlLabel: "Valor",
```

Falls Sonnet diese Keys nicht ergänzt, greift der Fallback im Code
(`'Elektrode'` / `'Wert'`) — die Anwendung funktioniert dann nur auf
Deutsch korrekt. Bevorzugt: i18n ergänzen.

## Schritt 4 — `CODESTRUKTUR.md` aktualisieren

In CODESTRUKTUR.md die Modul-Tabelle erweitern. Neue Zeile **nach**
mobile.js (also Position 0c):

```
| 0c | touch-ctrl.js | `attachLongPress(btn, onStep)` (Klick + Long-Press 400 ms initial / 100 ms repeat), `buildSliderTouchCtrl(slider, opts)` (Touch-Bedienleiste mit − / Fein / + / [Replay] direkt nach dem Slider, dispatcht `input`-Event auf den Slider), `buildStepperPair(opts)` (zwei Buttons mit Long-Press, Aufrufer hängt selbst ein). Kein eigener DOMContentLoaded-Handler; Aufrufer instanzieren wo gebraucht. |
```

Außerdem im Datenfluss-Block einen neuen Absatz:

```
**Touch-Bedienleisten:** Pro Slider eine `.touch-ctrl`-Box mit
Buttons − / Fein / + / [Replay] (`buildSliderTouchCtrl` aus
touch-ctrl.js, aufgerufen in test.js Z. 1283, lr-balance.js Z. 819,
freqmatch.js Z. 493, latency.js Z. 331). Player-Stärke (`plStr`) und
Schieber-Tab (Canvas) haben Sonder-Implementierungen mit
`attachLongPress` direkt, weil sie nicht auf einem `<input type="range">`
basieren. Die Bedienleisten sind dauerhaft sichtbar (Desktop und
Mobile) — Konsistenz gewählt gegenüber Mobile-only-Variante.
```

## Schritt 5 — `SPEC.md` aktualisieren

Im Block „Slider-Bedienung" (in Abschnitt „Messungen — drei
Sub-Tabs"), folgenden Punkt ergänzen:

```
- **Touch-Bedienleiste** direkt unter jedem Slider (auch auf
  Desktop sichtbar): Buttons − / Fein / + und Replay (Wiederholen).
  Long-Press = Auto-Repeat. Der Fein-Toggle ersetzt Shift+Pfeil und
  bleibt aktiv, bis erneut getippt.
```

Im Schieber-Tab-Abschnitt (Abschnitt „Bedienung: ↑/↓ ±0,5 dB …")
einen neuen Bullet:

```
- Touch-Bedienleiste unter dem Canvas: Elektroden-Pfeile ◀/▶ und
  Wert-Pfeile ▼/▲ plus Fein-Toggle. Long-Press = Auto-Repeat. Ersatz
  für Pfeiltasten auf Geräten ohne Tastatur.
```

Im Latenz-Abschnitt anpassen:

```
- Schieber ±200 ms, Touch-Auflösung 1 ms / 0,1 ms (Fein-Toggle).
  Auf Desktop zusätzlich Ctrl+Pfeil = 10 ms wie bisher.
```

## Akzeptanztest-Checkliste

Manuell im Browser. Erst Desktop, dann Mobile-Emulation
(DevTools → Responsive, iPhone 12 Pro).

### Phase A — Helper-Modul lädt

1. `touch-ctrl.js` ist im Loader registriert (nach mobile.js, vor i18n.js).
2. Konsole: `typeof buildSliderTouchCtrl === 'function'` → `true`.
3. Keine JS-Fehler beim Page-Load.

### Phase B — Test-Slider 1/2/3

4. Messungen-Tab → Test 1 starten (Modus Balance).
   - Unter dem Slider erscheint eine Bedienleiste mit `−` `Fein` `+` `▶ Wiederholen`.
5. Klick `+` einmal: Slider-Wert steigt um 0,5 dB, sliderValue-Anzeige aktualisiert sich.
6. Fein aktivieren (Button wird blau hervorgehoben), `+` klicken: Slider-Wert steigt um 0,1 dB.
7. `+` gedrückt halten (1 Sek.): Auto-Repeat, Wert steigt kontinuierlich.
8. Klick `▶ Wiederholen`: Audio spielt erneut (vergleichbar mit Space-Tastatur).
9. Analog Test 2 (Stereo-Balance) und Test 3 (Frequenzabgleich):
   Bedienleiste sichtbar, Schrittweiten korrekt (0,5/0,1 dB bzw. 5/1 cent).

### Phase C — Latenz, Player, Schieber

10. Messungen → Latenz → Test starten:
    - Bedienleiste sichtbar, `−` `Fein` `+`, kein Replay-Button.
    - Klick `+`: +1 ms. Mit Fein: +0,1 ms.
11. Player-Tab → Bedienleiste neben/unter `plStr`-Eingabefeld:
    - `+` klicken: Stärke +5 %. Mit Fein: +1 %.
    - Equalizer-Graph aktualisiert sich live.
12. Schieber-Tab öffnen:
    - Unter dem Canvas zwei Stepper-Paare:
      `Elektrode: ◀ ▶` und `Wert: ▼ ▲ Fein`.
    - `▶` klicken: Fokus springt zur nächsten Elektrode (Umrahmung
      wandert).
    - `▲` klicken (Relativmodus): +0,5 dB; mit Fein: +0,1 dB.
    - Im Absolutmodus (falls MCL gepflegt): `▲` = +1 qu/CL/CU, mit
      Fein wie bisher `lvTabStepAbsolute(..., true)` (= 5er-Schritt;
      Achtung: Fein-Toggle invertiert hier die Semantik im Vergleich
      zum Relativmodus — dokumentieren oder anpassen, je nach
      Sonnet-Entscheidung).
    - Pfeiltasten-Verhalten (Desktop) unverändert.

### Phase D — Mobile-Emulation

13. iPhone 12 Pro emulieren, dieselben Schritte 4–12 durchgehen.
    - Tappen + halten = Auto-Repeat.
    - Buttons sind groß genug zum bequemen Antappen (Mindestgröße
      44×44 px).
    - Layout der Bedienleiste umbricht bei Bedarf in mehrere Zeilen
      (`flex-wrap: wrap`).

### Phase E — Regressions

14. Pfeiltasten-Steuerung auf Desktop weiterhin funktional (Tests 1/2/3, Latenz, Player, Schieber).
15. Space wiederholt im Test wie bisher (auf Desktop).
16. Side-Wechsel LINKS/RECHTS rebuildet die Test-UI; Bedienleiste wird neu instanziert (test-ui.js erzeugt das Panel neu) — keine doppelte Leiste.
17. Test-Stop und -Neustart: keine doppelten Bedienleisten.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung: jede Akzeptanz-Kriterie einzeln durchgehen
und **erfüllt / nicht erfüllt / unklar** mit Datei- und Zeilenangabe
melden. Bei „unklar" stoppen und nachfragen.

Zusätzlich kritisch prüfen:

- **Doppelte Leisten?** Werden Test-UIs bei Side-Wechsel / Test-Neustart
  vollständig neu aufgebaut (parentEl wird komplett ausgeleert)? Falls
  ja, ist der `buildSliderTouchCtrl`-Aufruf in test.js / lr-balance.js /
  freqmatch.js automatisch idempotent. Falls nein (Slider bleibt, nur
  Werte werden zurückgesetzt), würden bei jedem Neustart neue
  Bedienleisten angehängt → doppelt. In dem Fall: vor dem Aufruf
  prüfen, ob bereits eine `.touch-ctrl` direkt nach dem Slider existiert,
  und ggf. entfernen.
- **Schieber-Tab i18n**: Wenn die zwei neuen Keys nicht ergänzt
  wurden, im Selbstcheck explizit als „nicht erfüllt" markieren.
- **Latenz Auto-Repeat-Geschwindigkeit**: 10 Schritte/Sek bei
  Step 1 ms = 10 ms/Sek. Bei 200-ms-Range braucht der User max. 20 Sek
  zum vollen Durchlaufen. Akzeptabel, aber wenn Sonnet Bedenken hat
  und eine Beschleunigung einbauen möchte: erst rückfragen.
- **CSS-Konflikte**: `.touch-btn`-Klasse mit `.btn`-Klasse im Repo
  abgleichen — kein Stil-Override sollte greifen.
- **`CODESTRUKTUR.md`** und **`SPEC.md`** sind im selben Arbeitsschritt
  aktualisiert (touch-ctrl.js Modul-Eintrag, Datenfluss-Absatz,
  Slider-Bedienung-Bullet, Schieber-Tab-Bullet, Latenz-Update).
- **Performance**: `attachLongPress` hängt 4 pointer-Listener pro
  Button. Bei 5 Slidern × 2 Buttons = 40 Listener — irrelevant.
