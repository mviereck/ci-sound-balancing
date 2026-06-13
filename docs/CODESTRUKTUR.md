# CI Sound Balancing Tool – Codestruktur

Eine HTML-Datei lädt eine Reihe JavaScript-Module in fester Reihenfolge.
Kein Framework, kein Build-Schritt, alle Variablen im globalen Scope.

> **Wartung dieser Datei**: bei jeder strukturellen Änderung am Code
> sofort mit aktualisieren. Insbesondere: neue oder gelöschte JS-Datei,
> neue zentrale Funktion, neue globale Variable, neuer Tab oder Sub-Tab,
> verschobener DOMContentLoaded-Handler. Aktualisierung gehört in
> denselben Arbeitsschritt wie die Code-Änderung, nicht nachträglich.
> Diese Datei beschreibt **wo** Code liegt (Datei, Funktion, Einhäng-
> Punkt, Modulzuordnung), nicht **wie** er sich verhält — Verhalten
> gehört in `docs/SPEC.md` / `docs/spec/`. Keine BA-Historie und keine
> Beschreibung entfernten Codes aufnehmen; dafür ist der `git`-Log da.

## Tabs und ihre Module

Anfragen kommen meist tab-orientiert. Diese Tabelle zeigt, wo der
Code des jeweiligen Tabs liegt.

| Tab-Beschriftung (DE) | data-tab ID | Hauptmodul(e) |
|---|---|---|
| Einführung | intro | HTML; `applyLang()` setzt Text und href des Manual-Links (`#introManualLink`) anhand `README_URLS` in i18n.js |
| Implantat | setup | ui-implant.js, freq-table.js |
| Messungen | messungen | mit drei Sub-Tabs (s.u.) |
| Meßergebnisse | ergebnisse | results.js, chart.js (mit Sub-Tabs) |
| Kurven | levels | levels.js |
| Schieber | schieber | levels-tab.js |
| Player | player | player.js |
| Laden/Speichern | file | file.js |
| Unterstützung | unterstuetzung | finanzen.js, unterstuetzung.js, unterstuetzung-graph.js |

Reihenfolge in `index.html` (`<button class="tab">`-Liste oben): Kurven
steht vor Schieber. Die `<panel-…>`-Divs darunter haben weiterhin die
historische Reihenfolge (schieber vor levels), das ist unkritisch — der
Inhalt ist DOM-ID-adressiert.

**Sub-Tabs in „Messungen"** (alle vier nutzen denselben Builder
`buildTestPanel` aus test-ui.js):

| Sub-Tab-Beschriftung | data-subtab | Hauptmodul |
|---|---|---|
| Elektrodenlautstärke ausgleichen | test | test.js |
| Stereo-Balance | balance | lr-balance.js |
| Frequenzabgleich | freqmatch | freqmatch.js (Basis), freqmatch-adaptive.js, freqmatch-slider.js |
| Latenz | latenz | latency.js |

**Sub-Tabs in „Meßergebnisse"**:

| Sub-Tab-Beschriftung | data-subtab | Hauptmodul |
|---|---|---|
| Elektrodenlautstärke-Balance (Default) | results | results.js |
| Stereo-Balance | lrresults | results.js, lr-balance.js |
| Frequenzabgleich | freqmatch | results.js |
| Latenz | latenz | latency.js (Render), tab-print.js (Druck) |

Zentrale Verdrahtung aller Tabs (Tab-Wechsel, Tab-Sperre während
Test): tabs-eq.js (`switchTab`, `updateTabLockState`).

## Module im Ladeverlauf

Die Reihenfolge der Module ist fest. Module weiter unten dürfen
Funktionen aus Modulen weiter oben aufrufen. Top-Level-Code in einem
Modul (außerhalb von Funktionen und außerhalb DOMContentLoaded)
braucht seine Abhängigkeiten beim Laden – normale Funktionsaufrufe
erst zur Laufzeit.

**Einbindung in `index.html`:** Skripte und `style.css` werden nicht
mehr per statischer `<script src=…>`-/`<link>`-Tags geladen, sondern
über drei kleine Inline-Skript-Blöcke im `<head>`. Der **erste Block**
lädt synchron `js/version.js` mit `?t=<Date.now()>` (immer frisch,
ein kleiner Roundtrip). Damit ist `APP_VERSION` verfügbar, bevor der
dritte Block läuft. Der **zweite Block** ist der
Konsolen-Fehler-Collector: er richtet `window._dbgErrors` (Array) ein,
patcht `console.error`, hört auf `window.error` und
`unhandledrejection` und zeigt bei Treffer einen roten Banner oberhalb
der Tab-Leiste an (→ `#dbgErrorBanner`). `window.error`- und
`unhandledrejection`-Events werden gefiltert: nur Dateien, die
`/js/` oder `index.html` im Pfad tragen, lösen den Banner aus.
Der Banner ist klickbar (öffnet das Debug-Panel via
`window.dbg.activate()`) und hat einen ×-Schließer. Mehrfach-Fehler
zählen im bestehenden Banner hoch. Der **dritte Block** schreibt
`<link>`- und `<script defer src=…>`-Tags per `document.write` in den
parser-laufenden HTML-Stream und versieht jede URL mit dem
Cachebuster-Parameter `?v=<APP_VERSION>`. Folge: Wenn die
Versionsnummer sich nicht ändert, dürfen Browser CSS und JS aus dem
Cache nehmen → schnell, akkuschonend. Bei jedem Versions-Bump in
`js/version.js` wechselt der Query-String → alle Dateien werden
frisch geholt. Bilder (favicon, Briefkopf-Logo) bekommen keinen
Cachebuster; sie werden über ihren Dateinamen versioniert (neuer
Inhalt = neuer Dateiname).

Zusätzlich stehen im `<head>` drei Meta-Tags (`Cache-Control:
no-cache, no-store, must-revalidate`, `Pragma: no-cache`, `Expires:
0`) gegen das Caching der HTML selbst. Auf Mobile werden die meist
ignoriert (gilt nur für echte HTTP-Header), schaden aber nicht.
GitHub Pages cached HTML ohnehin ~10 Min — daher kann die
Versionsnummer-Anhebung mit kurzer Verzögerung sichtbar werden,
danach läuft der oben beschriebene Mechanismus.

Wichtig zur Loader-Wahl: Per `document.write` eingefügte
`<script defer>`-Tags sind aus Browser-Sicht parser-eingefügt; `defer`
greift, sie laden parallel, werden in Dokumentreihenfolge ausgeführt
und blockieren `DOMContentLoaded`, bis alle ausgeführt sind.

Die Reihenfolge der Module liegt als Array im Loader-Block in
`index.html` und muß bei neuen/entfernten Modulen dort gepflegt
werden. Die Loader-Liste enthält `js/`-Pfade
(z.B. `js/audio.js`).

Alle Logik-JS-Dateien liegen unter `js/`. Die Sprachdaten in
`i18n/de.js` etc. bleiben im Root-Ordner `i18n/` (kein `js/`-Prefix).

| #  | Datei | Inhalt |
|----|-------|--------|
| 0  | version.js | Einzige Quelle der `APP_VERSION`; ihr Wert bestimmt den Cachebuster aller CSS/JS-Ressourcen. Muss nach jedem Code-Build inkrementiert werden. |
| 0a | debug.js | Debug-Panel (`window.dbg`-API): Felder-Polling und manuelles Setzen, Markdown-Snapshot mit Kopierknöpfen, Test-Registry, Flags. Muß vor `mobile.js` geladen werden, damit andere Module früh `dbg.log`/`dbg.set` rufen können. |
| 0b | mobile.js | Touch-Erkennung und Mobile-Eingabe-Sperre (Number-Inputs read-only auf reinen Touch-Geräten). `applyMobileReadonly` wird nach dynamischen Tabellen-Rebuilds aus `freq-table.js`/`levels.js`/`test-ui.js` erneut aufgerufen. (Namen per `grep`.) |
| 0c | touch-ctrl.js | Touch-Bedienleisten: `buildSliderTouchCtrl` (− / Fein / + mit Long-Press direkt nach Slider) und `buildStepperPair` (freistehende Schrittpaare). Kein eigener DOMContentLoaded-Handler. (Namen per `grep`.) |
| 1  | i18n.js | Übersetzungs-Core: `L`, `t()`, `applyLang()`. Sprachdaten in separaten `i18n/*.js`-Dateien. `applyLang` setzt `[data-t]`, `[data-t-title]` und `[data-t-opt]`; ruft außerdem modul-spezifische Rebuild-Funktionen auf (Details im Datenfluss-Block). (Namen per `grep`.) |
| 1a | i18n/de.js | Deutsche Übersetzungen — befüllt `L.de`. Muss nach `i18n.js` geladen werden. |
| 1b | i18n/en.js | Englische Übersetzungen — befüllt `L.en`. |
| 1c | i18n/fr.js | Französische Übersetzungen — befüllt `L.fr`. |
| 1d | i18n/es.js | Spanische Übersetzungen — befüllt `L.es`. |
| 1e | dependency-lock.js | UI-Sperr-Schicht „Daten vorhanden": sperrt sechs Felder (Hersteller, Hörtechnik, Hz-eigen, Referenzseite FreqMatch, Aktiv-Häkchen, Ausschluss-Checkbox), wenn vorhandene Messdaten durch eine Änderung ungültig würden. Popup bei Klick auf gesperrtes Element. (Namen per `grep`.) |
| 2  | core.js | Hersteller-Daten (`IMPLANTS`, `PROCESSORS`, `MFR`), Preset-Typen (`PR_*`), dB↔Hersteller-Einheit-Umrechnung (MED-EL qu, Cochlear CL, AB CU), Frequenz-/Cent-Hilfsfunktionen, SII-Gewichte. Keine Abhängigkeiten auf andere App-Module. (Namen per `grep`.) |
| 3  | state-side.js | Zentraler globaler State: persistierte Daten pro Seite in `sideData.left`/`sideData.right`, dazu gleichnamige Live-Views der aktiven Seite (gesetzt durch `bindActiveSide`); Side-Wechsel-, Konfig- und Persistenz-/Migrations-Helper; zentrale Default-Tabellen für Tests und Ton-Hüllkurven; Player- und Test-State-Variablen. Top-Level-Init am Dateiende. Querbezüge: `isSideUsable` ist Voraussetzungs-Sperre für `freqmatch.js`/`test.js`/`lr-balance.js`; `effFreqDisplay` liefert die Warp-verschobene Anzeige-Frequenz für Kurven-Tab und Player, während Audio-Pfad/Tests/Schieber/MAPLAW `effFreq` nutzen; `setRefEl` ist der einzige Schreibweg für die Referenzelektrode. (Namen per `grep`.) |
| 3a | audio-source.js | Generischer Audio-Quellen-Layer zwischen Providern (lokale Dateien, Embed, Webspace, Geräusche, Musik) und Player/Sätze-UI. Provider-Registry, Item-Aggregation per Kategorie, Sortier- und Filter-Achsen. Lädt nach `state-side.js`, vor `player.js`. (Namen per `grep`.) |
| 3b | richtone-profiles.js | Statische Profil-Daten für Rich-Tone-Synthese (14 Instrumente in `RICHTONE_PROFILES`). Auto-generiert aus `docs/richtone_profiles.json` — nicht manuell bearbeiten. |
| 3c | citest-profiles.js | Ergänzt `RICHTONE_PROFILES` um für CI-Messungen optimierte Profile (CiHF, CiH, CiP, CiB, CiBF, CiHA, CiHS). Designentscheidungen → `docs/Konzept_CI_Testtoene.md`. |
| 4  | audio.js | AudioContext und Ton-Wiedergabe: Sinus, synthetische Profilsynthese (aus `RICHTONE_PROFILES`/CI-Profilen), Mellotron-Sampler-Trigger. `playTone` für Einzelton, `playSeq` für A/B(A)-Sequenzen. Hüllkurven-Parameter global. (Namen per `grep`.) |
| 5  | ui-implant.js | Implantat-Karte im Implantat-Tab (`buildImplantCard`) und Tonart-Auswahl-Modalbox für den Implantat-Reiter (`openImplantToneSelectionModal`). Stößt nach Änderungen globaler Parameter die Plausibilitätsprüfung an. (Namen per `grep`.) |
| 6  | freq-table.js | Elektroden-Tabelle im Implantat-Tab: Aufbau, Hersteller-Wechsel, Frequenz-Reset, Elektroden-Auswahl-Helper (`actEl`, `allEl`, `allPairs`). Ruft `applyMobileReadonly` und `validateImplantTable` nach jedem Rebuild auf. (Namen per `grep`.) |
| 6a | data/cochlear-fats.js | Statische Cochlear FAT-Daten (22-Elektroden-Frequenzzuweisung, 188–7938 Hz) für die Plausibilitätsprüfung in `implant-validate.js`. |
| 6b | implant-validate.js | Plausibilitätsprüfung Implantat-Eingaben: Hz-Monotonie/-Range/-Trend/-Sprung, THR/MCL-Wertebereich/-Konflikt/-Ausreißer, Cochlear-FAT-Vergleich, c-Wert/IDR-Prüfung. Abgestufte Warn-Level (1 rot, 2 orange, 3 gelb) pro Feld. Wird von `buildFreqTable` am Ende aufgerufen. (Namen per `grep`.) |
| 7  | test-ui.js | Einheitliche Test-UI für alle drei Messungs-Sub-Tabs: `buildTestPanel(parentEl, cfg)` erzeugt Voreinstellungs-, Erklärungs- und Test-Block. `lockTestTabs`/`unlockTestTabs` während laufendem Test. UI-Änderungen am einheitlichen Aufbau gehören hierher, nicht in die Test-Module. (Namen per `grep`.) |
| 7a | tone-popup.js | Modaler Tonart-Auswahl-Dialog (`openToneSelectionDialog`): alle Tongruppen, Klavier-Vorschau, Mellotron-Vorschau. Aus `test-ui.js` ausgelagert. (Namen per `grep`.) |
| 7b | sampler-keyboard.js | Klavier-Widget für die Tonart-Modalbox: Tasten pro Elektrode in Burst- oder Hold-Modus, Zier-Tasten auf geometrischen Mittelfrequenzen. (Namen per `grep`.) |
| 8  | test.js | Elektrodenlautstärke-Test-Sub-Tab: zwei Verfahren (Round Robin, Paar-Auswahl), WLS-Kurvenberechnung (`compWLS`). Nutzt testUI-API (`buildTestPanel`). **`elTestData(opts)` ist die zentrale Schnittstelle zu den Mess-Ergebnissen (eine `compWLS`-Hülle, liefert `raw`/`measured`/`correction`/`correctionGain`/`residual`/`weight`); alle Stellen, die Elektrodenlautstärke-Korrekturen anwenden oder anzeigen, ziehen die Werte hier und drehen das Vorzeichen nicht mehr selbst.** (Namen per `grep`.) |
| 9  | freqmatch.js | Gemeinsame Basis des Frequenzabgleich-Sub-Tabs: State-Verwaltung, Ton-Wiedergabe, Voreinstellungs-UI, Elektroden-Auswahl. Adaptives und Slider-Verfahren in 9c/9d ausgelagert. (Namen per `grep`.) |
| 9b | freqmatch-staircase.js | Pure-Function-Kern für adaptiven Frequenzabgleich: 1-down-1-up-Staircase nach Levitt 1971, Track-Management, Konvergenz-Berechnung. Keine DOM-Abhängigkeit. Methodik → `docs/spec/02b-freqmatch-adaptiv.md`. (Namen per `grep`.) |
| 9c | freqmatch-adaptive.js | Adaptiver Testablauf: Round-Robin-Scheduling, Trial-Durchführung, Ergebnis-Aggregation, Status-Grid-Rendering. Nutzt `freqmatch-staircase.js` als Pure-Function-Kern. (Namen per `grep`.) |
| 9d | freqmatch-slider.js | Slider-Round-Verfahren: manuelle Frequenz-Justierung pro Elektrode, Runden-Planung, Pause/Resume. Nutzt `freqmatch.js`-State. (Namen per `grep`.) |
| 10 | results.js | Meßergebnis-Darstellung: Lautstärke-Balance-Tabelle, Frequenzabgleich-Tabelle (inkl. in-progress Tracks als Zwischenstand), Latenz-Anzeige. Alle drei Meßergebnis-Sub-Tabs. (Namen per `grep`.) |
| 11 | chart.js | Chart-Zeichenfunktionen für alle Meßergebnis-Darstellungen. Shared Helper `drawDisabledBar` (von `lr-balance.js` mitgenutzt) und `_drawRefElLabel` (von `player.js` und `print-md.js` mitgenutzt). Achsen-Builder `buildLinearAxis` (elektrodennummern-basiert) und `buildCentAxis` (log-Hz/Cent). (Namen per `grep`.) |
| 12 | file.js | Laden/Speichern: JSON-Save/Load, Reset, EasyEffects-Export, Dateinamen- und Drucktitel-Generator. Enthält Migrations-Kette für ältere Speicherstände. (Namen per `grep`.) |
| 12b | print.js | Druck-Infrastruktur: `buildPrintHeader` (Mini-Kopf mit Logo für alle Tab-Einzeldrucke), `openPrintWindow`, Canvas-zu-Bild-Helper. (Namen per `grep`.) |
| 12d | print-md.js | Markdown-Generatoren für Archiv-Box (`collectArchivData`/`renderArchivMarkdown`, Modus A) und Audiologen-Auftrag (`buildAudiologMarkdown`/`audiologPrint`, Modus B). Enthält Canvas-PNG-Renderer für den Druck-Pfad. (Namen per `grep`.) |
| 12c | tab-print.js | Tab-spezifische Druck-Dispatcher für alle Tabs und Meßergebnis-Sub-Tabs. Nutzt `print.js`-Infrastruktur. (Namen per `grep`.) |
| 13 | tabs-eq.js | Tab-System: `switchTab`, `switchSubtab`, Tab-Sperre während Test (`updateTabLockState`), Persistenz in localStorage, URL-Hash-Sync, popstate-Handler. (Namen per `grep`.) |
| 14 | levels.js | Kurven-Tab: Preset-Berechnung (geometrische Kurven bei aktivem Warp in `effFreqDisplay`-Frequenzen, Bass/High/Volume elektrodennummern-basiert), Kurven-Chart, Preset-Tabelle. Änderungen triggern live `pUpdEQ` im Player. (Namen per `grep`.) |
| 14a | rubberband-loader.js | Lazy-Loader für rubberband-wasm (Singleton-Cache). Fehlerbehandlung für file://-Kontext. (Namen per `grep`.) |
| 14c | smplr-loader.js | Lazy-Loader für smplr-Library/Mellotron-Sampler (Singleton-Cache pro Token). (Namen per `grep`.) |
| 14b | levels-tab.js | Schieber-Tab: Canvas-Zeichnung für Relativ- und Absolutmodus, drei Darstellungsvarianten. Elektrodennummern-basierte x-Achse (kein Frequenzbezug). (Namen per `grep`.) |
| 15 | player.js | Audio-Player mit parametrischem Mehrkanal-EQ, MAPLAW-AudioWorklet-Integration und Frequenz-Warping. Vier Wiedergabe-Quellen (Musik, Sätze, Geräusche, Hörbücher) mit einheitlicher Transport-Leiste. Eigene DOMContentLoaded-Handler und Top-Level-Listener. Querbezug: `pMaplawTrigger`/`pMaplawUpdUI` sind die Steuerschnittstelle zum MAPLAW-Worklet. (Namen per `grep`.) |
| 16 | freq-warp.js | Frequenz-Warping via Rubberband-WASM: Vorberechnung des gewarpten Buffers (bandweise FIR-Bandpässe, Pitch-Shift pro Band), Cancel-Mechanismus, Stützpunkt-Quelle `_warpFResSource` (finales fRes + in-progress + Slider-Schätzungen). `pWarpMode`-Wertebereich: absolute Seiten `left`/`right`/`symmetric`. (Namen per `grep`.) |
| 16b | maplaw.js | AudioWorklet für MAPLAW-Simulation (MED-EL): bandweise Hüllkurven-Vorverzerrung Ist⁻¹∘Soll, stereo-fähig (L/R getrennt). Audio-Pfad-Position und Bedingungen → Datenfluss-Block. (Namen per `grep`.) |
| 17 | lr-balance.js | Stereo-Balance-Test-Sub-Tab. Nutzt testUI-API, eigener DOMContentLoaded-Handler. Zeichnet Ergebnis-Chart (`lrDrawChart`); `drawDisabledBar` aus `chart.js` mitgenutzt. (Namen per `grep`.) |
| 17c | latency.js | Latenz-Test (Inter-Ohr-Zeitversatz). Hängt Verzögerungskette in den Audio-Graph ein: `pGain → pLatSplitter → pLatDelayL/R → pLatMerger → c.destination`; wird einmalig von `player.js` initialisiert. (Namen per `grep`.) |
| 17b | sentences.js | Sätze-Wiedergabe: Hybrid-Loader (online `sentences.json` oder Embed-Offline-Fallback). Provider-Integration für `audio-source.js`. Hintergrund-Geräusch-Mischung (SNR-basiert, Mix-Cache). (Namen per `grep`.) |
| 18 | init.js | Haupt-DOMContentLoaded-Handler: `applyLang`, `buildImplantCard`, alle zentralen Event-Verdrahtungen, Autosave-Setup. Zentrale Verdrahtung, aber nicht die einzige — Player und LR-Balance haben eigene Listener in ihren Modulen. (Namen per `grep`.) |
| 19 | legal.js | Footer-Modals für Impressum und Lizenz (GPL-2.0-or-later). E-Mail wird erst beim Öffnen aus Teilen zusammengesetzt (Spam-Schutz). (Namen per `grep`.) |
| 20 | finanzen.js | Datenhaltung und Berechnungen für den Unterstützung-Tab: Pflegeblock oben (Monatsposten, Dauerspenden), Berechnungsfunktionen für Zeitreihe, Lücken und Einmalsummen. (Namen per `grep`.) |
| 21 | unterstuetzung.js | Rendert den Unterstützung-Tab: Finanztabelle und Einmalspenden-Block aus `finanzen.js`-Daten. (Namen per `grep`.) |
| 21b | unterstuetzung-graph.js | Canvas-Spenden-Verlaufsgraph für den Unterstützung-Tab (gestapelte Monatsbars: Dauerspenden, Puffer, Lücke). (Namen per `grep`.) |
| 21a | update-check.js | Prüft bei Sichtbarkeitswechsel auf neue Version (`APP_VERSION` live vs. Server) und zeigt Update-Banner. Kein Check während laufendem Test. (Namen per `grep`.) |
| 22 | debug-tests.js | Selbsttest-Registrierungen für das Debug-Panel (vier Tests). Lädt zuletzt. (Namen per `grep`.) |
| 23 | debug-tests-current.js | Temporäre Build-Tests aus laufenden Bauanleitungen. Nach Abnahme löschen oder nach `archive/debug-tests/` verschieben. |

## Datenfluss (nicht aus Namen ablesbar)

**Footer und Impressum:** Footer am Ende des `.container` (außerhalb
aller `.panel`-Container), enthält Versions-Anzeige, Impressum-Link,
Lizenz-Link (GNU GPL v2+) und GitHub-Link. Zwei `<dialog>`-Elemente
(`#imprintDialog`, `#licenseDialog`) werden über `legal.js`
verwaltet. Impressum-Inhalt deutsch und statisch; der Lizenztext
(GPL-2.0-or-later) wird beim Öffnen aus dem Repo nachgeladen.


**Touch-Bedienleisten:** Pro Slider eine `.touch-ctrl`-Box mit
Buttons − / Fein / + (`buildSliderTouchCtrl` aus touch-ctrl.js). Für den `slider`-Baustein der testUI-API wird
`buildSliderTouchCtrl` automatisch durch `_buildTestPanelNew` aufgerufen
(Optionen `touchStep`/`touchFineStep` aus cfg; kein Replay-Button). Für
die alten Test-Module (test.js, lr-balance.js, latency.js) rufen diese
`buildSliderTouchCtrl` selbst auf. Player-Stärke (`plStr`) und
Schieber-Tab (Canvas) haben Sonder-Implementierungen mit `attachLongPress`
direkt. Die Bedienleisten sind dauerhaft sichtbar (Desktop und Mobile).

**Kurven-Chart-Pinning:** Die `.lv-chart-card` im Kurven-Tab ist
nur auf Mobile-Breite (`max-width: 768px`) `position: sticky`.
Auf Desktop scrollt sie als normale Karte mit. Der Breakpoint
passt zu den anderen Mobile-Regeln in `style.css`.

**Mobile-Eingabe-Sperre:** Auf reinen Touch-Geräten (Smartphone)
werden alle Number-Inputs read-only, damit die System-Tastatur nicht
das Bild verdeckt. Eingabe läuft dort über die Touch-Buttons.
Erkennung über `IS_TOUCH_ONLY` aus `mobile.js`.
`applyMobileReadonly` wird nach jedem Rebuild dynamischer Tabellen
(`buildFreqTable`, `buildPrTbl`, `buildTestPanel`) erneut aufgerufen,
sonst greift das Flag nur auf den statischen HTML-Bestand.
`safeFocus` ersetzt direkte `.focus()`-Aufrufe an Stellen, wo der
Autofokus auf Touch-Geräten stören würde.

**Globaler State** liegt komplett in `state-side.js`. Wer auf
`sideData`, `activeSide`, `mfr`, `nEl`, `freqs`, `manualLevels`,
`presets`, `bRes`, `lvFocus`, Audio-State-Variablen, Test-State-
Variablen, die Tonfolge-Variablen pro Test (`sequence_freqmatch`,
`sequence_test`, `sequence_balance`), `slTarget_balance` oder die
Levels-Tab-Anzeigestate (`lvTabShowMeas`, `lvTabShowCurves`,
`lvTabMode`, `lvTabVariant`) zugreift, findet die Deklaration dort.

**State pro Seite vs. globale Live-View:** Die persistierten
Daten leben pro Seite in `sideData.left.*` / `sideData.right.*`
(insbesondere `manufacturer`, `nEl`, `freqs`, `elFreqOwn`, `elSt`,
`elNt`, `elExDur`, `manualLevels`, `refEl`, `bRes`,
`presets`, `config`, `fullSweepRound`, `fullSweepDonePairs`,
`implant`). Die gleichnamigen freistehenden Variablen (`mfr`, `nEl`,
`freqs`, `manualLevels`, …) sind **Live-Views der aktiven Seite**:
`bindActiveSide()` kopiert die Referenzen aus `sideData[activeSide]`
in die globalen Variablen. Beim Side-Wechsel wird neu gebunden;
Tab-Module greifen i.d.R. auf die globalen Variablen zu und sehen
dadurch transparent die aktive Seite. Persistenz (JSON, localStorage)
serialisiert immer `sideData.left` und `sideData.right` getrennt.

**Bilaterale Konfiguration und Frequenzraster-Sync:** Jede Seite
hat eine `config` (`"ci"` / `"hg"` / `"normal"` / `"schwerhörig"`
/ `"taub"`). `setSideConfig(side, cfg)` setzt sie und ruft bei
Nicht-CI-Konfig `syncFreqsToAcoustic()`. `isSideUsable(side)` liefert `true` wenn Hörtechnik gesetzt und — bei CI — Hersteller gesetzt;
wird als Cross-Modul-Helper von `freqmatch.js`, `test.js` und
`lr-balance.js` zur Voraussetzungs-Prüfung genutzt. `getFreqSource()` liefert
die Seite, deren CI-Frequenzraster auf eine akustische Seite
gespiegelt wird: wenn nur eine Seite CI ist, ist sie die Quelle;
sind beide CI (unabhängig) oder beide nicht-CI, liefert `null`.
Bei beiden nicht-CI greift `defaultMfr` als Frequenzraster-
Vorgabe (persistiert, `defaultMfrSelect` im Implantat-Tab). Beim
Spiegeln werden auf der Ziel-Seite `nEl`, `freqs`, `manufacturer`,
`elFreqOwn` und die pro-Elektroden-Arrays sowie `implant` auf
korrekte Länge gebracht — bestehende Werte bleiben erhalten, soweit
die Länge stimmt.

**Side-Wechsel:** Sichtbare Buttons `sideLeftBtn` / `sideRightBtn`
oben im UI rufen `setActiveSide(side)`. `setActiveSide` setzt
`activeSide`, ruft `bindActiveSide`, spiegelt den Wert in den
versteckten `ciSideSelect` (existiert aus historischen Gründen,
wird heute nur als interner Mirror benutzt), aktualisiert die
Dropdowns `mfrSelect`, `cfgSelect`, `defaultMfrSelect`, baut
Frequenztabelle, Preset-Tabelle, Kurven-Chart, Schieber-Canvas,
Ergebnisse und Implantat-Card neu und ruft `updSideButtons`
(visuelle Markierung des aktiven Buttons), `updFClearBtn`
(beschriftet den „Messergebnisse löschen"-Button mit der
aktiven Seite), `updPlSrcButtons` und ggf.
`updatePlayerForSideChange` (wenn ein Buffer geladen ist).

**Player Side-Modi:** `getPlayerSide()` (state-side.js) liefert
`"left"`, `"right"` oder `"both"` abhängig von Checkbox `plBothSides`.
Audio-Graph: `pEqFLeft`/`pEqFRight`, `pChannelSplitter`, `pChannelMerger`
(player.js). `updatePlayerForSideChange` (player.js) baut den
Audio-Graph bei Side-Wechsel neu auf. `pDrawEQ` zeigt bei `"both"` die
`activeSide`. Bei `getPlayerSide() === "left"/"right"` (mono) liefert
`getPlayerGains()` ein flaches Array (kein `{left,right}`-Objekt) —
der `gains.left !== "undefined"`-Guard trifft diesen Fall nicht. Bei
aktivem Frequenz-Warping: `pBuildEQ`, `pCompQ` und `pDrawEQ` nutzen
`effFreqDisplay` statt `effFreq` (im „both"-Modus je
`effFreqDisplay(i, "left"/"right")`, im Mono-Modus an `activeSide`).
Verhalten → `docs/spec/06-player.md`.

**Balance-Anwendungs-Modus** (`plBalanceMode`, state-side.js):
`"sym"` (Default), `"left"` oder `"right"`; Gain-Verteilung via
`getPlayerBalanceGains` (player.js). Verhalten und Persistenz →
`docs/spec/06-player.md`.

**MAPLAW-Simulation (MED-EL):** Worklet aus `maplaw.js`, in `pPlay`
eingehängt zwischen letztem EQ-Knoten und `pGain`. Schalter
`pMaplawOn`, Anwendbarkeit `pMaplawIsApplicable()`, Ist-c aus
`sideData[activeSide].implant.cValue`, Live-Update via
`pMaplawTrigger`, UI-Sync via `pMaplawUpdUI` (Listener in init.js).
Bedingungen, Audio-Pfad-Position und Verhalten →
`docs/spec/06-player.md`.

**Frequenz-Warping — Persistenz:** `pWarpOn`, `pWarpMode`, `pWarpStrength`,
`pRubberbandOptions` in localStorage-Autosave (`_autoSaveState` in
init.js, Schlüssel `warpOn`/`warpMode`/`warpStrength`/`warpRbOptions`)
und JSON-Save/Load (file.js). `pWarpedBuf` wird nicht gespeichert.
UI-Sync via `pWarpUpdUI()`. Persistenz-Verhalten und Lade-Kompatibilität →
`docs/spec/06-player.md`.

**Lokale Sammlungen — Persistenz:** `handleId` → FileSystemDirectoryHandle
in IndexedDB (DB `"ciSoundBalancing"`, Store `"folderHandles"`).
JSON-Save via `saveJson.localCollections` (file.js); JSON-Load:
`applyLoadedData` ruft `sRestoreLocalCollections` auf. Stub-Sprecher
bei Fehlschlag via `sReloadStubCollection`. Verhalten und
Einschränkungen → `docs/spec/06-player.md`.

**Audio-Datei vs. Sätze vs. Geräusche (Buffer-Trennung):** `pFileBuf` (player.js) hält die vom User geladene Audiodatei; `sSentenceBuf` (sentences.js) den gerade dekodierten Satz; `pNoiseBuf` (state-side.js) den generierten oder geladenen Geräusch-Buffer. `pSourceBuf` ist eine Live-View auf den durch `pPlaybackMode` gewählten Slot (`"file"`, `"sentence"` oder `"noise"`), gesetzt über `pSetPlaybackMode(mode)`. Damit überschreibt die Sätze- oder Geräusch-Wiedergabe die Datei-Auswahl nicht mehr. `sStop()` setzt nach Sätze-Ende ebenfalls in den Datei-Modus zurück.

**Latenz-Kompensation (Inter-Ohr-Zeitversatz):** Zwischen `pGain` und `c.destination` hängt eine Verzögerungskette aus `latency.js`: `pGain → pLatSplitter → pLatDelayL / pLatDelayR → pLatMerger → c.destination`. `latInitGraph` wird einmalig aus `player.js` aufgerufen (nach `pGain`-Erstellung). `latSetSliderMs` steuert die Delay-Zeiten live während des Tests; `latApplyToPlayer` setzt den gespeicherten `latencyResult`-Wert (oder 0 wenn `plApplyLatency` aus). Während eines laufenden Latenz-Tests sitzt zusätzlich eine Balance-Stage zwischen `latTestSource` und `pGain` (Splitter + `latBalGainL`/`latBalGainR` + Merger). Die Gain-Werte kommen aus `getRawBalanceGains()` (ignoriert `plApplyBalance`) und werden beim Test-Start gesetzt und beim Stop verworfen.

**Inter-Ohr-Vergleich (Gesamtoffset L↔R):** `getPlayerBalance()`
in state-side.js berechnet den Mittelwert über alle gemessenen
`lrResults` (Stereo-Balance-Test) und liefert daraus ein
symmetrisches Stereo-Balance-Offset (positiv = rechts louder →
negativer Offset dämpft rechts ab). Wird im Player angewandt,
wenn die Checkbox „Stereo-Balance anwenden" (`plApplyBalance`) an
ist. Begrenzt auf ±60 dB. Die tatsächliche Gain-Verteilung auf
L/R erfolgt via `getPlayerBalanceGains()` unter Berücksichtigung
von `plBalanceMode` ("sym"/"left"/"right").

**Schieber-Tab-Modus und -Variante** (`lvTabMode`, `lvTabVariant` in
state-side.js): Modi `"rel"`/`"abs"`, Varianten `"stack"`/`"sum"`/`"lines"`.
`lvTabUpdateModeAvailability` prüft MCL-Verfügbarkeit (Aufruf aus
`lvTabRebuild` und nach Datei-Laden). Verhalten, Persistenz und
Varianten-Erhalt → `docs/spec/04-schieber.md`.

**Absolutmodus-Präzision von `manualLevels`:** `lvTabOnSchieberChange`
speichert in `manualLevels[i]` ohne Rundung (volle Float-Präzision);
Anzeige-Rundung im Draw-Pfad davon unabhängig. Begründung →
`docs/spec/04-schieber.md`.

**Levels-Tab Fokus-Modell:** `lvTabHasFocus` (levels-tab.js) → `true`
nur wenn `#lvTabCv` fokussiert. `lvTabNavigableEl()`: im Relativmodus
= `actEl()`, im Absolutmodus gefiltert auf Elektroden mit MCL
(`lvTabElHasMcl`). Pfeiltasten-Navigation in init.js. Verhalten →
`docs/spec/04-schieber.md`.

**Tonart pro Test** (`toneType_test`, `toneType_balance`, `toneType_freqmatch`,
alle Default `richCiHF`) und **Tonfolge pro Test** (`sequence_test`,
`sequence_balance`, `sequence_freqmatch`, alle Default `"ab"`) sind
vollständig getrennt je Test. Die Dropdowns für AB/ABA werden in
`buildTestPanel` (test-ui.js) aus den per-Test-Variablen initialisiert;
bei Änderung schreibt der Event-Listener nur in die Variable des jeweiligen
Tests.

**Historische Kreuzverdrahtung der Tab-IDs:** `panel-levels` /
`tabLevels` gehört zum sichtbaren Tab „Kurven" (data-tab="levels",
Hauptmodul levels.js). `panel-schieber` / `tabSchieber` gehört zum
sichtbaren Tab „Schieber" (data-tab="schieber", Hauptmodul
levels-tab.js — i18n-Key `tabLevels` liefert den aktuellen Text
„Schieber"). Die DOM-IDs sind bewusst so belassen, um Diff-Aufwand zu
minimieren. Der i18n-Key `lvTabTitle` (Panel-Überschrift im Schieber-
Tab) und `plSrcLevels` (Player-Button-Label) liefern ebenfalls
„Schieber" / Sliders / Curseurs / Deslizadores.

**Player-Quellen-Toggles:** `plSrcMeas`, `plSrcLevels`, `plSrcCurves`
(state-side.js). Summanden in `computeGains` (player.js):
`plSrcMeas` → `compWLS()`, `plSrcLevels` → `manualLevels`,
`plSrcCurves` → `getTotalPresetCurve()`. Verhalten →
`docs/spec/06-player.md`.

**Preset-Berechnung** (`calcPresetCurve`, `getTotalPresetCurve`,
`getEffectiveLevels`) liegt in `levels.js`. `getEffectiveLevels`
wird nur noch von `expText` (file.js) genutzt; player.js greift
direkt auf `getTotalPresetCurve()` zu.
Die geometrischen Kurven (tilt, scurve, pivot, gauss) rechnen in
**log(Hz)** (Cent re 1000 Hz). Bei aktivem Frequenz-Warping
(Player-Toggle) rechnen diese Kurven auf den **gewarpten
Wahrnehmungs-Frequenzen** der Elektroden (via `effFreqDisplay`);
Bass-/High-Boost und Volume bleiben elektrodennummern-basiert.
`pr.center` wird als Hz-Wert
gespeichert (Default 1000 Hz), `pr.width` als Cent-Wert (Default
1200 ¢). JSON-Kennzeichen: `presetFormat: "freq-v3"`. Alte Dateien
ohne dieses Feld werden beim Laden automatisch migriert
(`_migratePresetsFromIndexToFreq` in file.js). Der
Migrations-Toast (`loadMigratedCurves`) erscheint nur, wenn
mindestens eine Seite migriert wurde **und** dort mindestens
eine Kurve vom Typ tilt/scurve/pivot/gauss mit `strength ≠ 0`
vorliegt (SII-only und Stärke-0-Kurven lösen keinen Toast aus).

**Levels → Player Live-Update:** `lvOnChange` in levels.js ruft am
Ende `pUpdEQ()` aus player.js auf. Außerdem ruft es `lvTabDraw()`
auf, damit der Schieber-Canvas synchron bleibt. Dadurch aktualisiert
sich der Player-Equalizer sofort, wenn manuelle Levels oder Presets
geändert werden.

**applyLang ruft modulübergreifend:** `updEqToggleBtn`,
`updBalApplyBtn` (beide tabs-eq.js), `updSideButtons` (state-side.js),
`buildFreqTable` (freq-table.js),
`buildImplantCard` (ui-implant.js), `renderResults` (results.js),
`renderFreqMatchResults` (results.js, nur wenn freqmatch-Sub-Tab aktiv),
`sUpdateUI` (sentences.js, aktualisiert Sätze-Card bei Sprachwechsel).
`applyLang` setzt auch alle `[data-t-opt]`-Elemente (Option-Labels in
Selects) über eine generische querySelectorAll-Schleife.

**Test-UI über Builder:** Die drei Sub-Tab-Hauptmodule (test.js,
lr-balance.js, freqmatch.js) erzeugen ihre UI nicht selbst, sondern
rufen `buildTestPanel(parentEl, cfg)` aus test-ui.js auf und greifen
auf das zurückgelieferte Element-Lookup-Objekt zu. UI-Änderungen am
einheitlichen Aufbau gehören in test-ui.js, nicht in die einzelnen
Test-Module.

**refEl-Wirkung:** `refEl` beeinflusst ausschließlich Anzeige und
Anwendung der Ergebnisse — konkret: WLS-Eichung in `compWLS`
(test.js), Highlight in `drawChart` (chart.js), Player-
Korrekturgewicht via `pUpdEQ` (player.js).
`refEl` hat **keine** Wirkung auf die Messung selbst (rohe
Vergleichspaare `bRes`). Das Dropdown zur Wahl der
Referenzelektrode sitzt im Ergebnis-Reiter (`#refEl`, befüllt
durch `updRef` in freq-table.js, Listener in init.js, triggert
`renderResults`/`drawLvChart`/`pUpdEQ`). In test.js wird `refEl`
nicht mehr beim Test-Start überschrieben.

Die Markierung der Referenzelektrode in den Loudness-Darstellungen
wird in `drawChart` (chart.js), `pDrawEQ` (player.js),
`_archivChartLoudness` und `_audiologChartImg` (beide in print-md.js)
als fettes schwarzes „Ref.-El."-Label am oberen Rand gezeichnet;
in den Loudness-Tabellen (`renderResults`, `_archivMdMeas`,
`_audiologLoudnessTable`) als neue Endspalte mit `X` in der
Referenzzeile. In Stereo-Balance-, Schieber- und
Frequenzabgleich-Darstellungen wird **nicht** markiert (kein
direkter `refEl`-Effekt im jeweiligen Inhalt).

**Tab-Sperre während Test:** sobald ein Test in einem der drei
Sub-Tabs läuft, sperrt `updateTabLockState` (tabs-eq.js) alle
Top-Level-Tabs **und** alle Sub-Tabs in Messungen außer dem aktiven.

**Tab/Subtab-Persistenz und Deep Linking:** `switchTab` (tabs-eq.js)
schreibt den aktiven Top-Level-Tab in `localStorage` unter
`ci-lb-activeTab` und setzt `location` per `history.pushState` auf
`#<tab>`. `switchSubtab` schreibt analog pro Parent unter
`ci-lb-subtab-<parent>` (nur für `messungen` und `ergebnisse`
relevant) und setzt den Hash auf `#<parent>:<subtab>`. Restore am
Ende des DOMContentLoaded-Handlers in `init.js`, nach allen anderen
Init-Schritten: URL-Hash hat Vorrang vor localStorage; abschließend
setzt `history.replaceState` den Hash auf den tatsächlich aktiven
Tab/Subtab (kein zusätzlicher History-Eintrag). Browser-Zurück/Vor
wird via `popstate`-Listener in tabs-eq.js abgefangen.

**DOM-Listener nicht nur in init.js:** Player und LR-Balance haben
eigene Top-Level-Listener bzw. eigene DOMContentLoaded-Handler in
ihren Modulen. test-ui.js verdrahtet die Test-spezifischen Listener
beim Aufruf von `buildTestPanel`. init.js ist die zentrale
Verdrahtung, aber nicht die einzige.

**Top-Level-Init am Ende von state-side.js:** Die Aufrufe
`initSideData("left", "medel")`, `initSideData("right", "medel")`,
`bindActiveSide()`, `updateMfrSelectLabels()` laufen beim Laden des
Moduls. Sie brauchen i18n und core, deshalb lädt state-side als
dritte Datei.

**Hersteller-Vergleiche verteilt:** `mfr === "medel"` /
`mfr === "ab"` / `mfr === "cochlear"` taucht in mehreren Modulen
auf, vor allem freq-table.js, ui-implant.js, core.js, levels.js.
Bei Hersteller-spezifischer Logik immer alle drei Module prüfen.

**i18n-Split:** Sprachdaten liegen jetzt in `i18n/de.js`, `i18n/en.js`, `i18n/fr.js`, `i18n/es.js`. Bei reinen Textänderungen reicht es, nur die betroffene Sprachdatei zu lesen (je ~700 Zeilen statt 2900).

**drawFreqMatchChart (chart.js):** Zeichnet das Diagramm im Sub-Tab
„Frequenzabgleich" unter Meßergebnisse. X-Achse: log-Hz der CI-Frequenz
(`varFreq`). Y-Achse: lineare Cent-Abweichung (positiv = subjektiv höher
als CI-Frequenz, negativ = tiefer). Null-Linie = perfekter Match.
Zusätzlich: hohle graue Kreise (aktiv, ungemessen) und vertikale graue
Striche mit „×" (deaktiviert) für CI-Elektroden ohne Meßwert.

**lrDrawChart (lr-balance.js):** Zeichnet das Balken-Diagramm im Ergebnis-
Sub-Tab „Stereo-Balance". Zeichnet alle Elektroden bis `count`: gemessene
als farbige Balken, aktive ungemessene als gestrichelter Strich mit
Querstrich-Symbol auf der Null-Linie, deaktivierte als hellgrauer voller
Balken mit „X"-Diagonale.

**Anzeige-Konvention für alle drei Ergebnis-Sub-Tabs** (deaktiviert =
grauer Balken/Strich + X, aktiv-ungemessen = gestrichelter Umriss/Kreis,
Status-Text per i18n) ist **nicht** über einen gemeinsamen Helper
implementiert, sondern dreifach separat: in `drawChart` (chart.js) für
Elektrodenlautstärke-Balance, in `lrDrawChart` + `lrRenderResults`
(lr-balance.js) für Stereo-Balance, und in `drawFreqMatchChart` +
`renderFreqMatchResults` (results.js) für Frequenzabgleich.

Der Deaktiviert-Balken (hellgrauer Vollbalken + X-Diagonale)
wird über den gemeinsamen Helper `drawDisabledBar` aus
`chart.js` gezeichnet und ist damit konsistent zwischen
`drawChart` und `lrDrawChart`. `drawFreqMatchChart` nutzt einen
eigenen Stil (Vertikallinie statt Balken) wegen der log-Hz-Achse.

**Historisches Relikt:** Der Tab mit `data-tab="setup"` wird mit dem
i18n-Key `tabFreq` ("Implantat") beschriftet. Setup war der alte Name,
Implantat ist der aktuelle UI-Text. Wer nach „Frequenzen" sucht,
findet im aktuellen Build nichts mit diesem Namen.

**Dateinamen und Druck-Seitentitel:** Name (`userLastName`, `userFirstName`), Zusatz (`userFileSuffix`) und Datum werden zentral in `buildCImbelFilename` (file.js) zu Dateinamen nach dem Schema `CImbel_<Nachname-Vorname>_<Zusatz>_<Typ>_<Datum>.<ext>` zusammengebaut. Leere Blöcke fallen weg. `buildCImbelPrintTitle` (file.js) baut den HTML-`<title>` für alle Druckausgaben in der kompakten Form `<Basis> <Nachname> <Vorname> <Zusatz> JJ-MM-TT HH-MM` (Trenner: Leerzeichen, Bindestrich-Uhrzeit damit der vom Browser vorgeschlagene PDF-Dateiname keine Sonderzeichen enthält). Aufrufer übergeben Kurz-Titel über i18n-Keys `audiologTitleShort` und `archivTitleShort`; `openPrintWindow` akzeptiert dafür einen optionalen 3. Parameter `shortTitle`. Der sichtbare `<h1>`-Druck-Header (`buildPrintHeader`) bleibt davon unberührt. Beide Felder werden in `sessionStorage` (`ci-lb-userLastName`, `ci-lb-userFirstName`) pro Browser-Tab gespeichert und in der JSON-Archiv-Datei mitgesichert/geladen.

**Markdown-Export (Archiv-Box):** `collectArchivData` in
print-md.js liest einmal alle relevanten State-Variablen ein
(`sideData`, `lrResults`, `latencyResult`, `fRes`, alle
`plApply*`/`plBalanceMode`/`pMaplaw*`/`pWarp*`-Werte sowie
globale Test-/Levels-Tab-Werte) und liefert ein strukturiertes
Objekt. `renderArchivMarkdown(data)` rendert daraus den
Markdown-Bericht. Pro Seite wird `withSide(side, fn)` benutzt,
um die seiten-spezifische Live-View korrekt zu binden. Die
Aktionen „Markdown Text exportieren" und „Bericht drucken"
sitzen in der Archiv-Karte (`#cardArchiv`). Druck (`fPrintBtn`)
ruft `renderArchivPrintHtml(collectArchivData())`, wandelt den
Markdown über `_mdToHtmlBasic` in HTML und hängt PNG-Grafiken
pro Sektion ein (Messungen-Loudness, Schieber, Kurven,
Frequenzabgleich, Stereo-Balance, Player-EQ — pro Seite je
nach `*.has`-Gate). Der alte DOM-basierte Inline-Handler in
init.js ist entfernt.

**Audiologen-Auftrag (Modus B):** `buildAudiologMarkdown` in
print-md.js erzeugt einen strukturierten Korrektur-Bericht.
Reihenfolge: Kopf (Datum, Side, Tool-Version), Testprogramm-Hinweis
(falls erkannt), EQ-aus-Hinweis (falls EQ aus). Dann der bilaterale
Block — Sektionen, die beide Seiten gleichermaßen betreffen, in fester
Reihenfolge: Stereo-Balance, Latenz, Hinweise an den Audiologen,
Fehlende Implantat-Angaben (mit italic Einleitungssatz aus i18n-Key
`audiologMissingIntro`). Anschließend die Pro-Seite-Blöcke — erst
LINKS komplett, dann RECHTS komplett, kein Vermischen: Seiten-H2 mit
Meta-Zeile, dann H3 Lautstärken-Korrektur, H3 MAPLAW-Änderung (wenn
applikabel), H3 Änderung der Mittenfrequenzen (wenn applikabel).
`_audiologMaplawSection(mainSides, headerLevel)` unterstützt einen
optionalen Header-Level-Parameter (Default "##"); aus dem Pro-Seite-
Loop wird sie mit "###" aufgerufen, damit MAPLAW als H3 unter der
Seiten-H2 erscheint. Druck-Pfad (`audiologPrint`): zwei Chart-Injektionen mit je laufendem
`searchFrom`-Offset (bilateral-korrekt; Reihenfolge der Seiten-Blöcke
entspricht `mainSides`): ΔdB-Bar-Chart **vor** `<h3>audiologSecLoudness</h3>`
und — wenn `pWarpOn` — Frequenzabgleich-Graph (`_audiologFreqChartImg`)
**nach** `<h3>audiologSecFreq</h3>`. Bei sym-Warp + einseitigem Druck
(`pWarpMode === "symmetric"` && `mainSides.length === 1`) werden statt
einer zwei H3-Sektionen erzeugt — beide mit Side-Suffix
(`<h3>audiologSecFreq — ${sideLbl}</h3>`), eine für die gedruckte Seite,
eine für die andere; der Injektor sucht und befüllt entsprechend zwei
Marker pro mainSide. `_audiologFreqTable(side)` und `_audiologFreqChartImg(side)`
rendern nur die jeweils übergebene Seite (kein Misch-Modus mehr; die
sym-Doppelung lebt allein im Generator/Injektor). Druck nutzt
`openPrintWindow` aus print.js.

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
- index.html: neue `<option value="...">` im mfrSelect
- i18n.js: Strings für Hersteller-Namen und Felder
- freq-table.js: switchMfr-Logik, ggf. isXxx-Flags
- ui-implant.js: buildImplantCard (Hersteller-spezifische Felder)
- file.js: Hersteller-Vergleich in saveJson/applyLoadedData prüfen
- state-side.js: initSideData prüfen

### Neue Preset-Art (z.B. „Notch-Filter")
- core.js: PR_TYPES erweitern, PR_NAMES, PR_EXPL ergänzen, ggf.
  PR_HAS_CENTER / PR_HAS_WIDTH / PR_HAS_CUTOFF
- levels.js: calcPresetCurve um neuen Typ ergänzen, buildPrTbl paßt
  sich automatisch an PR_*-Konstanten an
- state-side.js: initPresets prüfen (Default-Werte für neuen Typ)
- i18n.js: Strings für PR_NAMES und PR_EXPL

### UI eines Tabs ändern
- index.html: HTML-Struktur des Panels
- Hauptmodul des Tabs (siehe Tabelle oben)
- evtl. i18n.js: neue Strings
- evtl. init.js: Event-Listener-Verdrahtung

### Aufbau eines Test-Sub-Tabs ändern
- **test-ui.js** ist der zentrale Ort. Änderungen am einheitlichen
  Aufbau (zusätzliche Zeile, geänderte Hinweisbox, neue Hook) gehören
  hierher.
- Anschließend Configs in test.js, lr-balance.js, freqmatch.js
  prüfen, ob neue Felder gesetzt werden müssen.

### Globaler State hinzufügen
- state-side.js: Variable deklarieren, Default setzen
- file.js: saveJson + applyLoadedData für Persistenz erweitern
- init.js: Autosave-Block für localStorage prüfen
- CODESTRUKTUR.md: in der state-side.js-Zeile mit aufnehmen

### Neuer Tab-Einzeldruck
- Tab-Modul oder init.js: Druck-Knopf-Listener registrieren
- print.js: nicht ändern (Infrastruktur ist stabil)
- Bei neuen Druck-Header-Feldern: i18n.js (alle 4 Sprachen),
  buildPrintHeader in print.js erweitern

### Neue JS-Datei hinzufügen oder bestehende entfernen
- index.html: `<script>`-Tag an passender Position einfügen oder
  entfernen
- **CODESTRUKTUR.md: Modul-Tabelle aktualisieren** (Nummerierung,
  Inhaltsbeschreibung, Querverweise im Datenfluss-Block)

### Neuer Event-Listener
- init.js (zentral) ODER direkt im jeweiligen Modul (siehe Player
  und LR-Balance als Vorbild)

### Markdown-Generator erweitern oder anpassen
- `print-md.js`: Datensammler `collectArchivData` um neue Felder
  erweitern, passenden `_archivMd*`-Sektion-Helfer hinzufügen
  und in `renderArchivMarkdown` einbinden.
- `i18n.js`: neue `archiv…`-Keys in allen vier Sprachen.
- Bei Verweis auf neue Tool-State-Variablen: deren Modul muß
  **vor** `print-md.js` im Loader stehen.

## Skripte und Hilfswerkzeuge

### scripts/fetch_common_voice.py

Pre-Fetch-Werkzeug für Common Voice 17.0 via `fsicoli/common_voice_17_0`
auf Hugging Face. Streamt den `train`-Split, filtert auf
Sprecher-Diversität und Wortlänge, schreibt kuratierte MP3-Auswahl nach
`assets/sentences/cv-<lang>/`. Wird lokal/im Codespace mit
`python scripts/fetch_common_voice.py --lang <iso> --count <n>`
aufgerufen. Lizenz der erzeugten Daten: CC0-1.0.

### scripts/build_embed.py

Erzeugt aus `assets/sentences/sentences.json` und den vorhandenen
MP3s pro Sprache eine kleine Lazy-Load-Datei
`assets/sentences/embed/<lang>.js` für den Offline-Modus
(5 Recordings pro Sprache, Audio als data:-URL). Lokal aufrufen nach
Korpus-Aktualisierung: `python3 scripts/build_embed.py`.

### scripts/build_manifests.py

Erzeugt die Manifest-Dateien unter `audio.manifest/` aus lokalen
Voice-Mirror-Verzeichnissen. Unterstützt Subkommandos `--only <corpus>`
für gezielte Teilbuilds. Erstellt nach einem vollständigen Lauf einen
Differenzen-Report `audio.manifest/_diff_report.md`, der fehlende
Audiodateien pro Corpus auflistet. Hauptkategorien: ARU Speech Corpus,
Common Voice, MUSAN, Librivox u. a.

### scripts/aru_ascii_rename.py

Benennt die Dateien im ARU-Mirror
(`voice/opus/ARU_Speech_Corpus_v1_0/`) von Leerzeichen- und
`=`-haltigen Originalnamen (`ID01_ARU_Fs=65536Hz_Standard speech - List 1 - Sentence 1 - Version 1_0.opus`)
auf ASCII-sichere URLs um (`id01-L01-S01-v1.opus`). Aktualisiert
anschließend die Sidecar-Datei `sentences_ARU.txt`, damit
`build_manifests.py` beim nächsten Lauf die neuen Namen findet.
Idempotent. Aufruf: `python3 scripts/aru_ascii_rename.py [--dry-run]
[--mirror <pfad>]`.

### Sprachdatensätze/ARU_Speech_Corpus_v1_0/sentences_ARU.txt

Manifest-Datei für den ARU Speech Corpus (12 Sprecher ID01–ID12,
72 Listen × 10 Sätze = 720 Texte, 8640 Einträge gesamt). Format:
`<dateiname.wav>: <satztext>` — Colon-Separator, Dateinamen enthalten
Leerzeichen. Wird vom generischen Manifest-Parser in `sentences.js`
(`sParseGenericManifest`, dritte Regex-Variante) automatisch erkannt,
sobald der ARU-Ordner in den Satzplayer hochgeladen wird. Die Datei
liegt direkt im Corpus-Ordner; der Browser findet sie beim
Ordner-Upload automatisch. Erzeugt mit `pypdf` aus dem beigelegten
`IEEE_wordlists.pdf` (Python-Snippet in den Commit-Kommentaren).

## Strukturelle Eigenschaften

- Kein ES-Module-System, kein import/export
- Kein IIFE-Wrapping. Alles globaler Scope
- Keine Typprüfung, kein Lint-Setup
- Build oder Bundling gibt es nicht – Browser lädt alle Module einzeln
- Keine automatisierten Tests; Prüfung manuell im Browser mit DevTools

Archiv-Ordner `archive/debug-tests/` (ab BA 83): hält
archivierte Bau-Diagnose-Tests aus abgenommenen Bauanleitungen.
Nicht Teil des aktiven Codes — wird vom Loader **nicht** geholt.
Reaktivierung via Zurück-Kopieren nach `js/debug-tests-current.js`.
