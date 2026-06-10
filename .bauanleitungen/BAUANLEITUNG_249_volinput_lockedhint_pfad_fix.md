# Bauanleitung 249 — Bug-Fix: `volInput`/`durInput`/`pauseInput`/`lockedHint` auf `.header`-Pfad

## Ziel

Ein in BA 247 unbemerkt liegengebliebener Migrations-Bug. Drei
Verbraucher-Module greifen weiterhin auf die **alte** testUI-API-Form
zu (`testEls.volInput`, `testEls.lockedHint` etc. direkt auf der
Top-Ebene), obwohl die neue API diese Felder unter `header.*` ablegt.

Konkrete Symptome:

1. **`js/audio.js` `_activeTestInput`** (Z. 10–27): liest
   `testEls.volInput`, `lrEls.volInput`, `fmEls.volInput`. In der
   neuen API undefined. Konsequenz: `gVol()`/`gDur()`/`gPau()` fallen
   auf die Defaults (0.25 = 25%, 1000 ms, 500 ms) zurück — der vom
   Nutzer eingestellte Header-Wert wird ignoriert. Betrifft den
   Elektrodenlautstärke-Test (das `playSeq`-Verhalten in `audio.js`
   Z. 720–722 ist davon abhängig). lr-balance, freqmatch und latency
   nutzen jeweils eigene Helfer (`lrGVol`, `fmGVol`, `latVolume`) und
   sind faktisch nicht betroffen, kriegen aber denselben Fix für
   Konsistenz.
2. **`js/results.js`** (Z. 43–44): liest `testEls.volInput` für die
   Anzeige der Meta-Zeile im Ergebnisreiter. Fällt auf Default `50`
   zurück.
3. **`js/tabs-eq.js`** `updateTabLockState` (Z. 271–282): blendet die
   `lockedHint`-Box bei Tab-Wechsel-Sperre ein. Pfad
   `testEls.lockedHint` / `lrEls.lockedHint` / `fmEls.lockedHint` /
   `latEls.lockedHint` ist in der neuen API undefined; die
   Synchronisation greift nicht. Die `lockedHint`-Box wird aber von
   `_buildTestPanelNew` direkt beim Start/Stop ein-/ausgeblendet
   (`lockedHint.hidden = false/true` in test-ui.js Z. 1696/1755) —
   praktisch fällt das nicht groß auf, ist aber semantisch defekt.

Diese BA fixt alle drei Stellen auf den `header.*`-Pfad. Im
Elektrodenlautstärke-Test wirkt sich das **direkt** auf
Lautstärke/Tondauer/Pause aus.

> **Hinweis zur Verzahnung mit BA 250.** BA 250 verschiebt
> Lautstärke/Tondauer/Pause aus dem Header des Elektrodenlautstärke-Tests
> in die Tonart-Modalbox (analog freqmatch nach BA 240). Damit ist
> `testEls.header.volInput`/`durInput`/`pauseInput` nach BA 250 wieder
> weg, und der test-Zweig in `_activeTestInput` wird in BA 250 erneut
> angepaßt (Lesen aus State-Variable statt aus DOM). BA 249 ist trotzdem
> als eigenständiger Bug-Fix sinnvoll, damit der heutige Code für die
> Zeit zwischen Build und BA 250 korrekt funktioniert.

## Voraussetzungen

- BA 248 ist gebaut und abgenommen
- aktuelle Version vor dem Bau: `3.2.248-beta`
- i18n: nur Deutsch (in dieser BA werden keine Texte berührt)

## Schritt 1 — Versionsbump

`js/version.js`:

```js
// vorher
const APP_VERSION = "3.2.248-beta";

// nachher
const APP_VERSION = "3.2.249-beta";
```

## Schritt 2 — `js/audio.js`: `_activeTestInput` auf `.header.*` umstellen

`js/audio.js` Z. 10–27.

**Suche**:

```js
function _activeTestInput(type) {
  if (testAct && typeof testEls !== 'undefined' && testEls) {
    if (type === 'vol') return testEls.volInput;
    if (type === 'dur') return testEls.durInput;
    if (type === 'pau') return testEls.pauseInput;
  }
  if (typeof lrRunning !== 'undefined' && lrRunning && typeof lrEls !== 'undefined' && lrEls) {
    if (type === 'vol') return lrEls.volInput;
    if (type === 'dur') return lrEls.durInput;
    if (type === 'pau') return lrEls.pauseInput;
  }
  if (typeof fmRunning !== 'undefined' && fmRunning && typeof fmEls !== 'undefined' && fmEls) {
    if (type === 'vol') return fmEls.volInput;
    if (type === 'dur') return fmEls.durInput;
    if (type === 'pau') return fmEls.pauseInput;
  }
  return document.getElementById(type === 'vol' ? 'vol1' : type === 'dur' ? 'dur1' : 'pau1');
}
```

**Ersetze durch**:

```js
function _activeTestInput(type) {
  // BA 249: nach der testUI-Migration liegen volInput/durInput/pauseInput
  // unter els.header.*, nicht direkt auf els. Den alten Pfad gibt es nicht
  // mehr; die DOM-Fallback-IDs 'vol1'/'dur1'/'pau1' wurden mit der alten
  // API entfernt und existieren nicht mehr.
  if (testAct && typeof testEls !== 'undefined' && testEls && testEls.header) {
    if (type === 'vol') return testEls.header.volInput;
    if (type === 'dur') return testEls.header.durInput;
    if (type === 'pau') return testEls.header.pauseInput;
  }
  if (typeof lrRunning !== 'undefined' && lrRunning
      && typeof lrEls !== 'undefined' && lrEls && lrEls.header) {
    if (type === 'vol') return lrEls.header.volInput;
    if (type === 'dur') return lrEls.header.durInput;
    if (type === 'pau') return lrEls.header.pauseInput;
  }
  if (typeof fmRunning !== 'undefined' && fmRunning
      && typeof fmEls !== 'undefined' && fmEls && fmEls.header) {
    if (type === 'vol') return fmEls.header.volInput;
    if (type === 'dur') return fmEls.header.durInput;
    if (type === 'pau') return fmEls.header.pauseInput;
  }
  return null;
}
```

Hinweis zu freqmatch: die neue freqmatch-Konfig (`js/freqmatch.js`)
hat seit BA 240 keine `volume`/`duration`/`pause` mehr im Header — sie
leben dort als globale State-Variablen `volume_freqmatch`/
`duration_freqmatch`/`pause_freqmatch` und werden durch die Helfer
`fmGVol`/`fmGDur`/`fmGPau` ausgelesen. Daher gibt `fmEls.header.volInput`
in der Praxis `undefined` zurück. Das ist harmlos: freqmatch ruft das
zentrale `gVol()`/`gDur()`/`gPau()` nicht auf. Der `fmRunning`-Zweig
bleibt aus Konsistenzgründen trotzdem erhalten — falls jemand später
ein freqmatch-Modul ohne eigene Helfer baut, greift er korrekt.

## Schritt 3 — `js/results.js`: `volInput`-Lese-Pfad fixen

`js/results.js` Z. 43–45.

**Suche**:

```js
  const vol = (typeof testEls !== 'undefined' && testEls && testEls.volInput)
    ? testEls.volInput.value
    : (document.getElementById("vol1") ? document.getElementById("vol1").value : 50);
```

**Ersetze durch**:

```js
  // BA 249: testEls.volInput existiert in der neuen API nicht mehr;
  // der Wert sitzt unter testEls.header.volInput. Fallback auf
  // numerische Voreinstellung 75 (analog Default in der testUI).
  const vol = (typeof testEls !== 'undefined' && testEls
               && testEls.header && testEls.header.volInput)
    ? testEls.header.volInput.value
    : 75;
```

## Schritt 4 — `js/tabs-eq.js`: `lockedHint`-Pfad fixen

`js/tabs-eq.js`, Funktion `updateTabLockState` (etwa Z. 270–283).

**Suche**:

```js
  // lockedHint im jeweiligen testEls-Objekt ein-/ausblenden
  if (typeof testEls !== "undefined" && testEls && testEls.lockedHint) {
    testEls.lockedHint.hidden = !testAct;
  }
  if (typeof lrEls !== "undefined" && lrEls && lrEls.lockedHint) {
    lrEls.lockedHint.hidden = !(typeof lrRunning !== "undefined" && lrRunning);
  }
  if (typeof fmEls !== "undefined" && fmEls && fmEls.lockedHint) {
    fmEls.lockedHint.hidden = !(typeof fmRunning !== "undefined" && fmRunning);
  }
  if (typeof latEls !== "undefined" && latEls && latEls.lockedHint) {
    latEls.lockedHint.hidden = !(typeof latActive !== "undefined" && latActive);
  }
```

**Ersetze durch**:

```js
  // BA 249: lockedHint liegt in der neuen API unter els.header.lockedHint,
  // nicht direkt auf els. _buildTestPanelNew setzt das DOM-Flag beim
  // Start/Stop selbst (test-ui.js: Start = hidden=false, Stop = hidden=true);
  // diese Schleife synchronisiert nur den Querzustand (z.B. nach Tab-Wechsel).
  if (typeof testEls !== "undefined" && testEls
      && testEls.header && testEls.header.lockedHint) {
    testEls.header.lockedHint.hidden = !testAct;
  }
  if (typeof lrEls !== "undefined" && lrEls
      && lrEls.header && lrEls.header.lockedHint) {
    lrEls.header.lockedHint.hidden = !(typeof lrRunning !== "undefined" && lrRunning);
  }
  if (typeof fmEls !== "undefined" && fmEls
      && fmEls.header && fmEls.header.lockedHint) {
    fmEls.header.lockedHint.hidden = !(typeof fmRunning !== "undefined" && fmRunning);
  }
  if (typeof latEls !== "undefined" && latEls
      && latEls.header && latEls.header.lockedHint) {
    latEls.header.lockedHint.hidden = !(typeof latActive !== "undefined" && latActive);
  }
```

## Schritt 5 — Akzeptanztest

1. **Browser-Cache leeren, Anwendung neu laden**
   Erwartet: kein JS-Fehler in der Konsole. `3.2.249-beta` sichtbar.

2. **Elektrodenlautstärke: Lautstärke-Steuerung wirkt**
   Sub-Tab Elektrodenlautstärke öffnen. Lautstärke im Header von
   75 % auf 100 % erhöhen, dann auf 30 % senken. Test starten
   (Round Robin). Erwartet: die Lautstärke der Töne folgt deutlich
   hörbar dem Header-Wert. (Vor BA 249 war das nicht der Fall — die
   Töne kamen immer mit 25 % unabhängig vom Header.)

3. **Elektrodenlautstärke: Tondauer wirkt**
   Tondauer von 750 ms auf 200 ms reduzieren, Trial starten:
   deutlich kürzere Töne. Auf 1500 ms erhöhen: deutlich längere
   Töne.

4. **Elektrodenlautstärke: Tonpause wirkt**
   Tonpause von 300 ms auf 50 ms reduzieren, Trial starten: A und B
   folgen fast direkt aufeinander. Auf 1500 ms erhöhen: deutliche
   Pause zwischen A und B.

5. **Stereo-Balance: Header-Werte wirken**
   Sub-Tab Stereo-Balance öffnen, Lautstärke ändern, Test starten —
   die Tonlautstärke folgt dem Header. (lr-balance hat eigene
   Helfer `lrGVol`/`lrGDur`/`lrGPau`, war auch vor BA 249 schon
   korrekt — der Fix in `_activeTestInput` ist hier dennoch
   konsistenzwirksam.)

6. **Frequenzabgleich: Lautstärke aus Modalbox wirkt**
   Sub-Tab Frequenzabgleich öffnen, Tonart-Popup öffnen, Lautstärke
   im Popup ändern. (Freqmatch hat seit BA 240 die Vol/Dur/Pau in
   der Modalbox, nicht im Header — das ist hier unverändert.)
   Erwartet: kein Bruch.

7. **Latenz: Header-Werte wirken**
   Sub-Tab Latenz öffnen, Lautstärke ändern, Test starten — die
   Klicks folgen dem Header-Wert.

8. **`lockedHint`-Sichtbarkeit**
   Im aktiven Elektrodenlautstärke-Test eine andere Top-Tab (z.B.
   Ergebnisse) öffnen, dann zurück auf Messungen. Erwartet: keine
   Konsolen-Fehler. Die `tab-locked-hint`-Box ist im aktiven Test
   weiterhin sichtbar.

9. **`vol`-Wert im Ergebnisreiter**
   Tab „Meßergebnisse" öffnen. In der Meta-Zeile steht der aktuelle
   Lautstärke-Wert (z.B. „75 %"), nicht der Default-Fallback 75 %
   wenn der Nutzer einen anderen Wert eingestellt hat. (Vor BA 249
   stand dort immer der Fallback.)

## Schritt 6 — Selbstprüfungs-Auftrag an Sonnet

Bevor du den Build als fertig meldest: gehe Akzeptanzschritte 1–9
einzeln durch und melde für jeden Schritt: **erfüllt** / **nicht erfüllt**
/ **unklar**, jeweils mit Datei- und Zeilenangabe der relevanten
Code-Stelle.

Vier Pflicht-Checks vor Build-Abschluß:

- **Keine Top-Level-`volInput`/`durInput`/`pauseInput`-Zugriffe mehr**:
  ```
  grep -rn "testEls\.volInput\|testEls\.durInput\|testEls\.pauseInput\|lrEls\.volInput\|lrEls\.durInput\|lrEls\.pauseInput\|fmEls\.volInput\|fmEls\.durInput\|fmEls\.pauseInput" js/
  ```
  Erwartet: keine Treffer (ausgenommen die Belegung im Aufbau in
  `js/test-ui.js`, `js/lr-balance.js`-Setup — das sind Schreib- nicht
  Lese-Stellen). Lesepfade müssen alle `.header.*` sein.

- **Keine Top-Level-`lockedHint`-Lesungen mehr**:
  ```
  grep -rn "testEls\.lockedHint\|lrEls\.lockedHint\|fmEls\.lockedHint\|latEls\.lockedHint" js/
  ```
  Erwartet: keine Treffer.

- **`vol1`/`dur1`/`pau1`-Fallback weg**:
  ```
  grep -rn "getElementById(\"vol1\"\|getElementById(\"dur1\"\|getElementById(\"pau1\"" js/
  ```
  Erwartet: keine Treffer.

- **Versionsbump tatsächlich gesetzt**: `js/version.js` zeigt
  `3.2.249-beta`.

## Folge-BAs

- **BA 250** — UI-Änderung: Lautstärke/Tondauer/Tonpause im
  Elektrodenlautstärke-Test aus dem Header in die Tonart-Modalbox
  verschieben. Der `testAct`-Zweig in `_activeTestInput` wird dort
  erneut angepaßt (Lesen aus State-Variable statt aus DOM).
- **BA 251** — `jRes` komplett raus.
