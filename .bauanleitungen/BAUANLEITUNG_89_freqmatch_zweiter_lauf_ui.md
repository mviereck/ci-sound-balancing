# BA 89 — Zweiter Staircase-Lauf: UI, i18n, Version (freqmatch.js + i18n/de.js + version.js)

## Voraussetzung

BA 88 muss abgeschlossen sein. Diese BA baut auf den neuen Variablen `fmCurrentLauf` und
`fmLauf1Result` aus BA 88 auf, ohne diese noch einmal zu erklären.

## Ziel

Vier UI-Ergänzungen in `freqmatch.js`:
1. **Zweiter Fortschrittsbalken** für Lauf 2 (beschriftet „Lauf 1" / „Lauf 2").
2. **Hinweistext** nach Lauf-1-Abschluss (erklärt Zweck und Dauer von Lauf 2).
3. **`fmUpdateAdaptiveProgress`** aktualisiert beide Balken.
4. **Neue Funktion `_fmShowLauf2Hint`** — zeigt/versteckt den Hinweistext.

Plus DE-Strings in `i18n/de.js` und Version-Bump in `version.js`.

## Betroffene Dateien

- `js/freqmatch.js`
- `js/i18n/de.js`
- `js/version.js`

---

## Schritt 1 — i18n/de.js: neue Keys

In `js/i18n/de.js` folgende Keys ergänzen (alphabetisch einsortieren oder am Ende des
Objekts vor der schließenden Klammer):

```js
  fmLblLauf1:      'Lauf 1',
  fmLblLauf2:      'Lauf 2',
  fmLblRun2Start:  'Zweiten Lauf starten',
  fmLblResumeL2:   'Zweiten Lauf fortsetzen',
  fmLblRun2Hint:   'Erster Messdurchlauf abgeschlossen. Der zweite Durchlauf ist empfohlen ' +
                   'und startet nahe am gemessenen Wert — er dauert typisch halb so lang ' +
                   'wie der erste. Er dient zwei Zwecken: Der Mittelwert beider Läufe ist ' +
                   'eine zuverlässigere Schätzung des Frequenzunterschieds. Und die ' +
                   'Differenz zwischen den Läufen zeigt pro Elektrode, wie reproduzierbar ' +
                   'das Ergebnis ist.',
```

**Hinweis zu Anführungszeichen**: In `de.js`-Strings stets einfache `'...'` als äußere
Begrenzer und `—` (—), `ä` (ä), `ü` (ü), `ä` (ä) für Sonderzeichen in
i18n-Strings, um Parser-Konflikte zu vermeiden. Alternativ: Template-Literal `` ` `` mit
direkten Sonderzeichen — aber konsistent zur bestehenden Datei bleiben.

---

## Schritt 2 — freqmatch.js: neue Funktion `_fmShowLauf2Hint`

Neue Funktion nach `fmRefreshResumeHint` einfügen:

```js
function _fmShowLauf2Hint(visible) {
  const el = document.getElementById('fmLauf2HintEl');
  if (!el) return;
  el.hidden = !visible;
  if (visible && typeof t === 'function') {
    el.textContent = t('fmLblRun2Hint') || el.textContent;
  }
}
```

---

## Schritt 3 — freqmatch.js: `fmFinishAdaptive` — Hint-Aufrufe

In `fmFinishAdaptive` aus BA 88 (beide Pfade) `_fmShowLauf2Hint` aufrufen.

Im **Lauf-1-Pfad** nach `_fmPersist()` ergänzen:
```js
    _fmPersist();
    _fmShowLauf2Hint(true);   // Hinweistext einblenden
```

Im **Lauf-2-Pfad** nach `_fmMarkCompleted()` ergänzen:
```js
    _fmMarkCompleted();
    _fmShowLauf2Hint(false);  // Hinweistext ausblenden
```

---

## Schritt 4 — freqmatch.js: `fmUpdateAdaptiveProgress` — beide Balken

Die Funktion `fmUpdateAdaptiveProgress` (Zeile ≈ 821) komplett ersetzen:

```js
function fmUpdateAdaptiveProgress() {
  if (!fmEls) return;
  const ids = Object.keys(fmTracks);

  // Lauf-1-Balken (immer vorhanden: fmEls.progressFill / progressText)
  if (fmCurrentLauf === 2 && fmLauf1Result) {
    // Lauf 1 abgeschlossen → Balken voll zeigen
    if (fmEls.progressFill)  fmEls.progressFill.style.width  = '100%';
    if (fmEls.progressText)  fmEls.progressText.textContent  =
      (typeof t === 'function' && t('fmLblLauf1') || 'Lauf 1') +
      ': ' + Object.keys(fmLauf1Result).length + ' / ' + Object.keys(fmLauf1Result).length;
  } else if (ids.length > 0) {
    const stats = fmComputeProgressStats(fmTracks);
    if (fmEls.progressFill)  fmEls.progressFill.style.width  = stats.percent + '%';
    if (fmEls.progressText)  fmEls.progressText.textContent  =
      (typeof t === 'function' && t('fmLblLauf1') || 'Lauf 1') +
      ': ' + stats.done + ' / ' + stats.total +
      ' · ' + Math.round(stats.percent) + ' %';
  } else {
    if (fmEls.progressFill)  fmEls.progressFill.style.width  = '0%';
    if (fmEls.progressText)  fmEls.progressText.textContent  =
      (typeof t === 'function' && t('fmLblLauf1') || 'Lauf 1') + ': 0 / 0';
  }

  // Lauf-2-Balken (nur wenn vorhanden — aus DOMContentLoaded eingefügt)
  if (!fmEls.progressFill2 || !fmEls.progressText2) return;
  if (fmCurrentLauf === 2 && ids.length > 0) {
    const stats2 = fmComputeProgressStats(fmTracks);
    fmEls.progressFill2.style.width = stats2.percent + '%';
    fmEls.progressText2.textContent =
      (typeof t === 'function' && t('fmLblLauf2') || 'Lauf 2') +
      ': ' + stats2.done + ' / ' + stats2.total +
      ' · ' + Math.round(stats2.percent) + ' %';
  } else {
    fmEls.progressFill2.style.width = '0%';
    fmEls.progressText2.textContent =
      (typeof t === 'function' && t('fmLblLauf2') || 'Lauf 2') + ': —';
  }
}
```

---

## Schritt 5 — freqmatch.js: DOMContentLoaded — Hint-Div und zweiter Balken

Im DOMContentLoaded-Handler, **nach** der Zeile `fmEls = buildTestPanel(parentEl, fmCfg);`
und **vor** dem ersten `if (fmEls.modeSelect)`:

```js
  // Hinweistext für Lauf-2-Empfehlung (nach Lauf-1-Abschluss)
  const _lauf2Hint = _mkEl('p', 'explain explain-info');
  _lauf2Hint.id = 'fmLauf2HintEl';
  _lauf2Hint.hidden = true;
  if (typeof t === 'function') _lauf2Hint.textContent = t('fmLblRun2Hint') || '';
  // Einfügen nach explainBox (vor testBox)
  fmEls.explainBox.insertAdjacentElement('afterend', _lauf2Hint);

  // Zweiter Fortschrittsbalken für Lauf 2
  //   fmEls.progressFill liegt in einem <div class="progress-bar">
  //   → zweiter Balken direkt danach einfügen
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

**Hinweis**: `_mkEl` ist die private Hilfsfunktion aus freqmatch.js (am Dateiende definiert).

---

## Schritt 6 — freqmatch.js: Hint bei `fmAbort` verstecken

In `fmAbort` (oder `fmFinishAdaptive`) sicherstellen, dass der Hinweis beim manuellen Abbruch
nicht sichtbar bleibt. In der `fmAbort`-Funktion nach dem `fmAdaptiveActive = false;`-Block:

```js
  _fmShowLauf2Hint(false);
```

Die genaue Stelle: im `if (fmAdaptiveActive)` Block in `fmAbort`, nach `_fmPersist()`.
Mit `grep -n "fmAbort\|fmAdaptiveActive = false" js/freqmatch.js` finden.

---

## Schritt 7 — version.js: Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.89-beta";
```

---

## Akzeptanztest-Checkliste

**Setup**: BA 88 abgeschlossen, adaptiver Modus, Debug-Simulation verfügbar.

**Test A — Fortschrittsbalken Lauf 1**

1. „Test starten" klicken.
2. Unter dem Fortschrittsbalken: Label „Lauf 1" sichtbar (klein, grau).
3. Darunter: „Lauf 2" Label + zweiter Balken (leer, 0%).
4. Während Test läuft: erster Balken füllt sich, zweiter bleibt leer.

**Test B — Lauf-1-Abschluss-Hinweis**

5. `fmRunDebugSim()` — Simulation bis Lauf-1-Ende.
6. Hinweistext erscheint unterhalb der Erklärung (erklärt zweiten Lauf).
7. Erster Balken zeigt 100%.
8. Start-Button zeigt „Zweiten Lauf starten".

**Test C — Lauf 2 startet, Hinweis verschwindet**

9. „Zweiten Lauf starten" klicken.
10. Hinweistext verschwindet.
11. Erster Balken bleibt bei 100%, zweiter Balken beginnt sich zu füllen.
12. `fmRunDebugSim()` — Simulation für Lauf 2.
13. Beide Balken bei 100%.
14. Start-Button zeigt „Test starten" (neue Sitzung möglich).

**Test D — Manueller Abbruch löscht Hinweis**

15. Neuen Lauf starten, nach einigen Trials Stop drücken.
16. Hinweistext: nicht sichtbar (war noch nicht Lauf-1-Ende).
17. Lauf 1 vollständig abschließen → Hinweis erscheint.
18. Seite neu laden → Hinweis: nicht sichtbar (wird beim nächsten Start wieder gesetzt).

---

## Selbstprüfungsauftrag an Sonnet

| # | Kriterium | Fundstelle | Erfüllt? |
|---|-----------|------------|---------|
| 1 | `fmLblLauf1`, `fmLblLauf2`, `fmLblRun2Start`, `fmLblResumeL2`, `fmLblRun2Hint` in `de.js` | i18n/de.js | ? |
| 2 | `_fmShowLauf2Hint(visible)` existiert, zeigt/versteckt `#fmLauf2HintEl` | freqmatch.js | ? |
| 3 | `fmFinishAdaptive` Lauf-1-Pfad ruft `_fmShowLauf2Hint(true)` | freqmatch.js | ? |
| 4 | `fmFinishAdaptive` Lauf-2-Pfad ruft `_fmShowLauf2Hint(false)` | freqmatch.js | ? |
| 5 | `fmAbort` ruft `_fmShowLauf2Hint(false)` | freqmatch.js | ? |
| 6 | `fmUpdateAdaptiveProgress` befüllt Lauf-1-Balken vollständig wenn `fmCurrentLauf===2` | freqmatch.js | ? |
| 7 | `fmEls.progressFill2` und `fmEls.progressText2` im DOMContentLoaded erzeugt | freqmatch.js | ? |
| 8 | Hint-Div `#fmLauf2HintEl` im DOM eingefügt (nach `fmEls.explainBox`) | freqmatch.js | ? |
| 9 | `APP_VERSION = "3.0.89-beta"` | version.js | ? |

**Hinweis auf Mini-Anleitung**: en/fr/es-Übersetzungen für `fmLblLauf1`, `fmLblLauf2`,
`fmLblRun2Start`, `fmLblResumeL2`, `fmLblRun2Hint` kommen in einer separaten Mini-Anleitung,
wenn die DE-GUI-Vorlage durch ist.
