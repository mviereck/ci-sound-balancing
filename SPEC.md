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

## Tab-Übersicht

- **Einführung** (intro)
- **Implantat** (setup) — Konfiguration, Hersteller-/Modell-Auswahl,
  globale Implantat-Parameter, Frequenz- und Elektrodentabelle (siehe
  „Implantat-Tab" unten)
- **Messungen** (messungen) — drei Sub-Tabs (siehe unten)
- **Meßergebnisse** (ergebnisse) — drei Sub-Tabs für
  Elektrodenlautstärke-Balance, Stereo-Balance, Frequenzabgleich
- **Levels** (levels)
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

## Levels-Tab

- Manuelle dB-Offsets pro Elektrode (Balkenanzeige + Zahlenfeld +
  Pfeiltasten)
- 7 Presets gleichzeitig aktivierbar: Sprache (SII), Tilt, S-Kurve,
  Pivot, Gauß, Bass Boost, High Boost
- Jedes Preset: Checkbox an/aus, Stärke (±20 dB), Mittelpunkt (wo
  sinnvoll), Breite (Gauß), Grenzpunkt (Bass/High Boost)
- Presets und manuelle Werte sind unabhängig, werden addiert
- Chart unten: drei Linien (Messung blau, Manuell grün, Preset orange)
  + Summenlinie schwarz, Checkboxen zur Auswahl
- SII-Gewichte per log-linearer Interpolation des ANSI S3.5 auf
  Herstellerfrequenzen

## Player

- Audiodatei laden, Mono-Downmix, parametrischer 12/16/22-Band-
  Equalizer
- Equalizer-Quelle: Gemessen / Levels / Beide (Default: Beide)
- Equalizer an/aus, Stärke 0–150%, Buttons für 50/75/100/150%
- Normalhörenden-Simulation (nicht-invertierter Equalizer)
- MAPLAW-Simulation ausgeblendet (Code vorhanden, UI versteckt)
- EasyEffects-Export für PipeWire (korrektes JSON-Format)
- Equalizer-Controls immer sichtbar (nicht nur bei geladener Datei)
- Änderungen in Levels aktualisieren den Player-Equalizer live
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
  - EQ-Toggle wirkt als Master-Bypass auch für das Frequenz-Warping: wenn
    EQ aus, sind sowohl Filter als auch Warp deaktiviert. Der Warp-Checkbox-
    Zustand bleibt als „Memory" erhalten und greift wieder, sobald EQ
    wieder eingeschaltet wird. Bei Toggle während Wiedergabe erfolgt der
    nötige Pfadwechsel an aktueller Position.
  - Stop-Button greift auch in Zwischenzuständen, in denen `pPlaying` kurz
    `false` ist, aber Audio-Sources aktiv sind (Race im async Vocoder-pPlay).

## Speichern und Laden

- JSON mit allen Einstellungen, Meßergebnissen, manuellen Levels,
  Presets, globalen Test-Einstellungen
- Autosave in localStorage alle 5 Sekunden
- `showSaveFilePicker` mit Fallback auf Download

## Drucken

- Meßergebnisse immer enthalten
- Player-Einstellungen (Quelle, Stärke, NH-Simulation) zusätzlich
- Levels-Werte und Equalizer-Gains im Ausdruck

## Offene Punkte (Warteliste, nicht im aktuellen Build)

Hinweis: regelmäßig prüfen, ob Punkte erledigt oder hinfällig sind.

- MAPLAW-Simulation (korrekt: bandweise Hüllkurvenverarbeitung,
  zwei c-Werte Ist/Soll) — benötigt MCL-Feature
- Bilaterale CIs: globaler Schalter Links/Rechts, separate
  Datensätze, Stereo-Player, Inter-Ohr-Vergleich mit Gesamtoffset,
  Levels wahlweise auf beide Seiten gleichzeitig
- Cochlear/AB MAPLAW-Äquivalente
- Hinweis im Ausdruck: Audiologe muß Klienten über
  MCL/Frequenz-Änderungen informieren
- Confidence-Auswahl in Tests auswerten und persistieren
  (UI ist vorbereitet, Funktion fehlt)
