# Projektbeschreibung für Sound Balancing Tool Entwicklung

Diese Beschreibung gilt für Chats, in denen das Sound Balancing Tool
entwickelt wird.

Dieses Projekt ist ein CI Sound Balancing Tool, das im Browser läuft.
Es dient Cochlea-Implantat-Trägern dazu, die wahrgenommene Lautstärke
verschiedener Elektrodenfrequenzen systematisch zu vergleichen und
eine Korrekturkurve zu erstellen.

REFERENZDATEIEN
---------------

- **docs/CODESTRUKTUR.md** — Modulübersicht, Ladereihenfolge,
  Querverweise, Edit-Szenarien. Vor jedem nicht-trivialen Edit lesen.
- **docs/SPEC.md + docs/spec/** — Funktionsspezifikation. docs/SPEC.md ist
  ein schlanker Index mit Eckdaten, Anzeige-Konvention und
  Verweisen auf neun Kapitel unter `docs/spec/` (Tabs, Messungen,
  Implantat, Schieber, Kurven, Player, Laden/Speichern, Drucken,
  Warteliste). **Bei Arbeiten an einem konkreten Bereich nur
  das passende Kapitel aus docs/spec/ lesen, nicht die ganze Spec.**
- **docs/DEBUG.md** — Browser-Konsole, Network-Tab, Bug-Report-Template,
  Konsolen-Befehle für den Nutzer. Wenn der Nutzer einen Fehler
  meldet oder Diagnose-Hilfe braucht: dorthin verweisen oder
  passende Schritte daraus zitieren.
- **docs/IDEEN.md** — Konzept-Skizzen und Erweiterungs-Ideen, die noch
  nicht abgesegnet oder noch nicht reif sind. Abgrenzung zu docs/SPEC.md:
  docs/SPEC.md beschreibt das, was gebaut wird oder fest zur Umsetzung
  ansteht; docs/IDEEN.md sammelt das, was diskutiert wird oder
  langfristig denkbar ist. Bei neuen Ideen, die nicht sofort gebaut
  werden, dort einen Eintrag anlegen. Beim Übergang in die
  Umsetzung: Eintrag aus docs/IDEEN.md entfernen und in docs/SPEC.md
  übernehmen.
- **Berechnungsgrundlagen dB zu CI.md** — Mathematische Grundlagen
  und Formeln für die Umrechnung von dB-Korrekturen in
  herstellerspezifische Einheiten (MED-EL qu, Cochlear CL,
  Advanced Bionics CU). Quellen, Vorbehalte und Hersteller-
  spezifische Mapping-Funktionen. Wird bei jeder Arbeit am Druck,
  am Levels-Tab im Absolutmodus oder an der MAPLAW-Simulation
  benötigt. Implementierung der Formeln liegt in `core.js`
  (`calcMedel`, `calcCochlear`, `calcAB`).
- **docs/Konzept_Frequenzwarping_und_EQ.md** — Konzeptionelle
  Grundlagen der Audio-Pipeline des Players: Wirkungsrichtung
  des Frequenz-Warpings (Korrektur-Vorhalt vs. NH-Simulation),
  modus-abhängige Filter-Position des Equalizers (nominell vs.
  gewarpt), Zusammenwirken beider Korrekturen, Pipeline-Reihenfolge
  und Vereinfachungen gegenüber dem echten CI. Vor jeder Arbeit an
  der Wirkungsrichtung des Warps, an der EQ-Filter-Position oder
  an der Pipeline-Reihenfolge im Player lesen.
- **docs/BAUANLEITUNGEN_LEITLINIEN.md** — Format-Vorgaben für
  Sonnet-Bauanleitungen (Snippets, Skeleton, Akzeptanztest,
  Selbstprüfung, Aufteilung in kleine Dateien). Nur lesen,
  wenn tatsächlich eine Bauanleitung verfaßt wird, nicht
  bei jedem Chat-Start.

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
Vor Bauarbeiten zuerst docs/CODESTRUKTUR.md lesen.

Bei strukturellen Änderungen (neue/entfernte JS-Datei, neue zentrale
Funktion, neue globale Variable, neuer Tab oder Sub-Tab, verschobener
DOMContentLoaded-Handler) **docs/CODESTRUKTUR.md im selben Arbeitsschritt
mit aktualisieren**, nicht nachträglich. Bei Funktionsänderungen
**docs/SPEC.md im selben Arbeitsschritt mit aktualisieren**.

Ein PostToolUse-Hook (`.claude/hooks/post-edit-reminder.sh`) feuert
nach jedem Edit/Write auf `.js`/`.html`/`.css` und blendet einen
Selbst-Check-Reminder ein. Der Hook ist eine Erinnerung an Claude,
keine Nachricht an den User. Wenn der Reminder erscheint und tatsächlich
strukturell oder funktional etwas geändert wurde: Referenzdateien
sofort anpassen, nicht aufschieben.

VERSIONIERUNG
-------------

Verbindlich für **jede** Code-Änderung in `js/`, `index.html`,
`style.css` oder anderen Laufzeit-Dateien — egal ob durch Direkt-Edit,
Agent-Build oder Sonnet-Bauanleitung:

- **`APP_VERSION` in `js/version.js` hochzählen**, sobald an Lauf-
  Code etwas verändert wurde. Format:
  `"<Major>.<Minor>.<BA-Nummer>[.<Fix>]-beta"`. Ohne Bump bleibt der
  Browser-Cache bei der alten Version hängen und der Nutzer sieht die
  Änderung nicht. Reine Doku-Änderungen (`*.md`, `docs/`) lösen
  **keinen** Bump aus.

  Bedeutung der Stellen:
  - **Major / Minor**: manuell bei semantischen Brüchen (Architektur,
    Lizenz, große Verfahrensumstellung). Beim Minor-Bump bleibt die
    BA-Nummer der dritten Stelle erhalten — sie wird **nicht** auf
    0 zurückgesetzt.
  - **BA-Nummer (dritte Stelle)**: zeigt auf die zugehörige Bau-
    anleitung. Wird **nur** bei einer neuen Bauanleitung um 1 erhöht.
    Bleibt bei reinen Fixes / Lizenzwechsel / Direkt-Edits ohne BA
    unverändert.
  - **Fix-Suffix `.n` (vierte Stelle, optional)**: Bugfixes, kleine
    Korrekturen und sonstige Code-Änderungen ohne eigene Bauanleitung
    hängen `.1`, `.2`, … an die aktuelle BA-Nummer. Damit bleibt die
    BA-Nummer in der dritten Stelle als Anker konsistent mit den
    Dateinamen im `.bauanleitungen/`-Ordner. Beispiel: nach
    `3.1.181-beta` (gebaut aus BA 181) wird ein Bugfix-Edit zu
    `3.1.181.1-beta`, der nächste Bugfix zu `3.1.181.2-beta`. Mit
    der nächsten Bauanleitung springt es auf `3.1.182-beta` (Fix-
    Suffix entfällt wieder).

- **Bauanleitungs-Dateien folgen der Toolversion**: Eine neue
  Bauanleitung erhält die nächste BA-Nummer = aktuelle dritte Stelle
  + 1 (Fix-Suffix wird ignoriert). Dateiname-Konvention
  `BAUANLEITUNG_<BA-Nummer>_<thema>.md` im Ordner `.bauanleitungen/`.
  Beispiel: aktuelle Version `3.2.181.2-beta` → nächste Anleitung
  `BAUANLEITUNG_182_<thema>.md`, die nach erfolgreichem Build die
  Version auf `3.2.182-beta` setzt. Der Bump in `version.js` ist
  Pflichtbestandteil jeder Anleitung (siehe
  `docs/BAUANLEITUNGEN_LEITLINIEN.md`). Wenn parallele Anleitungen
  gleichzeitig laufen, vergibt Opus die Nummern aufsteigend in der
  Reihenfolge der Erstellung.

KONZEPTBESPRECHUNG
------------------

Konzeptbesprechung hat höchste Priorität im Projekt. Sie ist die
Grundlage für alles, was später gebaut wird; Fehler in der Konzept-
phase werden in der Bauphase in Code zementiert und kosten dort
mehrfach mehr als die Lese- und Denkzeit, die sie vorher gekostet
hätten.

Daher gilt in Konzeptbesprechungen:

- **Sorgfalt schlägt Sparsamkeit.** Die Token-Sparregeln aus dem
  Abschnitt EFFIZIENTER UMGANG MIT DEM PRO-ABO gelten für triviale
  Edits, Routinearbeit und Bug-Diagnose. In der Konzeptphase ist
  das Verhältnis umgekehrt: gründliches Lesen der relevanten Code-
  Bereiche, der Quellen und ggf. der Manuals geht vor Volumen-
  Schonung. Eine unsichere Empfehlung kostet später mehr.
- **Code-Quellen sind zuverlässiger als die SPEC.** docs/SPEC.md und
  docs/spec/ sind Stand der bisherigen Überlegungen, nicht
  Naturgesetz. In Konzeptbesprechungen wird die Spec selbst oft
  hinterfragt — es ist falsch, mit Spec-Argumenten gegen Konzept-
  Ideen zu argumentieren, ohne den tatsächlichen Code, die
  zugrundeliegenden Quellen (Papers in `.manuals/`, Hersteller-
  Manuale) oder verwandte Implementierungen im Repo zu prüfen.
  Wenn die Spec etwas behauptet, das im Konzeptkontext relevant
  ist, ist das ein Hinweis auf eine frühere Entscheidung mit
  Begründung — die Begründung selbst gehört nachgeprüft.
- **Vermutungen klar markieren oder nachsehen.** „aus dem Kopf",
  „vermutlich", „so wie ich es in Erinnerung habe" sind in der
  Konzeptphase nicht ausreichend. Entweder nachsehen oder die
  Unsicherheit explizit benennen, bevor sie in Empfehlungen
  einfließt.
- **Auf Irrtümer des Nutzers aktiv hinweisen.** Wenn eine vom
  Nutzer verfolgte Idee problematisch, in sich widersprüchlich
  oder im Konflikt mit gemessenen Daten ist: klar sagen, mit
  Begründung. Nicht stillschweigend mitlaufen, weil die Idee
  vom Nutzer kommt. Ehrliche Reibung ist wertvoller als
  reflexhafte Zustimmung.

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
  docs/DEBUG.md, falls die Beschreibung Lücken hat (Wo / Aktion /
  Erwartet / Tatsächlich / Konsole).
- Wenn ein Konsole-Befehl die Diagnose abkürzen kann, ihn dem
  Nutzer als kopierbaren Einzeiler geben statt ihn klicken zu lassen.
- Bei Befehlen, die nur lesen (`console.log(...)`, `JSON.stringify(...)`):
  klar als Diagnose markieren. Bei Befehlen, die etwas verändern,
  vorab klar sagen, was sie tun.

BAUANLEITUNGEN FÜR SONNET
-------------------------

Vor dem Verfassen einer Sonnet-Bauanleitung
`docs/BAUANLEITUNGEN_LEITLINIEN.md` lesen. Dort stehen Format-
Vorgaben, Pflichtbestandteile (Akzeptanztest, Selbstprüfungs-
Auftrag), Aufteilungs-Regeln und die Anweisung zum Volumen-
Sparen durch kleine, nummerierte Anleitungs-Dateien.

EFFIZIENTER UMGANG MIT DEM PRO-ABO
----------------------------------

Der Nutzer hat ein begrenztes Wochen-Volumen. Folgende Regeln helfen,
es nicht unnötig zu verbrauchen:

- **Circuit Breaker bei Suche/Debugging.** Wenn nach drei erfolglosen
  Such- oder Tool-Schritten kein klarer Hinweis gefunden ist:
  anhalten, bisherigen Stand kurz zusammenfassen, den Nutzer um
  Eingrenzung bitten. Nicht blind weitergraben.
- **Referenz-Dateien nur lesen, wenn nötig.** docs/CODESTRUKTUR.md,
  docs/SPEC.md, docs/DEBUG.md etc. nicht vorsorglich öffnen. Bei trivialen
  Edits (String ersetzen, Tippfehler, eine bekannte Funktion ändern)
  reicht der Direkt-Edit. Die "vor jedem nicht-trivialen Edit lesen"-
  Regel aus REFERENZDATEIEN gilt streng — bei trivialen Edits eben
  nicht.
- **Gezielte File-Reads bei großen Dateien.** `lr-balance.js`,
  `i18n.js`, `index.html` nicht pauschal von oben lesen. Erst per
  `grep` die relevante Zeile finden, dann mit `offset`/`limit` nur
  den nötigen Ausschnitt einziehen.
- **Sonnet als Agent nutzen** für isolierte Subtasks mit klarem
  Scope (parallele Code-Suche, Aufzählungs-Aufgaben, mechanische
  Refactorings). Nicht für Kleinaufgaben — das Briefing kostet
  dann mehr Tokens als die Aufgabe selbst. Aufruf: `Agent`-Tool
  mit `model: "sonnet"`.
- **DeepSeek vorschlagen bei reinen Wissensfragen.** Hersteller-
  Mechaniken, Audiologie-Theorie, allgemeine Web-Recherche kann der
  Nutzer auf DeepSeek auslagern. Aktiv anbieten, statt Claude-
  Volumen für reine Recherche zu verbrauchen. Bei Code- und
  Projektfragen bleibt es bei Claude.
- **Opus und Sonnet nicht im selben Chat mischen — mit einer Ausnahme.**
  Standardfall: Hat Opus eine Bauanleitung geschrieben, übernimmt ein
  neuer Sonnet-Chat das Bauen. Den Opus-Chat schließen. Grund:
  Token-Sparsamkeit, lange Chats schleppen alle alten Nachrichten mit.
  **Ausnahme — komplexe vernetzte Refactorings**: Wenn ein Vorhaben
  mehrere Module gleichzeitig berührt und Drift zwischen Teilmigrationen
  früh erkannt werden muß (typisch: einheitliche API einführen und
  mehrere Aufrufer migrieren), darf Opus Sonnet als Agent
  (`Agent`-Tool mit `model: "sonnet"`) direkt aus dem Opus-Chat
  aufrufen. Vorteil: Opus behält die Übersicht, prüft jedes Bauresultat
  und kann sofort nachsteuern. Subagenten haben eigenen Kontext —
  der Token-Grund aus dem Standardfall greift hier nicht direkt. Reale
  Kosten: der Opus-Chat wächst durch die Agent-Berichte; bei vielen
  Iterationen den Kontext im Auge behalten und ggf. Schritte ab einem
  bestimmten Punkt doch wieder per Bauanleitung in einen neuen
  Sonnet-Chat auslagern (typisch: die ersten 1-2 Migrations-Schritte
  per Agent, danach Pattern wiederholt sich → Bauanleitung).
- **Bei Bug-Diagnose erst Konsolen-Ausgabe holen.** Bevor Claude
  selbst durch den Code wandert, den Nutzer um die Konsolen-Meldung
  bitten (Bug-Report-Template in docs/DEBUG.md). Spart oft eine ganze
  Such-Schleife.
- **Nach abgeschlossenem Thema `/clear` empfehlen.** Lange Chats
  werden teuer, weil ältere Nachrichten mit jeder neuen mitgeschickt
  werden. Ein frischer Chat pro Thema spart Volumen.
