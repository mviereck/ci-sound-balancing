# Bauanleitung 98 — Frequenzabgleich: zweiten Fortschrittsbalken und Lauf-2-Reste entfernen, Anti-Überschreib-Dialog ab erstem abgeschlossenen Lauf

## Kontext

Im adaptiven Frequenzabgleich gibt es noch UI-Reste aus dem
früheren Lauf-1/Lauf-2-Konzept (BA 88–90), das durch die
`runs[]`-Architektur in BA 93/94 abgelöst wurde. Diese Reste:

- Ein zweiter, hartcodierter Fortschrittsbalken („Lauf 2") in
  `js/freqmatch.js`. Er trägt seit BA 93 keine Information mehr
  (er zeigt entweder „—" oder „100 %"), verwirrt aber den Nutzer.
- Ein Hinweistext-Element `fmLauf2HintEl` und die Hilfsfunktion
  `_fmShowLauf2Hint`, die nichts mehr tut als das Element zu
  verstecken.
- Vier obsolete i18n-Keys (`fmLblLauf1`, `fmLblLauf2`,
  `fmLblRun2Start`, `fmLblResumeL2`, `fmLblRun2Hint`).

Außerdem greift der Anti-Überschreib-Dialog beim Start eines
weiteren Laufs erst ab `runs.length >= 2`. Der Nutzer möchte ihn
schon ab dem ersten abgeschlossenen Lauf sehen — sonst startet
der zweite Lauf still und der Nutzer weiß nicht, daß seine
früheren Daten erhalten bleiben.

Diese Anleitung räumt alle Reste auf und passt den Dialog an.

## Volumen

Eine Datei, kleine mechanische Änderungen.

## Schritt 1 — `js/version.js`

Konstante hochzählen.

**Vorher** (Z. 1):
```js
const APP_VERSION = "3.0.97-beta";
```

**Nachher**:
```js
const APP_VERSION = "3.0.98-beta";
```

## Schritt 2 — Zweiten Fortschrittsbalken entfernen (DOM-Bau)

In `js/freqmatch.js` den Block ab Z. 1701 bis Z. 1732 ersatzlos
löschen. Konkret das hier:

```js
  // Hinweistext für Lauf-2-Empfehlung (nach Lauf-1-Abschluss)
  const _lauf2Hint = _mkEl('p', 'explain explain-info');
  _lauf2Hint.id = 'fmLauf2HintEl';
  _lauf2Hint.hidden = true;
  if (typeof t === 'function') _lauf2Hint.textContent = t('fmLblRun2Hint') || '';
  // Einfügen nach explainBox (vor testBox)
  fmEls.explainBox.insertAdjacentElement('afterend', _lauf2Hint);

  // Zweiter Fortschrittsbalken für Lauf 2
  const _lauf1Label = _mkEl('span', 'fm-lauf-label');
  _lauf1Label.dataset.t = 'fmLblLauf1';
  _lauf1Label.textContent = (typeof t === 'function' && t('fmLblLauf1')) || 'Lauf 1';
  _lauf1Label.style.cssText = 'font-size:.82em;color:#6b7280;display:block;margin-top:.4rem';

  const _lauf2Label = _mkEl('span', 'fm-lauf-label');
  _lauf2Label.dataset.t = 'fmLblLauf2';
  _lauf2Label.textContent = (typeof t === 'function' && t('fmLblLauf2')) || 'Lauf 2';
  _lauf2Label.style.cssText = 'font-size:.82em;color:#6b7280;display:block;margin-top:.6rem';

  const _pb2 = _mkEl('div', 'progress-bar');
  fmEls.progressFill2 = _mkEl('div', 'progress-fill');
  _pb2.appendChild(fmEls.progressFill2);
  fmEls.progressText2 = _mkEl('div', 'progress-text');
  fmEls.progressText2.textContent = (typeof t === 'function' && t('fmLblLauf2')) || 'Lauf 2';

  // Lauf-1-Label vor dem vorhandenen Balken einfügen
  const _existingBar = fmEls.progressFill.parentElement;
  _existingBar.insertAdjacentElement('beforebegin', _lauf1Label);
  // Lauf-2 nach dem vorhandenen Balken + progressText einfügen
  fmEls.progressText.insertAdjacentElement('afterend', fmEls.progressText2);
  fmEls.progressText.insertAdjacentElement('afterend', _pb2);
  fmEls.progressText.insertAdjacentElement('afterend', _lauf2Label);
```

Der Block direkt nach `fmEls.pauseInput.value = 400;` und vor dem
`// Modus-Switch (Bauanleitung 02b/2)`-Kommentar verschwindet
also komplett.

## Schritt 3 — Update-Logik für zweiten Balken entfernen

In `js/freqmatch.js` die Funktion `fmUpdateAdaptiveProgress`
ab Z. 1172 verkürzen.

**Vorher** (ab Z. 1172):
```js
  // Zweiter Balken: letzter abgeschlossener Lauf (falls vorhanden)
  if (!fmEls.progressFill2 || !fmEls.progressText2) return;
  let prevRun = null;
  let prevRunIdx = -1;
  if (fa && Array.isArray(fa.runs)) {
    for (let _i = fa.runs.length - 2; _i >= 0; _i--) {
      if (fa.runs[_i] && fa.runs[_i].completedAt != null) {
        prevRun = fa.runs[_i];
        prevRunIdx = _i;
        break;
      }
    }
  }
  if (prevRun) {
    const pStats = fmComputeProgressStats(prevRun.tracks || {});
    fmEls.progressFill2.style.width = '100%';
    fmEls.progressText2.textContent =
      'Lauf ' + (prevRunIdx + 1) + ': ' + pStats.done + ' / ' + pStats.total + ' · 100 %';
  } else {
    fmEls.progressFill2.style.width = '0%';
    fmEls.progressText2.textContent =
      (typeof t === 'function' && t('fmLblLauf2') || 'Lauf 2') + ': —';
  }
}
```

**Nachher**: der gesamte Block ab `// Zweiter Balken: …` bis zur
schließenden geschweiften Klammer der Funktion `}` wird durch
nur eine schließende geschweifte Klammer ersetzt:

```js
}
```

Die Funktion endet jetzt direkt nach dem `// Erster Balken`-Block.

## Schritt 4 — `_fmShowLauf2Hint` und Aufrufe entfernen

In `js/freqmatch.js`:

a) Funktion `_fmShowLauf2Hint` (Z. 515–519) löschen:

```js
function _fmShowLauf2Hint(_visible) {
  // BA 93: Lauf-1-Hinweis entfällt im N-Läufe-System. Element bleibt im DOM, wird immer versteckt.
  const el = document.getElementById('fmLauf2HintEl');
  if (el) el.hidden = true;
}
```

b) Aufrufe `_fmShowLauf2Hint(false);` an Z. 1014 und Z. 1377
ersatzlos entfernen.

## Schritt 5 — Anti-Überschreib-Dialog ab erstem abgeschlossenen Lauf

In `js/freqmatch.js` die Bedingung in Z. 528 anpassen.

**Vorher**:
```js
  if (_fa && Array.isArray(_fa.runs) && _fa.runs.length >= 2) {
```

**Nachher**:
```js
  if (_fa && Array.isArray(_fa.runs) && _fa.runs.length >= 1) {
```

Die Logik dahinter bleibt: der Dialog erscheint nur, wenn der
letzte Lauf abgeschlossen ist (`lastDone === true`). Ein
pausierter, noch nicht abgeschlossener Lauf wird über
`_fmTryRestore` als Resume behandelt — kein Dialog. Mit der
neuen Schwelle `>= 1` greift der Dialog jetzt korrekt schon
bei einem abgeschlossenen ersten Lauf.

## Schritt 6 — i18n-Text anpassen (Singular/Plural)

Der Text `fmAntiOverwriteMsg` ist heute für Plural formuliert
(„Sie haben bereits {N} Läufe gespeichert"). Bei `N=1` ergibt
das „1 Läufe". Text umformulieren, so daß er für jede Lauf-Anzahl
paßt.

In `i18n/de.js` Z. 608:

**Vorher**:
```js
    fmAntiOverwriteMsg: 'Sie haben bereits {N} Läufe gespeichert. Ein weiterer Lauf wird zum Datensatz hinzugefügt und in die kombinierte Auswertung einbezogen. Wenn Sie ganz neu beginnen wollen, drücken Sie „Messungen löschen".',
```

**Nachher**:
```js
    fmAntiOverwriteMsg: 'Eine vorherige Messung ist bereits gespeichert (bisher {N} Lauf/Läufe). Ein weiterer Lauf wird zum Datensatz hinzugefügt und in die kombinierte Auswertung einbezogen. Die bisherigen Werte bleiben erhalten. Wenn Sie ganz neu beginnen wollen, drücken Sie „Messungen löschen".',
```

`{N}` bleibt drin und wird vom Aufrufer in
`freqmatch.js` Z. 537 weiterhin durch die aktuelle Lauf-Anzahl
ersetzt.

## Schritt 7 — Obsolete i18n-Keys aus `i18n/de.js` entfernen

In `i18n/de.js` die Zeilen 605, 606, 610, 611 und den
mehrzeiligen Block 612–617 ersatzlos löschen. Konkret:

```js
    fmLblLauf1:        'Lauf 1',
    fmLblLauf2:        'Lauf 2',
```

```js
    fmLblRun2Start:    'Zweiten Lauf starten',
    fmLblResumeL2:     'Zweiten Lauf fortsetzen',
    fmLblRun2Hint:     'Erster Messdurchlauf abgeschlossen. Der zweite Durchlauf ist empfohlen ' +
                       'und startet nahe am gemessenen Wert — er dauert typisch halb so lang ' +
                       'wie der erste. Er dient zwei Zwecken: Der Mittelwert beider Läufe ist ' +
                       'eine zuverlässigere Schätzung des Frequenzunterschieds. Und die ' +
                       'Differenz zwischen den Läufen zeigt pro Elektrode, wie reproduzierbar ' +
                       'das Ergebnis ist.',
```

Die Keys `fmLblStart`, `fmLblResume`, `fmLblNewRun` bleiben
erhalten — sie werden weiter verwendet.

## Schritt 8 — Spec-Eintrag aktualisieren

In `docs/spec/02b-freqmatch-adaptiv.md` den Abschnitt
„Anti-Überschreib-Logik" (etwa Z. 454–466) so anpassen, daß die
Schwelle nicht mehr `>= 2` sondern `>= 1` ist.

**Vorher** (Auszug):
```
**Anti-Überschreib-Logik** beim Start eines neuen Laufs:
- Bei `runs.length ≥ 2`: Bestätigungs-Dialog
  „Sie haben bereits N Läufe gespeichert. Ein weiterer Lauf wird zum
  Datensatz hinzugefügt und in die kombinierte Auswertung einbezogen.
  Wenn Sie ganz neu beginnen wollen, drücken Sie [Messungen löschen]."
```

**Nachher**:
```
**Anti-Überschreib-Logik** beim Start eines neuen Laufs:
- Bei `runs.length ≥ 1` und letztem Lauf abgeschlossen: Bestätigungs-Dialog
  „Eine vorherige Messung ist bereits gespeichert (bisher N Lauf/Läufe).
  Ein weiterer Lauf wird zum Datensatz hinzugefügt und in die kombinierte
  Auswertung einbezogen. Die bisherigen Werte bleiben erhalten. Wenn Sie
  ganz neu beginnen wollen, drücken Sie [Messungen löschen]."
```

Außerdem im Abschnitt „Aufteilung der Bauanleitungen" am Ende
des Dokuments den Punkt zu BA 98 ergänzen:

```
- **BA 98** — Cleanup: zweiter Fortschrittsbalken und Lauf-2-Reste entfernen,
  Anti-Überschreib-Dialog ab `runs.length ≥ 1`
```

## Akzeptanztest

Nutzer im Browser ausführen, nach Hard-Reload (Cache leeren oder
Strg+Shift+R).

1. Tab „Messungen" → Sub-Tab „Frequenzabgleich". **Erwartet:**
   nur ein Fortschrittsbalken oberhalb des Test-Blocks, kein
   zweiter darunter. Keine „Lauf 1"/„Lauf 2"-Beschriftung
   neben den Balken.
2. Auf „Start Frequenzabgleich" klicken. **Erwartet:** Test
   startet, einziger Balken zeigt „Lauf 1: x / y · z %".
3. Test komplett durchlaufen lassen (oder im Sim-Modus
   abschließen lassen). Nach Abschluß zurück in den Sub-Tab
   Frequenzabgleich. **Erwartet:** Start-Button-Beschriftung
   lautet jetzt „Weiteren Lauf starten".
4. Auf „Weiteren Lauf starten" klicken. **Erwartet:**
   Bestätigungs-Dialog erscheint mit Text „Eine vorherige
   Messung ist bereits gespeichert (bisher 1 Lauf/Läufe). Ein
   weiterer Lauf wird zum Datensatz hinzugefügt …".
5. Im Dialog auf „OK" klicken. **Erwartet:** Lauf 2 startet,
   einziger Balken zeigt jetzt „Lauf 2: x / y · z %".
6. Lauf 2 abbrechen (Stop-Knopf), kurz später wieder
   „Weiteren Lauf starten" klicken. **Erwartet:** Test setzt
   pausierten Lauf 2 fort, **ohne** Bestätigungs-Dialog
   (Resume statt neuer Lauf).
7. Browser-Konsole prüfen. **Erwartet:** keine
   `ReferenceError`/`TypeError` zu `progressFill2`,
   `progressText2`, `fmLauf2HintEl`, `_fmShowLauf2Hint`,
   `fmLblLauf1`, `fmLblLauf2`, `fmLblRun2Hint`, `fmLblRun2Start`
   oder `fmLblResumeL2`.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Position einzeln
durchgehen und mit Datei + Zeile melden: erfüllt / nicht erfüllt /
unklar. Bei „unklar" Rückfrage stellen, nicht stillschweigend
annehmen.

Zusätzlich vor dem Versand kurz prüfen:

- `grep -n "progressFill2\|progressText2\|fmLauf2HintEl\|_fmShowLauf2Hint" js/freqmatch.js`
  muß **leer** sein.
- `grep -n "fmLblLauf1\|fmLblLauf2\|fmLblRun2Start\|fmLblResumeL2\|fmLblRun2Hint" i18n/de.js js/freqmatch.js`
  muß **leer** sein.
- `js/version.js` enthält `APP_VERSION = "3.0.98-beta"`.

## Folge-Anleitung

Nach Abnahme dieser Bauanleitung folgt BA 99 (Drei-Spalten-
Ergebnis-Tabelle mit Konvergenz u/d, Track-Differenz, Residuum).
Diese Anleitung BA 98 ist Voraussetzung für BA 99, weil die
i18n-Spaltennamen in BA 99 darauf aufbauen, daß die Reste der
alten Lauf-2-Anzeige entfernt sind.

i18n en/fr/es nicht in dieser Anleitung — kommt in einer eigenen
Mini-Anleitung, wenn die deutschen GUI-Texte aus BA 98 und BA 99
stehen.
