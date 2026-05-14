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
- **Implantat** (setup) — Hersteller-/Modell-Auswahl, Frequenztabelle
- **Messungen** (messungen) — drei Sub-Tabs (siehe unten)
- **Meßergebnisse** (ergebnisse) — drei Sub-Tabs für Lautstärke,
  Stereo-Balance, Frequenzabgleich
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
- Referenzelektroden-Auswahl
- Vorkorrektur-Schalter (preCorrect)

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
- Optionales Offline-Frequenz-Warping (freq-warp.js)

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

- MCL-Eingabefelder pro Elektrode + c-Wert im Frequenzen-Tab,
  dB→qu Umrechnung, Ausdruck mit qu für Audiologen
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
