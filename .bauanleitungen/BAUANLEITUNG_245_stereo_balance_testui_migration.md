# BAUANLEITUNG 245 — Stereo-Balance auf testUI-API migrieren

**Ziel**: `js/lr-balance.js` auf die neue testUI-API umstellen
(buildTestPanel mit `header`/`verfahren`-Schema). Das ist Schritt 4
des Migrationsplans aus `docs/spec/00-testui-architektur.md`.

**Versions-Bump (am Anfang des Builds)**:
`js/version.js` von `3.2.244.1-beta` auf `3.2.245-beta` setzen.

**i18n**: Keine neuen Keys nötig. Alle benötigten Keys
(`lrRunningHint`, `btnSwapLR`, `btnPauseTest`, `cumulativeDb`,
`optRandom`, `optAsc`, `optDesc`, `optLR`, `optRL`, `lrOrderLbl`,
`lrSideLbl`) sind bereits in allen vier Sprachdateien vorhanden.
**Verwaiste Keys nicht löschen** (`lrRunningTitle` z.B. wird obsolet,
aber Aufräumen kommt in Schritt 6 des Migrationsplans).

**Vorbilder**: `js/latency.js` (BA 223) und `js/freqmatch.js` (BA 108) —
das sind die beiden bereits migrierten Module. `latency.js` ist das
jüngste und sauberste Vorbild für den Aufbau der cfg; `freqmatch-slider.js`
ist das Vorbild für Pause/Resume.

---

## Inhaltlicher Überblick (für Sonnet, vor dem Bau lesen)

Was sich beim Stereo-Balance ändert:

1. **testUI-cfg statt eigener `presets`/`test`-Struktur.** Aufbau analog
   `js/latency.js` Z. 427-474.
2. **Elektroden-Auswahl-Baustein im Header** (`electrodeSelection`,
   BA 207). Eine Elektrode ist testbar, wenn sie **auf beiden Seiten**
   weder ausgeschlossen noch stumm ist.
3. **Reihenfolge- und Seitenfolge-Auswahl** wandern aus dem alten
   `presets.rowMode` in ein `header.extra.fragment`. Die zwei Selects
   werden vom Test-Modul selbst gebaut und ins Fragment gehängt
   (analog Latenz mit `_latBuildExtraFragment()`).
4. **Pause/Resume** (`stopKey: 'btnPauseTest'`, `resumable: true`).
   `lrSeq` und `lrSeqIdx` bleiben beim Pausieren erhalten; beim
   erneuten Start wird die laufende Sequenz fortgesetzt. Beim ersten
   Start oder nach `lrFinish()` baut sich die Sequenz neu auf.
5. **Swap-Aktion neu in testUI** — `actions` bekommt einen
   zusätzlichen zulässigen Wert `'swap'` mit Hook `onSwap` und
   Tastatur-Shortcut `S`. Beschriftung über bestehenden Key
   `btnSwapLR`.
6. **`pairIndicator { variant: 'side' }`** ersetzt die eigene
   `lrSetSideActive`-CSS-Manipulation. testUI macht das Aufleuchten
   automatisch über `testUI.pairIndicator.setPlaying(els, 'left'|'right'|'both'|null)`.
7. **Slider mit Auto-Extend** (`initialRange: 20, maxRange: 60`). Die
   alte 3-Stufen-Logik (`LR_SLIDER_RANGES`, `_lrRstSlR`, `_lrExtSlider`,
   `_lrCheckExtend`) entfällt komplett. Slider-Touch-Buttons baut testUI
   selbst (`touchStep: 0.5, touchFineStep: 0.1`).
8. **Konfidenz-Baustein entfällt** (war im Code mitgeschleppt, aber
   nie ausgewertet — `confidenceNotStored`-Hinweis). Konsistent mit
   freqmatch.
9. **Tastatur-Shortcuts** werden von testUI übernommen. Eigener
   `keydown`-Listener entfällt komplett. Z-Undo wird zu Backspace-Undo.
10. **Exclude-Buttons während des Trials** entfallen (waren ohnehin
    `show: false`). `_lrRequestExcl`, `lrEls.exclOverlay` raus.
11. **Cumulative-Display** bleibt — als `cumulativeDisplay`-Baustein.
12. **`lrRunningTitle`/`lrRunningHint`**: Title rendert testUI
    automatisch (Lifecycle, BA 109). Hint wird als
    `instruction { key: 'lrRunningHint' }`-Baustein eingehängt.

---

## SCHRITT 1 — testUI um Action `'swap'` erweitern

**Datei**: `js/test-ui.js`

### 1.1 Render-Block für die `swap`-Action

In der `body.actions.forEach`-Schleife (heute Z. 1434-1464) den
bestehenden `if/else if`-Block um einen weiteren Zweig ergänzen.
Position: nach dem `'pause'`-Zweig, vor `actRow.appendChild(btn);`.

**Snippet (in test-ui.js Z. ~1462 einfügen, direkt vor dem
schließenden `}` der forEach-Funktion)**:

```js
        } else if (act === 'swap') {
          btn.innerHTML = '&#x21C4; <span data-t="btnSwapLR"></span> <span class="kbd">S</span>';
          actRefs.swap = btn;
          if (vCfg.hooks && vCfg.hooks.onSwap) {
            btn.addEventListener('click', function() { vCfg.hooks.onSwap(); });
          }
        }
```

(Das Zeichen `&#x21C4;` ist der Doppelpfeil ⇄, derselbe der heute im
i18n-Wert `btnSwapLR: "⇄ L↔R"` steckt. Der i18n-Text bringt das
Symbol nochmal mit, das ist gewollt — das HTML-Entity vorne ist
Default-Marker, falls i18n ausfällt.)

### 1.2 Tastatur-Shortcut `S` für Swap

In der Keyboard-Handler-Funktion von test-ui.js (suche nach
`'ArrowLeft'`, `'ArrowRight'`, `'Backspace'` — sie steht im
DOMContentLoaded-Block der testUI; suche speziell nach dem
`B`-Shortcut für Simul, das ist die Stelle, wo auch `S` hingehört).

**Suchmuster**: Es gibt einen Block, der etwa so aussieht:

```js
} else if (e.key === 'b' || e.key === 'B') {
  // Simul-Shortcut
  ...
}
```

**Direkt danach einfügen**:

```js
        } else if (e.key === 's' || e.key === 'S') {
          var swapBtn = activeRefs && activeRefs.actions && activeRefs.actions.swap;
          if (swapBtn && !swapBtn.disabled) {
            e.preventDefault();
            swapBtn.click();
          }
        }
```

Falls der vorhandene Block für `'B'` (Simul) anders strukturiert ist
(z.B. mit `_clickActionBtn('simul')`-Helfer), das vorhandene Muster
exakt übernehmen und nur `'simul'` durch `'swap'` und den Buchstaben
durch `'s'/'S'` ersetzen. **Wichtig**: Vor dem Schreiben des
Snippets prüfen, wie der Simul-Shortcut im Code aktuell aussieht, und
das Muster spiegeln.

### 1.3 Replay-Sperre-Liste

Im selben Bereich gibt es eine Liste von Buttons, die während Audio-
Wiedergabe automatisch `disabled` werden (`actRefs.undo`, `actRefs.simul`
etc. — suche nach `_playLockBtns` oder dem Push der Action-Buttons in
eine Liste).

**Frage zur Klärung an User wenn unklar**: Soll Swap während Audio-
Wiedergabe auch gesperrt sein? **Default-Annahme**: ja, weil ein
Swap mitten in einer Wiedergabe akustisch verwirrend ist.
Falls eine Replay-Sperr-Liste existiert, `actRefs.swap` dort
ebenfalls aufnehmen (analog zu `actRefs.undo`, `actRefs.simul`).

---

## SCHRITT 2 — `js/lr-balance.js` komplett umstellen

**Strategie**: Den DOMContentLoaded-Block (heute Z. 730-936) komplett
ersetzen, und alle nicht mehr benötigten Helfer im oberen Teil
löschen.

### 2.1 Modul-Konstanten und Helfer ENTFERNEN

Diese Blöcke aus `js/lr-balance.js` ersatzlos **löschen**:

- Z. 22-23: `const LR_SLIDER_RANGES = [20, 40, 60];` und
  `let lrSlRangeIdx = 0;`
- Z. 26-33: Funktion `_lrRstSlR()`
- Z. 35-44: Funktion `_lrExtSlider()`
- Z. 46-52: Funktion `_lrCheckExtend()`
- Z. 232-266: Funktion `lrSetSideActive()` (wird durch
  `testUI.pairIndicator.setPlaying` ersetzt)
- Z. 403-422: Funktion `_lrRequestExcl()` (Exclude-Buttons entfallen)

### 2.2 Modul-State ergänzen

Direkt unter `let lrIsPlay = false;` (heute Z. 16) einen neuen Block
einfügen:

```js
// BA 245: Elektroden-Auswahl für den Test (null = alle testbaren).
let lrSelectedEls = null;
```

### 2.3 `_lrUpdSliderDisplay`, `_lrUpdCumulative` anpassen

Die heutige `_lrUpdSliderDisplay`-Funktion (Z. 58-63) ist obsolet,
weil testUI über den `sliderValue`-Baustein die Anzeige selbst
aktualisiert. **Löschen**.

Die `_lrUpdCumulative`-Funktion (Z. 65-75) wird beibehalten, aber sie
liest jetzt aus `lrEls.verfahren.balance.cumulativeDisplay` statt aus
`lrEls.cumulativeDisplay`. **Ersetzen**:

```js
function _lrUpdCumulative(v) {
  if (!lrEls) return;
  var cd = lrEls.verfahren && lrEls.verfahren.balance
    && lrEls.verfahren.balance.cumulativeDisplay;
  if (!cd) return;
  const existing = lrCurrentEl !== null ? lrResults[lrCurrentEl] : undefined;
  if (existing !== undefined) {
    cd.textContent =
      t("cumulativeDb") + ": " + (existing >= 0 ? "+" : "") + existing.toFixed(1) + " dB";
    cd.style.display = "";
  } else {
    cd.style.display = "none";
  }
}
```

### 2.4 `_lrGetMode` anpassen

Die heutige Funktion liest `slTarget_balance`. Das bleibt — die
state-side-Persistenz ist unabhängig von der testUI.

```js
function _lrGetMode() {
  return slTarget_balance || "both";
}
```

(Unverändert lassen, falls so schon vorhanden.)

### 2.5 `_lrSliderVal` anpassen

Die Slider-Referenz liegt jetzt unter
`lrEls.verfahren.balance.slider.input`. **Ersetzen**:

```js
function _lrSliderVal() {
  if (!lrEls) return 0;
  var sl = lrEls.verfahren && lrEls.verfahren.balance
    && lrEls.verfahren.balance.slider && lrEls.verfahren.balance.slider.input;
  return sl ? parseFloat(sl.value) : 0;
}
```

### 2.6 `lrGVol`, `lrGDur`, `lrGPau` anpassen

Die heutigen Funktionen lesen `lrEls.volInput`, `lrEls.durInput`,
`lrEls.pauseInput`. Mit der neuen API liegen die Felder unter
`lrEls.header.volInput`, `lrEls.header.durInput`, `lrEls.header.pauseInput`.

**Ersetzen**:

```js
function lrGVol() {
  if (lrEls && lrEls.header && lrEls.header.volInput)
    return Math.pow(parseInt(lrEls.header.volInput.value) / 100, 2);
  return Math.pow(50 / 100, 2);
}
function lrGDur() {
  if (lrEls && lrEls.header && lrEls.header.durInput)
    return parseInt(lrEls.header.durInput.value) || 1000;
  return 1000;
}
function lrGPau() {
  if (lrEls && lrEls.header && lrEls.header.pauseInput)
    return parseInt(lrEls.header.pauseInput.value) || 400;
  return 400;
}
```

### 2.7 `lrPlayCurrent` — Aufleuchten umstellen

In der heutigen `lrPlayCurrent`-Funktion (Z. 120-183) werden vor und
nach jeder Tonausgabe `lrSetSideActive(...)`-Aufrufe gemacht. Diese
**durch `testUI.pairIndicator.setPlaying(...)` ersetzen**.

Die Refs liegen unter `lrEls.verfahren.balance.pairIndicator`.

**Ersetzungstabelle**:

| Alt | Neu |
|---|---|
| `lrSetSideActive(firstSide);` | `testUI.pairIndicator.setPlaying(lrEls.verfahren.balance.pairIndicator, firstSide);` |
| `lrSetSideActive(null);` (zwischen den Tönen) | `testUI.pairIndicator.setPlaying(lrEls.verfahren.balance.pairIndicator, null);` |
| `lrSetSideActive(secondSide);` | analog mit `secondSide` |
| `lrSetSideActive("both");` (in `lrPlaySimul`) | analog mit `'both'` |

`firstSide` und `secondSide` bleiben semantisch `"left"`/`"right"` —
diese Werte passen direkt zum `setPlaying`-API.

### 2.8 `lrStopPlay` — Aufleuchten umstellen

In `lrStopPlay()` (Z. 217-230) den Aufruf
`lrSetSideActive(null);` ersetzen durch:

```js
  if (lrEls && lrEls.verfahren && lrEls.verfahren.balance
      && lrEls.verfahren.balance.pairIndicator) {
    testUI.pairIndicator.setPlaying(lrEls.verfahren.balance.pairIndicator, null);
  }
```

### 2.9 `lrBuildSequence` — Auswahl-Filter ergänzen

In der heutigen `lrBuildSequence`-Funktion (Z. 268-299) wird die
Liste `available` aus beidseitig testbaren Elektroden gebaut. Diese
muss zusätzlich gegen `lrSelectedEls` gefiltert werden (falls nicht
`null`).

Direkt nach der `available.push(i)`-Schleife (vor dem Mode-Check):

```js
  // BA 245: Filter gegen Nutzer-Auswahl
  var filtered;
  if (lrSelectedEls === null) {
    filtered = available;
  } else {
    var selSet = new Set(lrSelectedEls);
    filtered = available.filter(function(i) { return selSet.has(i); });
  }
```

Und die folgenden Zugriffe auf `available` durch `filtered` ersetzen:

```js
  const mode = (lrEls && lrEls.header && lrEls.header.modeSelect)
    ? lrEls.header.modeSelect.value : "random";
  if (mode === "ascending") {
    lrSeq = filtered.slice();
  } else if (mode === "descending") {
    lrSeq = filtered.slice().reverse();
  } else {
    const arr = filtered.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    lrSeq = arr;
  }
  lrSeqIdx = 0;
```

(Hinweis: `modeSelect`/`runSelect` werden im Header über das
`extra.fragment` gebaut — siehe Schritt 2.13. Die Refs werden manuell
auf `lrEls.header.modeSelect` und `lrEls.header.runSelect` gelegt.)

### 2.10 `lrDetermineFlip` anpassen

```js
function lrDetermineFlip() {
  const mode = (lrEls && lrEls.header && lrEls.header.runSelect)
    ? lrEls.header.runSelect.value : "random";
  if (mode === "lr") return false;
  if (mode === "rl") return true;
  return Math.random() < 0.5;
}
```

### 2.11 `lrShowPair` — auf neue Slider-API

Die heutige `lrShowPair`-Funktion (Z. 308-372) nutzt eigene Slider-
Range-Logik und schreibt direkt in `lrEls.pairLeft`/`lrEls.pairRight`/
`lrEls.pairFreq`. Beides anpassen:

**Slider-Setup ersetzen** (heute Z. 320-335):

```js
  // Slider: existing-Wert oder 0 setzen; Range wird über setValue automatisch erweitert
  var slRef = lrEls.verfahren && lrEls.verfahren.balance && lrEls.verfahren.balance.slider;
  const existing = lrResults[el];
  if (slRef) {
    var startVal = (existing !== undefined && isFinite(existing)) ? existing : 0;
    testUI.slider.setValue(slRef, startVal);
  }
```

**pairIndicator-Labels und Hz-Zeile ersetzen** (heute Z. 346-362):

```js
  // pairIndicator: variant 'side', Labels mit Hz-Zeile
  const leftLabel = withSide("left", () => dENPrefix("left") + dEN(el));
  const rightEl = el < sideData["right"].nEl ? el : sideData["right"].nEl - 1;
  const rightLabel = withSide("right", () => dENPrefix("right") + dEN(rightEl));
  const hzL = lrEffFreq("left", el);
  const hzR = lrEffFreq("right", rightEl);
  var piRef = lrEls.verfahren.balance.pairIndicator;
  if (piRef) {
    testUI.pairIndicator.setLabels(piRef, {
      leftLabel:  "L: " + leftLabel,
      rightLabel: "R: " + rightLabel,
      leftHz:     hzL,
      rightHz:    hzR
    });
  }
```

(Falls `testUI.pairIndicator.setLabels` ein anderes Argument-Schema
erwartet, sich an `js/freqmatch-slider.js` orientieren — dort wird
`setLabels` analog verwendet. Vor dem Schreiben in test-ui.js nachsehen.)

**Progress-Update ersetzen** (heute Z. 340-344):

```js
  // Progress über testUI-Helfer
  var prRef = lrEls.verfahren.balance.progress;
  if (prRef) {
    testUI.progress.set(prRef, {
      current: lrSeqIdx + 1,
      total:   lrSeq.length
    });
  }
```

**Undo-Disabled-Update ersetzen** (heute Z. 365):

```js
  var undoBtn = lrEls.verfahren && lrEls.verfahren.balance
    && lrEls.verfahren.balance.actions && lrEls.verfahren.balance.actions.undo;
  if (undoBtn) undoBtn.disabled = lrUndoStack.length === 0;
```

**Confidence-Reset (Z. 367-369): komplett LÖSCHEN.**

### 2.12 `lrConfirm`, `lrUndo`, `lrFinish`, `lrStop` — leichte Anpassungen

`lrConfirm` (Z. 374-389) bleibt funktional gleich; ggf. `lrEls.testBox`-
Zugriffe prüfen, ob sie an der Stelle noch passen (testUI gibt eine
`testBox`-Ref zurück, das funktioniert weiter).

`lrUndo` (Z. 391-401) bleibt gleich.

`lrFinish` (Z. 424-437) ersetzen:

```js
function lrFinish() {
  lrStopPlay();
  lrRunning = false;
  lrSeq = [];           // BA 245: Sequenz beendet, kein Resume möglich
  lrSeqIdx = 0;
  if (lrEls && lrEls._stopTest) lrEls._stopTest();
  lockTestTabs(false, null);
  if (typeof depLockApply === 'function') depLockApply();
  lrRenderResults();
  lrApplyMeanToBalance();
}
```

`lrStop` (Z. 439-451) wird zu `lrPause`:

```js
// BA 245: "Stop" ist semantisch Pause - lrSeq und lrSeqIdx bleiben erhalten.
function lrPause() {
  lrStopPlay();
  lrRunning = false;
  if (lrEls && lrEls._stopTest) lrEls._stopTest();
  lockTestTabs(false, null);
  if (typeof depLockApply === 'function') depLockApply();
  lrRenderResults();
}
```

### 2.13 DOMContentLoaded-Block komplett ersetzen

Den heutigen Block (Z. 730-936) **komplett ersetzen** durch den
folgenden:

```js
// ---- DOMContentLoaded — buildTestPanel + Event-Wiring ----

function _lrBuildExtraFragment() {
  // Reihenfolge-Auswahl und Seitenfolge-Auswahl als Sub-Reiter-spezifisches Fragment
  var frag = document.createElement('div');
  frag.className = 'controls-row';
  frag.dataset.row = 'lr-extra';

  // Reihenfolge der Elektroden
  var lblMode = document.createElement('label');
  lblMode.dataset.t = 'lrOrderLbl';
  var modeSelect = document.createElement('select');
  modeSelect.id = 'lrOrderSelect';
  [['random','optRandom'],['ascending','optAsc'],['descending','optDesc']]
    .forEach(function(opt) {
      var o = document.createElement('option');
      o.value = opt[0]; o.dataset.t = opt[1];
      modeSelect.appendChild(o);
    });
  lblMode.appendChild(modeSelect);

  // Seitenfolge
  var lblSide = document.createElement('label');
  lblSide.dataset.t = 'lrSideLbl';
  var runSelect = document.createElement('select');
  runSelect.id = 'lrSideSelect';
  [['random','optRandom'],['lr','optLR'],['rl','optRL']]
    .forEach(function(opt) {
      var o = document.createElement('option');
      o.value = opt[0]; o.dataset.t = opt[1];
      runSelect.appendChild(o);
    });
  lblSide.appendChild(runSelect);

  frag.append(lblMode, lblSide);
  // Refs an das Fragment hängen, damit wir sie nach buildTestPanel referenzieren können
  frag._lrModeSelect = modeSelect;
  frag._lrRunSelect  = runSelect;
  return frag;
}

document.addEventListener("DOMContentLoaded", function() {
  var parentEl = document.getElementById("subpanel-messungen-balance");
  if (!parentEl) return;

  var extraFrag = _lrBuildExtraFragment();

  var cfg = {
    id: 'balance',
    explain: {
      titleKey: 'lrTitle',
      paragraphs: [
        { key: 'lrMaturityHint', kind: 'info'  },
        { key: 'lrDesc',         kind: 'plain' },
        { key: 'lrPrereqHint',   kind: 'plain' }
      ]
    },
    header: {
      common: {
        refSelect: false,
        volume:    { show: true },
        duration:  { show: true, default: 1000, min: 100, max: 3000, step: 50 },
        pause:     { show: true, default: 400,  min: 50,  max: 2000, step: 50 },
        toneType:  { show: true, source: 'global' },
        sequence:  { show: true, source: 'global' },
        sliderTarget: {
          options:  ['left','right','both'],
          stateKey: 'slTarget_balance',
          default:  'both'
        },
        electrodeSelection: {
          minSelected: 1,
          getSelection: function() { return lrSelectedEls; },
          setSelection: function(sel) { lrSelectedEls = sel.slice(); },
          getElectrodeStatus: function() {
            // Eine Elektrode ist testbar, wenn sie auf BEIDEN Seiten
            // weder ausgeschlossen noch stumm ist. Mind. eine Seite
            // ausgeschlossen -> 'excluded'; sonst mind. eine Seite mute
            // -> 'muted'; sonst 'testable'.
            var leftN  = sideData.left.nEl;
            var rightN = sideData.right.nEl;
            var count  = Math.min(leftN, rightN);
            var testable = [], muted = [], excluded = [];
            for (var i = 0; i < count; i++) {
              var rightI = i < rightN ? i : rightN - 1;
              var exL = sideData.left.elExDur[i]      !== null;
              var exR = sideData.right.elExDur[rightI] !== null;
              var muL = sideData.left.elSt[i]         === 'mute';
              var muR = sideData.right.elSt[rightI]    === 'mute';
              if (exL || exR)      excluded.push(i);
              else if (muL || muR) muted.push(i);
              else                 testable.push(i);
            }
            return { testable: testable, muted: muted, excluded: excluded };
          },
          electrodeLabel: function(i) {
            // Bezeichnung links + Hz; rechts nur, wenn der Index dort existiert
            var leftLabel = withSide("left",  function() { return dENPrefix("left")  + dEN(i); });
            var hzL = lrEffFreq("left", i);
            return leftLabel + " (" + Math.round(hzL) + " Hz)";
          }
        }
      },
      extra: { fragment: extraFrag },
      startStop: { startKey: 'btnStartTest', stopKey: 'btnPauseTest', resumable: true }
    },
    verfahren: [{
      id: 'balance',
      labelKey:   'lrVerfahrenLabel',  // wird nicht angezeigt (nur 1 Verfahren), aber Pflicht
      explainKey: null,
      body: {
        pairIndicator:     { variant: 'side' },
        progress:          { format: 'simple' },
        instruction:       { key: 'lrRunningHint' },
        keyHint:           { unitKey: 'sliderHintDb' },
        slider:            { unit: 'dB', initialRange: 20, maxRange: 60, touchStep: 0.5, touchFineStep: 0.1 },
        sliderValue:       { show: true },
        cumulativeDisplay: { key: 'cumulativeDb' },
        confirmButton:     { key: 'btnConfirmOffset' },
        actions:           ['undo','replay','simul','swap']
      },
      hooks: {
        onStart:   lrHookOnStart,
        onStop:    lrHookOnStop,
        onSlide:   lrHookOnSlide,
        onConfirm: lrConfirm,
        onReplay:  lrPlayCurrent,
        onUndo:    lrUndo,
        onSimul:   lrPlaySimul,
        onSwap:    lrHookOnSwap
      }
    }]
  };

  lrEls = buildTestPanel(parentEl, cfg);

  // Refs aus dem extra-Fragment in lrEls.header aufnehmen, damit
  // lrBuildSequence / lrDetermineFlip sie über lrEls.header.{modeSelect,runSelect}
  // adressieren können.
  if (lrEls && lrEls.header) {
    lrEls.header.modeSelect = extraFrag._lrModeSelect;
    lrEls.header.runSelect  = extraFrag._lrRunSelect;
  }

  // Slider-Live-Anzeige aktualisiert auch das cumulativeDisplay
  var slInput = lrEls.verfahren && lrEls.verfahren.balance
    && lrEls.verfahren.balance.slider && lrEls.verfahren.balance.slider.input;
  if (slInput) {
    slInput.addEventListener('input', function() {
      _lrUpdCumulative(parseFloat(this.value));
    });
  }

  // Clear-Button im Ergebnis-Sub-Tab
  var lrClearBtn = document.getElementById('lrClearBtn');
  if (lrClearBtn) {
    lrClearBtn.addEventListener('click', function() {
      if (!confirm(t("lrClearConfirm") || "LR-Vergleichsergebnisse löschen?")) return;
      lrResults = {};
      lrSnapshot = null;
      if (typeof depLockApply === 'function') depLockApply();
      var lrRC = document.getElementById("lrResultsCard");
      if (lrRC) lrRC.style.display = "none";
      var lrNR = document.getElementById("lrNoResults");
      if (lrNR) lrNR.style.display = "";
    });
  }
});

// Hook into balance subtab activation
document
  .querySelector('.subtab[data-subtab="balance"][data-parent="messungen"]')
  ?.addEventListener('click', function() {
    setTimeout(function() { lrCheckData(); }, 0);
  });

// Hook into lrresults subtab activation
document
  .querySelector('.subtab[data-subtab="lrresults"][data-parent="ergebnisse"]')
  ?.addEventListener('click', function() {
    setTimeout(function() { lrCheckData(); lrDrawChart(); }, 0);
  });
```

### 2.14 Neue Hook-Funktionen ergänzen

Vor dem DOMContentLoaded-Block, im Funktions-Bereich, diese drei neuen
Hook-Funktionen ergänzen:

```js
// BA 245: testUI-Hooks

function lrHookOnStart() {
  // Voraussetzungs-Sperre (BA 155)
  if (typeof isSideUsable === 'function'
      && (!isSideUsable('left') || !isSideUsable('right'))) {
    alert(t('lrBlockedSideUnknown'));
    if (lrEls && lrEls._stopTest) lrEls._stopTest();
    return;
  }
  // Resume: Sequenz und Position erhalten, nur Zustand wieder hochfahren
  if (!lrSeq || !lrSeq.length || lrSeqIdx >= lrSeq.length) {
    lrBuildSequence();
  }
  if (!lrSeq.length) {
    alert(t("lrNoElMsg") || "Keine gemeinsamen aktiven Elektroden gefunden.");
    if (lrEls && lrEls._stopTest) lrEls._stopTest();
    return;
  }
  lrRunning = true;
  lrUndoStack = [];
  lockTestTabs(true, 'balance');
  lrShowPair();
}

function lrHookOnStop() {
  // "Stop" ist Pause - Sequenz bleibt erhalten
  lrPause();
}

function lrHookOnSlide(v) {
  _lrUpdCumulative(v);
}

function lrHookOnSwap() {
  lrFlipped = !lrFlipped;
  lrPlayCurrent();
}
```

### 2.15 `lrCheckData` — snapHintBox-Zugriff anpassen

In `lrCheckData()` (Z. 711-728) den Zugriff auf `lrEls.snapHintBox`
prüfen. testUI gibt diese Ref direkt unter `lrEls.snapHintBox` zurück
(siehe `latency.js:571-572`). Wenn der Zugriff schon so aussieht,
unverändert lassen.

### 2.16 Statisches HTML in `index.html`

Heute ist `<div id="subpanel-messungen-balance" class="subpanel"></div>`
bereits leer (`index.html:478`). **Nichts zu ändern.**

---

## SCHRITT 3 — Dokumentation aktualisieren

### 3.1 `docs/spec/00-testui-architektur.md`

**Bausteine-Katalog** (Tabelle): Die Zeile für `actions` anpassen:

```
| `actions` | Aktionsleiste: Undo/Replay/Simul/Swap/Pause | Array von `'undo'`/`'replay'`/`'simul'`/`'swap'`/`'pause'` | `onUndo()`, `onReplay()`, `onSimul()`, `onSwap()` (lr-balance: L↔R-Tauschen während Trial), `onPause()` |
```

**Pfeiltasten-Mapping** (Tabelle): Neue Zeile einfügen, direkt nach
der `B`-Zeile (Simul):

```
| S | L↔R-Tauschen (Stereo-Balance) | `actions` enthält `'swap'` |
```

**Migrationsplan** Schritt 4: Auf gebaut setzen, ähnlich Schritt 5:

```
**Schritt 4 — Stereo-Balance migrieren** *(Bauanleitung)* ✅ gebaut (BA 245)

- `lr-balance.js` auf testUI-API umgestellt
- Reihenfolge- (random/ascending/descending) und Seitenfolge-Auswahl
  (random/lr/rl) wandern in `header.extra.fragment`
- `pairIndicator { variant: 'side' }` ersetzt die eigene
  `lrSetSideActive`-CSS-Manipulation; Aufleuchten der L/R-Box
  beim Tonabspielen läuft jetzt über den testUI-Helfer
- Slider mit Auto-Extend (`initialRange: 20, maxRange: 60`); alte
  3-Stufen-Logik (`LR_SLIDER_RANGES`, `_lrRstSlR`, `_lrExtSlider`)
  entfernt
- Pause/Resume: `stopKey: 'btnPauseTest'`, `resumable: true`. `lrSeq`
  und `lrSeqIdx` bleiben beim Pausieren erhalten; beim erneuten
  Start wird die Sequenz an der gleichen Stelle fortgesetzt
- Konfidenz-Baustein entfällt (war nie ausgewertet)
- Exclude-Buttons während des Trials entfallen (waren `show: false`);
  stattdessen `header.common.electrodeSelection` mit beidseitiger
  Status-Logik (testbar = beide Seiten weder excluded noch mute)
- Neuer testUI-Aktionswert `'swap'` mit Hook `onSwap` und Shortcut `S`;
  i18n-Key `btnSwapLR` bereits vorhanden
- Eigenes Keyboard-Listener und Z-Undo entfernt; testUI-Pfeiltasten-
  Routing und Backspace-Undo greifen
- Akzeptanztest: Sequenzen werden korrekt abgespielt, Swap funktioniert,
  Pause/Resume funktioniert, Elektroden-Auswahl filtert die Sequenz
```

### 3.2 `docs/spec/02-messung.md`

Im Abschnitt **Sub-Tab 2 — Stereo-Balance** (Z. 266 ff.) folgendes
ergänzen (Reihenfolge in der Aufzählung sinngemäß einordnen, nicht
am Ende anhängen):

- Reihenfolge der Elektroden und Seitenfolge wandern in
  `header.extra.fragment` als balance-spezifische Voreinstellungen.
- Elektroden-Auswahl (`header.common.electrodeSelection`, BA 207):
  Eine Elektrode ist nur testbar, wenn sie auf beiden Seiten weder
  ausgeschlossen noch stumm ist. Mindestens eine Elektrode muss
  gewählt sein.
- Pause/Resume (BA 245): Der Stop-Knopf heißt „Test pausieren".
  Beim erneuten Start setzt der Test die Sequenz an der gleichen
  Stelle fort. Erst wenn alle Elektroden bestätigt wurden (oder die
  Auswahl/Excludes sich so geändert haben, dass die Sequenz neu
  aufgebaut werden muss), startet er bei Position 0.

### 3.3 `docs/CODESTRUKTUR.md`

In der Modul-Beschreibung von `lr-balance.js` ergänzen:

- Hinweis „nutzt buildTestPanel (testUI-API)"
- Die alte Slider-Range-Logik (`LR_SLIDER_RANGES`) ist entfernt
- Die alte `lrSetSideActive`-CSS-Funktion ist entfernt

---

## Akzeptanztest

Schritt-für-Schritt, ohne Code-Kenntnis nachvollziehbar.

1. **Browser-Cache hart leeren** (Strg+Shift+R). Versionsanzeige am
   unteren Bildschirmrand muss auf `3.2.245-beta` umschalten.
2. **Tab „Messungen" → Sub-Tab „Stereo-Balance" öffnen.**
3. Erwartet: Erklär-Box („Hinweis", „Vorbedingungs-Hinweis"). Header
   mit Voreinstellungen (Lautstärke, Dauer, Pause, Tonart, Tonfolge,
   Slider-Wirkung, Reihenfolge, Seitenfolge, „X von N Elektroden
   gewählt" mit Knopf, „Test starten"/„Test pausieren"-Buttons).
4. **Knopf neben „X von N Elektroden gewählt"** klicken. Modal-Dialog
   öffnet sich. Erwartet: Alle aktiven Elektroden (beidseitig testbar)
   ankreuzbar; nicht-testbare (auf mindestens einer Seite excluded
   oder mute) abgegraut mit Suffix „(stumm)" oder „(ausgeschlossen)".
   „Alle wählen" / „Keine wählen" funktionieren auf den testbaren.
5. **Eine Elektrode abwählen** (z.B. E1), „Bestätigen" klicken.
   Erwartet: Header-Anzeige aktualisiert sich („X−1 von N gewählt").
6. **„Test starten"** klicken. Erwartet:
   - Roter „Test pausieren"-Button aktiv, Voreinstellungen ausgegraut
   - Test-Block sichtbar mit Title („Stereo-Balance-Test läuft"),
     Progress („1 von X"), Pair-Indikator („L: E2 / R: E2 / Hz-Zeile"),
     Anweisung („Passen Sie die Lautstärke an…"), Pfeiltasten-Hinweis,
     Slider mit Werte-Anzeige, Cumulative-Display (versteckt wenn kein
     existierender Wert), „Offset bestätigen"-Button, Action-Buttons
     („Zurück", „Wiederholen", „Gleichzeitig", „L↔R"), kein
     Konfidenz-Block
   - Erste Elektrode (E2 ohne E1) wird abgespielt; pair-Indikator
     leuchtet links auf, dann rechts (oder umgekehrt, je nach Seitenfolge)
   - **Die abgewählte E1 darf in der Sequenz NICHT vorkommen.**
7. **Pfeiltasten ←/→** verschieben den Slider in 0,5-dB-Schritten,
   Shift + ←/→ in 0,1-dB-Schritten. Werte-Anzeige aktualisiert sich.
8. **Leertaste**: spielt den Trial nochmal ab.
9. **„L↔R"-Button (oder Taste S)** drücken: nächste Wiedergabe
   beginnt mit der anderen Seite. Pair-Indikator-Aufleuchten ist
   entsprechend gedreht.
10. **Slider auf ±19,5 dB schieben**: Slider erweitert seinen Bereich
    automatisch (kein Extend-Button mehr).
11. **„Offset bestätigen"** (oder Enter) klicken. Erwartet: Trial-
    Counter springt auf „2 von X", neue Elektrode geladen, Cumulative-
    Display zeigt 0,0 dB nur, wenn die nächste Elektrode schon einen
    Wert hat (sonst versteckt).
12. **Backspace** drücken: zurück zur vorigen Elektrode, Slider zeigt
    den damals gesetzten Wert.
13. **Tastenkombination „Z"**: hat **keine** Wirkung mehr (alter
    Shortcut entfällt).
14. **Mitten im Test „Test pausieren"** klicken. Erwartet:
    - Roter Button wird zu „Test starten"
    - Test-Block bleibt sichtbar oder verschwindet (je nach testUI-
      Lifecycle); Voreinstellungen wieder aktiv
    - Bisher bestätigte Werte bleiben in der Ergebnis-Tabelle erhalten
15. **„Test starten"** drücken (Resume). Erwartet:
    - Test setzt an der gleichen Stelle fort (Counter „3 von X" wenn
      vorher 2 bestätigt waren, Slider auf 0)
    - Elektroden, die schon bestätigt wurden, kommen NICHT erneut
16. **Auswahl ändern** (Auswahl-Modal öffnen, weitere Elektrode
    abwählen). Erwartet: nicht beim laufenden Test — bei pausiertem
    Test ist das nicht zwingend, kann aber die nächste Sequenz beim
    nächsten Start neu aufbauen (wenn `lrBuildSequence` durchläuft).
    Akzeptabel: Reset der Sequenz bei nächstem Start.
17. **Alle Elektroden durchgespielt**. Erwartet: Test-Block
    verschwindet automatisch (`lrFinish`), Ergebnisse aktualisiert.
18. **Sub-Tab „Ergebnisse → Stereo-Balance"**: alle bestätigten Werte
    in der Tabelle, Diagramm korrekt gezeichnet, abgewählte Elektroden
    werden korrekt dargestellt (sind sie ja im Test nicht gemessen).
19. **Klicken auf „Ergebnisse löschen"**: nach Bestätigung leer.

**Mobile-Pfad (falls möglich)**:

20. **Auf Mobil im Browser öffnen**. Erwartet: dieselbe UI erscheint,
    Voreinstellungs-Selects sind read-only (`applyMobileReadonly`),
    Test startet trotzdem.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Position 1 bis 19 einzeln
durchgehen und für jede melden: **erfüllt / nicht erfüllt / unklar**,
mit Datei- und Zeilenangabe der relevanten Code-Stelle.

Zusätzliche Punkte, die Sonnet selbst gegenchecken muss, bevor die
Bauanleitung als gebaut gemeldet wird:

- **Versions-Bump**: `js/version.js` zeigt `3.2.245-beta`.
- **Keine Reste der Alt-API**: Eine `grep`-Suche in `js/lr-balance.js`
  nach `LR_SLIDER_RANGES`, `_lrRstSlR`, `_lrExtSlider`, `_lrCheckExtend`,
  `lrSetSideActive`, `_lrRequestExcl`, `confRadios`, `presets:`,
  `modeOptions`, `rowMode`, `rowFine`, `rowVolume`, `rowSequence`,
  `extendBtn`, `swapBtn`, `excludeLeftBtn`, `excludeRightBtn`,
  `pairLeft`, `pairRight`, `pairFreq` darf KEINE Treffer mehr liefern
  (außer Kommentare oder Spec-Verweise).
- **Keine Reste des Keyboard-Listeners**: In `js/lr-balance.js` darf
  kein `document.addEventListener('keydown'...)` mehr stehen.
- **testUI-Erweiterung**: In `js/test-ui.js` ist `'swap'` als
  Action-Wert ergänzt; Tastatur-Shortcut `S` löst den Swap-Button aus.
- **i18n-Keys unverändert in allen vier Sprachdateien** —
  `lrRunningHint`, `btnSwapLR`, `btnPauseTest`, `cumulativeDb`,
  `lrOrderLbl`, `lrSideLbl`, `optRandom`, `optAsc`, `optDesc`,
  `optLR`, `optRL`. Nichts gelöscht, nichts hinzugefügt.
- **`lrRunningTitle`** und **`bConf*`**-Keys (Konfidenz) sind in
  dieser BA NICHT zu löschen — sie sind verwaist, aber das Aufräumen
  ist Schritt 6 des Migrationsplans.

Wenn Sonnet einen der Punkte als „unklar" markiert: Rückfrage an den
User, nicht stille Annahme.

---

## Hinweise zu möglichen Stolperfallen

- **testUI.pairIndicator.setLabels-Signatur**: Vor dem Schreiben des
  Snippets in 2.11 in `js/test-ui.js` nachsehen, ob die Funktion
  `{leftLabel, rightLabel, leftHz, rightHz}` oder ein anderes Schema
  erwartet. Bei Abweichung Schema spiegeln, nicht raten.
- **`testUI.progress.set`-Signatur**: Analog prüfen. `freqmatch-slider.js`
  ruft sie auf — dort als Vorbild.
- **`testUI.slider.setValue`-Verhalten**: Soll den Slider-Wert setzen
  UND den Range auf das nötige Minimum reduzieren/erweitern (BA 113).
  Wenn der existierende Wert ±15 ist, muss der initialRange (20)
  reichen; bei ±35 muss extend bis 40 erfolgen.
- **`_stopTest`-Ref**: testUI liefert eine interne Funktion zum
  Test-Stop. `latency.js:418` ruft sie als `latEls._stopTest()`. Die
  Stelle, an der Hook-Funktionen den Test abbrechen sollen, nutzt
  dieses Pattern. Wenn `lrEls._stopTest` nicht existiert (z.B. weil
  testUI den Ref-Name geändert hat), den korrekten Namen aus
  `test-ui.js` ermitteln und einsetzen — NICHT eigene Stop-Logik
  bauen.
- **`stopKey: 'btnPauseTest'` mit `resumable: true`**: Der Lock-Hint
  unterhalb des Buttons benutzt automatisch `testTabLockedHint` (mit
  Resume-Hinweis). Wenn der Hint-Text falsch wirkt, ist das ein
  testUI-Bug — bitte melden, nicht in lr-balance umgehen.
- **Notausgang-Prinzip beachten**: Falls beim Bauen ein Fall auftritt,
  der mit den Bausteinen nicht abbildbar ist (z.B. Pair-Indikator
  braucht Sonderverhalten), STOP und Rückfrage. Kein direktes
  DOM-Patchen außerhalb der testUI-Helfer.

---

## Übersetzungen

Keine neuen i18n-Keys nötig. Diese BA enthält keinen i18n-Folge-
Auftrag.
