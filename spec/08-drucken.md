## Drucken

- Meßergebnisse immer enthalten
- Player-Einstellungen (Quelle, Stärke, NH-Simulation) zusätzlich
- Levels-Werte und Equalizer-Gains im Ausdruck
- Einzelne Tabs erhalten je einen eigenen Druck-Knopf, der nur
  den Inhalt dieses Tabs (bzw. aktiven Sub-Tabs) für die aktuell
  aktive Seite druckt. Jeder Einzeldruck trägt einen Mini-Kopf
  mit App-Name, Tab-Titel, Datum, Seite und Implantat-
  Identifikation. Der bestehende „Alles drucken"-Button in
  Laden/Speichern bleibt unverändert und druckt weiterhin beide
  Seiten mit allen Sektionen.
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
Implantat-Tabelle pro Seite (THR, MCL/Upper, Hz-eigen, Status,
Ausgeschlossen, Notiz), globale Test-Einstellungen, pro Seite Messungen
(mit Sweep-Resume-Stand falls vorhanden) / Schieber / Kurven /
Frequenzabgleich, Bilateral (Stereo-Balance, Latenz), Player
(vollständig), Sonstiges (Default-Hersteller, Schieber-Tab-
Anzeige, lokale Satz-Sammlungen). Pro Seite werden Sektionen
ohne Inhalt weggelassen. Der Bericht ist sprach-aktuell — der
Sprachwechsel im Tool wechselt auch die Markdown-Sprache.

Druck-Pfad: gemeinsamer Datensammler `collectArchivData()` plus
`renderArchivPrintHtml(data)`. Der Bericht enthält dieselben
Sektionen wie der Markdown-Export, ergänzt um eingebettete
PNG-Grafiken zu jeder Sektion, in der Werte ≠ 0 vorliegen:
Messungen Elektrodenlautstärke, Schieber, Kurven,
Frequenzabgleich (pro Seite); Stereo-Balance bilateral; Player-EQ
(pro Seite je nach Side-Modus). Latenz erscheint nur als
Textsektion.

Dateinamen: `ci-sound-balancing-<datum>-<zeit>.json` (JSON) und
`ci-sound-balancing-archiv-<datum>-<zeit>.md` (Markdown).
EasyEffects-Export: `ci-sound-balancing-easyeffects.json`.

### Audiologen-Box im Tab Laden/Speichern

Karte „Einstellungswünsche an den Audiologen" zwischen Archiv-Karte
und EasyEffects-Karte. Enthält ein optionales Notiz-Eingabefeld
(`audiologUserNote`, top-level persistiert, für BA 43 Brief) und zwei
Aktionen: Drucken (mit Grafik), Markdown-Export.

Der Korrektur-Bericht ist gegliedert in:

1. Kopf (Datum, Side-Auswahl) + Tool-Version-Zeile (italic, mit Domain
   www.ci-sound-balancing.org).
2. EQ-aus-Hinweis (Blockquote), falls Player-EQ deaktiviert — direkt
   unter Tool-Version-Zeile.
3. Bilateraler Block — Sektionen, die beide Seiten gleichermaßen
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
     Spalten Elektrode, Hz Default, Hz (manuell eingetragen), Δ cent,
     Δ Hz, **Gewünschte Mittenfrequenz** (fett). Δ Hz = Wunschfrequenz
     minus manuell eingetragene Frequenz, mit Vorzeichen. Bei sym-Warp
     + einseitigem Druck: Zusatzspalten für die andere Seite (inkl.
     Δ cent und Δ Hz der anderen Seite).
5. Nach dem letzten Pro-Seite-Block folgt nichts mehr — kein Footer,
   keine weiteren Sektionen.

Persönliche Notiz und Allgemeine Bitten (Fitting-Report) erscheinen
**nicht** im Korrektur-Bericht — sie wandern in den Brief (BA 43).
Kein Footer mit Tool-Version; Versions-Info steht im Kopf.

Testprogramm-Heuristik: EQ aktiv, NH-Sim aus, und Standardabweichung
des Schieber+Kurven-Beitrags pro aktiver Elektrode (mit EQ-Stärke
skaliert, Mittelwert abgezogen) < 0,2 dB. Reine Pegelverschiebung
wird damit nicht als „nicht-Testprogramm" gewertet.

Dateinamen: `ci-sound-balancing-audiologe-<datum>-<seite>.md`
mit `<seite>` ∈ {`links`, `rechts`, `beide`}.
