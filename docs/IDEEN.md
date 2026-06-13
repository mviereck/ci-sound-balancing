# Ideen und Konzept-Skizzen

> **Bekannte Bugs in 3.0.110-beta**: Slider-Verfahren im Frequenzabgleich
> ist in dieser Version buggy (Testverfahren-Bugs, nicht Teil von BA 110).
> Fixes folgen in BA 111.

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

**Status (2026-05-26)**: BA 88–90 wurden statt dessen für den
**Zweiten Staircase-Lauf** verwendet (ein zweiter vollständiger Lauf
liefert das gleiche Reliabilitäts- und Verfeinerungsziel mit deutlich
weniger Implementierungsaufwand). Der Konvergenz-Modus bleibt als
langfristige Idee erhalten, ist aber vorerst nicht geplant. BA-Nummern
91+ stehen für eine eventuelle spätere Umsetzung zur Verfügung.

---

## Frequenzabgleich — Slider-Wirkung als funktionale Erweiterung

**Aufgenommen am**: 2026-05-29
**Status**: konzeptionell besprochen, nicht gebaut. Im UI als
deaktivierte Auswahl vorbereitet (siehe
[spec/00-testui-architektur.md](spec/00-testui-architektur.md),
Bausteine-Katalog `sliderTarget` und Beispiel-cfg Freqmatch).

**Hintergrund**: Aktuell wirkt der Korrektur-Gain im Frequenzabgleich
symmetrisch auf beide Seiten (`getRawBalanceGains()` in `audio.js`).
Eine Wahl, ob die Frequenzverschiebung nur die Referenzseite, nur die
Zielseite oder symmetrisch (Balance) angewendet wird, gibt es nicht.

**Idee**: Ein Auswahl-Element `sliderTarget` im Test-Header mit drei
Optionen — Referenzseite / Zielseite / Balance. Default
**Referenzseite**. Die Wahl ist Voreinstellung und gilt für alle
Verfahren des Sub-Reiters; sie verändert nicht die Mechanik der
Verfahren, sondern nur, wohin der berechnete Cent-Versatz im Audio-Pfad
appliziert wird.

**Default-Logik**:
- Wenn nur eine Seite als CI markiert ist und die andere als
  natürlich hörend: das natürlich hörende Ohr wird automatisch
  Referenzseite (kein Cent-Versatz möglich, weil keine Filterbank).
  Default `ref` ist hier zwingend.
- Bei beidseitiger CI-Versorgung: Default bleibt `ref`, `balance`
  ist optional sinnvoll (siehe Iterations-Punkt unten).

**Hinweistexte**:
- Bei einseitig-CI: kurzer erklärender Hinweis neben dem Selector,
  warum die naturhörende Seite als Referenz fest ist.
- Bei beidseitig-CI mit `balance`-Wahl: Warnhinweis im Test-Panel
  (siehe Iterations-Problematik unten).

**Iterations-Problematik bei beidseitig-CI mit balance-Wahl**

Wenn beide Seiten CI sind und der Versatz symmetrisch auf beide
appliziert wird, gilt: jede Frequenzverschiebung an einer Elektrode
zieht Nachbarelektroden über die Filterbank-Flanken und das
elektrische Feld mit. Diese Nachbarelektroden sind ihrerseits
typischerweise unkalibriert — ihre Tonhöhen-Wahrnehmung ist
unbekannt und liegt mit hoher Wahrscheinlichkeit auch nicht „richtig".
Eine Messung mit beidseitiger Anpassung kann strukturell keine
sichere Einzel-Antwort liefern: die Referenz, gegen die gemessen wird,
verschiebt sich selbst mit jeder Anpassung.

Konsequenz: bei beidseitiger CI ist die Annäherung an tatsächliche
Tonhöhen-Gleichheit ein **iterativer Prozeß** — Test → Audiologen-
Anpassung der MAP → erneuter Test → erneute Anpassung, bis die
Verschiebungen klein genug werden, daß weitere Iterationen nichts mehr
ändern. Das Tool kann diesen Prozeß unterstützen, aber nicht in einem
Lauf zur Konvergenz bringen.

**Empfohlener Hinweistext** (sinngemäß, finale Formulierung beim Bau):

> „Beidseitige Versorgung erkannt. Bei symmetrischer Anwendung der
> Frequenzkorrektur (Balance) werden Nachbarelektroden mit verschoben,
> deren eigene Wahrnehmung typischerweise nicht kalibriert ist. Eine
> einzelne Messung kann hier keine endgültige Antwort liefern —
> mehrere Iterationen mit Audiologen-Anpassung sind nötig."

Dieser Hinweis erscheint bei beidseitiger CI-Markierung im Implantat-
Reiter, **unabhängig** von der aktuellen `sliderTarget`-Wahl —
auch bei `ref` und `var`, weil der User die Wahl ja umstellen kann.

**Voraussetzung**: Schritt 1 und 2 der Test-UI-Architektur-Migration
(siehe spec/00-testui-architektur.md). In Schritt 2 wird `sliderTarget`
bereits als `disabled: true` ins UI gebaut, sodaß diese Erweiterung
nur den Selector aktiviert und die Audio-Logik anpaßt; UI-Layout
muß nicht mehr geändert werden.

**Berührte Module** (grob):
- `audio.js` / `getRawBalanceGains`: muß sliderTarget-bewußt werden,
  oder neue Funktion `getFreqmatchTargetGains(target)` mit
  asymmetrischer Verteilung
- `freqmatch.js`: Audio-Pfad ruft target-bewußte Funktion
- `state-side.js`: Persistenz der Wahl pro Seite (eventuell, oder
  global)
- `test-ui.js`: Selector aktivieren (`disabled: false`), Auto-Default
  bei einseitig-CI, Hinweistext-Logik bei beidseitig-CI
- `i18n.js` + Sprachdaten: neue Strings

**Bemerkung**: Vor Umsetzung klären, ob die Wahl pro Seite gespeichert
wird (linkes Ohr als var, rechtes als var — eventuell unterschiedliche
Wahl) oder global. Heutige Symmetrie spricht für global, der
Personalisierungs-Gedanke spricht für pro Seite.

---

## Frequenzabgleich — Verhaltenssignale für Unsicherheit

**Aufgenommen am**: 2026-05-26
**Status**: Idee, nicht gebaut.

Zwei Verhaltenssignale, die ergänzend zur Catch-Statistik die
Qualität einer Messung einschätzen:

**1. Replay-Zähler pro Trial**

Anzahl der Wiedergaben vor einer Antwort erfassen. Auswertung:
- Hoher Replay-Schnitt in der Endphase (Trials bei Minimalschritt-
  weite): positives Zeichen — Nutzer ist an seiner Wahrnehmungsgrenze,
  die Messung ist echt.
- Niedriger Replay-Schnitt + zufällige Antworten: Warnsignal (raten
  ohne nachzuhören).
- Kombination Catch-Fehlerrate + Replay-Schnitt = stärkerer
  Qualitätsindikator als beide allein.

Replay-Lücke > 5 Sekunden gilt als Pause (Ablenkung) und wird nicht
als Replay gewertet.

**2. Reaktionszeit pro Trial**

Kurze Reaktionszeit nach Ton-Ende = hohe Entscheidungssicherheit.
Lange Reaktionszeit = ambivalent (Pause, Ablenkung, echte Unsicher-
heit nicht unterscheidbar). Deshalb: nur kurze Reaktionszeiten als
positives Qualitätssignal verwenden, lange Zeiten ignorieren.

**Hinweis-Text vor dem adaptiven Test**:

> „Wenn Sie unsicher sind, spielen Sie die Töne so oft ab wie nötig.
> Wenn Sie sich auch dann nicht entscheiden können: Wählen Sie, ob
> der zweite Ton sich höher oder tiefer anfühlt — auch ein Gefühl
> zählt."

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

## Player — dynamisch erzeugter Hintergrundlärm zu Sätzen

Für das Test-Szenario „Sätze im Hintergrund-Geräusch" (siehe geplante
BA 194) ist als Einstieg vorgesehen, dass ein einzelnes Geräusch aus
dem Katalog hinter den Satz gemischt wird. Längerfristig denkbar ist
ein dynamischer Cocktail-Generator, der den Hintergrund pro Sitzung
nicht aus einer einzelnen Loop, sondern aus mehreren parallelen
Quellen frisch zusammensetzt:

- Mehrere Satz-Audios aus dem Common-Voice-Pool (oder anderen
  Sprecher-Quellen) gleichzeitig leise abspielen, auf unterschiedlichen
  Stereo-Positionen und mit leicht versetzten Startpunkten →
  realistischer Sprach-Hintergrund, der nie identisch wiederkehrt.
- Dazu 1–2 Alltagsgeräusche aus der Geräusch-Bibliothek (Regen,
  Maschinenlärm, Café), per User-Auswahl oder Zufall.
- Mix-Verhältnisse separat steuerbar (Sprach-Hintergrund-Anteil vs.
  Alltagsgeräusch-Anteil vs. SNR zum Vordergrund-Satz).

Audiologisch interessant, weil typische Hörtests den Hintergrund
oft als eintönige Loop liefern und der CI-Träger sich daran
gewöhnt — ein dynamisch wechselnder Hintergrund wäre näher an der
Real-Welt-Café-Situation.

Implementierungs-Skizze: pro Satz wird im Offline-AudioContext ein
neuer Hintergrund-Buffer aus mehreren parallelen Sources gerendert
(billig — wenige hundert Millisekunden CPU), dann mit dem Vordergrund-
Satz pre-gemischt und durch die Player-Pipeline geschoben. Reuse-Logik
für gleiche Sitzungs-Parameter optional.

**Offene Fragen:**
- Wieviele parallele Sprach-Sources sind realistisch hörbar — drei,
  fünf, zehn?
- Pegel-Balance: alle parallelen Sources gleich laut oder mit
  zufälligem Volumen-Jitter?
- Speicher-Footprint: pro Sitzung mehrere Vorlauf-Buffer im RAM
  halten oder bei Bedarf neu rendern?

## Frequenzabgleich-Adaptiv — Resume-Pfad bei veränderter Elektroden-Konfiguration

**Aufgenommen am**: 2026-06-04
**Status**: bekannte strukturelle Schwäche; durch BA 205 nicht
mehr über die UI erreichbar, aber im Code weiterhin vorhanden.

**Hintergrund:** Wird ein adaptiver Lauf per Stop pausiert, ruft
`fmAbort` (`js/freqmatch.js`) zwar `_fmPersist()`, aber **nicht**
`_fmMarkCompleted()`. Der Lauf-Eintrag bleibt mit `completedAt = null`
und `currentRunIdx` zeigt weiter auf ihn. Beim nächsten Klick auf
„Test fortsetzen" prüft `_fmTryRestore` u. a., ob die gespeicherte
`electrodeIdxList` mit der jetzt aufgebauten übereinstimmt. Tut
sie das nicht (Elektroden-Konfiguration zwischendurch verändert),
schlägt Restore fehl. Im Folge-`_fmPersist` greift der Else-Zweig
(`run.tracks = fmTracks; run.roundQueue = …`) und **überschreibt**
die `tracks` des alten Lauf-Eintrags mit den frischen, leeren
Tracks der neuen Konfiguration. Die ursprünglichen Trial-Daten
gehen verloren; `run.electrodeIdxList` bleibt aber die alte —
der Lauf-Eintrag ist in sich inkonsistent und jeder weitere
Resume-Versuch resettet ihn erneut.

**Wirkung in der UI:** vor BA 205 konnte ein Implantat-Edit
(Ausschluß, Deaktivieren, Mute) den Pfad triggern. Nach BA 205
sind diese drei Bedienungen gesperrt, solange adaptive Trials
vorliegen — der Pfad ist über reguläre Bedienung nicht mehr
erreichbar.

**Restrisiken:**
- Andere Pfade, die `elActive` oder `elExDur` ändern, ohne dep-lock
  zu konsultieren: roter Ausschluß-Knopf **während laufendem
  Adaptiv-Test** (`_fmRequestExcl` in `js/freqmatch.js`) setzt
  `elExDur` direkt; ob die laufende Staircase damit konsistent
  weiterläuft, ist nicht geklärt.
- JSON-Load mit alter Elektroden-Konfiguration ggü. heutiger
  Hersteller-/Konfig-Einstellung (selten, aber möglich).
- Manuelle State-Manipulation über DevTools.

**Lösungsrichtung (Skizze, nicht abgesegnet):**
1. `fmAbort` markiert den Lauf bei echtem User-Abbruch mit
   `completedAt = Date.now()` und `abortReason = 'userStop'`,
   so daß `_fmPersist` zwingend einen neuen Lauf anlegt. „Test
   fortsetzen" entfällt damit oder müßte explizit als „neuen Lauf
   starten" relabelt werden.
2. Alternative: `_fmTryRestore`-Fehlschlag wegen
   Elektroden-Diff sauber erkennen → alten Lauf als
   `abortReason = 'configChanged'` schließen, neuen Lauf
   anlegen. Erfordert, daß `_fmPersist` einen zusätzlichen
   Pfad für „neuer Lauf, obwohl currentRunIdx auf inkonsistenten
   Run zeigt" bekommt.
3. Variante 1 wahrscheinlich einfacher; Variante 2 bewahrt den
   Resume-UX, ist aber mehr Code.

**Vor Umsetzung:** Pause/Resume-Semantik im Adaptiv-Modus
explizit besprechen. Aktuell ist „Stop" semantisch zwischen
„Pause" und „Abbruch" undefiniert.


## Frequenzabgleich — Stempel der Stimulus-Parameter pro Datenpunkt

Pieper (et al. 2022, S. 10) und die zitierten Quellen (Adel
et al. 2019; Lazard et al. 2012) machen klar: jeder Pitch-Match
ist stimulus-spezifisch. Zwei Datenpunkte derselben Elektrode,
gemessen mit verschiedenen Tonarten oder Tondauern, sind nicht
direkt vergleichbar.

Im Tool wird aktuell **nicht** gespeichert, mit welchen Stimulus-
Parametern ein Datenpunkt gemessen wurde. Der Druck zeigt den
*aktuellen* globalen `toneType_freqmatch`, nicht den zum
Meßzeitpunkt verwendeten.

**Idee**: pro Datenpunkt (Adaptiv-Track-Eintrag, Slider-Estimate)
einen Stempel mit `toneType`, `Tondauer`, `Pegel`, `Pause`
festhalten. Bei jedem Update auf den aktuellen Wert gesetzt;
keine Einfrierung pro Run, weil der Nutzer mitten in der Test-
Phase verschiedene Tonarten ausprobieren möchte.

**Druck-Auswirkung**: pro Datenpunkt Stempel zeigen, oder kompakt
nur dann hervorheben, wenn ein Datensatz **gemischte** Stempel
hat. Letzteres visuell ruhiger.

**Zurückgestellt**: zuerst werden grundsätzlichere Lösungen am
Stimulus-Problem gesucht (siehe CI-Vocoder-Idee, reichere Pitch-
Stimuli aus Sprache/Musik). Wenn am Ende klar ist, welche
Stimulus-Familie verwendet werden soll, ist der Stempel sinnvoll,
solange noch parallel mehrere Familien getestet werden.


## Frequenzabgleich — Keyboard-Verfahren als dritter Mess-Modus (smplr)

**Aufgenommen am**: 2026-06-07
**Status**: Konzept besprochen, nicht gebaut. Drittes Mess-Verfahren
im Sub-Tab Frequenzabgleich, parallel zu Slider Round (`freqmatch-
slider.js`) und Adaptiv 2I-2AFC (`freqmatch-staircase.js`). Offene
Detail-Punkte siehe unten.

### Motivation

Bekannter Zielkonflikt im Frequenzabgleich: reine Sinustöne sind
methodisch sauber, werden aber vom CI mit starken Artefakten verzerrt.
Musikalisch reiche Töne (Komplextöne, Instrumenten-Profile) klingen
am CI klarer, aktivieren aber durch Obertöne benachbarte Elektroden
mit (Spillover). Der aktuelle Default `pulsedComplex` ist ein
Kompromiß. Idee dieses Verfahrens: dem User über ein vertrautes
Klavier-Interface eine intuitive Methode geben, sich an die
Match-Frequenz heranzutasten, und dabei direkt ein **Konfidenz-
intervall** (Unter- und Obergrenze) statt nur eines Punktschätzers
zu liefern.

### Verfahrensablauf pro Elektrode

1. Tastatur im Klavier-Look (abstrakt umdefiniert, gleichmäßige
   schwarze Tasten überall — auch zwischen B/C und E/F; keine
   musikalische Notenzuordnung). Drei Marken zugleich auf den Tasten
   sichtbar: **Referenzton** (= Soll-Frequenz der Elektrode),
   **Untergrenze** (sobald gesetzt), **Obergrenze** (sobald gesetzt).
2. Drei Buttons im Test-Block:
   - **„Spielen"** (Tastenkürzel `Space`): spielt den festen
     Referenzton auf der CI-Seite.
   - **„Untergrenze hier"** (Tastenkürzel `U`): setzt die aktuell
     fokussierte Taste als Untergrenze.
   - **„Obergrenze hier"** (Tastenkürzel `O`): setzt die aktuell
     fokussierte Taste als Obergrenze.
3. Tastatur-Bedienung: Mausklick spielt die getroffene Taste als
   festen Burst (~500 ms) auf der **Referenzseite** und setzt den
   Fokus dorthin. Pfeiltasten `←`/`→` verschieben den Fokus eine
   Taste weiter und spielen sie ebenfalls als Burst. Fokus wird visuell
   hervorgehoben.
4. Drei Auflösungsstufen, per Buttons **„Feiner" / „Gröber"** pro
   Elektrode neu setzbar. Gesetzte Grenzen bleiben über
   Stufenwechsel hinweg erhalten (jede gröbere Position ist auch in
   der feineren Stufe darstellbar):
   - Stufe 1: weiße Tasten = Ganztöne (200 ct), schwarze = Halbtöne (100 ct)
   - Stufe 2: weiße = Halbtöne (100 ct), schwarze = Vierteltöne (50 ct)
   - Stufe 3: weiße = Vierteltöne (50 ct), schwarze = Achteltöne (25 ct)
5. Beendigung pro Elektrode entweder über **„Bestätigen"** (nur
   aktiv, wenn beide Grenzen gesetzt) oder **„Elektrode nicht
   hörbar"** → Status `not-perceivable`.
6. Elektroden-Reihenfolge: zufällig (wie Slider Round).
7. Pause/Resume: wie bei den anderen Verfahren, bisher gesetzte
   Grenzen persistieren.

### Tastatur-Spanne

Kompakt-Layout, etwa 2 Oktaven sichtbar, per Pfeil-Buttons oder
Drag horizontal verschiebbar. Referenzton-Taste beim Öffnen einer
neuen Elektrode in der Mitte zentriert.

### Stimulus und smplr-Integration

[smplr](https://github.com/danigb/smplr) wird als WebAudio-Sample-
Player integriert (analog `rubberband-loader.js` über `vendors/` und
einen eigenen Loader). Sample-Banken liegen auf dem Projekt-eigenen
Webspace (nicht GitHub Pages des smplr-Autors).

Die existierende Tonart-Auswahl `toneType_freqmatch` wird um
smplr-Instrumente erweitert (Mellotron, SplendidGrandPiano,
Soundfont-GM oder andere). Damit sind smplr-Klänge auch für Slider/
Adaptiv verfügbar. Im Keyboard-Verfahren spielen Referenzton (CI-
Seite) und Tastenton (Referenzseite) denselben Klang — Timbre-
Gleichheit zwischen beiden Ohren.

**Velocity** einmalig im Voreinstellungs-Block gewählt, während
der Messung fest (analog Verfahren-Einstellungen Tondauer/Pause).
**Detune** nicht angeboten — die Tasten sind die Quanten.

### Ergebnis-Speicherung

Pro Elektrode in `fRes[i]` ein neuer Eintrag-Typ:

```
{
  method: 'keyboard',
  centLower:  centOffset,   // Untergrenze relativ zu varFreq
  centUpper:  centOffset,   // Obergrenze
  cent:       (centLower + centUpper) / 2,   // Mittelwert für Korrekturkurve
  resolution: 1 | 2 | 3,                      // verwendete Endstufe
  status:     'keyboard-match' | 'not-perceivable' | 'aborted',
  varSide, refSide, varFreq, refFreq, timestamp,
  // Übergangsfeld für Chart-Aufrufer:
  fmResiduum: (centUpper - centLower) / 2     // halbe Spanne als Residuum
}
```

Im Frequenzabgleich-Diagramm: Soll-Punkt im Mittelwert, das Intervall
`[centLower, centUpper]` als gestrichelter Balken (optisch konsistent
mit dem Adaptiv-Residuum-Band). In der Ergebnis-Tabelle eigene
Badge-Variante (z. B. „🎹 Keyboard-Match").

### Verhältnis zu Slider Round und Adaptiv

Methodisch sortiert: Keyboard ist eine Variante von Method of
Adjustment, methodisch zwischen Slider Round (kontinuierlicher
Cent-Slider) und Adaptiv (2I-2AFC) einzuordnen. Vorteil gegenüber
Slider Round: direkt gemessenes Konfidenzintervall ohne mehrere
Läufe. Nachteil: Auflösung selbst in feinster Stufe (25 ct) gröber
als Slider (~5 ct) und Adaptiv (3 ct).

Pro Elektrode gilt: nur ein Verfahren liefert den `fRes`-Eintrag.
Die drei Verfahren sind über den Verfahren-Dropdown austauschbar;
beim Wechsel werden bestehende Ergebnisse pro Elektrode nicht
automatisch verworfen, aber der neue Verfahren-Eintrag überschreibt
den alten beim Bestätigen.

### Offene Punkte

- **Symmetrik-Modus (beidseitig CI)**: ungeklärt. Grundidee des
  symmetrischen Modus generell ist es, die Streuung auf Nachbar-
  elektroden zu halbieren, indem der Cent-Offset paarweise zur Hälfte
  auf jede Seite verteilt wird. Im Adaptiv geschieht das implizit pro
  Trial. Im Keyboard kollidiert das mit der Bedien-Logik „Ton spielt
  nur bei Anschlag" — eine automatische gegenläufige Bewegung beider
  Seiten ist nur sinnvoll, wenn pro Anschlag beide Seiten zugleich
  klingen, das aber widerspricht der Tasten-pro-Seite-Idee. Idee mit
  Pfeiltasten-Steuerung „Tasten aufeinander zubewegen" wirft das
  gleiche Problem auf.
  **Vorläufige Lösung für den ersten Wurf**: im 2-CI-Fall fester Wert
  für eine Seite (Referenz wie im var/ref-Schema, keine echte
  Symmetrik). Damit ist das Verfahren bedienbar; die Streuungs-
  Halbierung des Symmetrik-Modus entfällt im Keyboard. Echte
  Symmetrik-Variante bleibt offene Frage für spätere Iteration.
- **Sample-Loading-Strategie**: Bundle-Größe der smplr-Sample-Banken
  pro Instrument ist nicht trivial (vermutlich mehrere MB je
  Instrument). On-demand-Loading verzögert den ersten Tasten-
  Anschlag. Vor-Caching beim Tab-Öffnen oder beim Verfahren-Wechsel
  klären. Server-Speicher-Bedarf abschätzen.
- **Stimulus-Range**: Mellotron M400 deckt nur C2–F5 (~65–700 Hz)
  ab, MED-EL-Elektroden reichen bis ~8500 Hz. Smplr transponiert per
  Pitch-Shift, aber bei großen Verschiebungen wird der Klang
  artefaktreich. Für höhere Elektroden ggf. SplendidGrandPiano
  (bis 4 kHz) oder Soundfont-GM bevorzugen. Klärung: pro Elektrode
  automatisch das passende Instrument wählen, oder User entscheidet?
- **Initial-Fokus**: Beim Öffnen einer Elektrode steht der Fokus
  vermutlich auf der Referenzton-Taste — klären.
- **Tasten-Markierungen-Farben**: Referenzton, Untergrenze, Obergrenze
  brauchen jeweils eindeutige Farben (z. B. blau, hellrot, hellblau).
  Konkrete Wahl folgt in der BA.
- **Sitzungsdauer**: 12 Elektroden × 2 Annäherungen × ggf. 3 Stufen
  → realistisch 10–20 min pro Seite. UX-Tests klären, ob das
  praktikabel ist.

### Risiken und Trade-offs

- **Methodisch**: Method of Adjustment hat bekannte Bias-Quellen
  (Range/Startpunkt). Doppel-Annäherung von unten und oben ist
  klassischer Anti-Bias-Schritt, ersetzt aber kein randomisiertes
  2I-2AFC. Pieper et al. 2022 würde das Verfahren als gleichwertig
  zu Slider Round, klar schwächer als Adaptiv einstufen. Es ist also
  **methodisch keine Verbesserung gegenüber Adaptiv**, sondern eine
  intuitivere Alternative für User, denen das adaptive
  höher/tiefer-Schema nicht liegt.
- **Auflösung**: Feinste Stufe 25 ct ist für sehr genaue Hörer (z. B.
  Martin: 50 % < 1 dB beim Lautstärketest, vermutlich vergleichbar
  bei Pitch) gerade an der Wahrnehmungsgrenze. Für Anfänger sehr
  brauchbar.
- **smplr-Bundle**: externe Abhängigkeit, eigene Build- und Lade-
  Logik nötig.

### Vorgehen zur Umsetzung

In mehreren kleinen Bauanleitungen (Reihenfolge offen, Beispielzug):

1. smplr-Loader und Webspace-Sample-Bezug (analog rubberband-loader).
2. Tonart-Erweiterung: Mellotron/SplendidGrandPiano in
   `toneType_freqmatch` integrieren (auch für Slider/Adaptiv
   verfügbar).
3. Keyboard-Verfahren minimal: Tastatur-Komponente,
   Spiel-/Grenz-Buttons, Tastenkürzel, eine Auflösungsstufe.
4. Auflösungsstufen 2 und 3.
5. Ergebnis-Speicherung in `fRes` (`method: 'keyboard'`), Chart-
   Darstellung mit Intervall-Balken.
6. Spätere BA: Symmetrik-Modus für beidseitig CI, sofern sich das
   Verfahren bewährt.

Vor BA-Start: dieser Eintrag aus IDEEN.md in `docs/spec/02-messung.md`
(Abschnitt Sub-Tab 3) und ein neues Kapitel `docs/spec/02c-freqmatch-
keyboard.md` übernehmen.

---

## Sequenz-Refactoring — gemeinsame Token-Maschine für alle Mess-Tests

**Aufgenommen am**: 2026-06-13
**Status**: konzeptionell besprochen, nicht gebaut. Erster Baustein
(`pairGains`) ist mit BA 284 bereits gebaut. Restliches Refactoring
für einen frischen Opus-Chat vorgesehen.

**Hintergrund**: Beim Aufräumen der Slider-Symmetrie im Elektroden-
lautstärke-Test (BA 283–285) wurde sichtbar, dass die Tonwiedergabe
der Mess-Tests heute über **zwei getrennte Mechanismen** läuft, die
dasselbe tun sollen, aber auseinanderlaufen:

1. **Hartcodierte Test-Wiedergabe**: `playSeq` (Test 1, `js/audio.js`),
   die Sequenz in `js/lr-balance.js` (Test 2), `fmPlay…` /
   `fmPlaySimultaneous` (Test 3, `js/freqmatch.js` +
   `js/freqmatch-adaptive.js`). Jede schreibt ihre Tonfolge, Pegel,
   Pausen und das gleichzeitige Abspielen selbst aus.
2. **Token-basierte Modalbox-Vorschau**: `js/tone-popup.js` hat in
   `_playPreview` bereits eine **generische Abspiel-Maschine**, die eine
   **Token-Liste** im Format `{hz, pan, durationMs}` bzw. `{pauseMs}`
   abspielt. Jeder Test liefert die Liste über `getPreviewSequence()`.

Folge der Doppelung: Die Vorschau entspricht nicht dem echten Test.
Beispiel Test 1: `getPreviewSequence` spielt `1000 Hz` gegen `1000 Hz`
**ohne Slider-Offset**, während der echte Test die Elektroden-
frequenzen mit Pegelunterschied spielt. Außerdem driftete der
Gleichzeitig-Pfad in Test 1 über die Zeit von `playSeq` weg (Vorzeichen
und Deckelung), bis BA 283/284 das geradezogen haben — genau die Art
Fehler, die eine geteilte Funktion strukturell verhindert.

**Konzept**: Die hartcodierte Test-Wiedergabe durch **dieselbe Token-
Maschine** ersetzen, die die Modalbox schon nutzt. Dann gilt:

- **Pro Test eine Funktion** `…Sequence()`, die die Token-Liste für das
  aktuelle Paar liefert (echte Frequenzen, Pegel-Offset, Panning). Der
  *Inhalt* ist je Test verschieden (Test 1: zwei Elektroden, Pegel;
  Test 2: links/rechts, Pegel + Korrektur `corrL/corrR`; Test 3:
  Frequenz-Offset in cent statt Pegel) — deshalb **pro Test eigene**
  Funktion, **keine** einzige geteilte.
- **Eine gemeinsame Maschine** (auf `tone-popup`-/testUI-Ebene) spielt
  die Liste — einmal **nacheinander** (mit Pausen, ABA), einmal
  **gleichzeitig** (parallel). Das ist die allen Tests gemeinsame
  Bedien-Ebene: automatische Sequenz bei Messbeginn, Wiederhol-Sequenz
  per Leertaste, Gleichzeitig-Knopf.
- **Drei Aufrufstellen teilen sich die Maschine**: Messbeginn,
  Wiederholen (Leertaste), **und der Probehören-Knopf der Tonauswahl-
  Modalbox** (dort soll künftig die echte Testsequenz mit dem gewählten
  Ton laufen, nicht die vereinfachte Vorschau). Konsistenz wird damit
  strukturell garantiert statt disziplinabhängig.

**Was die gemeinsame Maschine dafür lernen muss** (testUI-API-Erweiterung,
gemäß Notausgang-Prinzip in `docs/spec/00-testui-architektur.md`):

- **Pegel/Offset pro Token** — heute kennt ein Token nur `hz/pan/dauer`;
  der Slider-Offset (Kernsignal Test 1/2) fehlt, deshalb klingt die
  Vorschau heute „flach". `pairGains` (BA 284, `js/audio.js`) ist der
  fertige Baustein für die Pegel-Aufteilung eines Paars und sollte hier
  wiederverwendet werden.
- **Gleichzeitig-Modus** — die jetzige `_playPreview`-Maschine spielt
  nur nacheinander (Timer-Kette); für „Gleichzeitig" muss sie dieselbe
  Liste parallel abspielen können.

**Klavier-Anspielen — bewusst entkoppelt** (im Chat entschieden):
Das Klavier in der Tonauswahl-Modalbox spielt **nicht** die Testsequenz,
sondern nur den **einen gedrückten Ton**, und zwar im **Halten-Modus**
(Ton klingt, solange die Taste gedrückt ist). Die Mechanik existiert
bereits in `js/sampler-keyboard.js` (`isHold = typeof opts.onRelease ===
'function'`, `down`/`up`-Handler) und wird vom Reiter Implantat genutzt
(`js/ui-implant.js`: `onPress` spielt langen Ton, `onRelease` ruft
`stopAll`). Die drei Mess-Tests liefern heute **kein** `onRelease` und
laufen daher im **Burst-Modus** (fester Anschlag). Sie sollen auf den
Halten-Modus umgestellt werden.

**Offener Teil-Punkt — Ausklang beim Loslassen**: Heute beendet das
Loslassen den Ton über `stopAll()`, das ist ein **harter Schnitt** ohne
Ausklang. Die globale Ausklang-Einstellung (`gToneEnvRelease`, Default
`"short"`, `js/audio.js`) wirkt nur beim **natürlichen** Tonende, nicht
beim Loslassen. „Ausklang beim Loslassen beachten" ist also eine kleine
**neue** Funktion (sanftes Stoppen mit Release-Phase statt `stopAll`),
von der der Implantat-Reiter gleich mitprofitieren würde.

**Berührte Module** (grob, für spätere Bauanleitungen):
- `js/audio.js`: `playSeq` auf Token-Maschine umstellen; `pairGains`
  wiederverwenden; sanftes Stoppen (Release) als Alternative zu
  `stopAll`.
- `js/tone-popup.js`: `_playPreview` zur allgemeinen Token-Maschine
  ausbauen (Pegel pro Token, Gleichzeitig-Modus).
- `js/test.js`, `js/lr-balance.js`, `js/freqmatch.js`,
  `js/freqmatch-adaptive.js`: je eine `…Sequence()`-Funktion, die die
  Token-Liste liefert; eigene hartcodierte Wiedergabe entfernen;
  Klavier auf Halten-Modus (`onRelease`).
- `js/sampler-keyboard.js`: ggf. Release mit Ausklang.
- `js/ui-implant.js`: Loslassen über sanftes Stoppen.
- `js/test-ui.js`: ggf. Hooks/Verdrahtung für die gemeinsame Maschine.

**Offene Design-Fragen**:
- Wie viel Mechanik wird in `tone-popup`/testUI gehoben, wie viel bleibt
  pro Test?
- Token-Format final: wie wird Test 3 (Frequenz-Offset in cent) sauber
  neben Test 1/2 (Pegel-Offset) abgebildet — gemeinsames Token mit
  optionalen Feldern, oder zwei Token-Varianten?
- Reihenfolge der BA-Aufteilung (vermutlich: Maschine + Token-Format
  zuerst, dann Test für Test migrieren, Klavier/Ausklang separat).

**Bemerkung**: Großer, vernetzter Umbau über ~6 Module — vor Bau in
mehrere kleine, nummerierte Bauanleitungen aufteilen. `pairGains`
(BA 284) ist der erste fertige Baustein. Beim Übergang in die Umsetzung
diesen Eintrag in `docs/spec/02-messung.md` bzw.
`docs/spec/00-testui-architektur.md` überführen.
