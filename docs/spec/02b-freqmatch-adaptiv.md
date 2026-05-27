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

- Pro nicht ausgeschlossener Elektrode der variablen Seite laufen
  **zwei verschränkte adaptive Staircases („Tracks")**: Track-up startet
  oberhalb der Soll-Frequenz (positiver Cent-Offset), Track-down
  unterhalb (negativer Cent-Offset). Beide konvergieren unabhängig
  auf den Match-Punkt. Der elektroden-finale Match ist der
  **Mittelwert der beiden Konvergenzpunkte**.
  Begründung (siehe auch „Bekannte Einschränkungen"): die 2-down-1-up-Regel
  konvergiert nicht exakt auf den Match-Punkt, sondern systematisch
  daneben (sie sucht den 70,7-%-Punkt einer Antwort). Bei einem Match
  ist die Antwort 50/50, sodass eine einzelne Staircase systematisch
  in eine Richtung verschoben ist. Zwei Staircases von gegenüberliegenden
  Startpunkten kompensieren diese Verschiebung gegenseitig und eliminieren
  zugleich den Bracketing-Effekt (Jensen et al. 2021).
- Tracks laufen verschränkt **als geshuffelter Round-Robin**: pro Runde
  wird jeder aktive Track in zufälliger Reihenfolge genau einmal getestet,
  am Ende der Runde wird neu gemischt. Tracks, die innerhalb der Runde
  konvergieren, fallen aus dem Rest der Runde raus. Damit ist die
  Trial-Verteilung gleichmäßig (jeder Track hat nach N Runden ≈ N Trials),
  während die Reihenfolge für den User unvorhersagbar bleibt. Bei 12
  Elektroden hat der Pool 24 Tracks im Vollausbau, bei 22 Elektroden 44.
- **Anker-Schutz am Test-Ende**: sobald nur noch wenige Tracks aktiv sind
  (Schwelle: < 4), wird die Round-Robin-Reihenfolge durch echte
  Randomisierung mit Wiederholungs-Sperre ersetzt — derselbe Track darf
  nicht direkt hintereinander zweimal kommen. Das verhindert das
  vorhersehbare „A B A B A B"-Muster, wenn der Pool fast leer ist.
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
- Konvergiert ein Track, wird er aus dem Pool entfernt. Eine Elektrode
  gilt als fertig, wenn beide ihrer Tracks fertig sind. Test endet,
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
- **Startwerte pro Elektrode (zwei Tracks)**:
  - **Track-up** startet bei `+100 cent` (Ref-Frequenz oberhalb der
    CI-Soll-Frequenz). Der Track wandert von oben in Richtung Match.
  - **Track-down** startet bei `−100 cent` (Ref unterhalb). Wandert von
    unten in Richtung Match.
  - Symmetrische Startabstände sind essentiell — asymmetrische Startweiten
    erzeugen Bracketing-Bias (Jensen et al. 2021). Daher **kein**
    Warmstart aus alten Matches; jeder Lauf startet frisch mit
    ±100 cent.
- **Antwort-Interpretation**: Bei „var höher wahrgenommen als ref" →
  ref-Frequenz war zu tief → ref in Richtung höher verschieben
  (positiver cent-Schritt). Und umgekehrt. Bei reflektierter Reihenfolge
  (var-erst statt ref-erst) wird die Antwort vor der Interpretation
  invertiert.

### Konvergenz und Ergebnis-Kategorien

Pro Track gibt es sechs mögliche Endzustände, gestaffelt nach Qualität.
Die elektroden-finale Klassifikation kombiniert die Status beider Tracks
(siehe „Elektroden-Status aus zwei Tracks" unten).

**Track-Status:**

| Key | Bedingung | Match-Wert |
|---|---|---|
| `converged`        | Min-Schritt + ≥6 Umkehr. + Residuum ≤ 10 ct | Mittelwert der letzten 6 Umkehr. |
| `converged-fair`   | Min-Schritt + ≥6 Umkehr. + Residuum 11–25 ct | Mittelwert der letzten 6 Umkehr. |
| `converged-wide`   | Min-Schritt + ≥6 Umkehr. + Residuum 26–50 ct | Mittelwert der letzten 6 Umkehr. |
| `unstable`         | Hard Cap erreicht + Residuum > 50 ct       | Mittelwert aller Umkehr. (mit Vorbehalt) |
| `not-perceivable`  | Catch-Fehlerrate ≥ 67 % (mind. 3 Catches)    | kein Wert |
| `aborted`          | User-Abbruch / Test-Reset                    | kein Wert |

**Chart-Darstellung pro Track-Status:**
- `converged`: voller blauer Soll-Punkt (#2563eb) + schwarze I-Träger-Marker,
  kein farbiger Balken
- `converged-fair` / `converged-wide`: Soll-Punkt + farbiges Cent-Unsicherheits-Band
  (semitransparenter Balken, Höhe = Residuum) + I-Träger
- `unstable`: Soll-Punkt offen-gestrichelt + breites graues Band, Hinweis-Icon
- `not-perceivable`: durchgekreuztes hohles Quadrat am Ist-Strich, kein Soll-Punkt
- `aborted`: leerer Strich (wie nicht gemessen)

**Elektroden-Status aus zwei Tracks** (Track-up + Track-down):
- Beide `converged` → Elektrode `converged`
- Beide konvergiert, aber mindestens einer in `-fair`/`-wide` → Elektrode bekommt
  den schlechteren der beiden Stati (`converged-fair` oder `converged-wide`).
  Zusätzlich: wenn |Match_up − Match_down| > 25 ct → Status um eine Stufe
  herabgesetzt (mindestens `converged-wide`), weil die beiden Staircases
  systematisch divergent sind.
- Mindestens einer `unstable` → Elektrode `unstable`
- Mindestens einer `not-perceivable` → Elektrode `not-perceivable`
  (kein Match-Wert, auch wenn der andere Track konvergiert wäre)
- Beide `aborted` → Elektrode `aborted`

**Match-Wert pro Elektrode** = Mittelwert der Match-Werte beider Tracks
(falls beide einen Match liefern).

**Konvergenz-Sperre**: Ein Track kann erst als konvergiert (in beliebiger
Qualitätsstufe) erklärt werden, wenn mindestens 3 Catch-Trials für diesen
Track absolviert wurden. Dadurch ist die Catch-Statistik aussagekräftig,
bevor ein Ergebnis akzeptiert wird. Sind beim Hard Cap noch keine 3
Catch-Trials vorhanden, wird der Track als `not-perceivable` klassifiziert.

**Hard Cap**: 80 Trials pro Track als Safety Net.

### Ergebnis-Tabelle (Status-Spalte)

Die Ergebnis-Tabelle zeigt den **Elektroden-Status** (kombiniert aus
beiden Tracks):

| Zustand | Badge |
|---|---|
| `converged`        | ✓ (grünes Badge) |
| `converged-fair`   | ◐ (gelbes Badge) |
| `converged-wide`   | ◐ (orange Badge) |
| `unstable`         | ⚠ (rot-oranges Badge) |
| `not-perceivable`  | ✗ nicht wahrnehmbar (rotes Badge) |
| `aborted`          | ∅ (graues Badge) |
| `in-progress-early` | läuft · N Vergleiche (blaues Badge, kursive Zeile) |
| `in-progress`      | in Arbeit · M Umkehrungen (blaues Badge, kursive Zeile) |
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

Die Tabelle enthält 11 Spalten. Zwischen „Diff. (Cent)" und „Status"
liegen drei Qualitätsspalten:

**Konvergenz u/d (Cent)** — mittlere halbe Umkehr-Spanne der beiden
Staircases pro Elektrode, getrennt für Track-up (Start +100 ct) und
Track-down (Start −100 ct). Anzeige im Format `±N / ±M`. Farbneutral,
ohne Ampelung — eine Roh-Größe für den Nutzer.
Bei einem Track `not-perceivable`: `✗` an dessen Stelle. Bei
`aborted`: `—`.

**Track-Differenz (Cent)** — gemittelte `|Match_up − Match_down|`
über alle Läufe einer Elektrode. Großer Wert = die beiden Staircases
konvergieren weit auseinander, Hinweis auf breite oder mehrdeutige
Pitch-Wahrnehmung. Farbneutral. Bei einem Track
`not-perceivable`/`aborted`: `—`.

**Residuum (Cent)** — Gesamtmessunsicherheit, quadratisch kombiniert:
```
σ_konv      = (residual_up_mean + residual_down_mean) / 2
σ_trackHalf = trackDiff_mean / 2
σ_runHalf   = runSpread / 2

residuum = sqrt(σ_konv² + σ_trackHalf² + σ_runHalf²)
```
Bei einem Lauf ist `runSpread = 0`, der Wert besteht nur aus
Konvergenz und halber Track-Differenz. Ampelfarbe:
≤10 ct grün, 11–25 ct gelb-orange, >25 ct rot. Tooltip zeigt
Aufschlüsselung: Konvergenz u/d · Track-Differenz · Run-Spannweite
(N Lauf/Läufe). Bei `not-perceivable`: „—" (grau).

Hinweis: Die quadratische Kombination ist die übliche Annahme
für unabhängige Fehlerquellen. Eine **additive** Kombination
(`σ_konv + σ_trackHalf + σ_runHalf`) wäre konservativer
(pessimistischer) und ist ebenfalls vertretbar — der Wechsel
würde sich auf eine einzelne Code-Stelle in
`_fmAggregateRunsForElectrode` beschränken.

Das Chart-Unsicherheitsband liest ebenfalls `fmResiduum` (mit
Fallback auf `fmResidual` für gespeicherte Altdaten).

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
  `FM_CATCH_PHASE=5`). Damit erhält jeder Track gleichmäßig Catch-Trials,
  unabhängig von Gesamtlaufzeit oder Reihenfolge.
- **Design**: in einem Catch-Trial wird der variable Ton nicht aus dem
  Staircase-Algorithmus geholt, sondern um eine **adaptive Spreizung**
  von der Referenz verschoben (Richtung zufällig). Die richtige Antwort
  ist eindeutig hörbar — wer das nicht erkennt, hört in dem Frequenzbereich
  nicht ausreichend.
- **Adaptive Spreizung**:
  ```
  catchSpread = max(FM_CATCH_MAGNITUDE, 2 * currentTrackResidual)
  ```
  mit `FM_CATCH_MAGNITUDE = 500 ct` als Untergrenze. Bei sehr unsicheren
  Tracks (großes Residuum) wäre ±500 ct kein eindeutig hörbarer Unterschied
  mehr — die Spreizung wächst dann mit dem Residuum mit. Beim ersten
  Catch-Trial (noch kein Residuum) gilt die Untergrenze.
- **Schwelle „nicht wahrnehmbar"**: Catch-Fehlerrate **≥ 67 %**
  (nicht 50 %). Begründung: bei 50 % Schwelle ist die Falsch-Positiv-Rate
  auf 3 Catch-Trials hoch (P[≥2 falsch | guter User] ≈ 12,5 %).
  Mit 67 % braucht es bei 3 Catches 2 von 3 falsch, mit der Erwartung
  klar oberhalb des Zufalls.
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
- `rowVolume`: Default Burst-Dauer **200 ms**, Pause **200 ms** (gilt für
  Slider- und adaptiven Modus). Kürzere Töne erzwingen Bauch-Antworten
  und mindern Timbre-Analyse — wichtig, weil CI-Stimulation und akustischer
  Vergleichston nie klanglich identisch sind.
- `rowSequence.toneType`: global. Default-Stimulus ist **`complex`**
  (harmonischer Komplexton, Grundton + 4 Harmonische). Begründung: starke
  Pitch-Wahrnehmung durch residue pitch + reichhaltigeres Timbre als
  reiner Sinus, näher am CI-Klang. Alternativ verfügbar (neu): `pulsedComplex`
  — wie `complex`, aber mit zusätzlicher 100 Hz AM-Hüllkurve, die die
  Pulsraten-Hüllkurve aller CI-Strategien grob simuliert.
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
- `freqmatchAdaptive` — Sub-Objekt mit allen Läufen (`runs[]`-Architektur).
  Erlaubt Pause/Resume und schließt das Überschreiben älterer Messungen
  durch einen neuen Lauf aus.

  ```
  {
    runs: [
      {
        runId:       string,        // z.B. ISO-Timestamp
        startedAt:   timestamp,
        completedAt: timestamp | null,
        tracks: {
          // Pro Elektrode zwei Tracks: '<idx>:up' und '<idx>:down'
          [trackKey]: {
            electrodeIdx: number,
            direction:    'up' | 'down',   // Start oberhalb/unterhalb
            startOffset:  +100 | -100,     // cent
            currentOffset: number,
            trialHistory: [{ trial, varFreq, response, isCatch,
                             catchCorrect, firstSide }],
            reversals:    [centValues],
            stepSize:     number,
            stepDir:      'up' | 'down',
            status:       'active' | 'converged' | 'converged-fair' |
                          'converged-wide' | 'unstable' |
                          'not-perceivable' | 'aborted',
            match:        centOffset | null,
            residual:     cents | null,
            catchTotal:   number,
            catchErrors:  number,
            trialCount:   number
          }
        },
        roundQueue:    [trackKey, ...],   // aktuelle Round-Robin-Reihenfolge
        perElectrode: {
          [electrodeIdx]: {
            matchUp:     centOffset | null,
            matchDown:   centOffset | null,
            finalMatch:  centOffset | null,   // Mittelwert beider Tracks
            residual:    cents | null,        // Mittel der beiden Residuen
            status:      'converged' | 'converged-fair' | 'converged-wide' |
                         'unstable' | 'not-perceivable' | 'aborted'
          }
        }
      }
      // ... weitere Läufe werden angehängt, nie überschrieben
    ],
    currentRunIdx: number | null    // Index des aktiven/letzten Laufs,
                                     // null nur, wenn runs leer ist
  }
  ```

- `fRes[electrodeIdx]` — robust kombiniertes Ergebnis über alle Läufe:
  ```
  {
    cent:                 centOffset | null,   // Median über runs[].perElectrode[i].finalMatch
                                                // (bei 1 Lauf: einfach der Wert; bei 2: Mittelwert;
                                                // bei 3+: echter Median, robust gegen Ausreißer-Läufe)
    runsCount:            number,              // Anzahl der Läufe, die beigetragen haben
    status,                                    // siehe Elektroden-Status, robust kombiniert über Läufe
    timestamp,
    varSide, refSide, varFreq, refFreq,
    // Konvergenz-Detail (BA 99)
    fmConvUp, fmConvDown,    // mittlere halbe Umkehr-Spannen je Track (über Läufe)
    fmTrackDiff,             // mittlere |Match_up − Match_down| (über Läufe)
    fmRunSpread,             // max−min der pro-Lauf-Match-Mittelwerte
    fmResiduum,              // Gesamtmessunsicherheit quadratisch: sqrt(σ_konv²+σ_trackHalf²+σ_runHalf²)
    fmStatusUpLast, fmStatusDownLast,  // Status des letzten Track-Laufs je Direction
    // Übergangsfelder (für Chart, Druck, Altdaten-Kompat)
    fmResidual,              // = meanResidual (Konvergenz-Mittel, für Qualitätstext)
    fmCombinedUncertainty,   // = fmResiduum (Brücke für Chart-Aufrufer)
    fmDelta:    null          // ungenutzt seit BA 93
  }
  ```

  Der `cent`-Wert ist die Quelle für Folge-Systeme (Frequenz-Warp, Druck,
  Chart). „Nicht wahrnehmbar" in allen Läufen → `cent = null`.

**Anti-Überschreib-Logik** beim Start eines neuen Laufs:
- Bei `runs.length ≥ 1` und letztem Lauf abgeschlossen: Bestätigungs-Dialog
  „Eine vorherige Messung ist bereits gespeichert (bisher N Lauf/Läufe).
  Ein weiterer Lauf wird zum Datensatz hinzugefügt und in die kombinierte
  Auswertung einbezogen. Die bisherigen Werte bleiben erhalten. Wenn Sie
  ganz neu beginnen wollen, drücken Sie [Messungen löschen]."
  Buttons: [Hinzufügen] (default), [Abbrechen].
  Pausierter (nicht abgeschlossener) Lauf → kein Dialog, Resume statt Neu.
- Bei `runs[last].completedAt > 7 Tage`: zusätzlicher Hinweis
  „Ihre letzte Messung ist X Tage alt. Pitch-Wahrnehmung kann sich
  durch Plastizität verschoben haben. Empfehlung: vor neuem Lauf
  [Messungen löschen] und frisch beginnen — oder neue Daten parallel
  halten."
- Der bestehende „Frequenzabgleich-Ergebnisse löschen"-Button bleibt der
  einzige Weg, Läufe tatsächlich zu verlieren.

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

Die Pitch-Match-Methode hat fundamentale Bias-Quellen, die selbst durch
sorgfältige Methodik nur teilweise zu eliminieren sind. Pieper et al. 2022
listet sie systematisch auf (Abschnitt „Frequency Mismatch Measurements"):

- **Klangfarben-/Stimulus-Spezifität** (Adel et al. 2019; Lazard et al. 2012):
  Pitch hängt von akustischem Stimulustyp ab; reiner Sinus vs. CI-Pulsstimulation
  klingt fundamental anders, der User vergleicht implizit auch Timbre. Wir
  mindern das durch **harmonischen Komplexton als Default** und kurze
  Töne (200 ms), die Bauch-Antworten erzwingen.
- **Pegelabhängigkeit** (Sagi & Svirsky 2021): Lautere Töne werden als höher
  wahrgenommen. Pegelkorrektur (`fmCorrGain`) und vorgelagertes
  Loudness-Balancing minimieren das, hängen aber an der Hardware-Kapazität
  (z. B. genügend Lautsprecher-Headroom).
- **2-down-1-up konvergiert nicht exakt auf Match**: einzelne Staircase
  konvergiert auf die 70,7-%-Schwelle, was bei einer Match-Aufgabe
  systematisch neben dem Match-Punkt liegt. **Zwei verschränkte Staircases
  pro Elektrode** (von oben und unten) kompensieren das.
- **Bracketing-/Range-Effekt** (Jensen et al. 2021): Mittelwerte verschieben
  sich weg vom Rand des Antwortbereichs. Symmetrische, gleichweite Startwerte
  (±100 cent) für beide Staircases halten das in Schach; kein Warmstart aus
  alten Matches.
- **Plastizität** (Reiss et al. 2015; Pieper et al. 2022): Bei erfahrenen
  CI-Trägern hat sich die Pitch-Wahrnehmung schon nach wenigen Monaten an
  die programmierten Frequenzbänder angepaßt. Der Test mißt die *aktuelle*
  Wahrnehmung, nicht eine objektive anatomische Wahrheit. Für ein
  Self-Balancing-Tool ist das das richtige Maß. Im Erklärungstext sollte
  offen kommuniziert werden, daß sich Match-Werte über Wochen und Monate
  verschieben können und bei größeren MAP-Änderungen neu gemessen werden
  sollten. Der Anti-Überschreib-Dialog warnt automatisch bei Daten >7 Tage.
- **Pitch-Match-Plastizität innerhalb einer Sitzung**: Pitch-Wahrnehmungen
  können sich auch kurzfristig verschieben. Mehrere Läufe mit Median-Bildung
  fangen das auf (siehe „Mehrere Läufe und Reliabilität").
- **Konvergenz-Schwelle 10 cent**: Sportlich; CI-Pitch-Match-Streuungen
  liegen in der Literatur oft bei 20-100 cent. Die abgestuften Qualitäts-
  Kategorien (`converged` / `-fair` / `-wide`) machen sichtbar, welche
  Elektroden die strenge Schwelle erreichen.

Pieper kommt zum Schluß, daß Pitch-Matching für die rein binaurale
Frequenz-Mismatch-Bestimmung nicht ideal sei (er empfiehlt CT-Imaging
oder ITD-Sensitivität). Beides ist im Browser nicht machbar; Pitch-Matching
bleibt für ein Self-Service-Tool das einzig praktikable Verfahren. Die
oben genannten Maßnahmen drücken die Bias-Quellen so weit wie methodisch
möglich.

### Aufteilung der Bauanleitungen

Grund-Architektur (umgesetzt, BA 72–82): `buildTestPanel`-Erweiterung,
Mode-Switch, Staircase-Kern, Status-Grid, Pause/Resume, Catch-Trials,
Ergebnis-Chart, i18n DE.

Konzept-Überarbeitung 2026-05 (neu, BA 91–97):

- **BA 91** — Bugfix Replay/Simul-Buttons im Adaptive-Modus
- **BA 92** — Audio-Defaults (Stimulus `complex`, Dauer/Pause 200 ms) +
  neue Tonart `pulsedComplex`
- **BA 93** — `runs[]`-Architektur + Anti-Überschreib-Dialog
- **BA 94** — Zwei verschränkte Staircases pro Elektrode (Track-up + Track-down)
- **BA 95** — `combinedUncertainty` in `fRes`, Tabellen-Spalte verallgemeinern
- **BA 96** — Konvergenz-Verfeinerung (5 Status-Kategorien, Catch-Schwelle 67 %,
  adaptive Catch-Spreizung)
- **BA 97** — Anker-Randomisierung im Restpool
- **BA 98** — Cleanup: zweiter Fortschrittsbalken und Lauf-2-Reste entfernen,
  Anti-Überschreib-Dialog ab `runs.length ≥ 1`
- **BA 99** — Drei Ergebnis-Spalten (Konvergenz u/d, Track-Differenz,
  Residuum) statt zwei. Tooltip mit Run-Spannweite. Chart-Band liest
  künftig fmResiduum statt fmResidual.

i18n en/fr/es bleibt als separate Mini-Anleitung am Ende der Reihe.

---

## Mehrere Läufe und Reliabilität

Die `runs[]`-Architektur (siehe „Storage") erlaubt beliebig viele
vollständige Staircase-Läufe pro Seite. Jeder Lauf wird an `runs[]`
angehängt; der aktuelle `fRes`-Eintrag pro Elektrode ist die robuste
Kombination über alle Läufe.

### Kombination über mehrere Läufe

- **1 Lauf**: `cent` = `runs[0].perElectrode[i].finalMatch`.
- **2 Läufe**: `cent` = Mittelwert beider Lauf-Matches.
- **3+ Läufe**: `cent` = **Median** der Lauf-Matches. Median ist robust
  gegen einen einzelnen ausreißenden Lauf (z. B. schlechte Tagesform).
- `not-perceivable` in einem Lauf, aber Match in einem anderen: der
  Match-liefernde Lauf zählt mit; bei Mehrheit `not-perceivable` →
  finale Elektrode `not-perceivable`.

`fmResiduum` ist die Gesamtmessunsicherheit über alle Läufe
(siehe „Storage" und Tabellenspalte „Residuum").

### UI

- Start-Button-Beschriftung:
  - kein laufender Test, `runs.length == 0` → „Test starten" (`fmLblStart`)
  - pausierter Lauf → „Test fortsetzen" (`fmLblResume`)
  - `runs.length ≥ 1` und kein laufender Test → „Weiteren Lauf starten"
    (`fmLblNewRun`)
- Fortschrittsbalken zeigt aktuellen Lauf (z. B. „Lauf 3").
- Anti-Überschreib-Dialog beim Start eines neuen Laufs bei `runs.length ≥ 1`
  (letzter Lauf abgeschlossen) oder bei letztem Lauf älter als 7 Tage
  (siehe „Storage").

### Historie der Bauanleitungen (zur Orientierung)

- BA 88–90 (überholt): erste Lauf-1/Lauf-2-Architektur mit `prevMatchCent`,
  `fmDelta`. Wurde durch BA 93/94 ersetzt (zwei verschränkte Staircases im
  selben Lauf + `runs[]`-Array). `fmDelta` wird in `fRes`-Einträgen weiter
  gesetzt (= `null`), aber seit BA 95 nicht mehr angezeigt; die Tabellenspalte
  zeigte stattdessen `fmCombinedUncertainty` als „Unsicherheit (ges.)" (BA 95–98).
  Ab BA 99 drei Spalten: Konvergenz u/d, Track-Differenz, Residuum.
