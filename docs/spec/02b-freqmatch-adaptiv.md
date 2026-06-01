## Frequenzabgleich — Adaptiver Modus (2I-2AFC)

Ergänzung zum bestehenden Sub-Tab Frequenzabgleich (`02-messung.md`,
Abschnitt „Sub-Tab 3"). Der adaptive Modus ist der Haupt-Modus; der
Slider-Modus dient als optionale Vor-Schätzung und ist im Dropdown
verfügbar, solange noch kein adaptiver Lauf für die aktuelle Seite
existiert.

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
Staircases. Methoden-Wahl und Quellen siehe Abschnitt „Wissenschaftliche
Grundlage und Grenzen" am Ende.

### Verfahren im Überblick

- Pro nicht ausgeschlossener Elektrode der variablen Seite läuft pro
  Messdurchgang **eine adaptive Staircase**. Mehrere Durchgänge können
  optional aneinandergereiht werden (siehe „Mehrere Läufe und
  Reliabilität"); über Läufe hinweg wird der Startwert **gepaart
  alterniert**, um einen Bracketing-Check zu erhalten.
- Tracks laufen verschränkt **als geshuffelter Round-Robin**: pro Runde
  wird jeder aktive Track in zufälliger Reihenfolge genau einmal getestet,
  am Ende der Runde wird neu gemischt. Tracks, die innerhalb der Runde
  konvergieren, fallen aus dem Rest der Runde raus. Damit ist die
  Trial-Verteilung gleichmäßig (jeder Track hat nach N Runden ≈ N Trials),
  während die Reihenfolge für den User unvorhersagbar bleibt. Bei 12
  Elektroden hat der Pool 12 Tracks im Vollausbau, bei 22 Elektroden 22.
- **Anker-Schutz am Test-Ende**: sobald nur noch wenige Tracks aktiv sind
  (Schwelle: < 4), wird die Round-Robin-Reihenfolge durch echte
  Randomisierung mit Wiederholungs-Sperre ersetzt — derselbe Track darf
  nicht direkt hintereinander zweimal kommen. Das verhindert das
  vorhersehbare „A B A B A B"-Muster, wenn der Pool fast leer ist.
- **Catch-up-Priorisierung (ab BA 105):** Zu Beginn jeder neuen Runde
  wird geprüft, ob es Tracks mit weniger als 2 Umkehrungen gibt
  (Konstante `FM_CATCHUP_REVERSALS_THRESHOLD = 2`, entspricht der
  `in-progress`-Schwelle). Wenn solche „lagging" Tracks existieren UND
  mindestens ein anderer Track bereits ≥ 2 Umkehrungen hat, wird einer
  der lagging Tracks zufällig ausgewählt und als zusätzliches
  Bonus-Trial der Runde vorangestellt. Anti-Wiederholungs-Sperre: der
  Bonus-Track darf nicht direkt vor seinem regulären Runden-Eintrag
  liegen; falls er nach dem Shuffle ohnehin an erster Stelle stünde,
  wird er vor dem Voranstellen mit Position 1 getauscht. Der reguläre
  Round-Robin (jeder aktive Track 1× pro Runde) bleibt unverändert —
  der Bonus liegt obendrauf. **Wirkung:** Tracks mit ungünstigem
  Startoffset holen schneller in den Bereich auf, in dem sie ein
  Zwischenergebnis liefern können. Greift nur im normalen
  Round-Robin-Pfad, nicht im Anker-Schutz-Pfad (kleiner Pool < 4).
- Pro Trial werden zwei kurze Töne nacheinander gespielt (AB-Sequenz,
  kein ABA): einer auf der Referenzseite, einer auf der variablen Seite.
  Reihenfolge (ref-erst oder var-erst) wird pro Trial zufällig gewählt.
- Der User beantwortet eine **fixe Frage**: „Zweiter Ton — höher oder
  tiefer?" Antwort über Pfeil-hoch / Pfeil-runter (oder Buttons).
- Der Algorithmus übersetzt die Antwort intern zurück auf „ref höher /
  var höher" und schiebt die **Referenz-Seiten-Frequenz** per
  1-down-1-up-Regel. Die variable Seite (CI) bleibt jeden Trial auf
  der Soll-Frequenz `effFreq(i)` der jeweiligen Elektrode — eine
  Pitch-Variation auf der CI-Seite würde benachbarte Elektroden
  anregen und die Messung verfälschen. Damit ist das Vorzeichen
  des resultierenden Match-Werts konsistent zum Slider-Modus und
  zur fRes-Speicherkonvention `cent = 1200 · log2(refFreq/varFreq)`.
- Konvergiert ein Track, wird er aus dem Pool entfernt. Eine Elektrode
  gilt als fertig, wenn ihr Track fertig ist. Test endet,
  wenn alle Tracks konvergiert, als „kein Fortschritt" oder als „nicht
  wahrnehmbar" abgeschlossen sind.

### Staircase-Parameter

- **Adaptive Regel**: 1-down-1-up. Nach **jeder** Antwort wird die
  Referenz-Frequenz in Antwort-Richtung verschoben (var höher → ref
  anheben; var tiefer → ref senken). Konvergiert direkt auf den Punkt
  subjektiver Pitch-Gleichheit (PSE = 50%-Punkt der psychometrischen
  Funktion).
- **Schrittweiten-Folge**: 50 → 25 → 12 → 6 → 3 cent. Schrittweite wird
  bei jeder Umkehrung halbiert, bis das Minimum erreicht ist; danach
  bleibt sie bei 3 cent.
- **Startwert pro Elektrode**: Der Startoffset wird in einer dreistufigen
  Priorität bestimmt:
  1. **Folgelauf mit vorhandenem Vorlauf-Match** (Lauf 2+,
     `prevRun.perElectrode[idx].match` existiert und ist endlich):
     Startoffset = `prevMatch + sign · 25 cent` (Konstante
     `FM_FOLLOWUP_BRACKET_OFFSET = 25`). Damit wird der bekannte
     Match aus zwei Richtungen mit kleinem Offset eingeschlossen, statt
     aus ±100 cent neu zu suchen — drastisch schnellere Konvergenz bei
     nicht-trivialen Mismatches.
  2. **Lauf 1 mit Slider-Vor-Schätzung** (`sliderEstimates[idx].cent`
     vorhanden): Startoffset = `schätzung.cent + sign · FM_INITIAL_START_OFFSET`
     (250 cent Abstand von der Schätzung). Das Vorzeichen `sign` wird
     trotzdem bestimmt und gespeichert (für Lauf-2-Bracketing). Ziel:
     erster Trial klingt deutlich verschieden von der Schätzung.
  3. **Sonst (klassisch):** Startoffset = `sign · FM_INITIAL_START_OFFSET`
     (250 cent), Vorzeichen zufällig in Lauf 1, alterniert in Lauf 2 (s. u.).
  - **Gepaartes Bracketing über Läufe** (Vorzeichen `sign`):
    - **Erster Lauf nach Reset (oder ungepaarter Vorgänger)**: pro
      Elektrode unabhängig zufällig `+1` oder `−1`.
    - **Folgelauf mit ungepaartem Vorgänger**: pro Elektrode wird **das
      jeweils andere Vorzeichen** des Vorgänger-Laufs verwendet.
    - **Lauf nach abgeschlossenem Paar**: gilt wieder als „erster Lauf",
      pro Elektrode neu gewürfelt.
    - Implementierung: jeder Lauf speichert `startSigns: { [elIdx]: +1 | -1 }`
      und ein Flag `pairedToPrevious: bool`. Beim Start eines neuen Laufs
      wird der letzte abgeschlossene Lauf konsultiert.
  - Die **Schrittweiten-Folge** 50 → 25 → 12 → 6 → 3 cent bleibt
    unverändert; eine gute Startposition spart Trials in der ersten
    50er-Phase, nicht in der Konvergenz-Phase.
- **Antwort-Interpretation**: Bei „var höher wahrgenommen als ref" →
  ref-Frequenz war zu tief → ref in Richtung höher verschieben
  (positiver cent-Schritt). Und umgekehrt. Bei reflektierter Reihenfolge
  (var-erst statt ref-erst) wird die Antwort vor der Interpretation
  invertiert.

### Konvergenz und Ergebnis-Kategorien

Pro Track gibt es sechs mögliche Endzustände, gestaffelt nach Qualität.

**Track-Status:**

| Key | Bedingung | Match-Wert |
|---|---|---|
| `converged`        | Min-Schritt + ≥8 Umkehr. + Residuum ≤ 10 ct | Mittelwert der letzten 6 Umkehr. |
| `converged-fair`   | Min-Schritt + ≥8 Umkehr. + Residuum 11–25 ct | Mittelwert der letzten 6 Umkehr. |
| `converged-wide`   | Min-Schritt + ≥8 Umkehr. + Residuum 26–50 ct | Mittelwert der letzten 6 Umkehr. |
| `unstable`         | Hard Cap erreicht + Residuum > 50 ct       | Mittelwert der letzten 6 Umkehr. (mit Vorbehalt) |
| `not-perceivable`  | Catch-Fehlerrate ≥ 67 % (mind. 3 Catches)    | kein Wert |
| `aborted`          | User-Abbruch / Test-Reset                    | kein Wert |

Hinweis zu ≥8 Umkehrungen statt 6: 1-down-1-up hat höhere Trial-zu-Trial-
Varianz als 2-down-1-up, weil jede Antwort einen Schritt erzeugt. Mit
8 Umkehrungen ist die Schätzung stabiler; die Residuums-Berechnung
verwendet weiterhin die **letzten 6** Umkehrungen als Fenster (so bleibt
die Skala mit früheren Daten und der Literatur vergleichbar).

**Chart-Darstellung pro Track-Status:**
- `converged`: voller blauer Soll-Punkt (#2563eb) + schwarze I-Träger-Marker,
  kein farbiger Balken
- `converged-fair` / `converged-wide`: Soll-Punkt + farbiges Cent-Unsicherheits-Band
  (semitransparenter Balken, Höhe = Residuum) + I-Träger
- `unstable`: Soll-Punkt offen-gestrichelt + breites graues Band, Hinweis-Icon
- `not-perceivable`: durchgekreuztes hohles Quadrat am Ist-Strich, kein Soll-Punkt
- `aborted`: leerer Strich (wie nicht gemessen)

**Verbindungslinie:** Blaue Linie durch alle Soll-Punkte mit bekanntem Match
(alle Status außer `in-progress-early`). Solid wenn alle Punkte konvergiert;
gestrichelt (`[5, 4]`) wenn mindestens ein `in-progress`-Punkt enthalten ist.

**Match-Wert pro Elektrode (pro Lauf)** = direkt der Track-Match
(Mittelwert der letzten 6 Umkehrungen).

**Konvergenz-Sperre**: Ein Track kann erst als konvergiert (in beliebiger
Qualitätsstufe) erklärt werden, wenn mindestens 3 Catch-Trials für diesen
Track absolviert wurden. Dadurch ist die Catch-Statistik aussagekräftig,
bevor ein Ergebnis akzeptiert wird. Sind beim Hard Cap noch keine 3
Catch-Trials vorhanden, wird der Track als `not-perceivable` klassifiziert.

**Hard Cap**: 80 Trials pro Track als Safety Net.

### Ergebnis-Tabelle (Status-Spalte)

Die Ergebnis-Tabelle zeigt den **Elektroden-Status** (kombiniert über
Läufe, siehe „Mehrere Läufe und Reliabilität"):

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
| `slider-estimate`  | 🎚 Vor-Schätzung (graues Badge, kursive Zeile) |
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

**`slider-estimate`** (neu, BA 103): die Tabelle zeigt eine
Slider-Vor-Schätzung an. Status-Badge „🎚 Vor-Schätzung" (graues
Badge, `fm-badge-slider`), Zeile kursiv. Konv./Lauf-Streuung/Residuum
leer („—"). Im Chart als hohle graue Raute mit gestricheltem Senkrechtstrich
zur Nullinie. Quelle: `freqmatchAdaptive.sliderEstimates[elIdx]`, wird nicht
in `fRes` geschrieben. Sobald für die Elektrode ein adaptiver Track aktiv wird
(≥0 Umkehrungen), tritt der Schätzungs-Eintrag zugunsten von `in-progress`
bzw. `in-progress-early` zurück (Vorrang-Logik in `_warpFResSource` und
`displayData`-Aufbau). Wird auch im Frequenz-Warp (Player-Audio-Pfad) und im
Audiologen-Druck als dritte Datenquelle verwendet (mit `†`-Markierung).

Dieselbe Logik gilt auch im Status-Grid des Test-Panels: vorläufige
Match- und Residuum-Werte erscheinen dort kursiv und in gedämpfter
Farbe (`fm-status-provisional`), sobald die Schwellen erreicht sind.

Oberhalb der Tabelle steht ein Beschreibungstext mit den tatsächlichen
Seitennamen (dynamisch aus `varLabel`/`refLabel`):
- Zeile 1: „Referenzseite: [REF] · Zielseite: [ZIEL]"
- Zeile 2: Erläuterung der Messlogik und Tabelleninterpretation

Die Tabelle enthält **9 Spalten** (Elektrode, Freq. [ZIEL] Einstellung,
Freq. [ZIEL] Wahrnehmung, Diff. Hz, Diff. Cent, Konvergenzweite, Lauf-Streuung,
Residuum, Status). Die ehemaligen Spalten „Var.-Seite" und „Ref.-Seite"
entfallen; stattdessen sind die Seitennamen in den Spaltenköpfen
„Freq. [ZIEL] Einstellung (Hz)" und „Freq. [ZIEL] Wahrnehmung (Hz)"
direkt enthalten. Zwischen „Diff. (Cent)" und „Status"
liegen drei Qualitätsspalten:

**Konvergenzweite (Cent)** — halbe Spanne der letzten 6 Umkehrungen,
gemittelt über alle abgeschlossenen Läufe. Für laufende Tracks
(`in-progress`): vorläufiger Wert aus `fmResidual` ab 4 Umkehrungen
(gedämpft grau), darunter `—`. Farbneutral, ohne Ampelung.
Bei `not-perceivable`: `—`.

**Lauf-Streuung (Cent)** — Standardabweichung der pro-Lauf-Matches.
Bei N=1 Lauf: `—` (nicht definiert). Bei N≥2 Läufen: σ über die
Match-Werte. Großer Wert = die Läufe konvergieren weit auseinander,
Hinweis auf instabile Pitch-Wahrnehmung (Tagesform, Plastizität,
mehrdeutige Stelle). Farbneutral.

**Residuum (Cent)** — Gesamtmessunsicherheit, quadratisch kombiniert:
```
σ_konv    = Konvergenzweite (mittlere halbe Spanne über Läufe)
σ_runHalf = Lauf-Streuung (Standardabweichung der Lauf-Matches)

residuum  = sqrt(σ_konv² + σ_runHalf²)
```
Bei nur einem Lauf entfällt der σ_runHalf-Term (= 0); Residuum =
σ_konv. Ampelfarbe: ≤10 ct grün, 11–25 ct gelb-orange, >25 ct rot.
Tooltip zeigt Aufschlüsselung: Konvergenz · Lauf-Streuung
(N Lauf/Läufe). Bei `not-perceivable`: „—" (grau).

Hinweis: Die quadratische Kombination ist die übliche Annahme
für unabhängige Fehlerquellen. Eine **additive** Kombination
(`σ_konv + σ_runHalf`) wäre konservativer (pessimistischer) und ist
ebenfalls vertretbar — der Wechsel würde sich auf eine einzelne
Code-Stelle in `_fmAggregateRunsForElectrode` beschränken.

Das Chart-Unsicherheitsband liest ebenfalls `fmResiduum`.

**Hinweis `fmrRunHint`** (gelber Streifen zwischen Chart und Tabelle):
Wird angezeigt, sobald Messdaten vorhanden sind (laufend oder abgeschlossen)
und kein `fRes`-Eintrag `fmRunsCount ≥ 2` hat. Text: „Die Restunsicherheit
der Messung kann erst nach 2 vollständigen Testdurchläufen zuverlässig
eingeschätzt werden …". Verschwindet erst wenn **alle** `fRes`-Einträge `fmRunsCount ≥ 2` haben
und kein Track mehr läuft — d.h. der zweite Lauf ist vollständig
abgeschlossen.

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
- Endzustand (`converged`, `converged-fair`, `converged-wide`,
  `unstable`, `not-perceivable`, `aborted`) zählt als 1,0.
- Aktiver Track zählt als `min(reversals / 8, 0,95)` — damit ist
  garantiert, daß ein aktiver Track nie wie ein abgeschlossener
  aussieht. Der Nenner 8 entspricht der neuen Mindest-Reversal-Zahl.

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
  mit `FM_CATCH_MAGNITUDE = 500 ct` als Untergrenze. `currentTrackResidual`
  ist hier explizit das **lokale** Residuum (halbe Spanne der letzten
  6 Umkehrungen, via `fmComputeResidual`), nicht die Spanne über alle
  Reversals — sonst skaliert die Spreizung mit der Track-Historie und
  wird unrealistisch groß. Beim ersten Catch-Trial (noch keine 6
  Umkehrungen) gilt die Untergrenze.
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
  Umkehrpunkte, aktuelle Schrittweite, aktuelle Richtung, Status,
  `startSign` pro Track.
- Beim erneuten Start: alle nicht abgeschlossenen Tracks gehen zurück
  in den Pool, der Test setzt nahtlos fort.
- Der Start-Button zeigt „Test fortsetzen" (i18n-Key `fmLblResume`),
  solange ein pausierter Lauf vorliegt; sonst „Test starten" (`fmLblStart`)
  bei `runs.length == 0` und „Weiteren Lauf starten" (`fmLblNewRun`)
  bei abgeschlossenen Läufen.
- Sobald alle Tracks abgeschlossen sind (alle Endzustände zählen
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
     „◐ leichte Streuung", „◐ breite Streuung", „⚠ unstabil",
     „✗ nicht wahrnehmbar"
   - Aktueller Match in cent (oder „—" für nicht wahrnehmbar)
   - Residuum „±N ct"
   - Anzahl Vergleiche
   - Catch-Statistik klein (z. B. „0/2")

Eine Zeile pro Elektrode, **keine** Aufsplittung in Sub-Tracks (es gibt
pro Lauf nur einen Track pro Elektrode).

Übrige `buildTestPanel`-Sektionen werden im adaptiven Modus wie folgt
verwendet:

- `rowMode.modeSelect`: zwei Optionen `slider` / `adaptive`. Default
  `adaptive`. Option `slider` ist verfügbar, solange kein adaptiver Lauf
  mit mindestens einer beantworteten Frage (`trialCount > 0`) für die
  aktuelle Seite existiert; danach wird sie durch `fmUpdateSliderModeAvail`
  deaktiviert. Ein gestarteter und sofort abgebrochener Lauf (0 beantwortete
  Trials) sperrt den Slider **nicht**. Bei Wechsel wird der Test-Block-Inhalt
  umgeschaltet (Slider ausblenden / heightJudgment einblenden, etc.).
  Wenn der adaptive Test gestartet wird und Slider-Schätzungen nur für
  einen Teil der Elektroden vorliegen, erscheint eine Bestätigungsfrage
  („Der Slider-Test wurde nur teilweise abgeschlossen — trotzdem adaptiv
  starten?").
- `rowFine.refSelect`: Referenzseite LINKS/RECHTS wie heute.
  **Auto-Default (BA 146)**: Beim Öffnen des Tabs wird `refSelect`
  automatisch auf die akustische Seite gesetzt, wenn genau eine Seite
  als CI und die andere als akustisch (`normal` / `shoh` / `hg`)
  konfiguriert ist — aber nur, wenn `fRes` leer ist und keine adaptiven
  Testdaten vorliegen. Sobald Daten vorhanden sind, bleibt das Dropdown
  unverändert; ein manueller Wechsel löst den Bestätigungsdialog aus.
  **BA 148-Bugfix**: `cfgSelect`-Change-Handler in `init.js` ruft jetzt
  `_fmRefreshTabState()` auf — Auto-Default aktualisiert sich sofort
  bei Konfigurationsänderung (CI↔HG↔normal↔deaf), ohne F5.
  **SYMMETRISCH-Option (BA 147)**: Zusätzliche Dropdown-Option
  „Symmetrisch (bilateral CI)" (`value = 'symmetric'`). Erscheint immer,
  da `includeSymmetric: true` in der freqmatch-Konfig gesetzt ist.
  Auto-Default setzt bei beidseitig CI automatisch `'symmetric'`
  (Vorzeichenkonvention: `fmCentOffset > 0` = rechte Seite klingt höher;
  Platzhalter `fmVarSide='left'`, `fmRefSide='right'`).
  Voraussetzung für symmetrischen Test: beide Seiten müssen dieselben
  aktiven Elektroden-Indices haben (sonst Mismatch-Alert `fmSymmetricElMismatch`
  + Abbruch).
  **SYMMETRISCH-Audiowiedergabe (BA 148)**: Beide Verfahren (Slider und
  Adaptiv) sind voll funktionsfähig. Audio: `playL = leftBase × 2^(−offset/2/1200)`,
  `playR = rightBase × 2^(+offset/2/1200)` — Offset wird symmetrisch auf beide
  Seiten verteilt. Catch-Trials verteilen `catchInfo.direction` je ±½ auf beide
  Seiten. Slider-Anzeige: beide Pair-Indikatoren zeigen Elektroden-Label mit
  Mittenfrequenz; `sliderValue` zeigt `+N Cent (L: X Hz / R: Y Hz)`. Daten-
  speicherung: `refSide: 'symmetric'`, `entry.cent` enthält den Match-Offset
  (positiv = rechts klingt höher). `fmPrevCent` liest symmetric-Einträge
  korrekt über `entry.cent`. Ergebnis-Anzeige und Druck folgen in BA 149.
  **Elektroden-Sperre auch im LEFT/RIGHT-Modus**: Wenn beide Seiten CI sind
  und die aktiven Elektroden-Indices nicht übereinstimmen, wird der Test
  ebenfalls blockiert (Alert `fmElMismatch`, gilt für Slider und Adaptiv).
  Wiederverwendet `fmBuildSeqSymmetric() === null` als Prüfbedingung.
- `rowVolume`: Default Burst-Dauer **200 ms**, Pause **200 ms** (gilt für
  Slider- und adaptiven Modus). Kürzere Töne erzwingen Bauch-Antworten
  und mindern Timbre-Analyse — wichtig, weil CI-Stimulation und akustischer
  Vergleichston nie klanglich identisch sind.
- `rowSequence.toneType`: global. Default-Stimulus ist **`complex`**
  (harmonischer Komplexton, Grundton + 4 Harmonische). Begründung: starke
  Pitch-Wahrnehmung durch residue pitch + reichhaltigeres Timbre als
  reiner Sinus, näher am CI-Klang. Alternativ verfügbar: `pulsedComplex`
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

**Konfigurationsabhängige Warn- und Sperrzustände (BA 146)**

Werden beim Tab-Öffnen und bei jedem Sprachwechsel neu ausgewertet:

- **Hörgeräte-Warnung** (`#fmHGWarning`, gelbe Info-Box oben im Panel):
  Erscheint, wenn eine Seite als `'hg'` konfiguriert ist **und der Test
  nicht ohnehin geblockt ist** (d. h. die Sperre hat Vorrang). Weist
  darauf hin, daß Hörgeräte-Kompressor und Frequenzformung die
  Tonhöhenwahrnehmung verzerren können und Frequenzabgleich-Ergebnisse
  daher weniger verlässlich sind.

- **Test-Sperre** (`#fmBlockedWarning`, gelbe Info-Box + `startBtn`
  disabled): Greift in zwei Fällen:
  - Eine Seite ist als `'deaf'` konfiguriert → kein Vergleichsohr
    vorhanden.
  - Beide Seiten sind akustisch (`normal` / `shoh` / `hg`) → kein
    CI-Ohr, nichts abzugleichen.
  Sobald die Konfiguration wieder testbar ist, wird der Start-Knopf
  automatisch freigegeben (sofern kein Test läuft).

### Erklärungstext (i18n DE)

Zentrale i18n-Keys (en/fr/es werden nicht mehr geführt, der Test ist
nur in deutscher Sprache):

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
  später fortsetzen. Weitere Messdurchgänge verbessern die
  Zuverlässigkeit des Ergebnisses."
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
        electrodeIdxList: number[],
        startSigns:  { [electrodeIdx]: +1 | -1 },   // Startvorzeichen pro Elektrode
        pairedToPrevious: bool,     // true = dieser Lauf ist der zweite eines
                                     // Bracketing-Paares (Startsigns invertiert
                                     // zum Vorgänger)
        tracks: {
          // Pro Elektrode genau ein Track. Key = String(electrodeIdx)
          [electrodeIdx]: {
            electrodeIdx: number,
            startSign:    +1 | -1,             // = startSigns[electrodeIdx]
            startOffset:  +100 | -100,          // cent (= startSign * 100)
            currentOffset: number,
            trialHistory: [{ trial, varOffset, response, isCatch,
                             catchCorrect, firstSide }],
            reversals:    [centValues],
            stepSize:     number,
            lastMoveDir:  'up' | 'down' | null,
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
        roundQueue:    [electrodeIdx, ...],   // aktuelle Round-Robin-Reihenfolge
        perElectrode: {
          [electrodeIdx]: {
            match:    centOffset | null,
            residual: cents | null,
            status:   'converged' | 'converged-fair' | 'converged-wide' |
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
    cent:                 centOffset | null,   // Median über runs[].perElectrode[i].match
                                                // (bei 1 Lauf: einfach der Wert; bei 2: Mittelwert;
                                                // bei 3+: echter Median, robust gegen Ausreißer-Läufe)
    runsCount:            number,              // Anzahl der Läufe, die beigetragen haben
    status,                                    // Aggregierter Status, match-priorisierend:
                                                //   - bei N≥1 Match-liefernden Läufen: schlechtester
                                                //     Status DIESER Läufe
                                                //   - sonst: schlechtester Status aller Läufe
    timestamp,
    varSide, refSide, varFreq, refFreq,
    fmConv,                  // mittleres Konvergenz-Residuum über Läufe
    fmRunSpread,             // Standardabweichung der pro-Lauf-Matches; null bei N=1
    fmResiduum,              // Gesamtmessunsicherheit quadratisch: sqrt(σ_konv² + σ_runHalf²)
    fmStatusLast,            // Status des letzten Laufs (für Diagnose)
    // Übergangsfelder (für Chart, Druck, Altdaten-Kompat)
    fmResidual,              // = fmConv (für Altdaten-Aufrufer)
    fmCombinedUncertainty,   // = fmResiduum (Brücke für Chart-Aufrufer)
    fmDelta:    null         // ungenutzt
  }
  ```

  Der `cent`-Wert ist die Quelle für Folge-Systeme (Frequenz-Warp, Druck,
  Chart). „Nicht wahrnehmbar" in allen Läufen → `cent = null`.

  **Altdaten-Behandlung (BA 100 + 106):**
  - Vorhandene `freqmatchAdaptive`-Objekte ohne `runs[]`-Array oder mit
    dem alten 2-Track-Schema (Keys `<idx>:up`, `<idx>:down`) werden beim
    Laden **verworfen** (Sub-Objekt auf `null` gesetzt). Es gibt keine
    Migration dieser Adaptive-Daten.
  - Alte `fRes`-Einträge mit den Detail-Feldern `fmConvUp`/`fmConvDown`/
    `fmTrackDiff`/`fmStatusUpLast`/`fmStatusDownLast` stammen aus dem
    alten 2-Track-Adaptive-Schema und werden über `_fmCleanupLegacyFRes()`
    entfernt.
  - **`fRes`-Einträge ohne `fmStatus`-Feld** stammen aus dem klassischen
    Slider-Modus (vor BA 102) und werden ab BA 106 **als Vor-Schätzungen
    übernommen**: `_fmMigrateAltSliderFRes()` schreibt sie nach
    `sideData[varSide].freqmatchAdaptive.sliderEstimates[elIdx]` und
    entfernt sie aus `fRes`. Damit stehen die Werte als Startwerte für
    den adaptiven Test bereit (siehe BA 104). Vorrang-Regel: wenn ein
    neuerer `sliderEstimates`-Eintrag (BA 102+) für dieselbe Elektrode
    bereits existiert, bleibt dieser erhalten und der Alt-Eintrag wird
    verworfen.

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

### Optionale Vor-Schätzung (Slider)

Vor dem ersten adaptiven Lauf einer Seite kann der Nutzer pro Elektrode
eine grobe Schieber-Einstellung als Vor-Schätzung vornehmen. Diese Werte
werden separat von `fRes` in
`sideData[side].freqmatchAdaptive.sliderEstimates[elIdx]` gespeichert
und dienen dem adaptiven Track als Startwert (siehe BA 104). Anzeige
und Nutzung in Messtabelle, Player und Druck: BA 103.

- Sobald `runs.length >= 1` für die Seite ist der Slider-Modus gesperrt;
  bestehende Schätzungen bleiben gespeichert.
- `fmConfirm` schreibt ins `sliderEstimates`-Objekt, nicht in `fRes`.
- `fmUndo` löscht den letzten Eintrag aus `sliderEstimates`.
- Vor dem ersten adaptiven Start (wenn noch keine Schätzungen vorliegen)
  erscheint ein Empfehlungs-Dialog mit drei Optionen: „Erst
  Slider-Schätzung" / „Direkt adaptiv starten" / „Abbrechen".
- **Slider-fRes-Einträge** (kein `fmStatus`-Feld) werden ab BA 106
  beim Laden nach `sliderEstimates` migriert (siehe Altdaten-Behandlung
  oben) — nicht mehr herausgefiltert.

### Verhältnis zum bestehenden Slider-Modus

- Der Slider-Modus dient jetzt als optionaler Vor-Schätz-Schritt.
- Slider-Schätzwerte landen in `freqmatchAdaptive.sliderEstimates`,
  nicht in `fRes` (Trennung von Schätzung und adaptivem Ergebnis).
- Seit BA 103 werden Slider-Schätzwerte in Meßergebnis-Tabelle,
  Frequenzabgleich-Chart, Player-Frequenz-Warp und Audiologen-Druck
  als dritte Datenquelle (`slider-estimate`) angezeigt — mit eigener
  Badge-Farbe und Druck-Markierung (`†`).
- Der adaptive Modus speichert zusätzlich `freqmatchAdaptive` (siehe
  oben).
- Bestehende gespeicherte Dateien (JSON-Export, localStorage) bleiben
  ohne Migration weiter ladbar — `sliderEstimates` fehlt bei Altdaten
  und wird von `_fmMigrateAdaptive` als `{}` initialisiert.

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

### Mehrere Läufe und Reliabilität

Die `runs[]`-Architektur erlaubt beliebig viele vollständige
Staircase-Läufe pro Seite. Jeder Lauf wird an `runs[]` angehängt; der
aktuelle `fRes`-Eintrag pro Elektrode ist die robuste Kombination über
alle Läufe.

**Kombination über mehrere Läufe:**
- **1 Lauf**: `cent` = `runs[0].perElectrode[i].match`.
- **2 Läufe**: `cent` = Mittelwert beider Lauf-Matches. (Da die beiden
  Läufe gepaartes Bracketing bilden, ist das auch der zentrale
  Anti-Bias-Schritt — die ±100-ct-Anker werden gemittelt.)
- **3+ Läufe**: `cent` = **Median** der Lauf-Matches. Median ist robust
  gegen einen einzelnen ausreißenden Lauf (z. B. schlechte Tagesform).
- `not-perceivable` in einem Lauf, aber Match in einem anderen: der
  Match-liefernde Lauf zählt mit; bei Mehrheit `not-perceivable` →
  finale Elektrode `not-perceivable`.

**Status-Aggregation match-priorisierend:**
Wenn mindestens ein Lauf einen Match liefert, wird der Status aus den
Match-liefernden Läufen bestimmt (schlechtester Status davon).
Andernfalls wird der schlechteste Status aller Läufe verwendet.
Dadurch entstehen keine inkonsistenten `fRes`-Einträge mit Status
„not-perceivable" und gleichzeitig gültigem `cent`-Wert.

`fmResiduum` ist die Gesamtmessunsicherheit über alle Läufe
(siehe „Storage" und Tabellenspalte „Residuum"):
```
σ_konv    = mittleres Konvergenz-Residuum über Läufe (fmConv)
σ_runHalf = Standardabweichung der Lauf-Matches (fmRunSpread)
fmResiduum = sqrt(σ_konv² + σ_runHalf²)
```

**UI:**
- Start-Button-Beschriftung:
  - kein laufender Test, `runs.length == 0` → „Test starten" (`fmLblStart`)
  - pausierter Lauf → „Test fortsetzen" (`fmLblResume`)
  - `runs.length ≥ 1` und kein laufender Test → „Weiteren Lauf starten"
    (`fmLblNewRun`)
- Fortschrittsbalken zeigt aktuellen Lauf (z. B. „Lauf 3").
- Anti-Überschreib-Dialog beim Start eines neuen Laufs bei `runs.length ≥ 1`
  (letzter Lauf abgeschlossen) oder bei letztem Lauf älter als 7 Tage
  (siehe „Storage").

---

## Wissenschaftliche Grundlage und Grenzen

Dieser Abschnitt erscheint im UI als **eingeklapptes Akkordeon in einer
eigenen Card unterhalb des Test-Bereichs**, sichtbar sobald das
Adaptive-Verfahren ausgewählt ist — unabhängig davon, ob gerade ein
Test läuft (i18n-Key `fmExplainAdaptiveScience`). Er ist für User
gedacht, die die Methodik verstehen möchten — Pflicht-Lektüre ist er
nicht.

### Verwendete Methode

Sequentielle 2-Intervall-2-Alternative-Forced-Choice-Aufgabe (2I-2AFC)
mit adaptiver **1-down-1-up**-Regel nach Levitt (1971). Die
Referenz-Frequenz wird nach jeder Antwort in Antwort-Richtung
verschoben; die Schrittweite halbiert sich nach jeder Umkehrung der
Bewegungsrichtung (Sequenz 50 → 25 → 12 → 6 → 3 cent). Das Verfahren
konvergiert direkt auf den Punkt subjektiver Pitch-Gleichheit (PSE,
50 %-Punkt der psychometrischen Funktion).

### Bekannte Bias-Quellen und Gegenmaßnahmen

- **Range-Bias** (Carlyon, Macherey et al. 2010; Jensen et al. 2021):
  Die Wahl der getesteten Frequenzen beeinflußt das Ergebnis, weil
  Antworten unbewußt am Mittelpunkt des Antwortbereichs zentrieren.
  Wir mindern das durch Coverage **aller** aktiven Elektroden in
  randomisierter Reihenfolge — der „Antwortbereich" entspricht dem
  realen Elektroden-Bereich, nicht einem künstlichen Test-Range.
- **Startpunkt-Bias** (Carlyon, Macherey et al. 2010; Schatzer et al.
  2014): Der Startwert eines adaptiven Tracks beeinflußt das Ergebnis,
  weil die ersten Antworten den Erwartungsraum aufspannen. Gegenmaßnahme:
  **gepaartes Bracketing über Läufe** — der direkt folgende Lauf nimmt
  pro Elektrode jeweils das andere Vorzeichen. Nach zwei Läufen ist jede
  Elektrode aus beiden Richtungen angepeilt, der Bias mittelt sich
  heraus. Ab BA 104 kann der Startoffset enger gewählt werden (aus
  Vorlauf-Match ±25 cent oder Slider-Schätzung), statt pauschal ±100 cent.
  Das gepaarte Bracketing-Vorzeichen für Lauf 2 bleibt erhalten; in
  Lauf 1 mit Slider-Schätzung hängt der Bias-Schutz stärker am Folgelauf.
- **Stimulus-Spezifität** (Adel et al. 2019; Lazard et al. 2012): Pitch
  hängt vom akustischen Stimulustyp ab; reiner Sinuston vs.
  CI-Pulsstimulation klingt fundamental unterschiedlich. Wir verwenden
  als Default einen **harmonischen Komplexton** (Grundton + 4
  Harmonische), der näher am CI-Klang ist als ein reiner Sinus.
- **Pegelabhängigkeit** (Sagi & Svirsky 2021): Lautere Töne werden als
  höher wahrgenommen. Pegelkorrektur über `fmCorrGain` und vorgelagertes
  Loudness-Balancing minimieren das. Die Kompensation hängt von der
  Hardware-Kapazität ab (Lautsprecher-Headroom).
- **Plastizität** (Reiss et al. 2015; Pieper et al. 2022): Bei erfahrenen
  CI-Trägern paßt sich die Pitch-Wahrnehmung schon nach wenigen Monaten
  an die programmierten Frequenzbänder an. Der Test mißt die *aktuelle*
  Wahrnehmung, nicht eine objektive anatomische Wahrheit. Für ein
  Self-Balancing-Tool ist das das richtige Maß. Match-Werte können sich
  über Wochen und Monate verschieben und sollten bei größeren
  MAP-Änderungen neu gemessen werden. Der Anti-Überschreib-Dialog warnt
  automatisch bei Daten älter als 7 Tage.
- **Pitch-Match-Plastizität innerhalb einer Sitzung**: Pitch-Wahrnehmung
  kann sich auch kurzfristig verschieben (z. B. durch Aufmerksamkeit,
  Tagesform). Mehrere Läufe mit Median-Bildung fangen das auf.
- **Konvergenz-Schwelle 10 cent**: Sportlich; CI-Pitch-Match-Streuungen
  liegen in der Literatur oft bei 20–100 cent. Die abgestuften
  Qualitäts-Kategorien (`converged` / `-fair` / `-wide`) machen sichtbar,
  welche Elektroden die strenge Schwelle erreichen und welche nicht.

### Fundamentale Grenze der Methode

Es gibt **kein als zuverlässig anerkanntes Verfahren** zur
binauralen Frequenz-Mismatch-Bestimmung, das im Browser durchführbar
wäre. Pieper et al. 2022 (S. 11) schreiben wörtlich:

> „Overall pitch matching does not appear to be suitable to estimate the
> mismatch for the purpose of improving binaural hearing."

Pieper empfiehlt stattdessen CT-Bildgebung der Elektroden-Position oder
ITD-Sensitivitäts-Messungen — beides klinische Verfahren, die ein
Browser-Tool nicht leisten kann.

Jensen et al. 2021 vergleichen drei Pitch-Vergleichs-Methoden bei
bilateralen CI-Trägern (Discrimination, Ranking, Matching) und finden,
daß **Ranking** (binäre Suche über alle Elektroden) die methodisch
robusteste ist — Matching ist „second-best", aber mit kleinen, in der
Größenordnung tolerierbaren Bias-Effekten (Range-Slope 0,24;
Referenz-Slope 0,59; Startpunkt-Slope 0,11 — alle unter dem
Carlyon-Kriterium 0,5). Dieses Tool verwendet bewußt Matching, weil
nur Matching absolute Cent-Werte liefert, die für die
Frequenz-Korrekturkurve gebraucht werden; ein Ranking-Verfahren würde
nur eine relative Pitch-Reihenfolge ohne absolute Frequenz-Werte
erzeugen.

### Was die Messung kann — und was nicht

**Sie kann**: einen reproduzierbaren Anhaltspunkt liefern, in welche
Richtung und mit welcher Größenordnung die wahrgenommene Pitch-Zuordnung
einzelner Elektroden von der programmierten Frequenz-Allokation
abweicht. Sie ist genauer als die alleinige Method-of-Adjustment per
Slider und liefert mit `Residuum` und `Lauf-Streuung` Maße für die
eigene Zuverlässigkeit.

**Sie kann nicht** entscheiden, ob eine gemessene Korrektur am CI
tatsächlich zu besserem Sprachverstehen oder angenehmerem Klang führt.
Die endgültige Bewertung muß durch **eigenes Hören** erfolgen — im
Player dieses Tools (Sprachdatensätze und Musik mit und ohne Korrektur),
in einem vom Audiologen eingestellten Frequenz-Experimentier-Programm,
und vor allem im Alltag. Das CI-Sound-Balancing-Tool stellt die
Werkzeuge dafür bereit; die Entscheidung über die richtige Korrektur
liegt beim User und seinem Audiologen.

### Quellen

- **Adel, Y., Nagel, S., Weissgerber, T., Baumann, U., & Macherey, O.
  (2019).** Pitch matching in cochlear implant users with single-sided
  deafness: Effects of electrode position and acoustic stimulus type.
  *Frontiers in Neuroscience, 13*, 1119.
- **Carlyon, R. P., Macherey, O., Frijns, J. H., Axon, P. R., Kalkman,
  R. K., Boyle, P., … Dauman, R. (2010).** Pitch comparisons between
  electrical stimulation of a cochlear implant and acoustic stimuli
  presented to a normal-hearing contralateral ear. *Journal of the
  Association for Research in Otolaryngology, 11*(4), 625–640.
- **Jensen, K. K., Cosentino, S., Bernstein, J. G. W., Stakhovskaya,
  O. A., & Goupell, M. J. (2021).** A comparison of place-pitch-based
  interaural electrode matching methods for bilateral cochlear-implant
  users. *Trends in Hearing, 25*, 1–21.
- **Lazard, D. S., Marozeau, J., & McDermott, H. J. (2012).** The sound
  sensation of apical electric stimulation in cochlear implant recipients
  with contralateral residual hearing. *PLoS One, 7*(6), e38687.
- **Levitt, H. (1971).** Transformed up-down methods in psychoacoustics.
  *Journal of the Acoustical Society of America, 49*(2), 467–477.
- **Pieper, S. H., Hamze, N., Brill, S., Hochmuth, S., Exter, M., Polak,
  M., … Dietz, M. (2022).** Considerations for fitting cochlear implants
  bimodally and to the single-sided deaf. *Trends in Hearing, 26*, 1–25.
- **Reiss, L. A., Ito, R. A., Eggleston, J. L., Liao, S., Becker, J. J.,
  Lakin, C. E., … McMenomey, S. O. (2015).** Pitch adaptation patterns
  in bimodal cochlear implant users: Over time and after experience.
  *Ear and Hearing, 36*(2), e23–e34.
- **Sagi, E., & Svirsky, M. A. (2021).** A possible level correction to
  the cochlear frequency-to-place map: Implications for cochlear
  implants. *20th Conference on Implantable Auditory Prosthesis, Lake
  Tahoe, CA.*
- **Schatzer, R., Vermeire, K., Visser, D., Krenmayr, A., Kals, M.,
  Voormolen, M., … Zierhofer, C. (2014).** Electric-acoustic pitch
  comparisons in single-sided-deaf cochlear implant users: Frequency-place
  functions and rate pitch. *Hearing Research, 309*, 26–35.

Pieper und Jensen liegen vollständig im Ordner `.manuals/` vor; die
übrigen Quellen sind über die genannten DOIs/Journals zugänglich.
