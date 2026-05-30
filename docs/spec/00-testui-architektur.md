# Test-UI — Architektur

**Status**: Schrittweise eingeführt. **Schritt 1 und 2 sind gebaut** (BA 107/108,
`js/test-ui.js`, `js/freqmatch.js`). Die neue API `buildTestPanel(parentEl, {header, verfahren})`
und alle Bausteine sind implementiert; freqmatch.js ist vollständig migriert.
Die anderen Sub-Reiter laufen noch auf der alten API parallel. Ab hier beschreibt
dieses Dokument den **aktuellen Code-Stand**.

Dieses Kapitel ist horizontal — es beschreibt nicht die Funktion
eines Tests, sondern die gemeinsame **Bau-API** für alle Tests
unter dem Reiter „Messungen". Konkrete Test-Funktionen stehen in
[02-messung.md](02-messung.md) und [02b-freqmatch-adaptiv.md](02b-freqmatch-adaptiv.md).

## Ziel und Nicht-Ziel

**Ziel**: Alle Sub-Reiter unter „Messungen" folgen einem einheitlichen
Bau-Schema. Eine zentrale Funktion `buildTestPanel(parentEl, cfg)`
in `js/test-ui.js` erzeugt sämtliche UI-Elemente eines Tests aus
einer deklarativen Konfiguration. Wiederkehrende Mechaniken
(Pfeiltasten-Steuerung, Aufleuchten der Tonindikator-Boxen,
Replay-Sperre während Audio-Wiedergabe, Tab-Sperre während Test,
Mobile-Readonly) liegen einmalig in der test-ui und werden
**nicht** in den einzelnen Test-Modulen wiederholt. Neue
Test-Verfahren — innerhalb eines bestehenden Sub-Reiters oder als
neuer Sub-Reiter — können ohne Wiederholung von UI-Bau-Code
hinzugefügt werden.

**Nicht-Ziel**: Funktionsänderungen an den bestehenden Tests
(Meß-Mechanik, Auswertung, Persistenz). Die Architektur-Umstellung
ist ein reines Refactoring. Einzige funktionale Mit-Migrationen:
Aufnahme des Latenz-Tests unter dieses Schema (heute mit eigener
statischer HTML-Struktur) und Entfernung des `judgment`-Verfahrens
im Elektrodenlautstärke-Test (heute schon per `hideModeControl`
verborgen, funktional tot).

## Drei-Ebenen-Modell

Tests sind in drei Ebenen modelliert:

**Ebene A — Sub-Reiter** (z.B. `test`, `balance`, `freqmatch`,
`latenz`): hat eine Erklärungs-Card, einen gemeinsamen Header
(Voreinstellungen + Start/Stop) und einen oder mehrere
Verfahrens-Bodies.

**Ebene B — Verfahren** (1..n pro Sub-Reiter): jedes Verfahren ist
eine eigenständige Test-Mechanik mit eigenem Body. Ein Sub-Reiter
mit nur einem Verfahren deklariert genau ein Element im
`verfahren`-Array; das Verfahren-Dropdown im Header wird in diesem
Fall nicht gerendert. Beispiele heute:
- `freqmatch`: zwei Verfahren (`adaptive`, `slider`)
- `test`, `balance`, `latenz`: je ein Verfahren

**Ebene C — Bausteine**: wiederverwendbare UI-Elemente
(`pairIndicator`, `slider`, `decisionButtons`, `statusGrid`,
`confidence`, `actions`, …). Bausteine werden vom Verfahren-Body
deklarativ angefordert und sind zentral in test-ui.js
implementiert — inklusive ihres Verhaltens (Verdrahtung,
Pfeiltasten, Aufleuchten, Sperren).

## cfg-Schema (Überblick)

```js
buildTestPanel(parentEl, {
  id: 'freqmatch',            // Sub-Reiter-Id, identisch zum data-subtab
  explain: { titleKey, paragraphs },
  header: {
    common:    { /* Voreinstellungs-Bausteine */ },
    extra:     { fragment: HTMLElement | null },  // optional, Sub-Reiter-spezifisch
    startStop: { startKey, resumable }
  },
  verfahren: [
    { id, labelKey, explainKey, body: { /* Bausteine */ }, hooks: { /* Callbacks */ } },
    // explainKey: i18n-Key für Info-Box unter Verfahren-Dropdown (Pflicht wenn verfahren.length > 1)
    ...
  ]
}) → { header: {...refs}, verfahren: { id: {...refs}, ... }, ... }
```

`buildTestPanel` baut alle Cards und gibt ein Refs-Objekt zurück.
Das aufrufende Test-Modul nutzt die Refs nur, wenn es etwas anzeigen
oder lesen muß; alle Aktionen laufen über Callbacks in `hooks` oder
über zentrale Helfer (siehe Bausteine-Katalog).

## Vollständiges Beispiel — Freqmatch

```js
buildTestPanel(parentEl, {
  id: 'freqmatch',
  explain: {
    titleKey: 'fmTitle',
    paragraphs: [
      { key: 'fmHintMethod', kind: 'plain' },
      { key: 'fmPrereqHint', kind: 'plain' },
      { key: 'fmHintWarn',   kind: 'warn'  }
    ]
  },
  header: {
    common: {
      refSelect:    { type: 'side', key: 'fmLblRef' },
      volume:       { show: true },
      duration:     { show: true, default: 400, min: 100, max: 3000, step: 50 },
      pause:        { show: true, default: 400, min: 50,  max: 2000, step: 50 },
      toneType:     { show: true, source: 'global' },
      sequence:     { show: true, source: 'global' },
      sliderTarget: {
        options: ['ref','var','balance'],
        default: 'ref',
        disabled: true,                      // siehe IDEEN.md
        hintKey:  'fmSliderTargetDisabledHint'
      }
    },
    startStop: { startKey: 'fmLblStart', resumable: true }
  },
  verfahren: [
    {
      id: 'adaptive',
      labelKey:   'fmModeAdaptive',
      explainKey: 'fmExplainAdaptive',       // Info-Box unter Dropdown (BA 109)
      body: {
        pairIndicator:    { variant: 'token', leftKey: 'fmTone1', rightKey: 'fmTone2' },
        progress:         { format: 'simple' },
        instruction:      { key: 'hjPrompt' },
        decisionButtons:  { variant: 'updown' },
        statusGrid:       { show: true },
        actions:          ['undo','replay','simul'],
        background:       { titleKey: 'fmExplainAdaptiveScienceTitle', bodyKey: 'fmExplainAdaptiveScience', bodyAsHtml: true },
        debugRun:         { key: 'btnDebugRun' }  // BA 109
      },
      hooks: {
        onStart:    fmStartAdaptive,
        onStop:     fmAbort,
        onDecision: fmHandleHeight,    // (choice) => 'up' | 'down'
        onReplay:   fmReplayCurrent,
        onUndo:     fmUndoAdaptive,
        onSimul:    fmPlaySimultaneous, // beide Töne parallel (Nutzer-Vergleichshilfe)
        onDebugRun: fmRunDebugSim       // Debug-Simulation (BA 109)
      }
    },
    {
      id: 'slider',
      labelKey:   'fmModeSlider',
      explainKey: 'fmExplainSlider',         // Info-Box unter Dropdown (BA 109)
      body: {
        pairIndicator:    { variant: 'token', leftKey: 'fmTone1', rightKey: 'fmTone2' },
        progress:         { format: 'simple' },
        instruction:      { key: 'fmSliderInstruction' },
        keyHint:          { unitKey: 'sliderHintCent' },
        slider:           { unit: 'cent', ranges: [100,500,1200], touchStep: 5, touchFineStep: 1 },
        sliderValue:      { show: true },
        confirmButton:    { key: 'btnConfirmOffset' },
        actions:          ['undo','replay','simul'],
        statusGrid:       { show: true },
        background:       { titleKey: 'fmExplainSliderScienceTitle', bodyKey: 'fmExplainSliderScience', bodyAsHtml: true },
        debugRun:         { key: 'btnDebugRun' }
      },
      hooks: {
        onStart:    fmStartSlider,
        onStop:     fmAbort,
        onSlide:    fmHandleSlider,
        onConfirm:  fmConfirm,
        onReplay:   fmPlayCurrent,
        onUndo:     fmUndo,
        onSimul:    fmPlaySimultaneous,
        onDebugRun: fmRunSliderDebugSim
      }
    }
  ]
})
```

## Skizzen für die übrigen Sub-Reiter

**Elektrodenlautstärke** (`test`): Header analog (Lautstärke, Dauer,
Pause, Tonart, Tonfolge, refSelect-Elektrode, `sliderTarget` mit
Optionen `a`/`b`/`balance` und Default `balance`). Genau ein
Verfahren (Slider-basiert mit `pairIndicator.variant = 'electrode'`,
ABA-Sequenz, Konfidenz, Cumulative-Display, Confirm-Button).
Verfahren `judgment` entfällt. Zusatz-Auswahl Laufart
(full/conv_fast/manual) bleibt — wandert in `header.extra` als
test-spezifische Voreinstellung mit eigenem Fragment.

**Stereo-Balance** (`balance`): Header analog (Lautstärke, Dauer,
Pause, Tonart, Tonfolge, `sliderTarget` mit Optionen `left`/`right`/
`both` und Default `both`, kein refSelect). Genau ein Verfahren
(Slider-basiert mit `pairIndicator.variant = 'side'`,
Konfidenz, Cumulative-Display, Confirm-Button). Zusatz-Auswahl
Reihenfolge (random/ascending/descending) und Seitenwahl
(random/lr/rl) bleibt — wandert in `header.extra`.

**Latenz** (`latenz`): Header schlank (Klicktyp und Intervall als
balance-spezifische Voreinstellungen in `header.extra`,
`sliderTarget: false`). Genau ein Verfahren mit
`slider { unit: 'ms', ranges: [50] }`, `sliderValue`, `keyHint`,
`actions: ['replay']` (Apply-Button als eigener Baustein
`applyButton` mit Beschriftung „Übernehmen"). Erklärungs-Block
nimmt die heute statische Bluetooth-Warnung auf.

## Bausteine-Katalog

Jeder Baustein wird im `body` deklarativ angefordert. Verhalten ist
zentral in test-ui.js implementiert; das Test-Modul liefert
Callbacks über `hooks` und nutzt Helfer wie
`testUI.pairIndicator.setLabels(els, {...})`.

| Baustein | Zweck | Wichtige Optionen | Callbacks |
|---|---|---|---|
| `pairIndicator` | Box mit Labels für Ton-1/Ton-2 (oder L/R, A/B) und Hz-Anzeige; Aufleuchten beim Abspielen | `variant`: `'electrode'` \| `'side'` \| `'token'`; `leftKey`/`rightKey` (für `token`) | — (Helfer: `setLabels`, `setPlaying`) |
| `slider` | Range-Slider mit Pfeiltasten-Steuerung und Range-Wechsel; baut „− / Fein / +"-Touch-Buttons automatisch ein | `unit`: `'dB'` \| `'cent'` \| `'ms'`; `ranges`: Array von Maxima; `defaultRange`: Index; `touchStep`, `touchFineStep` (Schrittweite der Touch-Buttons); LS-Hint-Element nur bei `unit: 'dB'` | `onSlide(v)` |
| `sliderValue` | Werte-Anzeige unter dem Slider | `show`, `formatter`: optional | — |
| `decisionButtons` | Antwort-Buttons | `variant`: `'updown'` (↑/↓) | `onDecision(choice)` mit `choice`: `'up'` \| `'down'` |
| `confirmButton` | Bestätigen-Button | `key`: i18n | `onConfirm()` |
| `actions` | Aktionsleiste: Undo/Replay/Simul | Array von `'undo'`/`'replay'`/`'simul'` | `onUndo()`, `onReplay()`, `onSimul()` (Nutzer-Funktion „beide Töne gleichzeitig", nicht Debug) |
| `statusGrid` | Per-Elektroden-Statusanzeige | `show` | — (Helfer: `setEntries`) |
| `progress` | Fortschrittsbalken mit Timer | `format`: `'simple'` \| `'rounds'` | — (Helfer: `set`) |
| `cumulativeDisplay` | Kumulativer Offset | `key`: i18n | — (Helfer: `set`) |
| `instruction` | Instruktionstext über Antwort-Buttons | `key`: i18n | — |
| `keyHint` | Pfeiltasten-Hinweisbox | `unitKey`: i18n | — |
| `excludeButtons` | Elektrode/Seite ausschließen + Bestätigungs-Modal | `target`: `'electrodes'` \| `'sides'` | `onExclude(which)` |
| `applyButton` | „Übernehmen"-Button (Latenz: Wert als Ergebnis übernehmen) | `key`: i18n | `onApply()` |
| `extraFragment` | Custom-DOM-Slot für seltene Sub-Reiter-spezifische Elemente | `fragment`: HTMLElement | — |
| `background` | Ausklappbares Erklär-Akkordeon am Ende des Verfahren-Bodies (`<details>/<summary>`) | `titleKey`: i18n; `bodyKey`: i18n; `bodyAsHtml`: bool (Default false) | — |
| `debugRun` | Debug-Testlauf-Button am Ende des Verfahren-Bodies, sichtbar nur bei aktivem Debug-Panel | `key`: i18n (Beschriftung); `cssClass`: optional, Default `'dbg-only'` | `onDebugRun()` |

`pairIndicator.variant` definiert Label-Format und Aufleucht-Logik:
- `'electrode'`: Labels „A E1" / „B E2" plus Hz-Zeile; `setPlaying('left'|'right'|'both'|null)`
- `'side'`: Labels „L: E5" / „R: E5" plus Hz-Zeile; `setPlaying` analog
- `'token'`: Labels „Ton 1" / „Ton 2" (oder via i18n-Keys); keine Hz-Zeile

## Header — Aufteilung

**`header.common`** enthält die Voreinstellungen, die in fast jedem
Test sinnvoll sind: Verfahren-Dropdown (automatisch, wenn
`verfahren.length > 1`), refSelect, volume, duration, pause,
toneType, sequence, sliderTarget. Jedes Feld kann mit `show: false`
oder weglassen unterdrückt werden. Reihenfolge im DOM ist fix; cfg
ändert nur Sichtbarkeit und Optionen.

**`header.extra`** ist ein optionaler Slot für
Sub-Reiter-spezifische Voreinstellungen, die nicht in das
common-Schema passen. Aufrufer übergibt ein vorbereitetes
HTMLElement; testUI hängt es zwischen `common` und `startStop`
ein. Damit lassen sich Sonderfälle wie die Latenz-Klicktyp/Intervall-
Wahl, die test-Laufart oder die balance-Reihenfolge ohne Erweiterung
der zentralen API abbilden. Voraussetzung: solche Fälle sind selten;
wenn ein Sonderfeld in mehreren Sub-Reitern auftaucht, gehört es als
Baustein in `common`.

**`header.startStop`** ist immer vorhanden. Der Start-Button-Text
ist konfigurierbar (`startKey`); der Stop-Button-Text und das
Lock-Hint-Verhalten richten sich nach `resumable`.

## Verhaltens-Automatik (Lifecycle)

testUI kümmert sich selbst um diese Mechaniken; Test-Module müssen
sie weder bauen noch verdrahten:

- **runningTitle (BA 109)**: `h3.test-running-title` im aktiven Verfahren-Body wird bei `start` eingeblendet und bei `stop` ausgeblendet. Nicht cfg-konfigurierbar — testUI rendert es automatisch. Inhalt: „TabTitel-Test 'Verfahren' läuft" (Apostroph-Segment entfällt bei `verfahren.length === 1`).
- **Tab-Sperre während laufendem Test**: alle Top-Level-Tabs außer
  „Messungen" und alle Sub-Tabs außer dem aktiven werden gesperrt
  (heute schon in `lockTestTabs`, bleibt).
- **Verfahren-Sperre während laufendem Test**: Verfahren-Dropdown
  wird automatisch `disabled` zwischen `start` und `stop`.
- **Pfeiltasten-Routing**: testUI registriert einen Keyboard-Listener,
  solange der jeweilige Verfahren-Body sichtbar ist.
  - ←/→: ruft `body.slider.onSlide` mit dem neuen Wert; Schrittweite
    aus der aktuellen Range; Shift = Fein-Schritt
  - ↑/↓: ruft `body.decisionButtons.onDecision('up')` bzw.
    `'down'`. Aktiv nur, wenn `decisionButtons` deklariert.
  - Leertaste: ruft `actions.onReplay`, falls deklariert
  - Backspace: ruft `actions.onUndo`, falls deklariert
  - B: ruft `actions.onSimul`, falls deklariert (Nutzer-Funktion: beide Töne gleichzeitig)
- **Aufleuchten der pairIndicator-Boxen** (`.playing`-Klasse):
  Test-Modul ruft `testUI.pairIndicator.setPlaying(els, 'left')`
  vor dem Tonabspielen und `setPlaying(els, null)` danach. testUI
  schaltet die CSS-Klasse. Kein Test setzt mehr selbst
  `classList.add('playing')`.
- **Replay-Sperre während Audio-Wiedergabe**: testUI setzt
  decision-Buttons und confirm-Button automatisch `disabled`
  zwischen `setPlaying(left|right|both)` und `setPlaying(null)`.
  Test-Module brauchen sich darum nicht zu kümmern.
- **Mobile-Anpassung**: `applyMobileReadonly(parentEl)` wird nach
  jedem Baustein-Rebuild aufgerufen (heute schon).
- **Fokus-Blur** nach Button-Klicks im testBox (heute schon).

## Drei Deaktivierungs-Mechanismen

Drei Wege, ein Feld zu sperren — sauber getrennt, weil sie
unterschiedliche Lebensdauer und Zuständigkeit haben:

**1. Statisch (cfg-Zeit, unveränderlich):**

```js
sliderTarget: { options: [...], default: 'ref', disabled: true }
```

Feld wird gerendert, ist aber dauerhaft `disabled`. Anwendung:
Funktion noch nicht implementiert, soll aber im UI sichtbar sein
(z.B. Freqmatch-`sliderTarget` bis zur funktionalen Erweiterung —
siehe IDEEN.md). Wird in der cfg auf `false` umgestellt, sobald die
Funktion aktiv ist. Optionaler `hintKey` zeigt einen Erklärungstext
neben dem Feld.

**2. Lifecycle-Automatik (testUI-intern):**

testUI sperrt bestimmte Felder automatisch zwischen `start` und
`stop`. Felder werden in test-ui.js per Baustein-Definition als
„test-stable" markiert (z.B. Verfahren-Dropdown, refSelect). Felder
ohne diese Markierung bleiben live änderbar (z.B. volume, sequence).

**3. Dynamisch (Test-gesteuert, Sonderfall):**

```js
testUI.field.setEnabled(els, 'verfahrenSelect.slider', false,
                        { reason: 'fmAdaptiveExists' })
```

Test-Modul fordert zur Laufzeit die Sperre einer einzelnen Option
oder eines Feldes an. Anwendung: Freqmatch-Slider-Verfahren wird
gesperrt, sobald ein adaptiver Lauf existiert (heute
`fmUpdateSliderModeAvail`). Selten. Wird nicht für allgemeine
Tab-Sperren mißbraucht — dafür gibt es Lifecycle-Automatik.

## Notausgang-Prinzip

Es gibt keine Notausgänge. Die testUI deckt mit ihren Bausteinen alle
Test-Mechaniken ab, die heute existieren. Wenn beim Bauen eines Tests
ein Fall auftritt, der mit den vorhandenen Bausteinen nicht abbildbar
ist, gilt verbindlich:

- **Pflicht zur Rückfrage** vor dem Bau. Sonnet (oder Opus, je nach
  Phase) beschreibt den Fall, weist explizit darauf hin, daß er nicht
  zur testUI-Logik paßt, und schlägt eine Lösung vor (typisch: neuen
  Baustein in test-ui.js ergänzen, oder Mechanik anders modellieren).
- **Kein stillschweigendes Workaround** (kein direktes DOM-Manipulieren
  außerhalb testUI-Helfern, keine eigenen Keyboard-Listener, kein
  Aushebeln der Lifecycle-Automatik).
- **`extraFragment` ist kein Notausgang**, sondern der saubere Slot
  für seltene Sub-Reiter-Voreinstellungen. Test-Mechaniken (Slider,
  Buttons, Antworten) gehören nicht hinein.

Diese Regel gilt für Konzept- und Bauphase gleichermaßen und ist
verbindlicher Bestandteil jeder Bauanleitung, die testUI berührt.

## Pfeiltasten-Mapping

| Taste | Wirkung | Aktiv wenn |
|---|---|---|
| ← / → | Slider bewegen (1 Schritt) | `slider`-Baustein im aktiven Body |
| Shift + ← / → | Slider bewegen (Fein-Schritt) | dito |
| ↑ / ↓ | Antwort „zweiter Ton lauter/leiser" bzw. „höher/tiefer" | `decisionButtons`-Baustein im aktiven Body |
| Leertaste | Replay aktueller Trial | `actions` enthält `'replay'` |
| Backspace (⌫) | Undo letzte Antwort | `actions` enthält `'undo'` |
| B | Beide Töne gleichzeitig abspielen (simul) | `actions` enthält `'simul'` |
| Enter | „Offset bestätigen" / `onConfirm` auslösen | `confirmButton`-Baustein deklariert |
| 1 / 2 / 3 | (entfällt — `judgment`-Verfahren wird gestrichen) | — |

## Migrationsplan

Schrittweise Einführung, jeder Schritt als eigene Bauanleitung mit
Akzeptanztest. Bis Schritt 6 leben alte und neue API parallel; alte
Aufrufer bleiben funktionsfähig.

Die Schritte 1 und 2 werden vom Opus-Hauptchat per Sonnet-Agent
gebaut (Opus behält die Übersicht über die API-Konsistenz, siehe
Ausnahme-Regel in `CLAUDE.md`, Abschnitt EFFIZIENTER UMGANG MIT DEM
PRO-ABO). Ab Schritt 3 wiederholt sich das Pattern; diese Schritte
werden per Bauanleitung in eigene Sonnet-Chats ausgelagert.

**Schritt 1 — testUI-API einführen** *(Agent)* ✅ gebaut (BA 107)

- `buildTestPanel` um neue Signatur ergänzt (alte parallel); Erkennung
  über cfg-Form (neu hat `header`/`verfahren`-Schlüssel)
- Alle Bausteine aus dem Katalog implementiert: `pairIndicator`,
  `slider`, `sliderValue`, `decisionButtons`, `confirmButton`,
  `actions`, `confidence`, `statusGrid`, `progress`,
  `cumulativeDisplay`, `instruction`, `keyHint`, `excludeButtons`,
  `applyButton`, `extraFragment`
- Lifecycle-Automatik (Tab-/Verfahren-Sperre, Pfeiltasten-Routing,
  Aufleucht-Helfer, Replay-Sperre)
- Helfer-API: `testUI.pairIndicator.{setLabels,setPlaying}`,
  `testUI.progress.set`, `testUI.statusGrid.setEntries`,
  `testUI.field.setEnabled`, `testUI.confidence.getValue`,
  `testUI.cumulativeDisplay.set`
- Renamings vorbereiten (alte Namen `fmMode` etc. bleiben in den
  Test-Modulen, werden erst in Schritt 2 ff. mitgezogen)
- Akzeptanztest: alle vier Sub-Reiter funktionieren unverändert
  (alte API)

**Schritt 2 — Freqmatch migrieren** *(Agent)* ✅ gebaut (BA 108)

- `freqmatch.js` auf neue API umstellt
- `fmApplyMode`, `fmHandleKey`, `setPlayingIndicator`, `fmStart`/`_fmDoStart` entfallen
- `setPlayingIndicator` → `testUI.pairIndicator.setPlaying`
- `fmUpdateSliderModeAvail` → `testUI.field.setEnabled`
- Renamings: `fmMode` → `fmVerfahren`, `modeSelect` → `verfahrenSelect`,
  `fmSetMode` → `fmSetVerfahren`, `fmLoadModeFromSide` → `fmLoadVerfahrenFromSide`
- Neuer Baustein `background` eingeführt (ausklappbares Erklär-Akkordeon)
- `header.common.sliderTarget` mit `disabled: true` aufgenommen
- Akzeptanztest: adaptive und slider laufen unverändert; Pause/Resume
  funktioniert; statusGrid wird korrekt aktualisiert

**Schritt 3 — Elektrodenlautstärke migrieren** *(Bauanleitung,
neuer Sonnet-Chat)*

- `test.js` auf neue API umstellen
- `judgment`-Verfahren wird komplett entfernt (modeOptions, jdgContainer,
  jdg-Buttons, i18n-Keys `optJdg`, `bLoud`, `bEqual`, `bLoud2`)
- Laufart-Auswahl (full/conv_fast/manual) wandert in `header.extra`
  als test-spezifisches Fragment
- `manualSel` wird vom Test-Modul selbst gebaut und ins Fragment gehängt
- `pairLeft.classList.add('playing')` → Helfer
- Akzeptanztest: full und conv_fast laufen unverändert; manual-Pfad
  funktioniert; Konfidenz wird gespeichert

**Schritt 4 — Stereo-Balance migrieren** *(Bauanleitung)*

- `lr-balance.js` auf neue API umstellen
- Reihenfolge- und Seiten-Auswahl wandern in `header.extra`
- Aufleuchten der pairLeft/pairRight beim Tonabspielen (heute
  nicht implementiert, kommt mit testUI-Helfer automatisch)
- Akzeptanztest: Sequenzen werden korrekt abgespielt, Swap funktioniert,
  Konfidenz wird gespeichert

**Schritt 5 — Latenz unter das Schema bringen** *(Bauanleitung)*

- `latency.js` und `subpanel-messungen-latenz` umbauen; statisches
  HTML in `index.html` entfernen
- `latKeyHandler` entfällt (Pfeiltasten kommen über testUI)
- `latStartTest`/`latStopTest` als Hooks
- Klicktyp und Intervall in `header.extra`
- Bluetooth-Warnung in `explain.paragraphs` mit `kind: 'warn'`
- `sliderTarget: false` (Wahl ergibt keinen Sinn)
- Apply-Button als Baustein `applyButton`
- Akzeptanztest: Test startet/stoppt, Slider verändert Delay, Apply
  speichert Wert, Bluetooth-Warnung sichtbar

**Schritt 6 — Aufräumen** *(Bauanleitung)*

- Alte API in `buildTestPanel` entfernen (alte cfg-Schlüssel
  `presets`/`test`, `modeOptions`, etc.)
- Tote i18n-Keys ausräumen
- CODESTRUKTUR.md aktualisieren (test-ui.js-Beschreibung, Sub-Tab-
  Tabelle Bemerkung „nutzt buildTestPanel" gilt nun auch für latenz)
- Akzeptanztest: alle vier Sub-Reiter funktionieren mit neuer API
  allein; keine Aufrufer alter API mehr

**BA 109 — UI-Layout-Korrektur und Bug-Fixes**

Feste Body-Reihenfolge eingeführt (runningTitle → statusGrid → progress → pairIndicator → instruction → decisionButtons → actions → keyHint → slider → sliderValue → cumulativeDisplay → confirmButton → confidence → excludeButtons → applyButton → extraFragment → background → debugRun). `runningTitle` als testUI-internes Element im Lifecycle (hidden außerhalb des Tests). `verfahren-explain`-Info-Box im Header. Neuer Baustein `debugRun`. `B`-Shortcut entfällt. `onSimul` ist Nutzer-Funktion (`fmPlaySimultaneous`); `onDebugRun` steuert Debug-Simulation. Timer-Tick reaktiviert. Fortschritts-Text zeigt „Trial X von ca. Y". `explainKey`-Feld pro Verfahren als Pflichtfeld wenn `verfahren.length > 1`.

**BA 110 — Layout-Feinschliff und Bug-Fixes**

Body-Reihenfolge angepasst: `statusGrid` von Position 2 an Position 16 (direkt vor `background`) verschoben. `confidence`-Baustein aus neuer API entfernt (Render-Block, `testUI.confidence`-Helfer); alte API behält ihn vorerst. Pfeiltasten-Mapping: `Z`→`Backspace` für Undo; `B` wieder als Simul-Shortcut (Nutzer-Funktion „beide Töne gleichzeitig"). Header-Selects bekommen Auto-Blur nach `change`. Trial-Text-Render-Bug in `fmUpdateAdaptiveProgress` behoben (nutzt jetzt `testUI.progress.set`). AB/ABA-Flag wird im adaptiven Trial-Play-Pfad respektiert (dritter Ton bei ABA). `fmCfg.verfahren`: Slider zuerst, Adaptive zweit; Default-Verfahren in `fmLoadVerfahrenFromSide` auf Slider solange keine adaptiven Läufe. `fmSliderEstimateDlg` aus BA 102 bleibt unverändert aktiv.

**BA 111 — Slider-Verfahren: vollständiger testUI-Ausbau**

Body-Reihenfolge angepasst: `actions` (Zurück/Nochmal/Gleichzeitig) von Position 7 an Position 15 (nach `extraFragment`, vor `statusGrid`) verschoben; `keyHint` bleibt auf Position 7 (direkt vor `slider`). `slider`-Baustein baut jetzt die „− / Fein / +"-Touch-Buttons automatisch über `buildSliderTouchCtrl` (Optionen `touchStep`, `touchFineStep`); LS-Hint-Element nur noch bei `unit: 'dB'`. Slider-Verfahren-Body ergänzt um `instruction`, `statusGrid`, `background`, `debugRun`. `onReplay`-Hook in beiden Verfahren auf `fmPlayCurrent` korrigiert (war `fmReplayCurrent`, das im Slider-Modus sofort abbrach); `fmReplayCurrent` entfernt. Neuer generischer Timer-Helfer `_fmActiveProgress()` — Timer-Tick wählt je nach laufendem Verfahren den richtigen Progress-Ref. Neue Funktionen in `freqmatch.js`: `fmUpdateSliderProgress`, `fmRenderSliderStatusGrid`, `fmRunSliderDebugSim`, `_fmActiveProgress`. Manueller `buildSliderTouchCtrl`-Aufruf in `freqmatch.js` entfernt. Token-pairIndicator im Slider-Modus überschreibt Labels nicht mehr mit Hz-Text. BA 112 (Tonseitenabfrage-Generalisierung + Adaptive-Start-Check) folgt.

## Verwandte Dokumente

- [02-messung.md](02-messung.md) — funktionale Spezifikation der
  einzelnen Tests
- [02b-freqmatch-adaptiv.md](02b-freqmatch-adaptiv.md) —
  Methodik des adaptiven Verfahrens
- [IDEEN.md](../IDEEN.md), Eintrag „Frequenzabgleich — Slider-Wirkung
  als funktionale Erweiterung" — geplante Erweiterung, die den
  heute statisch deaktivierten `sliderTarget` aktiviert
- `CLAUDE.md`, Abschnitt EFFIZIENTER UMGANG MIT DEM PRO-ABO,
  Ausnahme-Regel für Agent-Orchestrierung bei komplexen Refactorings
