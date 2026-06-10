# Bauanleitung — testUI-Migration Schritt 2: Frequenzabgleich

**Vorgänger:** Schritt 1 (BA 107) — neue testUI-API ist in `js/test-ui.js`
parallel zur alten implementiert. Erkennung per cfg-Form:
neu hat `header`/`verfahren`, alt hat `presets`/`test`. Bausteine-Katalog,
Lifecycle-Automatik, Helfer-API (`testUI.{pairIndicator,progress,statusGrid,
field,confidence,cumulativeDisplay}`) sind verfügbar.

**Du baust:** Schritt 2 — `js/freqmatch.js` auf die neue API umstellen,
zusammen mit einer kleinen Erweiterung der testUI um einen neuen Baustein
`background` (Erklärungs-Akkordeon pro Verfahren). Alle anderen Sub-Reiter
bleiben unangetastet.

---

## Pflichtlektüre vor dem Bau

1. `CLAUDE.md` (Projekt-Root) — Abschnitte ARBEITSWEISE, NOTAUSGANG-PRINZIP,
   AKTIVE RÜCKFRAGEN.
2. `docs/BAUANLEITUNGEN_LEITLINIEN.md` — Akzeptanztest, Selbstprüfung,
   Versionsnummer, i18n-Regel (nur Deutsch in dieser Anleitung).
3. `docs/spec/00-testui-architektur.md` — vollständig. Insbesondere
   Bausteine-Katalog, Lifecycle-Automatik, drei Deaktivierungs-Mechanismen,
   Notausgang-Prinzip.
4. `js/test-ui.js` — die neue API (`_buildTestPanelNew` ab Z. 651,
   testUI-Helfer ab Z. 1489). Den alten Code-Teil
   (`_buildTestPanelOld` Z. 72–649) **nicht** anfassen.
5. `js/freqmatch.js` — gezielt, **nicht** komplett. Kritische Stellen:
   - Globale `fmMode`-Deklaration (Z. 10)
   - `setPlayingIndicator` (Z. 477) und alle Aufrufer (Z. 472, 832–850, 1170)
   - `fmApplyMode` (Z. 1675–1698)
   - `fmUpdateSliderModeAvail` (Z. 1700–1713)
   - `fmSetMode` (Z. 1718–1752)
   - `fmLoadModeFromSide` (Z. 1754–1765)
   - `fmCfg`-Objekt und `buildTestPanel`-Aufruf (Z. 1770–1825)
   - `modeSelect`-Verdrahtung und alle `fmEls.modeSelect`-Stellen
     (grep liefert: Z. 725, 1182, 1389, 1495, 1510, 1525, 1751, 1828–1830)
   - Akkordeon-Bau (Z. 1918–1940 ungefähr) — nur zum Verstehen, wird in
     den neuen Baustein überführt.

---

## Scope von Schritt 2

**Migration (Pflicht):**
- `freqmatch.js`: gesamtes UI-Bauen auf die neue API umstellen (cfg-Schema
  mit `header`/`verfahren`).
- `fmApplyMode` entfällt vollständig — alle UI-Sichtbarkeit von testUI geregelt.
- `setPlayingIndicator` entfällt — alle Aufrufer auf
  `testUI.pairIndicator.setPlaying(<refs>, …)` umstellen.
- `fmUpdateSliderModeAvail` — bleibt als Funktion, aber Implementierung
  ruft jetzt `testUI.field.setEnabled(fmEls, 'verfahrenSelect.slider', …)`
  statt direkt am DOM zu drehen.
- Renamings (siehe Abschnitt „Renamings" unten).
- `header.common.sliderTarget` als statisch deaktiviert aufnehmen
  (`disabled: true`, `hintKey: 'fmSliderTargetDisabledHint'` — der i18n-Key
  ist neu, siehe i18n-Abschnitt).

**testUI-Erweiterung (Pflicht für diesen Schritt):**
- Neuer Baustein `background` (siehe „Teil A" unten).

**UX-Fix (Pflicht):**
- Das „Tonfolge"-Dropdown (ABA/AB) bleibt im adaptiven Modus **sichtbar**.
  Heute wird es in `fmApplyMode` per `style.display='none'` weggeblendet,
  obwohl der adaptive Code `globalSequence` tatsächlich liest (Z. 141).
  Mit der neuen API steht `sequence` im `header.common` — gemeinsam für
  beide Verfahren, ohne Sonder-Logik.

**Nicht in diesem Schritt:**
- Andere Sub-Reiter (test, balance, latenz) — nicht anfassen.
- Alte API in `test-ui.js` entfernen — kommt in Schritt 6.
- Englisch/Französisch/Spanisch für neue i18n-Keys — nur Deutsch
  (Leitlinien-Regel).
- `setPlayingIndicator` global entfernen, wenn sie noch von Außen
  aufgerufen wird — **vor dem Entfernen** mit grep prüfen, ob alle
  Aufrufer migriert sind. Sind es nur Aufrufer in `freqmatch.js`?
  Wenn ja: ersatzlos streichen. Wenn nein: in der Selbstprüfung als
  Rückfrage melden.

---

## Teil A — testUI um Baustein `background` erweitern

**Was:** Ein ausklappbarer Erklärungsblock am Ende eines Verfahren-Bodies
(`<details>` mit `<summary>` und Body). Inhalt aus zwei i18n-Keys.
Heute manuell in `freqmatch.js` (Z. 1918–1940) gebaut, soll künftig
deklarativ in der cfg stehen.

**Spec-Datei aktualisieren** — `docs/spec/00-testui-architektur.md`,
Bausteine-Katalog-Tabelle (Z. 194 ff.) um eine Zeile ergänzen:

```
| `background` | Ausklappbares Erklär-Akkordeon am Ende des Verfahren-Bodies | `titleKey`: i18n; `bodyKey`: i18n; `bodyAsHtml`: bool (Default false) | — |
```

**cfg-Eintrag (im Verfahren-Body):**

```js
background: {
  titleKey:  'fmExplainAdaptiveScienceTitle',
  bodyKey:   'fmExplainAdaptiveScience',
  bodyAsHtml: true
}
```

**Render-Logik in `_buildTestPanelNew` (in `js/test-ui.js`):**
Am Ende des Bodies (nach allen anderen Bausteinen, also nach dem
`extraFragment`-Slot bzw. analog ans Body-Ende anhängen):

```js
if (body.background) {
  var bg = body.background;
  var bgDetails = _mkEl('details', 'test-background');
  var bgSum = _mkEl('summary');
  bgSum.dataset.t = bg.titleKey;
  var bgBody = _mkEl('div', 'test-background-body');
  bgBody.dataset.t = bg.bodyKey;
  if (bg.bodyAsHtml) bgBody.dataset.bgHtml = '1';
  bgDetails.append(bgSum, bgBody);
  verfahrenBody.appendChild(bgDetails);
  bodyRefs.background = { details: bgDetails, summary: bgSum, body: bgBody };
}
```

**applyLang muss `data-bg-html='1'` respektieren:** Das `_applyLangSubtree`
(in test-ui.js) setzt heute Textinhalt per `textContent`. Für Elemente mit
`data-bg-html='1'` ist `innerHTML` zu verwenden. **Erweitere die bestehende
`_applyLangSubtree`-Funktion** entsprechend — kein zweiter Helfer.

Globale `applyLang()` (in `js/i18n.js`) wird beim Sprachwechsel aufgerufen
und greift auf alle `[data-t]` zu. Prüfe, ob `applyLang` selbst auch das
`data-bg-html`-Flag respektiert. Falls nicht: in `applyLang` ergänzen —
das ist eine kleine, eng begrenzte Änderung an `js/i18n.js`. Wenn dir das
nicht eindeutig klar ist, in der Selbstprüfung als Rückfrage melden statt
zu raten.

**CSS in `style.css`** — die heutigen Inline-Styles aus
`freqmatch.js` Z. 1921–1937 in zwei Klassen überführen:

```css
.test-background {
  margin-top: 1.5em;
  padding: 0.5em 0.8em;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #f9fafb;
}
.test-background > summary {
  cursor: pointer;
  font-weight: 600;
  color: #374151;
}
.test-background-body {
  margin-top: 0.8em;
  font-size: 0.92em;
  line-height: 1.5;
  color: #374151;
}
```

Sinnvoller Ort: ans Ende des Test-UI-Style-Blocks in `style.css`
(in der Nähe von `.test-box`/`.test-instruction`).

---

## Teil B — Migration `freqmatch.js`

### B.1 — Neue cfg-Struktur

Das alte `fmCfg`-Objekt (`presets`/`test`) komplett durch das neue Schema
ersetzen:

```js
const fmCfg = {
  id: 'freqmatch',
  explain: {
    titleKey: 'fmTitle',
    paragraphs: [
      { key: 'fmHintMethod', kind: 'plain' },
      { key: 'fmPrereqHint', kind: 'plain' },
      { key: 'fmHintWarn',   kind: 'warn'  }
      // weitere heute existierende Paragraphen ergänzen, falls vorhanden
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
        options:  ['ref','var','balance'],
        default:  'ref',
        disabled: true,
        hintKey:  'fmSliderTargetDisabledHint'
      }
    },
    startStop: { startKey: 'fmLblStart', resumable: true }
  },
  verfahren: [
    {
      id: 'adaptive',
      labelKey: 'fmModeAdaptive',
      body: {
        pairIndicator:   { variant: 'token', leftKey: 'fmTone1', rightKey: 'fmTone2' },
        progress:        { format: 'simple' },
        instruction:     { key: 'hjPrompt' },
        decisionButtons: { variant: 'updown' },
        statusGrid:      { show: true },
        actions:         ['undo','replay','simul'],
        background: {
          titleKey:  'fmExplainAdaptiveScienceTitle',
          bodyKey:   'fmExplainAdaptiveScience',
          bodyAsHtml: true
        }
      },
      hooks: {
        onStart:    fmStartAdaptive,
        onStop:     fmAbort,
        onDecision: fmHandleHeight,
        onReplay:   fmReplayCurrent,
        onUndo:     fmUndoAdaptive,
        onSimul:    fmRunDebugSim
      }
    },
    {
      id: 'slider',
      labelKey: 'fmModeSlider',
      body: {
        pairIndicator: { variant: 'token', leftKey: 'fmTone1', rightKey: 'fmTone2' },
        progress:      { format: 'simple' },
        slider:        { unit: 'cent', ranges: [100, 500, 1200] },
        sliderValue:   { show: true },
        keyHint:       { unitKey: 'sliderHintCent' },
        confirmButton: { key: 'btnConfirmOffset' },
        confidence:    { show: true },
        actions:       ['undo','replay','simul']
      },
      hooks: {
        onStart:   fmStartSlider,     // falls die Funktion einen anderen Namen hat: an dieser Stelle korrigieren
        onStop:    fmAbort,
        onSlide:   fmSliderChange,    // an heutigen Funktionsnamen anpassen, falls abweichend
        onConfirm: fmConfirm,
        onReplay:  fmReplayCurrent,
        onUndo:    fmUndo,
        onSimul:   null
      }
    }
  ]
};

fmEls = buildTestPanel(parentEl, fmCfg);
```

**Wichtig**: Heutige Hook-Funktionsnamen (`fmStartSlider`, `fmSliderChange`)
verifizieren — falls die Funktion heute anders heißt (z.B. `fmStart` ohne
Adaptiv/Slider-Suffix, weil heute `fmApplyMode` intern dispatcht), in der
Selbstprüfung markieren und vor dem Bau klären. Notfalls einen kleinen
Wrapper definieren statt den heutigen Code umzubenennen.

### B.2 — Refs-Zugriff anpassen

Nach `fmEls = buildTestPanel(...)` ist die Refs-Struktur jetzt:
- `fmEls.header.<feldname>` für Voreinstellungen (z.B. `fmEls.header.refSelect`,
  `fmEls.header.volInput`, `fmEls.header.durInput`, `fmEls.header.pauseInput`,
  `fmEls.header.seqSelect`, `fmEls.header.toneSelect`, `fmEls.header.verfahrenSelect`,
  `fmEls.header.startBtn`, `fmEls.header.stopBtn`, `fmEls.header.lockedHint`)
- `fmEls.verfahren.adaptive.<baustein>` für adaptive-spezifische Refs
- `fmEls.verfahren.slider.<baustein>` für slider-spezifische Refs

Alle bestehenden direkten Zugriffe (`fmEls.refSelect`, `fmEls.modeSelect`,
`fmEls.durInput`, `fmEls.hjContainer`, `fmEls.slider`, `fmEls.sliderValue`,
`fmEls.confirmBtn`, `fmEls.statusGrid` usw.) auf das neue Schema umstellen.

**Mechanisch vorgehen:** ein grep pro Eigenschaftsname, jede Fundstelle
gezielt anpassen. Nicht raten, welche Variante gemeint ist — Adaptive- und
Slider-Refs sind getrennt.

### B.3 — `setPlayingIndicator` durch testUI-Helfer ersetzen

**Vorher (Z. 477–495 ungefähr):**

```js
function setPlayingIndicator(which) { /* eigene DOM-Manipulation */ }
```

**Nachher:** Funktion ersatzlos entfernen. Aufrufer-Stellen so umstellen:

```js
// vorher: setPlayingIndicator('left');
// nachher (im adaptiven Pfad):
testUI.pairIndicator.setPlaying(fmEls.verfahren.adaptive.pairIndicator, 'left');
```

Für den Slider-Pfad analog:
`testUI.pairIndicator.setPlaying(fmEls.verfahren.slider.pairIndicator, …)`.

Anhand der heutigen Aufruf-Kontexte feststellen, welcher Verfahren-Body
gerade aktiv ist. Falls die Funktion historisch generisch über `fmMode`
dispatcht: dasselbe in den neuen Aufrufern beibehalten (kleine Helfer-
Funktion `_fmPairRefs()` lokal in freqmatch.js, gibt die aktuelle
pairIndicator-Refs basierend auf `fmVerfahren` zurück).

### B.4 — `fmApplyMode` entfernen

Die Funktion vollständig löschen. Alle Aufrufer (heute mindestens
`fmSetVerfahren` und ggf. an Initialisierungsstellen) entfernen.

Warum geht das weg: alle Sichtbarkeiten, die `fmApplyMode` heute setzt,
ergeben sich automatisch:
- `slider`, `sliderValue`, `confirmBtn`, `keyHintBox`, `confidence-row`,
  `extendBtn`: gehören zum Slider-Body — werden vom testUI nur gerendert,
  wenn das Slider-Verfahren aktiv ist.
- `hjContainer` (= `decisionButtons`), `statusGrid`: gehören zum
  Adaptiv-Body — analog.
- `seqSelect`: bleibt **sichtbar** in beiden Modi (UX-Fix, siehe Scope).
- `fmScienceAccordion`: wird zum neuen Baustein `background` im
  Adaptiv-Body.

### B.5 — `fmUpdateSliderModeAvail` umstellen

**Vorher:**

```js
function fmUpdateSliderModeAvail() {
  if (!fmEls || !fmEls.modeSelect) return;
  const sd = sideData[fmVarSide] || {};
  const fa = sd.freqmatchAdaptive;
  const hasRuns = !!(fa && Array.isArray(fa.runs) && fa.runs.length > 0);
  Array.from(fmEls.modeSelect.options).forEach(function(opt) {
    if (opt.value === 'slider') opt.disabled = hasRuns;
  });
  if (hasRuns && fmMode === 'slider' && !fmRunning) {
    fmSetMode('adaptive', { force: true });
  }
}
```

**Nachher:**

```js
function fmUpdateSliderModeAvail() {
  if (!fmEls) return;
  const sd = sideData[fmVarSide] || {};
  const fa = sd.freqmatchAdaptive;
  const hasRuns = !!(fa && Array.isArray(fa.runs) && fa.runs.length > 0);
  testUI.field.setEnabled(fmEls, 'verfahrenSelect.slider', !hasRuns,
                          { reason: 'fmAdaptiveExists' });
  if (hasRuns && fmVerfahren === 'slider' && !fmRunning) {
    fmSetVerfahren('adaptive', { force: true });
  }
}
```

### B.6 — Start/Stop-Verdrahtung

Heute verdrahtet `freqmatch.js` selbst Start- und Stop-Listener,
inklusive Tab-Sperre, Modus-Dropdown-Sperre, lockedHint-Sichtbarkeit etc.

Mit der neuen API übernimmt das die testUI Lifecycle-Automatik. Das
freqmatch-Modul **darf** Start/Stop nicht mehr selbst verdrahten — es
liefert ausschließlich die Hooks `onStart`/`onStop` im cfg. Wenn die
testUI startet, ruft sie `onStart(refs)` auf; bei Stop `onStop(refs)`.

Die Heute-Aufrufe wie `if (fmEls.modeSelect) fmEls.modeSelect.disabled = true`
müssen alle entfernt werden — Lifecycle-Automatik macht das.

**Eine Ausnahme**: Wenn `fmStart` heute Vorab-Logik vor dem tatsächlichen
Test-Start hat (Kopfhörer-Check, Slider-Empfehlung), gehört diese Logik
weiterhin in den `onStart`-Hook. Das testUI startet nicht von selbst, es
ruft nur den Hook auf. Heißt: `onStart` darf die Tab-Sperre nicht selbst
setzen (das tut testUI), darf aber Modals zeigen, Audio-Setup machen etc.

**Achtung:** Heute prüft `fmStart` selbst, ob ein Kopfhörer-Check kommt
oder ein Empfehlungs-Dialog. Wenn `onStart` aus testUI-Sicht „der Test
beginnt jetzt" bedeutet, aber freqmatch erst noch einen Modal-Dialog
zeigt, ergibt sich eine inhaltliche Schieflage (Tab-Sperre aktiv, aber
kein Test läuft). Lösung: testUI bekommt eine Helfer-Methode
`testUI.deferStart(refs)` und `testUI.confirmStart(refs)`/`testUI.cancelStart(refs)`?
**Nein — zu groß für diesen Schritt.** Stattdessen: der Hook
`onStart` löst die Vorab-Dialoge aus, ruft aber direkt `testUI.startNow()`
oder `testUI.cancelStart()` zurück. Wenn das in der heutigen Architektur
nicht sauber geht, **vor dem Bau Rückfrage melden** statt zu improvisieren.

**Konkreter Vorschlag zur Klärung:** Lies in `_buildTestPanelNew` und
testUI-Lifecycle nach, wie das heute verdrahtet ist (Schritt-1-Code).
Falls testUI bereits einen „Start abbrechen vor Test-Beginn"-Pfad hat
(via `onStart`-Rückgabewert `false`?), nutze den. Wenn nicht: Rückfrage
melden und einen kleinen Erweiterungs-Vorschlag mitliefern, statt das
ganze Locking-Verhalten freqmatch-seitig zu duplizieren.

### B.7 — Renamings

Im **freqmatch.js**:
- Globale Variable: `let fmMode = 'adaptive'` → `let fmVerfahren = 'adaptive'`
- Funktion: `fmSetMode(...)` → `fmSetVerfahren(...)`
- `sideData[<side>].fmMode` → `sideData[<side>].fmVerfahren`
  — **Aber**: das berührt persistierte Daten. Migrationspfad: beim Laden
  alten `fmMode` weiter akzeptieren und nach `fmVerfahren` schreiben.
  Heutige Lade-Stelle: `fmLoadModeFromSide` (Z. 1754). Dort eine kleine
  Fallback-Logik:
  ```js
  const saved = (sd.fmVerfahren === 'slider' || sd.fmVerfahren === 'adaptive')
    ? sd.fmVerfahren
    : ((sd.fmMode === 'slider' || sd.fmMode === 'adaptive') ? sd.fmMode : 'adaptive');
  ```
- Funktion: `fmLoadModeFromSide` → `fmLoadVerfahrenFromSide`. Aufrufer
  (Z. 1972, 2010) anpassen.
- Refs: `fmEls.modeSelect` → `fmEls.header.verfahrenSelect`. **Aber**:
  in der neuen API liefert testUI das Dropdown direkt unter
  `fmEls.header.verfahrenSelect` (nur wenn `verfahren.length > 1`,
  was hier zutrifft).

In der **Spec** und in **CODESTRUKTUR.md** stehen Stellen mit „Modus" und
„fmMode" — diese in Schritt 2 anpassen, soweit sie freqmatch betreffen.
Andere Sub-Reiter bleiben sprachlich unverändert, weil sie ihre eigenen
Begriffe haben.

### B.8 — `fmScienceAccordion`-Block in freqmatch.js entfernen

Die heutige manuelle Bau-Stelle (`document.createElement('details')` etc.,
Z. 1918–1940 ungefähr) ersatzlos löschen — wird durch den
`background`-Baustein im cfg ersetzt.

Aufrufer auf `document.getElementById('fmScienceAccordion')`: gibt es nur
in `fmApplyMode` (Z. 1695 — fällt mit `fmApplyMode` weg). Falls darüber
hinaus Stellen existieren: grep'en und prüfen.

---

## i18n

**Neue deutsche Keys** in `i18n/de.js` ergänzen:

- `fmSliderTargetDisabledHint` — kurzer Hinweis-Text neben dem deaktivierten
  Sliderwirkung-Feld. Vorschlag: `"Sliderwirkung wird in eigener Erweiterung
  aktiviert."` (Wenn du einen besseren Text findest, gerne — kurz halten.)

**Vorhandene Keys, die du brauchst** (keine Änderung nötig — nur zur
Sicherheit checken, dass sie da sind):
- `fmTitle`, `fmHintMethod`, `fmPrereqHint`, `fmHintWarn`
- `fmLblRef`, `fmLblStart`
- `fmTone1`, `fmTone2`
- `fmModeAdaptive`, `fmModeSlider`
- `hjPrompt`, `sliderHintCent`, `btnConfirmOffset`
- `fmExplainAdaptiveScienceTitle`, `fmExplainAdaptiveScience`

**Englisch/Französisch/Spanisch nicht anfassen** (Leitlinien-Regel).

---

## Pflicht-Schritte am Ende

1. **`js/version.js`**: `APP_VERSION` von `"3.0.107-beta"` auf
   `"3.0.108-beta"` hochzählen.
2. **`docs/CODESTRUKTUR.md`**: den freqmatch-Eintrag (Z. 143) so anpassen,
   dass die Migration sichtbar wird. Mindestens: Vermerk „**Seit BA 108**:
   auf neue testUI-API umgestellt; `fmApplyMode`, `setPlayingIndicator`
   entfallen; `fmMode` → `fmVerfahren`; Erklär-Akkordeon kommt jetzt aus
   dem testUI-Baustein `background`." — knapp halten.
   Außerdem den test-ui.js-Eintrag um den neuen Baustein `background`
   ergänzen.
3. **`docs/spec/00-testui-architektur.md`**: Im Migrationsplan Schritt 2
   als gebaut markieren (analog zu Schritt 1). Bausteine-Katalog um
   `background` ergänzen (siehe Teil A).

---

## Akzeptanztest (für den Nutzer)

Klick-für-Klick, mit erwartetem Verhalten:

1. **Reload, Frequenzabgleich-Sub-Reiter öffnen** → erwartet:
   GUI vollständig sichtbar, keine Konsolen-Fehler. Erklärungs-Block oben,
   Voreinstellungen mittig, Verfahren-Dropdown („Adaptiv"/„Slider"),
   Sliderwirkung-Feld sichtbar aber deaktiviert mit Hinweistext daneben.
2. **Verfahren-Wechsel auf Slider** → erwartet: Slider, Pfeiltasten-Hinweis,
   Konfidenz-Radios, Bestätigen-Button erscheinen. Adaptiv-spezifische
   Elemente (Status-Tabelle, „höher/tiefer"-Buttons, Akkordeon) sind weg.
3. **Verfahren-Wechsel zurück auf Adaptiv** → erwartet: Status-Tabelle und
   Akkordeon „Wissenschaftliche Grundlage und Grenzen" wieder da. Akkordeon
   ausklappbar.
4. **Tonfolge-Dropdown** ist in beiden Modi sichtbar und nutzbar.
5. **Adaptiver Lauf**: Test starten → erwartet: Tab-Sperre aktiv,
   Verfahren-Dropdown deaktiviert. Zwei Trials durchklicken,
   Ton-1/Ton-2-Boxen leuchten auf wie vorher. Antworten werden gewertet.
6. **Pausieren** → erwartet: Tab-Sperre auf. Erneut starten → Lauf wird
   fortgesetzt (Resume).
7. **Bei vorhandenem adaptivem Lauf**: Verfahren-Dropdown zeigt
   „Slider"-Option als deaktiviert.
8. **Status-Tabelle (statusGrid)** während Adaptiv-Lauf: Einträge werden
   wie vorher aktualisiert.
9. **Slider-Lauf**: Pfeiltasten ← → verschieben den Slider, Shift = Fein-Schritt.
   Bestätigen speichert die Schätzung.
10. **Andere Sub-Reiter** (Elektrodenlautstärke, Stereo-Balance, Latenz):
    unverändert funktionsfähig.
11. **Sprachwechsel** (z.B. auf Englisch): alle Beschriftungen wechseln,
    Akkordeon-Titel und -Inhalt werden korrekt übersetzt.
12. **Konsole**: `typeof fmVerfahren` → `"string"`. `typeof fmMode` → `"undefined"`.

---

## Selbstprüfungs-Auftrag (vor der Fertig-Meldung)

Gehe jeden Punkt einzeln durch und vermerke **erfüllt** / **nicht erfüllt**
/ **unklar**, jeweils mit Datei- und Zeilenangabe:

1. `fmCfg` nutzt das neue Schema (`header`/`verfahren`), kein `presets`/`test`.
2. `buildTestPanel`-Aufruf erkennt automatisch die neue API.
3. Refs werden konsistent über `fmEls.header.<feld>` und
   `fmEls.verfahren.<id>.<baustein>` zugegriffen — keine alten direkten
   Zugriffe (`fmEls.modeSelect`, `fmEls.hjContainer`, `fmEls.statusGrid`,
   `fmEls.refSelect` etc.).
4. `fmApplyMode` ist vollständig entfernt, kein Aufruf mehr im Code.
5. `setPlayingIndicator` ist entfernt, alle Aufrufer migriert.
6. `fmUpdateSliderModeAvail` nutzt `testUI.field.setEnabled`.
7. `fmMode` → `fmVerfahren`, `fmSetMode` → `fmSetVerfahren` in allen
   Vorkommen. Persistierter `sd.fmMode` wird beim Laden als Fallback
   akzeptiert.
8. `fmScienceAccordion` ist nicht mehr in `freqmatch.js` gebaut; statt
   dessen kommt der Block aus dem `background`-Baustein im
   Adaptiv-Verfahren.
9. Neuer Baustein `background` ist in `js/test-ui.js` (`_buildTestPanelNew`)
   implementiert; CSS-Klassen `.test-background` und
   `.test-background-body` sind in `style.css`.
10. `applyLang` (in `js/i18n.js`) und/oder `_applyLangSubtree` (in
    `js/test-ui.js`) respektieren `data-bg-html='1'` und setzen
    `innerHTML` statt `textContent`.
11. Spec-Datei `docs/spec/00-testui-architektur.md` ist um den
    `background`-Baustein erweitert; Migrationsplan-Schritt 2 ist als
    gebaut markiert.
12. `docs/CODESTRUKTUR.md`: freqmatch- und test-ui.js-Einträge aktualisiert.
13. `APP_VERSION` ist hochgezählt.
14. Tonfolge-Dropdown ist im adaptiven Modus sichtbar.
15. Lifecycle-Verdrahtung (Start/Stop, Tab-Sperre, Modus-Dropdown-Sperre)
    läuft komplett über testUI, nicht mehr per direkter DOM-Manipulation
    aus freqmatch.

Bei „unklar"-Markierungen **nicht raten** — als Rückfrage zurückmelden.

---

## Notausgang-Prinzip — verbindlich

Wenn dir beim Bau ein Verhalten begegnet, das mit der vorhandenen
testUI-API + dem neuen `background`-Baustein nicht abbildbar ist:

- **Nicht workaroundend bauen** (kein direktes `style.display`-Setzen aus
  freqmatch, keine eigenen Keyboard-Listener, kein Bypass der
  Lifecycle-Automatik).
- **Vor dem Build den Punkt melden** mit: Beschreibung des Falls,
  betroffene Code-Stelle, Vorschlag (neuer Baustein? Hook-Erweiterung?
  Verhaltens-Anpassung?). Der User entscheidet.
- Ausnahme: Code, der eindeutig zur freqmatch-Mechanik gehört und nichts
  mit der UI-Bau-Schicht zu tun hat (Audio-Setup, Datenstrukturen,
  Persistenz-Logik) — der bleibt wie er ist.

---

## Hinweis am Ende

Englisch/Französisch/Spanisch für den neuen i18n-Key
`fmSliderTargetDisabledHint` werden in einer eigenen kleinen Anleitung
nachgezogen, sobald die deutsche GUI-Vorlage steht. Nicht in diesem
Build.
