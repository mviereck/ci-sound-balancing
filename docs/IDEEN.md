# Ideen und Konzept-Skizzen

Sammelstelle für Erweiterungs- und Designideen, die **noch nicht
gebaut werden sollen**, aber bei zukünftigen Builds berücksichtigt
werden könnten. Abgrenzung:

- **SPEC.md „Offene Punkte"**: Punkte, die konzeptionell abgesegnet
  sind und auf Umsetzung warten. Knapp gehalten.
- **IDEEN.md (diese Datei)**: Punkte, die noch nicht abgesegnet sind,
  bei denen Design-Fragen offen sind, oder die Auswirkungen auf
  zukünftige Architektur-Entscheidungen haben könnten.

Ein Eintrag in IDEEN.md ist erst dann zur Umsetzung reif, wenn er
besprochen und entweder verworfen oder in SPEC.md („Warteliste" oder
direkt in die Feature-Sektion) übernommen wurde.

> **Wartung dieser Datei**: bei jeder neuen Idee, die nicht sofort
> umgesetzt wird, hier einen Eintrag anlegen. Wenn ein Eintrag
> umgesetzt oder verworfen wird: aus dieser Datei entfernen (mit
> Datum und Verweis auf die Umsetzung im Commit).

---

## Levels-Tab — Einheiten-Umschaltung in der Anzeige

**Aufgenommen am**: 2026-05-15
**Status**: nicht gebaut. Modus B (Absolutmodus) zeigt qu/CL/CU
bereits an, dB-Korrekturwerte sind primär in der Anzeige.

**Idee**: Reine Anzeige-Variante, in der die Y-Achsen-Beschriftung
und die Werte oben am Balken **wahlweise** in dB oder in
herstellerspezifischen Einheiten dargestellt werden — unabhängig
vom Modus A/B. Aktuell ist die Achseneinheit an den Modus gekoppelt
(Modus A: dB, Modus B: qu/CL/CU). Eine entkoppelte Anzeige würde
ermöglichen:

- Modus A mit qu-Beschriftung der Y-Achse (relative qu-Korrekturen).
- Modus B mit dB-Beschriftung der Y-Achse als Vergleichshilfe für
  den User, der in dB denkt.

**Voraussetzung**: keine — Umrechnung steckt schon in `core.js`.

**UI-Skizze**: kleiner Einheiten-Toggle in der Toolbar, neben dem
Modus-Toggle. Default: passt zur Modus-Wahl wie bisher.

**Bemerkung**: möglicherweise unnötig, wenn die Anzeige oben am
Balken in beiden Einheiten gleichzeitig steht. Erst klären, ob das
Bedarf abdeckt, bevor diese Idee umgesetzt wird.

---

## Hersteller-Eintrag „Anderer Hersteller / Manuelle Angaben"

**Aufgenommen am**: 2026-05-18
**Status**: konzeptionell besprochen, nicht gebaut.

**Hintergrund**: Das Tool kennt aktuell drei Hersteller (MED-EL,
Cochlear, Advanced Bionics). Real existieren weitere Anbieter
(Nurotron in China, Listent/Lisound, Oticon Medical/Neurelec,
ehemalige Eigenentwicklungen in Rußland), außerdem ältere oder
aufgekaufte Modelle, deren Mapping-Daten nicht gepflegt werden
können. Ein generischer Slot soll diese Fälle nutzbar machen,
ohne für jeden Anbieter eigene Hersteller-Daten zu erfassen.

**Konzept**: Neuer Auswahlpunkt im Hersteller-Dropdown
(`implMfrSelect`) mit Label „Anderer Hersteller / Manuelle
Angaben". Bei Auswahl erscheint ein neuer Eingabe-Block.

**Pflichteingaben**:
- **Anzahl Elektroden** (`n`): hart zugelassen 1–40, mit Hinweis
  bei >24 („ungewöhnliche Anzahl, bitte prüfen").
- **FAT** (Frequenzzuordnungstabelle): genau `n` Einträge. Pro
  Elektrode entweder eine Hz-Angabe oder Markierung als
  „deaktiviert". Beides zählt als vollständiger Eintrag.
  Reihenfolge der Eingabe = Anzeigereihenfolge im Tool; eine
  Unterscheidung apikal/basal trifft das Tool nicht.

**Optionale Eingaben** (Freitext, nur für Druck verwendet, kein
Einfluß auf Funktionen):
- Hersteller-Name
- Implantat-Modell
- Audio-Prozessor-Modell

**Validierung der FAT** (Hinweise, **keine Sperre**, gelbes Banner
unter dem Block):
- Wert <50 Hz oder >10000 Hz → Hinweis
- Reihenfolge nicht monoton steigend oder fallend → Hinweis
- Doppelte Werte → Hinweis

**Vollständigkeits-Zustand**:
- Solange weniger als `n` Einträge gesetzt sind (Hz oder
  „deaktiviert"): roter, dauerhaft sichtbarer Warnhinweis unter
  der jeweiligen Seitenanzeige (LINKS/RECHTS) mit Text sinngemäß
  „FAT unvollständig — Ergebnisse nicht belastbar".
- Solange unvollständig: alle Tab-Tests (Stereo-Balance,
  LR-Balance, Frequency-Matching, Levels) für diese Seite
  **gesperrt**.

**Optional anbietbar — Default-Verteilung**: Knopf „Default
einfügen" mit logarithmisch verteilten Werten (z. B. 150 Hz bis
8000 Hz) passend zur eingetragenen Elektrodenzahl. User kann
nachbearbeiten. Klar als unverbindlicher Vorschlag kennzeichnen,
nicht stillschweigend einsetzen.

**Auswirkungen auf andere Funktionen**:
- **Levels-Tab**: nur dB-Modus. Absolutmodus (qu/CL/CU) für diese
  Seite deaktiviert.
- **MAPLAW-Simulation**: für diese Seite deaktiviert.
- **Druck**: Hersteller-Einheit-Spalte entfällt. Die freien
  Textangaben (Hersteller, Implantat, Prozessor) werden in den
  bestehenden Druck-Feldern angezeigt, sofern eingetragen.
- **Cochlear-Generation-Block**: entfällt.
- **Default-Frequenzraster-Dropdown** (`defaultMfrSelect`, aktiv
  wenn beide Seiten Non-CI sind): „Manuell" ist dort **nicht**
  wählbar — ohne reale Hersteller-Vorgabe gibt es keinen
  sinnvollen Default-Raster.
- **Bilateral mit Manuell + Non-CI**: das Non-CI-Ohr übernimmt
  die FAT des Manuell-Ohrs. Das erlaubt Vergleichbarkeit bei
  Tests wie Stereo-Balance.

**Persistenz**: pro Seite in `sideData`, serialisiert wie die
übrigen Implantat-Daten.

**Interne Repräsentation**: `apFirst` im `MFR`-Datensatz auf einen
festen Wert (z. B. `true`) — semantisch ohne Bedeutung, dient nur
der internen Aufzählung.

**Berührte Module** (grob, für spätere Bauanleitung):
- `core.js`: `MFR` um Eintrag erweitern, leere Listen für
  `IMPLANTS`/`PROCESSORS`, neuer Vollständigkeits-Helper.
- `ui-implant.js`: neuer Block für manuelle Eingabe (n + FAT-
  Tabelle + Textfelder), Show/Hide-Logik analog zu den anderen
  Herstellern.
- `levels-tab.js` / `levels.js`: Absolutmodus für „manual"
  ausblenden.
- `maplaw.js`: Sim deaktivieren.
- `print.js` / `tab-print.js`: Hersteller-Einheit-Spalte bedingt
  rendern, Freitext-Felder einbinden.
- `tabs-eq.js` / `state-side.js`: Tab-Lock-Check um FAT-
  Vollständigkeit erweitern.
- `i18n.js`: neue Strings (DE/EN/ES/FR).

**Bemerkung**: Größerer Eintrag als die übrigen IDEEN — berührt
Core-Datenmodell, mehrere Tabs, Druck und i18n. Vor Bau in eine
nummerierte Bauanleitung mit Akzeptanztest-Checkliste aufteilen,
ggf. zwei Anleitungen (Datenmodell + UI; dann
Tab-Sperren + Druck).

---

## Test-MAP zur Crosstalk-Reduktion bei Messungen

**Aufgenommen am**: 2026-05-19
**Status**: diskutiert, als Mittel zur Verbesserung der
Korrekturkurve **verworfen**. Als Diagnose-Idee offen.

**Ausgangsfrage**: Selbst wenn das Tool exakt die Mittenfrequenz
einer Elektrode anspielt, werden Nachbar-Elektroden über die
Filterbank-Flanken und die elektrische Feldausbreitung mit
angeregt. Ließe sich beim Audiologen eine separate **Test-MAP**
einrichten (eigener Programmplatz, z.B. P2), die diesen Crosstalk
minimiert, um Einzel-Elektroden präziser zu messen?

**Was eine solche Test-MAP MAP-seitig beeinflussen könnte**:
- MAPLAW deutlich niedriger (z.B. 500 statt 1000) → weniger
  Anhebung schwacher Filter-Schultern.
- Strategie HDCIS statt FSP/FS4 → reine Hüllkurve, näher am
  Lehrbuch-Modell, besser interpretierbar für Sinus-Töne.
- Maxima-/n-of-m-Einstellung, falls bei MED-EL klinisch zugänglich
  (unklar) → bei reinem Sinus feuert nur dominanter Kanal.
- THR/MCL bewusst NICHT ändern → sonst verschiebt sich die
  Lautstärkeskala und Sessions sind mit den bisherigen nicht mehr
  vergleichbar.

**Was eine Test-MAP NICHT auflöst**: die elektrische Feldausbreitung
in der Cochlea (bei MED-EL monopolar, breit). Restliche
Mitanregung von Nachbar-Nervenfasern bleibt physiologisch.

**Warum als Korrekturgrundlage verworfen — Selbst-Konsistenz-
Argument**: Die Tool-Korrektur wirkt als Pre-EQ *vor* dem CI. Boost
und Messung laufen durch dieselbe Filterbank, denselben MAPLAW,
dasselbe Feld. Eine Messung mit Alltags-MAP paßt zur Anwendung
mit Alltags-MAP. Eine Messung mit Test-MAP (geringerer Crosstalk)
würde Korrekturen produzieren, die im Alltagsbetrieb
**überkompensieren**, weil die Nachbarn dort mithelfen, was die
Test-MAP künstlich ausgeblendet hat. Analogie:
Lautsprecher-Einmessung im schalltoten Raum wirkt im Wohnzimmer
nicht.

**Konsequenz für die Korrekturkurve**: Die Alltags-MAP ist die
*richtige* Meßumgebung, nicht eine Notlösung. Eine vermeintlich
„präzisere" Einzel-Elektroden-Messung liefert keine präzisere
Korrektur, sondern eine Korrektur, die zur falschen MAP paßt.

**Restwert der Test-MAP — als Diagnose-Werkzeug**:
- Versteckte Defizite sichtbar machen: wenn E11 im Alltag nur
  leicht schwach wirkt, im Test aber klar einbricht, ist die
  Schwäche real und groß — Konsequenz wäre dann ein Gespräch mit
  dem Audiologen über T/C-Level dieser Elektrode, nicht eine
  größere Pre-EQ-Korrektur.
- Cross-Check zweier Kurven (Alltag + Test) parallel: Stellen mit
  starker Divergenz sind physiologisch interessant, Stellen mit
  Übereinstimmung sichern die Alltagskurve ab.
- „Wie wäre es ohne E12-Stummschaltung?" beantworten — separater
  Use-Case.

**Konsequenz fürs Tool**: aktuell keine. Das Tool mißt korrekt in
der Umgebung, in der die Korrektur später wirkt. Die natürliche
Glättung durch Crosstalk ist eine Eigenschaft des CI-Hörens, nicht
ein Meßfehler des Tools.

**Mögliche spätere Erweiterung** (eigenständige Idee, nicht zu
diesem Eintrag dazugehörig): einen Hinweistext in SPEC.md oder
Tool-Doku ergänzen, der erklärt, daß die Kurve die *Wahrnehmung
im Alltagsbetrieb* abbildet und damit eine natürliche Glättung
durch CI-interne Mitanregung enthält — also keine reine
„Einzel-Elektroden-Diagnose" ist. Erst bei Bedarf einbauen.

---

## MAPLAW-Filterbank an Implantat-Frequenzen statt MED-EL-Standard

**Aufgenommen am**: 2026-05-25
**Status**: konzeptionell besprochen, vertagt mangels akutem
Bedarf.

**Hintergrund**: Die MAPLAW-Simulation in `js/maplaw.js` arbeitet
mit einer Filterbank aus 12 Biquad-Bandpässen, deren
Mittenfrequenzen als Konstante `MAPLAW_FREQS` hartcodiert sind
(`[120, 235, 384, 579, 836, 1175, 1624, 2222, 3019, 4084, 5507,
7410]`). Diese entsprechen dem MED-EL-Standardraster. Trägt der
User abweichende Implantat-Frequenzen (`elFreqOwn`) ein, läuft
die Filterbank auf den falschen Mittenfrequenzen — bei Q=4
äußert sich das in subtiler Unter-Korrektur einzelner Bänder
(realistische Größenordnung: Bandbreite ~250 Hz bei 1 kHz, 50 Hz
Versatz ≈ 20 % Bandbreiten-Fehler → wahrnehmbar, aber nicht
dramatisch).

**Konzept**: Filterbank-Frequenzen dynamisch aus dem
Implantat-State (`effFreq(i)` bzw. `elFreqOwn[i]`) der aktiven
Seite ableiten, statt Konstante. Bei Wechsel von Side oder
Implantat-Eintrag neue Koeffizienten an den Worklet schicken
(`postMessage` oder `AudioParam`-Bündel). Der Worklet-Code in
`_MAPLAW_PROCESSOR_CODE` muß so umgebaut werden, daß die
Filterkoeffizienten dynamisch berechenbar sind statt im
Konstruktor einmalig.

**Wichtig — Warp ist orthogonal**: Frequenz-Warping verändert
die Filterbank-Frequenzen **nicht**. Die MAPLAW-Sim emuliert
die CI-interne Verarbeitung, die auf den physisch festen
Elektroden-Frequenzen sitzt. Das (vorab gewarpte) Audio läuft
durch die statische Filterbank, die Hüllkurven entstehen
automatisch auf den verschobenen Spektren — genau wie im echten
CI.

**Voraussetzung**: keine.

**Aufwand-Einschätzung**: mittlerer Umbau. Der Worklet-Code muß
Frequenzparameter empfangen können (heute hartcodiert in der
`constructor`-Schleife). Hauptthread muß bei `setActiveSide`,
`switchMfr` und Implantat-Eingaben den Worklet neu
parametrisieren.

**Bemerkung**: Solange der User MED-EL-Standardfrequenzen nutzt
(üblicher Fall), bleibt das Verhalten identisch. Erst bei
abweichenden FATs (z. B. user-spezifische Anpassung oder „Anderer
Hersteller / Manuelle Angaben" aus dem Eintrag oben) wird der
Umbau relevant. Daher: in dem Moment angehen, in dem entweder
ein konkreter Nutzer-Bedarf entsteht oder der manuelle
Hersteller-Slot gebaut wird.

---

## Zweiter Schieber-Tab: Frequenz-Warping pro Elektrode

**Aufgenommen am**: 2026-05-25
**Status**: konzeptionell skizziert, nicht gebaut.

**Hintergrund**: Frequenz-Warping wird aktuell nur als globale
Verschiebung aus den Frequenzabgleich-Daten abgeleitet
(`buildWarpPoints` in `freq-warp.js`). Es gibt keine
Möglichkeit, die Cent-Verschiebung pro Elektrode manuell
einzustellen — etwa zum experimentellen Vergleich, zum
Feinjustieren über die Freqmatch-Vorgabe hinaus oder als
Alternative für Nutzer, die den Freqmatch-Test nicht
durchgeführt haben.

**Konzept**: Ein zweiter Schieber-Tab (Beschriftung etwa
„Frequenz-Schieber"), analog zum bestehenden dB-Schieber, mit
einem Schieber pro Elektrode für eine Cent-Verschiebung. Die
Werte werden als weitere Warp-Punkt-Quelle in
`buildWarpPoints` eingespeist und mit den
Freqmatch-abgeleiteten Punkten kombiniert (Reihenfolge, ob
ersetzend oder additiv, ist offen).

**Offene Design-Fragen**:
- Eigener Tab oder Modus-Umschalter im bestehenden Schieber-Tab?
- Verhältnis zu den Freqmatch-Daten: ersetzen, additiv addieren,
  XOR mit Wahl?
- Wertebereich pro Elektrode (z. B. ±600 ¢) und Schrittweite.
- Sollen die manuellen Werte ebenfalls als Stützpunkte in das
  Warping eingehen, oder unabhängig?

**Berührte Module** (grob):
- neue Datei `js/freq-shift-tab.js` oder Erweiterung
  `levels-tab.js`.
- `state-side.js`: neuer State `elFreqShift` pro Seite,
  Persistenz wie `manualLevels`.
- `freq-warp.js`: `buildWarpPoints` um manuelle Stützpunkte
  erweitern.
- `file.js`: Save/Load.
- `index.html` + Tab-Verdrahtung.

**Bemerkung**: Erst sinnvoll, wenn Frequenz-Warping als Feature
genug Nutzer-Feedback erfahren hat, daß ein manueller Override
als spürbare Verbesserung erscheint. Bis dahin reicht die
automatische Ableitung aus Freqmatch.

---

## Frequenzabgleich — Konvergenz-Modus (zweiter Test-Modus)

**Aufgenommen am**: 2026-05-26
**Status**: konzeptionell abgesegnet, Bauanleitungen aufgeschoben
bis zur Klärung der E10/E11-Klassifikations-Auffälligkeit (siehe
unten).

**Problem, das gelöst werden soll**
Nach einem vollständigen adaptiven Lauf zerstört ein Neustart aktuell
alle Track-Daten (`fmTracks = {}` in `js/freqmatch.js`, Z. 427).
Reversals, Residuum, trialHistory, catchErrors gehen verloren; nur
der grobe Match-Wert überlebt indirekt über `fmPrevCent`. Bei hoher
Hörgenauigkeit (Martins Größenordnung: 50% < 1 ct, 100% < 2 ct
Residuum) ist das verschenkte Information.

**Idee**: zwei Test-Modi statt einem

- **Adaptive** (bisherig): erstmalige Vermessung mit großem
  Suchbereich (±100 ct um 0).
- **Konvergenz** (neu): Verfeinerungs-Modus, der gezielt unsichere
  Werte nachmisst, beliebig wiederholbar.

Sperrlogik im `modeSelect`:
- Solange Adaptive nicht vollständig: Konvergenz ausgegraut.
- Sobald Adaptive vollständig: Adaptive ausgegraut, Konvergenz wird
  Default.
- `slider` (manueller Modus) bleibt unabhängig wählbar.

**Auswahl der Elektroden im Konvergenz-Lauf (Hybrid c)**

Auswahl-Grid mit Checkbox pro Elektrode, zeigt aktuellen Match und
aktuelles Residuum. Vorbelegung automatisch:
- ausgewählt: Tracks mit `residual > FM_RESIDUAL_OK` (= 10 ct)
  oder `status === 'converged-noisy'`
- nicht ausgewählt, aber wählbar: `converged` (saubere Werte) und
  `not-perceivable` (Nutzer kann manuell erneut probieren — bei
  erneutem Konvergenz-Test wird Track wieder `active` und neu
  klassifiziert)
- Markierung `chronicNoisy` (siehe unten): nicht vorgewählt, grau,
  Tooltip.

**Datenfortschreibung — kumulativ, klein starten**

Beim Start eines Konvergenz-Laufs werden ausgewählte Tracks wieder
auf `status: 'active'` gesetzt. Reversals, trialHistory, trialCount,
catchTotal, catchErrors bleiben erhalten und werden fortgeschrieben.
`stepSize` startet nicht bei `FM_STEP_SEQUENCE[0]`, sondern beim
vorletzten Element (Match ist grob bekannt → fein anfangen, sonst
zerstreut die Staircase die schon erreichte Genauigkeit). Residuum
schrumpft kumulativ mit mehr Reversals.

**chronicNoisy-Flag — 10%-Schwelle**

Vor jedem Konvergenz-Lauf für jeden ausgewählten Track ein Residuum-
Snapshot ablegen. Nach Lauf-Ende vergleichen:
- Verbesserung = `(residualVor - residualNach) / residualVor`
- Wenn `Verbesserung < 0.10` (10%): Lauf-Zähler `noImprovementRuns++`.
- Wenn `noImprovementRuns >= 2`: `track.chronicNoisy = true`.
- Bei jeder echten Verbesserung (≥ 10%): Zähler zurück auf 0.

Wichtig: feste cent-Schwellen wären falsch — Martins eigene
Unterscheidungsschwelle ist nicht bekannt. Prozentuale Schwelle
skaliert mit dem aktuellen Datenstand.

**Hinweis-Banner — Formulierung steht fest**

Sobald alle ausgewählten Tracks (außer bereits-chronicNoisy) das Flag
neu bekommen, im Test-Panel:

> „Auch bei wiederholter Messung werden die Ergebnisse nicht weiter
> verbessert. Ende des Konvergenztests empfohlen, oder andere
> Elektroden auswählen."

(NICHT: „bleiben unsicher" — falsche Formulierung, kann auch im gut
konvergierten Bereich greifen.)

**Konvergenz hat kein automatisches Ende**

Stop-Knopf bleibt jederzeit aktiv, Nutzer entscheidet. Kein
automatisches „Konvergenz erreicht, weitermachen optional"-Signal.

**Neu aktivierte Elektrode auf var-Seite — Variante α**

Wenn eine vorher inaktive Elektrode nach Adaptive-Abschluss
aktiviert wird:
- Kein separater Mini-Adaptive-Lauf (würde denselben Ton 20+ mal
  hintereinander spielen → Gewöhnung, Bias).
- Stattdessen: frischer Track ohne Vorwert (Startbereich ±100 ct)
  geht in die Vorbelegung des nächsten Konvergenz-Laufs.
- Round-Robin sorgt automatisch für Tonvariation mit anderen
  ausgewählten Elektroden.
- Hinweis im Grid: „Für Elektrode X liegt kein Vorwert vor — wird
  neu vermessen. Bitte mehrere andere Elektroden zur Variation
  mitwählen."
- Adaptive-Modus bleibt gesperrt.

Deaktivieren einer Elektrode auf var-Seite verwirft **keine**
Track-Daten — nur die Auswertung ignoriert sie. Reaktivierung bringt
die alten Daten zurück.

**Reset-Weg**

Existiert bereits über den Löschen-Button im Reiter Meßergebnisse
(Commit 8b3a068). Kein separater Reset-Knopf im Frequenzabgleich-Tab
nötig.

**Aufteilung in Bauanleitungen**

- **87** — Persistenz-Fix (gebaut 2026-05-26): Auto-Save, Datei-Save,
  not-perceivable-Null-Bug. Voraussetzung für alle folgenden.
- **88** — Konvergenz-Modus Grundgerüst: `modeSelect` erweitern,
  Sperrlogik, Auswahl-Grid (Hybrid c), kumulative Datenfortschreibung,
  i18n DE.
- **89** — chronicNoisy-Flag mit 10%-Schwelle, Hinweis-Banner,
  Grid-Markierung.
- **90** — neu aktivierte Elektrode im Konvergenz-Pool, Tonvariation-
  Warnung, Persistenz bei Deaktivieren.
- **offen** — eventuelle Klassifikations-Korrektur (E10/E11, nach
  Diagnose-Lauf mit BA-87-Fixed-Version).

**Offener Punkt — Klassifikations-Auffälligkeit E10/E11**

Beim ersten ernsthaften vollständigen Lauf (2026-05-26) wurde E11
(stark verrauscht, links faktisch unhörbar) als sauber konvergiert
ausgewiesen, während E10 (halb verrauscht, auf dem Restgehör-Ohr
etwas hörbar) als `not-perceivable` klassifiziert wurde — erwartet
wäre umgekehrt. Verdacht: `not-perceivable` greift bei hoher Catch-
Fehlerrate (≥ 0.5) auch dort, wo die Elektrode wahrnehmbar ist,
die Tonhöhen-Unterscheidung aber nicht zuverlässig. Das ist
konzeptionell ein anderer Zustand („wahrnehmbar, aber nicht
unterscheidbar") und müsste evtl. eine eigene Klassifikation
bekommen, bevor das Auswahl-Grid in Anleitung 87 Defaults aus diesen
Status-Werten zieht.

Diagnose-Schritt vor Build: Track-State aus dem aktuellen Lauf
ansehen — `catchTotal`, `catchErrors`, `reversals.length`,
`trialCount` für E10 und E11. Konsolen-Befehl:

```
console.log(JSON.stringify(
  sideData.right.freqmatchAdaptive.tracks[10], null, 2));
console.log(JSON.stringify(
  sideData.right.freqmatchAdaptive.tracks[11], null, 2));
```

(Seite `right` annehmen, weil CI rechts ist und damit `varSide`;
ggf. anpassen.)
