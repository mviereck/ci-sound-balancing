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

- **Tonart** (`toneType_test` / `toneType_balance`, seit BA 254 vollständig per Test; kein `globalToneType` mehr) — **CI-Testton harmonisch / CI-Testton
  inharmonisch** (3.2.238.1, citest-profiles.js — für CI-Messungen
  designte Stimuli mit konstanter Klangfarbe über den ganzen
  Frequenzbereich, sanftem Anschwingen (seit BA 270 global einstellbar:
  Default cos², 500 ms), Vibrato 5 Hz/5-6 cent und AM 3.5 Hz/8 % gegen
  Stationaritätsartefakte;
  inharmonisch mit Partial-Verstimmung ≈ Glocken-Anmutung) /
  **CI-Test Modulation mittel / AM-langsam / flach** (3.2.238.2,
  Diagnose-Varianten zum harmonischen CI-Test: Modulation mittel (früher
  „Attack-stark") hat 18 % AM-Tiefe als Zwischenstufe zwischen CiH (8 %)
  und AM-langsam (25 %); AM-langsam moduliert mit 2,7 Hz / 25 % in der
  bei Martin beobachteten Wellen-Frequenz; flach hat keine AM — bei Martin
  der ruhigste Klang, AGC bekommt keine Modulation zum Hinterherregeln.
  BA 270: profileigene `attackMs`-Werte entfernt, Anschwingzeit global.) /
  **CI-Test pur / inharmonisch flach** (3.2.239.2, weitere Diagnose-
  Töne nach Nutzer-Test mit CiHF: pur lässt zusätzlich Vibrato weg —
  prüft, ob bei manchen CIs Frequenzmodulation auch Welle erzeugt;
  inharmonisch flach isoliert die Inharmonik gegen die AM-Wirkung) /
  Sinus / Komplexton / Komplexton gepulst
  (100 Hz AM) / Reicher Komplexton (BA 213.4, 8 Harmonische + Vibrato
  5 Hz + Atem-AM 3 Hz) / Rauschen / Schmalbandrauschen adaptiv /
  Iterated Rippled Noise (BA 213.4, 16 Iterationen Add-and-Delay) /
  **Reicher Komplexton: Akkordeon / Altsaxophon / Basstuba / Bratsche /
  Fagott / Klarinette in B / Kontrabass / Oboe / Posaune / Querflöte /
  Trompete in C / Violine / Violoncello / Waldhorn** (BA 215, Profile
  aus TinySOL/IRCAM analysiert in BA 214) /
  AM-Sinus / Warble-Sinus / Sinus-Bursts / Wobble-Sweep /
  **CI-Test Vibrato langsam / schmal / Sänger / AM dezent / AM stark /
  Schwebung / Drift sanft / Drift stark** (0.4.282.1, Grundton-Varianten
  in der Gruppe „Experimentelle Töne": drei Vibrato-Formen (3 Hz / 6 cent,
  5 Hz / 3 cent, 6 Hz / 40 cent), zwei AM-Stufen (8 % bei 3,5 Hz, 25 %
  bei 3 Hz), Schwebung über zwei Sinüsse +5 cent (~3 Hz Beat bei 1 kHz,
  logarithmisch konstanter Cent-Abstand), zwei Drift-Varianten über
  bandbegrenztes Rauschen — Engine `playRichToneProfile` um Profil-Felder
  `driftHz`/`driftCents` erweitert) /
  **Sinus + Nachbarelektroden / Sinus + Rauschen 50/50 / Sinus + Rauschen
  100/50** (BA 273, Gruppe „Experimentelle Töne") /
  **Cluster ±3 Hz 2N / Cluster ±3 Hz 4N / Cluster ±8 Hz 2N / Cluster ±8 Hz 4N /
  Cluster ±10 ct 2N / Cluster ±10 ct 4N / Cluster ±30 ct 2N / Cluster ±30 ct 4N**
  (BA 274, Schwebungs-Cluster in der Gruppe „Experimentelle Töne"). Default
  `'richCiG'` (CI-Test Grundton; seit BA 280 — zuvor `'richCiHF'`/`'complex'`).
  Seit BA 254: kein gemeinsamer Dropdown mehr; jeder Test wählt seine Tonart
  über den Tonart-Popup-Button im eigenen Header.
- **Tonart Frequenzabgleich** (`toneType_freqmatch`, BA 209) — eigene
  Tonart für Sub-Tab 3. Default
  `'richCiG'` (CI-Test Grundton; seit BA 280 — zuvor `'richCiHF'`/`'pulsedComplex'`).
  Wird über Button + Popup-Dialog gewählt (kein
  Dropdown), persistiert in JSON und localStorage. Auto-Vorschau-Ton
  (750 ms) gilt nur noch für die globalen Dropdowns; im Frequenzabgleich
  übernimmt das Popup-Probehören diese Funktion.
  Dialog (BA 217): Tonarten in sechs Gruppen (CI-Testtöne (3.2.238.1),
  Sinustöne, Komplextöne, Instrumenten-Klänge, Rauschsignale,
  Experimentelle Töne (BA 273)) mit
  Kurzbeschreibung pro Tonart. Die CI-Testtöne-Gruppe steht oben, weil
  sie für Mess-Aufgaben empfohlen ist. Reihenfolge in der CI-Test-
  Gruppe (0.4.269.2): CiHF (flach), CiG, CiS, CiH, CiP, CiB, CiBF,
  CiHA, CiHS — CiHF zuerst, weil bei Martin die ruhigste Variante.
  CiG (Grundton mit Vibrato) und CiS (Grundton ohne Vibrato) direkt
  danach als Diagnose-Varianten zu Akkord- und Vibrato-Hypothese aus
  Anhang B der Konzept-Doku.
  Jede Gruppe hat eine Überschrift und einen Unter-Hinweis (i18n).
  Alle richXX-Profile haben hinterlegtes Vibrato (Streicher aus
  TinySOL-Messung, übrige aus Spielpraxis-Tabelle), das immer zu
  100 % auf die Synthese durchgreift; eine UI-Skalierung gibt es nicht.
  (Mellotron-Sampler war von Version 3.2.225 bis 3.2.239.1 als sechste
  Gruppe mit 34 Original-Mellotron-Varianten enthalten. Seit 3.2.239.2
  aus der Tonart-Auswahl entfernt — soll laut Nutzer-Wunsch später im
  Player-Tab erscheinen, nicht in der Mess-Tonartwahl. Token-Schema
  `smplr:mellotron:<variantName>`, Code-Pfad in `smplr-loader.js` und
  `_playSmplrTone` in `audio.js` bleibt erhalten; Gruppen-Definitionen
  in `tone-popup.js` als `_SMPLR_GROUPS_PARKED` aufgehoben für
  schnelle Wiederverwendung. Soundfont2 war bis 3.2.226.4 ebenfalls
  als zusätzliche Gruppe vorhanden, ab 3.2.226.5 entfernt — Klang
  stumm wegen race condition.)
  Lade-Visualisierung (BA 226, **entfernt in BA 240**): Sanduhr-Konzept
  (`_setHourglassFor`, `btn-hourglass`-Spans, smplr-Lade-Branch in
  `_playPreview`) vollständig entfernt. Vorspiel-Klick auf eine smplr-
  Tonart startet die Sequenz direkt (Sampler muss vorab geladen sein,
  sonst bleibt der Burst stumm — kein separater Lade-Pfad mehr).
  Klavier-Widget (seit BA 228, BA 252): Oberhalb der Tonart-Liste
  erscheint im Frequenzabgleich-Kontext ein Klavier. Tastenzahl =
  Minimum aus Elektrodenzahl var-Seite und ref-Seite; beschriftet
  mit Elektrodennummer der var-Seite. Zwischen je zwei weißen Tasten
  eine schwarze Zier-Taste auf dem geometrischen Mittel der
  Nachbarfrequenzen. Abgewählte (`elActive === false`) oder
  ausgeschlossene (`elExDur != null`) Elektroden werden angezeigt,
  aber per X-Overlay durchgekreuzt und ausgegraut (früher: gefiltert).
  Disabled-Logik gilt beidseitig: eine Taste ist disabled, sobald die
  Elektrode auf var- ODER ref-Seite abgewählt/ausgeschlossen ist
  (`getDisabledElectrodes`-Callback). Taste **gedrückt halten** → Ton auf
  var-Seite mit deren Elektrodenkorrektur und Stereo-Balance-Gain
  (`fmCorrGain * dB2G(balDb)`); **Loslassen** → stoppt und spielt die
  ref-Seite in der Frequenz ihrer Elektrode, mit deren Korrektur, für
  die gemessene Haltedauer (BA 293). `fmGDur`/`fmGPau` wirken nur noch
  im Sequenz-Betrieb. Anschlag auf disabled Taste
  löst keine Wiedergabe aus (Cursor „nicht erlaubt"). Das Klavier ist
  abstrakt in `sampler-keyboard.js` implementiert (cfg.keyboardMode =
  true) und für künftige Aufrufer wiederverwendbar.
  **Vol/Dur/Pau-Felder im Modal (seit BA 240)**: Direkt unter den
  Korrektur-Toggles erscheinen bis zu drei Eingabefelder (je nach
  Aufrufer via `cfg.showVolume/showDuration/showPause` aktivierbar):
  Lautstärke (0–100 %, Default 75), Tondauer (100–3000 ms, Default 750),
  Tonpause (50–2000 ms, Default 400). Werte werden live über
  `cfg.setVolumePercent/setDurationMs/setPauseMs` an State-Variablen
  zurückgeschrieben (kein OK-Bestätigen nötig). Hint-Box konfigurierbar
  via `cfg.hintKey` (i18n-Key; ohne Key keine Box).
  Korrektur-Toggles im Modal (seit BA 239): Oberhalb der Tonart-
  Gruppen (und ggf. oberhalb des Klavier-Widgets) zwei Toggle-
  Buttons (grün/grau analog Player). Default beide an, lokal in
  der Modal-Instanz (keine Kopplung an Player-Variablen):
  - **Elektrodenlautstärke anwenden** — pro Vorspiel-Step wird
    aus `step.hz` die nächste aktive Elektrode der Step-Seite
    (Pan→`withSide`) bestimmt und der dB-Wert aus `levels[]`
    (`compWLS()`, Ergebnis der Messung Elektrodenlautstärke-
    Balance) als vol-Faktor angewandt. Wirksamkeitsbedingung
    wie im Player: nur dort, wo `bRes` für die Elektrode einen
    Eintrag mit gültigen Endpunkten hat (sonst 0 dB).
  - **Stereo-Balance anwenden** — pro Step bekommt das vol je
    nach `step.pan` einen dB-Versatz aus dem Mittelwert von
    `lrResults`. Fest symmetrisch (`left = +b, right = -b` mit
    `b = -mean`), unabhängig vom Player-eigenen `plBalanceMode`.
    Immer aktivierbar (kein Ausgrauen bei einseitiger Sequenz —
    die Wirkung bleibt halt einseitig).
  Sichtbarkeit (seit BA 256): in den vier Test-Modalen
  (Elektrodenlautstärke, Stereo-Balance, Latenz, Frequenzabgleich) wird
  die Toggle-Reihe nicht mehr gerendert (`showToggles: false` im jeweiligen
  `tonePopupButton`-cfg). Im Reiter Implantat bleibt die Reihe sichtbar
  (`ui-implant.js` setzt das Flag nicht).
  Latenz-Anwendung im Modal entfällt: die Vorspielsequenzen sind
  heute sequentiell, Inter-Ohr-Latenz hätte keine hörbare Wirkung.
  **BA 292 — Probehören-Modell:** `_playPreview` ist ab BA 292 ein
  reiner Durchreicher; fertige Token (inkl. `vol`) kommen aus
  `getPreviewSequence(lastHz)`. Die Toggles wirken daher nur noch
  im Reiter Implantat (dort ruft `getPreviewSequence` intern
  `_implTpCorrectVol` auf) und bei Klavier-Anschlägen (alle Modals,
  via `cfg.onTogglesReady(corrector)`). Auf den Preview-Button der
  Test-Modals haben sie keinen Effekt mehr — dort war die Toggle-
  Reihe ohnehin ausgeblendet.
  Die Toggles wirken auch auf das Klavier-Widget im Modal: über
  `cfg.onTogglesReady(corrector)` erhält `freqmatch.js` eine
  Korrektorfunktion (`fmKbdCorrectVol`), die `onPress` pro
  Klavier-Anschlag auf Var- und Ref-Burst anwendet.
- **Tonfolge** (`sequence_test` / `sequence_balance` / `sequence_freqmatch`, seit BA 254 je pro Test) — `'aba'` oder `'ab'`. Default je `'ab'`. Vor dem Test wählbar, während des Tests fest. Jeder Sub-Tab hat einen eigenen Dropdown; eine Änderung in einem Test beeinflusst die anderen nicht.
- **Hüllkurve / globale Anstiegs- und Ausklangform** (BA 270/271) —
  vier globale Variablen steuern die Ton-Hüllkurve toolweit (gelten
  für jeden Vorhör-Klick, unabhängig vom Aufrufer):
  - `gToneEnvAttackForm`: `"hard"` | `"linear"` | `"cos2"` |
    `"dblin"` (Default) — bestimmt die Anstiegsform.
  - `gToneEnvAttackMs`: Anschwingzeit in ms (Default 160).
    Bei `"hard"` ignoriert.
  - `gToneEnvDbFloor`: Startpegel in dB (Default −20). Nur bei
    `"dblin"` wirksam.
  - `gToneEnvRelease`: `"short"` (Default) | `"sym"` | `"hard"` —
    bestimmt die Ausklangform (symmetrisch = gleich lang wie
    Anstieg; short = 30 ms cos²; hard = kein Ausklang).
  Setter `setToneEnvelope(patch)` in `audio.js` schreibt ein
  oder mehrere Felder und persistiert alles in `localStorage`.
  **UI (BA 271):** Sektion „Anstieg & Ausklang" im Tonauswahl-Modal
  (`tone-popup.js`). Steht **immer** sichtbar (unabhängig von
  `cfg.showToggles`), weil die Einstellung toolweit für alle Töne
  gilt. Vier Anstiegs-Buttons (hart / linear / weich / dB-linear),
  editierbares Anschwingzeit-Feld (Vorschläge 0/50/100/250/500/1000 ms;
  bei „hart" ausgegraut), Startpegel-Feld (nur bei dB-linear sichtbar),
  drei Ausklang-Buttons (kurz / symmetrisch / hart). Jede Änderung
  wirkt sofort ohne OK-Bestätigen. Werte werden aus `localStorage`
  wiederhergestellt.
  Burst-Sinus hat zusätzlich eine eigene 10 ms-Burst-interne Rampe,
  die unabhängig von der globalen Hüllkurve bleibt.

### Slider-Wirkung (pro Test eigener Wert)

- **Test 1**: kein Dropdown mehr (BA 283 entfernt). Der Slider wirkt
  über eine Zwei-Zonen-Logik (`pairGains` in `js/audio.js`):
  - *Zone 1* (genug Reserve nach oben): beide Töne symmetrisch `±off/2`
    — bei Slider +6 dB wird A mit −3 dB, B mit +3 dB gespielt.
  - *Zone 2* (ein Ton am Maximalpegel): der lautere Ton bleibt am
    Maximum, der andere wird um den vollen `off` abgesenkt — der
    gemessene Unterschied entspricht damit immer dem Slider-Wert.
  Gilt sowohl beim Nacheinander-Abspielen (`playSeq`) als auch beim
  Knopf "Gleichzeitig" (`_testPlaySimul`). Default-Tool-Lautstärke:
  **50 %** (ca. 12 dB Reserve — deckt den Standard-Slider ±20 dB ab;
  Zone 2 nur bei erweitertem Bereich oder fast stummen Elektroden).
  In Zone 2 erscheint unter der Knopfzeile ein dezenter Hinweis
  (BA 285): „E9 hat die maximale Lautstärke erreicht — nur E6 wird
  noch angepasst." (Elektroden-Bezeichnungen je nach Paar). Der
  Hinweis verschwindet, sobald der Slider wieder in Zone 1 liegt.
- **Test 2**: kein Dropdown mehr (BA 289 entfernt). Der Schieber wirkt
  immer symmetrisch (`±off/2`): positiver Wert = rechts lauter / links leiser.
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
- **Test 1 Konvergenz** (`conv`): kein Resume.
- **Test 2 und Test 3**: kein Resume.
- UI-Texte suggerieren Resume nur dort, wo es tatsächlich greift.

### Sub-Tab 1 — Elektrodenlautstärke ausgleichen (test.js)

- **Testverfahren** (BA 247): Zwei Verfahren im Verfahren-Dropdown:
  „Round Robin (Vollständig)" (`full`) und „Konvergenz" (`conv`).
  Frühere Verfahren `selective`, `manual` und Modus `judgment` entfallen.
- **Elektroden-Auswahl** (BA 247): Über den `electrodeSelection`-Header-
  Baustein kann der Nutzer die Sequenz auf bestimmte Elektroden filtern;
  es werden nur Paare gespielt, in denen **beide** Elektroden gewählt
  sind (UND-Logik, BA 247fix). Mindestauswahl 2 (`minSelected: 2`), sonst
  käme kein Paar zustande. State `_testSelectedEls` in test.js, Filterung
  beim Start über `_testFilterByElectrodeSelection`.
  - **Auswahl-Änderung während laufendem Test** (Bugfix 0.4.279.1):
    `setSelection` ruft `_testApplySelectionDuringRun` auf, das die noch
    nicht gespielte Restsequenz (ab `testIdx`) sofort neu filtert. Bereits
    absolvierte Vergleiche bleiben erhalten; ein betroffenes aktuell
    angezeigtes Paar wird sofort übersprungen. Bleibt nach dem Filter
    kein Paar übrig, endet der Test (`endTest` + `renderResults`). Zuvor
    wirkte die Abwahl erst beim Neustart bzw. — bei Round Robin — in der
    nächsten Runde, sodass abgewählte Elektroden im laufenden Durchlauf
    weiter abgefragt wurden.
  - **Aktiv-Stand und „x von y"-Anzeige** (Bugfix 0.4.279.3,
    verfahrensübergreifend für `test`, `lr-balance`, `freqmatch`):
    `getElectrodeStatus` zählt eine im Implantat-Reiter abgewählte
    Elektrode (`elActive===false`) in **allen** drei Verfahren als
    nicht-testbar (zuvor beachteten `test` und `lr-balance` nur
    Ausschluß + Status „stumm", nicht das „Aktiv"-Häkchen). Die
    Kopf-Anzeige „{m} von {n} Elektroden gewählt" bleibt **immer
    sichtbar** — auch bei 0 wählbaren Elektroden steht „0 von 0 …"
    statt leerem Text (`_esUpdateSummary` in test-ui.js). Ändert sich im
    Implantat-Reiter ein „Aktiv"- oder „Ausschließen"-Häkchen, rechnet
    die Anzeige **sofort** nach: die Checkbox-Handler in freq-table.js
    rufen `_freqTableRefreshMeasSummaries()` (→ die drei
    `*RefreshElectrodeSelectionSummary`-Funktionen) auf.
- A/B-Zuordnung und Paarreihenfolge immer randomisiert.
- Referenzelektroden-Auswahl erfolgt im Ergebnis-Reiter
  (Elektrodenlautstärke-Balance), nicht mehr im Test selbst. Sie
  wirkt nur auf die Anzeige und Anwendung der Ergebnisse, nicht auf
  die Messung.
- Die Referenzelektrode ist **rein seitenspezifisch**: jede Seite
  (jedes Ohr) hat ihre eigene gespeicherte Referenz; das Umschalten
  zwischen den Seiten zeigt die jeweils eigene Referenz, und der
  Player folgt automatisch der Referenz der angezeigten Seite. Der
  **Default** ist die rechnerische Mitte der Elektrodenzahl der Seite
  (herstellerabhängig, z.B. E7 bei 12 Elektroden), wobei deaktivierte
  und stummgestellte Elektroden übersprungen werden — von der Mitte
  aus nach außen die nächste nutzbare Elektrode, bei Gleichstand die
  tiefere. Zeigt eine geladene/gespeicherte Referenz auf eine
  inzwischen deaktivierte/stumme Elektrode oder fehlt sie, fällt sie
  auf diesen Default zurück. Implementierung: `pickDefaultRefEl(side)`
  und `setRefEl(v)` (einziger Schreibweg) in `state-side.js`.
- Die Referenzelektrode ist im Loudness-Graph durch ein fettes
  schwarzes „Ref.-El."-Label am oberen Rand markiert — zusätzlich
  zur bisherigen Hervorhebung als fettes blaues Achsen-Label. In
  der Loudness-Tabelle gibt es eine neue Spalte „Ref.El." am Ende;
  die Zeile der Referenzelektrode trägt ein großes `X`.
- **LS-Hint-Anzeige** (rangeHint, BA 247): Über dem Slider erscheint
  ein blauer Balken mit dB-Wert an der Position der LS-Schätzung
  des aktuellen Paares (`testUI.slider.setRangeHint`). Die halbe
  Bandbreite ergibt sich aus Residuum und Stichproben-Aufschlag
  (`basis·k/(k+N)`, basis = 2.5 dB, k = 3). Sichtbar nur, wenn
  beide Elektroden in mindestens einer Messung vorkommen.
- **Slider-Startwert** (BA 247, erweitert 280.2): Bei bereits
  gemessenem Paar startet der Slider auf dem gespeicherten Offset. Bei
  ungemessenem Paar startet er am **zufaellig gewaehlten Rand** des
  Unsicherheitsbandes der LS-Schaetzung (`estimate +/- halfWidth`,
  Vorzeichen je Aufruf zufaellig), sofern eine Datenbasis existiert;
  sonst auf 0. Begruendung: ein Start exakt auf dem Schaetzwert macht
  blosses Bestaetigen zu einem Null-Residuum und laesst die errechnete
  Unsicherheit kuenstlich schrumpfen (Scheinkonvergenz); das zufaellige
  Vorzeichen haelt den Mittelwert bias-frei. `curBase` ist immer 0
  (kein Sockel mehr).
- Keine Kumulations-Anzeige, keine Konfidenz-Eingabe (BA 247).
- **Tonart** (BA 247): Eigener Popup-Dialog (state `toneType_test`,
  analog Freqmatch), nicht mehr das globale Dropdown.
- **Lautstärke / Tondauer / Tonpause im Tonart-Popup (BA 250)**:
  Die drei Felder sind in den Tonart-Popup-Dialog gewandert (states
  `volume_test` int 0–100, Default 75; `duration_test` ms, Default 750;
  `pause_test` ms, Default 300). Im Header-Bereich erscheinen sie
  nicht mehr. Analog Freqmatch seit BA 240. Persistiert in JSON.
- **Klavier-Widget im Tonart-Popup (BA 252)**: Analog Frequenzabgleich
  erscheint oberhalb der Tonart-Liste ein Klavier. Tastenzahl =
  Elektroden der aktiven Seite (eine Seite, da Elektrodenlautstärke
  einseitig). Abgewählte/ausgeschlossene Elektroden per X-Overlay
  durchgekreuzt. Taste **gedrückt halten** → Ton auf der aktiven Seite,
  ohne Mess-Korrektur (die wird hier erst gemessen); **Loslassen** → Stopp
  (BA 293). Korrektur-Toggles haben auf das Klavier keinen Effekt mehr.
- Wenn „Round Robin (Vollständig)" angefangen aber nicht abgeschlossen
  wurde, zeigt der Ergebnis-Reiter oben einen Hinweis mit Runde X
  von Y und bestätigten Paaren des aktuellen Sweeps.
- **Seitenabfrage vor Test-Start (BA 255):** Beim Klick auf „Test starten"
  erscheint das Seitenabfrage-Modal (`testUI.sideCheck.run({sides:'one', side: activeSide})`).
  Nur die aktuell eingestellte Seite wird abgefragt. Erst nach Bestätigung
  startet der eigentliche Test.
- **Abschluss-Box (BA 279):** Nach natürlichem Abschluss von „Round Robin
  (Vollständig)" (alle Runden durch) erscheint eine Abschluss-Box
  (`testUI.completion.show`) mit Fanfare-Klang, Titel „Test Round Robin
  beendet." und Hinweis auf den Ergebnis-Reiter. Bei Stop/Pause und beim
  Verfahren „Konvergenz" keine Box.

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
- **Tonart-Auswahl (BA 253):** Button im Header „Tonart: *Aktualwert*"
  öffnet die Tonauswahl-Modalbox (analog Frequenzabgleich BA 209 und
  Elektrodenlautstärke BA 250). Auswahl persistiert in
  `toneType_balance` (Default `richCiG`). Der frühere Tonart-Dropdown
  im Header ist entfernt. Probehör-Sequenz (BA 292): Test läuft →
  echte Testsequenz mit aktuellem Schieber-Pegelunterschied
  (`lrSequence({ aba: sequence_balance === 'aba' })`). Kein Test →
  gemerkter Klavier-Ton links, Pause, gleicher Ton rechts (Default
  1000 Hz; zurückgesetzt bei jedem Box-Öffnen).
- **Vol/Dur/Pau-Felder im Modal (BA 253):** Lautstärke, Tondauer,
  Tonpause sind jetzt im Tonauswahl-Modal (State: `volume_balance`,
  `duration_balance`, `pause_balance`; Defaults 75 / 750 / 400). Im
  Header sind diese Felder nicht mehr sichtbar.
- **Klavier-Widget im Modal (BA 253):** Tastenzahl = min(leftN, rightN).
  Taste ist disabled (durchgekreuzt, ausgegraut), sobald die Elektrode
  auf **einer der beiden Seiten** abgewählt (`elActive===false`) oder
  ausgeschlossen (`elExDur!=null`) ist — Stumm-Schaltung gilt nicht als
  disabled. Taste **gedrückt halten** → Ton auf aktiver Seite mit deren
  Elektrodenkorrektur (`lrCorrGain`), ohne Stereo-Balance-Offset;
  **Loslassen** → stoppt und spielt die andere Seite in deren Frequenz/
  Korrektur für die Haltedauer (BA 293). `duration_balance`/`pause_balance`
  wirken nur noch im Sequenz-Betrieb. Frequenzen pro Seite werden getrennt
  abgerufen (`lrEffFreq`). Hilfsfunktionen:
  `_lrTpKbdN`, `_lrTpElectrodeFreqs`, `_lrTpElectrodeLabels`,
  `_lrTpDisabledElectrodes`. Modul-State: `_lrTpCorrectVol` (Korrektur-
  Toggle-Callback aus `onTogglesReady`), `_lrTpModalTone` (aktuell
  gewählte Tonart im offenen Modal).
- Reihenfolge der Elektroden und Seitenfolge wandern in
  `header.extra.fragment` als balance-spezifische Voreinstellungen.
- Elektroden-Auswahl (`header.common.electrodeSelection`, BA 207):
  Eine Elektrode ist nur testbar, wenn sie auf beiden Seiten weder
  ausgeschlossen, abgewählt (`elActive===false`, Bugfix 0.4.279.3) noch
  stumm ist. Mindestens eine Elektrode muss gewählt sein.
- **Seitenabfrage vor Test-Start (BA 255):** Beim Klick auf „Test starten"
  erscheint das Seitenabfrage-Modal (`testUI.sideCheck.run({sides:'both'})`).
  Erst nach Bestätigung beider Seiten wird `_lrDoStart` aufgerufen, das die
  Voraussetzungs-Prüfung und den eigentlichen Sequenzaufbau enthält.
- Pause/Resume (BA 245): Der Stop-Knopf heißt „Test pausieren".
  Beim erneuten Start setzt der Test die Sequenz an der gleichen
  Stelle fort. Erst wenn alle Elektroden bestätigt wurden (oder die
  Sequenz komplett abgelaufen ist), startet er bei Position 0.
- Vergleicht gleiche Frequenz auf beiden Ohren
- **Vorbedingungs-Hinweise (BA 245.3, dynamisch je Seite):**
  - `#lrPrereqLvLeftPara`: erscheint wenn `sideData.left.bRes`
    leer ist. Text: `fmPrereqLvLeft`
    (i18n-Key mit freqmatch geteilt).
  - `#lrPrereqLvRightPara`: erscheint wenn `sideData.right.bRes`
    leer ist. Text: `fmPrereqLvRight`.
  Beide Hinweise als `kind: 'warn'` (gelb) oben im Erklär-Block,
  Sichtbarkeit per `display`-Toggle in `_lrRenderPrereqHints()`,
  aufgerufen aus `lrCheckData()`. Helfer `_lrHasLvData(side)` prüft
  `bRes`-Befüllung analog `_fmHasLvData`. Der frühere statische
  Hinweis `lrPrereqHint` ist entfernt (i18n-Key bleibt vorerst
  stehen — Cleanup mit Migrationsplan-Schritt 6).
- **Abschluss-Box (BA 279):** Nach natürlichem Sequenz-Ende (`lrFinish`)
  erscheint eine Abschluss-Box (`testUI.completion.show`) mit Fanfare-Klang
  und Hinweis auf den Ergebnis-Reiter. Bei Stop/Pause (`lrPause`) keine Box.
- **Token-Maschine (BA 290):** Wiedergabe über `testUI.tonePlayer`
  (identisch Elektrodenlautstärke-Test BA 288). Sequenz-Aufbau durch
  `lrSequence()`: liefert Token `{hz, pan, vol, durationMs, side}` und
  Pausen `{pauseMs}` für die laufende Elektrode. Hilfs-Funktion
  `lrPairGains(baseL, baseR, off)` berechnet die Pegel beider Seiten
  symmetrisch (`dB2G(±off/2)`) und kürzt beide proportional, sobald der
  lautere Kanal über 1.0 ginge (Variante A: Gesamtunterschied bleibt
  hörbar). `lrStopPlay` ruft `testUI.tonePlayer.stop()` auf, bevor die
  bisherige `runningSources`-Bereinigung folgt.
- **Deckelungs-Hinweis (BA 290):** Zeigt `clipHint` (Slot in `body`)
  sobald ein Kanal gedeckelt wird: „RECHTS/LINKS hat die maximale
  Lautstärke erreicht — nur LINKS/RECHTS wird noch angepasst."
  Text kommt aus `clipHintCapped` + `sideLeft`/`sideRight`. Wird via
  `lrUpdateClipHint()` in `lrHookOnSlide` bei jeder Schieber-Bewegung
  aktualisiert und beim Rückschieben in den Normalbereich ausgeblendet.

### Sub-Tab 3 — Frequenzabgleich (freqmatch.js)

- **Tonart-Auswahl (BA 209):** Button im Header „Tonart: *Aktualwert*"
  öffnet ein Popup mit Radio-Liste aller 9 Tonarten und einer
  Play-Spalte. Probehör-Sequenz (BA 292): Slider-Modus läuft →
  echte Testsequenz mit aktuellem Schieber-Tonhöhenunterschied
  (`fmSequence({ aba: fmGAba() })`). Adaptiv-Modus oder kein Test
  läuft → gemerkter Klavier-Ton auf var-Seite, Pause, gleicher Ton
  auf ref-Seite (Default 1000 Hz; zurückgesetzt bei jedem Box-Öffnen).
  Der Play-Button spielt
  ausschließlich ab; die Tonart-Auswahl erfolgt über den
  Radio-Button (und wird mit OK übernommen). OK übernimmt,
  Abbruch verwirft. Auswahl persistiert in `toneType_freqmatch`
  (Default `richCiG` — CI-Test Grundton, seit BA 280; zuvor
  `richCiHF`/`pulsedComplex`). Das Dropdown `sliderTarget`
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
  - `#fmPrereqLvLeftPara`: erscheint wenn `sideData.left.bRes`
    leer ist. Text: `fmPrereqLvLeft`.
  - `#fmPrereqLvRightPara`: erscheint wenn `sideData.right.bRes`
    leer ist. Text: `fmPrereqLvRight`.
  - `#fmPrereqSbHintPara`: erscheint wenn `lrResults` leer (keine
    Stereo-Balance-Messung vorhanden). Text: `fmPrereqSb`.
  Die linke/rechte LV-Prüfung läuft seitenunabhängig vom
  Hörtechnik-`config` — auch auf Naturgehör-/Hörgerät-Seiten kann
  eine Ausgleichsmessung sinnvoll sein. Sichtbarkeit per
  `display`-Toggle in `_fmRenderPrereqHints()`, aufgerufen aus
  `fmApplyLang` und `_fmRefreshTabState`. Texte stehen statisch
  in `data-t` der Config (kein dynamisches Umschalten mehr).
  Helfer `_fmHasLvData(side)` prüft `bRes`-Befüllung.
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
    **Abschluss-Box (BA 279):** Nach natürlichem Ende (alle Tracks
    konvergiert/abgeschlossen, `fmFinishAdaptive`) erscheint eine
    Abschluss-Box (`testUI.completion.show`) mit Fanfare-Klang. Bei
    Stop/Abbruch (`fmFinish`) und beim Verfahren „Vor-Schätzung
    (Slider)" keine Box.

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
  Tonhöhen-Wahl [Tief] [Mittel] [Hoch] (Default Tief, gemerkt per
  localStorage), darunter Buttons: [Ton wiederholen] [Links]
  [Rechts] [Beide] [Nichts] [Abbrechen]. Der Prüfton ist seit BA 276
  ein Breitband-Burst (500 / 1500 / 4000 Hz je nach Wahl), als Folge
  von 5 Bursts im 200-ms-Takt abgespielt, ohne Lautstärke-Korrektur.
  Richtige Seite →
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
- Eigener Lautstärke-Regler im Header (`header.common.volume`, Default 75 %);
  multipliziert die Balance-Gains im Audio-Pfad.
- **Nur mit Kabel-Kopfhörer durchführen** — Bluetooth verfälscht die Messung
  (`latBTWarning`, `kind: 'caution'`).
- Vorbedingungs-Hinweis (`latPrereqHint`, `kind: 'warn'`): immer sichtbar.
- Vortest-Empfehlung (`kind: 'warn'`, anfangs hidden):
  - `latVortestBalanceMissing`: eingeblendet wenn noch keine Balance-Werte gemessen.
  - Sichtbarkeit wird bei jedem Öffnen des Sub-Tabs via `testUI.explain.setVisible`
    aktualisiert — kein Showstopper, der Test läuft auch ohne.
  - Seit `3.2.255.3-beta`: kein Loudness-Vortest-Hinweis mehr (`latVortestLoudnessMissing`
    entfernt). Begründung: die Elektrodenlautstärke wird im Latenz-Test-Audio-Pfad
    nicht angewandt (siehe nächster Punkt), ein Vortest-Hinweis wäre damit irreführend.
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
