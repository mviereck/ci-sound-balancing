# Bauanleitung 73 — Frequenzabgleich: Mode-Switch (Slider ↔ Adaptiv)

## Ziel

Zweite Anleitung der 02b-Reihe. Führt im Frequenzabgleich-Sub-Tab
den Modus-Schalter `slider` / `adaptive` ein, trennt die beiden
Modi architektonisch und persistiert pro Seite **(a)** den
gewählten Modus und **(b)** für den adaptiven Modus eigene
Zeitparameter (Burst-Dauer, Pause).

**Default ist `adaptive`.** Der bestehende Slider-Modus bleibt
funktional unverändert. Adaptiv-Eingangspunkte werden in dieser
Anleitung nur als **Stubs** angelegt (Alert + Konsolen-Log) —
die echte Implementierung kommt mit den Folge-Anleitungen 02b/3
(Staircase-Kern) und 02b/4 (Trial-Loop + Status-Grid-Live).

**Voraussetzung**: Bauanleitung 72 ist umgesetzt (heightJudgment
und statusGrid existieren als `hidden` Sektionen).

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.73-beta";
```

---

## 2. Builder-Klein-Patch in `test-ui.js`

Im jetzigen Builder wird das `runSelect`-Steuerelement **immer**
gebaut, sobald `cfg.presets.rowMode.show === true`. Für den
Frequenzabgleich brauchen wir keinen `runSelect` — daher kleine
defensive Ergänzung: bei leerem oder fehlendem `runOptions` wird
das Run-Control nicht angehängt.

In `js/test-ui.js`, im Block „Zeile 1: Modus / Run" (Z. 108–117):

**Vorher**:

```js
var cgRun = _mkEl('div', 'control-group');
var lblRun = _mkEl('label'); lblRun.dataset.t = rm.runKey;
runSelect = _mkEl('select');
(rm.runOptions || []).forEach(function(pair) {
  var opt = new Option('', pair[0]);
  opt.dataset.t = pair[1];
  runSelect.appendChild(opt);
});
cgRun.append(lblRun, runSelect);
rowMode.append(cgMode, cgRun);
presetsBox.appendChild(rowMode);
```

**Nachher** — `cgRun` nur anhängen, wenn `runOptions` Inhalt hat:

```js
rowMode.appendChild(cgMode);
if (rm.runOptions && rm.runOptions.length) {
  var cgRun = _mkEl('div', 'control-group');
  var lblRun = _mkEl('label'); lblRun.dataset.t = rm.runKey;
  runSelect = _mkEl('select');
  rm.runOptions.forEach(function(pair) {
    var opt = new Option('', pair[0]);
    opt.dataset.t = pair[1];
    runSelect.appendChild(opt);
  });
  cgRun.append(lblRun, runSelect);
  rowMode.appendChild(cgRun);
}
presetsBox.appendChild(rowMode);
```

`runExplainBox` (Z. 122–127) wird weiterhin nur gebaut, wenn
`runSelect` gesetzt ist — diese Abhängigkeit funktioniert mit
dem Patch automatisch korrekt.

---

## 3. `freqmatch.js` cfg umstellen

In `js/freqmatch.js`, `fmCfg.presets.rowMode` (Z. 500):

**Vorher**:

```js
rowMode:     { show: false },
```

**Nachher**:

```js
rowMode: {
  show: true,
  modeKey: 'fmLblMode',
  modeOptions: [
    ['adaptive', 'fmModeAdaptive'],
    ['slider',   'fmModeSlider']
  ]
  // kein runOptions → kein runSelect
},
```

Reihenfolge der Optionen: `adaptive` zuerst, damit nach Page-Load
der erste Wert `adaptive` ist (Default).

---

## 4. Globale Modus-Variable + Storage

### 4a) Modul-Variable

Im State-Block von `freqmatch.js` (Z. 6–18) ergänzen:

```js
let fmMode = 'adaptive';   // 'slider' | 'adaptive', Bauanleitung 02b/2
```

### 4b) Persistenz pro Seite in `sideData`

`sideData[side]` bekommt drei neue Felder. Sonnet sucht die
Stelle in `js/state-side.js`, an der `sideData` initialisiert
wird (typischerweise `createDefaultSideData()` oder ähnlich;
`grep -n "sideData" js/state-side.js` zeigt die richtige Stelle).

Felder, die ergänzt werden:

```js
fmMode:         'adaptive',   // gewählter Frequenzabgleich-Modus
fmAdaptiveDur:  400,          // Burst-Dauer (ms) im adaptiven Modus
fmAdaptivePau:  400,          // Pause (ms) im adaptiven Modus
```

`fmAdaptiveDur` und `fmAdaptivePau` sind **modus-spezifisch**.
Die heutigen Werte aus `durInput`/`pauseInput` werden weiterhin
modus-übergreifend aus dem DOM gelesen, aber beim Modus-Wechsel
zwischen den modus-spezifischen Werten gewechselt (siehe Schritt 5).

Volume (`volInput`) bleibt **modus-übergreifend** — nicht in
`sideData` aufnehmen.

Diese drei Felder müssen auch beim Laden/Speichern eines Sessions-
Files (`loadSession` / `saveSession` in `io.js`) durchlaufen.
Sonnet prüft, ob das Schema dort serialisiert / deserialisiert wird
und ergänzt die Felder, falls nötig. **Fehlende Felder beim Laden
von Altdaten** → Default-Werte greifen, keine Migration nötig.

### 4c) Default-Werte für Slider-Modus

Für die saubere Symmetrie bekommt der Slider-Modus seine bisherigen
DOM-Defaults (`dur=1000`, `pau=500`) als „virtuelle Defaults" im
Modus-Wechsel-Code (siehe 5b unten). **Es wird kein neues
`sideData`-Feld für Slider-Werte angelegt** — die werden weiterhin
über das DOM und beim Modus-Wechsel direkt zwischen gespeichert.

(Schöner wäre Symmetrie mit `fmSliderDur` / `fmSliderPau` in
`sideData`. Wenn Du das nachträglich wünschst, ist es eine
Mini-Folge-Anleitung; dieser Schritt würde sonst diese Anleitung
aufblähen.)

---

## 5. Modus-Wechsel-Logik in `freqmatch.js`

### 5a) Hilfsfunktion `fmApplyMode()`

Schaltet die UI passend zum aktuellen `fmMode` um. Wird
aufgerufen bei: modeSelect-change, Page-Load, Sub-Tab-Eintritt,
Seitenwechsel.

Neue Funktion in `js/freqmatch.js`, vor dem DOMContentLoaded-
Handler (vor Z. 484):

```js
// --- Modus-Switch (Bauanleitung 02b/2) ---
function fmApplyMode() {
  if (!fmEls) return;

  // Slider-spezifische Sektionen
  const isSlider = (fmMode === 'slider');
  if (fmEls.slider)            fmEls.slider.hidden            = !isSlider;
  if (fmEls.extendBtn)         fmEls.extendBtn.hidden         = !isSlider || fmEls.extendBtn.hidden;
  if (fmEls.sliderValue)       fmEls.sliderValue.hidden       = !isSlider;
  if (fmEls.confirmBtn)        fmEls.confirmBtn.hidden        = !isSlider;
  if (fmEls.keyHintBox)        fmEls.keyHintBox.hidden        = !isSlider;
  // confidence-Radios: Container hat keine eigene Referenz, daher CSS-Trick
  const confRow = fmEls.testBox.querySelector('.confidence-row');
  const confLbl = fmEls.testBox.querySelector('.conf-quality-label');
  if (confRow) confRow.hidden = !isSlider;
  if (confLbl) confLbl.hidden = !isSlider;
  // Sequence-Dropdown im adaptiven Modus ausblenden (AB ist fest)
  if (fmEls.seqSelect && fmEls.seqSelect.parentElement) {
    fmEls.seqSelect.parentElement.style.display = isSlider ? '' : 'none';
  }

  // Adaptiv-spezifische Sektionen
  const isAdaptive = !isSlider;
  if (fmEls.hjContainer) fmEls.hjContainer.hidden = !isAdaptive;
  if (fmEls.statusGrid)  fmEls.statusGrid.hidden  = !isAdaptive;
}

// Modus-Wechsel mit Zeitparameter-Umschaltung
let _fmDurStash_slider  = 1000;  // letzter Slider-Dur-Wert
let _fmPauStash_slider  = 500;   // letzter Slider-Pau-Wert

function fmSetMode(newMode, opts) {
  opts = opts || {};
  if (newMode !== 'slider' && newMode !== 'adaptive') return;
  if (newMode === fmMode && !opts.force) return;
  if (fmRunning) return;  // Modus-Wechsel während aktivem Test gesperrt

  // Aktuelle DOM-Werte sichern (für das Modell, das gerade verlassen wird)
  if (fmEls && fmEls.durInput && fmEls.pauseInput) {
    if (fmMode === 'slider') {
      _fmDurStash_slider = parseInt(fmEls.durInput.value)   || 1000;
      _fmPauStash_slider = parseInt(fmEls.pauseInput.value) || 500;
    } else {
      // adaptive → in sideData der aktuellen Seite sichern
      const sd = sideData[fmRefSide === 'left' ? 'right' : 'left'];
      // Variable Seite hat die Zeitparameter — aber pragmatisch nehmen wir die aktuelle Variable.
      const varSd = sideData[fmVarSide] || sideData.left;
      varSd.fmAdaptiveDur = parseInt(fmEls.durInput.value)   || 400;
      varSd.fmAdaptivePau = parseInt(fmEls.pauseInput.value) || 400;
    }
  }

  fmMode = newMode;

  // Variable-Seiten-Storage updaten (fmMode pro Seite)
  if (sideData[fmVarSide]) sideData[fmVarSide].fmMode = newMode;

  // Neue Werte in DOM laden
  if (fmEls && fmEls.durInput && fmEls.pauseInput) {
    if (newMode === 'slider') {
      fmEls.durInput.value   = _fmDurStash_slider;
      fmEls.pauseInput.value = _fmPauStash_slider;
    } else {
      const varSd = sideData[fmVarSide] || sideData.left;
      fmEls.durInput.value   = (varSd.fmAdaptiveDur != null) ? varSd.fmAdaptiveDur : 400;
      fmEls.pauseInput.value = (varSd.fmAdaptivePau != null) ? varSd.fmAdaptivePau : 400;
    }
  }

  fmApplyMode();
  if (fmEls && fmEls.modeSelect) fmEls.modeSelect.value = newMode;
}

// Wird beim Sub-Tab-Eintritt / Seitenwechsel aufgerufen
function fmLoadModeFromSide() {
  const varSide = (fmEls && fmEls.refSelect)
    ? (fmEls.refSelect.value === 'left' ? 'right' : 'left')
    : 'right';
  const sd = sideData[varSide] || {};
  const wanted = (sd.fmMode === 'slider' || sd.fmMode === 'adaptive')
    ? sd.fmMode : 'adaptive';
  fmSetMode(wanted, { force: true });
}
```

### 5b) Verdrahtung im DOMContentLoaded

In `js/freqmatch.js`, im DOMContentLoaded-Handler nach
`fmEls = buildTestPanel(...)` und VOR der Event-Liste:

```js
// Modus-Switch (Bauanleitung 02b/2)
if (fmEls.modeSelect) {
  fmEls.modeSelect.addEventListener('change', function() {
    fmSetMode(fmEls.modeSelect.value);
  });
}
// Beim Wechsel der Referenzseite auch Modus der NEUEN var-Seite laden
fmEls.refSelect.addEventListener('change', function() {
  // (vorhandene fRes-Dialog-Logik läuft VOR diesem Handler, siehe unten)
  setTimeout(fmLoadModeFromSide, 0);
});
```

`refSelect` hat schon einen change-Handler weiter unten (Z. 582 ff.,
für den fRes-Bestätigungs-Dialog). Diesen **nicht** ersetzen, sondern
einen **zusätzlichen** addEventListener wie oben einhängen. Beide
laufen — der bestehende Dialog-Handler validiert und ggf. rollt
`refSelect.value` zurück; danach lädt unser neuer Handler den Modus
der neuen Variable.

### 5c) Initialer Aufruf

Ganz am Ende des DOMContentLoaded-Handlers, nach `fmApplyLang()`:

```js
fmLoadModeFromSide();   // initialer Modus aus sideData lesen (Bauanleitung 02b/2)
```

### 5d) Tab-Wechsel-Hook

Beim Wechsel **auf** den Frequenzabgleich-Sub-Tab muß `fmLoadModeFromSide()`
aufgerufen werden, falls der User vorher die Seite gewechselt hat
ohne aktive Frequenzabgleich-Sub-Tab.

Sonnet sucht die Tab-Switch-Logik (`grep -n "freqmatch" js/init.js js/state-side.js` oder
ähnlich) und ergänzt nach erfolgreichem Sub-Tab-Wechsel zum
Frequenzabgleich einen Aufruf von `fmLoadModeFromSide()`. Falls die
Stelle nicht eindeutig ist — **rückfragen, nicht raten**.

---

## 6. Modus-Wechsel während aktivem Test sperren

In `fmStart()` (Z. 301) ergänzen, ganz am Anfang nach
`updateTabLockState()`:

```js
function fmStart() {
  if (!fmEls) return;
  fmRefSide = fmEls.refSelect.value;
  fmVarSide = fmRefSide === "left" ? "right" : "left";

  // Modus-Dispatch (Bauanleitung 02b/2)
  if (fmMode === 'adaptive') {
    fmStartAdaptive();
    return;
  }

  // ...bestehender Slider-Start-Code unverändert...
  fmSeq = fmBuildSeq();
  ...
  if (fmEls.modeSelect) fmEls.modeSelect.disabled = true;
  fmLoadElectrode();
}
```

Und in `fmAbort()` und `fmFinish()` jeweils ergänzen, am Ende:

```js
if (fmEls && fmEls.modeSelect) fmEls.modeSelect.disabled = false;
```

---

## 7. Adaptiv-Stub `fmStartAdaptive`

In `js/freqmatch.js` direkt vor `fmStart()` (Z. 300 ff.):

```js
// --- Adaptiver Modus (Bauanleitung 02b/2: Stub, voller Build in 02b/3+) ---
function fmStartAdaptive() {
  console.log('[freqmatch] fmStartAdaptive() — Implementierung kommt mit Bauanleitung 02b/3 und 02b/4');
  const msg = (typeof t === 'function' && t('fmAdaptiveNotImpl'))
    || 'Adaptiver Modus noch nicht implementiert. Wird mit den nächsten Bauanleitungen geliefert.';
  alert(msg);
}

function fmHandleHeight(dir) {
  console.log('[freqmatch] fmHandleHeight', dir, '— Stub');
}

function fmReplayCurrent() {
  console.log('[freqmatch] fmReplayCurrent — Stub');
}
```

---

## 8. Tastatur-Handler modus-aware

In `js/freqmatch.js`, `fmHandleKey()` (Z. 439–466) ersetzen durch:

```js
function fmHandleKey(e) {
  if (!fmRunning) return;
  const activeEl = document.activeElement;
  if (activeEl && fmEls && activeEl !== fmEls.slider &&
      (activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT" || activeEl.tagName === "TEXTAREA")) return;

  if (fmMode === 'adaptive') {
    // Adaptiv-Tasten (Bauanleitung 02b/2: Stubs, vollständig verdrahtet in 02b/4)
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      fmHandleHeight('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      fmHandleHeight('down');
    } else if (e.key === ' ') {
      e.preventDefault();
      fmReplayCurrent();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      fmAbort();
    }
    return;
  }

  // Slider-Tasten (bestehend, unverändert)
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const step = e.shiftKey ? dir * 1 : dir * 5;
    e.preventDefault();
    const lim = FM_SLIDER_RANGES[fmSlRangeIdx];
    fmCentOffset = Math.max(-lim, Math.min(lim, fmCentOffset + step));
    if (fmEls) fmEls.slider.value = fmCentOffset;
    fmHandleSlider(fmCentOffset);
  } else if (e.key === " ") {
    e.preventDefault();
    fmPlayCurrent();
  } else if (e.key === "Enter") {
    e.preventDefault();
    fmConfirm();
  } else if (e.key === "z" || e.key === "Z") {
    e.preventDefault();
    fmUndo();
  } else if (e.key === "b" || e.key === "B") {
    e.preventDefault();
    if (fmEls && fmEls.simulBtn) fmEls.simulBtn.click();
  }
}
```

---

## 9. heightJudgment-Buttons verdrahten (Stub)

In `js/freqmatch.js`, im DOMContentLoaded-Handler nach den
bestehenden Test-Aktions-Events:

```js
// Adaptiv: Höher/Tiefer-Buttons (Bauanleitung 02b/2, Stubs)
if (fmEls.hjHigher) fmEls.hjHigher.addEventListener('click', () => fmHandleHeight('up'));
if (fmEls.hjLower)  fmEls.hjLower.addEventListener('click',  () => fmHandleHeight('down'));
```

---

## 10. CSS — modeSelect-disabled-State

Falls `:disabled` für Selects nicht schon gleich aussieht wie bei
anderen Inputs, in der CSS-Datei prüfen. Bei den meisten Setups
greift der allgemeine Stil. **Nur ergänzen, wenn visuell etwas
fehlt.**

---

## 11. i18n — KEINE Strings in dieser Anleitung

Die in dieser Anleitung neu referenzierten Keys:

- `fmLblMode` — Label „Modus" vor dem modeSelect
- `fmModeAdaptive` — Option „Adaptiv (2I-2AFC)"
- `fmModeSlider` — Option „Klassisch (Slider)"
- `fmAdaptiveNotImpl` — Alert „Adaptiver Modus noch nicht implementiert."

werden **nicht** in `i18n/de.js` angelegt — sie kommen gebündelt
mit allen anderen deutschen Strings des adaptiven Modus in
Bauanleitung 02b/8.

**Konsequenz**: das Modus-Label ist nach Build leer, die zwei
Optionen im Dropdown sind leer (die Values `adaptive` / `slider`
funktionieren trotzdem). Sichtbar-mappable wird das mit 02b/8.

`en.js`, `fr.js`, `es.js` bleiben unverändert.

---

## 12. Spec / CODESTRUKTUR aktualisieren

### 12a) `docs/CODESTRUKTUR.md`

In der Zeile für **freqmatch.js** (Modul 9) ergänzen:
- Neue globale Variable `fmMode` (`'slider'` | `'adaptive'`, Default `'adaptive'`)
- Neue Funktionen `fmApplyMode`, `fmSetMode`, `fmLoadModeFromSide`,
  `fmStartAdaptive` (Stub), `fmHandleHeight` (Stub),
  `fmReplayCurrent` (Stub)
- Neue `sideData[side]`-Felder: `fmMode`, `fmAdaptiveDur`,
  `fmAdaptivePau`

### 12b) `docs/spec/02-messung.md`

Im Sub-Tab-Frequenzabgleich-Abschnitt einen Verweis ergänzen:

> Ein zweiter Mess-Modus (adaptiv, 2I-2AFC) ist in
> `docs/spec/02b-freqmatch-adaptiv.md` beschrieben und wird in
> dieser Anleitung über den Modus-Schalter im Sub-Tab gewählt.
> Default ist der adaptive Modus.

### 12c) `docs/SPEC.md`

Im Index-Verzeichnis von SPEC.md prüfen, ob `02b-freqmatch-adaptiv.md`
schon verlinkt ist. Falls nicht: in die Kapitel-Liste aufnehmen.

---

## Akzeptanztest

1. Browser hart neu laden (Strg-F5). Footer zeigt `3.0.73-beta`.
2. Tab **Messungen** → Sub-Tab **Frequenzabgleich** öffnen.
3. **Modus-Dropdown** ist sichtbar (oben in den Voreinstellungen).
   Aktueller Wert: `adaptive` (leeres Label, Option-Text vorerst
   leer wegen fehlender i18n — das ist OK).
4. **Im adaptiven Modus** sichtbar:
   - kein Slider
   - kein Übernehmen-Button
   - keine Confidence-Radios
   - kein Tonfolge-Dropdown (AB/ABA)
   - höher/tiefer-Buttons (leer beschriftet, mit Pfeil + Tastatur-Hinweis)
   - leeres Status-Grid (graue Box)
5. **Test starten** klicken (im adaptiven Modus) → Alert
   „Adaptiver Modus noch nicht implementiert" erscheint. Test
   startet nicht.
6. Modus-Dropdown auf **`slider`** wechseln:
   - Slider erscheint, Übernehmen-Button erscheint, Confidence-Radios
     erscheinen, Tonfolge-Dropdown erscheint
   - höher/tiefer-Buttons werden ausgeblendet, Status-Grid ausgeblendet
   - durInput zeigt **1000**, pauseInput zeigt **500**
7. durInput auf **800** ändern, pauseInput auf **300** ändern.
   Modus auf **`adaptive`** zurück → durInput zeigt **400**,
   pauseInput zeigt **400**.
8. Modus zurück auf **`slider`** → durInput **800**, pauseInput
   **300** (User-Werte wurden gemerkt, nicht überschrieben).
9. Im adaptiven Modus durInput auf **600** ändern. Modus auf
   `slider`. Modus zurück auf `adaptive` → durInput **600**
   (auch hier wurden User-Werte gemerkt).
10. Variable Seite wechseln (über `refSelect`): Modus wird auf
    den der neuen Variable geladen. Bei frischer Seite ohne
    bisherigen Modus: `adaptive`.
11. **Slider-Test ausführen**: Modus auf `slider`, Start, Slider
    bewegen, Übernehmen, nächste Elektrode — bisheriger Slider-Test
    funktioniert vollständig wie zuvor. Cent-Werte werden gespeichert.
12. Während aktivem Slider-Test: Modus-Dropdown ist **disabled**
    (graut aus). Test beenden (Stop oder Fertig) → Dropdown wieder
    aktiv.
13. Adaptiv-Modus, Pfeil-hoch / Pfeil-runter drücken (auch ohne
    aktiven Test, kein Effekt). Während des Alerts aus Schritt 5:
    Konsole zeigt keinen Fehler.
14. Session speichern, Session laden → Modus und gespeicherte
    Zeitparameter bleiben erhalten.
15. Konsole frei von Fehlern. Andere Tabs (Loudness, Stereo-Balance,
    Schieber, Implantat, Kurven, Player, …) unverändert.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung:

1. Jede Akzeptanztest-Kriterie einzeln durchgehen und melden:
   erfüllt / nicht erfüllt / unklar, mit Datei- und Zeilenangabe.
2. Insbesondere prüfen:
   - Wird `fmMode` aus `sideData[varSide].fmMode` geladen — und beim
     Wechsel dort auch zurückgeschrieben?
   - Werden `fmAdaptiveDur` / `fmAdaptivePau` in `sideData[varSide]`
     persistiert?
   - Funktioniert der `refSelect`-bestehende-Dialog (fRes-Bestätigung)
     weiter — d.h. wird der neue Mode-Load-Hook **zusätzlich**
     eingehängt, nicht statt des bestehenden?
   - Sind in `loadSession`/`saveSession` die neuen `sideData`-Felder
     berücksichtigt? Falls Sonnet sich unsicher ist, ob die Felder
     dort einzeln aufgeführt werden müssen oder automatisch
     durchlaufen — **rückfragen, nicht annehmen**.
3. Hard test: nach Build den Slider-Test einmal vollständig
   durchspielen (eine Elektrode). Ergebnis muß identisch zu vor
   der Bauanleitung sein (Cent-Wert wird korrekt gespeichert).

---

## Was diese Anleitung NICHT macht

- Keine Staircase-Logik / 2-down-1-up (kommt in 02b/3)
- Keine echte adaptive Test-Durchführung (kommt in 02b/3 und 02b/4)
- Kein Status-Grid-Inhalt (kommt in 02b/4)
- Keine Pause/Resume-Persistenz für Tracks (kommt in 02b/5)
- Keine Catch-Trials (kommt in 02b/6)
- Keine Ergebnis-Chart-Anpassung (kommt in 02b/7)
- Keine i18n-Strings in `de.js` (kommt in 02b/8)
