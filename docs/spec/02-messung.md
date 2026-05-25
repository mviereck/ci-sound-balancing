## Messungen — drei Sub-Tabs

Alle drei Tests teilen sich denselben Aufbau, erzeugt durch den
Builder `buildTestPanel` aus test-ui.js. Drei Blöcke pro Test:

1. **Erklärungen** (reiner Text)
2. **Voreinstellungen** (Bedienelemente vor dem Test, Start/Stop)
3. **Test** (während der Messung; sperrt alle anderen Tabs und
   Sub-Tabs)

### Globale Test-Einstellungen

In `state-side.js` und persistiert in JSON und localStorage:

- **Tonart** (`globalToneType`) — Sinus / Komplexton / Rauschen /
  Schmalbandrauschen adaptiv / AM-Sinus / Warble-Sinus / Sinus-Bursts
  / Wobble-Sweep. Default `'sine'` (Sinus). Dropdown im
  Voreinstellungs-Block aller drei Tests sichtbar; alle Instanzen an
  dieselbe Variable gebunden.
- **Tonfolge** (`globalSequence`) — `'aba'` oder `'ab'`. Default
  `'aba'`. Vor dem Test wählbar, während des Tests fest.

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
- Slider-Bereich in 3 Stufen erweiterbar:
  - Test 1+2: ±20 dB → ±40 dB → ±60 dB
  - Test 3: ±100 cent → ±500 cent → ±1200 cent
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

- **Modi**: balance (Slider) und judgment (3-Knopf-Urteil)
- **Testverfahren**: vollständig (alle Paare) / Konvergenz schnell /
  manuell
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
- Wenn Modus „Vollständig" angefangen aber nicht abgeschlossen wurde,
  zeigt der Ergebnis-Reiter oben einen Hinweis mit Runde X von Y und
  bestätigten Paaren des aktuellen Sweeps.

### Sub-Tab 2 — Stereo-Balance (lr-balance.js)

- Reihenfolge der Elektroden: zufällig / apikal→basal / basal→apikal
- Seitenfolge: zufällig / L→R / R→L
- Vergleicht gleiche Frequenz auf beiden Ohren
- Vorbedingungs-Hinweis (`lrPrereqHint`): „Führen Sie zuerst die
  Messung Elektrodenlautstärke für beide Seiten aus." — reiner Hinweis,
  nicht zwingend

### Sub-Tab 3 — Frequenzabgleich (freqmatch.js)

- Vorbedingungs-Hinweis (`fmPrereqHint`) im Erklärungsblock: „Führen
  Sie zuerst die Messungen Elektrodenlautstärke und Stereo-Balance für
  beide Seiten aus." — erscheint zwischen `fmHintMethod` und `fmHintWarn`
- Cent-Slider (statt dB)
- Vergleicht CI-Elektroden-Ton vs. variabler Sinus auf der
  Restgehör-Seite
- Referenzseite-Auswahl (LINKS/RECHTS = welche Seite ist Restgehör)
- Bei Wechsel des Referenzohrs nach vorhandenen Ergebnissen:
  Bestätigungsdialog, Verwerfen der bisherigen Ergebnisse
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

- **Modus-Schalter** (Bauanleitung 02b/2): Ein zweiter Mess-Modus
  (adaptiv, 2I-2AFC) ist in `docs/spec/02b-freqmatch-adaptiv.md`
  beschrieben und wird über den Modus-Schalter im Sub-Tab gewählt.
  Default ist der adaptive Modus. Im adaptiven Modus werden Slider,
  Übernehmen-Button, Confidence-Radios und Tonfolge-Dropdown
  ausgeblendet; stattdessen erscheinen Höher/Tiefer-Buttons und das
  Status-Grid. Im Slider-Modus bleibt das bisherige Verhalten erhalten.

### Sub-Tab 4 — Latenz (latency.js)

- Schieber ±200 ms, Auflösung 1 ms / 0,1 ms (Fein-Toggle per Touch-Bedienleiste). Auf Desktop zusätzlich Ctrl+Pfeil = 10 ms wie bisher.
- Schieber ist **nur während laufendem Test** bedienbar (sonst disabled)
- Klick-Intervall manuell wählbar: 100 / 200 / 500 / 1000 / 2000 ms
- 4 Klangvarianten: Klick (breitband), 500 Hz, 1500 Hz, 4 kHz Tone-Bursts
- **Nur mit Kabel-Kopfhörer durchführen** — Bluetooth verfälscht die Messung
  (Hinweis-Box im Messpanel, nach der Überschrift)
- Vorbedingungs-Hinweis (`latPrereqHint`): „Führen Sie zuerst die
  Messungen Elektrodenlautstärke und Stereo-Balance für beide Seiten
  aus." — erscheint nach der BT-Warnbox, vor der Schieber-Anleitung
- Mess-Panel: Überschrift → kurze Beschreibung → Wichtig-Hinweis (BT) →
  Vorbedingungs-Hinweis → Schieber-Anleitung → Hinweis auf Ortungswahrnehmung als Anhaltspunkt
- **Audio-Pfad:** Klick-Buffer → ChannelSplitter → L/R-Gain (aus
  `getRawBalanceGains`, ignoriert `plApplyBalance`) → ChannelMerger → `pGain` →
  `pLatSplitter` → `pLatDelayL`/`pLatDelayR` → `pLatMerger` →
  `destination`. Die Stereo-Balance-Gains werden beim Test-Start
  aus dem aktuellen Stand übernommen und beim Test-Ende wieder
  verworfen. Elektrodenlautstärke wird nicht angewendet, weil die
  Klicks breitband sind und keiner Elektrode zugeordnet werden.
- Beim **Stop** wird der aktuelle Schieberwert automatisch als `latencyResult`
  übernommen (kein separater „Übernehmen"-Button)
- **ENTER beendet den laufenden Test** — äquivalent zum Klick auf den
  Stop-Button. Die Bindung läuft global auf `document`, greift aber nur,
  wenn `latActive === true`. Inputs/Textareas/Selects werden ausgespart;
  der Latenz-Slider selbst ist als bewußte Ausnahme eingeschlossen, weil
  er die häufigste Fokus-Position während des Tests ist.
- Während des Tests: alle anderen Tabs und Sub-Tabs gesperrt (wie bei allen
  anderen Tests — via `lockTestTabs` / `updateTabLockState`)
- Wirkung live im Player (`latApplyToPlayer`), sofern `plApplyLatency` aktiv
- Persistenz: `latencyResult` und `plApplyLatency` werden gespeichert/geladen
  (beide Pfade: file.js-Download/Upload und localStorage-Auto-Restore in init.js)
- Ergebnis-Sub-Tab „Latenz": zentrierte Highlight-Box (wie Stereo-Balance)
  mit Label, großem Zahlenwert in Akzentfarbe + Monospace, kurzem Klartext;
  Kontext (Klangtyp + Intervall) darunter; kein „Wird ausgeglichen."
- Im Player: Toggle-Button „Latenzausgleich" (`plLatApplyBtn`) neben
  „Stereo-Balance"-Button — aktiviert/deaktiviert `plApplyLatency`;
  grün wenn aktiv, grau wenn inaktiv; Sync via `updLatApplyBtn()` in tabs-eq.js
- Druck-Unterstützung via `_printResLatency` in tab-print.js
