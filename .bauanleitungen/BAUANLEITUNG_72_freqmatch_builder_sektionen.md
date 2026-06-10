# Bauanleitung 72 — Frequenzabgleich: Builder-Sektionen für den adaptiven Modus

## Ziel

Erste Anleitung der 02b-Reihe (adaptiver Frequenzabgleich nach
`docs/spec/02b-freqmatch-adaptiv.md`). Diese Anleitung erweitert
`buildTestPanel` in `js/test-ui.js` um **zwei neue optionale
Sektionen**, die in den Folgeanleitungen vom adaptiven Modus
benutzt werden:

1. **`heightJudgment`** — zwei große Antwort-Buttons „↑ höher /
   ↓ tiefer" für die 2I-2AFC-Aufgabe.
2. **`statusGrid`** — Container für die per-Elektroden-Status-
   anzeige (Zeile pro Elektrode mit Status, Match, Residuum,
   Trial-Zahl, Catch-Statistik). Befüllung zur Laufzeit, kommt
   inhaltlich in Bauanleitung 02b/4.

**In dieser Anleitung wird visuell noch nichts neu sichtbar.**
Beide Sektionen werden mit `hidden`-Attribut gebaut und erst in
der folgenden Bauanleitung (02b/2) vom Mode-Switch eingeblendet.
Der bestehende Slider-Modus bleibt vollständig funktionsfähig.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.72-beta";
```

---

## 2. `buildTestPanel` erweitern (`js/test-ui.js`)

In `buildTestPanel(parentEl, cfg)`, Block 3 (Aktiver Test).

### 2a) `statusGrid` einfügen — direkt VOR dem `pairIndicator`

Die Status-Übersicht soll oben im Test-Block sitzen, damit der
User während der Trials sehen kann, welche Elektroden noch laufen
und welche bereits abgeschlossen sind.

**Vorher** (Z. 322–330 in `js/test-ui.js`):

```js
  // Paar-Anzeige
  var pairIndicator = _mkEl('div', 'pair-indicator');
  var pairLeft = _mkEl('span', 'tone-label-left');
  var vsSpan = _mkEl('span', 'vs'); vsSpan.textContent = 'vs.';
  var pairRight = _mkEl('span', 'tone-label-right');
  pairIndicator.append(pairLeft, vsSpan, pairRight);
  var pairFreq = _mkEl('div', 'pair-freq');
  testBox.append(pairIndicator, pairFreq);
```

**Nachher** — `statusGrid`-Block UNMITTELBAR davor einfügen:

```js
  // Status-Grid (Bauanleitung 02b/1, für adaptiven Frequenzabgleich)
  // Befüllung zur Laufzeit durch freqmatch.js (Bauanleitung 02b/4)
  var statusGrid = null;
  if (cfg.test.statusGrid && cfg.test.statusGrid.show) {
    statusGrid = _mkEl('div', 'fm-status-grid');
    statusGrid.hidden = true;
    testBox.appendChild(statusGrid);
  }

  // Paar-Anzeige
  var pairIndicator = _mkEl('div', 'pair-indicator');
  var pairLeft = _mkEl('span', 'tone-label-left');
  var vsSpan = _mkEl('span', 'vs'); vsSpan.textContent = 'vs.';
  var pairRight = _mkEl('span', 'tone-label-right');
  pairIndicator.append(pairLeft, vsSpan, pairRight);
  var pairFreq = _mkEl('div', 'pair-freq');
  testBox.append(pairIndicator, pairFreq);
```

### 2b) `heightJudgment` einfügen — NACH `actionRow`, VOR `jdgContainer`

Die Antwort-Buttons sollen dort sitzen, wo bei test.js der
3-Knopf-Judgment-Block (`jdgContainer`) sitzt. Beide schließen
sich gegenseitig aus: ein Test setzt entweder das eine oder das
andere in seinem cfg.

**Vorher** (Z. 346–381):

```js
  // Aktions-Buttons
  var actionRow = _mkEl('div', 'action-row');
  ...
  testBox.appendChild(actionRow);

  // Judgment-Buttons (nur wenn modeOptions judgment enthält)
  var jdgContainer = null, jdgA = null, jdgEq = null, jdgB = null;
  if (cfg.presets.rowMode && cfg.presets.rowMode.show &&
      (cfg.presets.rowMode.modeOptions || []).some(function(p) { return p[0] === 'judgment'; })) {
    ...
  }
```

**Nachher** — `heightJudgment`-Block ZWISCHEN den beiden Blöcken einfügen:

```js
  // Aktions-Buttons
  var actionRow = _mkEl('div', 'action-row');
  ...
  testBox.appendChild(actionRow);

  // Height-Judgment-Buttons (Bauanleitung 02b/1, für adaptiven Frequenzabgleich)
  var hjContainer = null, hjHigher = null, hjLower = null;
  if (cfg.test.heightJudgment && cfg.test.heightJudgment.show) {
    hjContainer = _mkEl('div', 'hj-buttons');
    hjContainer.hidden = true;
    hjHigher = _mkEl('button', 'btn btn-large hj-up');
    hjHigher.dataset.action = 'hj-up';
    hjHigher.innerHTML =
      '&uarr; <span data-t="bHigher"></span> ' +
      '<span class="kbd">&uarr;</span>';
    hjLower = _mkEl('button', 'btn btn-large hj-down');
    hjLower.dataset.action = 'hj-down';
    hjLower.innerHTML =
      '&darr; <span data-t="bLower"></span> ' +
      '<span class="kbd">&darr;</span>';
    hjContainer.append(hjHigher, hjLower);
    testBox.appendChild(hjContainer);
  }

  // Judgment-Buttons (nur wenn modeOptions judgment enthält)
  var jdgContainer = null, jdgA = null, jdgEq = null, jdgB = null;
  if (cfg.presets.rowMode && cfg.presets.rowMode.show &&
      (cfg.presets.rowMode.modeOptions || []).some(function(p) { return p[0] === 'judgment'; })) {
    ...
  }
```

### 2c) Result-Objekt erweitern

Am Ende von `buildTestPanel` im `return { … }` (Z. 553 ff.)
ergänzen — bestehende Felder bleiben, neue dazu:

```js
  return {
    id: id,
    explainBox: explainBox, presetsBox: presetsBox, testBox: testBox, exclOverlay: exclOverlay,
    // presets
    modeSelect: modeSelect, runSelect: runSelect, refSelect: refSelect,
    ...
    // confidence
    confirmBtn: confirmBtn, confRadios: confRadios,
    // Adaptiver Frequenzabgleich (Bauanleitung 02b/1)
    hjContainer: hjContainer, hjHigher: hjHigher, hjLower: hjLower,
    statusGrid: statusGrid,
    // excl modal
    exclConfirmBtn: exclConfirmBtn, exclCancelBtn: exclCancelBtn,
  };
```

---

## 3. `freqmatch.js` cfg ergänzen

In `js/freqmatch.js`, im `fmCfg.test`-Block (Z. 511–526), zwei
neue Felder anhängen:

**Vorher**:

```js
test: {
  subTitleKey:       'fmRunningTitle',
  ...
  confirmButton:     { show: true, key: 'btnConfirmOffset' },
  confidence:        { show: true }
}
```

**Nachher**:

```js
test: {
  subTitleKey:       'fmRunningTitle',
  ...
  confirmButton:     { show: true, key: 'btnConfirmOffset' },
  confidence:        { show: true },
  heightJudgment:    { show: true },   // Bauanleitung 02b/1
  statusGrid:        { show: true }    // Bauanleitung 02b/1
}
```

`js/test.js` und `js/lr-balance.js` werden **nicht angefaßt** —
die fehlenden Felder dort führen dazu, daß die zwei Sektionen
nicht gebaut werden. Abwärtskompatibel.

---

## 4. CSS-Klassen anlegen

CSS-Datei finden: Sonnet sucht zuerst die Datei, in der die
bestehenden Test-Box-Klassen liegen:

```
grep -rn "\.pair-indicator\b" css/
```

In derselben Datei am Ende der Test-Box-Sektion folgenden Block
ergänzen:

```css
/* Adaptiver Frequenzabgleich — Antwort-Buttons (Bauanleitung 02b/1) */
.hj-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin: 16px 0;
}
.hj-up, .hj-down {
  min-width: 140px;
  font-size: 1.2em;
}

/* Adaptiver Frequenzabgleich — Status-Übersicht (Bauanleitung 02b/1) */
.fm-status-grid {
  margin: 12px 0;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.9em;
}
```

Feineres Status-Grid-Styling (Spalten-Layout, Status-Icons,
Farb-Akzente) kommt in Bauanleitung 02b/4. Diese Anleitung legt
nur den Container an.

---

## 5. i18n — KEINE Strings in dieser Anleitung

Die Buttons haben `data-t="bHigher"` und `data-t="bLower"`.
Diese Keys werden in dieser Anleitung **nicht** in
`i18n/de.js` angelegt — sie kommen gebündelt mit allen anderen
deutschen Strings des adaptiven Modus in Bauanleitung 02b/8.

**Konsequenz**: die Buttons sind nach diesem Build vorerst leer
beschriftet (nur die Pfeil-Symbole `↑` / `↓` und der
Tastatur-Hinweis sind sichtbar). Das ist beabsichtigt — die
Sektionen sind sowieso noch `hidden`, bis Bauanleitung 02b/2
sie an den Mode-Switch bindet.

`en.js`, `fr.js`, `es.js` bleiben unverändert.

---

## 6. `docs/CODESTRUKTUR.md` aktualisieren

In der Tabelle „Zentrale Funktionen pro Modul" in der Zeile für
**test-ui.js** (Modul 7) ergänzen, daß `buildTestPanel` jetzt
zusätzlich versteht:

- `cfg.test.heightJudgment` (Antwort-Buttons höher/tiefer)
- `cfg.test.statusGrid` (Per-Elektroden-Statusanzeige)

und im Result-Objekt zusätzlich liefert:
`hjContainer`, `hjHigher`, `hjLower`, `statusGrid`.

`docs/SPEC.md` und `docs/spec/02-messung.md` werden in dieser
Bauanleitung **nicht** angefaßt — das Spec-Kapitel
`02b-freqmatch-adaptiv.md` existiert bereits und wird in 02b/2
verlinkt, wenn der Mode-Switch sichtbar wird.

---

## Akzeptanztest

In dieser Anleitung wird visuell nichts Neues sichtbar — der Test
ist daher Konsolen-basiert.

1. Browser hart neu laden (Strg-F5). Footer / Versionsanzeige
   zeigt `3.0.72-beta`.
2. Tab **Messungen** → Sub-Tab **Frequenzabgleich** öffnen.
3. Browser-Konsole (F12) öffnen, eingeben:
   ```js
   document.querySelector('#subpanel-messungen-freqmatch .hj-buttons')
   ```
   Erwartet: `<div class="hj-buttons" hidden>…</div>` mit zwei
   Buttons darin (höher / tiefer). Im UI noch unsichtbar.
4. Eingeben:
   ```js
   document.querySelector('#subpanel-messungen-freqmatch .fm-status-grid')
   ```
   Erwartet: `<div class="fm-status-grid" hidden></div>`, leer.
5. **Test starten** klicken — der bisherige Slider-Test läuft
   unverändert: Slider bewegen → cent-Wert ändert sich →
   Übernehmen → cent-Wert wird gespeichert → nächste Elektrode.
6. Tab **Messungen** → Sub-Tab **Loudness** öffnen. Konsole:
   ```js
   document.querySelector('#subpanel-messungen-test .hj-buttons')
   document.querySelector('#subpanel-messungen-test .fm-status-grid')
   ```
   Erwartet: beide `null`. (Die Felder fehlen im `test.js`-cfg,
   daher werden sie nicht gebaut.)
7. Sub-Tab **Stereo-Balance** öffnen — analoger Check, beide
   `null`.
8. Konsole frei von Fehlern.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden Punkt der Akzeptanztest-Checkliste
einzeln durchgehen und melden:

- erfüllt — mit Datei- und Zeilenangabe der relevanten Stelle, oder
- nicht erfüllt — mit Grund, oder
- unklar — dann **rückfragen, nicht still annehmen**.

Insbesondere prüfen:

- Steht `statusGrid` tatsächlich VOR `pairIndicator` im DOM-Append-Reihenfolge?
- Steht `hjContainer` tatsächlich ZWISCHEN `actionRow` und `jdgContainer`?
- Sind beide neuen Sektionen mit `hidden = true` versehen?
- Wurden `hjContainer`, `hjHigher`, `hjLower`, `statusGrid` ins Result-Objekt aufgenommen?
- Sind `freqmatch.js` die neuen cfg-Felder gesetzt — und sind `test.js`/`lr-balance.js` unangetastet geblieben?

---

## Was diese Anleitung NICHT macht

- Kein Mode-Switch zwischen Slider und Adaptiv (kommt in 02b/2)
- Keine Tastatur-Bindung der höher/tiefer-Buttons (kommt in 02b/2)
- Keine Staircase-Logik / Trial-Pull (kommt in der Folge-Anleitung)
- Kein Befüllen des Status-Grids (kommt in 02b/4)
- Keine Pause/Resume-Persistenz (kommt in 02b/5)
- Keine Catch-Trials (kommt in 02b/6)
- Keine Ergebnis-Chart-Anpassung (kommt in 02b/7)
- Keine i18n-Strings in `de.js` (kommt in 02b/8)
