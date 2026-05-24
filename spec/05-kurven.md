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
- **Lautstärke**: gleichmäßiger dB-Offset auf allen aktiven
  Elektroden. Hat **nur** das Stärke-Feld (keine Mitte, keine Breite,
  kein Grenzpunkt). Wirkt wie eine zusätzliche Gesamtlautstärke
  unabhängig vom Player-Gain.
- Kurvenfunktionen und manuelle Schieber-Werte sind unabhängig, werden
  addiert.
- SII-Gewichte per log-linearer Interpolation des ANSI S3.5 auf
  Herstellerfrequenzen.
