# BA 241: Klavier-Disabled-Anzeige + Modal-Sweep-Knopf

## Ziel

Zweiter Schritt der vierteiligen Umstellung (BA 240–243). Vorbereitung
des Implantat-Tabs (BA 242):

1. **Klavier-Widget** (`js/sampler-keyboard.js`) bekommt drei
   Erweiterungen:
   - **Disabled-Anzeige** pro weißer Taste: deaktivierte Elektroden
     (`elActive[i] === false`) und ausgeschlossene Elektroden
     (`elExDur[i] != null`) werden ausgegraut, mit einem X aus zwei
     diagonalen Linien überzogen, und sind nicht klickbar.
   - **Schwarze Tasten Gruppen-Logik**: liegen ein oder mehrere
     deaktivierte/ausgeschlossene weiße Tasten in Folge, werden die
     beidseits angrenzenden schwarzen Tasten zu einer Gruppe
     zusammengefaßt. Frequenz aller Gruppen-Tasten = geometrisches
     Mittel der nächsten aktiven Elektroden links und rechts. Ein
     **dünner schwarzer Balken** (~15 px hoch, auf halber Höhe der
     schwarzen Tasten) verbindet die Tasten der Gruppe. Anschlag
     einer Gruppen-Taste leuchtet **alle Tasten der Gruppe + Balken**
     auf, plus die beiden Anker-weißen-Tasten.
   - **Highlight-API als Return-Wert**: `renderSamplerKeyboard` gibt
     ein Handle zurück mit `highlightElectrode(idx, on)`, damit der
     Sweep extern aufleuchten kann.

2. **Tonauswahl-Modal** (`js/tone-popup.js`) bekommt einen optionalen
   **Sweep-Knopf**:
   - Sichtbar nur wenn `cfg.sweepMode === true`
   - Beschriftung „Sweep starten" (i18n-Key neu)
   - Klick spielt alle aktiven Elektroden apikal→basal nacheinander
     mit der aktuell ausgewählten Tonart, Lautstärke, Tondauer,
     Tonpause aus der Modal. Pan aus `cfg.getSweepPan()` (gibt -1/0/+1
     oder beliebige Pan-Werte zwischen -1 und +1 zurück).
   - Während des Laufs **blau-aktiv hervorgehoben** (`background:#2563eb;
     color:#fff;`), Klick stoppt den Sweep vorzeitig.
   - Endet automatisch nach dem letzten Ton; Knopf geht zurück in den
     Ausgangszustand.
   - Klaviertasten leuchten in der Sequenz auf (über die neue
     Highlight-API).
   - Modal-Schließen (Cancel/X/OK) bricht laufenden Sweep ab.
   - Tonart-Wechsel während Sweep stoppt den Sweep.
   - Manuelle Klaviertastenanschläge während Sweep sind erlaubt und
     überlagern den Sweep-Ton (keine Sperre).

Diese BA aktiviert **keinen** Verbraucher — der Freqmatch nutzt
weder die Klavier-Disabled-Anzeige noch den Sweep-Knopf. BA 241
ist reine Infrastruktur. Verbraucher = Implantat-Tab in BA 242.

i18n: nur Deutsch. Ein neuer Key (`tonePopupSweepStart`). EN/FR/ES als
spätere Folge-Mini-BA.

## Codestand (zur Orientierung)

- `js/sampler-keyboard.js` (komplett, 205 Zeilen): `renderSamplerKeyboard
  (container, opts)`. Zwei Modi (Burst/Hold), Highlight-Set per
  `_keysToHighlight(el)`, weiße Tasten in `whiteKeys[i]`, schwarze in
  `blackKeys[i]`. Schwarze Frequenz heute: `Math.sqrt(freqs[i] * freqs[i+1])`,
  Position absolut über Prozent.
- `js/tone-popup.js`: `openToneSelectionDialog(cfg, onChange)`. Nach
  BA 240 enthält die Modal Hint-Box, Toggles, Vol/Dur/Pau-Reihe,
  Klavier-Wrap, Tonart-Gruppen, Button-Reihe. Der Sweep-Knopf wird in
  einer neuen Zeile **direkt hinter dem Klavier-Wrap und vor den
  Tonart-Gruppen** eingehängt.
- `js/audio.js:684`: `playToneTyped(c, hz, vol, ms, pan, toneType, ramp)`.
  Wir benutzen ihn pro Sweep-Step.

## Schritte

### 1. Version bumpen — `js/version.js`

```js
const APP_VERSION = "3.2.241-beta";
```

### 2. Klavier-Disabled-Anzeige — `js/sampler-keyboard.js`

**2a) Neuen cfg-Eingang lesen.** Am Anfang von `renderSamplerKeyboard`
(nach Z. 35, `var labels = …;`) ergänzen:

```js
  // BA 241: Indizes der deaktivierten / ausgeschlossenen weissen Tasten.
  // Aufrufer-Sicht; null/leeres Array = alle Tasten aktiv.
  var disabledRaw = (typeof opts.getDisabledElectrodes === 'function')
    ? opts.getDisabledElectrodes() : [];
  var disabledSet = new Set(Array.isArray(disabledRaw) ? disabledRaw : []);
```

**2b) Weiße Tasten beim Rendern markieren.** Im `freqs.forEach`-Block
(Z. 66–78) nach `key.dataset.hz = String(hz);` und vor `whiteKeys[i] = key;`
ergänzen:

```js
    if (disabledSet.has(i)) {
      key.classList.add('kb-key--disabled');
      key.style.background = '#d1d5db';
      key.style.color      = '#6b7280';
      key.style.cursor     = 'not-allowed';
      // X aus zwei diagonalen Linien als SVG-Overlay
      var xOv = document.createElement('span');
      xOv.style.cssText = 'position:absolute;inset:0;pointer-events:none;'
        + 'background-image:linear-gradient(to top right, transparent calc(50% - 1px), '
        + '#4b5563 calc(50% - 1px), #4b5563 calc(50% + 1px), transparent calc(50% + 1px)),'
        + 'linear-gradient(to top left, transparent calc(50% - 1px), '
        + '#4b5563 calc(50% - 1px), #4b5563 calc(50% + 1px), transparent calc(50% + 1px));';
      key.appendChild(xOv);
    }
```

**2c) `_bindKey` für disabled-e weiße Tasten überspringen.**
Direkt vor dem `_bindKey(key, i, hz);`-Aufruf (Z. 76) eine Bedingung
einfügen:

```js
    if (!disabledSet.has(i)) {
      _bindKey(key, i, hz);
    }
```

(Damit haben disabled-e weiße Tasten keinen Pointer-Handler — keine
Audio-Ausgabe, kein Highlight.)

### 3. Schwarze Tasten: Gruppen-Logik mit Verbindungsbalken — `js/sampler-keyboard.js`

Den ganzen schwarze-Tasten-Block (Z. 80–99) durch das folgende
Konstrukt ersetzen:

```js
  // BA 241: Schwarze Tasten mit Gruppen-Logik.
  // Wenn ein oder mehrere weisse Tasten in Folge deaktiviert sind,
  // werden die beidseits angrenzenden schwarzen Tasten zu einer
  // Gruppe zusammengefasst. Frequenz aller Gruppen-Tasten = Mittel
  // der naechsten aktiven Elektroden links/rechts. Ein duenner
  // schwarzer Balken verbindet die Gruppen-Tasten.
  //
  // Pro schwarze Position i (zwischen weiss i und weiss i+1):
  //   leftAnchor  = i;   solange disabledSet.has(leftAnchor),  leftAnchor--
  //   rightAnchor = i+1; solange disabledSet.has(rightAnchor), rightAnchor++
  //   Wenn leftAnchor < 0 oder rightAnchor >= freqs.length:
  //     Taste ist disabled (kein Anker auf einer Seite).
  //   Sonst: Taste gehoert zur Gruppe (leftAnchor, rightAnchor),
  //     Frequenz = sqrt(freqs[leftAnchor] * freqs[rightAnchor]).

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
      // disabled — X-Overlay + nicht klickbar
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

    // Gruppen-Eintrag (alle schwarzen Tasten mit gleichem leftAnchor/rightAnchor)
    var grpKey = leftAnchor + ':' + rightAnchor;
    if (!blackGroups[grpKey]) {
      blackGroups[grpKey] = { blackEls: [], leftAnchor: leftAnchor, rightAnchor: rightAnchor };
    }
    blackGroups[grpKey].blackEls.push(black);
    black.dataset.grpKey = grpKey;

    _bindKey(black, -1, hzBlack);
    row.appendChild(black);
  }

  // BA 241: Verbindungs-Balken zeichnen fuer Gruppen mit >= 2 schwarzen Tasten.
  // Balken liegt auf halber Hoehe der schwarzen Tasten (~30% Hoehe der schwarzen
  // Taste = 18% Hoehe der Klavierreihe bei 60%-schwarzen-Tasten -> wir setzen
  // top:25% absolut, Hoehe 15px).
  Object.keys(blackGroups).forEach(function(grpKey) {
    var grp = blackGroups[grpKey];
    if (grp.blackEls.length < 2) return;
    // Geometrie aus den Inline-Styles der schwarzen Tasten holen.
    var firstStyle = grp.blackEls[0].style;
    var lastStyle  = grp.blackEls[grp.blackEls.length - 1].style;
    var firstLeft  = parseFloat(firstStyle.left);   // %
    var firstWidth = parseFloat(firstStyle.width);  // %
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
```

### 4. Highlight-Set erweitern — `js/sampler-keyboard.js`

Die Funktion `_keysToHighlight(el)` (Z. 109–116) durch die Gruppen-
fähige Variante ersetzen:

```js
  // BA 241: Tasten-Bundle fuer Highlight.
  // Weisse Taste: nur sich selbst.
  // Schwarze Taste mit Gruppe (>=1 schwarze Tasten, +Balken bei >=2):
  //   alle schwarzen Tasten der Gruppe + Balken (falls vorhanden) +
  //   beide Anker-weissen-Tasten.
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
    // Fallback: alte Logik fuer Tasten ohne Gruppen-Daten (sollte nicht
    // vorkommen — alle aktiven schwarzen Tasten haben einen grpKey).
    var bIdx = parseInt(el.dataset.blackIdx, 10);
    var arr2 = [el];
    if (whiteKeys[bIdx]     != null) arr2.push(whiteKeys[bIdx]);
    if (whiteKeys[bIdx + 1] != null) arr2.push(whiteKeys[bIdx + 1]);
    return arr2;
  }
```

`_highlightOn` / `_highlightOff` (Z. 118–131) bleiben unverändert; sie
funktionieren auf jeder Element-Liste.

### 5. Highlight-API als Return-Wert — `js/sampler-keyboard.js`

Ganz am Ende der Funktion `renderSamplerKeyboard`, nach dem
`container.appendChild(wrap);` und vor dem aktuellen Funktions-Ende
(direkt vor der schließenden `}` der `function renderSamplerKeyboard`),
ein Handle-Objekt zurückgeben:

```js
  // BA 241: Externes Highlight-Handle fuer Sweep.
  return {
    highlightElectrode: function(idx, on) {
      var k = whiteKeys[idx];
      if (!k) return;
      if (on) _highlightOn([k]);
      else    _highlightOff([k]);
    }
  };
```

**Wichtig:** Das `return` muß **vor** den Hilfsfunktionen `_keysToHighlight`
etc. stehen — sonst läuft die Funktion bis zum Definitions-Ende durch
ohne implizites return. Konkret: Das `return`-Statement gehört direkt
nach `container.appendChild(wrap);`. Die Hilfsfunktionen sind weiterhin
durch Hoisting erreichbar (function declarations).

### 6. Modal-Sweep — Closure-State + Stop-Helfer — `js/tone-popup.js`

In `openToneSelectionDialog`, nach den bestehenden Closure-Variablen
(`var selected = initial;`, `var playing = false;`, `var applyMeasLevels = true;`,
`var applyBalance = true;`) ergänzen:

```js
  // BA 241: Sweep-State, nur aktiv wenn cfg.sweepMode === true.
  var sweepRunning = false;
  var sweepAbort   = false;
  var sweepKbHandle = null;   // wird beim Klavier-Render gesetzt
```

Klavier-Handle merken: Den Block `renderSamplerKeyboard(kbWrap, {...});`
(BA 228, Z. ~309) so umbauen, daß der Return-Wert gespeichert wird:

```js
      sweepKbHandle = renderSamplerKeyboard(kbWrap, {
        getElectrodeFreqs:   cfg.getElectrodeFreqs,
        getElectrodeLabels:  cfg.getElectrodeLabels,
        getCurrentToneType:  function() { return selected; },
        onPress:             cfg.onPress,
        onRelease:           cfg.onRelease,
        getHighlightMs:      cfg.getHighlightMs,
        // BA 241: Disabled-Anzeige
        getDisabledElectrodes: cfg.getDisabledElectrodes
      });
```

### 7. Sweep-Knopf — UI + Logik — `js/tone-popup.js`

Direkt **nach** dem Klavier-Render-Block (vor dem `GROUPS.forEach(...)`-
Block, Z. ~323) folgenden Block einfügen:

```js
  // BA 241: Optionaler Sweep-Knopf. Aktiv nur wenn cfg.sweepMode === true.
  var sweepBtn = null;
  if (cfg.sweepMode === true) {
    var sweepRow = document.createElement('div');
    sweepRow.style.cssText = 'margin:0 0 14px 0;display:flex;justify-content:flex-start;';
    sweepBtn = document.createElement('button');
    sweepBtn.type = 'button';
    sweepBtn.className = 'btn';
    sweepBtn.dataset.t = 'tonePopupSweepStart';
    sweepBtn.style.cssText = 'padding:6px 14px;font-weight:600;border-radius:6px;';

    function _swpUpdStyle(active) {
      if (active) {
        sweepBtn.style.background  = '#2563eb';
        sweepBtn.style.color       = '#fff';
        sweepBtn.style.borderColor = '#2563eb';
      } else {
        sweepBtn.style.background  = '';
        sweepBtn.style.color       = '';
        sweepBtn.style.borderColor = '';
      }
    }
    _swpUpdStyle(false);

    sweepBtn.addEventListener('click', function() {
      if (sweepRunning) {
        // Stop
        sweepAbort = true;
        return;
      }
      _runSweep();
    });

    sweepRow.appendChild(sweepBtn);
    dlg.appendChild(sweepRow);
  }

  // BA 241: Sweep-Schleife. Spielt alle aktiven Elektroden apikal->basal mit
  // aktuell ausgewaehlter Tonart, Lautstaerke, Tondauer, Tonpause.
  function _runSweep() {
    if (typeof cfg.getElectrodeFreqs !== 'function') return;
    var freqs = cfg.getElectrodeFreqs() || [];
    if (!freqs.length) return;
    var disabled = (typeof cfg.getDisabledElectrodes === 'function')
      ? new Set(cfg.getDisabledElectrodes() || [])
      : new Set();
    var c = (typeof gAC === 'function') ? gAC() : null;
    if (!c) return;

    var pan = (typeof cfg.getSweepPan === 'function') ? cfg.getSweepPan() : 0;
    var pauMs = (typeof cfg.getPauseMs    === 'function') ? cfg.getPauseMs()    : 300;
    var dur   = (typeof cfg.getDurationMs === 'function') ? cfg.getDurationMs() : 750;

    sweepRunning = true;
    sweepAbort   = false;
    if (sweepBtn) _swpUpdStyle(true);

    var idx = 0;
    function step() {
      if (sweepAbort || idx >= freqs.length) {
        sweepRunning = false;
        sweepAbort   = false;
        if (sweepBtn) _swpUpdStyle(false);
        return;
      }
      if (disabled.has(idx)) { idx++; step(); return; }

      var hz   = freqs[idx];
      var tone = selected;
      // Vol fuer den Step (Audio-Wert 0..1). Korrektur-Toggles wirken wie beim Vorspiel.
      var vol = (typeof cfg.getVolume === 'function') ? cfg.getVolume() : 0.25;
      if (applyMeasLevels) {
        var md = _tpMeasDbForStep(hz, pan);
        if (md !== 0) vol *= Math.pow(10, md / 20);
      }
      if (applyBalance) {
        var bl = _tpBalanceDbSym();
        var bd = (pan < -0.01) ? bl.left : (pan > 0.01) ? bl.right : 0;
        if (bd !== 0) vol *= Math.pow(10, bd / 20);
      }

      if (sweepKbHandle && typeof sweepKbHandle.highlightElectrode === 'function') {
        sweepKbHandle.highlightElectrode(idx, true);
      }
      try {
        playToneTyped(c, hz, vol, dur, pan, tone);
      } catch (e) { /* swallow */ }

      var curIdx = idx;
      idx++;
      setTimeout(function() {
        if (sweepKbHandle && typeof sweepKbHandle.highlightElectrode === 'function') {
          sweepKbHandle.highlightElectrode(curIdx, false);
        }
        if (sweepAbort) {
          sweepRunning = false;
          sweepAbort   = false;
          if (sweepBtn) _swpUpdStyle(false);
          return;
        }
        // Pause zwischen Toenen — entfaellt nach dem letzten Ton.
        if (idx >= freqs.length) {
          step();
        } else {
          setTimeout(step, pauMs);
        }
      }, dur);
    }
    step();
  }

  // BA 241: Tonart-Wechsel stoppt einen laufenden Sweep.
  // Wird vom Tonart-Button-Click-Handler unten gerufen.
  function _abortSweepOnToneChange() {
    if (sweepRunning) sweepAbort = true;
  }
```

### 8. Tonart-Wechsel ruft Sweep-Stop — `js/tone-popup.js`

Im Tonart-Button-`click`-Handler (Z. ~378) am Anfang ergänzen — direkt
nach `if (playing) return;`:

```js
      btn.addEventListener('click', function() {
        if (playing) return;
        _abortSweepOnToneChange();
        var prev = dlg.querySelectorAll('.tone-btn--active');
```

### 9. Modal-Schließen stoppt Sweep — `js/tone-popup.js`

In der inneren Funktion `close()` (Z. ~575) am Anfang ergänzen:

```js
  function close() {
    // BA 241: Laufenden Sweep abbrechen.
    if (sweepRunning) sweepAbort = true;
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (typeof cfg.onModalClose === 'function') cfg.onModalClose();
  }
```

### 10. i18n-Key ergänzen — `i18n/de.js`

Nach den BA-240-Keys (`tonePopupVolume / tonePopupDuration /
tonePopupPause`) einen weiteren Key einfügen:

```js
    tonePopupSweepStart: "Sweep starten",
```

ASCII-`"` als String-Begrenzer.

### 11. Beim Tonart-Wechsel-OK auch Sweep stoppen — `js/tone-popup.js`

Im OK-Click-Handler (Z. ~582) am Anfang ergänzen:

```js
  okBtn.addEventListener('click', function() {
    if (sweepRunning) sweepAbort = true;
    if (selected !== initial) {
      cfg.setToneType(selected);
      if (typeof onChange === 'function') onChange();
    }
    close();
  });
```

(Cancel ist schon durch Schritt 9 abgedeckt — `close()` setzt
sweepAbort.)

## Akzeptanztest

Nach dem Build im Browser durchgehen. Die neue Funktionalität ist noch
nicht aktiv in einem Verbraucher — wir prüfen sie deshalb **künstlich**
über die DevTools-Konsole oder durch eine manuelle Aktivierung im
Freqmatch-Modal.

1. **Hard-Reload**, Version oben rechts ist `3.2.241-beta`.
2. **Tab Messungen → Sub-Tab Frequenzabgleich → Tonart-Knopf**:
   - Modal öffnet sich. Aussehen unverändert gegenüber 3.2.240:
     Hint, Toggles, Vol/Dur/Pau, Klavier, Tonart-Gruppen, OK/Cancel.
   - **Kein Sweep-Knopf** sichtbar (Freqmatch setzt `cfg.sweepMode`
     nicht auf true).
   - Klavier zeigt **keine** durchgestrichenen Tasten, weil Freqmatch
     `cfg.getDisabledElectrodes` nicht setzt (Bedingung erfüllt:
     Modal akzeptiert das Fehlen — leeres `disabledSet`).
3. **Klavier-Anschlag**: weiße und schwarze Tasten spielen wie vorher.
4. **Konsole prüfen** auf `ReferenceError` (z. B. `playToneTyped` ist
   global, `gAC` ist global — sollte beides existieren).
5. **Künstliche Aktivierung in der Konsole** für Disabled-Anzeige
   (Diagnose, der Nutzer kopiert den Befehl, drückt Enter, Klavier
   wird neu gerendert):

   ```js
   // Im offenen Freqmatch-Modal, vor dem Schliessen ausfuehren:
   document.querySelectorAll('.kb-key.kb-white').forEach(function(k, i) {
     if (i === 2 || i === 3) {
       k.classList.add('kb-key--disabled');
       k.style.background = '#d1d5db';
       k.style.cursor     = 'not-allowed';
     }
   });
   ```

   Das ersetzt **nicht** die Sonnet-Akzeptanz; es bestätigt nur das
   Stylesheet-Verhalten. Echte Disabled-Anzeige inkl. X-Overlay und
   Gruppen-Balken folgt in BA 242, wenn der Implantat-Tab
   `getDisabledElectrodes` setzt.

6. **Künstliche Aktivierung des Sweep-Knopfs** über die Konsole zur
   Diagnose der Sweep-Schleife: Im Freqmatch-Source temporär
   `sweepMode: true` setzen wäre ein Edit — statt dessen lassen wir
   den Sweep-Knopf in BA 241 ungetestet, weil sein erster echter
   Verbraucher in BA 242 anliegt. Sonnet meldet das ehrlich als
   „nicht aktivierbar in dieser BA, getestet in BA 242".

   Was Sonnet **stattdessen** in BA 241 prüft:
   - `renderSamplerKeyboard` gibt nach dem Render ein Objekt mit
     `highlightElectrode` zurück (per `console.log` im DevTools-
     Debugger oder ein temporärer Test-Log im Modal-Code, der nach
     Akzeptanz wieder entfernt wird).
   - Die Sweep-Funktion `_runSweep` ist syntaktisch korrekt
     definiert; ein `console.log(typeof _runSweep)` im Modal-Open-
     Code liefert `function`.

7. **Cancel/X im Modal**: weiterhin schließt es die Modal, kein
   Fehler in der Konsole.
8. **Bestätigung der Datei-Integrität:** keine verwaisten Sanduhr-
   Referenzen aus BA 240 nachträglich entstanden (grep `btn-hourglass`
   / `_setHourglassFor` ist leer).

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung:

- Akzeptanzpunkte 1–8 einzeln durchgehen, je Punkt erfüllt /
  nicht erfüllt / unklar mit Datei/Zeilen-Verweis.
- Konsolen-Fehler-Check nach Hard-Reload und nach Modal-Öffnen.
- Insbesondere prüfen:
  - In `sampler-keyboard.js`: `disabledSet`, `blackGroups`, das neue
    `return`-Handle sind alle deklariert und referenziert; keine
    `ReferenceError` beim Modal-Öffnen.
  - In `tone-popup.js`: `sweepRunning`, `sweepAbort`, `sweepKbHandle`,
    `_runSweep`, `_abortSweepOnToneChange` sind in der Closure
    erreichbar; keine `Uncaught`-Fehler.
  - Tonart-Auswahl im Freqmatch-Modal funktioniert noch (Vorspiel
    spielt nach Klick auf eine Tonart — der `_playPreview`-Pfad
    läuft unverändert).
  - `renderSamplerKeyboard` gibt tatsächlich ein Objekt zurück
    (Sonnet: temporärer Test-Log im Modal-Open-Code,
    `console.log('kbHandle', typeof sweepKbHandle);` direkt nach dem
    `renderSamplerKeyboard(...)`-Aufruf, **vor Fertig-Meldung wieder
    entfernen**).
- Bei `unklar` oder „nicht erfüllt": Bau pausieren, Rückfrage.

## Hinweis für spätere Folge-BA

Der neue i18n-Key `tonePopupSweepStart` ist nur Deutsch. EN/FR/ES
folgen bei Bedarf.

Nach BA 241 folgt:
- BA 242: Implantat-Tab Migration (sweepRow raus, Tonauswahl-Knopf rein
  mit allen Modal-Features inkl. Sweep und Klavier-Disabled)
- BA 243: freq-table Play/Hold-Spalten entfernen
