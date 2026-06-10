# Bauanleitung 247-Fix — Bugfixes nach Elektrodenlautstärke-Migration

## Ziel

Vier Bugs aus dem Akzeptanztest von BA 247 beheben:

1. Leere blaue Hinweisbox unter dem Verfahren-Dropdown (testUI baut
   `verfahren-explain` immer, wenn es mehr als ein Verfahren gibt;
   bleibt leer wenn beide `explainKey: null` haben)
2. Modal „Testelektroden auswählen" startet mit allen Boxen aus
   (Init `_testSelectedEls = []` statt `null`; das Modal behandelt
   nur `null` als „alle ausgewählt")
3. Elektroden-Auswahl wirkt nur in Runde 1 (`nextFullRound` filtert
   nicht mit `_testFilterByElectrodeSelection`)
4. Filter-Semantik selbst war falsch: ODER (Erbe vom alten
   `selective`-Modus) statt UND. Konsequenz: `minSelected: 1` hat
   nicht zur Test-Logik gepaßt, weil ein Paarvergleich mindestens
   zwei gewählte Elektroden braucht

**Verhaltensänderung gegenüber BA 247**: Die Elektroden-Auswahl
spielt jetzt **nur Paare zwischen gewählten** Elektroden (UND-Logik).
Beispiel: Auswahl `{E1, E3, E5}` → es werden ausschließlich E1↔E3,
E1↔E5, E3↔E5 gespielt. Damit braucht der Test mindestens zwei
ausgewählte Elektroden.

## Voraussetzungen

- BA 247 ist gebaut, aktuelle Version: `3.2.247.1-beta`
- i18n: nur Deutsch

## Schritt 1 — Versionsbump

`js/version.js`:

```js
// vorher
const APP_VERSION = "3.2.247.1-beta";

// nachher
const APP_VERSION = "3.2.247.2-beta";
```

## Schritt 2 — Bug 1: verfahren-explain-Box ein-/ausblenden

Die Info-Box unter dem Verfahren-Dropdown soll nur sichtbar sein,
wenn das aktive Verfahren tatsächlich einen `explainKey` hat.

`js/test-ui.js` — zwei Stellen.

### 2a — Initial-Render (etwa Z. 844–845)

**Suche**:

```js
    var _firstExplainKey = cfg.verfahren[0] && cfg.verfahren[0].explainKey;
    if (_firstExplainKey) _tEl(verfahrenExplainSpan, _firstExplainKey);
```

**Ersetze durch**:

```js
    var _firstExplainKey = cfg.verfahren[0] && cfg.verfahren[0].explainKey;
    if (_firstExplainKey) {
      _tEl(verfahrenExplainSpan, _firstExplainKey);
    } else {
      // BA 247fix: keine leere Box anzeigen, wenn das Verfahren keinen explainKey hat.
      verfahrenExplainBox.style.display = 'none';
    }
```

### 2b — Update bei Verfahren-Wechsel (etwa Z. 1630–1633)

**Suche**:

```js
      if (headerRefs.verfahrenExplainSpan && newVCfg && newVCfg.explainKey) {
        _tEl(headerRefs.verfahrenExplainSpan, newVCfg.explainKey);
        _applyLangSubtree(headerRefs.verfahrenExplainBox);
      }
```

**Ersetze durch**:

```js
      if (headerRefs.verfahrenExplainSpan && newVCfg && newVCfg.explainKey) {
        _tEl(headerRefs.verfahrenExplainSpan, newVCfg.explainKey);
        if (headerRefs.verfahrenExplainBox) {
          headerRefs.verfahrenExplainBox.style.display = '';
        }
        _applyLangSubtree(headerRefs.verfahrenExplainBox);
      } else if (headerRefs.verfahrenExplainBox) {
        // BA 247fix: Box ausblenden, wenn das neue Verfahren keinen explainKey hat.
        headerRefs.verfahrenExplainBox.style.display = 'none';
      }
```

## Schritt 3 — Bug 2: Initial-Auswahl auf null setzen

`js/test.js` — zwei Stellen.

### 3a — Initialisierung (Z. 1046)

**Suche**:

```js
let _testSelectedEls = [];  // BA 247: Elektroden-Auswahl im Header
```

**Ersetze durch**:

```js
// BA 247fix: null = "alle testable ausgewaehlt" (Konvention aus
// test-ui.js Z. 2270 und aus lr-balance). Leeres Array waere im
// Modal als "keine ausgewaehlt" interpretiert.
let _testSelectedEls = null;
```

### 3b — `getSelection`-Callback (Z. 1129)

**Suche**:

```js
          getSelection:    function()    { return _testSelectedEls.slice(); },
```

**Ersetze durch**:

```js
          getSelection:    function()    { return _testSelectedEls ? _testSelectedEls.slice() : null; },
```

## Schritt 4 — Bug 4: Filter-Semantik auf UND umstellen

`js/test.js` — zwei Stellen.

### 4a — Filter-Funktion (etwa Z. 776–782)

**Suche**:

```js
function _testFilterByElectrodeSelection(pairs) {
  var sel = _testSelectedEls;
  if (!sel || !sel.length) return pairs;
  var s = new Set(sel);
  return pairs.filter(function(p) {
    return s.has(p[0]) || s.has(p[1]);
  });
}
```

**Ersetze durch**:

```js
// BA 247fix: UND-Logik statt ODER. Es werden nur Paare gespielt,
// in denen BEIDE Elektroden in der Auswahl stehen. Konsequenz: ein
// Paarvergleich braucht mindestens zwei ausgewaehlte Elektroden
// (vgl. minSelected: 2 im electrodeSelection-Block).
function _testFilterByElectrodeSelection(pairs) {
  var sel = _testSelectedEls;
  if (!sel || !sel.length) return pairs;
  var s = new Set(sel);
  return pairs.filter(function(p) {
    return s.has(p[0]) && s.has(p[1]);
  });
}
```

### 4b — `minSelected` auf 2 (Z. 1128)

**Suche**:

```js
        electrodeSelection: {
          minSelected: 1,
```

**Ersetze durch**:

```js
        electrodeSelection: {
          // BA 247fix: zwei Elektroden noetig, sonst kein Paar.
          minSelected: 2,
```

## Schritt 5 — Bug 3: `nextFullRound` filtert mit

`js/test.js`, Funktion `nextFullRound` (etwa Z. 969–973).

**Suche**:

```js
  const actSet = new Set(actEl());
  const roundPairs = rrTable[s.fullSweepRound - 1].filter(
    ([a, b]) => actSet.has(a) && actSet.has(b),
  );
  testPairs = randAB(shuffle(roundPairs));
```

**Ersetze durch**:

```js
  const actSet = new Set(actEl());
  const roundPairs = rrTable[s.fullSweepRound - 1].filter(
    ([a, b]) => actSet.has(a) && actSet.has(b),
  );
  // BA 247fix: Elektroden-Auswahl im Header gilt auch ab der zweiten
  // Runde, nicht nur beim Start (startTestFull).
  const filtered = _testFilterByElectrodeSelection(roundPairs);
  testPairs = randAB(shuffle(filtered));
```

## Schritt 6 — Akzeptanztest

1. **Browser-Cache leeren, Anwendung neu laden**
   Erwartet: kein JS-Fehler in der Konsole; `3.2.247.2-beta` sichtbar.

2. **Sub-Tab Elektrodenlautstärke öffnen**
   Erwartet: **keine** leere blaue Box unter dem Verfahren-Dropdown.

3. **Verfahren-Dropdown wechseln**
   Auf „Konvergenz" wechseln, dann zurück auf „Round Robin
   (Vollständig)". Erwartet: in beiden Fällen keine leere Hinweisbox.

4. **„Auswahl ändern" öffnen**
   Erwartet: **alle** testable-Elektroden sind initial angehakt.
   Stumme/ausgeschlossene Elektroden sind ausgegraut und nicht
   anklickbar.

5. **Mindestens-2-Regel**
   In der Auswahl alle bis auf eine abwählen, „Bestätigen": erwartet
   Fehlermeldung „Mindestens 2 Elektrode(n) auswählen.". Wenn 2
   Elektroden ausgewählt sind: bestätigt durch.

6. **UND-Filter über die ganze Round-Robin-Sequenz**
   Auswahl auf z.B. **E1, E3 und E5** reduzieren, bestätigen.
   Round Robin starten. Erwartet:
   - Gespielt werden **ausschließlich** Paare zwischen E1, E3, E5
     (also: E1↔E3, E1↔E5, E3↔E5). Keine Paare mit E2, E4, E6, …
   - Die Sequenz läuft durch alle Round-Robin-Runden hindurch (auch
     Runde 2, 3, …) und filtert dort genauso.

7. **Zwei Elektroden — genau ein Paar pro Runde**
   Auswahl auf nur E1 und E5 reduzieren, Round Robin starten.
   Erwartet: in jeder Runde wird genau ein Paar gespielt: E1↔E5.
   Nach Bestätigen springt der Test zur nächsten Runde.

8. **Stereo-Balance unverändert**
   Sub-Tab Stereo-Balance öffnen, Test starten. Erwartet: keine
   leere Hinweisbox (hat nur ein Verfahren — Box wird gar nicht
   gebaut). Swap-Button trägt weiterhin „L↔R".

9. **Frequenzabgleich unverändert**
   Sub-Tab Frequenzabgleich öffnen. Erwartet: Info-Box unter dem
   Verfahren-Dropdown zeigt weiterhin den Text des aktiven Verfahrens
   (z.B. „fmExplainSlider" oder „fmExplainAdaptive").

## Schritt 7 — Selbstprüfungs-Auftrag an Sonnet

Bevor du den Build als fertig meldest: gehe Akzeptanzschritte 1–9
einzeln durch und melde für jeden Schritt: **erfüllt** / **nicht erfüllt**
/ **unklar**, jeweils mit Datei- und Zeilenangabe der relevanten
Code-Stelle.

Drei Pflicht-Checks vor Build-Abschluß:

- **Modal-Logik nicht versehentlich an anderer Stelle gebrochen**:
  ```
  grep -n "minSelected" js/lr-balance.js js/test.js
  ```
  Erwartet: lr-balance unverändert `minSelected: 1`, test.js
  `minSelected: 2`.
- **Verfahren-Explain bei freqmatch nicht versehentlich versteckt**:
  Sub-Tab Frequenzabgleich öffnen — die Info-Box zeigt Inhalt
  (BA 109/110). Wenn nicht: Fix in Schritt 2 hat zu strikt verändert.
- **Versionsbump tatsächlich gesetzt**: `js/version.js` zeigt
  `3.2.247.2-beta`.
