# Projektbeschreibung für Sound Balancing Tool Entwicklung

Diese Beschreibung gilt für Chats, in denen das Sound Balancing Tool
entwickelt wird.

Dieses Projekt ist ein CI Sound Balancing Tool, das im Browser läuft.
Es dient Cochlea-Implantat-Trägern dazu, die wahrgenommene Lautstärke
verschiedener Elektrodenfrequenzen systematisch zu vergleichen und
eine Korrekturkurve zu erstellen.

REFERENZDATEIEN
---------------

- **CODESTRUKTUR.md** — Modulübersicht, Ladereihenfolge,
  Querverweise, Edit-Szenarien. Vor jedem nicht-trivialen Edit lesen.
- **SPEC.md** — vollständige Funktionsspezifikation (Tabs, Tests,
  Levels, Player, Speichern, Drucken, Warteliste). Bei Fragen zum
  Funktionsumfang dorthin.
- **DEBUG.md** — Browser-Konsole, Network-Tab, Bug-Report-Template,
  Konsolen-Befehle für den Nutzer. Wenn der Nutzer einen Fehler
  meldet oder Diagnose-Hilfe braucht: dorthin verweisen oder
  passende Schritte daraus zitieren.
- **IDEEN.md** — Konzept-Skizzen und Erweiterungs-Ideen, die noch
  nicht abgesegnet oder noch nicht reif sind. Abgrenzung zu SPEC.md:
  SPEC.md beschreibt das, was gebaut wird oder fest zur Umsetzung
  ansteht; IDEEN.md sammelt das, was diskutiert wird oder
  langfristig denkbar ist. Bei neuen Ideen, die nicht sofort gebaut
  werden, dort einen Eintrag anlegen. Beim Übergang in die
  Umsetzung: Eintrag aus IDEEN.md entfernen und in SPEC.md
  übernehmen.
- **Berechnungsgrundlagen dB zu CI.md** — Mathematische Grundlagen
  und Formeln für die Umrechnung von dB-Korrekturen in
  herstellerspezifische Einheiten (MED-EL qu, Cochlear CL,
  Advanced Bionics CU). Quellen, Vorbehalte und Hersteller-
  spezifische Mapping-Funktionen. Wird bei jeder Arbeit am Druck,
  am Levels-Tab im Absolutmodus oder an der MAPLAW-Simulation
  benötigt. Implementierung der Formeln liegt in `core.js`
  (`calcMedel`, `calcCochlear`, `calcAB`).

NUTZERKONTEXT
-------------

Der Nutzer (Martin) trägt ein MED-EL CI rechts (Sonnet 3), etwas
Restgehör links. Wiedergabe über Bluetooth. Elektrode 12 fast stumm
(vom Audiologen stummgestellt), E11 verrauscht. Aktueller MAPLAW: 1000.
Kodierungsstrategie unklar (FSP/FS4). Die Projektdateien enthalten
außerdem Martins Brief an den Audiologen und das MAESTRO-Handbuch
(DE und EN) als Referenz.

ARBEITSWEISE
------------

Bauen NUR auf explizite Aufforderung "bauen". Sonst besprechen.
Vor Bauarbeiten zuerst CODESTRUKTUR.md lesen.

Bei strukturellen Änderungen (neue/entfernte JS-Datei, neue zentrale
Funktion, neue globale Variable, neuer Tab oder Sub-Tab, verschobener
DOMContentLoaded-Handler) **CODESTRUKTUR.md im selben Arbeitsschritt
mit aktualisieren**, nicht nachträglich. Bei Funktionsänderungen
**SPEC.md im selben Arbeitsschritt mit aktualisieren**.

Ein PostToolUse-Hook (`.claude/hooks/post-edit-reminder.sh`) feuert
nach jedem Edit/Write auf `.js`/`.html`/`.css` und blendet einen
Selbst-Check-Reminder ein. Der Hook ist eine Erinnerung an Claude,
keine Nachricht an den User. Wenn der Reminder erscheint und tatsächlich
strukturell oder funktional etwas geändert wurde: Referenzdateien
sofort anpassen, nicht aufschieben.

AKTIVE RÜCKFRAGEN
-----------------

Der Nutzer beschreibt seine Wünsche aus User-Sicht und kann den Code
nicht selbst prüfen. Annahmen ohne Rückfrage sind deshalb teurer als
in Projekten mit codeerfahrenen Usern: ein falsch verstandener Wunsch
landet im Code und wird erst sichtbar, wenn er nachbessern muß.

Daher gilt — für Opus (Konzeptphase) und Sonnet (Bauphase) gleichermaßen:
- Wenn ein Punkt unklar oder mehrdeutig ist, **fragen statt annehmen**.
- Lieber eine Rückfrage zu viel als eine versteckte Annahme.
- Mehrere Klärungspunkte am Stück bündeln, damit der Nutzer in einem
  Schwung antworten kann (nicht jede einzeln, das wird zermürbend).
- Wenn eine Annahme aus Erfahrung naheliegend ist, sie offen
  benennen ("ich nehme an X, sag Bescheid wenn nicht"), nicht
  stillschweigend übernehmen.
- Bei Fragen mit klar überschaubaren Optionen Entscheidungs-
  Vorschläge mitliefern, mit kurzer Begründung — der Nutzer kann
  dann zustimmen oder abweichen, ohne von Null zu denken.

FEHLERMELDUNGEN UND DEBUGGING
-----------------------------

Wenn der Nutzer ein Problem meldet:
- Knapp nachfragen mit Verweis auf das Bug-Report-Template in
  DEBUG.md, falls die Beschreibung Lücken hat (Wo / Aktion /
  Erwartet / Tatsächlich / Konsole).
- Wenn ein Konsole-Befehl die Diagnose abkürzen kann, ihn dem
  Nutzer als kopierbaren Einzeiler geben statt ihn klicken zu lassen.
- Bei Befehlen, die nur lesen (`console.log(...)`, `JSON.stringify(...)`):
  klar als Diagnose markieren. Bei Befehlen, die etwas verändern,
  vorab klar sagen, was sie tun.

BAUANLEITUNGEN FÜR SONNET
-------------------------

Wenn der User eine Bauanleitung für Sonnet bestellt, gilt
Anleitungs-Modus, nicht Spezifikations-Modus:
- Aus Ausführungssicht schreiben. Jeder Schritt so konkret, daß
  Sonnet nicht raten muß.
- Konkrete before/after-Snippets statt nur Schemata.
- Skeleton-Code für neue Module mitliefern, nicht nur das Schema.
- Anforderungen pro Feature an EINEM Ort bündeln (Verhalten,
  Persistenz, Akzeptanz zusammen), nicht über das Dokument verteilen.
- Direkte Sprache: "in datei.js Z. X dieses durch jenes ersetzen"
  statt "vorhandene Mechanik anpassen".
- Explizite Sync-Patterns für globale Variablen vorgeben (zentraler
  Setter + Listener-Pattern), nicht nur "bidirektional gebunden" sagen.

Volumen sparen, Sorgfalt erhöhen durch Aufteilung:
- Lieber mehrere kleine Anleitungsdateien (durchnummeriert,
  z.B. BAUANLEITUNG_01_<thema>.md, BAUANLEITUNG_02_<thema>.md)
  als ein großes Dokument.
- Eine Datei = ein Sonnet-Chat = ein begrenztes Thema. Sonnet
  arbeitet sorgfältiger bei kleinem Kontext; und es spart Tokens,
  wenn nicht jeder Sonnet-Chat das gesamte Vorhaben mitschleppt.
- Reihenfolge der Dateien festlegen, am Ende jeder Anleitung eine
  knappe Zwischenprüfung formulieren ("Nach Abschluß manuell
  prüfen: X funktioniert, Y unverändert.").
- Vor dem Schreiben überlegen, ob die Anleitung tatsächlich klein
  genug ist — wenn nicht, von vornherein aufteilen.

Pflichtbestandteile jeder Bauanleitung:
- **Akzeptanztest-Checkliste am Ende**: Klick-für-Klick-Schritte, die
  der Nutzer ohne Code-Kenntnisse durchgehen kann, mit erwartetem
  Verhalten pro Schritt. Beispiel: "Tab Messungen → Sub-Tab
  Stereo-Balance → ‚Test starten‘ klicken → erwartet: roter Stop-
  Button aktiv, Voreinstellungen ausgegraut, Test-Block sichtbar."
- **Selbstprüfungs-Auftrag an Sonnet**: am Ende jedes Builds soll
  Sonnet **vor der Fertig-Meldung** jede Akzeptanz-Kriterie einzeln
  durchgehen und für jede melden: erfüllt / nicht erfüllt / unklar,
  mit Datei- und Zeilenangabe der relevanten Stelle. Wenn Sonnet
  selbst etwas als unklar markiert, ist das Signal zur Rückfrage,
  nicht zur stillen Annahme.
