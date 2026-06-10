# Bauanleitung 109 — testUI Verfahren-Body Layout, Sub-Titel, Verfahren-Erklärung, Debug-Button + Bug-Fixes

**Kontext:** Nach BA 108 läuft Frequenzabgleich auf der neuen testUI-API.
Bei der Abnahme sind UI-Probleme und ein konzeptueller Drift aufgefallen.
Diese Anleitung räumt sie auf, in einer einzigen Bauphase.

**Zielversion:** `APP_VERSION = "3.0.109-beta"`

---

## Pflichtlektüre vor dem Bau

1. `CLAUDE.md` — insbesondere ARBEITSWEISE, VERSIONIERUNG, NOTAUSGANG-PRINZIP.
2. `docs/BAUANLEITUNGEN_LEITLINIEN.md` — Selbstprüfung, Akzeptanztest, i18n-Regel (nur Deutsch).
3. `docs/spec/00-testui-architektur.md` — gesamt.
4. `js/test-ui.js` — neue API `_buildTestPanelNew` (ab Z. 651) + testUI-Helfer (ab Z. 1489). Den alten Block `_buildTestPanelOld` **nicht** anfassen.
5. `js/freqmatch.js` — Lese-Fokus: `fmCfg` (~Z. 1770 ff., Post-BA 108), `fmUpdateAdaptiveProgress` (Z. 1323), `fmRunDebugSim` (Z. 1515), Manual-Debug-Button-Block (~Z. 1894–1898), `fmStartAdaptive` und der Trial-Loop (~Z. 800–820), Paralleler Audio-Pfad `playToneTyped`-Promise.all bei Z. 439–440.
6. `js/audio.js` — `playFreqPair` und `playToneTyped` als Audio-Bausteine.

---

## Scope dieser Anleitung

**testUI-Änderungen** (`js/test-ui.js`, `_buildTestPanelNew` und Helfer):
- Verfahren-Body-Bausteine in fester Reihenfolge rendern (Detail in Teil A).
- Neuer Sub-Titel pro laufendem Test, automatisch generiert.
- Neue Header-Komponente: Verfahren-Erklärungs-Info-Box, wechselt beim Umschalten.
- Neuer Baustein `debugRun` (Debug-Testlauf-Button).
- Pfeiltasten-Mapping: **`B`-Shortcut entfällt** (Debug-Run nur per Mausklick).
- `simul`-Hook-Bedeutung korrigieren: ist wieder „beide Töne gleichzeitig" für den Nutzer, nicht Debug.

**freqmatch-Änderungen** (`js/freqmatch.js`):
- Manueller `dbg-only`-Button (Z. 1894–1898) entfällt → ersetzt durch neuen Baustein.
- `onSimul`-Hook zeigt nicht mehr auf `fmRunDebugSim`, sondern auf neue Funktion `fmPlaySimultaneous`.
- `fmRunDebugSim` wird über den neuen `debugRun`-Baustein-Hook angesteuert.
- `fmUpdateAdaptiveProgress` zeigt Trial-Zähler + Schätzung statt done/total.
- Timer-Tick aktivieren (heute kaputt: zeigt durchgehend `0:00`).

**i18n** (`i18n/de.js`):
- Neue deutsche Keys (siehe Abschnitt „i18n" unten).
- Label-Änderung: Verfahren-Dropdown heißt "Testverfahren" statt "Modus".

**CSS** (`style.css`):
- Klasse `.verfahren-explain` für die blau umrandete Info-Box.
- Klasse `.test-running-title` für den Sub-Titel.
- Klasse `.dbg-only` muss existieren (war schon im Projekt vorhanden; verifizieren).

**Doku**:
- `docs/spec/00-testui-architektur.md` — Bausteine-Katalog ergänzen, Pfeiltasten-Tabelle anpassen, feste Body-Reihenfolge dokumentieren.
- `docs/CODESTRUKTUR.md` — kurzer Vermerk „**Seit BA 109**: …" bei test-ui.js und freqmatch.js.

**Nicht in dieser Anleitung:**
- Andere Sub-Reiter (test, balance, latenz). Sie bleiben auf alter API.
- Slider-Vor-Schätzung-Bugs (gesondert besprochen).
- Englisch/Französisch/Spanisch-Übersetzungen.

---

## Teil A — Feste Verfahren-Body-Reihenfolge

In `_buildTestPanelNew` (`js/test-ui.js`) muss die Render-Reihenfolge der
Bausteine eines Verfahren-Bodies fest und für alle Verfahren identisch
sein. Die cfg deklariert nur **welche** Bausteine sie will, **nicht in
welcher Reihenfolge**. Bausteine, die ein Verfahren nicht deklariert,
fallen aus.

**Verbindliche Reihenfolge im Body** (von oben nach unten):

```
1.  runningTitle      — automatisch, von testUI gerendert, nicht aus cfg
2.  statusGrid
3.  progress          — Balken
4.  progressText      — Text mit Timer (Teil des progress-Bausteins)
5.  pairIndicator
6.  instruction
7.  decisionButtons
8.  actions           — undo, replay, simul
9.  keyHint
10. slider
11. sliderValue
12. cumulativeDisplay
13. confirmButton
14. confidence
15. excludeButtons
16. applyButton
17. extraFragment
18. background        — Akkordeon
19. debugRun          — separater Button, Klasse `dbg-only`
```

`runningTitle` ist **nicht** über cfg konfigurierbar — testUI fügt ihn
selbst ein und steuert seine Sichtbarkeit über den Lifecycle (siehe Teil B).

`debugRun` ist neu (siehe Teil C).

**Implementations-Hinweis:** Heute ist die Reihenfolge in `_buildTestPanelNew`
schon fest, aber abweichend. Den vorhandenen Body-Bau-Code so umstellen,
dass die obige Reihenfolge ihm entspricht. Bei den Bausteinen, die heute
existieren, nichts an Funktion ändern — nur die Render-Position.

---

## Teil B — Sub-Titel „<Tab-Titel>-Test '<Verfahren>' läuft"

**Wo:** Erster sichtbarer Eintrag im Verfahren-Body, oberhalb von statusGrid.

**Sichtbarkeit:** Nur zwischen Lifecycle-`start` und `stop`. Außerhalb
des Laufs `hidden`.

**Inhalt:** Drei Bestandteile, per i18n zusammengesetzt:
- `<Tab-Titel>` aus `cfg.explain.titleKey` (z.B. `fmTitle` → „Frequenzabgleich")
- `<Verfahren-Label>` aus `cfg.verfahren[].labelKey` des aktiven Verfahrens
- Statisches Muster aus dem neuen i18n-Key `testRunningTitlePattern`

**Render-Pattern:** drei `<span>`s in einem `<h3 class="test-running-title">`:

```html
<h3 class="test-running-title" hidden>
  <span data-t="fmTitle"></span>-<span data-t="testRunningTitleWord_test"></span>
  '<span data-t="fmModeAdaptive"></span>'
  <span data-t="testRunningTitleWord_running"></span>
</h3>
```

Spezial-Behandlung: wenn `cfg.verfahren.length === 1`, das Apostroph-Segment
mit `<Verfahren-Label>` weglassen — dann z.B. „Latenz-Test läuft".

**Sichtbarkeit-Steuerung:** im Start-Listener (im testUI) `runningTitle.hidden = false;`
und beim Verfahren-Wechsel den `data-t` des `<Verfahren-Label>`-Spans
auf den neuen `labelKey` umsetzen + `applyLang`. Beim Stop wieder `hidden = true`.

**CSS:**

```css
.test-running-title {
  margin: 0.5em 0 1em 0;
  font-size: 1.1em;
  font-weight: 600;
  text-align: center;
  color: #374151;
}
```

---

## Teil C — Verfahren-Erklärungs-Info-Box im Header

**Wo:** Direkt unter dem Verfahren-Dropdown im `header.common`. Nur sichtbar,
wenn `cfg.verfahren.length > 1` (sonst gibt es kein Dropdown, daher auch
keine Erklärung).

**Funktion:** Beim Umschalten des Dropdowns wechselt der Erklärungstext.
Pro Verfahren ein i18n-Key, in cfg deklariert.

**cfg-Erweiterung (pro Verfahren):**

```js
verfahren: [
  {
    id: 'adaptive',
    labelKey: 'fmModeAdaptive',
    explainKey: 'fmExplainAdaptive',      // NEU
    body: { … },
    hooks: { … }
  },
  {
    id: 'slider',
    labelKey: 'fmModeSlider',
    explainKey: 'fmExplainSlider',        // NEU
    body: { … },
    hooks: { … }
  }
]
```

**Render im Header:** ein `<div class="info-box verfahren-explain">`
direkt nach dem Verfahren-Dropdown-Row, mit `<span data-t="">`-Inhalt,
der beim Verfahren-Wechsel umgesetzt + `applyLang` neu aufgerufen wird.

**CSS:**

```css
.info-box.verfahren-explain {
  margin: 0.4em 0 0.8em 0;
  padding: 0.6em 0.9em;
  border-left: 3px solid #3b82f6;
  background: #eff6ff;
  border-radius: 4px;
  font-size: 0.92em;
  color: #1e3a8a;
}
```

(Wenn `.info-box` bereits global anders gestylt ist, die Variante mit
`.verfahren-explain` als Override schreiben. Im Zweifel den existierenden
`.info-box`-Stil in `style.css` prüfen, bevor du schreibst.)

---

## Teil D — Neuer Baustein `debugRun`

**Spec-Datei aktualisieren** — `docs/spec/00-testui-architektur.md`,
Bausteine-Katalog-Tabelle um eine Zeile ergänzen:

```
| `debugRun` | Debug-Testlauf-Button am Ende des Verfahren-Bodies, sichtbar nur bei aktivem Debug-Panel | `key`: i18n (Beschriftung); `cssClass`: optional, Default `'dbg-only'` | `onDebugRun()` |
```

**Pfeiltasten-Tabelle** im selben Dokument: die Zeile `B` entfernen.
Debug-Run wird ausschließlich per Mausklick ausgelöst.

**cfg-Eintrag (im Verfahren-Body):**

```js
debugRun: {
  key: 'btnDebugRun'   // i18n: "DEBUG: Testlauf"
}
```

**Render-Logik in `_buildTestPanelNew`** (am Body-Ende, nach `background`):

```js
if (body.debugRun) {
  var dbgBtn = _mkEl('button', 'btn dbg-only');
  dbgBtn.dataset.action = 'debug-run';
  dbgBtn.dataset.t = body.debugRun.key || 'btnDebugRun';
  if (body.debugRun.cssClass) {
    dbgBtn.classList.add(body.debugRun.cssClass);
  }
  verfahrenBody.appendChild(dbgBtn);
  bodyRefs.debugRun = dbgBtn;
  if (hooks.onDebugRun) {
    dbgBtn.addEventListener('click', function() { hooks.onDebugRun(bodyRefs); });
  }
}
```

`B`-Listener im Pfeiltasten-Handler (testUI-intern) entfernen.

**Sichtbarkeit:** die bereits vorhandene CSS-Regel `body.dbg-active .dbg-only`
übernimmt das (verifizieren in `style.css`). Kein eigener Sichtbarkeits-
Code in testUI nötig.

---

## Teil E — `simul`-Hook korrigieren („Gleichzeitig" als Nutzer-Funktion)

In der **Spec** `docs/spec/00-testui-architektur.md` das Freqmatch-Beispiel
korrigieren: `onSimul` zeigt **nicht** auf eine Debug-Funktion, sondern
auf eine echte Audio-Aktion „beide Töne gleichzeitig auf ihren jeweiligen
Seiten spielen".

In `js/freqmatch.js`:

**Vorher (`fmCfg`, BA-108-Stand):**

```js
hooks: {
  …,
  onSimul: fmRunDebugSim
}
```

**Nachher:**

```js
hooks: {
  …,
  onSimul:    fmPlaySimultaneous,   // beide Töne parallel, Nutzer-Vergleichshilfe
  onDebugRun: fmRunDebugSim          // separater Debug-Button
}
```

**Neue Funktion `fmPlaySimultaneous` in freqmatch.js**:

Der parallele Audio-Pfad existiert bereits in der Datei (siehe Z. 439–440:
`Promise.all([playToneTyped(c, refHz, refVol, ms, refPan, globalToneType),
playToneTyped(c, varHz, varVol, ms, varPan, globalToneType)])`). Diesen
Pfad in eine eigenständige Funktion extrahieren bzw. neu aufrufen:

```js
async function fmPlaySimultaneous() {
  if (!fmAdaptiveActive) return;   // nur während laufendem Test sinnvoll
  // Aktuellen Track bestimmen
  const track = fmTracks[fmCurTrackId];
  if (!track) return;
  // Parameter analog zu fmPlayAdaptiveTrial bestimmen
  const refSide  = fmRefSide;
  const varSide  = fmVarSide;
  const refHz    = …;   // Sonnet: aus track/cfg ableiten wie in fmPlayAdaptiveTrial
  const varHz    = …;
  const vol      = gVol();
  const ms       = parseInt(fmEls.header.durInput.value) || 400;
  const refPan   = (refSide === 'left') ? -1 : +1;
  const varPan   = (varSide === 'left') ? -1 : +1;
  const c        = gAC();
  const refVol   = vol * corrG(/* refElektrode */);   // Sonnet: Konvention prüfen
  const varVol   = vol * corrG(/* varElektrode */);

  testUI.pairIndicator.setPlaying(fmEls.verfahren.adaptive.pairIndicator, 'both');
  await Promise.all([
    playToneTyped(c, refHz, refVol, ms, refPan, globalToneType),
    playToneTyped(c, varHz, varVol, ms, varPan, globalToneType)
  ]);
  testUI.pairIndicator.setPlaying(fmEls.verfahren.adaptive.pairIndicator, null);
}
```

**Wichtige Klärungen während des Baus** (an Sonnet — bei Unklarheit
**Rückfrage** statt raten):

- Wie ermittelt der heutige `fmPlayAdaptiveTrial` `refHz` und `varHz` aus
  dem aktuellen Track? Genauso hier verwenden.
- `corrG(elektrodeIdx)`: prüfen, ob das die richtige Korrektur-Gain-Funktion
  ist. Im heutigen parallel-Pfad (Z. 439–440) steht der Audio-Aufruf bereits;
  die dortige Implementierung als Referenz nehmen.
- Falls `fmAdaptiveActive === false` (Test pausiert oder Slider-Modus):
  was soll passieren? Vorschlag: Funktion macht no-op. Wenn du eine
  bessere UX-Lösung siehst (z.B. „nur bei aktivem Trial möglich",
  Button deaktiviert), als Rückfrage melden.
- Der Slider-Verfahren-Body bekommt **keinen** `simul` in `actions` —
  dort ist parallel-Spielen aktuell nicht vorgesehen.

---

## Teil F — Manueller Debug-Button entfernen

In `js/freqmatch.js` den Block Z. 1894–1898 (`_simBtn` mit Klasse
`dbg-only`, manuelles Einhängen ans `parentEl`) **vollständig löschen**.
Die Funktion `fmRunDebugSim` bleibt — sie wird jetzt vom neuen
`debugRun`-Baustein-Hook aufgerufen.

Den `debugRun`-Baustein im Adaptiv-Verfahren-Body des `fmCfg` aufnehmen:

```js
verfahren: [
  {
    id: 'adaptive',
    …,
    body: {
      …,
      background: { … },
      debugRun:   { key: 'btnDebugRun' }
    },
    hooks: {
      …,
      onDebugRun: fmRunDebugSim
    }
  },
  …
]
```

**Slider-Verfahren bekommt keinen `debugRun`-Baustein** in dieser Anleitung
(heute existiert für den Slider-Modus keine Debug-Simulation; falls in
Zukunft gewünscht, eigene Anleitung).

---

## Teil G — Fortschritts-Anzeige reparieren

**Zwei Probleme heute:**

1. Die Fortschritts-Text-Zeile zeigt `Lauf X: done / total · Y %` — die
   User möchte stattdessen einen Trial-bezogenen Text mit Schätzung.
2. Der Timer (`timer-display`-Span) bleibt durchgehend auf `0:00` —
   kein Tick aktiv.

### G.1 — Trial-Text

In `js/freqmatch.js`, Funktion `fmUpdateAdaptiveProgress` (Z. 1323),
den Text-Block ersetzen. Format:

```
Trial <currentTrial> von ca. <estimatedTotal>
```

mit:
- `currentTrial` = Summe aller `tracks[k].trialCount` (Z. 1361 zeigt
  schon, wie das geht) **plus 1** (der gerade laufende), aber nur
  während `fmAwaitingResponse === true`. Wenn `fmAwaitingResponse === false`
  einfach die Summe.
- `estimatedTotal` = Heuristik: Anzahl Tracks × 25. Begründung:
  Daumenwert aus typischer 1-down-1-up-Konvergenz (≈ 8 Reversals ×
  3 Trials/Reversal). Der Wert ist eine Schätzung, keine Garantie.
  Konstante neu definieren:

```js
const FM_TRIALS_PER_ELECTRODE_ESTIMATE = 25;
```

(neben den anderen `FM_*`-Konstanten, am Anfang von `freqmatch-staircase.js`
oder in `freqmatch.js` — passend zur bestehenden Konvention).

**Konkret in `fmUpdateAdaptiveProgress`:**

```js
const stats        = fmComputeProgressStats(fmTracks);
const curTrial     = (stats.totalTrials || 0) + (fmAwaitingResponse ? 1 : 0);
const estTotal     = ids.length * FM_TRIALS_PER_ELECTRODE_ESTIMATE;

if (_aprog.fill) _aprog.fill.style.width = stats.percent + '%';
if (_aprog.text) {
  const tn = _aprog.text.firstChild;
  const txt = 'Trial ' + curTrial + ' von ca. ' + estTotal;
  if (tn && tn.nodeType === 3) tn.textContent = txt + ' ';
}
```

(Texte wie `Trial` und `von ca.` als deutsche Strings direkt; falls eine
i18n-Lösung gewünscht ist: i18n-Keys `progTrial` und `progApproxOf` neu
anlegen und Template über `t()` zusammensetzen. Vorschlag: Strings direkt
lassen und in der Selbstprüfung als „weiter i18n-isierbar" vermerken.)

### G.2 — Timer-Tick aktivieren

**Vor dem Bau** prüfen: Wo lag der Timer-Tick vor BA 108? Lange vorher
existierte in freqmatch.js sehr wahrscheinlich ein `setInterval`, das
`timerDisplay.textContent = …` setzt. Beim Refactor in BA 108 ist das
vermutlich verloren gegangen.

Wenn nicht eindeutig auffindbar, neuen Tick einbauen in
`fmStartAdaptive` und im `onStop`-Hook:

```js
let _fmTimerInterval = null;
let _fmTimerStartTs  = 0;

function _fmStartTimer() {
  _fmTimerStartTs = Date.now();
  _fmStopTimer();
  _fmTimerInterval = setInterval(_fmTickTimer, 1000);
  _fmTickTimer();
}
function _fmStopTimer() {
  if (_fmTimerInterval) {
    clearInterval(_fmTimerInterval);
    _fmTimerInterval = null;
  }
}
function _fmTickTimer() {
  const secs = Math.floor((Date.now() - _fmTimerStartTs) / 1000);
  const mm   = Math.floor(secs / 60);
  const ss   = secs % 60;
  const txt  = mm + ':' + (ss < 10 ? '0' : '') + ss;
  testUI.progress.set(fmEls.verfahren.adaptive.progress, { timer: txt });
}
```

`_fmStartTimer()` in `fmStartAdaptive` aufrufen (am Anfang des
tatsächlichen Trial-Loops), `_fmStopTimer()` in `fmAbort` und
`fmFinishAdaptive`.

**Resume-Verhalten:** wenn ein pausierter Lauf wieder aufgenommen wird,
soll der Timer ab dem aktuellen Zeitpunkt neu zählen (nicht summiert).
Wenn eine genauere Lösung gewünscht ist (kumulative Spieldauer über
Pausen hinweg), bitte als Rückfrage melden statt zu raten.

---

## Teil H — Header-Label „Modus" → „Testverfahren"

In `i18n/de.js`: der i18n-Key, der heute für das Verfahren-Dropdown-Label
verwendet wird, bekommt den Text "Testverfahren".

- Wenn der Key bisher `lblMode` o.ä. heißt und nur dieses Dropdown
  bedient: Text ändern: `lblMode: "Testverfahren"`.
- Wenn der Key woanders mitbenutzt wird (für andere Stellen, die wirklich
  „Modus" heißen sollen): einen neuen Key `lblVerfahren: "Testverfahren"`
  anlegen und im testUI-Render des Verfahren-Dropdowns auf den neuen Key
  umstellen.

Vor der Wahl: grep auf alle Verwendungen des heutigen Keys, um zu sehen,
ob Doppelnutzung besteht. Bei Unklarheit: Rückfrage statt raten.

---

## i18n — neue deutsche Keys in `i18n/de.js`

```js
// Sub-Titel-Bausteine (für testUI-internes Pattern)
testRunningTitleWord_test:    "Test",
testRunningTitleWord_running: "läuft",

// Verfahren-Erklärungen Frequenzabgleich
fmExplainAdaptive: "Das adaptive Verfahren spielt automatisch wechselnde Tonpaare ab und passt die Frequenz an deine Antworten an. Es ist die genauere Methode und konvergiert pro Elektrode auf einen Match.",
fmExplainSlider:   "Die Slider-Vor-Schätzung lässt dich pro Elektrode eine grobe Frequenz-Verschiebung manuell einstellen. Sie liefert dem adaptiven Verfahren einen besseren Startwert.",

// Debug-Button
btnDebugRun: "DEBUG: Testlauf",
```

Vorhandene Keys, nur Text-Änderung: `lblMode` (oder neuer `lblVerfahren`,
siehe Teil H) → `"Testverfahren"`.

**Englisch/Französisch/Spanisch nicht anfassen** (Leitlinien-Regel).
Hinweis in der Build-Meldung am Ende: „Übersetzungen für BA 109 in eigener
Mini-Anleitung später."

---

## Pflicht-Schritte am Ende

1. **`js/version.js`**: `APP_VERSION` `"3.0.108-beta"` → `"3.0.109-beta"`.
2. **`docs/CODESTRUKTUR.md`**: kurze Ergänzungen
   - test-ui.js-Eintrag: feste Body-Reihenfolge, Sub-Titel-Automatik,
     `verfahren-explain`-Info-Box, neue Bausteine `debugRun`, B-Shortcut entfällt.
   - freqmatch.js-Eintrag: `fmPlaySimultaneous` neu; `_simBtn`-Manualblock
     entfernt; Fortschritts-Text auf Trial-Schätzung umgestellt; Timer-Tick
     reaktiviert; `FM_TRIALS_PER_ELECTRODE_ESTIMATE` neu.
3. **`docs/spec/00-testui-architektur.md`**:
   - Bausteine-Katalog: `debugRun` neue Zeile; `simul`-Bedeutung in der
     Tabelle prüfen (es ist NUTZER-Funktion „beide gleichzeitig", nicht Debug);
     `runningTitle` als testUI-internes Element erwähnen (nicht als
     cfg-Baustein, sondern unter Lifecycle).
   - Pfeiltasten-Tabelle: `B`-Zeile entfernen.
   - Verfahren-cfg-Schema: `explainKey` als Pflichtfeld, wenn `verfahren.length > 1`.
   - Beispiel-cfg Freqmatch: `onSimul: fmRunDebugSim` ist falsch — auf
     `onSimul: fmPlaySimultaneous` und `onDebugRun: fmRunDebugSim` korrigieren.
   - Migrationsplan: keine Schritt-Nummer-Änderung; aber „BA 109 — UI-
     Layout-Korrektur und Bug-Fixes" als kurzer Nachtrag-Absatz unter
     dem Migrationsplan.

---

## Akzeptanztest (für den Nutzer)

1. **Reload, Frequenzabgleich öffnen** → erwartet:
   - Verfahren-Dropdown-Label heißt **„Testverfahren"**.
   - Unter dem Dropdown ist eine **blau umrandete Info-Box** mit dem
     Erklärungstext zum aktuell gewählten Verfahren.
   - Sliderwirkung-Feld sichtbar und deaktiviert (wie nach BA 108).
2. **Verfahren wechseln** auf „Slider" → Info-Box-Text wechselt; bei
   Rückwechsel auf „Adaptive" wieder der adaptive Text.
3. **Test starten (adaptiv)** → erwartet:
   - Im Test-Body **ganz oben** erscheint der Sub-Titel:
     **„Frequenzabgleich-Test 'Adaptive' läuft"**.
   - Reihenfolge im Body von oben nach unten: Sub-Titel · Status-Tabelle ·
     Fortschrittsbalken · Fortschritts-Text · Ton-1/Ton-2-Box · Erklärungstext ·
     ↑/↓-Buttons · Aktionsleiste (Zurück/Nochmal/**Gleichzeitig**) · Akkordeon ·
     Debug-Button (nur bei aktivem Debug-Panel sichtbar).
4. **Fortschritts-Text** zeigt z.B. „Trial 3 von ca. 175" während des Laufs.
5. **Timer rechts daneben** zählt hoch (nicht mehr `0:00`).
6. **Klick auf „Gleichzeitig"** → erwartet: beide Töne spielen
   **parallel auf ihren jeweiligen Seiten**, Aufleucht-Anzeige zeigt
   beide Boxen gleichzeitig leuchtend. **Der Test bricht nicht ab,
   kein Debug-Lauf startet.**
7. **Klick auf „DEBUG: Testlauf"** (nur sichtbar bei aktivem Debug-Panel):
   startet die Debug-Simulation wie bisher.
8. **Tastatur:** `B` macht nichts mehr (kein Debug-Trigger).
   `←/→` bewegen Slider (im Slider-Modus); `↑/↓` antworten; `Leertaste`
   wiederholt; `Z` Undo. Alles wie bisher.
9. **Akkordeon „Wissenschaftliche Grundlage"** unten im Body, ausklappbar.
10. **Test pausieren** → Sub-Titel verschwindet; Timer stoppt; bei
    Neustart läuft Timer wieder ab 0:00.
11. **Andere Sub-Reiter** (Elektrodenlautstärke, Stereo-Balance, Latenz):
    unverändert funktionsfähig.
12. **Konsole:** `typeof fmPlaySimultaneous` → `"function"`;
    `document.querySelectorAll('.dbg-only').length` → mindestens 1
    (Debug-Button).

---

## Selbstprüfungs-Auftrag (vor der Fertig-Meldung)

Pro Punkt: **erfüllt** / **nicht erfüllt** / **unklar**, mit Datei- und Zeilenangabe.

1. Feste Body-Reihenfolge in `_buildTestPanelNew` entspricht der Liste in Teil A.
2. Sub-Titel-Element wird gerendert, beim Start sichtbar, beim Stop versteckt,
   passt sich beim Verfahren-Wechsel an.
3. Sub-Titel-Sonderfall `verfahren.length === 1` wird korrekt gehandhabt
   (kein Apostroph-Segment).
4. Verfahren-Erklärungs-Info-Box rendert unter dem Dropdown, nur wenn
   `verfahren.length > 1`. Text wechselt beim Umschalten; `applyLang` wird aufgerufen.
5. Neuer Baustein `debugRun` rendert nur, wenn cfg ihn deklariert; ruft
   `hooks.onDebugRun` auf; bekommt Klasse `dbg-only`.
6. Pfeiltasten-Listener: `B` ist entfernt (kein Code-Pfad mehr).
7. `simul`-Hook in der Freqmatch-cfg zeigt auf `fmPlaySimultaneous`;
   `fmRunDebugSim` ist über `onDebugRun` verdrahtet.
8. `fmPlaySimultaneous` spielt beide Töne parallel auf ihren Seiten;
   `setPlaying('both')` vor, `setPlaying(null)` nach dem Audio.
9. Manueller `_simBtn`-Block in `freqmatch.js` (Z. 1894–1898) ist gelöscht.
10. `fmUpdateAdaptiveProgress` zeigt „Trial X von ca. Y"; Konstante
    `FM_TRIALS_PER_ELECTRODE_ESTIMATE` neu definiert.
11. Timer-Tick: `setInterval` startet in `fmStartAdaptive`, stoppt in
    `fmAbort` und `fmFinishAdaptive`; Timer-Span aktualisiert sich sichtbar.
12. CSS-Klassen `.test-running-title` und `.info-box.verfahren-explain`
    sind in `style.css`.
13. Verfahren-Dropdown-Label heißt „Testverfahren" (Direktänderung an
    `lblMode` oder neuer `lblVerfahren` — Wahl begründet).
14. Spec-Datei: Bausteine-Katalog, Pfeiltasten-Tabelle, Beispiel-cfg
    aktualisiert. Notausgang-Prinzip nicht verletzt.
15. `APP_VERSION` ist auf `3.0.109-beta`.
16. CODESTRUKTUR.md-Einträge ergänzt.

Bei **unklar**-Markierungen: zurückmelden statt raten.

---

## Notausgang-Prinzip

Wenn dir beim Bau ein Verhalten begegnet, das mit den vorhandenen
Bausteinen + den hier eingeführten Erweiterungen nicht abbildbar ist,
**nicht workaroundend bauen**. Beschreibe den Fall, betroffene
Code-Stelle, Vorschlag. Der User entscheidet.

Insbesondere bei `fmPlaySimultaneous`: wenn die Audio-Parameter (Pan,
Korrektur-Gain, Track-zu-Hz-Auflösung) nicht eindeutig aus dem
bestehenden `fmPlayAdaptiveTrial`-Code abzuleiten sind — Rückfrage
melden, nicht raten.
