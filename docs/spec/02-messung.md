## Messungen — drei Sub-Tabs

Alle vier Tests teilen sich denselben Aufbau, erzeugt durch den
Builder `buildTestPanel` aus test-ui.js (Latenz seit BA 223). Drei Blöcke pro Test:

1. **Erklärungen** (reiner Text)
2. **Voreinstellungen** (Bedienelemente vor dem Test, Start/Stop)
3. **Test** (während der Messung; sperrt alle anderen Tabs und
   Sub-Tabs)

### Reifegrad-Hinweis pro Test

Jedes Testverfahren zeigt am Seitenanfang dauerhaft eine kurze
Selbsteinschätzung seines Entwicklungsstands. Konvention: erster
Eintrag in `explain.paragraphs` mit `kind`-Farbe nach Reife:

- **Elektrodenlautstärke** (`testMaturityHint`, `kind: 'ok'`, grün):
  „bereits gut ausgereift, kann zuverlässige Ergebnisse bringen"
- **Stereo-Balance** (`lrMaturityHint`, `kind: 'info'`, blau):
  „funktioniert grundsätzlich, wird aber sicher noch überarbeitet"
- **Latenz** (`latMaturityHint`, `kind: 'info'`, blau): „bereits
  brauchbar und funktioniert; Verbesserungen werden noch kommen".
- **Frequenzabgleich** (`fmMaturityHint`, `kind: 'caution'`, orange):
  „funktioniert technisch, hat aber Schwächen und wird aktiv
  weiterentwickelt"; mit Bullet-Punkten zu 2-CI vs. 1-CI-Trägern
  (HTML im i18n-String via automatischem `innerHTML`-Pfad in
  `i18n.js`).

Frequenzabgleich-Erklärblock (BA 220): Der Erklärblock verwendet
`preserveOrder: true`; alle Absätze erscheinen in Config-Reihenfolge
ohne Schwere-Sortierung. HG-Warnung (`#fmHGWarnPara`) und
Cochlear-FAT-Hinweis (`#fmCochlearFatHintPara`) sind reguläre
`kind:'warn'`-Paragraphen mit `hidden: true`; Sichtbarkeit wird per
`testUI.explain.setVisible` von `_fmRefreshHGWarningVisibility` /
`_fmRefreshCochlearFatHintVisibility` umgeschaltet. Beide
Methoden-Gruppen (beidseitiges CI und CI+akustisch) sind immer
sichtbar, je unter eigenem `kind:'heading'`-Absatz.

### Globale Test-Einstellungen

In `state-side.js` und persistiert in JSON und localStorage:

- **Tonart** (`globalToneType`) — Sinus / Komplexton / Komplexton gepulst
  (100 Hz AM) / Reicher Komplexton (BA 213.4, 8 Harmonische + Vibrato
  5 Hz + Atem-AM 3 Hz) / Rauschen / Schmalbandrauschen adaptiv /
  Iterated Rippled Noise (BA 213.4, 16 Iterationen Add-and-Delay) /
  **Reicher Komplexton: Akkordeon / Altsaxophon / Basstuba / Bratsche /
  Fagott / Klarinette in B / Kontrabass / Oboe / Posaune / Querflöte /
  Trompete in C / Violine / Violoncello / Waldhorn** (BA 215, Profile
  aus TinySOL/IRCAM analysiert in BA 214) /
  AM-Sinus / Warble-Sinus / Sinus-Bursts / Wobble-Sweep. Default
  `'complex'` (Komplexton). Dropdown im Voreinstellungs-Block von Test 1
  (Elektrodenlautstärke) und Test 2 (Stereo-Balance) sichtbar; beide
  Instanzen an dieselbe Variable gebunden. Bei Auswahl einer neuen
  Tonart wird sofort ein 750 ms Vorschau-Ton (1000 Hz, aktuelle
  Messlautstärke) abgespielt.
- **Tonart Frequenzabgleich** (`toneType_freqmatch`, BA 209) — eigene
  Tonart für Sub-Tab 3, unabhängig von `globalToneType`. Default
  `'pulsedComplex'`. Wird über Button + Popup-Dialog gewählt (kein
  Dropdown), persistiert in JSON und localStorage. Auto-Vorschau-Ton
  (750 ms) gilt nur noch für die globalen Dropdowns; im Frequenzabgleich
  übernimmt das Popup-Probehören diese Funktion.
  Dialog (BA 217): Tonarten in vier Gruppen (Sinustöne, Komplextöne,
  Instrumenten-Klänge, Rauschsignale) mit Kurzbeschreibung pro Tonart.
  Jede Gruppe hat eine Überschrift und einen Unter-Hinweis (i18n).
  Alle richXX-Profile haben hinterlegtes Vibrato (Streicher aus
  TinySOL-Messung, übrige aus Spielpraxis-Tabelle), das immer zu
  100 % auf die Synthese durchgreift; eine UI-Skalierung gibt es nicht.
  Seit Version 3.2.225 eine zusätzliche Gruppe am Ende des Dialogs:
  - **Mellotron-Sampler**: 34 Original-Mellotron-Varianten; Lazy-Load
    von externer URL beim ersten Anschlag. Keine i18n-Keys —
    Variantenname direkt aus Token-Suffix.
  Token-Schema: `smplr:mellotron:<variantName>`.
  (Soundfont2 war bis 3.2.226.4 mit drei SF2-Paketen als zusätzliche
  Gruppe vorhanden, ab 3.2.226.5 entfernt — Klang stumm wegen race
  condition; Mellotron deckt die Klangpalette ausreichend ab.)
  Lade-Visualisierung (seit BA 226): Klick auf Vorspiel bei noch nicht
  geladenem Sampler zeigt Sanduhr ⧖ vor dem Button-Text und sperrt
  alle Vorspiel-Buttons; nach erfolgreichem Load startet die Sequenz
  automatisch. Radio-Auswahl einer smplr-Tonart löst bereits Hintergrund-
  Laden aus (Sanduhr sichtbar, Buttons bleiben klickbar); ein direkt
  folgender Vorspiel-Klick während des Ladens greift nahtlos in denselben
  Promise und startet nach Fertigstellung automatisch.
  Klavier-Widget (seit BA 228): Oberhalb der Tonart-Liste erscheint im
  Frequenzabgleich-Kontext ein Klavier. Tastenzahl = aktive Elektroden
  der var-Seite, beschriftet mit Elektrodennummer; zwischen je zwei
  weißen Tasten eine schwarze Zier-Taste auf dem geometrischen Mittel
  der Nachbarfrequenzen. Anschlag (mousedown/touchstart) spielt Burst
  auf var-Seite, kurze Pause, Burst auf ref-Seite — beide mit aktueller
  Tondauer und Pause aus dem Test-Header (`fmGDur`, `fmGPau`). Bei
  smplr-Tonart die noch nicht geladen ist: Lade-Hinweis „Lädt ..."
  (gold-gelb, i18n `samplerKeyboardLoading`) über dem Klavier, Anschlag
  stumm bis Sampler ready. Das Klavier ist abstrakt in `sampler-keyboard.js`
  implementiert (cfg.keyboardMode = true aktiviert es im Frequenzabgleich)
  und für künftige Aufrufer (Implantat-Tab, BA 230) wiederverwendbar.
- **Tonfolge** (`globalSequence`) — `'aba'` oder `'ab'`. Default
  `'ab'`. Vor dem Test wählbar, während des Tests fest.
- **Hüllkurve** (`applyCosRamp` in `audio.js`) — alle Tonarten
  verwenden eine cos²-Rampe (sin² beim Anstieg, cos² beim Abfall,
  via `setValueCurveAtTime` mit 64-Punkt-Stützstellen) mit
  Default 50 ms. Reduziert breitbandige Onset-Klicks, die beim
  CI besonders störend wirken (BA 213.3). Bei sehr kurzen Tönen
  wird die effektive Rampe auf `Tondauer/2` begrenzt. Burst-Sinus
  hat zusätzlich eine eigene 10 ms-Burst-interne Rampe, die
  unabhängig bleibt.

### Slider-Wirkung (pro Test eigener Wert)

- **Test 1** (`slTarget_test`): A / B / Balance. Default `Balance`.
  Bei Slider +6 dB im Modus Balance: A wird mit −3 dB, B mit +3 dB
  gespielt.
- **Test 2** (`slTarget_balance`): Links / Rechts / Beide. Default
  `Beide`, symmetrisch wie in Test 1.
- **Test 3**: kein Dropdown, intern fest auf der
  Nicht-Referenzohr-Seite (CI-Ohr).

**Modus-Wechsel zur Laufzeit**: Slider-Wert wird übernommen
(relativer Lautheitsunterschied bleibt). **Swap (A↔B / L↔R)**:
Slider-Wert wird invertiert.

### Slider-Bedienung

- **Pfeiltasten ±0,5 dB**, Shift+Pfeil ±0,1 dB (Test 1 und 2)
- **Pfeiltasten ±5 cent**, Shift+Pfeil ±1 cent (Test 3)
- **Touch-Bedienleiste** direkt unter jedem Slider (auch auf
  Desktop sichtbar): Buttons − / Fein / + und Replay (Wiederholen).
  Long-Press = Auto-Repeat. Der Fein-Toggle ersetzt Shift+Pfeil und
  bleibt aktiv, bis erneut getippt.
- Slider-Bereich erweiterbar:
  - Test 1+2 (alte Test-UI): in 3 Stufen mit explizitem „Bereich
    erweitern"-Button: ±20 dB → ±40 dB → ±60 dB
  - Test 3 / Frequenzabgleich Slider-Verfahren (seit BA 113): automatisch
    in 100-cent-Schritten beim Loslassen (Maus/Touch) oder Pfeiltasten-
    Anschlag, von ±100 bis maximal ±1200 cent; Track wird mit jeder
    Erweiterung etwas dünner, kein expliziter Button mehr
- Tastatursteuerung muß fokus-robust sein (nach Klick auf Buttons,
  Dropdowns, Checkboxen weiterhin nutzbar)

### Elektroden-Ausschluß

- Zwei rote Buttons im Test-Block, kein Tastenkürzel
- Bestätigungsdialog vor Ausschluß
- Ausschluß betrifft **alle** Testverfahren, änderbar im Reiter
  Implantat
- In Levels, Chart, Frequenztabelle und Sweep sind alle Elektroden
  sichtbar und editierbar

### Confidence-Auswahl (vorbereitet, ohne Funktion)

- 5 Radios pro Test: keine Angabe (Default) / sicher / mittel /
  unsicher / unbrauchbar
- Hinweis: „wird derzeit nicht ausgewertet und nicht gespeichert"
- Nach jedem Confirm zurück auf „keine Angabe"

### Resume

- **Nur Test 1 im Modus „full" (Round-Robin)**: bestätigte Paare
  bleiben über Stop/Browser-Neustart hinweg gespeichert
  (`fullSweepRound`, `fullSweepDonePairs` in `sideData[side]`). Undo
  entfernt das Paar wieder aus der Done-Liste.
- **Test 1 conv_fast und manual**: kein Resume.
- **Test 2 und Test 3**: kein Resume.
- UI-Texte suggerieren Resume nur dort, wo es tatsächlich greift.

### Sub-Tab 1 — Elektrodenlautstärke ausgleichen (test.js)

- **Voraussetzungs-Sperre (BA 155):** `startTest()` prüft per
  `isSideUsable(activeSide)`, ob Hörtechnik und (bei CI) Hersteller
  für die aktive Seite gesetzt sind. Fehlt eine Angabe, erscheint
  ein Alert-Hinweis und der Test startet nicht.
- **Modi**: balance (Slider) und judgment (3-Knopf-Urteil)
- **Testverfahren**: Round Robin (alle Paare) / Konvergenz /
  Spezial: Round Robin mit Vorauswahl / Spezial: Manuell
- A/B-Zuordnung und Paarreihenfolge immer randomisiert
- Referenzelektroden-Auswahl erfolgt im Ergebnis-Reiter
  (Elektrodenlautstärke-Balance), nicht mehr im Test selbst. Sie
  wirkt nur auf die Anzeige und Anwendung der Ergebnisse, nicht auf
  die Messung.
- Die Referenzelektrode ist im Loudness-Graph durch ein fettes
  schwarzes „Ref.-El."-Label am oberen Rand markiert — zusätzlich
  zur bisherigen Hervorhebung als fettes blaues Achsen-Label. In
  der Loudness-Tabelle gibt es eine neue Spalte „Ref.El." am Ende;
  die Zeile der Referenzelektrode trägt ein großes `X`.
- **LS-Hint-Anzeige**: Unter dem Slider erscheint ein Dreieck mit
  dB-Wert an der Position der LS-Schätzung des aktuellen Paares,
  umgeben von einem semitransparenten Farbbereich, dessen halbe Breite
  sich aus dem mittleren Residuum (`elRes` aus `compWLS`) und einem
  Stichproben-Aufschlag (`basis · k/(k+N)`, basis = 2.5 dB, k = 3,
  N = min. Mess-Anzahl der beiden Elektroden) als
  `√(elRes² + prior²)` ergibt. Sichtbar nur, wenn beide Elektroden in
  mindestens einer Messung vorkommen und die Marke innerhalb des
  aktuellen Slider-Bereichs liegt.
- **Slider-Startwert**: Bei bereits gemessenem Paar startet der
  Slider so, daß der gespeicherte Wert exakt mittig sitzt
  (`curBase = gespeicherter Offset`, `slider = 0`). Bei noch nicht
  gemessenem Paar startet der Slider auf der LS-Schätzung
  (`curBase = Schätzung`, `slider = 0`). Bei leerem Datensatz
  `curBase = 0`.
- Wenn Modus „Round Robin" angefangen aber nicht abgeschlossen wurde,
  zeigt der Ergebnis-Reiter oben einen Hinweis mit Runde X von Y und
  bestätigten Paaren des aktuellen Sweeps.
- **Spezial: Round Robin mit Vorauswahl** (`'selective'`, BA 204):
  Round-Robin-Lauf, gefiltert auf eine vom Nutzer per Popup gewählte
  Untermenge aktiver Elektroden. Es werden alle Paare gespielt, in
  denen mindestens eine gewählte Elektrode vorkommt; alle anderen
  Paare bleiben außen vor. Kein Resume — jeder Start beginnt frisch.
  Die Auswahl (`selectiveElectrodes`) bleibt session-weit erhalten und
  kann über „Auswahl ändern…" jederzeit überarbeitet werden. Bei
  Elektroden-Ausschluß während des Laufs wird die Auswahl entsprechend
  reduziert; bleibt kein passendes Paar mehr, endet der Test mit
  Hinweis.

### Sub-Tab 2 — Stereo-Balance (lr-balance.js)

- **Voraussetzungs-Sperre (BA 155):** Start-Knopf-Listener prüft per
  `isSideUsable('left') && isSideUsable('right')`, ob beide Seiten
  konfiguriert sind. Fehlt eine Angabe, erscheint ein Alert-Hinweis
  und der Test startet nicht.
- **Implantat-Änderungs-Hinweis (BA 156):** Beim ersten `lrConfirm`
  wird ein Schnappschuß der Implantat-Felder (Hörtechnik, Hersteller,
  Elektroden-Anzahl, deaktivierte Elektroden) als `lrSnapshot` gesichert.
  Beim Öffnen des Reiters vergleicht `renderSnapshotHint` den gespeicherten
  Snapshot mit dem aktuellen Stand. Bei Abweichung erscheint ein gelb-
  orangener Hinweis-Banner oberhalb der Voreinstellungen: „Hinweis:
  Implantat-Einstellungen wurden seit der Messung verändert. Eine neue
  Messung ist möglicherweise sinnvoll." Bei alter Datei ohne Snapshot
  erscheint kein Hinweis. Der Snapshot wird mit der Datei gespeichert
  und geladen; beim Löschen der Ergebnisse wird er genullt.
- Reihenfolge der Elektroden: zufällig / apikal→basal / basal→apikal
- Seitenfolge: zufällig / L→R / R→L
- Vergleicht gleiche Frequenz auf beiden Ohren
- Vorbedingungs-Hinweis (`lrPrereqHint`): „Führen Sie zuerst die
  Messung Elektrodenlautstärke für beide Seiten aus." — reiner Hinweis,
  nicht zwingend

### Sub-Tab 3 — Frequenzabgleich (freqmatch.js)

- **Tonart-Auswahl (BA 209):** Button im Header „Tonart: *Aktualwert*"
  öffnet ein Popup mit Radio-Liste aller 9 Tonarten und einer
  Play-Spalte. Probehör-Sequenz: Tondauer Pan −1 → Pause →
  Tondauer Pan +1, Werte aus den Verfahren-Einstellungen
  (`fmGDur()`/`fmGPau()`). Frequenzen je nach Test-Status: vor Test
  1 kHz beidseitig, während Slider-Round / Adaptiv die aktuellen
  Trial-Frequenzen (links/rechts). Der Play-Button spielt
  ausschließlich ab; die Tonart-Auswahl erfolgt über den
  Radio-Button (und wird mit OK übernommen). OK übernimmt,
  Abbruch verwirft. Auswahl persistiert in `toneType_freqmatch`
  (Default `pulsedComplex`). Das Dropdown `sliderTarget`
  („Slider-Wirkung") wurde ersatzlos entfernt (BA 209).
- **Statische Methoden-Gruppen (BA 220, vorher: Dynamischer Intro-Text
  BA 160):** Beide Erklär-Gruppen werden immer angezeigt, je unter
  einer `kind:'heading'`-Überschrift:
  - „Bei beidseitigem CI" (`fmGroupBothCi`): `fmHintMethodBothCI`
    (plain) + `fmHintWarnBothCI` (caution).
  - „Bei CI mit akustisch hörender Gegenseite" (`fmGroupCiAcoustic`):
    `fmHintMethodCiNatural` (plain) + `fmHintWarn` (caution).
  `_fmRenderIntroText` und der veraltete Key `fmHintMethod`
  (`#fmHintMethodPara`) sind entfernt.
- **Vorbedingungs-Hinweise (BA 160, Split seit 3.1.181):**
  - `#fmPrereqLvLeftPara`: erscheint wenn `sideData.left.bRes` und
    `sideData.left.jRes` leer sind. Text: `fmPrereqLvLeft`.
  - `#fmPrereqLvRightPara`: erscheint wenn `sideData.right.bRes` und
    `sideData.right.jRes` leer sind. Text: `fmPrereqLvRight`.
  - `#fmPrereqSbHintPara`: erscheint wenn `lrResults` leer (keine
    Stereo-Balance-Messung vorhanden). Text: `fmPrereqSb`.
  Die linke/rechte LV-Prüfung läuft seitenunabhängig vom
  Hörtechnik-`config` — auch auf Naturgehör-/Hörgerät-Seiten kann
  eine Ausgleichsmessung sinnvoll sein. Sichtbarkeit per
  `display`-Toggle in `_fmRenderPrereqHints()`, aufgerufen aus
  `fmApplyLang` und `_fmRefreshTabState`. Texte stehen statisch
  in `data-t` der Config (kein dynamisches Umschalten mehr).
  Helfer `_fmHasLvData(side)` prüft `bRes`/`jRes`-Befüllung.
- **Referenzseiten-Hinweise (BA 220):** `fmHintWarnBothCI` und
  `fmHintWarn` sind jetzt feste Bestandteile der jeweiligen Gruppe
  (s. o.) und immer sichtbar; kein dynamisches Umschalten mehr.
  Render-Stufe `caution` (orange).
- Cent-Slider (statt dB)
- Vergleicht CI-Elektroden-Ton vs. variabler Sinus auf der
  Restgehör-Seite
- Referenzseite-Auswahl (LINKS/RECHTS = welche Seite ist Restgehör)
  **Sperre (BA 151):** Das Dropdown wird per `dependency-lock.js`
  gesperrt, sobald FreqMatch-Daten vorliegen (`fRes` nicht leer,
  `_fmHasAdaptiveData()` oder `_fmHasSliderEstimates()`). Klick
  öffnet Popup mit Feldname „Referenzseite" und Auflistung der
  blockierenden Daten. Ersetzt den früheren `fmRCDlg`-Bestätigungsdialog
  (der beim Wechsel fRes gelöscht hätte).
- Ergebnis-Diagramm (`drawFreqMatchChart` in `chart.js`):
  - **Begriffe:** *Ist* = die im Implantat einprogrammierte Frequenz der
    Elektrode (`varFreq`, vom Implantat-Tab, ohne Warp). *Soll* = die
    Frequenz, an der die Elektrode laut Messung wahrgenommen wird
    (`refFreq`, das Ziel). Der Pfeil zeigt die nötige Korrektur von Ist
    nach Soll.
  - **X-Achse:** linear in Cent gegenüber 1 kHz (entspricht log-Hz, nur
    mit anderer Skalenkonvention). Keine Hz-Grid-Linien — die senkrechten
    Striche der Elektroden bilden das Raster.
  - **Y-Achse:** lineare Cent-Abweichung ΔC = Cent(Soll) − Cent(Ist),
    symmetrisch um 0, mit deutlich gezeichneter „0"-Beschriftung.
    Positiv = Soll liegt höher als Ist (Elektrode muß nach oben), negativ
    = umgekehrt.
  - **Nullinie:** schwarz, durchgezogen, ca. 2 px.
  - **Pro gemessener Elektrode:**
    - Ist-Strich an X=`C_ist` (grau, gestrichelt, vertikal durch den Plot)
    - Soll-Strich an X=`C_soll` (schwarz, durchgezogen, vertikal)
    - Ist-Punkt (klein, grau) bei `(C_ist, 0)` — auf der Nullinie
    - Soll-Punkt = Messpunkt (kräftig schwarz, mit Tooltip-Hitbox) bei
      `(C_soll, ΔC)` — auf der Soll-Linie
    - Pfeil schräg vom Ist-Punkt zum Soll-Punkt (Korrektur-Vektor)
  - **Ungemessene Elektroden:** nur ein durchgezogener heller Ist-Strich
    an `C_ist` + offener Kreis bei `(C_ist, 0)`.
  - **Ausgeschlossene Elektroden** (`elExDur` gesetzt oder `elSt='mute'`):
    nur Ist-Strich + ✕ bei `(C_ist, 0)`.
  - **X-Beschriftung unter dem Plot** (zwei Blöcke übereinander, je drei
    Zeilen pro Elektrode):
    - oben grau (Ist): „E*n*" / „*xxx* Hz" / „±*yyy* ct"
    - unten schwarz (Soll): „E*n*" / „*xxx* Hz" / „±*yyy* ct"
    - bei ungemessenen/ausgeschlossenen: nur die Ist-Elektrodennummer in
      der oberen Zeile, restliche Zeilen leer
  - **Mini-Legende** oben rechts: gestrichelter grauer Strich = „Ist",
    durchgezogener schwarzer Strich = „Soll".
- **Audio-Pfad:** jeder Ton wird vor `playToneTyped` mit der Korrektur-
  Lautstärke der Seite und der Stereo-Balance-Korrektur
  (`getRawBalanceGains`) multipliziert. Die Korrektur-Lautstärke
  kommt aus `compWLS` der jeweiligen Seite: bei der variablen Seite
  für die explizit gewählte Elektrode, bei der Referenzseite anteilig
  zwischen den beiden umgebenden Elektroden interpoliert (dB linear
  auf log-Hz-Achse). Beide Korrekturen werden nur angewendet, wenn die
  jeweilige Quelle Daten hat (Elektrodenlautstärke nur, wenn `bRes`
  der Seite gefüllt ist; Balance nur, wenn `plApplyBalance` an und
  `lrResults` gefüllt ist). Kurven und Schieber bleiben
  unberücksichtigt — bewußt, weil die Messung nur die Roh-Korrektur
  abbilden soll. Bei akustischen Seiten wirkt die Korrektur genauso
  wie bei CI-Seiten, weil die Messung dort Pseudo-Elektroden
  verwendet.

- **Modus-Schalter** (Bauanleitung 02b/2): Zwei Mess-Modi stehen zur Wahl.

  - **Slider Round** (BA 206, `freqmatch-slider.js`): Mehrfach-Runden-
    Verfahren. Pro Runde wird jede aktive (und nicht ausgeschlossene)
    Elektrode genau einmal in zufälliger Reihenfolge abgefragt. Der Test
    endet nicht von alleine — der Nutzer pausiert manuell per Pause-Knopf
    und kann jederzeit nahtlos weitermachen (Pause/Resume). Pro Elektrode
    sammelt sich eine Messwert-Historie (`rounds[]`) über alle Runden;
    das Aggregat daraus (Median bei ≥ 3 Werten, Mittelwert bei 2, Einzelwert
    bei 1) wird als `.cent`-Wert gespeichert und im Ergebnis-Diagramm
    angezeigt. Über dem Slider erscheint ab dem ersten gespeicherten Wert
    ein farbiges Dreieck (Aggregat/Median) mit Cent-Label darüber sowie ab
    zwei Werten ein blauer Balken (Min..Max-Bereich aller Runden). Fortschrittsanzeige:
    „Runde R · Elektrode C von T". Zustand läuft parallel zu adaptiven
    Daten — das Slider-Round-Verfahren ist im Dropdown nie gesperrt.
    Lösch-Button (`fmrClearSliderBtn`) löscht `sliderEstimates` und
    `sliderRoundRun` beider Seiten.

  - **Adaptiv** (2I-2AFC, `freqmatch-adaptive.js`): Beschrieben in
    `docs/spec/02b-freqmatch-adaptiv.md`. Default ist das adaptive
    Verfahren, sofern bereits adaptive Läufe vorliegen.

- **Auswahl Testelektroden** (BA 207): Header-Button „Testelektroden
  auswählen" mit nebenstehender Zusammenfassung („m von n Elektroden
  gewählt"; n zählt nur testbare = nicht stummgeschaltete und nicht
  ausgeschlossene Elektroden). Der Button öffnet einen Popup-Dialog
  mit Checkbox-Liste aller Elektroden in zwei Spalten (E1..E6 links,
  E7..E12 rechts bei 12 Kanälen). Stumm geschaltete Elektroden tragen
  das Suffix „(stumm)", ausgeschlossene das Suffix „(ausgeschlossen)";
  beide sind ausgegraut und nicht anklickbar. Buttons „Alle auswählen"
  / „Alle abwählen" wirken nur auf testbare Elektroden. Mindestauswahl:
  1 Elektrode. Die Auswahl gilt seitenübergreifend, weil
  Frequenzabgleich links↔rechts vergleicht. State-Variable:
  `freqmatchTestSelection: number[] | null` (`null` = Default „alle
  testbaren"). Persistiert in Save/Load als Top-Level-Feld.

  Auswahl-Änderungen während Pause oder laufendem Test:
  - Slider Round — `sliderRoundRun.remainingInRound` wird gefiltert,
    `fmSeq`/`fmSeqIdx` neu justiert; wenn die aktuelle Elektrode noch
    gewählt ist, bleibt sie aktuell, sonst springt der Test zur nächsten.
  - Adaptiv — Tracks bekommen Pseudo-Status `'deselected'` für abgewählte
    bzw. `'active'` für wieder ausgewählte (Status-Wechsel nur für aktive
    Tracks; konvergierte und nicht-wahrnehmbare bleiben unangetastet).
    `fmRoundQueue` wird geleert, damit `fmPickNextTrack` neu auswählt.
  - Wenn nach Filter keine testbare Elektrode mehr in der Auswahl ist,
    endet der laufende Test mit Hinweis „Test beendet: Keine ausgewählte
    Elektrode mehr verfügbar.".

  Bestehende Ergebnisse (`rounds[]`, `tracks[*]` mit Status
  `'converged*'`/`'not-perceivable'`/`'aborted'`) bleiben bei
  Selection-Änderungen unangetastet.

- **Seitenhörtest vor Test-Start** (BA 116/117): Bei jedem Klick auf
  Starten erscheint das Seitenhörtest-Modal (`testUI.sideCheck.run`,
  `cfg = {sides:'both'}`). Beide Seiten werden nacheinander geprüft
  (links zuerst); die Meldung verrät dabei nicht, welche Seite gerade
  gespielt wird (immer neutral: „Auf welcher Seite hören Sie den Ton?").
  Buttons: [Ton wiederholen] [Links]
  [Rechts] [Beide] [Nichts] [Abbrechen]. Richtige Seite →
  Modal schließt, Test startet. Falsche Seite / Nichts / Beide →
  Fehlermeldung + Retry-Schleife. Abbrechen → Test stoppt.
  Gilt für Slider- und adaptiven Modus. Auch der
  „Direkt adaptiv"-Button im Slider-Schätzungs-Dialog
  (`fmSEBtnSkip`) durchläuft denselben Seitenhörtest.

- **Idle-Watch** (BA 117, geändert 3.2.206.1): Nach Test-Start
  läuft ein 5-Minuten-Timer (`testUI.sideCheck.startIdleWatch`).
  Ohne Interaktion in dieser Zeit wird **die Seitenabfrage erneut
  ausgelöst** (`testUI.sideCheck.run({sides:'both'})`) — Sinn ist,
  während eines länger laufenden Tests zwischendurch zu prüfen,
  daß der Nutzer die Seiten weiterhin korrekt wahrnimmt (z. B.
  Bluetooth-Vertauschung, Implantat-Verrutschen). Bestätigt der
  Nutzer korrekt, läuft der Test weiter und der Idle-Watch startet
  erneut; bricht der Nutzer ab, wird der Test gestoppt
  (`fmEls._stopTest()`). Reset-Handler des Idle-Watch hängen auf
  `document` (statt am Panel-Element), damit auch Replays per
  Leertaste mit Fokus außerhalb des Panels den Timer zurücksetzen.
  `fmAbort` stoppt den Idle-Watch (`testUI.sideCheck.stopIdleWatch`).
  Gemeinsame Implementierung in `freqmatch.js:_fmStartIdleSideCheck`,
  aufgerufen aus `_fmDoStartSlider` und `_fmDoStartAdaptive`.

### Sub-Tab 4 — Latenz (latency.js)

- **Implantat-Änderungs-Hinweis (BA 156):** Das `latencyResult`-Objekt
  enthält seit BA 156 ein `implantSnapshot`-Feld (gleiche Struktur wie
  `lrSnapshot`). `renderSnapshotHint` vergleicht diesen Snapshot beim
  Öffnen des Latenz-Reiters mit dem aktuellen Stand und zeigt denselben
  Hinweis-Banner wie bei Stereo-Balance. Alter Datensatz ohne Snapshot
  → kein Hinweis.
- Panel wird von `buildTestPanel` erzeugt (BA 223); kein statisches HTML mehr.
- Schieber ±50 ms initial, Auto-Extend bis ±2000 ms, Auflösung 1 ms / 0,1 ms
  (Touch-Bedienleiste und Pfeiltasten via testUI).
- Schieber ist **nur während laufendem Test** sichtbar (testBox auto-ein/ausgeblendet).
- Klick-Intervall manuell wählbar: 100 / 200 / 500 / 1000 / 2000 ms (Button-Reihe
  in `header.extra.fragment`).
- 4 Klangvarianten: Klick (breitband), 500 Hz, 1500 Hz, 4 kHz Tone-Bursts
  (Button-Reihe in `header.extra.fragment`).
- Eigener Lautstärke-Regler im Header (`header.common.volume`, Default 50 %);
  multipliziert die Balance-Gains im Audio-Pfad.
- **Nur mit Kabel-Kopfhörer durchführen** — Bluetooth verfälscht die Messung
  (`latBTWarning`, `kind: 'caution'`).
- Vorbedingungs-Hinweis (`latPrereqHint`, `kind: 'warn'`): immer sichtbar.
- Vortest-Empfehlungen (je `kind: 'warn'`, anfangs hidden):
  - `latVortestBalanceMissing`: eingeblendet wenn noch keine Balance-Werte gemessen.
  - `latVortestLoudnessMissing`: eingeblendet wenn noch keine Lautstärke-Werte gemessen.
  - Sichtbarkeit wird bei jedem Öffnen des Sub-Tabs via `testUI.explain.setVisible`
    aktualisiert — kein Showstopper, der Test läuft auch ohne.
- **Audio-Pfad:** Klick-Buffer → ChannelSplitter → L/R-Gain (Balance aus
  `getRawBalanceGains` × Volume-Faktor) → ChannelMerger → `pGain` →
  `pLatSplitter` → `pLatDelayL`/`pLatDelayR` (2,0 s Puffer) → `pLatMerger` →
  `destination`. Elektrodenlautstärke wird nicht angewendet.
- **Seitenhörtest** vor Start: `testUI.sideCheck.run({sides:'both'})`.
- **„Offset bestätigen"** (`applyButton`): speichert aktuellen Schieberwert als
  `latencyResult` und beendet den Test. ENTER löst dieselbe Aktion aus
  (testUI-Enter-Routing für `applyButton`).
- **„Test abbrechen"** (Stop-Button, `stopKey: 'btnCancelTest'`): beendet den
  Test **ohne** den Wert zu speichern. Pfeiltasten kommen aus testUI.
- Während des Tests: alle anderen Tabs und Sub-Tabs gesperrt (testUI-Lifecycle).
- Wirkung live im Player (`latApplyToPlayer`), sofern `plApplyLatency` aktiv
- Persistenz: `latencyResult` und `plApplyLatency` werden gespeichert/geladen
  (beide Pfade: file.js-Download/Upload und localStorage-Auto-Restore in init.js)
- Ergebnis-Sub-Tab „Latenz": zentrierte Highlight-Box (wie Stereo-Balance)
  mit Label, großem Zahlenwert in Akzentfarbe + Monospace, kurzem Klartext;
  Kontext (Klangtyp + Intervall) darunter; kein „Wird ausgeglichen.";
  Button „Latenz-Ergebnis löschen" (`latClearBtn`, rot) unterhalb der Box —
  setzt `latencyResult = null` und aktualisiert die Anzeige.
- Im Player: Toggle-Button „Latenzausgleich" (`plLatApplyBtn`) neben
  „Stereo-Balance"-Button — aktiviert/deaktiviert `plApplyLatency`;
  grün wenn aktiv, grau wenn inaktiv; Sync via `updLatApplyBtn()` in tabs-eq.js
- Druck-Unterstützung via `_printResLatency` in tab-print.js
