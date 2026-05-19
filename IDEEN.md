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
