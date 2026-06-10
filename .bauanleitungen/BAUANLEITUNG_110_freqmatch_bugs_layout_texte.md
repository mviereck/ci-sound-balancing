# Bauanleitung 110 — Frequenzabgleich: Bug-Fixes, Layout-Feinschliff, Erklärungstexte

**Kontext:** Nach BA 109 ist das Layout neu strukturiert, der „Gleichzeitig"-
Hook korrigiert, der Debug-Button als Baustein da. Die Akzeptanz hat
mehrere Bugs und Detail-Wünsche aufgedeckt, die in dieser Anleitung
zusammen gebaut werden. Slider-Verfahren-Bugs und die Tonseitenabfrage-
Generalisierung sind **nicht** Teil dieser Anleitung — sie folgen in
BA 111 bzw. BA 112.

**Zielversion:** `APP_VERSION = "3.0.110-beta"`

---

## Pflichtlektüre

1. `CLAUDE.md` — ARBEITSWEISE, VERSIONIERUNG, NOTAUSGANG-PRINZIP.
2. `docs/BAUANLEITUNGEN_LEITLINIEN.md` — Akzeptanztest, Selbstprüfung,
   Anführungszeichen-Regel für i18n-Strings.
3. `docs/spec/00-testui-architektur.md` — Pfeiltasten-Tabelle, Bausteine-
   Katalog, feste Body-Reihenfolge (durch BA 109 eingeführt).
4. `js/test-ui.js` — neue API `_buildTestPanelNew`, testUI-Helfer,
   Pfeiltasten-Handler. **Den alten Block `_buildTestPanelOld` nicht
   anfassen.**
5. `js/freqmatch.js` — gezielt:
   - `fmUpdateAdaptiveProgress` (~Z. 1349)
   - `fmLoadVerfahrenFromSide` / `fmUpdateSliderModeAvail`
   - `_fmIsAba` (~Z. 155) und der adaptive Trial-Play-Pfad (Funktion,
     die die Tonpaare abspielt — Sonnet sucht sie an der Stelle, wo
     `playToneTyped` bzw. `playFreqPair` für den adaptiven Lauf
     aufgerufen wird)
   - `fmCfg` (cfg-Objekt für `buildTestPanel`)
6. `i18n/de.js` — alle Frequenzabgleich-bezogenen Strings (grep auf
   Schlüssel mit Präfix `fm`, `hj`).

---

## Scope dieser Anleitung — 8 Themen

### Teil A — Fokus-Bug: Tasten lösen Buttons nicht aus

**Symptom:** Nach Klick auf ein Header-Dropdown (z.B. Tonart) reagieren
Leertaste, Pfeiltasten und Backspace nicht mehr auf die Test-Aktionen,
weil das Dropdown den Fokus hält und die Tasten frißt.

**Ursache:** Pfeiltasten-/Aktions-Listener in testUI horcht auf
`document`-Ebene, aber das fokussierte `<select>` ruft `preventDefault`
für seine eigene Navigation.

**Fix:** Header-Selects sollen den Fokus nach `change` sofort abgeben.
In `_buildTestPanelNew` (`js/test-ui.js`), an **jedem** `<select>`-
Listener im Header (`seqSelect`, `toneSelect`, `targetSelect`,
`verfahrenSelect`, `refSelect`) am Ende des Handlers ergänzen:

```js
this.blur();
```

(bzw. `event.target.blur()`, je nach Funktions-Signatur).

Analog am Verfahren-Dropdown-Wechsel im Header.

**Plus:** Im Header zusätzlich auf das `parentEl` einen `change`-
Listener auf alle Selects:

```js
headerBox.addEventListener('change', function(e) {
  if (e.target.tagName === 'SELECT') e.target.blur();
}, true);
```

(in der Capture-Phase, damit auch andere Listener davor nicht stören).

**Nicht ändern:** number-inputs für Lautstärke/Dauer/Pause — die brauchen
ihren Fokus, und Pfeiltasten innerhalb eines number-inputs sind erwünscht.

### Teil B — Tastenkürzel anpassen

**Spec-Datei** `docs/spec/00-testui-architektur.md`, Pfeiltasten-Tabelle:

- Zeile `Z`-Taste → ändern auf **`Backspace`** für Undo.
- `B`-Taste → wieder hinzufügen, aber als **„beide Töne gleichzeitig" (`simul`-Hook)**.
  In BA 109 hatte ich die Zeile entfernt. Sie kommt anders zurück:
  jetzt für Nutzer-Aktion, nicht für Debug.

**In `js/test-ui.js`** Pfeiltasten-Handler ändern:

- Statt `key === 'z'` jetzt `key === 'Backspace'` → ruft `onUndo`.
- `key === 'b'` (oder Code 66) → ruft `onSimul`.
- Sicherstellen, dass das `actions`-Baustein-Rendering den Tasten-Hint
  im Button-HTML aktualisiert: bei `undo` steht heute `<span class="kbd">Z</span>`
  → ändern auf `<span class="kbd">⌫</span>` (Backspace-Symbol);
  bei `simul` analog `<span class="kbd">B</span>` einfügen (heute kein
  Tasten-Hint sichtbar, weil in BA 109 entfernt).

Debug-Button (Baustein `debugRun`) bleibt **ohne** Tastenkürzel.

### Teil C — `statusGrid` an Position 17 (vor `background`)

Die in BA 109 festgelegte Body-Reihenfolge wird angepasst. `statusGrid`
wandert von Position 2 ans Ende, direkt **vor** `background`. Neue
verbindliche Reihenfolge:

```
1.  runningTitle
2.  progress           — Balken
3.  progressText       — Text + Timer
4.  pairIndicator
5.  instruction
6.  decisionButtons
7.  actions
8.  keyHint
9.  slider
10. sliderValue
11. cumulativeDisplay
12. confirmButton
13. excludeButtons
14. applyButton
15. extraFragment
16. statusGrid           ← verschoben
17. background
18. debugRun
```

`confidence` ist gestrichen (siehe Teil G), daher fehlt der Eintrag.

In `_buildTestPanelNew`: Render-Reihenfolge entsprechend umstellen.
Spec-Datei `docs/spec/00-testui-architektur.md` ebenfalls aktualisieren
(die Reihenfolge-Liste, die in BA 109 dokumentiert wurde).

### Teil D — Trial-Text-Render-Bug

**Symptom:** Die Logik in `fmUpdateAdaptiveProgress`
(`js/freqmatch.js` Z. 1349) berechnet den Text `"Trial X von ca. Y"`
korrekt, aber er wird nicht im DOM sichtbar.

**Ursache:** Die Funktion manipuliert direkt `_aprog.text.firstChild`
und prüft `nodeType === 3` (Text-Knoten). Wenn das erste Kind des
`text`-Containers aber ein Element ist (z.B. der Timer-Span statt eines
Text-Knotens), schlägt der Check fehl und nichts wird geschrieben.

**Fix:** Direkten DOM-Zugriff durch den testUI-Helfer ersetzen.

**Vorher (Z. 1359–1364):**

```js
if (_aprog.fill) _aprog.fill.style.width = stats.percent + '%';
if (_aprog.text) {
  const tn = _aprog.text.firstChild;
  const txt = 'Trial ' + curTrial + ' von ca. ' + estTotal;
  if (tn && tn.nodeType === 3) tn.textContent = txt + ' ';
}
```

**Nachher:**

```js
const txt = 'Trial ' + curTrial + ' von ca. ' + estTotal;
testUI.progress.set(_aprog, {
  fraction: stats.percent / 100,
  text:     txt
});
```

**Und** den `else`-Zweig (Z. 1366–1371) analog:

```js
testUI.progress.set(_aprog, {
  fraction: 0,
  text:     'Trial 0 von ca. 0'
});
```

**Sicherstellen**, dass `testUI.progress.set` selbst Text-Knoten erzeugt,
wenn keiner vorhanden ist. Heutiger Code (`js/test-ui.js` Z. 1542–1549)
macht das schon — verifizieren.

### Teil E — AB/ABA-Bug im adaptiven Trial

**Symptom:** Der adaptive Test spielt immer nur „A-B" ab, auch wenn
die Tonfolge-Einstellung auf „ABA" steht.

**Untersuchung:** `_fmIsAba()` (Z. 155 in `freqmatch.js`) liefert den
korrekten Wert. Sie wird aber im adaptiven Trial-Play-Pfad vermutlich
nicht respektiert. Heutiger Slider-Modus nutzt `playFreqPair(...)` aus
`js/audio.js`, das ein `aba`-Flag entgegennimmt. Der adaptive Trial-
Play-Pfad ruft offenbar direkt `playToneTyped` zweimal sequenziell auf
(A, B) und ignoriert das Flag.

**Fix:** Sonnet sucht die Stelle, an der `fmPlayAdaptiveTrial` (oder
deren Hilfsfunktion) die Tonpaare abspielt, und ergänzt einen dritten
Wiedergabe-Schritt für den ABA-Fall:

```js
const aba = _fmIsAba();
await playToneTyped(c, hzA, volA, ms, panA, globalToneType);
await waitMs(pause);
await playToneTyped(c, hzB, volB, ms, panB, globalToneType);
if (aba) {
  await waitMs(pause);
  await playToneTyped(c, hzA, volA, ms, panA, globalToneType);
}
```

(Variablen-Namen und `waitMs`-Helfer an heutigen Code anpassen; falls
`waitMs` nicht existiert, das vorhandene Pattern aus dem Slider-Pfad
oder `playFreqPair` übernehmen.)

**Falls der Code-Pfad nicht eindeutig auffindbar ist** oder das Refactoring
größer wird als gedacht: Rückfrage statt raten.

### Teil F — Erklärungstexte: Siezen + neue Inhalte

**Regel:** Alle nutzerseitigen Texte im Frequenzabgleich-Sub-Reiter
siezen. „Du/Dir/Deine" → „Sie/Ihnen/Ihre" in allen i18n-Keys, die zu
diesem Tab gehören (Präfix `fm`, `hj`).

Sonnet macht einen grep über alle `fm*`/`hj*`-Strings in `i18n/de.js`
und stellt jeden duzenden Satz um. Bei Unsicherheit, ob ein Key zu
freqmatch oder zu einem anderen Tab gehört: kurz prüfen (Aufrufer-grep)
oder als „unklar" in der Selbstprüfung melden.

**Andere Tabs (Elektrodenlautstärke, Stereo-Balance, Latenz, Hauptseiten):
NICHT in dieser Anleitung umstellen.** Globale Siezen-Umstellung kommt
in einer eigenen Mini-Anleitung später.

**Konkrete Texte ersetzen** (deutsche Vorgabe, exakter Wortlaut):

`fmExplainSlider`:

```
"Das Testverfahren Vor-Schätzung erlaubt eine Frequenzanpassung pro Elektrode mit einem Schieber, bis sich die Töne auf beiden Seiten gleich hoch anhören. Diese Werte werden als Startpunkt für das genauere Adaptive-Testverfahren genutzt, um die Testzeit abzukürzen. Nach dem Start des Testverfahrens Adaptive ist die Anpassung per Slider nicht mehr möglich."
```

`fmExplainAdaptive`:

```
"Das adaptive Verfahren fragt höher/tiefer Vergleiche ab. Die Testreihe kann sehr lang dauern. Planen Sie genug Zeit und ein paar kleine Pausen ein. Die Testzeit kann verkürzt werden, wenn Sie vorher die Vor-Schätzung (Slider) ausführen."
```

**Achtung Anführungszeichen** (Leitlinien-Lessons-Learned, BA 84):
Die Strings nutzen nur `"…"` als äußere Begrenzung. Innerhalb der
Strings keine ASCII-`"` als Akzent. „Vor-Schätzung (Slider)" steht
ohne innere Anführungszeichen. Wenn doch ein Apostroph oder Zitat
nötig wird: typographisch („…") oder mit `\"` escapen.

### Teil G — Konfidenz-Bereich komplett raus (neue API)

**Was:** Der `confidence`-Baustein wird in der neuen API vollständig
gestrichen — kein Verfahren deklariert ihn mehr, der Baustein-Render-
Code in `_buildTestPanelNew` wird entfernt, die testUI-Helfer-Methode
`testUI.confidence.getValue` wird entfernt, die fRes-Speicherlogik im
freqmatch entfällt.

**Was bleibt unangetastet:**
- `_buildTestPanelOld` (alter Code) — `test.js` und `lr-balance.js`
  nutzen die alte API noch und damit auch den alten `confidence`-
  Code. Der bleibt vollständig wie er ist. Wird in Schritt 6 der
  testUI-Migration zusammen mit der alten API entfernt.
- i18n-Keys `confidenceLabel*`, `confQualityLabel`, `confidenceNotStored`:
  bleiben in `i18n/de.js`, weil sie noch vom alten Code referenziert
  werden.

**Konkret in `js/test-ui.js`:**
- Im Baustein-Render-Block des neuen API: den `if (body.confidence) { … }`-
  Pfad **entfernen**.
- Im `testUI`-Helfer-Objekt (ab Z. 1489): den `confidence: { getValue: … }`-
  Eintrag **entfernen**.
- Im `_lockTargets`-Pattern: falls dort `confirmButton` als Lock-Target
  auch confidence-Radios mit-deaktiviert hat — prüfen, ob das noch nötig
  ist (vermutlich überflüssig, weil keine Radios mehr im neuen Body).

**Konkret in `js/freqmatch.js`:**
- Im `fmCfg` (Slider-Body): `confidence: { show: true }` **entfernen**.
- Funktionen / Stellen, die Konfidenz schreiben:
  - In `fmConfirm` (oder vergleichbar) das Schreiben von
    `confidence:`/`confidenceLevel:` ins fRes-/sliderEstimates-Objekt
    **entfernen**.
  - In `fmUndo` ggf. das Lesen alter Konfidenz-Werte **entfernen**.
- Persistenz: ältere Daten haben vielleicht ein `confidence`-Feld; das
  bleibt unangetastet (kein Migrationspfad nötig — wird in Zukunft
  einfach ignoriert).

**Konkret in `docs/spec/00-testui-architektur.md`:**
- Baustein-Katalog-Tabelle: Zeile `confidence` **entfernen**.

**Konkret in `docs/CODESTRUKTUR.md`:**
- Vermerk „**Seit BA 110**: Konfidenz-Bereich aus neuer API entfernt
  (alte API behält ihn vorerst)."

### Teil H — Verfahren-Dropdown: Vor-Schätzung zuerst, Default-Logik

**Reihenfolge im Dropdown:** „Vor-Schätzung (Slider)" als **erste**
Option, „Adaptive" als zweite. Heute (`fmCfg`-Stand nach BA 108): adaptive
zuerst.

**Konkret in `js/freqmatch.js`, `fmCfg`:** das `verfahren`-Array tauschen:

```js
verfahren: [
  {
    id: 'slider',
    labelKey:   'fmModeSlider',
    explainKey: 'fmExplainSlider',
    body:  { … },
    hooks: { … }
  },
  {
    id: 'adaptive',
    labelKey:   'fmModeAdaptive',
    explainKey: 'fmExplainAdaptive',
    body:  { … },
    hooks: { … }
  }
]
```

**Default-Verfahren** beim Öffnen des Sub-Reiters bzw. beim Seiten-Wechsel:

- Wenn `sideData[varSide].freqmatchAdaptive.runs.length === 0` (kein
  adaptiver Lauf existiert) → Default **`slider`**.
- Wenn `runs.length >= 1` → Default **`adaptive`**, und `slider`-Option
  im Dropdown wird **deaktiviert** (heutiges
  `fmUpdateSliderModeAvail`-Verhalten, bleibt).

**Konkret in `fmLoadVerfahrenFromSide`** die Default-Auswahl anpassen:

```js
function fmLoadVerfahrenFromSide() {
  const varSide = (fmEls && fmEls.header && fmEls.header.refSelect)
    ? (fmEls.header.refSelect.value === 'left' ? 'right' : 'left')
    : 'right';
  const sd      = sideData[varSide] || {};
  const fa      = sd.freqmatchAdaptive;
  const hasRuns = !!(fa && Array.isArray(fa.runs) && fa.runs.length > 0);
  const saved   = (sd.fmVerfahren === 'slider' || sd.fmVerfahren === 'adaptive')
                  ? sd.fmVerfahren : null;

  let target;
  if (hasRuns) {
    target = 'adaptive';
  } else if (saved) {
    target = saved;
  } else {
    target = 'slider';   // neuer Default solange keine adaptiven Läufe
  }

  fmSetVerfahren(target, { force: true });
  fmRefreshResumeHint();
  fmUpdateSliderModeAvail();
}
```

`fmUpdateSliderModeAvail` selbst muss kaum ändern — es sperrt schon
heute die Slider-Option bei vorhandenen Runs. Stelle nur sicher, dass
beim Wegfall der Slider-Option der automatische Wechsel zu Adaptive
weiterhin greift (heute schon implementiert).

**Empfehlungs-Dialog aus BA 102 (`fmSliderEstimateDlg`) bleibt unverändert
aktiv.** Begründung: die neue Default-Logik führt den Nutzer zwar normalerweise
zuerst in den Slider-Modus, aber wenn er ihn aktiv überstimmt und auf
„Adaptive" wechselt, **muss** die Empfehlung weiterhin erscheinen, solange
keine Slider-Schätzungen vorliegen. Heutige Logik `_fmShouldOfferSliderEstimate()`
und der Dialog-Aufruf in `fmStart` / `_fmDoStart` bleiben so, wie sie sind.
Nicht anfassen.

(Die genauere Adaptive-Start-Check-Logik — vollständige Schätzungen pro
Elektrode mit Warnung und Rücksprung-Option — wird gesondert in BA 112
implementiert.)

---

## i18n — Änderungen in `i18n/de.js`

**Text-Ersetzungen** (vorhandene Keys, neuer Wortlaut siehe Teil F):
- `fmExplainSlider`
- `fmExplainAdaptive`

**Verfahren-Label** umsemantisieren:
- `fmModeSlider`: heute z.B. „Slider" → ändern auf
  `"Vor-Schätzung (Slider)"` (passend zur neuen Default-Reihenfolge und zum Erklärungstext).
- `fmModeAdaptive`: bleibt z.B. „Adaptive" — Sonnet prüft den heutigen
  Wert; falls er auf Deutsch wirkt („Adaptiv"), bleibt er.

**Sonstige Siezen-Umstellungen:** alle `fm*`/`hj*`-Keys grep'en und
duzende Sätze auf Sie/Ihr/Ihre stellen. Häufige Stellen:
- `fmHintMethod`, `fmHintWarn`, `fmPrereqHint`
- `hjPrompt` (Instruktionstext „Geben Sie an, …" — falls noch in Du-Form)
- weitere Hinweis-Strings

**Englisch/Französisch/Spanisch** nicht anfassen.

---

## Pflicht-Schritte am Ende

1. **`js/version.js`**: `APP_VERSION` `"3.0.109-beta"` → `"3.0.110-beta"`.
2. **`docs/CODESTRUKTUR.md`** kurze Ergänzungen:
   - test-ui.js: feste Reihenfolge geändert (Position 17 für statusGrid);
     Baustein `confidence` aus neuer API entfernt; Pfeiltasten-Mapping
     `Z`→`Backspace`, `B` wieder als simul; Header-Selects bekommen
     Auto-Blur nach Change.
   - freqmatch.js: Trial-Text-Render-Bug behoben; AB/ABA wird im
     adaptiven Pfad respektiert; `confidence`-Speicherlogik raus;
     Default-Verfahren-Logik (Slider solange keine adaptiven Runs).
     `fmSliderEstimateDlg` aus BA 102 bleibt unverändert aktiv.
3. **`docs/spec/00-testui-architektur.md`**:
   - Body-Reihenfolge-Liste aktualisieren (statusGrid an Position 17,
     confidence raus).
   - Pfeiltasten-Tabelle: `Z` → `Backspace`; `B`-Zeile wieder einfügen
     mit Wirkung „beide Töne gleichzeitig (simul)".
   - Bausteine-Katalog: Zeile `confidence` entfernen.
   - Migrationsplan unverändert; ein kurzer Hinweis-Absatz „BA 110 —
     Layout-Feinschliff und Bug-Fixes; BA 111 (Slider-Verfahren-Fixes)
     und BA 112 (Tonseitenabfrage-Generalisierung + Adaptive-Start-
     Check) folgen."

---

## Akzeptanztest

1. **Reload, Frequenzabgleich öffnen** → erwartet:
   - Verfahren-Dropdown zeigt **„Vor-Schätzung (Slider)"** zuerst, dann
     „Adaptive".
   - Default ist **Vor-Schätzung**, solange keine adaptiven Läufe für
     die aktuelle var-Seite existieren.
   - Erklärungs-Info-Box unter dem Dropdown zeigt den neuen Sie-Text
     für die Vor-Schätzung.
2. **Auf „Adaptive" wechseln** → Erklärungstext wechselt auf den
   adaptiven Sie-Text.
3. **Test starten (Adaptive)** → erwartet:
   - Sub-Titel oben: „Frequenzabgleich-Test 'Adaptive' läuft".
   - Trial-Text in der Fortschrittszeile sichtbar: „Trial X von ca. Y",
     wechselt mit den Trials.
   - Timer rechts daneben zählt hoch (war schon nach BA 109 ok).
   - Tonfolge-Dropdown auf „ABA" → erwartet: jeder Trial spielt 3 Töne
     (Ton 1, Ton 2, Ton 1). Auf „AB" → nur 2 Töne.
4. **Konfidenz-Radios sind nicht mehr sichtbar** im adaptiven Body —
   und auch nicht im Slider-Body.
5. **Status-Tabelle** erscheint **unten** im Body, direkt über dem
   Akkordeon (nicht mehr oben).
6. **Tonart-Dropdown anklicken**, danach Pfeiltasten ↑/↓ oder Leertaste
   drücken → Aktion löst aus (keine Frage des Dropdown-Fokus mehr).
7. **Taste B** (`b`) während laufendem Adaptiv-Test → spielt beide Töne
   parallel auf ihren Seiten.
8. **Backspace** während Adaptiv-Lauf → letzte Antwort wird rückgängig
   gemacht (Undo).
9. **Taste Z** macht **nichts** mehr (war ersetzt durch Backspace).
10. **DEBUG: Testlauf-Button** (sichtbar bei aktivem Debug-Panel) löst
    Debug-Simulation aus; keine Tastenbindung mehr.
11. **Mit adaptivem Lauf in den Daten**: Sub-Reiter erneut öffnen →
    Default ist „Adaptive", Slider-Option im Dropdown ist deaktiviert,
    Erklärungstext zeigt den adaptiven Text.
12. **Empfehlungs-Dialog vor adaptivem Start** taucht weiterhin auf,
    wenn der Nutzer auf Adaptive wechselt und für die var-Seite noch
    keine Slider-Schätzungen vorhanden sind. (Unverändert gegenüber BA 102.)
13. **Andere Sub-Reiter** (Elektrodenlautstärke, Stereo-Balance, Latenz):
    unverändert; Konfidenz-Radios dort weiterhin sichtbar (alte API).
14. **Konsole:** `typeof testUI.confidence` → `"undefined"`.

---

## Selbstprüfung (vor der Fertig-Meldung)

Pro Punkt **erfüllt / nicht erfüllt / unklar**, jeweils mit Datei- und Zeilenangabe.

1. Auto-Blur auf Header-Selects nach `change`: greift für alle Header-
   Dropdowns (sequence, toneType, sliderTarget, refSelect, verfahren).
2. Pfeiltasten-Handler in `_buildTestPanelNew`: `Backspace` → onUndo;
   `B` → onSimul; `Z` ist entfernt; `B` als Debug-Trigger ist entfernt.
3. Aktions-Button-HTML zeigt korrekte kbd-Marken (`⌫` bei Undo, `B`
   bei Simul).
4. Body-Reihenfolge in `_buildTestPanelNew` entspricht der Liste in
   Teil C (statusGrid an Position 16, vor background).
5. `fmUpdateAdaptiveProgress` nutzt `testUI.progress.set`, kein direkter
   DOM-Zugriff mehr.
6. AB/ABA-Flag wird im adaptiven Trial-Play-Pfad respektiert.
7. Erklärungstexte siezen jetzt; konkrete Texte aus Teil F eingespielt;
   keine ASCII-Anführungszeichen-Bombe innerhalb der Strings.
8. `confidence`-Baustein in neuer API entfernt (Render + Helfer +
   `_lockTargets`-Bezug); alte API unangetastet.
9. `fmCfg.verfahren`-Reihenfolge: Slider zuerst, Adaptive zweit; jedes
   Verfahren hat `explainKey`.
10. `fmLoadVerfahrenFromSide` setzt Default je nach `runs.length`.
11. Empfehlungs-Dialog `fmSliderEstimateDlg` (DOM-Bau, Listener,
    Aufrufer in `fmStart` / `_fmDoStart`, `_fmShouldOfferSliderEstimate`)
    ist unangetastet geblieben.
12. i18n-Keys `confidenceLabel*` etc. bleiben unverändert (für alte API).
13. `APP_VERSION` ist `"3.0.110-beta"`.
14. CODESTRUKTUR und Spec aktualisiert.

---

## Notausgang-Prinzip

Wenn beim Bau ein Verhalten begegnet, das nicht ohne Workaround
abbildbar ist (z.B. der AB/ABA-Trial-Play-Pfad steckt tief in der
Audio-Promise-Kette und ein simples drittes `await` bricht die Bypass-
Logik bei Catch-Trials), **nicht raten** — Rückfrage melden, konkrete
Stelle + Vorschlag.

Besonders heikel:
- **Konfidenz-Removal**: wenn der `_lockTargets`-Mechanismus dadurch
  bricht (weil er das `confidence`-Element als Lock-Target hatte), den
  Lock-Targets-Builder mit anpassen.
- **AB/ABA im adaptiven Trial-Play**: prüfen, ob Catch-Trials (Z. 777
  in freqmatch.js) eine besondere Reihenfolge brauchen, die durch ein
  drittes Wiedergabe-Element gestört wird.

---

## Hinweis am Ende

- Slider-Verfahren-Bugs: in **BA 111** separat.
- Tonseitenabfrage als generelles testUI-Feature + Adaptive-Start-Check
  („Sind alle Schätzungen da?"): in **BA 112**.
- Englisch/Französisch/Spanisch-Übersetzungen für `fmExplainSlider`,
  `fmExplainAdaptive` (und alle anderen in dieser BA angepassten
  deutschen Strings): eigene Mini-Anleitung später.
- Globale Siezen-Umstellung über das ganze Tool: eigene Mini-Anleitung
  später.
