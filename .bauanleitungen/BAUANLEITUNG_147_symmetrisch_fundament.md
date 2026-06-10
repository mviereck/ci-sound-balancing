# BAUANLEITUNG 147 — SYMMETRISCH-Modus: Fundament (State, Dropdown, Sequenz, Init, Stub)

**Zieldateien:** `js/freqmatch.js`, `js/freqmatch-slider.js`, `js/freqmatch-adaptive.js`, `js/test-ui.js`, `i18n/de.js`, `js/version.js`
**Voraussetzung:** BA 146 abgeschlossen (`APP_VERSION = "3.0.146-beta"`, `_fmAutoSetRefMode()` existiert)
**Version:** 3.0.146-beta → **3.0.147-beta**

---

## Kontext

Für bilateral mit CI versorgte Nutzer soll im Frequenzabgleich ein dritter
Modus „SYMMETRISCH" gewählt werden können. Statt einer fixen Referenzseite
spielen beide CI-Seiten an ihrer eigenen Elektrodenmitte ± halbe Cent-Distanz
(Nachbarelektroden-Einfluß wird auf beide Seiten verteilt).

**Vorzeichenkonvention (verbindlich für alle drei Modi im symmetric-Pfad):**
`fmCentOffset > 0` bedeutet — rechte Seite klingt höher.

**Platzhalter-Konvention für `fmVarSide`/`fmRefSide` im symmetric-Modus:**
- `fmVarSide = 'left'` — Speicherseite für Adaptiv-Runs (`sideData.left.freqmatchAdaptive.*`)
- `fmRefSide = 'right'` — physische rechte Seite

Diese Konvention erlaubt es, den bestehenden Audio-Pfad
`playOne(fmRefSide, refHz)` / `playOne(fmVarSide, varHz)` (siehe
`freqmatch-adaptive.js` Z. 276-282 / `freqmatch.js` Z. 306-312) in BA 148
unverändert zu nutzen, indem nur die `refHz`/`varHz`-Berechnung pro Trial
durch die symmetrische Variante ersetzt wird.

**Was diese BA macht:**
- State, Dropdown-Option, Sequenz-Builder, Init-Logik, Sperre wenn
  unterschiedliche Elektroden aktiv sind
- Auto-Default „symmetric" bei beidseitig CI
- Stub-Alert beim Start (Slider UND Adaptiv) — bricht den Teststart
  kontrolliert ab, ohne Audio aufzurufen.

**Was diese BA NICHT macht (kommt in BA 148):**
- Audio-Wiedergabe symmetric (Slider + Adaptiv)
- Slider-UI-Anzeige beider Seiten
- Datenspeicherung mit `refSide: 'symmetric'` in `sliderEstimates` und `fRes`
- `fmPrevCent` symmetric-Pfad

---

## Schritt 1 — State-Variable `fmSymmetric` einführen

Datei: `js/freqmatch.js`

Suche die Zeilen (Z. ~16):
```js
let fmRefSide = "left";
let fmVarSide = "right";
```

Füge **direkt danach** ein:
```js
let fmSymmetric = false;   // true wenn refSelect.value === 'symmetric'
```

---

## Schritt 2 — Dropdown-Option in `test-ui.js`

Datei: `js/test-ui.js`

Suche den Block (Z. ~745-751):
```js
    } else if (hc.refSelect.type === 'side') {
      ['left', 'right'].forEach(function(s) {
        var opt = new Option('', s);
        _tEl(opt, s === 'left' ? 'sideLeft' : 'sideRight');
        refSelect.appendChild(opt);
      });
    }
```

Ersetze ihn durch:
```js
    } else if (hc.refSelect.type === 'side') {
      ['left', 'right'].forEach(function(s) {
        var opt = new Option('', s);
        _tEl(opt, s === 'left' ? 'sideLeft' : 'sideRight');
        refSelect.appendChild(opt);
      });
      if (hc.refSelect.includeSymmetric) {
        var optSym = new Option('', 'symmetric');
        _tEl(optSym, 'fmSymmetricOption');
        refSelect.appendChild(optSym);
      }
    }
```

---

## Schritt 3 — `includeSymmetric: true` in freqmatch-Konfig

Datei: `js/freqmatch.js`

Suche (Z. ~765):
```js
        refSelect:    { type: 'side', key: 'fmLblRef' },
```

Ersetze durch:
```js
        refSelect:    { type: 'side', key: 'fmLblRef', includeSymmetric: true },
```

---

## Schritt 4 — `_fmInitSides()` für symmetric erweitern

Datei: `js/freqmatch.js`

Aktueller Funktionskörper (Z. ~271-274):
```js
function _fmInitSides() {
  fmRefSide = fmEls.header.refSelect.value;
  fmVarSide = fmRefSide === 'left' ? 'right' : 'left';
}
```

Ersetze ihn durch:
```js
function _fmInitSides() {
  const val = fmEls.header.refSelect.value;
  fmSymmetric = (val === 'symmetric');
  if (fmSymmetric) {
    // Platzhalter-Konvention (siehe BA 147 Kontext):
    // var='left' = Speicherseite für Runs/Estimates, ref='right'.
    fmVarSide = 'left';
    fmRefSide = 'right';
  } else {
    fmRefSide = val;
    fmVarSide = (fmRefSide === 'left') ? 'right' : 'left';
  }
}
```

---

## Schritt 5 — `fmBuildSeqSymmetric()` einführen

Datei: `js/freqmatch.js`

Aktuelle Referenz-Implementierung (Z. ~239-251):
```js
function fmBuildSeq() {
  const elList = withSide(fmVarSide, () => {
    const result = [];
    for (let i = 0; i < nEl; i++) {
      if (elSt[i] === "deactivated") continue;
      if (elExDur[i]) continue;
      result.push({ idx: i, hz: effFreq(i) });
    }
    return result;
  });
  elList.sort((a, b) => a.hz - b.hz);
  return elList.map((x) => x.idx);
}
```

Füge **direkt nach** `fmBuildSeq()` (vor `fmPrevCent`) ein:

```js
// Symmetrische Sequenz: nur wenn beide Seiten dieselbe Menge aktiver
// Elektroden haben (selbe Indices). Rückgabe sonst null.
// Sortiert nach Durchschnitts-Mittenfrequenz (links/rechts gemittelt).
function fmBuildSeqSymmetric() {
  function activeList(side) {
    return withSide(side, function() {
      const r = [];
      for (let i = 0; i < nEl; i++) {
        if (elSt[i] === "deactivated") continue;
        if (elExDur[i]) continue;
        r.push(i);
      }
      return r;
    });
  }
  const leftList  = activeList('left');
  const rightList = activeList('right');
  if (leftList.length !== rightList.length) return null;
  for (let j = 0; j < leftList.length; j++) {
    if (leftList[j] !== rightList[j]) return null;
  }
  const seq = leftList.map(function(idx) {
    const fl = withSide('left',  function() { return effFreq(idx); });
    const fr = withSide('right', function() { return effFreq(idx); });
    return { idx: idx, hz: (fl + fr) / 2 };
  });
  seq.sort(function(a, b) { return a.hz - b.hz; });
  return seq.map(function(x) { return x.idx; });
}
```

**Hinweis:** Aktivitätsbedingung ist 1:1 aus `fmBuildSeq()` übernommen
(`elSt[i] === "deactivated"`, `elExDur[i]`). Wenn künftig weitere
Aktivitätsbedingungen hinzukommen, müssen beide Funktionen synchron gehalten
werden.

---

## Schritt 6 — `fmLoadVerfahrenFromSide()` für symmetric erweitern

Datei: `js/freqmatch.js`

Aktuelle ersten zwei Zeilen des Funktionskörpers (Z. ~727-728):
```js
  fmRefSide = fmEls.header.refSelect.value;
  fmVarSide = fmRefSide === 'left' ? 'right' : 'left';
```

Ersetze durch:
```js
  const _refVal = fmEls.header.refSelect.value;
  fmSymmetric = (_refVal === 'symmetric');
  if (fmSymmetric) {
    fmVarSide = 'left';
    fmRefSide = 'right';
  } else {
    fmRefSide = _refVal;
    fmVarSide = (fmRefSide === 'left') ? 'right' : 'left';
  }
```

Der Rest der Funktion (`const fa = ...`, `hasAdaptive`,
`fmUpdateSliderModeAvail()`, optional `fmSetVerfahren('adaptive', ...)`,
`fmRefreshResumeHint()`) bleibt **unverändert**.

---

## Schritt 7 — `fmUpdateSliderModeAvail()` für symmetric erweitern

Datei: `js/freqmatch.js`

Aktuelle Anfangszeilen (Z. ~680-683):
```js
function fmUpdateSliderModeAvail() {
  if (!fmEls) return;
  const _varSide = (fmEls.header && fmEls.header.refSelect)
    ? (fmEls.header.refSelect.value === 'left' ? 'right' : 'left')
    : fmVarSide;
```

Ersetze durch:
```js
function fmUpdateSliderModeAvail() {
  if (!fmEls) return;
  const _refVal2 = (fmEls.header && fmEls.header.refSelect)
    ? fmEls.header.refSelect.value : null;
  const _varSide = (!_refVal2 || _refVal2 === 'symmetric')
    ? (_refVal2 === 'symmetric' ? 'left' : fmVarSide)
    : (_refVal2 === 'left' ? 'right' : 'left');
```

Der Rest der Funktion (`const sd = ...`, `hasAnswers`, `testUI.field.setEnabled`,
optionaler `fmSetVerfahren`-Aufruf) bleibt **unverändert**.

---

## Schritt 8 — `_fmDoStartAdaptive` Side-Setup konsolidieren

Datei: `js/freqmatch-adaptive.js`

Suche im `_fmDoStartAdaptive`-Block (Z. ~87-88):
```js
  fmRefSide = fmEls.header.refSelect.value;
  fmVarSide = fmRefSide === 'left' ? 'right' : 'left';
```

Ersetze durch:
```js
  _fmInitSides();
```

Begründung: Statt manueller Side-Zuweisung — die im symmetric-Fall
`fmRefSide='symmetric'` produzieren würde, was inkonsistent ist — nutzen
wir `_fmInitSides()` (aus Schritt 4 mit symmetric-Wissen).

---

## Schritt 9 — `_fmAutoSetRefMode()` für symmetric erweitern

Datei: `js/freqmatch.js`

Die Funktion ist in BA 146 eingeführt und endet derzeit so (nach der
`} else if (rightIsCI && !leftIsCI)`-Verzweigung):

```js
  if (leftIsCI && !rightIsCI) {
    fmEls.header.refSelect.value = 'right';
  } else if (rightIsCI && !leftIsCI) {
    fmEls.header.refSelect.value = 'left';
  }
  // beide CI oder beide akustisch: kein Override (Sperre wird durch
  // _fmRenderBlockedWarning separat behandelt).
}
```

Ersetze den `if`-Block (vom `if (leftIsCI` bis zur schließenden `}` der
Funktion, **ohne** die Funktionsklammer selbst) durch:

```js
  if (leftIsCI && !rightIsCI) {
    fmEls.header.refSelect.value = 'right';
  } else if (rightIsCI && !leftIsCI) {
    fmEls.header.refSelect.value = 'left';
  } else if (leftIsCI && rightIsCI) {
    // Beide CI: 'symmetric' setzen, sofern die Dropdown-Option existiert.
    const hasSym = Array.from(fmEls.header.refSelect.options).some(function(o) {
      return o.value === 'symmetric';
    });
    if (hasSym) fmEls.header.refSelect.value = 'symmetric';
  }
  // beide akustisch: kein Override (Sperre wird durch _fmRenderBlockedWarning behandelt).
}
```

---

## Schritt 10 — `fmStartSlider` symmetric-Pfad mit Stub

Datei: `js/freqmatch-slider.js`

Aktueller Funktionskörper (Z. ~59-73):
```js
function fmStartSlider() {
  if (!fmEls) return;
  _fmInitSides();
  fmSeq = fmBuildSeq();
  if (fmSeq.length === 0) {
    alert((typeof t === 'function' && t('fmNoActiveEl')) || 'Keine aktiven Elektroden auf der variablen Seite.');
    fmEls._stopTest();
    return;
  }
  testUI.sideCheck.run(
    { sides: 'both' },
    _fmDoStartSlider,
    function() { if (fmEls) fmEls._stopTest(); }
  );
}
```

Ersetze ihn durch:
```js
function fmStartSlider() {
  if (!fmEls) return;
  _fmInitSides();
  if (fmSymmetric) {
    fmSeq = fmBuildSeqSymmetric();
    if (fmSeq === null) {
      alert((typeof t === 'function' && t('fmSymmetricElMismatch'))
        || 'Symmetrischer Modus: Beide Seiten müssen dieselben aktiven Elektroden haben.');
      fmEls._stopTest();
      return;
    }
    if (fmSeq.length === 0) {
      alert((typeof t === 'function' && t('fmNoActiveEl')) || 'Keine aktiven Elektroden.');
      fmEls._stopTest();
      return;
    }
    // Audio kommt in BA 148. Vorerst Stub-Alert + Stop.
    alert((typeof t === 'function' && t('fmSymmetricNotYet'))
      || 'Symmetrischer Modus: Audiowiedergabe wird in der nächsten Version aktiviert.');
    fmEls._stopTest();
    return;
  }
  fmSeq = fmBuildSeq();
  if (fmSeq.length === 0) {
    alert((typeof t === 'function' && t('fmNoActiveEl')) || 'Keine aktiven Elektroden auf der variablen Seite.');
    fmEls._stopTest();
    return;
  }
  testUI.sideCheck.run(
    { sides: 'both' },
    _fmDoStartSlider,
    function() { if (fmEls) fmEls._stopTest(); }
  );
}
```

---

## Schritt 11 — `fmStartAdaptive` symmetric-Pfad mit Stub

Datei: `js/freqmatch-adaptive.js`

Aktueller Funktionsanfang (Z. ~27-30):
```js
function fmStartAdaptive() {
  if (!fmEls) return;
  _fmInitSides();

  // Warnung wenn Slider-Test nur teilweise abgeschlossen
```

Füge **zwischen** `_fmInitSides();` und der Warnung **eine neue Verzweigung**
ein, sodass der Funktionsanfang lautet:

```js
function fmStartAdaptive() {
  if (!fmEls) return;
  _fmInitSides();

  if (fmSymmetric) {
    const _symSeq = fmBuildSeqSymmetric();
    if (_symSeq === null) {
      alert((typeof t === 'function' && t('fmSymmetricElMismatch'))
        || 'Symmetrischer Modus: Beide Seiten müssen dieselben aktiven Elektroden haben.');
      fmEls._stopTest();
      return;
    }
    if (_symSeq.length === 0) {
      alert((typeof t === 'function' && t('fmNoActiveEl')) || 'Keine aktiven Elektroden.');
      fmEls._stopTest();
      return;
    }
    // Audio kommt in BA 148. Vorerst Stub-Alert + Stop.
    alert((typeof t === 'function' && t('fmSymmetricNotYet'))
      || 'Symmetrischer Modus: Audiowiedergabe wird in der nächsten Version aktiviert.');
    fmEls._stopTest();
    return;
  }

  // Warnung wenn Slider-Test nur teilweise abgeschlossen
```

Der Rest der Funktion (Slider-Estimate-Check, Dialog, `testUI.sideCheck.run`)
bleibt **unverändert**.

---

## Schritt 12 — i18n-Strings in `i18n/de.js`

Datei: `i18n/de.js`

Suche den Key `fmHGWarn` (eingeführt in BA 146). Füge **direkt davor** ein:

```js
    fmSymmetricOption:     "Symmetrisch (bilateral CI)",
    fmSymmetricElMismatch: "Symmetrischer Modus nicht möglich: Beide Seiten müssen dieselben aktiven Elektroden haben. Bitte prüfen Sie, ob auf beiden Seiten dieselben Elektroden deaktiviert sind.",
    fmSymmetricNotYet:     "Symmetrischer Modus: Audiowiedergabe wird in der nächsten Version aktiviert.",
```

(Alle drei Strings haben nur die zwei äußeren ASCII-`"`, keine `"` im
Inneren — vor dem Speichern auf paarweise Anführungszeichen prüfen.)

---

## Schritt 13 — Version hochzählen

Datei: `js/version.js`

```js
const APP_VERSION = "3.0.147-beta";
```

---

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jede Position einzeln prüfen und melden
(erfüllt / nicht erfüllt / unklar, mit Datei+Zeile):

1. `let fmSymmetric = false;` direkt nach `fmRefSide`/`fmVarSide` in
   `freqmatch.js`.
2. `test-ui.js`: nach dem `forEach`-Block für 'left'/'right' folgt ein
   `if (hc.refSelect.includeSymmetric)` Block, der eine dritte Option mit
   `value='symmetric'` und i18n-Key `fmSymmetricOption` anhängt.
3. `freqmatch.js` Config: `refSelect: { type: 'side', key: 'fmLblRef', includeSymmetric: true }`.
4. `_fmInitSides()` setzt im symmetric-Fall `fmSymmetric = true`,
   `fmVarSide = 'left'`, `fmRefSide = 'right'`. Im nicht-symmetric-Fall
   bleibt das Altverhalten erhalten und `fmSymmetric = false`.
5. `fmBuildSeqSymmetric()` ist nach `fmBuildSeq()` eingefügt, liefert
   `null` bei Längen-Mismatch oder Index-Mismatch, sonst Array sortiert nach
   Durchschnittsfrequenz.
6. `fmLoadVerfahrenFromSide()`: ersten zwei Zeilen ersetzt durch
   symmetric-aware-Block (siehe Schritt 6). Rest unverändert.
7. `fmUpdateSliderModeAvail()`: `_varSide`-Berechnung umgestellt auf
   symmetric-aware-Variante.
8. `_fmDoStartAdaptive`: Die zwei Zeilen `fmRefSide = …; fmVarSide = …;`
   sind durch `_fmInitSides();` ersetzt.
9. `_fmAutoSetRefMode()` enthält jetzt einen dritten Zweig
   `else if (leftIsCI && rightIsCI)`, der nur dann `refSelect.value = 'symmetric'`
   setzt, wenn die Option im Dropdown existiert.
10. `fmStartSlider`: nach `_fmInitSides()` ein `if (fmSymmetric)` Block mit
    Mismatch-Check, Empty-Check und Stub-Alert. Bei nicht-symmetric:
    Altverhalten.
11. `fmStartAdaptive`: zwischen `_fmInitSides()` und dem
    Slider-Estimate-Warnungs-Kommentar ein `if (fmSymmetric)` Block mit
    Mismatch-Check, Empty-Check und Stub-Alert.
12. `i18n/de.js`: `fmSymmetricOption`, `fmSymmetricElMismatch`,
    `fmSymmetricNotYet` jeweils mit ausgeglichener `"`-Zählung.
13. `APP_VERSION` in `js/version.js` ist `"3.0.147-beta"`.

---

## Akzeptanztest

1. App laden. Implantat: beide Seiten = CI. Tab Frequenzabgleich öffnen:
   - Dropdown „Referenzseite" enthält drei Einträge:
     Links / Rechts / „Symmetrisch (bilateral CI)". ✓
   - Auto-Default hat „Symmetrisch" gewählt (wenn keine Daten vorliegen). ✓
2. Beide CI mit identisch aktivierten Elektroden, Start im Slider klicken:
   - Alert: „Symmetrischer Modus: Audiowiedergabe wird in der nächsten
     Version aktiviert." ✓
   - Test endet, keine JS-Konsolen-Fehler. ✓
3. Beide CI, aber eine Elektrode auf links zusätzlich deaktiviert, Start
   (Slider oder Adaptiv):
   - Alert: „Symmetrischer Modus nicht möglich: Beide Seiten müssen
     dieselben aktiven Elektroden haben …". ✓
   - Test endet, keine JS-Konsolen-Fehler. ✓
4. Implantat: links = CI, rechts = HG. Tab Frequenzabgleich:
   - Dropdown enthält weiterhin alle drei Optionen.
   - Auto-Default zeigt „Rechts" (HG-Seite, BA 146-Logik). ✓
   - Manuell „Symmetrisch" wählen und Start: Mismatch-Alert oder Stub-Alert
     (je nach Elektroden-Konstellation). Kein JS-Crash. ✓
5. Im Slider-Modus (LEFT oder RIGHT) wie gewohnt testen: kein Stub-Alert,
   Test läuft wie vor BA 147. ✓
6. Im Adaptiv-Modus (LEFT oder RIGHT) wie gewohnt testen: kein Stub-Alert. ✓

---

*Hinweis: BA 148 entfernt die zwei Stub-Alerts, fügt die symmetric-
Audiopfade, die Slider-Anzeige und die Datenspeicherung hinzu.
Übersetzungen (en, fr, es) der drei neuen i18n-Keys werden in einer
eigenen Mini-Anleitung nachgezogen.*
