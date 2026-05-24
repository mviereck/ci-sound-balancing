## Kurven-Tab (sichtbar „Kurven", DOM: panel-levels)

Drei Cards untereinander:

1. **Intro-Box** (oberste Card, i18n-Keys `lvIntroTitle` / `lvIntroDesc`):
   Überschrift „Kurven", Erklärtext: „Anpassung der Elektroden-
   lautstärke über alle Elektroden hinweg. Wählen Sie aus angebotenen
   Kurvenfunktionen und passen Sie die Werte live an."
2. **Übersicht** (`lvChartTitle`): 4-Linien-Chart mit Messung (blau),
   Manuell (grün), Preset (orange), Summe (schwarz). Checkboxen zur
   Auswahl. Manuell-Linie Default aus. Auf Mobile (≤ 768 px) ist die
   Chart-Card sticky (`position: sticky; top: 0`), damit der Graph beim
   Bedienen der Preset-Tabelle sichtbar bleibt; auf Desktop scrollt sie
   als normale Karte mit. Auf Mobile wird die Canvas-Höhe von 400 px auf
   200 px reduziert.
3. **Kurvenfunktionen** (`lvPresetTitle` — früher „Presets"):
   Tabelle aller Kurvenfunktionen mit Stärke und Detail-Parametern.

- 8 Kurvenfunktionen gleichzeitig aktivierbar: Sprache (SII),
  **Lautstärke**, Tilt, S-Kurve, Pivot, Gauß, Bass Boost, High Boost.
  Reihenfolge in der Tabelle = Reihenfolge in `PR_TYPES`.
- Jede Kurvenfunktion: Checkbox an/aus, Stärke (±20 dB) mit Touch-
  Bedienleiste − / Fein / + neben dem Eingabefeld (auch auf Desktop
  sichtbar), Mittelpunkt (wo sinnvoll), Breite (Gauß), Grenzpunkt
  (Bass/High Boost).
- **Pivot, Tilt, S-Kurve, Gauß** rechnen in **log(Hz)** (äquivalent zu
  Cent, Referenz 1000 Hz = 0 ¢, eine Oktave = 1200 ¢).
  - **Mittelpunkt** wird als **Hz-Wert** gespeichert (Number-Input,
    50–20000 Hz, Default 1000 Hz). Anzeige-Einheit: `Hz`.
  - **Gauß-Breite** wird als **Cent-Wert** gespeichert (Number-Input,
    50–4800 ¢, Default 1200 ¢ = 1 Oktave). Anzeige-Einheit: `¢`.
  - Die x-Achse des Charts ist **cent-skaliert** (lineare Cent-Achse re
    1000 Hz). Elektroden sitzen an ihrer Cent-Position; Abstände
    entsprechen den Cent-Differenzen, nicht dem Index. Tiefe Elektroden
    (große Cent-Sprünge) stehen weiter auseinander, hohe enger zusammen.
    Pivot/Tilt/S-Kurve/Gauß erscheinen damit unverzerrt.
  - **x-Achsen-Beschriftung** pro Elektrode dreizeilig: E-Bezeichnung,
    Hz-Wert (klein), Cent-Wert (`+N ¢` / `−N ¢` re 1000 Hz). Bei engen
    Pixel-Abständen (< 22 px / < 14 px) wird die Cent-Zeile ausgedünnt
    (jedes 2. bzw. 3. Label); die E-Bezeichnung bleibt vollständig.
  - **Hover-Tooltip** über der x-Achsen-Beschriftung zeigt
    „Elektrode N / Hz / ¢" dreizeilig. Gleiches Verhalten im
    Meßergebnisse-Chart.
- **Bass Boost / High Boost**: Grenzpunkt bleibt eine Kanal-Anzahl
  (Dropdown, unverändert).
- **Sprache (SII)** und **Lautstärke** unverändert.
- **Lautstärke**: gleichmäßiger dB-Offset auf allen aktiven
  Elektroden. Hat **nur** das Stärke-Feld (keine Mitte, keine Breite,
  kein Grenzpunkt). Wirkt wie eine zusätzliche Gesamtlautstärke
  unabhängig vom Player-Gain.
- Kurvenfunktionen und manuelle Schieber-Werte sind unabhängig, werden
  addiert.
- SII-Gewichte per log-linearer Interpolation des ANSI S3.5 auf
  Herstellerfrequenzen.
- **JSON-Format**: `presetFormat: "freq-v3"` kennzeichnet Hz/Cent-Werte.
  Beim Laden alter Dateien (ohne dieses Feld) werden `center`
  (Elektroden-Index → Hz per log-Interpolation) und `width`
  (Kanal-Anzahl → Cent) automatisch migriert; einmalige Popup-Warnung.
