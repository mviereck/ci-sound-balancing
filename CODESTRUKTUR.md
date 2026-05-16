# CI Sound Balancing Tool – Codestruktur

Eine HTML-Datei lädt eine Reihe JavaScript-Module in fester Reihenfolge.
Kein Framework, kein Build-Schritt, alle Variablen im globalen Scope.

> **Wartung dieser Datei**: bei jeder strukturellen Änderung am Code
> sofort mit aktualisieren. Insbesondere: neue oder gelöschte JS-Datei,
> neue zentrale Funktion, neue globale Variable, neuer Tab oder Sub-Tab,
> verschobener DOMContentLoaded-Handler. Aktualisierung gehört in
> denselben Arbeitsschritt wie die Code-Änderung, nicht nachträglich.

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

Reihenfolge in `index.html` (`<button class="tab">`-Liste oben): Kurven
steht vor Schieber. Die `<panel-…>`-Divs darunter haben weiterhin die
historische Reihenfolge (schieber vor levels), das ist unkritisch — der
Inhalt ist DOM-ID-adressiert.

**Sub-Tabs in „Messungen"** (alle drei nutzen denselben Builder
`buildTestPanel` aus test-ui.js):

| Sub-Tab-Beschriftung | data-subtab | Hauptmodul |
|---|---|---|
| Elektrodenlautstärke ausgleichen | test | test.js |
| Stereo-Balance | balance | lr-balance.js |
| Frequenzabgleich | freqmatch | freqmatch.js |

**Sub-Tabs in „Meßergebnisse"**:

| Sub-Tab-Beschriftung | data-subtab | Hauptmodul |
|---|---|---|
| Elektrodenlautstärke-Balance (Default) | results | results.js |
| Stereo-Balance | lrresults | results.js, lr-balance.js |
| Frequenzabgleich | freqmatch | results.js |

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
über einen kleinen Inline-Loader im `<head>`. Der Loader hängt
`<script>`- und `<link>`-Tags dynamisch an `document.head` und
versieht jede URL mit einem Cachebuster-Parameter `?v=<wert>`. Wert
ist beim ersten Pageload pro Browser-Session `Date.now()`, persistiert
in `sessionStorage` unter dem Schlüssel `cacheBust`; weitere Reloads
in derselben Session nutzen denselben Wert (Cache greift). Neuer
Tab / Browser-Neustart → neuer Wert → alle Dateien frisch. Fallback
ohne `sessionStorage` (z.B. einige `file://`-Modi): `Date.now()` bei
jedem Reload. Zusätzlich stehen im `<head>` drei Meta-Tags
(`Cache-Control: no-cache, no-store, must-revalidate`, `Pragma:
no-cache`, `Expires: 0`) gegen das Caching der HTML selbst.

Die Reihenfolge der Module liegt als Array im Loader-Block in
`index.html` und muß bei neuen/entfernten Modulen dort gepflegt
werden. Dynamisch erzeugte Scripts mit `s.async = false` werden in
DOM-Einfüge­reihenfolge ausgeführt und blockieren das
`DOMContentLoaded`-Event, bis alle ausgeführt sind — Verhalten wie
zuvor mit statischen Tags.

| #  | Datei | Inhalt |
|----|-------|--------|
| 0  | version.js | `APP_VERSION` — einzige Stelle für die Versionsnummer. Muss vor allen anderen Skripten geladen werden. |
| 1  | i18n.js | Übersetzungsobjekt L (de/en/fr/es), `lang`, `t()`, `applyLang()`, `updateMfrSelectLabels()`, `updateRunExplain()`, Konstante `README_URLS` (Sprach→README-URL für Manual-Link im Intro) |
| 2  | core.js | `IMPLANTS`, `PROCESSORS`, `MFR`, `SIDES`, `PR_*`-Konstanten, `SII_THIRD_OCT`, `calc*`-Funktionen, `siiWeightsForFreqs`. Absolutmodus-Hilfsfunktionen: `LV_AXIS_MAX`, `lvAxisMaxFor`, `lvUnitLabelFor`, `dbFromMedel`, `dbFromCochlear`, `dbFromAB`. |
| 3  | state-side.js | Globaler State (`sideData`, `activeSide`, `mfr`, `nEl`, `freqs`, `elFreqOwn`, `elSt`, `elNt`, `elExDur`, `manualLevels`, `refEl`, `jRes`, `bRes`, `config`, `presets`, `defaultMfr`, `globalToneType`, `globalSequence`, `slTarget_*`, `plSrcMeas`, `plSrcLevels`, `plSrcCurves`, `lvTabShowMeas`, `lvTabShowCurves`, `lvTabMode`, `lvTabVariant`). Side-Logik: `bindActiveSide`, `setActiveSide`, `withSide` (temporärer Side-Wechsel ohne UI-Update, für Druck/Export), `initSideData`, `loadSideData`. Konfig pro Seite: `setSideConfig`, `getFreqSource`, `syncFreqsToAcoustic`. Player-Side: `getPlayerSide` (liefert "left"/"right"/"both"/"mono"), `getPlayerBalance` (Inter-Ohr-Offset aus Mittelwert von `lrResults`). UI-Helper: `updSideButtons`, `updFClearBtn`, `dEN`, `dENPrefix`, `effFreq`, `fRes`. Top-Level-Init am Dateiende. |
| 4  | audio.js | AudioContext, `playTone`, `playSweep`, `playSeq`, `playFreqPair`, `gAC`, `dB2G`, `corrG`, `updInd` |
| 5  | ui-implant.js | `buildImplantCard`, `updCochlearGen` |
| 6  | freq-table.js | `buildFreqTable`, `switchMfr`, `resetFreqs`, `actEl`, `allEl`, `allPairs`, `shuffle`, `randAB`, `gWt` |
| 7  | test-ui.js | Einheitliche Test-UI für die drei Sub-Tabs in „Messungen": `buildTestPanel`, `setTestExclConfirm`, `lockTestTabs`, `syncAllGlobalDropdowns`, interne `_syncGlobalDropdowns`, `_mkEl`. Erzeugt drei Blöcke (Erklärungen, Voreinstellungen, Test) per Config-Objekt. |
| 8  | test.js | `ROUND_ROBIN`-Tabelle, `compWLS`, `startTest`, alle Test-Sub-Funktionen. Bindet sich an die von test-ui.js erzeugte UI. |
| 9  | freqmatch.js | Frequenzabgleich-Test (Sub-Tab freqmatch). `fmStart`, `fmConfirm`, `fmAbort`, `fmApplyLang`, `fmPlayCurrent`. Eigener DOMContentLoaded-Handler. Bindet sich an die von test-ui.js erzeugte UI. |
| 10 | results.js | `renderResults`, `renderFreqMatchResults` |
| 11 | chart.js | `drawDisabledBar` (Helper, auch von lr-balance.js genutzt), `drawChart` (Meßergebnisse), `drawFreqMatchChart`, `_fmcTooltipHandler` |
| 12 | file.js | `saveJson`, `loadJson`, `applyLoadedData`, `resetAll`, `expText`, `copyRes`, `exportEasyEffects` |
| 12b | print.js | Druck-Infrastruktur: `buildPrintHeader` (Mini-Kopf für Einzelausdrucke), `openPrintWindow` (neues Fenster, HTML schreiben, drucken), `canvasToImg` (Canvas → `<img>` PNG-Daten-URL). Wird von den Tab-spezifischen Druck-Handlern in den jeweiligen Tab-Modulen aufgerufen. Der zentrale „Alles drucken"-Button (`fPrintBtn` in init.js) ist unabhängig davon. |
| 12c | tab-print.js | Tab-spezifische Druck-Funktionen: `printImplantTab` (Implantat-Tab), `printErgebnisseTab` (Dispatcher Meßergebnisse-Sub-Tabs), `_printResLoudness`, `_printResLR`, `_printResFreqmatch`, `_printCloneSafe` (DOM-Klon mit Canvas→img-Ersatz), `printKurvenTab` (Kurven-Tab, Chart-Card + Kurvenfunktionen-Card), `_buildPresetCardPrint` (datengetriebene Preset-Tabelle für Druck: nur aktive Kurven, Werte als Text), `printSchieberTab` (Schieber-Tab: Canvas-Bild + Werte-Tabelle pro Elektrode, im Absolutmodus mit Hersteller-Einheit-Spalte). Nutzen die Helper aus `print.js`. |
| 13 | tabs-eq.js | `switchTab`, `updateTabLockState`, `updPlSrcButtons`, `updEqToggleBtn`, `updBalApplyBtn`. Sperre umfaßt Top-Level-Tabs **und** Sub-Tabs in Messungen. |
| 14 | levels.js | `calcPresetCurve`, `getTotalPresetCurve`, `getEffectiveLevels` (noch in expText/file.js genutzt), `buildPrTbl`, `drawLvChart`, `lvOnChange`, `applyPresetDeltaOtherSide`. `buildLvGrid`, `updLvFocus`, `updAllBars` sind entfernt. |
| 14b | levels-tab.js | Schieber-Tab (sichtbar „Levels"): `lvTabDraw` (Dispatcher), `lvTabDrawRelative`, `lvTabDrawAbsolute`, diverse Helper-Zeichenfunktionen (`lvTabDrawExcludedColumn`, `lvTabDrawNoMclColumn`, `lvTabDrawStackRelative`, `lvTabDrawSumBarRelative`, `lvTabDrawStackAbsolute`, `lvTabDrawSumBarAbsolute`, `lvTabDrawFocusAndSum`, `lvTabDrawLabelsRelative`, `lvTabDrawCompareLinesRelative`, `lvTabDrawCompareLinesAbsolute`), `lvTabAbsoluteAvailable`, `lvTabUpdateModeAvailability`, `lvTabElHasMcl`, `lvTabNavigableEl`, `lvTabStepAbsolute`, `lvTabRebuild`, `lvTabOnSchieberChange`, `lvTabResetAll`. Eigener DOMContentLoaded-Handler mit focus/blur-Listenern auf dem Canvas. State: `lvTabFocus` (lokal), `lvTabHasFocus` (lokal, true wenn Canvas Tastatur-Fokus hat — steuert die Umrahmung der aktiven Elektrode), `lvTabShowMeas`, `lvTabShowCurves`, `lvTabMode`, `lvTabVariant` (alle in state-side.js). Canvas hat `tabindex="0"`, damit es per Klick oder Tab-Taste fokussierbar ist. |
| 15 | player.js | Player-State, `gPC`, `pBuildEQ`, `pUpdEQ`, `pPlay` (async), `pDrawEQ` + eigene Top-Level-Listener für plAudio/plPlay/plStop/plTL und window.resize. State: `pSrc` (Einzel-Quelle), `pCurrentPlayback` ({sources, stop()} für Variante B/A), `pPlayGen` (Generationszähler gegen Stale-Async) |
| 16 | freq-warp.js | Frequenz-Warping (alle Verfahren). `buildWarpPoints`, `_warpAffectedSides`, `_warpSideGains`, `centShift`, `pComputeWarpedBuffer`, `pBuildWarpedGraph`, `pBuildVocoderGraph`, `pInitWarpWorklet`, `pWarpTrigger`, `pWarpUpdUI`, `pWarpLiveUpdate` (postMessage an laufenden Vocoder-Worklet ohne Pfadwechsel). State: `pWarpedBuf`, `pWarpOn`, `pWarpMode`, `pWarpStrength`, `pWarpBusy`, `pWarpMethod`, `pWarpWorkletReady`, `pWarpAffected`. Worklet-Code liegt als String-Konstante `_FREQ_WARP_PROCESSOR_CODE` im selben Modul; `pInitWarpWorklet` lädt ihn per Blob-URL (funktioniert auch unter `file://`). Worklet-Methoden: `_processFrame` (Phasen-Vocoder mit Identity Phase Locking), `_processFrameSinModel` (Sinusoidal Modeling: Peak-Tracking + Quadratic Interpolation + Spectral Spread, Residual unverschoben). Worklet-State zusätzlich: `algorithm` ("phase_vocoder" | "sinmodel"), `smMaxPeaks`, `smPrevPeakCount`, `smPrevPeakFreq`, `smPrevPeakPhase`. `_VOCODER_FFT_SIZE` (synchron mit `FFT_SIZE` im Worklet) wird für den L/R-Sync-Delay im Vocoder-Graph gebraucht. |
| 17 | lr-balance.js | Stereo-Balance-Tab. Eigener DOMContentLoaded-Handler und eigener Tab-Hook für `balance`. Bindet sich an die von test-ui.js erzeugte UI. |
| 18 | init.js | Der große DOMContentLoaded-Handler mit `applyLang()`, `buildImplantCard()`, allen Event-Verdrahtungen, Autosave-Setup |

## Datenfluss (nicht aus Namen ablesbar)

**Globaler State** liegt komplett in `state-side.js`. Wer auf
`sideData`, `activeSide`, `mfr`, `nEl`, `freqs`, `manualLevels`,
`presets`, `bRes`, `lvFocus`, Audio-State-Variablen, Test-State-
Variablen, die globalen Test-Einstellungen (`globalToneType`,
`globalSequence`, `slTarget_test`, `slTarget_balance`) oder die
Levels-Tab-Anzeigestate (`lvTabShowMeas`, `lvTabShowCurves`,
`lvTabMode`, `lvTabVariant`) zugreift, findet die Deklaration dort.

**State pro Seite vs. globale Live-View:** Die persistierten
Daten leben pro Seite in `sideData.left.*` / `sideData.right.*`
(insbesondere `manufacturer`, `nEl`, `freqs`, `elFreqOwn`, `elSt`,
`elNt`, `elExDur`, `manualLevels`, `refEl`, `jRes`, `bRes`,
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
Nicht-CI-Konfig `syncFreqsToAcoustic()`. `getFreqSource()` liefert
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
`"left"`, `"right"`, `"both"` oder `"mono"` abhängig von den
Checkboxen `plBothSides` und `plMonoEQ`. „both" = Stereo mit
getrennten EQ-Ketten pro Kanal (`pEqFLeft` / `pEqFRight`),
gespeist über `pChannelSplitter` und `pChannelMerger`. „mono" =
beide Seiten, aber identischer EQ (Durchschnitt der beiden
Seiten-Korrekturen). „left"/"right" = nur die jeweilige Seite hörbar
mit deren EQ-Kette; der Gegenkanal ist stumm. `updatePlayerForSideChange`
(player.js) baut den Audio-Graph bei Side-Wechsel oder
Modus-Änderung neu auf — auch während laufender Wiedergabe (mit
kurzer Unterbrechung).

**Inter-Ohr-Vergleich (Gesamtoffset L↔R):** `getPlayerBalance()`
in state-side.js berechnet den Mittelwert über alle gemessenen
`lrResults` (Stereo-Balance-Test) und liefert daraus ein
symmetrisches Stereo-Balance-Offset (positiv = rechts louder →
negativer Offset dämpft rechts ab). Wird im Player angewandt,
wenn die Checkbox „Stereo-Balance anwenden" (`plApplyBalance`) an
ist. Begrenzt auf ±60 dB.

**Schieber-Tab-Modus und -Variante** (`lvTabMode`, `lvTabVariant`):
`lvTabMode` steuert den Anzeigemodus (`"rel"` = relativ ±dB,
`"abs"` = absolut in Hersteller-Einheit). `lvTabVariant` steuert die
Darstellungsvariante (`"stack"` = Diverging Stack — Default, `"sum"`
= nur Summenbalken, `"lines"` = Summenbalken + Vergleichslinien —
Radio ist im aktuellen Build per `display:none` ausgeblendet, Zeichen-
Code und Persistenz bleiben aktiv). Die Variante bleibt beim Modus-
Wechsel (rel ↔ abs) und beim MCL-Fallback **erhalten** — keine
automatische Anpassung. Beide Werte sind in JSON + localStorage
persistiert. `lvTabUpdateModeAvailability` prüft MCL-Verfügbarkeit
und graut ggf. den „absolut"-Radio aus; wird bei `lvTabRebuild` (Tab-
Wechsel, Side-Wechsel) und nach Datei-Laden aufgerufen.

**Absolutmodus-Präzision von `manualLevels`:** Im Absolutmodus
speichert `lvTabOnSchieberChange` die dB-Werte in `manualLevels[i]`
**ohne Rundung** (volle Float-Präzision). Bei hohem MCL ist ein
einzelner qu/CL/CU-Schritt eine sehr kleine dB-Änderung (z.B. +1 qu
bei MCL=200 ≈ 0.022 dB); jede Rundung auf 0.1 dB würde Schritte
schlucken und den Schieber blockieren. Im Relativmodus bleibt die
Rundung auf 0.1 dB. Anzeige-Rundung (z.B. `.toFixed(1)` im Draw-Pfad)
ist davon unabhängig.

**Levels-Tab Fokus-Modell:** `lvTabHasFocus` (in levels-tab.js) ist
nur dann `true`, wenn das Canvas (`#lvTabCv`) das fokussierte Element
ist. Die schwarze Umrahmung der aktuell aktiven Elektrode wird nur
gezeichnet, wenn `lvTabHasFocus === true`. Die globale Pfeiltasten-
Navigation (init.js Z. 887) reagiert nur, wenn das Canvas der
`document.activeElement` ist. `lvTabNavigableEl()` liefert die in der
aktuellen Modus-Konfiguration anwählbaren Elektroden: im Relativmodus
identisch zu `actEl()`, im Absolutmodus zusätzlich gefiltert auf
Elektroden mit eingetragenem MCL (`lvTabElHasMcl`). Klick + ←/→
springen daher im Absolutmodus über Elektroden ohne MCL hinweg.

**Globale Test-Einstellungen** (`globalToneType`, `globalSequence`)
gelten für alle drei Sub-Tabs in „Messungen". Änderung in einem
Test wirkt live in den anderen, vermittelt durch
`syncAllGlobalDropdowns` aus test-ui.js.

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
(alle in state-side.js, alle Default `true`). In `computeGains`
(player.js) werden drei unabhängige Summanden berechnet:
`plSrcMeas` → Messwerte aus `compWLS()`, `plSrcLevels` → nur
`manualLevels` (Schieber-Werte), `plSrcCurves` → nur
`getTotalPresetCurve()` (Preset-Anteil). Alle drei haben eigene
Buttons im Player-Panel.

**Preset-Berechnung** (`calcPresetCurve`, `getTotalPresetCurve`,
`getEffectiveLevels`) liegt in `levels.js`. `getEffectiveLevels`
wird nur noch von `expText` (file.js) genutzt; player.js greift
seit Bauanleitung 04 direkt auf `getTotalPresetCurve()` zu.

**Levels → Player Live-Update:** `lvOnChange` in levels.js ruft am
Ende `pUpdEQ()` aus player.js auf. Außerdem ruft es `lvTabDraw()`
auf, damit der Schieber-Canvas synchron bleibt. Dadurch aktualisiert
sich der Player-Equalizer sofort, wenn manuelle Levels oder Presets
geändert werden.

**applyLang ruft modulübergreifend:** `updEqToggleBtn`,
`updBalApplyBtn` (beide tabs-eq.js), `updSideButtons` (state-side.js),
`updateRunExplain` (i18n.js), `buildFreqTable` (freq-table.js),
`buildImplantCard` (ui-implant.js), `renderResults` (results.js),
`renderFreqMatchResults` (results.js, nur wenn freqmatch-Sub-Tab aktiv).

**Test-UI über Builder:** Die drei Sub-Tab-Hauptmodule (test.js,
lr-balance.js, freqmatch.js) erzeugen ihre UI nicht selbst, sondern
rufen `buildTestPanel(parentEl, cfg)` aus test-ui.js auf und greifen
auf das zurückgelieferte Element-Lookup-Objekt zu. UI-Änderungen am
einheitlichen Aufbau gehören in test-ui.js, nicht in die einzelnen
Test-Module.

**refEl-Wirkung:** `refEl` beeinflusst ausschließlich Anzeige und
Anwendung der Ergebnisse — konkret: WLS-Eichung in `compWLS`
(test.js), Highlight in `drawChart` (chart.js), Player-
Korrekturgewicht via `corrG` (audio.js), `pUpdEQ` (player.js).
`refEl` hat **keine** Wirkung auf die Messung selbst (rohe
Vergleichspaare `bRes`/`jRes`). Das Dropdown zur Wahl der
Referenzelektrode sitzt im Ergebnis-Reiter (`#refEl`, befüllt
durch `updRef` in freq-table.js, Listener in init.js, triggert
`renderResults`/`drawLvChart`/`pUpdEQ`). In test.js wird `refEl`
nicht mehr beim Test-Start überschrieben.

**Tab-Sperre während Test:** sobald ein Test in einem der drei
Sub-Tabs läuft, sperrt `updateTabLockState` (tabs-eq.js) alle
Top-Level-Tabs **und** alle Sub-Tabs in Messungen außer dem aktiven.

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

**i18n L-Objekt** ist die größte Datei. Code-Anteil davon ist klein.
Bei reinen Textänderungen reicht es, i18n.js zu lesen.

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

## Strukturelle Eigenschaften

- Kein ES-Module-System, kein import/export
- Kein IIFE-Wrapping. Alles globaler Scope
- Keine Typprüfung, kein Lint-Setup
- Build oder Bundling gibt es nicht – Browser lädt alle Module einzeln
- Keine automatisierten Tests; Prüfung manuell im Browser mit DevTools
