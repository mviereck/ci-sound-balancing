# CI Sound Balancing Tool – Codestruktur

Eine HTML-Datei lädt 15 JavaScript-Module in fester Reihenfolge.
Kein Framework, kein Build-Schritt, alle Variablen im globalen
Scope.

## Tabs und ihre Module

Anfragen kommen meist tab-orientiert. Diese Tabelle zeigt, wo der
Code des jeweiligen Tabs liegt.

| Tab-Beschriftung (DE) | data-tab ID | Hauptmodul(e) |
|---|---|---|
| Einführung | intro | nur HTML, keine JS-Logik |
| Implantat | setup | ui-implant.js, freq-table.js |
| Messung | test | test.js |
| Meßergebnisse | results | results.js, chart.js |
| Levels | levels | levels.js |
| Player | player | player.js |
| Stereo-Balance | balance | lr-balance.js |
| Frequenzabgleich | freqmatch (Sub-Tab unter messungen) | freqmatch.js |
| Laden/Speichern | file | file.js |

Zentrale Verdrahtung aller Tabs (Tab-Wechsel, Tab-Sperre während
Test): tabs-eq.js (switchTab, updateTabLockState).

## Module im Ladeverlauf

Die Reihenfolge der `<script>`-Tags in `index.html` ist fest.
Module weiter unten dürfen Funktionen aus Modulen weiter oben
aufrufen. Top-Level-Code in einem Modul (außerhalb von Funktionen
und außerhalb DOMContentLoaded) braucht seine Abhängigkeiten beim
Laden – normale Funktionsaufrufe erst zur Laufzeit.

| # | Datei | Inhalt |
|---|---|---|
| 1 | i18n.js | Übersetzungsobjekt L (de/en/fr/es), lang, t(), applyLang(), updateMfrSelectLabels(), updateRunExplain() |
| 2 | core.js | IMPLANTS, PROCESSORS, MFR, SIDES, PR_*-Konstanten, SII_THIRD_OCT, calc*-Funktionen, siiWeightsForFreqs |
| 3 | state-side.js | Globaler State (sideData, activeSide, mfr, nEl, freqs, presets...), Side-Logik, dEN, effFreq. fRes (Frequenzabgleich). Top-Level-Init am Dateiende. |
| 4 | audio.js | AudioContext, playTone, playSweep, playSeq, playFreqPair, gAC, dB2G, corrG, updInd |
| 5 | ui-implant.js | buildImplantCard, updCochlearGen |
| 6 | freq-table.js | buildFreqTable, switchMfr, resetFreqs, actEl, allEl, allPairs, shuffle, randAB, gWt |
| 7 | test.js | ROUND_ROBIN-Tabelle, compWLS, startTest, alle Test-Sub-Funktionen |
| 8 | freqmatch.js | Frequenzabgleich-Test (Sub-Tab "freqmatch"). fmStart, fmConfirm, fmSkip, fmAbort, fmApplyLang, fmPlayCurrent. Eigener DOMContentLoaded-Handler. |
| 9 | results.js | renderResults, renderFreqMatchResults |
| 10 | chart.js | drawChart (für Meßergebnisse), drawFreqMatchChart, _fmcTooltipHandler |
| 11 | file.js | saveJson, loadJson, applyLoadedData, resetAll, expText, copyRes, exportEasyEffects |
| 12 | tabs-eq.js | switchTab, updateTabLockState, updPlSrcButtons, updEqToggleBtn, updBalApplyBtn |
| 13 | levels.js | calcPresetCurve, getTotalPresetCurve, getEffectiveLevels, buildLvGrid, buildPrTbl, drawLvChart, lvOnChange |
| 14 | player.js | Player-State, gPC, pBuildEQ, pUpdEQ, pPlay, pDrawEQ + eigene Top-Level-Listener für plAudio/plPlay/plStop/plTL und window.resize |
| 15 | freq-warp.js | Offline-Frequenz-Warping. buildWarpPoints, centShift, pComputeWarpedBuffer, pWarpTrigger, pWarpUpdUI. State: pWarpedBuf, pWarpOn, pWarpMode, pWarpStrength, pWarpBusy |
| 16 | lr-balance.js | Stereo-Balance-Tab. Eigener DOMContentLoaded-Handler und eigener Tab-Hook für 'balance'. |
| 17 | init.js | Der große DOMContentLoaded-Handler mit applyLang(), buildImplantCard(), allen Event-Verdrahtungen, Autosave-Setup |

## Datenfluss (nicht aus Namen ablesbar)

**Globaler State** liegt komplett in `state-side.js`. Wer auf
`sideData`, `activeSide`, `mfr`, `nEl`, `freqs`, `manualLevels`,
`presets`, `bRes`, `lvFocus`, Audio-State-Variablen oder
Test-State-Variablen zugreift, findet die Deklaration dort.

**Preset-Berechnung** (`calcPresetCurve`, `getTotalPresetCurve`,
`getEffectiveLevels`) liegt in `levels.js`, nicht im Player oder
Audio. Sie wird auch von `renderResults` (results.js), vom Player
(player.js) und von `expText` (file.js) aufgerufen.

**Levels → Player Live-Update:** `lvOnChange` in levels.js ruft
am Ende `pUpdEQ()` aus player.js auf. Dadurch aktualisiert sich
der Player-Equalizer sofort, wenn manuelle Levels oder Presets
geändert werden.

**applyLang ruft modulübergreifend:** `updEqToggleBtn`,
`updBalApplyBtn` (beide tabs-eq.js), `updSideButtons` (state-side.js),
`updateRunExplain` (i18n.js), `buildFreqTable` (freq-table.js),
`buildImplantCard` (ui-implant.js), `renderResults` (results.js),
`renderFreqMatchResults` (results.js, nur wenn freqmatch-Sub-Tab aktiv).

**DOM-Listener nicht nur in init.js:** Player und LR-Balance haben
eigene Top-Level-Listener bzw. eigene DOMContentLoaded-Handler in
ihren Modulen. init.js ist die zentrale Verdrahtung, aber nicht
die einzige.

**Top-Level-Init am Ende von state-side.js:** Die Aufrufe
`initSideData("left", "medel")`, `initSideData("right", "medel")`,
`bindActiveSide()`, `updateMfrSelectLabels()` laufen beim Laden des
Moduls. Sie brauchen i18n und core, deshalb lädt state-side als
dritte Datei.

**Hersteller-Vergleiche verteilt:** `mfr === "medel"` /
`mfr === "ab"` / `mfr === "cochlear"` taucht in mehreren Modulen
auf, vor allem freq-table.js, ui-implant.js, core.js, levels.js.
Bei Hersteller-spezifischer Logik immer alle drei Module prüfen.

**i18n L-Objekt** ist ~1100 Zeilen – größte Datei. Code-Anteil
davon ist klein. Bei reinen Textänderungen reicht es, i18n.js zu
lesen.

**Historisches Relikt:** Der Tab mit `data-tab="setup"` wird mit
dem i18n-Key `tabFreq` ("Implantat") beschriftet. Setup war der
alte Name, Implantat ist der aktuelle UI-Text. Wer nach „Frequenzen“
sucht, findet im aktuellen Build nichts mit diesem Namen.

## Edit-Szenarien

### Reine Textänderung (Übersetzung)
- i18n.js: betroffene Schlüssel im L-Objekt aller 4 Sprachen anpassen

### Neue Sprache hinzufügen
- i18n.js: neuer Sprach-Block im L-Objekt
- index.html: neue `<option>` im langSelect-Dropdown

### Neue Hersteller-Daten (z.B. Modell zu MED-EL ergänzen)
- core.js: IMPLANTS / PROCESSORS-Eintrag

### Neuer Hersteller (4. Hersteller)
Großer Edit, mehrere Module:
- core.js: IMPLANTS, PROCESSORS, MFR-Eintrag, neue calc*-Funktion
- index.html: neue `<option value="..."` im mfrSelect
- i18n.js: Strings für Hersteller-Namen und Felder
- freq-table.js: switchMfr-Logik, ggf. isXxx-Flags
- ui-implant.js: buildImplantCard (Hersteller-spezifische Felder)
- file.js: Hersteller-Vergleich in saveJson/applyLoadedData prüfen
- state-side.js: initSideData prüfen

### Neue Preset-Art (z.B. „Notch-Filter“)
- core.js: PR_TYPES erweitern, PR_NAMES, PR_EXPL ergänzen, ggf.
  PR_HAS_CENTER / PR_HAS_WIDTH / PR_HAS_CUTOFF
- levels.js: calcPresetCurve um neuen Typ ergänzen, buildPrTbl
  passt sich automatisch an PR_*-Konstanten an
- state-side.js: initPresets prüfen (Default-Werte für neuen Typ)
- i18n.js: Strings für PR_NAMES und PR_EXPL

### UI eines Tabs ändern
- index.html: HTML-Struktur des Panels
- Hauptmodul des Tabs (siehe Tabelle oben)
- evtl. i18n.js: neue Strings
- evtl. init.js: Event-Listener-Verdrahtung

### Globaler State hinzufügen
- state-side.js: Variable deklarieren
- file.js: saveJson + applyLoadedData für Persistenz erweitern
- init.js: Autosave-Block für localStorage prüfen

### Neuer Event-Listener
- init.js (zentral) ODER direkt im jeweiligen Modul (siehe Player
  und LR-Balance als Vorbild)

## Strukturelle Eigenschaften

- Kein ES-Module-System, kein import/export
- Kein IIFE-Wrapping. Alles globaler Scope
- Keine Typprüfung, kein Lint-Setup
- Build oder Bundling gibt es nicht – Browser lädt 15 Dateien einzeln
- Keine automatisierten Tests; Prüfung manuell im Browser mit DevTools
