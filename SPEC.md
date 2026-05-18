# CI Sound Balancing Tool – Funktionsspezifikation

Vollständige Beschreibung des Funktionsumfangs. CLAUDE.md verweist
auf diese Datei und enthält selbst nur den knappen Projektkontext und
Verhaltensregeln für die Zusammenarbeit. Implementations- und
Modulübersicht steht in CODESTRUKTUR.md.

> **Wartung dieser Datei**: bei jeder Funktionsänderung mit
> aktualisieren. Aktualisierung gehört in denselben Arbeitsschritt
> wie die Code-Änderung, nicht nachträglich.

## Eckdaten

- **3 Hersteller**: MED-EL (12 Elektroden), Advanced Bionics (16),
  Cochlear (22)
- **Frequenzwerte** aus bicial (github.com/cito/bicial)
- **4 Sprachen**: DE, EN, FR, ES
- **Korrekturkurven-Berechnung**: Gewichtete Least Squares (sauber
  1.0, verrauscht 0.5, fast stumm 0.1)
- **Bilateral**: separate Datensätze pro Seite (Implantat-
  Konfiguration, Messungen, Levels, Presets, MCL/THR). Side-
  Buttons LINKS/RECHTS oben im UI schalten zwischen den beiden
  Datensätzen um. Jede Seite kann eine eigene Konfiguration haben
  (CI, Hörgerät, Normal, Schwerhörig, Taub). Frequenzraster wird
  von einer CI-Seite auf eine akustische Seite gespiegelt.

## Tab-Übersicht

- **Einführung** (intro) — Begrüßung; unter der Einführungs-Beschreibung steht ein Link „Ausführliche Bedienungsanleitung", der je nach gewählter Oberflächen-Sprache auf README_de.md, README_en.md, README_fr.md oder README_es.md im GitHub-Repo zeigt (öffnet in neuem Tab). Sprachumschaltung aktualisiert sowohl Linktext als auch Ziel-URL.
- **Implantat** (setup) — Konfiguration, Hersteller-/Modell-Auswahl,
  globale Implantat-Parameter, Frequenz- und Elektrodentabelle (siehe
  „Implantat-Tab" unten)
- **Messungen** (messungen) — drei Sub-Tabs (siehe unten)
- **Meßergebnisse** (ergebnisse) — drei Sub-Tabs für
  Elektrodenlautstärke-Balance, Stereo-Balance, Frequenzabgleich
- **Kurven** (levels) — 4-Linien-Chart (Messung / Manuell / Preset /
  Summe) + Preset-Tabelle. Kein manuelles Eingabegitter mehr.
  Manuell-Linie Default aus. DOM-ID historisch `panel-levels` /
  `tabLevels`.
- **Schieber** (schieber) — senkrechte Balken pro Elektrode, manuelle
  dB-Offsets mit Pfeiltasten; Hauptmodul levels-tab.js. DOM-ID
  historisch `panel-schieber` / `tabSchieber`. In der Tab-Leiste
  steht Schieber **nach** Kurven.
- **Player** (player)
- **Laden/Speichern** (file)

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
- Vorkorrektur-Schalter (preCorrect)
- Wenn Modus „Vollständig" angefangen aber nicht abgeschlossen wurde,
  zeigt der Ergebnis-Reiter oben einen Hinweis mit Runde X von Y und
  bestätigten Paaren des aktuellen Sweeps.

### Sub-Tab 2 — Stereo-Balance (lr-balance.js)

- Reihenfolge der Elektroden: zufällig / apikal→basal / basal→apikal
- Seitenfolge: zufällig / L→R / R→L
- Vergleicht gleiche Frequenz auf beiden Ohren
- Vorbedingung „erst Test 1 ausführen" ist nicht zwingend, sondern
  reiner Hinweis

### Sub-Tab 3 — Frequenzabgleich (freqmatch.js)

- Cent-Slider (statt dB)
- Vergleicht CI-Elektroden-Ton vs. variabler Sinus auf der
  Restgehör-Seite
- Referenzseite-Auswahl (LINKS/RECHTS = welche Seite ist Restgehör)
- Bei Wechsel des Referenzohrs nach vorhandenen Ergebnissen:
  Bestätigungsdialog, Verwerfen der bisherigen Ergebnisse
- Ergebnis-Diagramm: X-Achse log-Hz (CI-Frequenz `varFreq`), Y-Achse
  lineare Cent-Abweichung (positiv = subjektiv höher als CI-Frequenz,
  negativ = tiefer). Null-Linie = perfekter Match.

### Sub-Tab 4 — Latenz (latency.js)

- Schieber ±200 ms, Auflösung 1 ms / 0,1 ms (Shift) / 10 ms (Ctrl)
- Schieber ist **nur während laufendem Test** bedienbar (sonst disabled)
- Klick-Intervall manuell wählbar: 100 / 200 / 500 / 1000 / 2000 ms
- 4 Klangvarianten: Klick (breitband), 500 Hz, 1500 Hz, 4 kHz Tone-Bursts
- **Nur mit Kabel-Kopfhörer durchführen** — Bluetooth verfälscht die Messung
  (Hinweis-Box im Messpanel, nach der Überschrift)
- Mess-Panel: Überschrift → kurze Beschreibung → Wichtig-Hinweis (BT) →
  Schieber-Anleitung → Hinweis auf Ortungswahrnehmung als Anhaltspunkt
- Beim **Stop** wird der aktuelle Schieberwert automatisch als `latencyResult`
  übernommen (kein separater „Übernehmen"-Button)
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

## Anzeige-Konvention

Alle drei Ergebnis-Sub-Reiter zeigen *alle* Elektroden. Deaktivierte
oder stumm-geschaltete Elektroden werden im Diagramm als hellgrauer
Balken über die volle Y-Achsen-Höhe mit dunkelgrauem „X" Ecke-zu-Ecke
dargestellt; in Tabellen erscheinen die Wertespalten als „—" und die
Status-Spalte zeigt „deaktiviert/ausgelassen". Aktive, aber noch nicht
gemessene Elektroden bekommen ihren eigenen Marker (siehe Bauanleitung
02 für Stereo-Balance und Frequenzabgleich).

## Implantat-Tab

- **Konfigurations-Dropdown**: ci (Default), hg, normal, schwerhörig,
  taub. Bestimmt, welche Eingabebereiche sichtbar sind.
- **Hersteller-Auswahl**: MED-EL / Advanced Bionics / Cochlear.
  Bestimmt Elektrodenzahl (12/16/22) und Einheit für Upper-Level
  (MCL/qu / M-Level/CU / C-Level/CL).
- **Audio-Prozessor-Modell**: Dropdown, herstellerspezifisch.
- **Implantat-Modell + Generation**: Dropdown. Bei Cochlear bestimmt
  das Modell automatisch die Generation A (alte Stromformel,
  0.176 dB/CL) oder B (Freedom+, 0.157 dB/CL).
- **Globale Implantat-Parameter**: c-Wert (MED-EL), IDR / IIDR
  (Cochlear: IIDR Default 40 dB; AB: IDR Default 60 dB). Werden für
  die Umrechnung dB → Hersteller-Einheit im Druck genutzt.
- **Frequenz- und Elektrodentabelle** (`freq-table.js`), pro Elektrode:
  - Beschriftung mit Elektrodennummer und (bei i=0/i=n−1) apikal/basal
  - Hz Standard (Herstellervorgabe, nicht editierbar)
  - Hz eigen (optionaler abweichender Wert)
  - **THR** (Hörschwelle) in Hersteller-Einheit (qu/CL/CU)
  - **Upper Level**: MCL bei MED-EL (qu), C-Level bei Cochlear (CL),
    M-Level bei AB (CU)
  - Play- und Hold-Buttons (Einzelton anhören)
  - Status-Dropdown: ok, leicht/mittel/stark verrauscht, fast stumm,
    stumm, deaktiviert
  - Ausschluss-Checkbox (deaktivierte Elektroden automatisch
    ausgeschlossen)
  - Notiz-Feld
- Werte stehen in `sideData[side].implant.thr[i]` und `.mcl[i]`
  (MED-EL) bzw. `.upperLevel[i]` (Cochlear/AB).
- Eingaben sind optional. Ohne THR/Upper-Level zeigt der Druck die
  dB-Korrekturen nur als Relativwerte; mit eingetragenen Werten
  werden zusätzlich absolute Audiologen-Empfehlungen (qu/CL/CU)
  berechnet (`calcMedel`, `calcCochlear`, `calcAB` in `core.js`).
- Berechnungsgrundlagen aller drei Hersteller-Umrechnungen siehe
  `Berechnungsgrundlagen dB zu CI.md`.

## Schieber-Tab (sichtbar „Schieber: Manuelle Einzeljustierung von Elektroden", DOM: panel-schieber)

Panel-Überschrift (i18n-Key `lvTabTitle`) lautet
„Schieber: Manuelle Einzeljustierung von Elektroden" (in der Tab-
Leiste oben weiterhin kurz „Schieber").

Bedienleiste oberhalb des Canvas, **dreizeilig**:

- Zeile 1: **Modus** (relativ / absolut) · **Anzeige** (nur Summe /
  gestapelt).
- Zeile 2: **Anzeigen** (Schieber-Legende, Messung, Kurven) — die
  Quellen-Toggles stehen in einer eigenen Zeile.
- Zeile 3: Reset-Button („Manuelle Werte zurücksetzen auf 0") in
  einer eigenen Zeile unterhalb der Anzeigen-Zeile.

### Modus A — relativ (Default)

- Y-Achse ±60 dB (LV_TAB_RANGE), Nullinie in der Mitte
- Diverging stacked bar: Schieber (grün), Messung (blau), Kurven (orange)
  werden getrennt gestapelt — positive Anteile über der Nullinie,
  negative darunter. Schwarzer Quermarker am Nettowert.
- dB-Beschriftung oberhalb: Schieber-Wert groß; darunter Summenwert
  in Klammern, wenn mindestens ein Toggle aktiv.
- Bedienung: ↑/↓ ±0,5 dB (Shift ±0,1 dB), ←/→ wechselt Elektrode.

### Modus B — absolut

- Nur klickbar, wenn mindestens eine aktive Elektrode einen
  MCL/Upper-Level-Wert im Implantat-Tab hat. Sonst ausgegraut.
- Y-Achse 0…Hersteller-Max (MED-EL 300 qu / Cochlear 255 CL /
  AB 600 CU), Nullinie unten.
- Balken zeigt MCL-Niveau nach oben; THR-Zone innerhalb hellrot
  abgegrenzt (falls eingetragen); MCL-Audiologe als gestrichelter
  horizontaler Strich.
  - Variante „nur Summe": der gesamte Balken oberhalb der Null-Linie
    ist einheitlich grün (Schieber-Farbe wie im Relativmodus),
    unabhängig davon, ob er über oder unter dem Audiologen-MCL liegt.
  - Variante „gestapelt": grauer Basis-Block bis Audiologen-MCL. Von
    der Audi-MCL-Linie ausgehend werden die drei Quellen analog zum
    Relativmodus farbig gestapelt — Schieber (grün), Messung (blau),
    Kurven (orange). Positive dB-Anteile gehen nach oben, negative
    nach unten. Die Umrechnung dB → Hersteller-Einheit erfolgt
    kumulativ (sonst stimmt die Segmenthöhe bei MED-EL nicht, weil
    die Skala dort logarithmisch ist).
  - **Schwarzer Quermarker am Nettowert** (Summe aller Quellen, =
    `mclNew`) wird in **beiden** Absolutmodus-Varianten gezeichnet,
    einheitlich mit dem entsprechenden Summen-Quermarker im
    Relativmodus. Im Gestapelt-Modus ist er fachlich notwendig
    (Summenwert wird sonst nicht ersichtlich, wenn positive und
    negative Anteile gegenläufig stapeln), im „nur Summe"-Modus
    fällt er mit der Balken-Oberkante zusammen und sorgt damit
    visuell für eine einheitliche Markierung über alle vier
    Modus×Variante-Kombinationen.
- Spalten ohne MCL: gestrichelte Outline, „—" in der Mitte.
  Im Absolutmodus sind solche Elektroden **nicht** anwählbar — Klick
  und Pfeiltasten links/rechts überspringen sie, weil der Schieber
  ohne MCL keine sinnvolle Hersteller-Einheit hätte.
- Beschriftung oben am Balken: groß = neuer MCL-Wert in qu/CL/CU;
  klein = dB-Delta darunter.
- Bedienung: ↑/↓ ändert qu/CL/CU um ±1 (Shift ±5); Speicherung
  immer in dB **mit voller Float-Präzision** (keine Rundung auf 0.1
  dB) — sonst würden bei hohem MCL einzelne qu-Schritte durch
  Rundungsverlust geschluckt (Beispiel: bei MCL 200 qu MED-EL ist
  +1 qu ≈ 0.022 dB; gerundet auf 0.1 dB landet der Schritt auf 0.0
  und der Schieber bewegt sich nicht). Im Relativmodus bleibt die
  Rundung auf 0.1 dB.
- Schieber-Grenzen: 0 bis Hersteller-Max (qu / CL / CU). Die ±60 dB-
  Klammer aus Modus A gilt im Absolutmodus nicht. Für MED-EL bleibt
  der Mindestwert leicht über 0 (1 qu), weil `dbFromMedel` an 0
  undefiniert ist.
- THR-Anzeige: Wenn der Schieberwert unter den eingetragenen THR
  fällt, wird die rote THR-Zone auf den Bereich zwischen THR-Linie
  und Schieber verkleinert, damit der Balken sichtbar bleibt. Die
  THR-Linie und der eingetragene THR-Wert bleiben dabei unverändert.
- Bei Side-Wechsel ohne MCL auf neuer Seite: automatischer Fallback
  auf Modus A.

### Anzeige-Varianten (in beiden Modi)

- **gestapelt** (Default): Diverging Stacked Bar mit drei Quellen.
- **nur Summe**: ein einziger Balken mit dem Nettowert.
- **Vergleichslinien**: Summenbalken + gestrichelte Farblinien je Quelle
  quer durch alle aktiven Elektroden. **Im aktuellen Build ausgeblendet**
  (Radio per `display:none` versteckt); Zeichen-Code und Persistenz
  bleiben erhalten, um die Variante später ohne Codeänderung
  reaktivieren zu können.

Die vom Nutzer gewählte Variante bleibt beim Modus-Wechsel relativ ↔
absolut **erhalten** und wird auch beim MCL-Fallback (Side ohne MCL,
das System schaltet auf relativ zurück) nicht überschrieben. Default
beim App-Start ist „gestapelt".

### Weitere Punkte

- Zwei Quell-Toggles (Messung / Kurven) schalten nur die Anzeige in
  diesem Tab, nicht den Player. Default beide aus.
- Deaktivierte / mute Elektroden: hellgrauer Balken volle Höhe, X-
  Diagonale, Pfeiltasten-Navigation überspringt sie.
- Fokus per Klick auf Balken setzbar (←/→ wechselt Elektrode).
- Fokus-Umrahmung: Die schwarze Umrahmung um die aktive Elektrode
  (relativer und absoluter Modus) wird **nur** gezeichnet, wenn das
  Canvas tatsächlich Tastatur-Fokus hat. Beim Klick aufs Canvas
  oder per Tab-Taste fokussiert das Canvas, beim Klick auf andere
  Bedienelemente verliert es den Fokus und die Umrahmung verschwindet.
  Die Pfeiltasten-Navigation reagiert nur, solange das Canvas
  fokussiert ist.
- Reset-Button („Manuelle Werte zurücksetzen auf 0"): alle manuellen
  Werte der aktiven Seite auf 0.
- Änderungen aktualisieren den Kurven-Tab-Chart und den Player-EQ live.
- `lvTabMode` und `lvTabVariant` werden in JSON und localStorage
  persistiert; beim Laden wird MCL-Verfügbarkeit geprüft und ggf.
  auf Modus A zurückgefallen.

## Kurven-Tab (sichtbar „Kurven", DOM: panel-levels)

Drei Cards untereinander:

1. **Intro-Box** (oberste Card, i18n-Keys `lvIntroTitle` / `lvIntroDesc`):
   Überschrift „Kurven", Erklärtext: „Anpassung der Elektroden-
   lautstärke über alle Elektroden hinweg. Wählen Sie aus angebotenen
   Kurvenfunktionen und passen Sie die Werte live an."
2. **Übersicht** (`lvChartTitle`): 4-Linien-Chart mit Messung (blau),
   Manuell (grün), Preset (orange), Summe (schwarz). Checkboxen zur
   Auswahl. Manuell-Linie Default aus.
3. **Kurvenfunktionen** (`lvPresetTitle` — früher „Presets"):
   Tabelle aller Kurvenfunktionen mit Stärke und Detail-Parametern.

- 8 Kurvenfunktionen gleichzeitig aktivierbar: Sprache (SII),
  **Lautstärke**, Tilt, S-Kurve, Pivot, Gauß, Bass Boost, High Boost.
  Reihenfolge in der Tabelle = Reihenfolge in `PR_TYPES`.
- Jede Kurvenfunktion: Checkbox an/aus, Stärke (±20 dB), Mittelpunkt
  (wo sinnvoll), Breite (Gauß), Grenzpunkt (Bass/High Boost).
- **Lautstärke**: gleichmäßiger dB-Offset auf allen aktiven
  Elektroden. Hat **nur** das Stärke-Feld (keine Mitte, keine Breite,
  kein Grenzpunkt). Wirkt wie eine zusätzliche Gesamtlautstärke
  unabhängig vom Player-Gain.
- Kurvenfunktionen und manuelle Schieber-Werte sind unabhängig, werden
  addiert.
- SII-Gewichte per log-linearer Interpolation des ANSI S3.5 auf
  Herstellerfrequenzen.

## Player

- Aufbau des Tabs in fünf Karten, in dieser Reihenfolge:
  1. **Einleitung** — reine Textbox mit Titel „Audioplayer mit Korrektur-
     Equalizer" und Beschreibung (`plTitle`, `plDesc`). Kein blauer
     Hinweis-Strich, nur normaler Absatz.
  2. **Equalizer-Graph** (`plEqViz`) — Kurven-Canvas plus Tabelle.
  3. **Einstellungen** (`plSettingsTitle`) — Equalizer an/aus, Stärke,
     Quellen-Buttons (Gemessen / Kurven / Schieber), Beide Seiten,
     Mono-EQ, Normalhörenden-Simulation, „Stereo-Balance anwenden",
     NH-Hinweisbox (`plNHInfo`).
  4. **Audiodatei** (`plFileTitle`) — Datei-Picker, Transport-Controls
     (Play/Stop, Zeitleiste, Lautstärke).
  5. **Frequenz-Warping** (`pwTitle`) — Aktivierung, Verfahren, Modus,
     Stärke, Status- und Hinweisbereich.
- Audiodatei laden, Mono-Downmix, parametrischer 12/16/22-Band-
  Equalizer
- Drei unabhängige Quellen-Toggles: **Gemessen · Kurven · Schieber**
  (in dieser Reihenfolge in der Button-Leiste; alle Default an).
  Addieren sich unabhängig im Player-EQ. „Kurven" = nur Preset-Anteil;
  „Schieber" = nur manuelle Schieber-Werte. (Der DOM-/i18n-Key heißt
  weiterhin `plSrcLevels` aus historischen Gründen.)
- Equalizer an/aus, Stärke 0–150%, Buttons für 50/75/100/150%
- **Side-Modi** (durch Checkboxen „Beide Seiten" und „Mono-EQ"
  in den Einstellungen, geliefert von `getPlayerSide()`):
  - „Beide Seiten" aus → nur die aktive Seite hörbar, Gegenkanal
    stumm (Modus `"left"` oder `"right"`).
  - „Beide Seiten" an, „Mono-EQ" aus → Stereo mit getrennten EQ-
    Ketten pro Kanal (`pEqFLeft` / `pEqFRight`), gespeist über
    `pChannelSplitter` und `pChannelMerger` (Modus `"both"`).
  - „Beide Seiten" an, „Mono-EQ" an → beide Kanäle hörbar, aber
    mit identischem EQ (Durchschnitt der zwei Seiten-Korrekturen,
    Modus `"mono"`).
  - „Stereo-Balance anwenden" (`plApplyBalance`): zusätzlicher
    L↔R-Gesamtoffset aus dem Mittelwert der gemessenen
    `lrResults` (Stereo-Balance-Test).
- Normalhörenden-Simulation (nicht-invertierter Equalizer)
- MAPLAW-Simulation (MED-EL): bandweise Hüllkurven-Vorverzerrung
  Ist⁻¹∘Soll als AudioWorklet im Tool. Eigene Card oberhalb der
  Frequenz-Warping-Card. Ist-c kommt aus `implant.cValue` der
  aktiven Seite (read-only), Soll-c per Quick-Buttons
  (100/250/500/1000/1500/2000/3000/4000/6000/8000) oder Zahleneingabe (0–8000).
  Master-Toggle „MAPLAW Simulation aktivieren" (Toggle-Button, grün
  wenn aktiv). EQ-Toggle wirkt als Master-Bypass auch für MAPLAW.
  Audio-Pfad-Position: nach Tool-EQ und vor pGain. Bei Soll-c == Ist-c
  oder Card aus: Passthrough. Bei aktiver Seite Cochlear oder AB:
  Card ausgegraut mit Hinweis. Konzeptioneller Hintergrund:
  `.docs/MAPLAW_Konzept.md`.
- Experimentell-Toggle im Player: Checkbox „Experimentelle Optionen
  einblenden" oberhalb der MAPLAW- und Frequenz-Warping-Cards.
  **Default aus** — beide Cards sind initial verborgen. Wird der
  Toggle aktiviert, erscheinen die zwei Cards plus ein Hinweistext,
  daß diese Optionen klangliche Schwächen haben und nur eine grobe
  Richtungsangabe liefern. Persistiert in JSON und localStorage
  (`playerShowExperimental`). **Solange MAPLAW Simulation oder
  Frequenz-Warping aktiv ist, ist die Checkbox deaktiviert** (Ausblenden
  nicht möglich).
- EasyEffects-Export für PipeWire (korrektes JSON-Format)
- Equalizer-Controls immer sichtbar (nicht nur bei geladener Datei)
- Änderungen im Schieber-Tab aktualisieren den Player-Equalizer live
- Frequenz-Warping mit vier Verfahren (freq-warp.js):
  - **Offline-Vorberechnung** (Variante C): rendert gewarpten Buffer vor
    dem Play; Recalc-Button bei Änderung von Modus/Stärke/fRes nötig
  - **Bandweise Pitch-Shift** (Variante B): Live-Audio-Graph, N Subbänder
    × 2 Kanäle; wirkt sofort beim nächsten Play, keine Vorberechnung
  - **Phasen-Vocoder** (Variante A): AudioWorklet mit FFT/IFFT und
    Identity Phase Locking (Laroche/Dolson) — Spektrum-Peaks tragen ihre
    Phase eigenständig fort, Non-Peak-Bins werden phasen-gelockt zum
    jeweils nächsten Peak. Reduziert die typischen Phasen-Vocoder-Artefakte
    (roboterhafter Klang, tremoloartiges Vibrieren). Ca. 46 ms Latenz;
    Worklet-Code liegt inline als String in freq-warp.js und wird per
    Blob-URL geladen — funktioniert daher auch unter `file://`
  - **Sinusoidal Modeling** (Variante D): STFT-basiert wie der Phasen-Vocoder.
    Peaks werden mit Quadratic Peak Interpolation sub-bin-genau lokalisiert
    und über Frames getrackt (kontinuierliche Phase pro Oszillator). Residual-
    Spektrum (nicht-tonale Anteile) bleibt unverschoben → Konsonanten und
    Rauschen klingen natürlicher als beim Phasen-Vocoder. Pitch-Shift mit
    Spectral Spread auf zwei benachbarte Bins. Defaults: Phasen-Vocoder bleibt
    Default; Sinusoidal Modeling wahlweise im Dropdown.
  - Korrektur-Modus: ref_side / var_side / symmetric
  - Defaults: Verfahren = Sinusoidal Modeling, Korrektur-Modus = variable Seite
    (gespeicherte JSON-Werte gewinnen weiter beim Laden)
  - Korrektur-Modus und Stärke sind immer sichtbar (nicht mehr von Checkbox abhängig)
  - Stärke 0–150%; Recalc-Button nur bei Offline-Verfahren sichtbar
  - Untertitel-Zeile unter dem Box-Titel: „Experimentelle Option, Qualität noch mäßig: Audio gemäß Frequenzmessung umwandeln" (i18n-Key pwSubtitle)
  - Status-Anzeige zeigt aktives Verfahren und Stützpunkt-Anzahl
  - pWarpMethod wird in JSON gespeichert und wiederhergestellt
  - Druck-Export enthält aktives Verfahren wenn Warp aktiv
  - Offline-Verfahren beachtet die gewählte Player-Seite: bei LINKS/RECHTS
    ist nur diese Seite hörbar (Gegenkanal stumm); bei „Beide Seiten" ist
    auf der vom Korrektur-Modus nicht betroffenen Seite das Original zu
    hören (klanglich unverändert, kein Bandpass-Artefakt)
  - Vocoder-Graph beachtet ebenfalls die Player-Seite und mischt bei
    „Beide Seiten" + einseitigem Korrektur-Modus die nicht betroffene
    Seite aus einer zweiten Original-BufferSource ein, die per DelayNode
    um die Vocoder-Latenz (ein FFT-Fenster) verzögert wird, damit L/R
    synchron bleiben
  - Warp-Toggle und Methoden-Wechsel wirken auch während laufender Wiedergabe:
    Pfadwechsel erfolgt an aktueller Position mit kurzer Unterbrechung
    (Offline regelt das in `pWarpTrigger`; Vocoder/Bandshift im Toggle-Handler
    in init.js). Worklet des Vocoders wird beim Auswählen der Methode vorab
    geladen, damit der spätere Pfadwechsel ohne erkennbare Verzögerung wirkt.
  - Live-Änderung von Stärke und Korrektur-Modus während Wiedergabe:
    - Offline → Neuberechnung via `pWarpTrigger` (längere Pause)
    - Vocoder → knackfreier `postMessage` an den laufenden Worklet
      (`pWarpLiveUpdate`), sofort wirksam
    - Bandshift → Graph-Rebuild via pause/resume (kurzer hörbarer Knack)
  - Aktivierung über Toggle-Button „Frequenz-Warping" (grün wenn aktiv).
  - EQ-Toggle wirkt als Master-Bypass auch für das Frequenz-Warping: wenn
    EQ aus, sind sowohl Filter als auch Warp deaktiviert. Der Warp-Toggle-
    Zustand bleibt als „Memory" erhalten und greift wieder, sobald EQ
    wieder eingeschaltet wird. Bei Toggle während Wiedergabe erfolgt der
    nötige Pfadwechsel an aktueller Position.
  - Stop-Button greift auch in Zwischenzuständen, in denen `pPlaying` kurz
    `false` ist, aber Audio-Sources aktiv sind (Race im async Vocoder-pPlay).

- Sätze-Wiedergabe im Player: Card „Sätze abspielen" unterhalb der
  Audiodatei-Card. Wiedergabe vorgesprochener Sätze durch denselben
  Audiograph wie Musikdateien (EQ, MAPLAW, Korrektur, Lautstärke wirken).
  Sprecher-Auswahl folgt der globalen Tool-Sprache und bietet immer
  Option „Alle (zufällig)" plus einzelne Sprecher der jeweiligen Sprache:
  - **Thorsten** (Deutsch, Studioqualität, 50 kuratierte Sätze;
    Quelle: Thorsten-Voice, CC0)
  - **Common Voice** (Pool aus 100 verschiedenen Sprechern pro
    Sprache; Quelle: Mozilla Common Voice 17.0, CC0)
  Bedienung über drei Buttons: **Spielen** (aktueller Satz einmal,
  beim ersten Klick zufällig gewählt) — **Nächster Satz** (anderer
  zufälliger Satz, einmal) — **Endlosfolge** (zufällige Folge,
  maximal 100 Sätze; danach automatischer Stop, Button-Klick startet
  neue 100er-Folge). Stop hält alles an. Sprecher-Auswahl folgt globaler
  Tool-Sprache. Optionaler Text-Einblender. Pause-Buttons
  (500 / 750 / 1000 / 2000 / 4000 / 8000 ms, Default 2000 ms —
  Wartezeit zwischen Sätzen bei Endlosfolge).
  Sätze und Audiodatei haben getrennte Buffer und sind unabhängig
  voneinander steuerbar. Sätze-Start pausiert eine laufende
  Datei-Wiedergabe; Klick auf den Datei-Play-Button während laufender
  Sätze stoppt diese und startet die Datei (ein Klick, vorher zwei).
  Sätze-Stop und Sätze-Ende setzen den Player zurück in den Datei-
  Modus, ohne die Datei-Auswahl zu verlieren. Datei-Upload und
  Seite-Wechsel stoppen Sätze ebenfalls. Sprachwechsel aktualisiert
  Sprecher-Dropdown sofort. Schema: `assets/sentences/sentences.json`
  ist sprecher-zentriert, `speakers.<key>.recordings[]` mit Text +
  Audio-Pfad. Siehe README.

  **Offline-Modus**: Wenn `fetch("assets/sentences/sentences.json")`
  fehlschlägt (z.B. weil das Tool als `file://` aus einem ZIP geöffnet
  wurde), schaltet die Sätze-Wiedergabe automatisch in den Embed-Modus.
  Pro Sprache wird `assets/sentences/embed/<lang>.js` per `<script>`-Tag
  on-demand geladen — Audio liegt dort als `data:`-URL. Im Embed sind
  ~5 Sätze pro Sprache verfügbar (de: Thorsten; en/fr/es: Common Voice).
  Spätere Sprachen, für die kein Embed existiert, sind offline nicht
  verfügbar (Block zeigt „keine Sätze verfügbar").

  **Lokale Audio-Ordner:** Der User kann über „+ Lokalen Ordner laden"
  in der Sätze-Card lokale Ordner mit Audiodateien hinzufügen. Erkennung:
  - Freiburger Sprachtest (Pfad-Pattern Einsilbig|Mehrsilbig/Testliste_NN/
    L<NN>_W<NN>_<text>.wav) → zwei Sprecher (Einsilbig, Mehrsilbig),
    Text aus Dateiname.
  - Oldenburger Satztest (Dateiname *_OLSA[female|male]_TTS.wav) → ein
    Sprecher mit Label-Variante (female/male/generisch), Text aus
    zugehöriger sentences_OLSA*.txt im Format `<datei.wav> : <text>`.
  - Generisch: alle Audiodateien des Ordners als ein Sprecher in der
    aktuellen Tool-Sprache; Manifest-Texte werden gelesen, wenn eine
    .txt/.csv/.tsv ≥ 80 % der Audio-Dateien zuordnet (Separator
    : , ; | Tab; Leerzeichen im Dateinamen werden beim Doppelpunkt-
    Separator unterstützt: `datei mit leerzeichen.wav: Text`).
  Audio wird lazy geladen (erst beim Abspielen, nicht beim Scan).
  Entfernen über „×" neben dem Listeneintrag. Sprache der Sammlung
  bestimmt, ob sie im Sprecher-Dropdown der aktuellen Tool-Sprache
  erscheint.

  **Persistenz:** Lokale Sammlungen werden mit ihren Metadaten in JSON
  gespeichert. Audio-Daten selbst nicht. Beim Reload mit JSON-Restore:
  - In Chromium/Edge (File System Access API verfügbar) nutzt der Picker
    `showDirectoryPicker()`; der zurückgelieferte Handle wird in IndexedDB
    persistiert (DB „ciSoundBalancing", Store „folderHandles"). Nach
    JSON-Restore fragt der Browser nach Re-Permission für den
    ursprünglichen Ordner (ein Dialog); nach Bestätigung ist die Sammlung
    sofort wieder verfügbar. Künftige Re-Auswahlen öffnen an der
    gespeicherten Stelle (`startIn`-Hint).
  - In Firefox erscheint die Sammlung als „(nicht geladen)" im
    Sprecher-Dropdown und in der Liste. Auswahl im Dropdown öffnet
    einen Hinweis mit Ordnernamen und den webkitdirectory-Picker.
  „×" entfernt die Sammlung dauerhaft (auch den IndexedDB-Handle,
  sofern keine andere Sammlung ihn referenziert).

## Speichern und Laden

- JSON mit allen Einstellungen, Meßergebnissen, manuellen Levels,
  Presets, globalen Test-Einstellungen, **Implantat-Daten (Modell,
  Prozessor, MCL, THR, Upper-Level, cValue/IDR/iIDR/Generation),
  manuellen Frequenzen (`electrodeFreqOwn`) und Sweep-Resume-Stand**
- Autosave in localStorage alle 5 Sekunden — speichert dasselbe pro-
  Seite-Datenset wie JSON (insbesondere `implant`, sodaß MCL/THR
  und alle weiteren Implantat-Daten einen Reload überstehen), plus
  Levels-Tab-Anzeigestate und Player-Quellen-Toggles.
- `showSaveFilePicker` mit Fallback auf Download

## Drucken

- Meßergebnisse immer enthalten
- Player-Einstellungen (Quelle, Stärke, NH-Simulation) zusätzlich
- Levels-Werte und Equalizer-Gains im Ausdruck
- Einzelne Tabs erhalten je einen eigenen Druck-Knopf, der nur
  den Inhalt dieses Tabs (bzw. aktiven Sub-Tabs) für die aktuell
  aktive Seite druckt. Jeder Einzeldruck trägt einen Mini-Kopf
  mit App-Name, Tab-Titel, Datum, Seite und Implantat-
  Identifikation. Der bestehende „Alles drucken"-Button in
  Laden/Speichern bleibt unverändert und druckt weiterhin beide
  Seiten mit allen Sektionen.
  - **Implantat-Tab** (`#printImplantBtn`): implementiert.
  - **Meßergebnisse-Sub-Tabs** (`#printErgebnisseBtn` in der
    Sub-Tab-Leiste rechts): implementiert. Dispatcher
    `printErgebnisseTab()` erkennt den aktiven Sub-Tab und ruft
    `_printResLoudness`, `_printResLR` oder `_printResFreqmatch`
    auf. Diagramme werden als PNG-Bild eingebettet (Canvas→img),
    Buttons entfernt, Inputs/Selects als Text-Spans dargestellt
    (Checkbox/Radio → „✓"/„—", Select → sichtbarer Optionstext).
  - **Kurven-Tab** (`#printKurvenBtn` rechts neben Chart-Titel):
    implementiert. Druckt Chart-Card (4-Linien-Chart als PNG)
    und Kurvenfunktionen-Tabelle. Die Tabelle wird datengetrieben
    aus `presets` gebaut (`_buildPresetCardPrint`): nur aktive
    Kurven erscheinen, Stärke/Mitte/Breite/Cutoff als Text.
  - **Schieber-Tab** (`#printSchieberBtn` rechts neben Tab-Titel):
    implementiert. Druckt Info-Zeile (Modus + Variante), Canvas-Bild
    des Schiebers als PNG und eine Werte-Tabelle pro Elektrode.
    Im Relativmodus: Spalten „Nr." und „dB-Wert". Im Absolutmodus:
    zusätzlich eine Hersteller-Einheit-Spalte (MCL qu / CL / CU)
    berechnet über `calcMedel`/`calcCochlear`/`calcAB`; Elektroden
    ohne eingetragenen Upper-Level zeigen „—".

## Offene Punkte (Warteliste, nicht im aktuellen Build)

Hinweis: regelmäßig prüfen, ob Punkte erledigt oder hinfällig sind.

- Bilaterale CIs — Grundgerüst ist gebaut (Side-Buttons,
  separate Datensätze pro Seite inkl. Implantat/MCL/THR, Stereo-
  Player mit getrennten EQ-Ketten, Inter-Ohr-Offset aus
  `lrResults`). **Offen** sind noch: (a) sichtbare Anzeige des
  berechneten Inter-Ohr-Offsets im Ergebnis-Reiter oder Player;
  (b) Synchron-Anwendung von manuellen Levels oder Presets auf
  beide Seiten gleichzeitig (heute nur pro aktiver Seite);
  (c) Asymmetrie-Option im Stereo-Balance-Test (z.B. „nur
  Restgehör-Seite justieren").
- Cochlear/AB MAPLAW-Äquivalente
- Hinweis im Ausdruck: Audiologe muß Klienten über
  MCL/Frequenz-Änderungen informieren
- Confidence-Auswahl in Tests auswerten und persistieren
  (UI ist vorbereitet, Funktion fehlt)
