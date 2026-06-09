## Drucken

- Beide Berichts-Ausdrucke (Archiv und Audiologen-Auftrag) zeigen
  rechts oben im Briefkopf das App-Logo
  `assets/images/logo_briefkopf6.png`, voll deckend, Höhe 150 px,
  Breite proportional. Das Logo erscheint auch in den Tab-Einzeldrucken
  (Implantat, Meßergebnisse, Kurven, Schieber), weil diese denselben
  `buildPrintHeader` aus `print.js` verwenden. Pfadauflösung über
  `new URL(..., window.location.href).href`, damit auch im
  `about:blank`-Druckfenster eine vollständige URL steht.
- Meßergebnisse immer enthalten
- Player-Einstellungen (Quelle, Stärke, NH-Simulation) zusätzlich
- Levels-Werte und Equalizer-Gains im Ausdruck
- Einzelne Tabs erhalten je einen eigenen Druck-Knopf, der nur
  den Inhalt dieses Tabs (bzw. aktiven Sub-Tabs) für die aktuell
  aktive Seite druckt. Jeder Einzeldruck trägt einen Mini-Kopf
  mit App-Name, Tab-Titel, Datum, Seite und Implantat-
  Identifikation; darunter eine kursive Tool-Versions-Zeile
  („Meßwerte ermittelt mit CImbel — CI sound balancing vX.Y.Z-beta
  (www.ci-sound-balancing.org)", i18n-Key `printHeaderToolVersion`)
  — gilt seit BA 176 für alle Tab-Drucke und den Audiologen-Druck
  einheitlich über `buildPrintHeader`. Der bestehende „Alles
  drucken"-Button in Laden/Speichern bleibt unverändert und
  druckt weiterhin beide Seiten mit allen Sektionen.
  - **Implantat-Tab** (`#printImplantBtn`): implementiert.
  - **Meßergebnisse-Sub-Tabs** (`#printErgebnisseBtn` in der
    Sub-Tab-Leiste rechts): implementiert. Dispatcher
    `printErgebnisseTab()` erkennt den aktiven Sub-Tab und ruft
    `_printResLoudness`, `_printResLR` oder `_printResFreqmatch`
    auf. Diagramme werden als PNG-Bild eingebettet (Canvas→img),
    Buttons entfernt, Inputs/Selects als Text-Spans dargestellt
    (Checkbox/Radio → „✓"/„—", Select → sichtbarer Optionstext).
  - **Kurven-Tab** (`#printKurvenBtn` rechts neben Chart-Titel):
    implementiert. Druckt Chart-Card (4-Linien-Chart als PNG)
    und Kurvenfunktionen-Tabelle. Die Tabelle wird datengetrieben
    aus `presets` gebaut (`_buildPresetCardPrint`): nur aktive
    Kurven erscheinen, Stärke/Mitte/Breite/Cutoff als Text.
  - **Schieber-Tab** (`#printSchieberBtn` rechts neben Tab-Titel):
    implementiert. Druckt Info-Zeile (Modus + Variante), Canvas-Bild
    des Schiebers als PNG und eine Werte-Tabelle pro Elektrode.
    Im Relativmodus: Spalten „Nr." und „dB-Wert". Im Absolutmodus:
    zusätzlich eine Hersteller-Einheit-Spalte (MCL qu / CL / CU)
    berechnet über `calcMedel`/`calcCochlear`/`calcAB`; Elektroden
    ohne eingetragenen Upper-Level zeigen „—".

### Archiv-Box im Tab Laden/Speichern

Karte „Archiv — Datensicherung des Tools" mit vier Aktionen: JSON
laden, JSON speichern, Bericht drucken, Markdown Text exportieren.

Markdown-Bericht: vollständige Tool-Sicht in einer festen
Markdown-Struktur. Reihenfolge: Kopf, Konfiguration pro Seite,
Implantat-Tabelle pro Seite (THR, MCL/Upper, Hz-eigen, Aktiv, Status,
Ausgeschlossen, Notiz), globale Test-Einstellungen, pro Seite Messungen
(mit Sweep-Resume-Stand falls vorhanden) / Schieber / Kurven /
Frequenzabgleich, Bilateral (Stereo-Balance, Latenz), Player
(vollständig), Sonstiges (Default-Hersteller, Schieber-Tab-
Anzeige, lokale Satz-Sammlungen). Pro Seite werden Sektionen
ohne Inhalt weggelassen. Der Bericht ist sprach-aktuell — der
Sprachwechsel im Tool wechselt auch die Markdown-Sprache.

Druck-Pfad: gemeinsamer Datensammler `collectArchivData()` plus
`renderArchivPrintHtml(data)`. Direkt nach dem Kopf erscheint — falls
`audiologUserNote` nicht leer — die persönliche Notiz (H2 „Notiz",
via `_audiologUserNoteBlock()`), identisch zum Audiologen-Bericht.
Der Bericht enthält dieselben Sektionen wie der Markdown-Export,
ergänzt um eingebettete
PNG-Grafiken zu jeder Sektion, in der Werte ≠ 0 vorliegen:
Messungen Elektrodenlautstärke, Schieber, Kurven,
Frequenzabgleich (pro Seite); Stereo-Balance bilateral; Player-EQ
(pro Seite je nach Side-Modus). Latenz erscheint nur als
Textsektion.

Die Diagramme im Archiv-Druck folgen dem GUI-Zustand: Kurven-Chart
und Player-EQ sind cent-skaliert und folgen dem Frequenz-Warping
(sofern aktiv). Loudness- und Stereo-Balance-Diagramme sind
elektrodennummern-basiert mit Hz unter der Achse. Der Schieber-
Druck zeigt nur die Elektroden-Bezeichnung unter der Achse. Der
Frequenzabgleich-Druck behält seine log-Hz-Achse.

Frequenzabgleich-Datenquelle (Tabelle und Graph im Archiv,
Tabelle „Änderung der Mittenfrequenzen" im Audiologen-Druck):
`_warpFResSource()` — vereint `fRes` mit den Provisionals aus
laufendem Frequenzabgleich-Test (identisch zur Meßergebnis-
Tabelle und zum Player-EQ-Graph). Vorläufige Punkte sind
markiert: in den Markdown-Tabellen mit Sternchen `*` am
Elektroden-Label plus Fußnote `archivFmProvNote`; im Archiv-
Graph als offener Kreis statt gefüllter Kreis mit Legende
`archivFmProvLegend` oben rechts. Folge: bei laufendem Test
erscheinen Frequenzabgleich-Sektionen in beiden Druckmodi
bereits mit Zwischenstand, klar als vorläufig erkennbar.

Der Audiologen-Druck bleibt von den Achs-Skalierungen unberührt
— er nutzt eine bewußt vereinfachte, nicht cent-warp-skalierte
Darstellung. Die Frequenzabgleich-Sektion „Änderung der
Mittenfrequenzen" (Graph und Tabelle) verwendet jedoch dieselbe
`_warpFResSource()` und denselben Provisional-Marker.

Dateinamen: `ci-sound-balancing-<datum>-<zeit>.json` (JSON) und
`ci-sound-balancing-archiv-<datum>-<zeit>.md` (Markdown).
EasyEffects-Export: `ci-sound-balancing-easyeffects.json`.

### Audiologen-Box im Tab Laden/Speichern

Karte „Einstellungswünsche an den Audiologen" zwischen Archiv-Karte
und EasyEffects-Karte. Enthält ein optionales Notiz-Eingabefeld
(`audiologUserNote`, top-level persistiert, für BA 43 Brief) und zwei
Aktionen: Drucken (mit Grafik), Markdown-Export.

Der Korrektur-Bericht ist gegliedert in:

1. Kopf wird vollständig vom gemeinsamen `buildPrintHeader` (`print.js`)
   gestellt: H1 „CImbel — CI sound balancing — Einstellungswünsche an den
   Audiologen", Datum / Seite / Implantat, Tool-Versions-Zeile mit
   Domain. Der Audiologen-Markdown-Body enthält seit BA 176 keinen
   eigenen H1/Datum/Versions-Block mehr.
2. Persönliche Notiz (H2 „Notiz" + Text direkt ohne Blockquote-Prefix,
   i18n-Key `audiologSecNote`) — nur wenn `audiologUserNote` nicht leer.
   Bei leerer Notiz entfällt der Block vollständig.
3. EQ-aus-Hinweis (Blockquote), falls Player-EQ deaktiviert — direkt
   unter Notiz-Block (bzw. direkt unter dem Header, wenn keine Notiz).
4. Bilateraler Block — Sektionen, die beide Seiten gleichermaßen
   betreffen, in fester Reihenfolge (vor den Pro-Seite-Blöcken):
   - „Hinweise für den Audiologen" (H2, 5 Bullets; letzter: Bitte um vollständiges Anpassungsprotokoll für den Klienten nach Ende der Sitzung).
   - „Fehlende Implantat-Angaben" (H2) — falls Implantat-Daten
     unvollständig (inkl. THR (T-Levels) und manuell eingetragene
     Mittenfrequenzen). Direkt unter der H2 ein italic-Einleitungssatz
     (i18n-Key `audiologMissingIntro`) mit der Bitte an den Audiologen,
     dem Klienten die Daten mitzuteilen. Danach die Bullet-Liste.
     Fehlt kein Wert, erscheint die Sektion gar nicht.
   - Stereo-Balance (H2) — immer wenn gemessen. Mit Hinweis, ob die
     Differenz eingerechnet ist.
   - Inter-Ohr-Latenz (H2) — analog. Kein Hinweis zum Ausgleichs-
     Status (weder „bereits ausgeglichen" noch „nicht ausgeglichen").
4. Pro-Seite-Blöcke — erst LINKS komplett, dann RECHTS komplett,
   kein Vermischen bei beidseitigem Druck. Innerhalb jedes Blocks:
   - Seiten-H2 mit Meta-Zeile (Hersteller, Prozessor, Implantat-Modell,
     Datum der letzten Messung).
   - Testprogramm-Hinweis (Blockquote, direkt unter der Meta-Zeile,
     nur wenn Heuristik für diese Seite anschlägt).
   - Bar-Chart der ΔdB-Werte mit Residuum-Fehlerbalken. Die
     Referenzelektrode ist im Chart durch ein fettes schwarzes
     „Ref.-El."-Label am oberen Rand markiert.
   - H3 „Lautstärken-Korrektur": Tabelle aller Elektroden mit
     **Δ dB** (fett), Residuum, MCL/Δ MCL/Neuer MCL (qu/CL/CU),
     Status, Ausgeschlossen, Elektroden-Notiz, **Ref.El.** (neues
     Feld ganz rechts; `X` in der Zeile der Referenzelektrode).
     Legende darunter. (Keine Hz-Spalte.)
   - H3 „MAPLAW-Änderung" (nur MED-EL, nur wenn MAPLAW aktiv und
     c-Wert abweicht): Satz-Format „MAPLAW [Seite] ändern von
     c=[Ist] auf c=**[Soll]**."
   - H3 „Änderung der Mittenfrequenzen" (nur bei aktivem Warp):
     Direkt unter der H3-Überschrift ein Punktdiagramm
     (`_audiologFreqChartImg`): log-Hz x-Achse, Cent-Versatz y-Achse,
     Punkte grün/rot je nach Cent-Vorzeichen mit Elektrodenlabel
     unter dem Punkt. Vorläufige Punkte aus laufendem Test als
     offene Kreise mit Legende `archivFmProvLegend`. Darunter die
     Tabelle: Spalten Elektrode, Hz Default, Hz (manuell eingetragen),
     Δ cent, Δ Hz, **Gewünschte Mittenfrequenz** (fett). Δ Hz =
     Wunschfrequenz minus aktuelle Mittenfrequenz, mit Vorzeichen.
     Datenquelle (Tabelle und Graph) ist `_audiologFmRowsForSide(side)`:
     der Helper berechnet pro Elektrode auf der jeweiligen Seite die
     effektive Cent-Verschiebung über `buildWarpPoints` + `centShift`
     aus `_warpFResSource()` — also exakt die Mathematik, die der
     Player im Audio-Pfad anwendet. Daraus folgt: im left-Modus hat
     nur die linke Seite Einträge (rechte bleibt leer); im right-Modus
     ist es spiegelbildlich; im symmetric-Modus bekommen **beide**
     Seiten Einträge mit je cent/2. Vorläufige
     Werte aus einem laufenden Frequenzabgleich-Test fließen mit ein
     — vorläufige Zeilen mit Sternchen am Elektrodenlabel und
     Fußnote `archivFmProvNote`; eine Elektrode gilt als vorläufig,
     sobald mindestens ein zugehöriger Quell-Eintrag vorläufig ist.
     Bei symmetrischem Warping (`pWarpMode === "symmetric"`,
     entspricht HTML-`<option value="symmetric">`) + einseitigem
     Druck erscheinen **zwei** vollständige H3-Sektionen pro Pro-
     Seite-Block — eine für die gedruckte Seite (Graph + Tabelle),
     eine für die andere Seite (Graph + Tabelle) — beide mit Side-
     Suffix in der Überschrift („— Links" / „— Rechts"). Vor der
     ersten H3 erscheint ein kursiver Hinweissatz
     (`audiologFreqSymHint`), der die Doppelung erklärt.
6. Nach dem letzten Pro-Seite-Block folgt nichts mehr — kein Footer,
   keine weiteren Sektionen.

Allgemeine Bitten (Fitting-Report) erscheinen **nicht** im Korrektur-Bericht.
Die persönliche Notiz (`audiologUserNote`) erscheint seit BA 162 als
Block 2 direkt nach dem Kopf — sowohl im Markdown-Export als auch im
HTML-Druck.
Kein Footer mit Tool-Version; Versions-Info steht im Kopf.

Testprogramm-Heuristik: EQ aktiv, NH-Sim aus, und Standardabweichung
des Schieber+Kurven-Beitrags pro aktiver Elektrode (mit EQ-Stärke
skaliert, Mittelwert abgezogen) < 0,2 dB. Reine Pegelverschiebung
wird damit nicht als „nicht-Testprogramm" gewertet.

Dateinamen: `ci-sound-balancing-audiologe-<datum>-<seite>.md`
mit `<seite>` ∈ {`links`, `rechts`, `beide`}.
