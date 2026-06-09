# Bauanleitung 247-Fix-3 — Doppelten Test-Keyboard-Listener in init.js entfernen

## Ziel

Drei Tastatur-Bugs aus dem Akzeptanztest nach BA 247.3 beheben. Die
Ursache ist in allen drei Fällen die gleiche: in `js/init.js` läuft
ein zweiter `keydown`-Listener für den Elektrodenlautstärke-Test, der
aus der Zeit vor der testUI-Migration stammt. Er feuert parallel zum
testUI-Keyboard-Handler und ruft Hook-Funktionen ein **zweites Mal**
auf.

Konkret in `js/init.js`, Z. 562–600:

```js
document.addEventListener("keydown", (e) => {
  if (!testAct || !testEls) return;
  ...
  if (e.code === "Space")  { ...; playCur(); }
  if (e.key === "z" ...)   { ...; undoL(); }
  if (e.key === "b" ...)   { ...; _testPlaySimul(); }
  if (e.key === "s" ...)   { ...; _testSwap(); }
  if (testMode === "balance" && e.key === "Enter") { ...; recBal(); }
  if (testMode === "balance" && (ArrowLeft|ArrowRight)) { ... Slider verschieben ... }
});
```

Folgen:
- **Spacebar**: testUI ruft `onReplay → playCur`. **Zusätzlich** ruft
  init.js direkt `playCur()`. Zwei parallele `playSeq`-Sequenzen mit
  `stopAll`/`isPlay`-Race → zweiter Ton klingt doppelt, Aufleuchten
  schwankt
- **Enter**: testUI ruft `onConfirm → recBal`. **Zusätzlich** ruft
  init.js direkt `recBal()`. `testIdx` wandert pro Tastendruck zwei
  Schritte vorwärts; bei schneller Folge landet er über
  `testPairs.length`, ohne daß `endTest` sauber durchläuft
- **B-Taste**: testUI ruft `onSimul → _testPlaySimul`. **Zusätzlich**
  ruft init.js direkt `_testPlaySimul()`. Zwei `playTone`-Stapel
  parallel → fehlerhaftes Abspielen
- **S-Taste / Pfeiltasten / Z**: ebenfalls doppelt — auch wenn die
  konkreten Effekte heute weniger auffallen

testUI übernimmt all diese Routings seit BA 247 selbst (über
`_installKeyListener` in `js/test-ui.js`). Der Block in `init.js` ist
vollständig redundant.

## Voraussetzungen

- aktuelle Version: `3.2.247.3-beta`
- i18n: nur Deutsch (in dieser BA werden keine Texte berührt)

## Schritt 1 — Versionsbump

`js/version.js`:

```js
// vorher
const APP_VERSION = "3.2.247.3-beta";

// nachher
const APP_VERSION = "3.2.247.4-beta";
```

## Schritt 2 — Doppel-Listener in `init.js` entfernen

`js/init.js`, etwa Z. 561–600 (der Kommentar „// Test keyboard — über
testEls" markiert den Beginn).

**Suche** (gesamten Block, inkl. einleitendem Kommentar):

```js
  // Test keyboard — über testEls
  document.addEventListener("keydown", (e) => {
    if (!testAct || !testEls) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.code === "Space") {
      e.preventDefault();
      playCur();
    }
    if (e.key === "z" || e.key === "Z") {
      e.preventDefault();
      undoL();
    }
    if (e.key === "b" || e.key === "B") {
      e.preventDefault();
      if (typeof _testPlaySimul === 'function') _testPlaySimul();
    }
    // X-Shortcut für Ausschluss entfällt (§6.6)
    // BA 247: judgment-Modus entfaellt; Shortcuts 1/2/3 entfallen damit.
    if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      if (typeof _testSwap === 'function') _testSwap();
    }
    if (testMode === "balance" && e.key === "Enter") {
      e.preventDefault();
      if (typeof recBal === 'function') recBal();
    }
    if (testMode === "balance" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      // BA 247: Slider sitzt jetzt in testEls.verfahren[id].slider.input
      var _vref = testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
      var _s = _vref && _vref.slider && _vref.slider.input;
      if (!_s) return;
      var _st = e.shiftKey ? 0.1 : 0.5;
      var _v = parseFloat(_s.value);
      if (e.key === "ArrowLeft") _v = Math.max(parseFloat(_s.min), +(_v - _st).toFixed(1));
      if (e.key === "ArrowRight") _v = Math.min(parseFloat(_s.max), +(_v + _st).toFixed(1));
      testUI.slider.setValue(_vref.slider, _v);
      testUI.slider.setValueDisplay(_vref.slider, _v.toFixed(1) + " dB");
    }
  });
```

**Ersatzlos löschen** (gesamten Block, inklusive Kommentar-Zeile
darüber). Direkt davor und danach stehen andere `addEventListener`-Blöcke
für Schieber-Tab- und Player-Lautstärke-Steuerung — die bleiben
unverändert. Vor dem Löschen einmal mit Augen verifizieren, daß die
schließende `});` zum richtigen Block gehört (Tab-Einrückung folgen).

Die im Block aufgerufenen Funktionen (`playCur`, `undoL`, `recBal`,
`_testPlaySimul`, `_testSwap`) werden nicht gelöscht — sie sind die
korrekten Hook-Implementierungen und werden weiterhin von testUI
aufgerufen.

## Schritt 3 — Akzeptanztest

Browser-Cache leeren, `3.2.247.4-beta` sichtbar.

1. **Sub-Tab Elektrodenlautstärke, Test starten (Round Robin)**

2. **Spacebar (Nochmal)**
   Im laufenden Trial: Leertaste drücken. Erwartet: Sequenz wird
   **einmal** wiederholt. Aufleuchten erst linke Box (A), dann
   rechte Box (B). Keine Doppel-Anschläge.

3. **Spacebar während Sequenz**
   Während die Sequenz noch spielt: Leertaste drücken. Erwartet:
   laufende Sequenz wird abgebrochen, neue Sequenz beginnt sauber
   von vorn. Keine Doppel-Anschläge.

4. **B-Taste (Gleichzeitig)**
   Erwartet: A und B werden **einmal** gleichzeitig gespielt. Beide
   Boxen leuchten gleichzeitig.

5. **Enter (Bestätigen)**
   Nach Sequenz-Ende: Enter drücken. Erwartet: Slider-Wert wird
   gespeichert, nächstes Paar erscheint. Slider auf gespeichertem
   Wert oder 0.

6. **Enter mehrfach in schneller Folge**
   Nach Sequenz-Ende mehrfach hintereinander Enter drücken. Erwartet:
   Test schreitet pro Enter um **genau ein** Paar voran. Am Ende der
   Runde sauberer Übergang zur nächsten Runde; am Ende des Round-Robin-
   Laufs sauberes `endTest`. Kein Hängen, kein Überspringen.

7. **Pfeiltasten Slider**
   Links/Rechts: Slider bewegt sich um **einen** Schritt (nicht
   doppelt). Mit Shift: Fein-Schritt.

8. **Backspace (Zurück)**
   Nach einer Bestätigung: Backspace drücken. Erwartet: vorheriges
   Paar erscheint wieder, Slider sitzt am gespeicherten Wert.

9. **Z-Taste**
   Z-Taste tut **nichts** mehr (war Alt-Shortcut für Undo, in der
   neuen testUI-API gibt es das nicht). Akzeptiert.

10. **S-Taste (A↔B)**
    Während Trial: S drücken. Erwartet: A↔B-Wechsel **einmal**, der
    Slider-Wert wird negiert. Keine Doppel-Reaktion.

11. **Andere Sub-Reiter**
    Stereo-Balance, Frequenzabgleich, Latenz öffnen und je einen Test
    kurz starten. Erwartet: keine JS-Fehler, Tastatur funktioniert
    unverändert (lr-balance/freqmatch hängen ohnehin nicht am
    init.js-Block).

## Schritt 4 — Selbstprüfungs-Auftrag an Sonnet

Bevor du den Build als fertig meldest: gehe Akzeptanzschritte 1–11
einzeln durch und melde für jeden Schritt: **erfüllt** / **nicht erfüllt**
/ **unklar**, jeweils mit Datei- und Zeilenangabe der relevanten
Code-Stelle.

Drei Pflicht-Checks vor Build-Abschluß:

- **Kein zweiter Keyboard-Listener für test mehr**:
  ```
  grep -n "testAct\|playCur\|_testPlaySimul\|recBal\|_testSwap" js/init.js
  ```
  Erwartet: keine Treffer mehr in `init.js`. (Die Funktionen selbst
  bleiben in `js/test.js` und werden von testUI-Hooks aufgerufen.)
- **Andere Test-Module unverändert**:
  ```
  grep -rn "addEventListener('keydown'\|addEventListener(\"keydown\"" js/init.js
  ```
  Der Listener für Schieber-Tab (Z. 533, „Schieber-Tab keyboard nav")
  und der Listener für Player (`plStr`) bleiben erhalten.
- **Versionsbump tatsächlich gesetzt**: `js/version.js` zeigt
  `3.2.247.4-beta`.
