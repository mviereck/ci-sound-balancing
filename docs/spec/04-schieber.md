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
- Touch-Bedienleiste unter dem Canvas: Elektroden-Pfeile ◀/▶ und
  Wert-Pfeile ▼/▲ plus Fein-Toggle. Long-Press = Auto-Repeat. Ersatz
  für Pfeiltasten auf Geräten ohne Tastatur.

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
