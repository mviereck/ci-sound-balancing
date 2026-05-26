## Frequenzabgleich — Adaptiver Modus (2I-2AFC)

Ergänzung zum bestehenden Sub-Tab Frequenzabgleich (`02-messung.md`,
Abschnitt „Sub-Tab 3"). Beschreibt einen zweiten Mess-Modus neben dem
heutigen Slider-Verfahren. Der adaptive Modus ist Default; der
Slider-Modus bleibt als Alternative verfügbar.

### Motivation

Das bisherige Slider-Verfahren ist eine Method of Adjustment: der User
justiert einen Cent-Slider, bis er den Eindruck hat, daß beide Töne in
der Tonhöhe übereinstimmen, und drückt „Übernehmen". Bekannte Probleme:

- **Adaptation**: längeres Anhören eines Tons verschiebt die
  Wahrnehmung.
- **Anker-Effekt**: durch den sequentiellen Durchlauf der Elektroden
  weiß der User, welche Frequenz „etwa" als nächstes kommen sollte,
  und antwortet entsprechend.
- **Stop-Kriterium liegt beim User**: kein objektiver Endpunkt.
- **Nur ein Lauf pro Elektrode**, kein Bias-Check, kein Median.

Der adaptive Modus löst diese Probleme durch eine 2-Intervall-2-Alternative-
Forced-Choice-Aufgabe (2I-2AFC) mit verschränkt randomisierten adaptiven
Staircases nach Levitt (1971). Methodische Grundlage und CI-spezifische
Fallstricke siehe Pieper et al. 2022 (im `.manuals/`-Ordner).

### Verfahren im Überblick

- Pro nicht ausgeschlossener Elektrode der variablen Seite läuft ein
  eigener adaptiver Staircase („Track"). Tracks laufen verschränkt
  **als geshuffelter Round-Robin**: pro Runde wird jede aktive Elektrode
  in zufälliger Reihenfolge genau einmal getestet, am Ende der Runde
  wird neu gemischt. Tracks, die innerhalb der Runde konvergieren,
  fallen aus dem Rest der Runde raus. Damit ist die Trial-Verteilung
  gleichmäßig (jeder Track hat nach N Runden ≈ N Trials), während die
  Reihenfolge für den User unvorhersagbar bleibt — Anker- und
  Adaptations-Effekte werden weiter minimiert.
- Pro Trial werden zwei kurze Töne nacheinander gespielt (AB-Sequenz,
  kein ABA): einer auf der Referenzseite, einer auf der variablen Seite.
  Reihenfolge (ref-erst oder var-erst) wird pro Trial zufällig gewählt.
- Der User beantwortet eine **fixe Frage**: „Zweiter Ton — höher oder
  tiefer?" Antwort über Pfeil-hoch / Pfeil-runter (oder Buttons).
- Der Algorithmus übersetzt die Antwort intern zurück auf „ref höher /
  var höher" und schiebt die **Referenz-Seiten-Frequenz** per
  2-down-1-up-Regel. Die variable Seite (CI) bleibt jeden Trial auf
  der Soll-Frequenz `effFreq(i)` der jeweiligen Elektrode — eine
  Pitch-Variation auf der CI-Seite würde benachbarte Elektroden
  anregen und die Messung verfälschen. Damit ist das Vorzeichen
  des resultierenden Match-Werts konsistent zum Slider-Modus und
  zur fRes-Speicherkonvention `cent = 1200 · log2(refFreq/varFreq)`.
- Konvergiert ein Track, wird er aus dem Pool entfernt. Test endet,
  wenn alle Tracks konvergiert, als „kein Fortschritt" oder als „nicht
  wahrnehmbar" abgeschlossen sind.

### Staircase-Parameter

- **Adaptive Regel**: transformed 2-down-1-up. Zwei aufeinanderfolgende
  Antworten in dieselbe Richtung → Frequenz wird in dieser Richtung
  verschoben; eine Antwort in die andere Richtung → sofortige Umkehr.
  Konvergiert auf den 70,7 %-Punkt der psychometrischen Funktion.
- **Schrittweiten-Folge**: 50 → 25 → 12 → 6 → 3 cent. Schrittweite wird
  bei jeder Umkehrung halbiert, bis das Minimum erreicht ist; danach
  bleibt sie bei 3 cent.
- **Startwert pro Track**: zufällig um den gespeicherten alten Match
  (falls vorhanden) im Bereich ±50 cent. Ohne alten Wert: zufällig
  ±100 cent um den Soll (= programmierte CI-Frequenz der Elektrode).
- **Antwort-Interpretation**: Bei „var höher wahrgenommen als ref" →
  ref-Frequenz war zu tief → ref in Richtung höher verschieben
  (positiver cent-Schritt). Und umgekehrt. Bei reflektierter Reihenfolge
  (var-erst statt ref-erst) wird die Antwort vor der Interpretation
  invertiert.

### Konvergenz und Ergebnis-Kategorien

Pro Track gibt es genau drei mögliche Endzustände:

**1. Konvergiert** (sauberes Ergebnis)
- Mindestens 6 Umkehrungen erreicht
- Schrittweite am Minimum (3 cent)
- Residuum (halbe Spanne der letzten 6 Umkehrungen) ≤ 10 cent
- Match = Mittelwert der letzten 6 Umkehrungen
- Im Chart: voller blauer Soll-Punkt (#2563eb) mit schwarzen I-Träger-Markern
  obendrüber (senkrecht: waagerechte Striche oben/unten; waagerecht:
  horizontaler Strich mit senkrechten Begrenzungsstrichen); kein farbiger Balken

**2. Konvergiert mit Restunsicherheit**
- Schrittweite am Minimum
- Residuum > 10 cent, aber stabil (letzte 4 Umkehr-Residuen ändern sich
  um < 2 cent)
- Match wird trotzdem als Mittelwert der letzten 6 Umkehrungen übernommen
- Im Chart: Soll-Punkt mit farbigem Cent-Unsicherheits-Band (semitransparenter
  Balken, Höhe = Residuum) plus I-Träger-Marker (wie bei converged)

**3. Nicht wahrnehmbar**
- Mindestens 3 Catch-Trials des Tracks abgeschlossen
- Catch-Fehlerrate ≥ 50 %
- Gilt unabhängig von Umkehr-Zahl und Konvergenz-Status (überschreibt
  auch eine bereits ermittelte Konvergenz)
- Kein Match-Wert
- Im Chart: durchgekreuztes Symbol am Ist-Strich (Vorschlag: hohles
  Quadrat mit ✕), kein Soll-Punkt

**Konvergenz-Sperre**: Ein Track kann erst als konvergiert erklärt werden,
wenn mindestens 3 Catch-Trials für diesen Track absolviert wurden.
Dadurch ist die Catch-Statistik aussagekräftig, bevor ein Ergebnis
akzeptiert wird. Sind beim Hard Cap (80 Trials) noch keine 3 Catch-Trials
vorhanden, wird der Track als `not-perceivable` klassifiziert.

**Hard Cap**: 80 Trials pro Track als Safety Net. Wird er erreicht ohne
Konvergenz und ohne „Nicht wahrnehmbar"-Klassifikation, wird der Track
als „Konvergiert mit Restunsicherheit" abgeschlossen — Wert bleibt
verwertbar, Residuum wird groß sein.

### Ergebnis-Tabelle (Status-Spalte)

Die Ergebnis-Tabelle im Frequenzabgleich-Sub-Tab erhält eine
**Status-Spalte** (rechts):

| Zustand | Badge |
|---|---|
| `converged` | ✓ (grünes Badge) |
| `converged-noisy` | Restunsicherheit (gelb-oranges Badge) |
| `not-perceivable` | ✗ nicht wahrnehmbar (rotes Badge in der Zeile, die sonst „nicht gemessen" zeigt) |
| `in-progress-early` | läuft · N Vergleiche (blaues Badge, kursive Zeile) |
| `in-progress` | in Arbeit · M Umkehrungen (blaues Badge, kursive Zeile) |
| Slider-Modus (kein `fmStatus`) | — |

Deaktivierte/ausgeschlossene Elektroden: Status-Zelle leer (—).

### Anzeige im Reiter Meßergebnisse → Frequenzabgleich

Der Ergebnis-Reiter zeigt nicht nur abgeschlossene Tracks, sondern auch
laufende. Pro aktivem Track wird ein vorläufiger Zwischenstand
angezeigt:

- **<2 Umkehrungen** (`in-progress-early`): kein Schätzwert.
  Status-Badge „läuft · N Vergleiche". Zahlen-Spalten leer. Im Chart:
  hohler blauer Kreis am Ist-Strich mit „?".
- **≥2 Umkehrungen** (`in-progress`): vorläufiger Match = Mittelwert
  aller bisherigen Umkehrungen. Residuum erst **ab 4 Umkehrungen**
  (halbe Spanne aller bisherigen Umkehrungen). Status-Badge
  „in Arbeit · M Umkehrungen". Match-Spalte gefüllt; Residuum-Spalte
  bei 2–3 Umkehrungen leer. Im Chart: hohler blauer Kreis an
  geschätzter Soll-Position, Restunsicherheits-Band nur ab 4 Umkehrungen.

Dieselbe Logik gilt auch im Status-Grid des Test-Panels: vorläufige
Match- und Residuum-Werte erscheinen dort kursiv und in gedämpfter
Farbe (`fm-status-provisional`), sobald die Schwellen erreicht sind.

Die Tabelle enthält eine **Restunsicherheits-Spalte** (zwischen
„Diff. (Cent)" und „Status"). Werte mit Ampelfarbe:
- ≤10 cent grün, 11–25 cent gelb-orange, >25 cent rot.
Bei Tracks mit <2 Umkehrungen oder bei nicht-wahrnehmbaren: „—".

Unterhalb der Tabelle: Button „Frequenzabgleich-Ergebnisse löschen"
(`fmrClearBtn`, rot) — löscht `fRes` und `freqmatchAdaptive` beider
Seiten vollständig und aktualisiert die Anzeige.

Oberhalb der Tabelle (nur bei laufender Messung):
- **Fortschrittsbalken** — Formel siehe „Fortschritt".
- **Qualitätstext** in drei Stufen (erste Messungen / teilweise /
  vollständig), mit mittlerem Residuum und Hinweis auf besonders
  unsichere Elektroden.

### Fortschritt

Pro Track:
- Endzustand (`converged`, `converged-noisy`, `not-perceivable`)
  zählt als 1,0.
- Aktiver Track zählt als `min(reversals / 6, 0,95)` — damit ist
  garantiert, daß ein aktiver Track nie wie ein abgeschlossener
  aussieht.

Gesamtfortschritt = Mittelwert über alle Tracks, in Prozent. Der
Balken im Test-Panel und im Ergebnis-Reiter nutzen dieselbe Formel
(`fmComputeProgressStats`). Der Fortschrittstext lautet:
„X von Y Elektroden konvergiert · N Vergleiche · P % Fortschritt".

### Catch-Trials

- **Verteilung**: deterministisch, jeder 8. Trial eines Tracks ist ein
  Catch-Trial (Track-Trial-Indizes 5, 13, 21, … — konstante `FM_CATCH_INTERVAL=8`,
  `FM_CATCH_PHASE=5`). Damit erhält jede Elektrode gleichmäßig Catch-Trials,
  unabhängig von Gesamtlaufzeit oder Reihenfolge.
- **Design**: in einem Catch-Trial wird der variable Ton nicht aus dem
  Staircase-Algorithmus geholt, sondern um ±500 cent von der Referenz
  verschoben (Richtung zufällig). Die richtige Antwort ist eindeutig
  hörbar — wer das nicht erkennt, hört in dem Frequenzbereich nicht
  ausreichend.
- **Wirkung auf den Staircase**: Catch-Trials werden NICHT in die
  Staircase-Logik gewertet (keine Umkehrung, keine
  Schrittweiten-Änderung). Sie zählen nur in der Catch-Statistik des
  Tracks.
- **Interpretation**: Catch-Fehlerrate ist eine Eigenschaft des
  Frequenzbereichs, nicht des Users. Sie unterscheidet „kann ich
  nicht hören" (hoher Catch-Fehler + keine Konvergenz) von
  „kann ich, aber ungenau" (niedriger Catch-Fehler, großes Residuum).
- **Keine globale Aufmerksamkeits-Warnung**: Catch-Fehler triggern
  keine UI-Warnung; sie fließen nur in die per-Elektroden-Klassifikation
  ein.

### Zurück / Undo

Nach jeder beantworteten Frage ist der Zurück-Button (Taste Z) für
genau eine Aktion aktiv. Er stellt den Track-State vor der letzten
Antwort wieder her und spielt den Trial erneut ab — für den Fall
einer Fehleingabe (Fingerreflex). Sobald der nächste Trial startet,
verfällt die Undo-Möglichkeit.

### Pause und Resume

- Test ist jederzeit pausierbar (Stop-Button, Esc).
- Bei Pause wird der vollständige Track-State persistiert:
  Trial-Historie pro Track (Frequenz, Antwort, Catch-Marker),
  Umkehrpunkte, aktuelle Schrittweite, aktuelle Richtung, Status.
- Beim erneuten Start: alle nicht abgeschlossenen Tracks gehen zurück
  in den Pool, der Test setzt nahtlos fort.
- Der Start-Button zeigt „Test fortsetzen" (i18n-Key `fmLblResume`),
  solange ein pausierter Lauf vorliegt; sonst „Test starten" (`fmLblStart`).
- Sobald alle Tracks abgeschlossen sind (alle drei Kategorien zählen
  als abgeschlossen), gilt der Lauf als vollständig.
- **Tab-Sperrung während aktivem Test**: alle anderen Tabs und
  Sub-Tabs gesperrt, wie bei den übrigen Tests (`lockTestTabs`).

### Wenn der User einen Ton nicht hört

Der User wird in der Erklärung explizit aufgefordert zu **raten**, wenn
er einen oder beide Töne nicht eindeutig hört. Begründung steht im
Erklärungstext: blindes Raten in nicht wahrnehmbaren Bereichen führt
über die Catch-Statistik automatisch zur korrekten Klassifikation
(„nicht wahrnehmbar") und ist kein Fehler. Damit bleiben die zwei
Antwort-Buttons das einzige Interaktions-Element — keine dritte Option
„weiß nicht / höre nichts" nötig.

### UI-Elemente

Der adaptive Modus nutzt `buildTestPanel` aus `test-ui.js` und braucht
**zwei neue optionale Sektionen** in diesem Builder:

1. **`heightJudgment`-Sektion** (Block 3): zwei große Buttons
   `↑ höher` und `↓ tiefer`, sichtbar nur wenn modeSelect.value ===
   `adaptive`. Ersetzt für diesen Modus den Slider und den
   3-Knopf-Judgment-Block.

2. **`statusGrid`-Sektion** (Block 3): Container für die per-Elektroden-
   Statusanzeige. Zur Laufzeit vom freqmatch.js-Modul mit einer Zeile
   pro Elektrode befüllt:
   - Elektroden-Bezeichnung (apikal→basal sortiert, feste Reihenfolge)
   - Status-Text: „⏳ läuft" (noch keine Schätzwerte), „⏳ vorläufig"
     (Schätzwerte vorhanden, kursiv angezeigt), „✓ konvergiert",
     „◐ unsicher", „✗ nicht wahrnehmbar"
   - Aktueller Match in cent (oder „—" für nicht wahrnehmbar)
   - Residuum „±N ct"
   - Anzahl Vergleiche (Spalte „Vergleiche")
   - Catch-Statistik klein (z. B. „0/2")

Übrige `buildTestPanel`-Sektionen werden im adaptiven Modus wie folgt
verwendet:

- `rowMode.modeSelect`: zwei Optionen `slider` / `adaptive`. Default
  `adaptive`. Bei Wechsel wird der Test-Block-Inhalt entsprechend
  umgeschaltet (Slider ausblenden / heightJudgment einblenden, etc.).
- `rowFine.refSelect`: Referenzseite LINKS/RECHTS wie heute.
- `rowVolume`: Default Burst-Dauer 400 ms (statt 1000 ms im
  Slider-Modus), Pause 400 ms.
- `rowSequence.toneType`: wie heute, global.
- `rowSequence.sequence`: im adaptiven Modus ausgeblendet (AB fest).
- `progressBar`: Befüllung „Trial N / X von Y Elektroden abgeschlossen /
  Catch Z %".
- `pairIndicator` (pairLeft / pairRight): semantisch umgewidmet zu
  **Ton-1 / Ton-2** (sequentiell, nicht L/R). CSS-Klassen können bleiben,
  Labels per i18n.
- `actions.replay`: wie heute, mit Space-Taste.
- `excludeButtons`: im adaptiven Modus nicht zeigen — Ausschluß läuft
  über den Implantat-Tab.
- `confidence`-Radios: im adaptiven Modus nicht zeigen — das Residuum
  ist die Confidence.
- `slider`, `sliderValue`, `cumulativeDisplay`, `confirmBtn`: im
  adaptiven Modus nicht zeigen.

### Erklärungstext (i18n DE)

Vorschlag für die zentralen i18n-Keys (en/fr/es kommen separat nach
[[feedback_bauanleitungen_i18n]]):

- `fmExplainAdaptiveIntro`: „Sie hören zwei kurze Töne hintereinander.
  Beantworten Sie nur: war der zweite Ton höher oder tiefer als der
  erste? — mit Pfeil hoch oder Pfeil runter."
- `fmExplainAdaptiveGuess`: „Wenn Sie keinen oder nur einen der Töne
  hören: einfach raten. Falsche Antworten in einem Bereich, in dem Sie
  wenig hören, sind kein Fehler — die Messung erkennt das selbst und
  stuft die Elektrode in diesem Bereich als „nicht wahrnehmbar" oder
  „unsicher" ein."
- `fmExplainAdaptivePause`: „Der Test läuft, bis alle Elektroden
  ausreichend genau gemessen sind. Sie können jederzeit pausieren und
  später fortsetzen."
- `bHigher`: „höher"
- `bLower`: „tiefer"

### Tastatur

- **Pfeil hoch** = höher
- **Pfeil runter** = tiefer
- **Leertaste** = Wiederholen (Replay des aktuellen Trials, zählt nicht
  als neuer Trial)
- **Esc** = Stop

Globaler keydown-Handler analog zu `latency.js`: aktiv nur wenn
`fmAdaptiveActive === true`, Inputs / Textareas / Selects werden
ausgespart.

### Storage

Per-Seite gespeichert in `sideData[side]`:

- `fmMode` — `'slider'` (klassisch) oder `'adaptive'` (neu). Default
  `'adaptive'`. Wird beim Tab-Wechsel und Seitenwechsel geladen.
- `freqmatchAdaptive` — Sub-Objekt mit pro-Track-Daten. Erlaubt
  Pause/Resume und enthält alle Metadaten für die Ergebnis-Anzeige:
  ```
  {
    tracks: {
      [electrodeIdx]: {
        trialHistory: [{ trial, varFreq, response, isCatch,
                         catchCorrect, firstSide }],
        reversals: [centValues],
        stepSize: number,
        direction: 'up' | 'down',
        status: 'active' | 'converged' | 'converged-noisy' |
                'not-perceivable',
        match: centOffset | null,
        residual: cents | null,
        catchTotal: number,
        catchErrors: number,
        trialCount: number
      }
    },
    roundQueue: [electrodeIdx, ...],    // aktuelle Round-Robin-Reihenfolge
    startedAt: timestamp,
    completedAt: timestamp | null
  }
  ```

Das vorhandene Cent-Offset pro Elektrode (heute im einfachen Feld
gespeichert) wird beim Konvergieren / Restunsicherheits-Abschluß eines
Tracks im adaptiven Modus weiterhin in dieses bestehende Feld
geschrieben, damit Folge-Systeme (Frequenz-Warp, Druck, Chart) ohne
Änderung weiterlaufen. „Nicht wahrnehmbar"-Tracks setzen das Feld
explizit auf `null` / nicht gemessen.

### Verhältnis zum bestehenden Slider-Modus

- Der Slider-Modus bleibt unverändert in `freqmatch.js` als zweite
  Mode-Option erhalten.
- Beide Modi schreiben dasselbe Cent-Offset-Feld pro Elektrode —
  Ergebnisse sind über die Modi hinweg austauschbar.
- Der adaptive Modus speichert zusätzlich `freqmatchAdaptive` (siehe
  oben).
- Bestehende gespeicherte Dateien (JSON-Export, localStorage) bleiben
  ohne Migration weiter ladbar — das neue Sub-Objekt fehlt bei Altdaten
  einfach und der Test startet im adaptiven Modus „frisch".

### Multi-User-Tauglichkeit

Der adaptive Modus funktioniert symmetrisch für alle vom Tool
unterstützten Hörkonfigurationen:

- **CI + Normalhörend**: Referenz = normales Ohr, Variable = CI.
- **CI + Schwerhörig**: Referenz = schwerhöriges Ohr (mit der schon
  vorhandenen Pegelkorrektur via `fmCorrGain`), Variable = CI. Frequenz-
  bereiche, in denen das schwerhörige Ohr nichts hört, landen
  automatisch in der Kategorie „nicht wahrnehmbar" — was selbst eine
  klinisch nützliche Information ist.
- **Bilateral CI**: Referenz und Variable beide CI. Test mißt nicht eine
  „akustische Wahrheit", sondern die Relation der beiden CI-Maps
  zueinander. Auswahl der Referenzseite per `refSelect` wie bisher.

### Bekannte Einschränkungen

- **Plastizität (Pieper et al. 2022)**: Bei erfahrenen CI-Trägern hat
  sich die Pitch-Wahrnehmung schon nach wenigen Monaten an die
  programmierten Frequenzbänder angepaßt. Der Test mißt die *aktuelle*
  Wahrnehmung, nicht eine objektive anatomische Wahrheit. Für ein
  Self-Balancing-Tool ist das das richtige Maß. Im Erklärungstext sollte
  offen kommuniziert werden, daß sich Match-Werte über Wochen und Monate
  verschieben können und bei größeren MAP-Änderungen neu gemessen werden
  sollten.
- **Pitch-Match-Plastizität innerhalb einer Sitzung**: Pitch-Wahrnehmungen
  können sich auch kurzfristig verschieben. Mehrere Sitzungen mit
  Median-Bildung wären methodisch sauberer, sind aber außerhalb des
  Tool-Scopes — der User kann den Test jederzeit erneut starten.
- **Konvergenz-Schwelle 10 cent**: Sportlich; CI-Pitch-Match-Streuungen
  liegen in der Literatur oft bei 20-100 cent. Die „kein Fortschritt"-
  Klausel fängt Fälle auf, in denen 10 cent nicht erreichbar ist. Die
  Schwelle könnte später per UI-Option freigegeben werden.

### Aufteilung der Bauanleitungen

Vorgesehen in mehreren kleinen Schritten gemäß
`docs/BAUANLEITUNGEN_LEITLINIEN.md`:

1. `buildTestPanel` um `heightJudgment` und `statusGrid` erweitern
2. Mode-Switch in `freqmatch.js`, Slider-Modus von neuem Modus
   architektonisch trennen
3. Staircase-Logik (Track-State, Trial-Pull, Konvergenz-Erkennung)
4. Status-Grid-Befüllung und Live-Updates pro Trial
5. Pause/Resume-Storage und Wiederherstellen beim Start
6. Catch-Trials und „nicht wahrnehmbar"-Erkennung
7. Ergebnis-Chart-Anpassung für die drei Kategorien (Restunsicherheits-
   Band, „nicht wahrnehmbar"-Symbol)
8. i18n DE (en/fr/es separat als Mini-Anleitung danach)
