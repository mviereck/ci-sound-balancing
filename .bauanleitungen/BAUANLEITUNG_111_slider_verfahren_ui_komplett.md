# Bauanleitung 111 — Slider-Verfahren: testUI-Ausbau, Reihenfolge-Neufestlegung

**Kontext:** Nach BA 110 ist das Frequenzabgleich-Layout für den adaptiven
Modus aufgeräumt. Der Slider-Modus (Vor-Schätzung) sitzt nominell auf
der neuen testUI-API, ist strukturell aber unvollständig (kein Fortschritt,
keine Übersicht, kein Erklärungsblock, kein Debug). Diese Anleitung baut
ihn vollständig auf das gleiche Bauteil-Schema wie das adaptive Verfahren
und korrigiert die feste Reihenfolge im Verfahren-Body so, dass sie für
beide Verfahren passt.

**Zielversion:** `APP_VERSION = "3.0.111-beta"`

---

## Pflichtlektüre

1. `CLAUDE.md` — ARBEITSWEISE, VERSIONIERUNG, NOTAUSGANG-PRINZIP.
2. `docs/BAUANLEITUNGEN_LEITLINIEN.md` — Akzeptanztest, Selbstprüfung,
   Anführungszeichen-Regel.
3. `docs/spec/00-testui-architektur.md` — feste Body-Reihenfolge,
   Bausteine-Katalog, Pfeiltasten-Tabelle (alle drei werden angepasst).
4. `js/test-ui.js` — neue API `_buildTestPanelNew`, Baustein-Render-
   Reihenfolge, `slider`-Baustein-Render (Z. 1090–1138). Alten Code
   nicht anfassen.
5. `js/freqmatch.js` — gezielt:
   - `fmCfg` (Slider-Verfahren-Body)
   - `fmStartSlider` (~Z. 1418), `fmLoadElectrode` (~Z. 1434),
     `fmConfirm` (~Z. 1451), `fmUndo` (~Z. 1498), `fmReplayCurrent`
     (~Z. 1205), `fmShowElectrode` (~Z. 284)
   - `fmUpdateAdaptiveProgress` (~Z. 1349) als Vorbild für einen neuen
     `fmUpdateSliderProgress`
   - `fmRunDebugSim` (~Z. 1515) als Vorbild für einen Slider-Debug
6. `js/touch-ctrl.js` — `buildSliderTouchCtrl` wird bereits in Z. 1813
   von freqmatch aufgerufen; an dieser Stelle nichts ändern.

---

## Scope dieser Anleitung

### Teil A — Reihenfolge im Verfahren-Body neu festlegen

In `_buildTestPanelNew` (`js/test-ui.js`) wird die in BA 110 festgelegte
Render-Reihenfolge ersetzt durch:

```
1.  runningTitle        — automatisch, kein cfg-Baustein
2.  progress            — Balken
3.  progressText        — Text + Timer
4.  pairIndicator
5.  instruction
6.  decisionButtons
7.  keyHint
8.  slider              — Block inkl. slider-wrap, extendBtn, lsHint
9.  sliderValue
10. cumulativeDisplay
11. confirmButton
12. excludeButtons
13. applyButton
14. extraFragment
15. actions             — verschoben (war Position 7 in BA 110)
16. statusGrid          — war Position 16 in BA 110, jetzt vor background
17. background          — Akkordeon
18. debugRun
```

Wesentliche Änderungen gegenüber BA 110:

- **`actions`** (Zurück/Nochmal/Gleichzeitig) wandern von Position 7 ans
  Ende des Antwort-Bereichs (Position 15) — vor `statusGrid`. So stehen
  sie unter den letzten Antwort-Elementen, nicht zwischen Tonbox und
  Slider.
- **`keyHint`** wandert von Position 8 nach Position 7 — vor `slider`,
  damit der Pfeiltasten-Hinweis direkt vor dem Slider steht.

Spec-Datei `docs/spec/00-testui-architektur.md`: die Reihenfolge-Liste
entsprechend aktualisieren. Pfeiltasten-Tabelle bleibt wie BA 110
(Backspace = Undo, B = Simul, kein Z).

### Teil B — Slider-Body um vier Bausteine erweitern

In `fmCfg` (`js/freqmatch.js`), Slider-Verfahren-Body, vier Einträge ergänzen:

```js
{
  id: 'slider',
  labelKey: 'fmModeSlider',
  explainKey: 'fmExplainSlider',
  body: {
    pairIndicator: { variant: 'token', leftKey: 'fmTone1', rightKey: 'fmTone2' },
    progress:      { format: 'simple' },
    instruction:   { key: 'fmSliderInstruction' },        // NEU
    keyHint:       { unitKey: 'sliderHintCent' },
    slider:        { unit: 'cent', ranges: [100, 500, 1200] },
    sliderValue:   { show: true },
    confirmButton: { key: 'btnConfirmOffset' },
    actions:       ['undo', 'replay', 'simul'],
    statusGrid:    { show: true },                         // NEU
    background: {                                          // NEU
      titleKey:  'fmExplainSliderScienceTitle',
      bodyKey:   'fmExplainSliderScience',
      bodyAsHtml: true
    },
    debugRun:      { key: 'btnDebugRun' }                  // NEU
  },
  hooks: {
    onStart:    fmStartSlider,
    onStop:     fmAbort,
    onSlide:    fmSliderChange,
    onConfirm:  fmConfirm,
    onReplay:   fmReplayCurrent,
    onUndo:     fmUndo,
    onSimul:    fmPlaySimultaneous,
    onDebugRun: fmRunSliderDebugSim                        // NEU
  }
}
```

(Hooks-Namen verifizieren — falls sie heute leicht abweichen, in der
Selbstprüfung markieren statt zu raten.)

### Teil C — Fortschritts-Updater für Slider

Neue Funktion `fmUpdateSliderProgress` in `freqmatch.js`, Vorbild ist
`fmUpdateAdaptiveProgress` (Z. 1349 ff. nach BA 110).

```js
function fmUpdateSliderProgress() {
  if (!fmEls) return;
  const _sprog = fmEls.verfahren && fmEls.verfahren.slider && fmEls.verfahren.slider.progress;
  if (!_sprog) return;

  const total = fmSeq ? fmSeq.length : 0;
  const cur   = fmSeqIdx + 1;   // 1-basiert für die Anzeige
  const frac  = total > 0 ? Math.min(cur / total, 1) : 0;

  testUI.progress.set(_sprog, {
    fraction: frac,
    text:     'Elektrode ' + cur + ' von ' + total
  });
}
```

Aufrufen in:
- `fmLoadElectrode` (am Ende, nach `fmShowElectrode`)
- `fmConfirm` (nach `fmSeqIdx++`, vor `fmLoadElectrode`)
- `fmUndo` (Slider-Pfad, nach `fmSeqIdx--`)
- `fmStartSlider` (am Ende)

Timer-Tick: analog zum adaptiven Verfahren. Falls heute keine Timer-Logik
für den Slider existiert (vermutlich), die `_fmStartTimer`/`_fmStopTimer`-
Funktionen aus BA 109 wiederverwenden — `_fmTickTimer` muss aber generisch
sein und je nach laufendem Modus den richtigen `progress`-Ref ansteuern.
Falls die heutige `_fmTickTimer`-Implementation hartkodiert auf
`fmEls.verfahren.adaptive.progress` zeigt, sie umbauen auf eine generische
Variante, die `_fmActiveProgress()` (Helfer) liefert:

```js
function _fmActiveProgress() {
  if (!fmEls || !fmEls.verfahren) return null;
  if (fmAdaptiveActive && fmEls.verfahren.adaptive)
    return fmEls.verfahren.adaptive.progress;
  if (fmRunning && fmEls.verfahren.slider)
    return fmEls.verfahren.slider.progress;
  return null;
}
```

(Variablen-Namen für „läuft adaptiv" und „läuft slider" an den
Bestandscode anpassen — falls unklar, Rückfrage statt raten.)

`_fmStartTimer()` in `fmStartSlider` aufrufen, `_fmStopTimer()` in
`fmAbort` und am Ende von `fmConfirm` wenn der letzte Trial bestätigt
wurde (also in `fmFinish` o.ä.). Resume-Verhalten: ab Neustart zählt
Timer wieder ab 0:00 — wie im adaptiven Verfahren.

### Teil D — Status-Tabelle für Slider

Neue Funktion `fmRenderSliderStatusGrid` in `freqmatch.js`, Vorbild ist
`fmRenderStatusGrid` aus dem adaptiven Pfad.

**Inhalt der Tabelle:** Pro aktiver Elektrode (var-Seite) eine Zeile, mit
drei Spalten:
1. Elektroden-Nummer und Frequenz (z.B. „E5 · 1500 Hz")
2. Bisherige Schätzung in cent (z.B. „+23 cent" oder „–", wenn noch keine)
3. Status („aktuell" für die laufende Elektrode, „erledigt" wenn
   bestätigt, sonst leer)

Aufgrund Zeit-Knappheit der Anleitung halten wir Spalten bewusst schlank.
Falls eine bessere UX-Idee aufkommt, kurz melden statt zu bauen.

**Aufrufen in:**
- `fmStartSlider` (initial)
- `fmConfirm` (nach Eintrag in `sliderEstimates`, vor `fmLoadElectrode`)
- `fmUndo` (nach Entfernen aus `sliderEstimates`)
- `fmLoadElectrode` (markiert die neue aktuelle Elektrode)

Datenquelle:
- `sideData[fmVarSide].freqmatchAdaptive.sliderEstimates` für die Cent-Werte
- `fmSeq` für die Reihenfolge der Elektroden
- `fmCurrentEl` für die laufende Elektrode

### Teil E — Akkordeon-Texte für Slider

Neue i18n-Keys in `i18n/de.js`:

```js
fmSliderInstruction: "Passen Sie den Slider an, bis sich beide Töne gleich hoch anhören.",

fmExplainSliderScienceTitle: "Wissenschaftliche Grundlage und Grenzen der Vor-Schätzung",
fmExplainSliderScience: "Die Vor-Schätzung bittet Sie, die Frequenz auf einer Seite manuell so zu verschieben, dass die Töne auf beiden Seiten gleich hoch klingen. Das ist eine subjektive, schnelle Methode — ihre Genauigkeit hängt davon ab, wie sicher Sie sich beim Schieben des Slider sind. <br><br>Die Werte ersetzen kein adaptives Verfahren, sondern dienen als <strong>Startpunkt</strong>: das adaptive Verfahren bekommt mit einer guten Vor-Schätzung deutlich kürzere Testzeiten, weil es nicht von 0 cent loslaufen muss."
```

**Anführungszeichen-Hinweis** (Lessons-Learned BA 84): innerhalb der
deutschen Strings keine ASCII-`"` ohne Escape. Bei zweifelhaften Stellen
typographisch („…") oder `\"`.

### Teil F — Slider-Debug-Simulation

Neue Funktion `fmRunSliderDebugSim` in `freqmatch.js`, parallel zu
`fmRunDebugSim`. Sie soll den Slider-Lauf vollständig automatisch
durchlaufen lassen, damit Entwickler ohne Klick-Marathon den Endzustand
sehen können.

**Verhalten:** Für jede Elektrode aus `fmSeq` einen zufälligen Cent-Wert
zwischen –50 und +50 in `sliderEstimates` eintragen (analog zu
`fmConfirm`), und anschließend den Lauf beenden. Keine Audio-Wiedergabe
erforderlich — es ist eine reine Daten-Simulation.

```js
function fmRunSliderDebugSim() {
  if (!fmRunning) {
    // Falls Test noch nicht läuft: erst starten, damit fmSeq/fmCurrentEl gesetzt sind
    fmStartSlider();
    setTimeout(fmRunSliderDebugSim, 100);
    return;
  }
  const store = _fmEnsureSliderStore(fmVarSide);
  if (!store) return;
  fmSeq.forEach(function(el) {
    store[String(el)] = {
      cent:    Math.round((Math.random() * 100) - 50),
      varSide: fmVarSide,
      refSide: fmRefSide,
      varFreq: fmVarHz(el),
      timestamp: Date.now()
    };
  });
  // Lauf abschließen
  fmSeqIdx = fmSeq.length;
  fmLoadElectrode();   // → ruft fmFinish() auf, weil fmSeqIdx >= fmSeq.length
  if (typeof renderFreqMatchResults === 'function') {
    try { renderFreqMatchResults(); } catch (e) {}
  }
}
```

(Hilfsfunktion-Namen wie `_fmEnsureSliderStore`, `fmVarHz` an Bestand
anpassen. Falls die Bauerei der Daten-Simulation zwischen den existierenden
Persistenz-Pfaden Schwierigkeiten macht, kürzere Variante: nur den
Lauf hart abbrechen und das Status-Grid einmal füllen — Rückfrage stellen.)

### Teil G — `lsHint` im Cent-Slider deaktivieren

Das LS-Hint-Dreieck wird für dB-Lautstärke-Tests gebraucht (Levels-Test,
alte API). Im cent-Frequenzabgleich hat es keinen Sinn und kann verwirren.

In `_buildTestPanelNew`, `slider`-Baustein-Render (Z. 1112–1118):

```js
// LS-Hint nur bei dB-Slider rendern
if (slUnit === 'dB') {
  var lsHint = _mkEl('div', 'ls-hint');
  lsHint.style.display = 'none';
  // … wie bisher
}
```

Refs entsprechend bedingt setzen: `refs.slider.lsHint` etc. nur, wenn
`unit === 'dB'`.

**Vorsicht:** Die alte API (`_buildTestPanelOld`) lebt davon, dass die
LS-Hint-Refs im Result-Objekt existieren. Sie bleibt unverändert — nur
die neue API wird konditional. Das alte Element für test.js / lr-balance.js
ist nicht betroffen.

In der Spec-Datei `docs/spec/00-testui-architektur.md` einen Hinweis in
der `slider`-Baustein-Zeile: „LS-Hint-Element nur bei `unit: 'dB'`".

### Teil I — Touch-Buttons („− / Fein / +") in den slider-Baustein integrieren + Replay-Bug-Fix

**Heutiger Zustand (verifiziert):**

- `js/freqmatch.js` Z. 1813–1823 ruft selbst `buildSliderTouchCtrl(...)` auf
  und übergibt eine `replay`-Funktion (Z. 1820). Dadurch hängt
  `buildSliderTouchCtrl` einen **zweiten Wiederholen-Knopf** in die
  „− / Fein / +"-Zeile (`touch-ctrl.js` Z. 81–88).
- In `fmCfg` Z. 1776 und Z. 1802 zeigt `onReplay` auf `fmReplayCurrent`
  (`js/freqmatch.js` Z. 1205). Diese Funktion macht in Z. 1206
  `if (!fmAdaptiveActive) return;` — beendet sich also im Slider-Modus
  sofort. Folge: der Wiederholen-Knopf im `actions`-Bereich **und** die
  Leertaste tun im Slider-Modus nichts.
- `fmPlayCurrent` (`js/freqmatch.js` Z. 319) dispatcht selbst nach
  Verfahren und ist der korrekte Hook für beide Modi.

**Drei Fixes:**

#### I.1 — `onReplay` in beiden Verfahren auf `fmPlayCurrent` umstellen

In `fmCfg`:

```js
// Slider-Body (Hooks):
onReplay: fmPlayCurrent,    // war: fmReplayCurrent

// Adaptive-Body (Hooks):
onReplay: fmPlayCurrent,    // war: fmReplayCurrent
```

`fmReplayCurrent` bleibt im Code stehen — falls von woanders aufgerufen.
Falls grep ergibt, dass `fmReplayCurrent` jetzt **keine** Aufrufer mehr
hat, ersatzlos löschen.

#### I.2 — Touch-Buttons werden Teil des `slider`-Bausteins der testUI

`slider`-Baustein im cfg-Schema bekommt zwei neue Optionen:

```js
slider: {
  unit: 'cent',
  ranges: [100, 500, 1200],
  touchStep:     5,    // NEU — Standard-Schrittweite der − / + Touch-Buttons
  touchFineStep: 1     // NEU — Schrittweite bei aktiviertem „Fein"-Knopf
}
```

In `_buildTestPanelNew` (`js/test-ui.js`), `slider`-Baustein-Render
(nach dem Bau von `slInput` und vor dem `appendChild` von `slWrap`,
bzw. an einer ähnlich sinnvollen Stelle):

```js
// Touch-Buttons direkt nach dem Slider einhängen (automatisch)
var _tStep     = slCfg.touchStep     != null ? slCfg.touchStep     : 5;
var _tFineStep = slCfg.touchFineStep != null ? slCfg.touchFineStep : 1;
if (typeof buildSliderTouchCtrl === 'function') {
  buildSliderTouchCtrl(slInput, {
    step:     _tStep,
    fineStep: _tFineStep
    // Kein replay! Der Replay-Knopf gehört zu `actions`.
  });
}
```

Im Refs-Objekt ist `buildSliderTouchCtrl` heute keine Eintrag-Quelle —
es hängt die Box direkt ins DOM. Das bleibt so. Refs für die Touch-Buttons
sind nicht nötig (kein Test braucht sie weiter zu manipulieren).

#### I.3 — `buildSliderTouchCtrl`-Aufruf in freqmatch.js entfernen

In `js/freqmatch.js` Z. 1813–1823: den Block

```js
// buildSliderTouchCtrl für Slider-Verfahren
const _slInput = fmEls.verfahren && fmEls.verfahren.slider
  && fmEls.verfahren.slider.slider && fmEls.verfahren.slider.slider.input;
if (_slInput) {
  buildSliderTouchCtrl(_slInput, {
    step: 5,
    fineStep: 1,
    replay: function() { if (typeof fmPlayCurrent === 'function') fmPlayCurrent(); },
    labelReplay: '▶ ' + ((typeof t === 'function' && t('bReplay')) || 'Wiederholen')
  });
}
```

**ersatzlos löschen.** Die Touch-Buttons baut jetzt testUI selbst.

Die Variable `_slInput` wird im Block direkt darunter (Z. 1824–1826)
weiter benutzt — bitte beachten, dass der grep nicht zu viel löscht.
Den `_slExtendBtn`-Block (`_fmExtendRange`-Verdrahtung) **behalten**.

#### I.4 — Im `fmCfg` die neuen Slider-Optionen ergänzen

```js
slider: { unit: 'cent', ranges: [100, 500, 1200], touchStep: 5, touchFineStep: 1 },
```

Im Adaptive-Body gibt es keinen `slider`-Baustein — keine Anpassung dort.

#### I.5 — Spec-Datei `docs/spec/00-testui-architektur.md`

Bausteine-Katalog-Tabelle, `slider`-Zeile, Spalte „Wichtige Optionen":
ergänzen um `touchStep`, `touchFineStep`. In der Tabellen-Spalte
„Zweck" einen Halbsatz, dass die „− / Fein / +"-Buttons jetzt
**automatisch** unter dem Slider erscheinen.

#### I.6 — Alte API bleibt unangetastet

`_buildTestPanelOld` und die Test-Module `test.js`, `lr-balance.js`,
`latency.js` rufen `buildSliderTouchCtrl` heute selbst auf. Das
**bleibt so**. Erst die jeweilige Migration auf die neue API (Schritte
3, 4, 5 des testUI-Migrationsplans) entfernt diese manuellen Aufrufe.

### Teil H — pairIndicator-Token-Variante bestätigt ohne Hz-Zeile

Token-Variante rendert per Spec keine Hz-Zeile. Falls beim heutigen
Slider-Pfad Code in `fmShowElectrode` (Z. 284 in freqmatch.js) versucht,
in eine `pairFreq`-Ref zu schreiben, die im Token-Variant gar nicht
existiert: harmlos, aber unnötig. Prüfen und ggf. zwischendrin clean halten:

```js
const slPair = fmEls.verfahren.slider && fmEls.verfahren.slider.pairIndicator;
testUI.pairIndicator.setLabels(slPair, {
  leftText:  /* Ton 1 oder etwas analoges */,
  rightText: /* Ton 2 oder analog */
});
// kein leftHz/rightHz → keine Hz-Zeile
```

Spec-Datei: keine Änderung nötig — die Beschreibung der Token-Variante
sagt schon „keine Hz-Zeile".

---

## i18n-Keys (Zusammenfassung)

**Neu in `i18n/de.js`:**
- `fmSliderInstruction`
- `fmExplainSliderScienceTitle`
- `fmExplainSliderScience`

`btnDebugRun` existiert bereits aus BA 109.

**Englisch/Französisch/Spanisch nicht anfassen.**

---

## Pflicht-Schritte am Ende

1. **`js/version.js`**: `APP_VERSION` `"3.0.110-beta"` → `"3.0.111-beta"`.
2. **`docs/CODESTRUKTUR.md`** kurze Ergänzungen:
   - test-ui.js: feste Reihenfolge umgestellt (actions an Position 15,
     keyHint an Position 7); `lsHint` im neuen `slider`-Baustein nur
     bei `unit: 'dB'`; `slider`-Baustein baut jetzt die Touch-Buttons
     („− / Fein / +") über `buildSliderTouchCtrl` selbst mit ein
     (Optionen `touchStep`, `touchFineStep`).
   - freqmatch.js: `fmUpdateSliderProgress`, `fmRenderSliderStatusGrid`,
     `fmRunSliderDebugSim` neu. Slider-Body hat instruction + statusGrid
     + background + debugRun. Generischer Helfer `_fmActiveProgress`
     für Timer-Tick. `onReplay` in beiden Verfahren auf `fmPlayCurrent`
     korrigiert; manueller `buildSliderTouchCtrl`-Aufruf entfernt.
3. **`docs/spec/00-testui-architektur.md`**:
   - Body-Reihenfolge-Liste aktualisieren (siehe Teil A).
   - `slider`-Baustein-Zeile: LS-Hint nur bei `unit: 'dB'`.

---

## Akzeptanztest

1. **Reload, Frequenzabgleich öffnen** → Verfahren-Dropdown zeigt
   „Vor-Schätzung (Slider)" zuerst.
2. **Auf Slider-Modus, Test starten** → erwartet (von oben nach unten
   im Test-Bereich):
   - Sub-Titel „Frequenzabgleich-Test 'Vor-Schätzung (Slider)' läuft"
     (oder ähnlich, je nach `labelKey`)
   - Fortschrittsbalken
   - Fortschritts-Text „Elektrode 1 von N · 0:01" (Timer zählt)
   - „Ton 1" / „Ton 2" Boxen, **keine Hz-Zeile** darunter
   - Erklärungstext „Passen Sie den Slider an, bis sich beide Töne
     gleich hoch anhören."
   - Pfeiltasten-Hinweis
   - Slider
   - Wert-Anzeige (z.B. „0 Cent")
   - Touch-Buttons „− / Fein / +" (per touch-ctrl.js wie bisher)
   - „Bestätigen"-Knopf
   - Zurück / Nochmal / Gleichzeitig
   - Tabelle mit allen Elektroden (aktuelle markiert, andere Schätzungen
     soweit vorhanden)
   - Akkordeon „Wissenschaftliche Grundlage und Grenzen der Vor-Schätzung"
   - Debug-Test-Knopf (nur bei aktivem Debug-Panel)
3. **Slider bewegen** → Wert-Anzeige aktualisiert; Pfeiltasten ←/→
   verschieben in Cent-Schritten, Shift = Fein-Schritt.
3a. **In der „− / Fein / +"-Zeile** ist **kein** zweiter Wiederholen-
    Knopf mehr sichtbar (war Bug-Doppel-Replay).
3b. **Klick auf den „Nochmal"-Knopf** in der Zeile Zurück/Nochmal/...
    spielt den aktuellen Trial neu ab. Leertaste tut dasselbe.
4. **Bestätigen** → Tabelle aktualisiert die gerade bestätigte Elektrode
   mit dem Cent-Wert. Nächste Elektrode wird geladen, Fortschrittsbalken
   und -Text rücken um eins weiter. Timer läuft weiter.
5. **Backspace** → letzter Eintrag aus Tabelle verschwindet wieder,
   Slider springt auf vorherigen Wert.
6. **„Gleichzeitig"-Knopf bzw. Taste B** → beide Töne parallel auf
   ihren Seiten (wie im adaptiven Verfahren).
7. **„DEBUG: Testlauf"** (bei aktivem Debug-Panel) → füllt automatisch
   alle Elektroden in der Tabelle mit Zufallswerten, Test wird sofort
   beendet.
8. **Adaptiven Test starten** → die Buttons „Zurück / Nochmal /
   Gleichzeitig" stehen jetzt **vor der Status-Tabelle**, nicht mehr
   direkt unter den höher/tiefer-Knöpfen.
9. **Status-Tabelle** des adaptiven Tests bleibt funktional unverändert.
10. **Andere Sub-Reiter** (Elektrodenlautstärke, Stereo-Balance, Latenz):
    unverändert (alte API).
11. **Konsole:** `typeof fmUpdateSliderProgress` → `"function"`;
    `typeof fmRunSliderDebugSim` → `"function"`.
12. **Anzahl Wiederholen-Knöpfe** im laufenden Slider-Test:
    `document.querySelectorAll('[data-action="replay"], .touch-replay').length`
    sollte `1` ergeben (vorher: 2).

---

## Selbstprüfung (vor der Fertig-Meldung)

Pro Punkt **erfüllt / nicht erfüllt / unklar**, mit Datei- und Zeilenangabe.

1. Body-Reihenfolge in `_buildTestPanelNew` entspricht Liste in Teil A
   (`actions` an Position 15, `keyHint` an Position 7).
2. Spec-Datei `00-testui-architektur.md`: Reihenfolge-Liste und
   `slider`-Baustein-Hinweis (lsHint nur bei dB) aktualisiert.
3. Slider-Body im `fmCfg` deklariert `instruction`, `statusGrid`,
   `background`, `debugRun` zusätzlich; `onDebugRun`-Hook verdrahtet.
4. `fmUpdateSliderProgress` existiert; wird in `fmStartSlider`,
   `fmLoadElectrode`, `fmConfirm`, `fmUndo` aufgerufen.
5. Timer-Tick funktioniert auch im Slider-Modus; `_fmActiveProgress`
   wählt den richtigen Ref je nach laufendem Verfahren.
6. `fmRenderSliderStatusGrid` existiert; wird an den genannten vier
   Stellen aufgerufen.
7. `fmRunSliderDebugSim` existiert; verfüllt `sliderEstimates` mit
   Zufalls-cent, beendet den Lauf, ruft `renderFreqMatchResults`.
8. `lsHint`-Element wird im neuen `slider`-Baustein nur bei
   `unit === 'dB'` gerendert; Slider-Refs für `lsHint*` sind im
   Cent-Fall `undefined`.
9. Token-pairIndicator im Slider-Modus zeigt keine Hz-Zeile.
10. i18n-Keys neu: `fmSliderInstruction`, `fmExplainSliderScienceTitle`,
    `fmExplainSliderScience`. Anführungszeichen-konform.
11. `APP_VERSION` ist `"3.0.111-beta"`.
12. CODESTRUKTUR-Eintrag ergänzt.
13. `onReplay`-Hook in beiden Verfahren (`fmCfg` Z. 1776 und 1802 nach
    BA 110) zeigt auf `fmPlayCurrent`, nicht mehr auf `fmReplayCurrent`.
14. `buildSliderTouchCtrl`-Aufruf in `freqmatch.js` (Z. 1813–1823 nach
    BA 110) ist entfernt; Touch-Buttons werden ausschließlich von
    `_buildTestPanelNew` gebaut.
15. `slider`-Baustein in `_buildTestPanelNew` ruft `buildSliderTouchCtrl`
    mit Optionen aus `cfg.slider.touchStep`/`touchFineStep`; keine
    `replay`-Option mehr.
16. `_buildTestPanelOld` und die alten Test-Module (`test.js`,
    `lr-balance.js`, `latency.js`) sind unangetastet.

Bei **unklar**: Rückfrage statt raten.

---

## Notausgang-Prinzip

- Timer-Tick: wenn der heutige `_fmTickTimer` hartkodiert auf einen
  bestimmten progress-Ref zeigt und ein generischer Helfer nicht einfach
  einsetzbar ist (z.B. weil andere Stellen den hartkodierten Ref erwarten),
  **vor dem Umbau Rückfrage stellen**.
- Slider-Debug-Simulation: wenn `fmFinish`/`fmAbort` Logik unerwartet
  greift und der Sim-Lauf in einer halben Persistenz hängt, eine
  einfachere Variante vorschlagen (z.B. Tabelle füllen, Lauf wie sonst
  über `fmAbort` beenden, ohne `fmFinish` durchzulaufen).
- LS-Hint-Removal: wenn ein Aufrufer der **neuen** API (heute nur
  freqmatch) auf `lsHint*`-Refs zugreift, die jetzt `undefined` sind,
  defensiv per `?.` oder `&&` prüfen — nicht den Slider-Baustein wieder
  bedingungslos rendern.

---

## Hinweis am Ende

- Übersetzungen (en/fr/es) für `fmSliderInstruction`,
  `fmExplainSliderScienceTitle`, `fmExplainSliderScience`: eigene
  Mini-Anleitung später.
- BA 112: Tonseitenabfrage als generelles testUI-Feature + Adaptive-
  Start-Check („sind alle Schätzungen da?"). Erst nach Abnahme von
  BA 111 angehen.
- Echte Slider-Bugs jenseits der UI-Struktur (falls weitere auftauchen,
  z.B. Audio-Pfad, Persistenz, Pfeiltasten-Schrittweite): nach BA 111
  als separate Anleitung.
