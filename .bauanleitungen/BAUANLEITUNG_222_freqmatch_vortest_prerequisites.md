# BAUANLEITUNG 222 — freqmatch: Vortest-Empfehlung über `cfg.prerequisites`

## Voraussetzung

- **BA 219, 220, 221 sind gebaut.** `js/version.js` zeigt mindestens
  `"3.2.221-beta"` (ggf. `3.2.221.x-beta`).
- Sonst: **diese Anleitung nicht ausführen**, nachfragen.

## Ziel

Heute baut `freqmatch.js` (`js/freqmatch.js:1232–1270`) ein eigenes
Modal-Overlay `fmSEDlg` mit drei Buttons („Slider-Test starten",
„Trotzdem adaptiv", „Abbrechen"). Der Adaptiv-Start-Hook
`fmStartAdaptive` öffnet es selbst (`js/freqmatch-adaptive.js:98–103`).

Mit BA 219 ist die generische TestUI-Mechanik dafür da:
`cfg.verfahren[].prerequisites` mit Auto-Dialog. Diese Anleitung stellt
freqmatch komplett darauf um:

1. `cfg.verfahren[1].prerequisites` (für `adaptive`) deklariert die
   Voraussetzung „mindestens eine Slider-Schätzung vorhanden".
2. Der `_fmShouldOfferSliderEstimate`-Block in `fmStartAdaptive`
   entfällt — TestUI öffnet den Dialog selbst, **bevor** `onStart`
   überhaupt aufgerufen wird.
3. Das eigene `fmSEDlg`-DOM samt Listenern und `fmEls.sliderEstimateDlg`-
   Zuweisung wird vollständig entfernt.

i18n-Keys (`fmSliderEstimateTitle`, `fmSliderEstimateMsg`,
`fmSliderEstimateBtnSlider`, `fmSliderEstimateBtnSkip`,
`fmSliderEstimateBtnCancel`) **bleiben** — werden nur jetzt von TestUI
gerendert.

Den separaten `window.confirm`-Block „Slider-Test nur teilweise
abgeschlossen" (`freqmatch-adaptive.js:83–96`) **nicht anfassen** —
das ist eine andere Prüfung mit dynamisch zusammengesetztem Text und
gehört nicht in den Scope dieser BA.

---

## Schritt 1 — `cfg.verfahren[1].prerequisites` einfügen

**Datei:** `js/freqmatch.js`

**Position:** Im Adaptive-Verfahren-Block (`js/freqmatch.js`, Zeilen
1200–1226). **Zwischen** dem `body:`-Block (endet bei
`debugRun: { key: 'btnDebugRun' }`-Zeile) und dem `hooks:`-Block.

**Vorher:**

```js
      {
        id: 'adaptive',
        labelKey:   'fmModeAdaptive',
        explainKey: 'fmExplainAdaptive',
        body: {
          pairIndicator:   { variant: 'token', leftKey: 'fmTone1', rightKey: 'fmTone2' },
          progress:        { format: 'simple' },
          instruction:     { key: 'hjPrompt' },
          decisionButtons: { variant: 'updown' },
          statusGrid:      { show: true },
          actions:         ['undo','replay','simul'],
          background: {
            bodyKey:    'fmExplainAdaptiveScience',
            bodyAsHtml: true
          },
          debugRun: { key: 'btnDebugRun' }
        },
        hooks: {
          onStart:    fmStartAdaptive,
          onStop:     fmAbort,
          onDecision: fmHandleHeight,
          onReplay:   fmPlayCurrent,
          onUndo:     fmUndoAdaptive,
          onSimul:    fmPlaySimultaneous,
          onDebugRun: fmRunDebugSim
        }
      }
```

**Nachher:**

```js
      {
        id: 'adaptive',
        labelKey:   'fmModeAdaptive',
        explainKey: 'fmExplainAdaptive',
        body: {
          pairIndicator:   { variant: 'token', leftKey: 'fmTone1', rightKey: 'fmTone2' },
          progress:        { format: 'simple' },
          instruction:     { key: 'hjPrompt' },
          decisionButtons: { variant: 'updown' },
          statusGrid:      { show: true },
          actions:         ['undo','replay','simul'],
          background: {
            bodyKey:    'fmExplainAdaptiveScience',
            bodyAsHtml: true
          },
          debugRun: { key: 'btnDebugRun' }
        },
        // BA 222: Vortest-Empfehlung. Verletzt, wenn fuer keine einzige
        // testbare Elektrode eine Slider-Schaetzung vorliegt. TestUI
        // oeffnet vor onStart ein Modal mit drei Optionen.
        prerequisites: [
          {
            checkFn:    function() { return !_fmShouldOfferSliderEstimate(); },
            titleKey:   'fmSliderEstimateTitle',
            messageKey: 'fmSliderEstimateMsg',
            actions: [
              {
                labelKey: 'fmSliderEstimateBtnSlider',
                kind:     'custom',
                run:      function() { fmSetVerfahren('slider'); }
              },
              {
                labelKey: 'fmSliderEstimateBtnSkip',
                kind:     'continue'
              },
              {
                labelKey: 'fmSliderEstimateBtnCancel',
                kind:     'abort'
              }
            ]
          }
        ],
        hooks: {
          onStart:    fmStartAdaptive,
          onStop:     fmAbort,
          onDecision: fmHandleHeight,
          onReplay:   fmPlayCurrent,
          onUndo:     fmUndoAdaptive,
          onSimul:    fmPlaySimultaneous,
          onDebugRun: fmRunDebugSim
        }
      }
```

---

## Schritt 2 — `fmStartAdaptive`: Dialog-Block entfernen

**Datei:** `js/freqmatch-adaptive.js`

**Hintergrund:** Da TestUI den Dialog jetzt **vor** `onStart` öffnet,
wird `fmStartAdaptive` nur noch dann aufgerufen, wenn der User
„Trotzdem adaptiv" (`kind:'continue'`) oder die Voraussetzung erfüllt
ist. Der `_fmShouldOfferSliderEstimate`-Block in `fmStartAdaptive`
ist damit toter Code und entfernt.

**Vorher** (`js/freqmatch-adaptive.js`, Zeilen 98–108):

```js
  if (_fmShouldOfferSliderEstimate()) {
    if (fmEls.sliderEstimateDlg) {
      fmEls.sliderEstimateDlg.classList.add('active');
      return; // testUI bleibt in "running" — Cancel/Slider-Buttons rufen _stopTest()
    }
  }
  testUI.sideCheck.run(
    { sides: 'both' },
    _fmDoStartAdaptive,
    function() { if (fmEls) fmEls._stopTest(); }
  );
}
```

**Nachher:**

```js
  testUI.sideCheck.run(
    { sides: 'both' },
    _fmDoStartAdaptive,
    function() { if (fmEls) fmEls._stopTest(); }
  );
}
```

**Hinweis:** `_fmShouldOfferSliderEstimate` **bleibt** als Funktion
erhalten und wird ab jetzt von `cfg.verfahren[1].prerequisites[0].checkFn`
aufgerufen.

---

## Schritt 3 — `fmSEDlg`-DOM komplett entfernen

**Datei:** `js/freqmatch.js`

**Vorher** (`js/freqmatch.js`, Zeilen 1232–1270 — der gesamte Block
zwischen `fmEls = buildTestPanel(parentEl, fmCfg);` und dem nachfolgenden
`// Events: Referenzseiten-Wechsel`-Kommentar):

```js
  // --- Slider-Empfehlungs-Dialog (BA 102) ---
  const fmSEDlg = _mkEl('div', 'modal-overlay');
  fmSEDlg.hidden = true;
  const fmSECard = _mkEl('div', 'card');
  const fmSETitle = _mkEl('h3');
  fmSETitle.dataset.t = 'fmSliderEstimateTitle';
  const fmSEMsg = _mkEl('p');
  fmSEMsg.dataset.t = 'fmSliderEstimateMsg';
  const fmSEBtnRow = _mkEl('div', 'controls-row');
  const fmSEBtnSlider = _mkEl('button', 'btn btn-primary');
  fmSEBtnSlider.dataset.t = 'fmSliderEstimateBtnSlider';
  const fmSEBtnSkip = _mkEl('button', 'btn');
  fmSEBtnSkip.dataset.t = 'fmSliderEstimateBtnSkip';
  const fmSEBtnCancel = _mkEl('button', 'btn');
  fmSEBtnCancel.dataset.t = 'fmSliderEstimateBtnCancel';
  fmSEBtnRow.append(fmSEBtnSlider, fmSEBtnSkip, fmSEBtnCancel);
  fmSECard.append(fmSETitle, fmSEMsg, fmSEBtnRow);
  fmSEDlg.appendChild(fmSECard);
  document.body.appendChild(fmSEDlg);

  fmSEBtnSlider.addEventListener('click', function() {
    fmSEDlg.classList.remove('active');
    if (fmEls && fmEls._stopTest) fmEls._stopTest();
    fmSetVerfahren('slider');
  });
  fmSEBtnSkip.addEventListener('click', function() {
    fmSEDlg.classList.remove('active');
    testUI.sideCheck.run(
      { sides: 'both' },
      _fmDoStartAdaptive,
      function() { if (fmEls) fmEls._stopTest(); }
    );
  });
  fmSEBtnCancel.addEventListener('click', function() {
    fmSEDlg.classList.remove('active');
    if (fmEls && fmEls._stopTest) fmEls._stopTest();
  });

  fmEls.sliderEstimateDlg = fmSEDlg;
```

**Nachher:** Block **vollständig löschen**. Direkt nach
`fmEls = buildTestPanel(parentEl, fmCfg);` folgt dann der bestehende
Kommentar `// Events: Referenzseiten-Wechsel ...`.

---

## Schritt 4 — `js/version.js` Versionsbump

**Vorher:**

```js
const APP_VERSION = "3.2.221-beta";
```

(oder `3.2.221.x-beta`)

**Nachher:**

```js
const APP_VERSION = "3.2.222-beta";
```

---

## i18n

Keine neuen Strings — alle benötigten i18n-Keys
(`fmSliderEstimateTitle`, `fmSliderEstimateMsg`,
`fmSliderEstimateBtnSlider`, `fmSliderEstimateBtnSkip`,
`fmSliderEstimateBtnCancel`) sind in allen vier Sprachdateien
bereits vorhanden.

---

## Akzeptanztest (manuell)

Voraussetzung: BA 222 gebaut, Cache leer.

**Fall A: Keine Slider-Daten vorhanden**
1. Tool öffnen, ggf. Daten zurücksetzen, sodass für die variable Seite
   **keine** Slider-Schätzungen existieren
   (`sideData[…].freqmatchAdaptive.sliderEstimates` leer).
2. Tab „Messungen" → „Frequenzabgleich". Verfahren „Adaptive" wählen.
3. „Start Frequenzabgleich" klicken.
   **Erwartet:** Modal-Overlay erscheint mit
   - Titel „Slider-Test zuerst empfohlen" (oder Sprach-Variante)
   - Body-Text aus `fmSliderEstimateMsg`
   - Drei Buttons: „Slider-Test starten" (blau), „Trotzdem adaptiv"
     (blau), „Abbrechen" (sekundär).
   - Der Test ist **noch nicht** aktiv: Tab-Sperre nicht gesetzt,
     Stop-Button bleibt deaktiviert.
4. „Abbrechen" klicken.
   **Erwartet:** Dialog schließt, Test startet nicht, alles im
   Ausgangszustand.
5. Erneut „Start Frequenzabgleich", diesmal „Slider-Test starten" klicken.
   **Erwartet:** Dialog schließt, Verfahren wechselt auf „Slider Round"
   (Dropdown zeigt jetzt „Slider"), Test ist **nicht** aktiv (kein
   Start ohne weiteren Klick).
6. Verfahren wieder auf „Adaptive" setzen, „Start" klicken, im Dialog
   „Trotzdem adaptiv" wählen.
   **Erwartet:** Dialog schließt, anschließend wie gewohnt der
   Seitenhörtest-Dialog von `testUI.sideCheck.run`. Nach dessen
   Bestätigung läuft der Adaptiv-Test.

**Fall B: Slider-Daten vorhanden**
7. Slider-Verfahren ausführen, mindestens eine Elektrode bestätigen.
8. Verfahren auf „Adaptive", „Start" klicken.
   **Erwartet:** **Kein** Vortest-Dialog mehr — direkt der
   Seitenhörtest-Dialog von `testUI.sideCheck.run`.

**Fall C: Slider-Verfahren startet weiterhin normal**
9. Verfahren „Slider Round", „Start" klicken.
   **Erwartet:** Kein Vortest-Dialog (Slider-Verfahren hat keine
   `prerequisites`). Start läuft wie gewohnt.

**Regression**
10. Stereo-Balance, Test, Implantat: keine Änderungen.
11. Frequenzabgleich-Slider: keine Änderungen.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Kriterie einzeln durchgehen
(erfüllt / nicht erfüllt / unklar, mit Datei + Zeile):

1. `js/freqmatch.js`: `cfg.verfahren[1]` (id `'adaptive'`) hat einen
   `prerequisites`-Eintrag mit genau einer Voraussetzung; `checkFn`
   ruft `!_fmShouldOfferSliderEstimate()` auf; `actions` enthält
   genau drei Einträge in der Reihenfolge
   Slider/Skip/Cancel mit den korrekten i18n-Keys und kinds
   `custom` / `continue` / `abort`.
2. `js/freqmatch-adaptive.js`: Der `if (_fmShouldOfferSliderEstimate())`-
   Block (ehemals Zeilen 98–103) ist ersatzlos gelöscht.
3. `js/freqmatch.js`: Der gesamte `fmSEDlg`-Block (ehemals Zeilen
   1232–1270) ist gelöscht. `grep -n "fmSEDlg\|sliderEstimateDlg" js/freqmatch.js js/freqmatch-adaptive.js`
   liefert **keine** Treffer mehr.
4. `js/freqmatch.js`: `_fmShouldOfferSliderEstimate` existiert weiterhin
   und wird **nur** noch von der `prerequisites[0].checkFn` aufgerufen.
5. `js/version.js` zeigt `"3.2.222-beta"`.
6. Keine weiteren Dateien als `js/freqmatch.js`,
   `js/freqmatch-adaptive.js` und `js/version.js` wurden verändert.

Bei „unklar": nachfragen, **nicht** still annehmen.

---

## Zwischenprüfung nach BA 219–222

Wenn BA 219–222 alle abgenommen sind, sollte gelten:

- Erklär-Absätze werden statisch aus `cfg.explain.paragraphs` gerendert.
  Beide Gruppen (beidseitiges CI / CI + akustisch) erscheinen immer.
- HG-Warnung und Cochlear-FAT-Hinweis sind reguläre Warn-Absätze; ihre
  Sichtbarkeit wird über `testUI.explain.setVisible` umgeschaltet.
- PairIndicator-Labels, Slider-Wert-Anzeige und Range-Marker in
  freqmatch-slider laufen ausschließlich über die `testUI.*`-API; in
  der Konsole liefert `grep` keine direkten `.textContent`-/`.style`-
  Manipulationen mehr auf diese DOM-Knoten.
- Range-Marker erscheint sichtbar auch bei großen Median-Werten
  (Bugfix BA 221).
- Vortest-Empfehlung für Adaptive läuft über `cfg.prerequisites`; das
  eigene `fmSEDlg`-Modal existiert nicht mehr.

Damit ist freqmatch ein sauberer Anwender der TestUI-API. Wenn etwas
in den Folge-Migrationen (lr-balance, test.js) gebraucht wird, das in
TestUI noch fehlt, fällt das jetzt auf — und nicht erst, wenn drei
Verfahren parallel umgestellt werden müssen.
