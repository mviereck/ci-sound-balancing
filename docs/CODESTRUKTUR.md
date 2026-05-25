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
| Unterstützung | unterstuetzung | finanzen.js, unterstuetzung.js |

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
über zwei kleine Inline-Loader im `<head>`. Der **erste Loader** lädt
synchron `js/version.js` mit `?t=<Date.now()>` (immer frisch, ein
kleiner Roundtrip). Damit ist `APP_VERSION` verfügbar, bevor der
zweite Loader läuft. Der **zweite Loader** schreibt `<link>`- und
`<script defer src=…>`-Tags per `document.write` in den
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

Frühere Variante mit `sessionStorage`-`cacheBust` (Wert =
`Date.now()`, persistiert pro Browser-Session) ist seit Bauanleitung
57 entfernt. Sie scheiterte auf Smartphones, weil Tabs dort tagelang
im Hintergrund leben und `sessionStorage` mit der alten Buster-Zahl
hängenbleibt → Updates wurden auf dem Handy oft nicht gezogen.

Wichtig zur Loader-Wahl: Per `document.write` eingefügte
`<script defer>`-Tags sind aus Browser-Sicht parser-eingefügt; `defer`
greift, sie laden parallel, werden in Dokumentreihenfolge ausgeführt
und blockieren `DOMContentLoaded`, bis alle ausgeführt sind. Eine
frühere Variante mit `document.createElement('script')` +
`appendChild` und `s.async = false` blockierte `DOMContentLoaded`
nicht (HTML5-Spec für dynamisch eingefügte Skripte): auf `file://`
fiel das nicht auf, weil das Dateisystem die Skripte praktisch instant
liefert; über HTTP (z.B. GitHub Pages) feuerte `DOMContentLoaded`
zwischen Loader und init.js, und sämtliche
`DOMContentLoaded`-Handler (init.js, test.js, lr-balance.js,
levels-tab.js, freqmatch.js) wurden nie aufgerufen → nur die zwei Tabs
mit hartcodiertem Text waren sichtbar, kein Click reagierte.

Die Reihenfolge der Module liegt als Array im Loader-Block in
`index.html` und muß bei neuen/entfernten Modulen dort gepflegt
werden. Die Loader-Liste enthält seit Bauanleitung 56 `js/`-Pfade
(z.B. `js/audio.js`).

Alle Logik-JS-Dateien liegen unter `js/`. Die Sprachdaten in
`i18n/de.js` etc. bleiben im Root-Ordner `i18n/` (kein `js/`-Prefix).

| #  | Datei | Inhalt |
|----|-------|--------|
| 0  | version.js | `APP_VERSION` — einzige Stelle für die Versionsnummer. Wird vom ersten Inline-Loader in `index.html` synchron mit `?t=<Date.now()>` geladen (nicht über die Loader-Liste). Bei jeder Bauanleitung auf `"2.<Bauanleitungsnummer>-beta"` hochsetzen, sonst zieht der Browser-Cache keine neuen Dateien. |
| 0b | mobile.js | `IS_TOUCH_ONLY` (Touch-Erkennung per `matchMedia('(hover: none) and (pointer: coarse)')`), `safeFocus(el)` (focus-Aufruf nur auf Nicht-Touch-Geräten), `applyMobileReadonly(root)` (setzt `readonly` und `inputmode="numeric"` auf allen `input[type="number"]` im übergebenen Wurzelelement, no-op auf Desktop). Eigener DOMContentLoaded-Handler, der `applyMobileReadonly(document)` einmalig nach Page-Load aufruft. Wird von freq-table.js, levels.js, test-ui.js nach dynamischen Rebuilds erneut aufgerufen. |
| 0c | touch-ctrl.js | `attachLongPress(btn, onStep)` (Klick + Long-Press 400 ms initial / 100 ms repeat), `buildSliderTouchCtrl(slider, opts)` (Touch-Bedienleiste mit − / Fein / + / [Replay] direkt nach dem Slider, dispatcht `input`-Event auf den Slider), `buildStepperPair(opts)` (zwei Buttons mit Long-Press, Aufrufer hängt selbst ein). Kein eigener DOMContentLoaded-Handler; Aufrufer instanzieren wo gebraucht. |
| 1  | i18n.js | **Core:** leeres Übersetzungsobjekt `L = { de: {}, en: {}, fr: {}, es: {} }`, `lang`, `t()`, `applyLang()`, `updateMfrSelectLabels()`, `updateRunExplain()`, Konstante `README_URLS`. Sprachdaten liegen in `i18n/de.js` … `i18n/es.js`, die danach geladen werden. |
| 1a | i18n/de.js | Deutsche Übersetzungen — befüllt `L.de` via `Object.assign(L.de, { … })`. Muss nach `i18n.js` geladen werden (nutzt `L`). |
| 1b | i18n/en.js | Englische Übersetzungen — befüllt `L.en` via `Object.assign(L.en, { … })`. |
| 1c | i18n/fr.js | Französische Übersetzungen — befüllt `L.fr` via `Object.assign(L.fr, { … })`. |
| 1d | i18n/es.js | Spanische Übersetzungen — befüllt `L.es` via `Object.assign(L.es, { … })`. |
| 2  | core.js | `IMPLANTS`, `PROCESSORS`, `MFR`, `SIDES`, `PR_*`-Konstanten, `SII_THIRD_OCT`, `calc*`-Funktionen, `siiWeightsForFreqs`. Absolutmodus-Hilfsfunktionen: `LV_AXIS_MAX`, `lvAxisMaxFor`, `lvUnitLabelFor`, `dbFromMedel`, `dbFromCochlear`, `dbFromAB`. Frequenz-Hilfsfunktionen (Cent re 1000 Hz): `CENT_REF_HZ`, `hzToCent`, `centToHz`, `logInterpHz`, `meanCentStepOfFreqs`. |
| 3  | state-side.js | Globaler State (`sideData`, `activeSide`, `mfr`, `nEl`, `freqs`, `elFreqOwn`, `elSt`, `elNt`, `elExDur`, `manualLevels`, `refEl`, `jRes`, `bRes`, `config`, `presets`, `defaultMfr`, `globalToneType`, `globalSequence`, `slTarget_*`, `plSrcMeas`, `plSrcLevels`, `plSrcCurves`, `lvTabShowMeas`, `lvTabShowCurves`, `lvTabMode`, `lvTabVariant`, `plShowExperimental`, `plBalanceMode`, `audiologUserNote`, `userFileSuffix` (top-level, beide Seiten gemeinsam)). Side-Logik: `bindActiveSide`, `setActiveSide`, `withSide` (temporärer Side-Wechsel ohne UI-Update, für Druck/Export), `initSideData`, `loadSideData`. Konfig pro Seite: `setSideConfig`, `getFreqSource`, `syncFreqsToAcoustic`. Player-Side: `getPlayerSide` (liefert "left"/"right"/"both"), `getPlayerBalance` (Inter-Ohr-Offset aus Mittelwert von `lrResults`), `getPlayerBalanceGains` (liefert {left, right} dB unter Berücksichtigung von `plBalanceMode`; respektiert `plApplyBalance`), `getRawBalanceGains` (wie `getPlayerBalanceGains`, aber ignoriert `plApplyBalance` — für Meßtests). UI-Helper: `updSideButtons`, `updFClearBtn`, `dEN`, `dENPrefix`, `effFreq`, `fRes`. Top-Level-Init am Dateiende. |
| 4  | audio.js | AudioContext, `playTone`, `playSweep`, `playSeq`, `playFreqPair`, `gAC`, `dB2G`, `corrG`, `updInd` |
| 5  | ui-implant.js | `buildImplantCard`, `updCochlearGen` |
| 6  | freq-table.js | `buildFreqTable`, `switchMfr`, `resetFreqs`, `actEl`, `allEl`, `allPairs`, `shuffle`, `randAB`, `gWt` |
| 7  | test-ui.js | Einheitliche Test-UI für die drei Sub-Tabs in „Messungen": `buildTestPanel`, `setTestExclConfirm`, `lockTestTabs`, `syncAllGlobalDropdowns`, interne `_syncGlobalDropdowns`, `_mkEl`. Erzeugt drei Blöcke (Erklärungen, Voreinstellungen, Test) per Config-Objekt. |
| 8  | test.js | `ROUND_ROBIN`-Tabelle, `compWLS`, `startTest`, alle Test-Sub-Funktionen. Bindet sich an die von test-ui.js erzeugte UI. |
| 9  | freqmatch.js | Frequenzabgleich-Test (Sub-Tab freqmatch). `fmStart`, `fmConfirm`, `fmAbort`, `fmApplyLang`, `fmPlayCurrent`, `fmCorrGain` (Korrektur-Gain pro Seite/Frequenz, interpoliert). Nutzt `getRawBalanceGains()` statt `getPlayerBalanceGains()` — Balance wird immer angewendet, unabhängig von `plApplyBalance`. Eigener DOMContentLoaded-Handler. Bindet sich an die von test-ui.js erzeugte UI. |
| 10 | results.js | `renderResults`, `renderFreqMatchResults` |
| 11 | chart.js | `drawDisabledBar` (Helper, auch von lr-balance.js genutzt), `_drawRefElLabel` (Helper, auch von player.js und print-md.js genutzt — zeichnet fettes „Ref.-El."-Label an der Referenzelektroden-Position), `buildLinearAxis(electrodes, padLeft, plotW, hzGetter?)` (gleichmäßige Elektroden-Verteilung über die Plot-Breite, elektrodennummern-basiert; liefert `hzArr` für die Hz-Beschriftung; verwendet von `drawChart` und `lrDrawChart` seit Bauanleitung 67), `buildCentAxis(electrodes, padLeft, plotW, hzGetter?)` (Cent-x-Achsen-Berechnung — seit Bauanleitung 67 nur noch im Kurven-Tab und in den Archiv-Druck-Renderern verwendet, nicht mehr in `drawChart`/`lrDrawChart`; optionaler `hzGetter`, Default ist `effFreq`), `_attachAxisTooltip` + `_axisTooltipHandler` (Hover-Tooltip über x-Achsen-Labels; zeigt **bedingt** Hz wenn `hit.hz != null` und Cent wenn `hit.cent != null`; nutzt `cv._axisHits` vom Caller, gemeinsame Tooltip-Div `#axisTooltip`), `drawChart` (Meßergebnisse, x-Achse elektrodennummern-basiert, Hz unter Achse), `drawFreqMatchChart`, `_fmcTooltipHandler` |
| 12 | file.js | `saveJson`, `loadJson`, `applyLoadedData`, `resetAll`, `exportEasyEffects`, `_safeUserFileSuffix`, `_applyUserFileSuffix`, `_migratePresetsFromIndexToFreq` (Migration alter Preset-Index-Werte auf Hz/Cent beim Laden). |
| 12b | print.js | Druck-Infrastruktur: `buildPrintHeader` (Mini-Kopf für Einzelausdrucke; bindet Logo `assets/images/logo_briefkopf6.png` rechts oben ein, Höhe 150 px, Flexbox-Layout mit Titel+Subtitle links, Logo rechts), `openPrintWindow` (neues Fenster, HTML schreiben, drucken), `canvasToImg` (Canvas → `<img>` PNG-Daten-URL). Wird von den Tab-spezifischen Druck-Handlern in den jeweiligen Tab-Modulen aufgerufen. Der zentrale „Alles drucken"-Button (`fPrintBtn` in init.js) ist unabhängig davon. |
| 12d | print-md.js | Markdown-Generatoren für Archiv-Box (Modus A) und Audiologen-Box (Modus B). Modus A: Datensammler `collectArchivData` plus Renderer `renderArchivMarkdown` und Sektion-Helfer `_archivMd*`. Interne Sammler-Helfer: `_collectGlobalTest`, `_collectSideData`, `_collectBilateral`, `_collectPlayer`, `_collectSaetze`, `_pickUpperLevel`, `_calcAbsDelta`. Druck-HTML: `renderArchivPrintHtml` (wandelt Markdown via `_mdToHtmlBasic` in HTML, injiziert PNG-Grafiken und bindet Logo `assets/images/logo_briefkopf6.png` per `float: right` am Body-Anfang ein — kein `buildPrintHeader`-Pfad), `_archivInjectInserts` (HTML-Injektor per H2/H3-Anker), sechs Canvas-Renderer `_archivChartLoudness`, `_archivChartSchieber`, `_archivChartKurven`, `_archivChartFreqmatch`, `_archivChartLR`, `_archivChartPlayerEq` (alle außer Freqmatch nutzen `buildCentAxis` aus chart.js für die x-Position, Freqmatch hat seit jeher eine log-Hz-Achse — cent-äquivalent); Zeichenhelfer `_archivMkCanvas`, `_archivDrawAxis`, `_archivDrawElCentLabel` (gemeinsame dreizeilige x-Achsen-Beschriftung E / Hz / ¢, ausgedünnt nach `axis.step`), Konstanten `_ARCHIV_CHART_W`/`_H`. Modus B: `buildAudiologMarkdown`, `audiologPrint`, `mdAudiologFilename`, Helfer `_audiologMainSides`, `_audiologSideLabel`, `_audiologDbForSide`, `_audiologResForSide`, `_audiologAbsDelta`, `_audiologLoudnessTable`, `_audiologFreqTable`, `_audiologMaplawSection`, `_audiologBalanceBlock`, `_audiologLatencyBlock`, `_audiologTestProgramHint`, `_audiologIsTestProgram`, `_audiologMissingImplantData`, `_audiologAdvice`, `_audiologLastMeas`, `_audiologConfigLabel`, `_audiologChartImg` (2×-Auflösung, Residuum-Fehlerbalken), Mini-MD→HTML-Konverter `_mdToHtmlBasic`. Entfernte i18n-Schlüssel: `audiologRequestsBody`, `audiologSecRequests`, `audiologSecUserNote`, `audColHzOld`, `audColHzNew`, `audiologToolVersion`. Neue i18n-Schlüssel: `audiologToolVersionLine`, `audColHzDefault`, `audColHzManual`, `audColHzWish`, `audMissThr`, `audMissFreqOwn`, `audiologMissingIntro`. Gemeinsame Helfer: `mdCopyToClipboard`, `mdDownload`, `mdArchivFilename`, `mdDateStampFile`, `_mdEsc`, `_mdFmtDb`, `_mdFmtHz`, `_mdBilateralLabel`. Lädt zwischen `print.js` und `tab-print.js`. |
| 12c | tab-print.js | Tab-spezifische Druck-Funktionen: `printImplantTab` (Implantat-Tab), `printErgebnisseTab` (Dispatcher Meßergebnisse-Sub-Tabs), `_printResLoudness`, `_printResLR`, `_printResFreqmatch`, `_printResLatency`, `_printCloneSafe` (DOM-Klon mit Canvas→img-Ersatz), `printKurvenTab` (Kurven-Tab, Chart-Card + Kurvenfunktionen-Card), `_buildPresetCardPrint` (datengetriebene Preset-Tabelle für Druck: nur aktive Kurven, Werte als Text), `printSchieberTab` (Schieber-Tab: Canvas-Bild + Werte-Tabelle pro Elektrode, im Absolutmodus mit Hersteller-Einheit-Spalte). Nutzen die Helper aus `print.js`. |
| 13 | tabs-eq.js | `switchTab`, `updateTabLockState`, `updPlSrcButtons`, `updEqToggleBtn`, `updBalApplyBtn`, `updLatApplyBtn`. Sperre umfaßt Top-Level-Tabs **und** Sub-Tabs in Messungen. |
| 14 | levels.js | `calcPresetCurve`, `getTotalPresetCurve`, `getEffectiveLevels` (noch in expText/file.js genutzt), `buildPrTbl`, `drawLvChart`, `lvOnChange`, `applyPresetDeltaOtherSide`. `buildLvGrid`, `updLvFocus`, `updAllBars` sind entfernt. |
| 14b | levels-tab.js | Schieber-Tab (sichtbar „Levels"): `lvTabDraw` (Dispatcher), `_lvTabBuildAxis` (lokale Hilfsfunktion: gleichmäßige x-Verteilung der Elektroden über die Plot-Breite, rein elektrodennummern-basiert — kein Frequenzbezug), `lvTabDrawRelative`, `lvTabDrawAbsolute` (beide elektrodennummern-basiert via `_lvTabBuildAxis`; Säulen sitzen an gleichmäßiger x-Position, Säulenbreite an `axis.minDx` gekoppelt; pro Spalte wird `xMid` in das `col`-Objekt geschrieben), diverse Helper-Zeichenfunktionen (`lvTabDrawExcludedColumn`, `lvTabDrawNoMclColumn`, `lvTabDrawStackRelative`, `lvTabDrawSumBarRelative`, `lvTabDrawStackAbsolute`, `lvTabDrawSumBarAbsolute`, `lvTabDrawFocusAndSum`, `lvTabDrawLabelsRelative` (einzeilig: nur Elektroden-Bezeichnung), `lvTabDrawCompareLinesRelative`, `lvTabDrawCompareLinesAbsolute` (beide nehmen `col.xMid` statt `slotW` zur Positionierung)), `lvTabAbsoluteAvailable`, `lvTabUpdateModeAvailability`, `lvTabElHasMcl`, `lvTabNavigableEl`, `lvTabStepAbsolute`, `lvTabRebuild`, `lvTabOnSchieberChange`, `lvTabResetAll`. Kein x-Achsen-Tooltip im Schieber-Tab — der Schieber verändert ausschließlich dB-Korrekturen pro Elektrode, daher kein Frequenzbezug auf der x-Achse. Eigener DOMContentLoaded-Handler mit focus/blur-Listenern auf dem Canvas. State: `lvTabFocus` (lokal), `lvTabHasFocus` (lokal, true wenn Canvas Tastatur-Fokus hat — steuert die Umrahmung der aktiven Elektrode), `lvTabShowMeas`, `lvTabShowCurves`, `lvTabMode`, `lvTabVariant` (alle in state-side.js). Canvas hat `tabindex="0"`, damit es per Klick oder Tab-Taste fokussierbar ist. |
| 15 | player.js | Player-State, `gPC`, `pBuildEQ`, `pUpdEQ`, `pPlay` (async), `pDrawEQ` + eigene Top-Level-Listener für plAudio/plPlay/plStop/plTL und window.resize. State: `pSrc` (Einzel-Quelle), `pCurrentPlayback` ({sources, stop()} für Variante B/A), `pPlayGen` (Generationszähler gegen Stale-Async), `pMaplawOn`, `pMaplawSollC`, `pMaplawNode`, `pFileBuf` (Audiodatei-Buffer, überlebt Sätze-Wiedergabe), `pPlaybackMode` ("file"\|"sentence"). Buffer-Steuerung: `pSetPlaybackMode(mode)` setzt `pSourceBuf` auf den aktiven Slot und baut EQ neu. MAPLAW-Helfer: `pMaplawGetIstC`, `pMaplawIsApplicable`, `pMaplawTrigger`, `pMaplawUpdUI` (UI-Sync: Ist-c-Anzeige, Soll-c-Display neben dem Ist-Wert, Toggle-Zustand, Soll-c-Eingabe, Nicht-MED-EL-Hinweis). `pApplyShowExperimental` synchronisiert die Sichtbarkeit der MAPLAW-Card (`plMaplawCard`) sowie des Hinweistexts (`plExperimentalHint`) anhand von `plShowExperimental`. Frequenz-Warping ist nicht mehr experimentell (eigene Einstellungsbox `plWarpSettingsBox`, gesteuert durch `pWarpUpdUI`). |
| 16 | freq-warp.js | Frequenz-Warping (alle Verfahren). `buildWarpPoints`, `_warpAffectedSides`, `_warpSideGains`, `centShift`, `pComputeWarpedBuffer`, `pBuildWarpedGraph`, `pBuildVocoderGraph`, `pInitWarpWorklet`, `pWarpTrigger`, `pWarpUpdUI`, `pWarpLiveUpdate` (postMessage an laufenden Vocoder-Worklet ohne Pfadwechsel). State: `pWarpedBuf`, `pWarpOn`, `pWarpMode`, `pWarpStrength`, `pWarpBusy`, `pWarpMethod`, `pWarpWorkletReady`, `pWarpAffected`. Worklet-Code liegt als String-Konstante `_FREQ_WARP_PROCESSOR_CODE` im selben Modul; `pInitWarpWorklet` lädt ihn per Blob-URL (funktioniert auch unter `file://`). Worklet-Methoden: `_processFrame` (Phasen-Vocoder mit Identity Phase Locking), `_processFrameSinModel` (Sinusoidal Modeling: Peak-Tracking + Quadratic Interpolation + Spectral Spread, Residual unverschoben). Worklet-State zusätzlich: `algorithm` ("phase_vocoder" | "sinmodel"), `smMaxPeaks`, `smPrevPeakCount`, `smPrevPeakFreq`, `smPrevPeakPhase`. `_VOCODER_FFT_SIZE` (synchron mit `FFT_SIZE` im Worklet) wird für den L/R-Sync-Delay im Vocoder-Graph gebraucht. |
| 16b | maplaw.js | MAPLAW-Simulation Phase 3 (bandweise Hüllkurven-Vorverzerrung Ist⁻¹∘Soll für MED-EL). `_MAPLAW_PROCESSOR_CODE` als Worklet-Inline-String mit Filterbank (12 Biquad-Bandpässe an MED-EL-Frequenzen, Q=4), Hüllkurven-Detektor (Gleichrichtung + IIR-Tiefpaß 50 Hz), lokale Normalisierung (gleitendes Maximum, τ=1 Sek), MAPLAW-Kennlinie + Inverse, **additive Korrektur** (out = x + Σ y_b·(gain_b−1), nicht out = Σ y_b·gain_b — sonst klingt schon der Identity-Fall verfärbt, weil die naive Bandpass-Summe keine perfekte Rekonstruktion ist). `pInitMaplawWorklet`, `pBuildMaplawNode`, `pMaplawApplyParams`. Bei `active=0` oder `istC == sollC`: Passthrough. **Stereo-fähig**: Worklet hält pro Kanal (L/R, `MAX_CH=2`) eigenen Filterbank-, Hüllkurven- und Max-State und verarbeitet jeden Kanal separat über `_processChannel`. `pBuildMaplawNode` konfiguriert den Node mit `channelCount: 2`, `channelCountMode: 'explicit'`, `outputChannelCount: [2]` — dadurch wird Mono-Input vor dem Worklet auf L=R aufgeteilt (sonst sähe der Worklet bei `mode='right'` nur den stillen linken Kanal von `pRightOnlyBuf`) und Stereo-Input ohne Downmix durchgereicht. Worklet wird in Bauanleitung 19 in den Player-Audio-Graph eingehängt; UI kommt in Bauanleitung 20. |
| 17 | lr-balance.js | Stereo-Balance-Tab. Eigener DOMContentLoaded-Handler und eigener Tab-Hook für `balance`. Bindet sich an die von test-ui.js erzeugte UI. |
| 17c | latency.js | Latenz-Messung (Inter-Ohr-Zeitversatz). State: `latencyResult` ({valueMs, clickType, intervalMs, timestamp}), `plApplyLatency`, `latSliderMs`, `latActive`, `latClickType`, `latIntervalMs`. Audio-Nodes: `pLatSplitter`, `pLatDelayL`, `pLatDelayR`, `pLatMerger` — werden von `latInitGraph` einmalig zwischen `pGain` und `c.destination` eingehängt. Funktionen: `latBuildClickBuffer`, `latBuildBurstBuffer`, `latBuildLoopedTestBuffer`, `latStartTest`, `latStopTest`, `latSetSliderMs`, `latApplyToPlayer` (ruft `updLatApplyBtn` zur Button-Synchronisation), `latInitGraph`. UI-Funktionen: `latApplyAsResult` (wird intern von `latStopTestUI` gerufen — kein Button), `latRenderResults` (Ergebnis-Sub-Tab), `latUpdateValueText`, `latUpdateIntervalHint`, `latUpdateButtonStates` (disabled-Steuerung Schieber + Buttons). ENTER-Listener im DOMContentLoaded-Handler: stoppt laufenden Test via `latStopTestUI`, greift nur wenn `latActive === true`. Eigener DOMContentLoaded-Handler. |
| 17b | sentences.js | Sätze-Wiedergabe im Player. Hybrid-Loader: erst `fetch` auf `sentences.json` (online-Voll-Korpus); bei Fehlschlag Wechsel in `sOfflineMode` und Lazy-Load der Embed-Modul-Datei `assets/sentences/embed/<lang>.js` per dynamischem `<script>`-Tag (file://-kompatibel). Audio aus Embed-data:-URLs wird über `sDataUrlToArrayBuffer` direkt in den AudioContext geleitet. Schema: `speakers.<key> = {lang, label, kind, source, license, credit, recordings:[{id,text,audio,...}]}`. State: `sActive`, `sEndless` (true = Endlosfolge-Modus), `sEndlessCount` (Zähler abgespielter Sätze in laufender Endlosfolge, Stop bei 100), `sCurRec` ({speakerKey, recIdx, rec}), `sCorpus`, `sLoaded`, `sLoading`, `sShownText`, `sSentenceBuf` (dekodierter aktueller Satz, getrennt von `pFileBuf`), `sPauseTimer`, `sPauseMsVal`, `sOfflineMode` (true = fetch hat versagt, Embed-Modus aktiv), `sEmbedLoading` (Set laufender Sprach-Ladevorgänge), `sLocalCollections` (Map collectionId→Collection-Objekt für lokale Ordner; jedes Objekt hat zusätzlich `handleId` (String oder null, IndexedDB-Schlüssel für den FSAA-Handle), `persistable` (true wenn über FSAA geladen), `stub` (true wenn nach JSON-Restore noch nicht gemountet)), `sLocalNextId` (Zähler für eindeutige Collection-IDs). `sEnsureEmbedForLang(langCode)` lädt on-demand `embed/<lang>.js` und mergt Sprecher in `sCorpus`. `sBuildRecordingPool(spkSel)` liefert das Pool-Array gemäß UI-Auswahl ("any" = alle Sprecher der aktuellen Sprache flach gemischt). Bedienung über drei Buttons: `sPlay` (aktueller Satz einmal), `sNext` (anderer zufälliger Satz, einmal), `sEndlessStart` (Endlosfolge). Hilfsfunktion `sPickRandom(pool, exclude)`. Wiedergabe setzt `pSourceBuf` via fetch+decodeAudioData (online) oder `sDataUrlToArrayBuffer` (offline/data:-URL) oder `file.arrayBuffer()` (lokal) und ruft `pPlay()`. Audio-Ref-Schema: `"<pfad>"` (fetch), `"data:…"` (Embed), `"local:<collectionId>:<relPath>"` (lokaler Ordner). `sOnEnded()` wird aus dem onended-Handler in `player.js` getriggert; im Endlosmodus nächste Recording wählen, sonst stoppen. Mutual Exclusion zur Musikdatei unverändert. Sprecher-Dropdown wird dynamisch von `sRefreshSpeakerDropdown()` befüllt — ruft `sSpeakersForLang(lang)`; installiert außerdem `sel.onchange` für Stub-Re-Mount (Klick auf „(nicht geladen)"-Eintrag öffnet Picker). `sUpdateUI()` wird von `applyLang()` gerufen (Sprachwechsel) und triggert im Offline-Modus `sEnsureEmbedForLang`. IndexedDB-Wrapper: `sIdbOpen`, `sIdbPut`, `sIdbGet`, `sIdbDel` (DB „ciSoundBalancing", Store „folderHandles"). `sFsaaAvailable()` prüft `window.showDirectoryPicker`. FSAA-Ingest: `sIngestFromHandle(rootHandle, handleId)` — rekursiver Walk per `dirHandle.entries()`, `Object.defineProperty` für `webkitRelativePath`, ruft `sIngestLocalFolder`, speichert Handle in IDB, setzt `handleId`/`persistable` an neuen Sammlungen. Picker-Hybrid im Click-Handler: FSAA-verfügbar → `showDirectoryPicker`, sonst `<input webkitdirectory>`. Restore: `sRestoreLocalCollections(metaArr)` — nach JSON-Load aufgerufen, holt Handle aus IDB, fragt Permission, ruft `sIngestFromHandle`; bei Fehlschlag Stub-Sprecher. `sReloadStubCollection(cid)` — Re-Mount bei Klick auf Stub im Dropdown (FSAA oder webkit-Fallback). Lokale Ordner-Funktionen: `sNewCollectionId`, `sIngestLocalFolder` (Ingest-Einstieg, ruft Heuristiken auf), `sDetectFreiburger`, `sDetectOldenburger`, `sLoadOldenburgerManifest`, `sParseOldenburgerManifest`, `sParseGenericManifest`, `sLoadGenericManifest`, `sBuildFreiburgerRecordings`, `sBuildOldenburgerRecordings`, `sBuildGenericRecordings`, `sMakeSpeaker`, `sRefreshLocalList`, `sRemoveLocalCollection` (jetzt async — löscht auch IDB-Handle wenn nicht mehr referenziert). Eigener DOMContentLoaded-Handler. Datenstruktur unter `assets/sentences/`: `thorsten/01.mp3…50.mp3`, `cv-de/`, `cv-en/`, `cv-fr/`, `cv-es/` je 100 MP3s + manifest.json. Offline-Embeds unter `assets/sentences/embed/<lang>.js`. |
| 18 | init.js | Der große DOMContentLoaded-Handler mit `applyLang()`, `buildImplantCard()`, allen Event-Verdrahtungen, Autosave-Setup |
| 19 | legal.js | Footer-Modals: `_legalOpenImprint`, `_legalOpenLicense`. Impressum-Inhalt statisch in `_legalBuildImprintBody` (deutsch, gemäß § 5 DDG). E-Mail wird via `_legalAssembleEmail` erst beim Öffnen aus zwei Bestandteilen zusammengesetzt (Spam-Schutz). MIT-Lizenz lädt per `fetch` von raw.githubusercontent.com mit Fallback-Link bei Netzwerk- oder CORS-Fehler. Eigener DOMContentLoaded-Handler verdrahtet die drei Footer-Links und Close-Buttons. Konstanten `_LICENSE_RAW_URL`, `_LICENSE_HTML_URL`. |
| 20 | finanzen.js | Reine Datenhaltung für den Unterstützung-Tab. Globale Variable `FINANZEN` (Objekt mit `posten`-Array und `donationsMonthly`). Berechnungs-Helfer `finBerechne()` (liefert Summen, Eigenanteil, Lücken als Objekt) und `finFmtEuro(n)` (Zahl → „1,23 €"). Keine DOM-Manipulation, keine DOMContentLoaded-Handler. Muß vor `unterstuetzung.js` geladen werden. |
| 21 | unterstuetzung.js | Rendert den Unterstützung-Tab. Befüllt `#untFinanzBody` / `#untFinanzFoot` / `#untGapHints` per `_untRenderFinanzTable()`. Bot-Schutz: IBAN (`_untBuildIban`) und E-Mail (`_untBuildMail`) werden erst beim Öffnen des jeweiligen Dialogs aus Fragmenten zusammengebaut. Dialog-Öffner `_untOpenDialog(id, builderFn)`. Eigener DOMContentLoaded-Handler verdrahtet `#untShowIbanBtn`, `#untShowMailBtn` und alle `[data-close-support]`-Buttons. Kein globaler State. |

## Datenfluss (nicht aus Namen ablesbar)

**Footer und Impressum:** Footer am Ende des `.container` (außerhalb
aller `.panel`-Container), enthält Versions-Anzeige, Impressum-Link,
MIT-Lizenz-Link und GitHub-Link. Zwei `<dialog>`-Elemente
(`#imprintDialog`, `#licenseDialog`) werden über `legal.js`
verwaltet. Impressum-Inhalt deutsch und statisch; MIT-Lizenz wird
beim Öffnen aus dem Repo nachgeladen.


**Touch-Bedienleisten:** Pro Slider eine `.touch-ctrl`-Box mit
Buttons − / Fein / + / [Replay] (`buildSliderTouchCtrl` aus
touch-ctrl.js, aufgerufen in test.js, lr-balance.js, freqmatch.js,
latency.js). Player-Stärke (`plStr`) und Schieber-Tab (Canvas) haben
Sonder-Implementierungen mit `attachLongPress` direkt, weil sie nicht
auf einem `<input type="range">` basieren. Die Bedienleisten sind
dauerhaft sichtbar (Desktop und Mobile).

**Kurven-Chart-Pinning:** Die `.lv-chart-card` im Kurven-Tab ist
nur auf Mobile-Breite (`max-width: 768px`) `position: sticky`.
Auf Desktop scrollt sie als normale Karte mit. Der Breakpoint
passt zu den anderen Mobile-Regeln in `style.css`.

**Mobile-Eingabe-Sperre:** Auf reinen Touch-Geräten (Smartphone)
werden alle Number-Inputs read-only, damit die System-Tastatur nicht
das Bild verdeckt. Eingabe läuft dort über die Touch-Buttons
(Bauanleitung 33). Erkennung über `IS_TOUCH_ONLY` aus `mobile.js`.
`applyMobileReadonly` wird nach jedem Rebuild dynamischer Tabellen
(`buildFreqTable`, `buildPrTbl`, `buildTestPanel`) erneut aufgerufen,
sonst greift das Flag nur auf den statischen HTML-Bestand.
`safeFocus` ersetzt direkte `.focus()`-Aufrufe an Stellen, wo der
Autofokus auf Touch-Geräten stören würde.

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
`"left"`, `"right"` oder `"both"` abhängig von Checkbox `plBothSides`.
„both" = Stereo mit getrennten EQ-Ketten pro Kanal (`pEqFLeft` /
`pEqFRight`), gespeist über `pChannelSplitter` und `pChannelMerger`.
„left"/"right" = nur die jeweilige Seite hörbar mit deren EQ-Kette;
der Gegenkanal ist stumm. `updatePlayerForSideChange` (player.js)
baut den Audio-Graph bei Side-Wechsel neu auf — auch während laufender
Wiedergabe (mit kurzer Unterbrechung).
EQ-Graph (`pDrawEQ`) und Werte-Tabelle (`pBuildTbl`) zeigen bei
`getPlayerSide() === "both"` die **aktive Seite** (`activeSide`), nicht
fest „left" — damit bei einseitigem CI die CI-Seite immer sichtbar ist.
Audio bleibt stereo. Bei `getPlayerSide() === "left"/"right"` (mono)
liefert `getPlayerGains()` ein flaches Array, kein `{left,right}`-Objekt
— der `gains.left !== "undefined"`-Guard trifft diesen Fall nicht.

**Balance-Anwendungs-Modus** (`plBalanceMode`, state-side.js):
"sym" (Default), "left" oder "right". Steuert, wie der Balance-Wert
auf die beiden Channel-Gains verteilt wird (siehe
`getPlayerBalanceGains`). UI sichtbar nur bei `getPlayerSide() ===
"both"` und aktivierter Balance. Persistiert in JSON und
localStorage.

**MAPLAW-Simulation (Phase 3, MED-EL):** Bandweise Hüllkurven-Vorverzerrung Ist⁻¹∘Soll im AudioWorklet aus `maplaw.js`. Wird in `pPlay` zwischen letztem EQ-Knoten und `pGain` eingehängt, wenn `pMaplawOn` und `plEqOn` (EQ-Toggle als Master-Bypass) und `pMaplawIsApplicable()` (mindestens eine Seite MED-EL). Live-Updates von `pMaplawSollC` während Wiedergabe via `pMaplawTrigger` (postMessage an Worklet). Ist-c kommt aus `sideData[activeSide].implant.cValue`. Bilaterale Trennung mit zwei Worklets ist nicht implementiert — der unilaterale Standardfall ist abgedeckt. Die Soll-c-Anzeige im Settings-Block wird neben dem Ist-Wert live aktualisiert; die Listener in init.js für Quick-Buttons und Zahleneingabe rufen `pMaplawUpdUI` zusätzlich zu `pMaplawTrigger` auf.

**Frequenz-Warping — Persistenz:** Der Warp-Zustand (`pWarpOn`, `pWarpMethod`, `pWarpMode`, `pWarpStrength`) wird analog zu MAPLAW in beiden Persistenz-Pfaden vollständig gespeichert und wiederhergestellt: localStorage-Autosave (init.js, 5-s-Intervall, Schlüssel `pWarpOn`/`pWarpMethod`/`pWarpMode`/`pWarpStrength`) und JSON-Save/Load (file.js, Schlüssel `warpOn`/`warpMethod`/`warpMode`/`warpStrength`). `pWarpedBuf` wird nicht gespeichert und bei Bedarf neu berechnet. Der JSON-Load-Pfad in `file.js` enthält kein Force-Off mehr (das frühere bewusste `pWarpOn = false` und `warpCb.checked = false` wurde in Bauanleitung 47 entfernt). UI-Sync nach dem Setzen über `pWarpUpdUI()`.

**Lokale Sammlungen — Persistenz:** Sammlungen, die über FSAA
(`showDirectoryPicker`) angelegt wurden, haben einen `handleId`,
unter dem der FileSystemDirectoryHandle in IndexedDB liegt
(DB "ciSoundBalancing", Store "folderHandles"). Beim JSON-Save
wandert die Metadaten-Liste mit (file.js `saveJson.localCollections`).
Nach JSON-Load ruft `applyLoadedData` `sRestoreLocalCollections` auf;
dort wird pro Sammlung versucht, den Handle aus IDB zu holen,
Permission anzufordern und neu zu mounten. Schlägt das fehl (keine
FSAA, kein Handle, Permission verweigert), wird ein Stub-Sprecher
angelegt; Klick darauf im Dropdown öffnet den Picker
(`sReloadStubCollection`). Sammlungen per `webkitdirectory` geladen
haben kein `handleId` und erscheinen nach JSON-Restore stets als Stub.

**Audio-Datei vs. Sätze (Buffer-Trennung):** `pFileBuf` (player.js) hält die vom User geladene Audiodatei; `sSentenceBuf` (sentences.js) den gerade dekodierten Satz. `pSourceBuf` ist eine Live-View auf den durch `pPlaybackMode` gewählten Slot ("file" oder "sentence"), gesetzt über `pSetPlaybackMode(mode)`. Damit überschreibt die Sätze-Wiedergabe die Datei-Auswahl nicht mehr. Ein Klick auf den Datei-Play-Button (`pToggle`) wechselt bei laufenden Sätzen unmittelbar in den Datei-Modus und startet die Datei. `sStop()` setzt nach Sätze-Ende ebenfalls in den Datei-Modus zurück.

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
Die geometrischen Kurven (tilt, scurve, pivot, gauss) rechnen in
**log(Hz)** (Cent re 1000 Hz). `pr.center` wird als Hz-Wert
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
`updateRunExplain` (i18n.js), `buildFreqTable` (freq-table.js),
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
Korrekturgewicht via `corrG` (audio.js), `pUpdEQ` (player.js).
`refEl` hat **keine** Wirkung auf die Messung selbst (rohe
Vergleichspaare `bRes`/`jRes`). Das Dropdown zur Wahl der
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

**Tab/Subtab-Persistenz:** `switchTab` (tabs-eq.js) schreibt den
aktiven Top-Level-Tab in `localStorage` unter `ci-lb-activeTab`.
`switchSubtab` schreibt analog pro Parent unter
`ci-lb-subtab-<parent>` (nur für `messungen` und `ergebnisse`
relevant). Restore am Ende des DOMContentLoaded-Handlers in
`init.js`, nach allen anderen Init-Schritten, damit die durch
`switchTab`/`switchSubtab` ausgelösten Render-Callbacks
(`renderResults`, `lrDrawChart`, `lvTabRebuild`, …) auf
initialisiertem State arbeiten.

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

**Globaler Dateinamen-Suffix:** Das Eingabefeld `#userFileSuffix` im
Laden/Speichern-Tab speichert seinen Wert in `userFileSuffix`
(state-side.js) und in `localStorage` (`ci-lb-userFileSuffix`, sofort
bei jedem `input`-Event). Beim Erzeugen von Download-Dateinamen wird
der Wert über `_applyUserFileSuffix` (file.js) zwischen Basisname und
Endung eingeschoben — wirkt in `saveJson`, `exportEasyEffects`,
`mdArchivFilename`, `mdAudiologFilename`.

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
Seiten-H2 erscheint. Druck-Pfad (`audiologPrint`): Chart-Injektion vor
`<h3>audiologSecLoudness</h3>` per laufendem `searchFrom`-Offset
(bilateral-korrekt; Reihenfolge der Seiten-Blöcke entspricht
`mainSides`). Druck nutzt `openPrintWindow` aus print.js.

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
