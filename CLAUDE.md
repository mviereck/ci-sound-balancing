# Projektbeschreibung für CImbel-Entwicklung

Diese Beschreibung gilt für Chats, in denen CImbel
(früher: „CI Sound Balancing Tool") entwickelt wird.

Dieses Projekt ist CImbel („CI Multi-Band Equal Loudness"), ein
CI-Sound-Balancing-Tool, das im Browser läuft. UI-Titel: „CImbel —
CI sound balancing" (mit Geviertstrich). Es dient Cochlea-Implantat-
Trägern dazu, die wahrgenommene Lautstärke verschiedener Elektroden-
frequenzen systematisch zu vergleichen und eine Korrekturkurve zu
erstellen.

Der frühere Name „CI Sound Balancing Tool" steht noch in einigen
Doku-Dateien — gemeint ist überall CImbel.


GRUNDHALTUNG
============

Diese Regeln haben Vorrang vor allem anderen in dieser Datei. Wenn ein
anderer Abschnitt — insbesondere EFFIZIENZ — eine dieser Regeln zu
verdünnen scheint, gilt die Grundhaltung.

**1. Sorgfalt vor Sparsamkeit.** Sparsamkeit ist Mittel, nicht Zweck.
Schlechte Arbeit ist keine Sparsamkeit. Eine erratene Antwort, die
nachgebessert werden muß, kostet ein Vielfaches dessen, was die
Verifikation gekostet hätte. Der knappste Weg zu guter Arbeit ist:
einmal sauber, statt dreimal nachbessern.

**2. Stop-Regel: nicht raten, nachsehen.** Vor jeder Aussage über
konkreten Code — Datei, Funktion, Variable, ID, API-Property,
Version, Datenfluß — die Aussage prüfen, nicht aus dem Kopf
formulieren. Erinnerung ist kein Beleg. Konkret:

- Vor Empfehlungen mit Variablen-/Funktions-Namen: `grep` oder
  `Read` aufrufen und zitieren, was tatsächlich dasteht.
- Vor BA-Nummer-Vergabe: `js/version.js` lesen (dritte Stelle +1,
  Fix-Suffix ignorieren).
- Vor Edit an existierender Bauanleitung: `js/version.js` UND
  `grep` nach einem charakteristischen Symbol aus der BA, um
  Codestand zu prüfen. Im Zweifel: erst beim Nutzer nachfragen.
- Vor BA-Snippets mit testUI-API: Property-Namen per
  `grep` in `js/test-ui.js` verifizieren (`setLabels`-opts,
  `setPlaying`-Args, `progress.set`-opts, `setRangeHint`-opts,
  `refs.*`-Felder). Nicht aus dem Kopf schreiben — siehe BA 247
  (sechs Bugs aus geratenen Property-Namen).

Wenn nach drei erfolglosen Such-Schritten kein klarer Hinweis kommt:
anhalten, Stand zusammenfassen, Nutzer um Eingrenzung bitten.

**3. Code-Quellen > SPEC.** `docs/SPEC.md` und `docs/spec/` sind Stand
der bisherigen Überlegungen, nicht Naturgesetz. In Konzeptbesprechungen
nicht mit Spec-Argumenten gegen Konzept-Ideen argumentieren — den
tatsächlichen Code prüfen, die Quellen in `.manuals/`, verwandte
Implementierungen im Repo. Wenn die Spec etwas behauptet, das im
Konzept-Kontext relevant ist, ist das ein Hinweis auf eine frühere
Entscheidung mit Begründung — die Begründung gehört nachgeprüft.

Bei Umsetzung eines Konzeptbeschlusses ist die **Konzeptphase die
verbindliche Quelle**, nicht der Alt-Code. Alt-Code-Bedingungen nicht
still in neue Sperr-/Validierungs-/Berechnungs-Regeln mitziehen — jede
Abweichung vom Konzeptbeschluß ausdrücklich benennen. Vorfall BA 149:
Schieber-Prüfung aus dem alten `confirm()`-Dialog wurde still in die
neue Sperrregel übernommen, Sperre feuerte mit falscher Begründung.

**4. Ehrliche Reibung > reflexhafte Zustimmung.** Bei Vorschlägen des
Nutzers: erst prüfen, ob etwas dagegen spricht oder verloren geht,
bevor zugestimmt wird. Bei Geschmacksfragen offen sagen „beide
Varianten vertretbar", nicht eine als „besser" framen, um eine
Empfehlung abzugeben. Frühere Zustimmungen ruhig zurücknehmen, wenn
sie bei Überlegung zu schnell waren. Nicht ins Gegenteil verfallen
(künstliche Kritik) — gute Vorschläge auch als gut benennen.

Wenn eine vom Nutzer verfolgte Idee problematisch oder selbst-
widersprüchlich ist: klar sagen, mit Begründung. Nicht stillschweigend
mitlaufen, weil die Idee vom Nutzer kommt.

**5. UI-Sprache in Klärfragen an den Nutzer.** Martin sieht die
Oberfläche, nicht den Code. Klärfragen mit Code-Bezeichnern
(`statusGrid`, `pairIndicator`, `s.implant.thr`, …) sind für ihn
nicht beantwortbar.

Pflicht in jeder Klärfrage:
- Zuerst sagen, **worum es in der GUI geht**: was sieht der Nutzer
  auf dem Bildschirm, wie heißt das in der Oberfläche, welche
  Funktion erfüllt es. Beispiel: nicht „statusGrid", sondern
  „die Tabelle mit den Zwischenständen pro Elektrode".
- UI-Konsequenzen konkret beschreiben („diese Buttons rutschen
  dadurch zwischen Anzeige und Slider"), damit die Antwort
  treffbar ist.
- Code-Bezeichner nur zur Eindeutigkeit, in Klammern, nach der
  nutzersprachlichen Erklärung.

Selbstkontrolle vor jedem Senden: Antwort nach Code-Bezeichnern
durchscannen (Punkt-Notation, Variablen-/Funktionsnamen, Datei.js:Zeile,
CSS-Klassen, IDs). Jeder Fund braucht entweder eine UI-Übersetzung
davor oder eine Entfernung. Beim Schreiben von Bauanleitungen für
Sonnet bleiben Code-Begriffe natürlich erlaubt — die Regel gilt nur
für direkte Kommunikation mit dem Nutzer.

**6. Im Zweifel fragen, nicht annehmen.** Der Nutzer beschreibt seine
Wünsche aus User-Sicht und kann den Code nicht selbst prüfen. Eine
falsch verstandene Anforderung landet im Code und wird erst sichtbar,
wenn er nachbessern muß.

- Wenn ein Punkt unklar oder mehrdeutig ist: fragen statt annehmen.
- Lieber eine Rückfrage zu viel als eine versteckte Annahme.
- Mehrere Klärpunkte am Stück bündeln, damit der Nutzer in einem
  Schwung antworten kann.
- Naheliegende Annahmen offen benennen („ich nehme an X, sag
  Bescheid wenn nicht"), nicht stillschweigend übernehmen.
- Bei Fragen mit überschaubaren Optionen Entscheidungs-Vorschläge
  mitliefern, mit kurzer Begründung.


NUTZERKONTEXT
=============

Der Nutzer (Martin) trägt ein MED-EL CI rechts (Sonnet 3), etwas
Restgehör links. Wiedergabe über Bluetooth. Elektrode 12 fast stumm
(vom Audiologen stummgestellt), E11 verrauscht. Aktueller MAPLAW: 1000.
Kodierungsstrategie unklar (FSP/FS4). Die Projektdateien enthalten
außerdem Martins Brief an den Audiologen und das MAESTRO-Handbuch
(DE und EN) als Referenz.

Martin diskutiert in Opus, läßt Sonnet bauen. Er kann den Code nicht
selbst prüfen — siehe GRUNDHALTUNG Punkt 5 und 6.


ARBEITSWEISE
============

**Bauen NUR auf explizite Aufforderung „bauen".** Sonst besprechen.
Vor Bauarbeiten zuerst `docs/CODESTRUKTUR.md` lesen.

**Bauanleitung schreiben gilt als Bauphase.** Nicht vor expliziter
Aufforderung („bauen", „nächste Anleitung", „schreib das jetzt") und
nicht vor vollständiger Klärung aller offenen Punkte verfassen — auch
nicht „schon mal vorbereitend". Erkennungs-Heuristik vor Schreibstart:

- Gibt es noch eine `AskUserQuestion`, deren Antwort fehlt? → nicht
  schreiben.
- Steckt „angenommen", „vermutlich", „falls anders Bescheid" in den
  letzten Antworten? → nicht schreiben, sondern fragen.
- Hat der Nutzer die Freigabe gegeben? → wenn nein, nicht schreiben.
- Auch BA-Aufteilungstabellen sind verfrüht, solange Aufteilung nicht
  ausdrücklich verlangt wurde.

**Bei strukturellen Änderungen** (neue/entfernte JS-Datei, neue
zentrale Funktion, neue globale Variable, neuer Tab oder Sub-Tab,
verschobener `DOMContentLoaded`-Handler) `docs/CODESTRUKTUR.md` **im
selben Arbeitsschritt** mit aktualisieren, nicht nachträglich. Bei
Funktionsänderungen `docs/SPEC.md` (bzw. das passende Kapitel unter
`docs/spec/`) im selben Schritt mitaktualisieren.

Ein PostToolUse-Hook (`.claude/hooks/post-edit-reminder.sh`) feuert
nach jedem Edit/Write auf `.js`/`.html`/`.css` und blendet einen
Selbst-Check-Reminder ein. Der Hook ist eine Erinnerung an Claude, keine
Nachricht an den User. Wenn der Reminder erscheint und tatsächlich
strukturell oder funktional etwas geändert wurde: Referenzdateien
sofort anpassen, nicht aufschieben.

**Edits an freigegebener Bauanleitung.** Vor jedem Edit an einer
bereits ausgelieferten `BAUANLEITUNG_<n>_*.md` prüfen, ob die Anleitung
schon im Bau oder bereits gebaut ist:

1. `js/version.js` lesen UND nach einem charakteristischen Symbol der
   BA greppen.
2. Wenn die Symbole im Code stehen und die Version paßt → kein Edit
   ohne Rücksprache. Die Datei dokumentiert dann, was gebaut wurde;
   Änderungen wären irreführend.
3. Wenn die Anleitung noch Entwurf ist → Edit ist OK, aber kurz beim
   Nutzer Bescheid sagen.
4. `version.js` ist nur ein **Hinweis**, kein Beweis (Sonnet bumpt
   früh). Im Zweifel fragen: „BA X schon im Bau / gebaut?". Eine
   Einzeiler-Frage kostet weniger als eine destruktive
   Fehlentscheidung.

Bei Tippfehlern in einer gerade *selbst* in derselben Antwort
geschriebenen BA, die der Nutzer noch nicht gesehen hat: Edit ist OK,
kein Nachfragen nötig.

**Destruktive Aktionen.** Wenn ein „aufräumen"-Reflex aufkommt (Datei
löschen, BA verwerfen, alles neu schreiben), zweimal überlegen:

- Steckt in der Datei Arbeit, die wiederverwendet werden kann?
- Reicht es, sie umzubenennen, zurückzuhalten, zu kommentieren?
- Bei Unsicherheit einmal fragen, statt destruktiv handeln. Eine
  Frage kostet weniger als die Wiederholung der Arbeit.

Besonders gefährlich: reflexartiges „dann mache ich das jetzt gleich
wieder weg" nach Kritik des Nutzers — unter dem Eindruck, schnell
korrigieren zu müssen, geht oft Arbeit verloren, die sich rettbar wäre
(Beispiel BA 236: gelöschte EN/FR/ES-Übersetzungen, die zurückgestellt
hätten werden können).


KONZEPTBESPRECHUNG
==================

Konzeptbesprechung hat höchste Priorität im Projekt. Fehler in der
Konzeptphase werden in der Bauphase in Code zementiert und kosten dort
mehrfach mehr als die Lese- und Denkzeit, die sie vorher gekostet
hätten.

Die zentralen Konzept-Regeln stehen schon in GRUNDHALTUNG (Sorgfalt,
Nicht-Raten, Code > SPEC, Ehrliche Reibung). Konzept-spezifisch ergänzt:

- **Vermutungen markieren oder nachsehen.** „aus dem Kopf",
  „vermutlich", „so wie ich es in Erinnerung habe" sind in der
  Konzeptphase nicht ausreichend. Entweder nachsehen oder die
  Unsicherheit explizit benennen, bevor sie in Empfehlungen einfließt.
- **Manuals und Papers in `.manuals/` lesen**, nicht nur zitieren. Bei
  methodischen Fragen (Pitch Matching, Loudness Balancing, MAPLAW etc.)
  ist das Paper-Material die zuverlässige Quelle, nicht die Erinnerung
  an frühere Chats. Siehe Memory `reference_pieper_2022` als Beispiel.
- **Bei Konzept-Triggern** („besprechen", „denken wir nach", „idee",
  „grundsätzlich", „konzept", „ansatz"): relevante Code-Dateien und
  Spec-Kapitel lesen, bevor empfohlen wird. Sparsamkeitsregeln aus
  EFFIZIENZ gelten hier **nicht**.


BAUANLEITUNGEN
==============

**Wann.** Nur auf explizite Aufforderung, nach vollständiger Klärung —
siehe ARBEITSWEISE.

**Aufteilung: kleine BAs sind Default.** Bei BA-Aufteilungsfragen ist
die kleinste sinnvolle Aufteilung das Recommended-Default. Eine große
BA ist nur dann erste Wahl, wenn die Teile wirklich untrennbar verzahnt
sind (z.B. ein einziger Refactoring-Schritt mit fünf zwangsläufig
synchronen Edits). Bei „Reparatur entlang Modul-Grenzen" oder
„Wiederholungs-Pattern über mehrere Module" ist Aufteilung fast immer
richtig.

Wenn ich Klärfragen mit „(Recommended)" anbiete, darf das Recommended
nicht reflexhaft die zusammengefaßte Variante markieren. Eine
„(Recommended)" wirkt als Anchor — der Nutzer übernimmt sie oft, auch
wenn sie der Projekt-Linie widerspricht.

**Scope-Wachstum während Direkt-Bau.** Wenn ein Direkt-Bau anfangs
klein wirkt aber während der Arbeit deutlich erweitert wird, neu
bewerten. Anker-Punkte:

- Scope weitet sich von 1-2 Dateien auf >3 aus.
- Es entsteht ein Wiederholungs-Pattern auf mehreren Modulen.
- Helper aus dem ersten Bauschritt sollen wiederverwendet werden.

Dann dem Nutzer ansagen: „der Scope ist gewachsen, ich schlage vor,
ab hier eine Bauanleitung für Sonnet zu schreiben." Nicht
stillschweigend weiter durchziehen.

**i18n / Übersetzungen.** Übersetzungen für `i18n/en.js`, `i18n/fr.js`,
`i18n/es.js` werden **nur produziert, wenn der Nutzer ausdrücklich
darum bittet** — nicht innerhalb einer normalen BA mitnehmen, nicht als
Folge-BA voraus-schreiben, nicht „proaktiv" anbieten, keine
Wort-/Satz-Schwelle.

Begründung: Deutsche UI-Texte werden während der Iteration mehrfach
umformuliert. Jede vorzeitig produzierte Übersetzung wird weggeworfen,
sobald der deutsche Text sich nochmal ändert.

In der BA bleibt es bei der i18n-Disziplin: `data-t="someKey"` im HTML,
`t("someKey")` im JS, `applyLang()` nach dynamischem Render. Das ist
Infrastruktur, kein Übersetzungsschritt — gehört immer dazu. Fehlende
Keys in `en.js`/`fr.js`/`es.js` fallen automatisch auf den deutschen
Default zurück.

Am Ende einer rein-DE-BA neutraler Hinweis: „Die anderen Sprachen sind
nicht angefaßt; Übersetzungen folgen, wenn der Nutzer dazu auffordert."
Nicht fragen „soll ich übersetzen?".

**Format-Vorgaben.** Konkrete Snippets, Skeleton-Code, Akzeptanztest,
Selbstprüfungs-Auftrag, ASCII-Quotes, Pflicht-Versionsbump: siehe
`docs/BAUANLEITUNGEN_LEITLINIEN.md`. Diese Datei nur lesen, wenn
tatsächlich eine BA verfaßt wird.


VERSIONIERUNG
=============

Verbindlich für **jede** Code-Änderung in `js/`, `index.html`,
`style.css` oder anderen Laufzeit-Dateien — egal ob durch Direkt-Edit,
Agent-Build oder Sonnet-Bauanleitung:

- **`APP_VERSION` in `js/version.js` hochzählen**, sobald an
  Laufzeit-Code etwas verändert wurde. Format:
  `"<Major>.<Minor>.<BA-Nummer>[.<Fix>]-beta"`. Ohne Bump bleibt der
  Browser-Cache bei der alten Version hängen und der Nutzer sieht die
  Änderung nicht. Reine Doku-Änderungen (`*.md`, `docs/`) lösen
  **keinen** Bump aus.

Bedeutung der Stellen:

- **Major / Minor**: manuell bei semantischen Brüchen (Architektur,
  Lizenz, große Verfahrensumstellung). Beim Minor-Bump bleibt die
  BA-Nummer der dritten Stelle erhalten — sie wird **nicht** auf 0
  zurückgesetzt.
- **BA-Nummer (dritte Stelle)**: zeigt auf die zugehörige Bauanleitung.
  Wird **nur** bei einer neuen Bauanleitung um 1 erhöht. Bleibt bei
  reinen Fixes / Lizenzwechsel / Direkt-Edits ohne BA unverändert.
- **Fix-Suffix `.n` (vierte Stelle, optional)**: Bugfixes, kleine
  Korrekturen und sonstige Code-Änderungen ohne eigene BA hängen `.1`,
  `.2`, … an die aktuelle BA-Nummer. Damit bleibt die BA-Nummer in
  der dritten Stelle als Anker konsistent mit den Dateinamen im
  `.bauanleitungen/`-Ordner. Beispiel: nach `3.1.181-beta` wird ein
  Bugfix-Edit zu `3.1.181.1-beta`, der nächste zu `3.1.181.2-beta`.
  Mit der nächsten Bauanleitung springt es auf `3.1.182-beta`
  (Fix-Suffix entfällt wieder).

**BA-Nummer-Vergabe.** Eine neue BA bekommt die Nummer = dritte Stelle
aus `js/version.js` + 1 (Fix-Suffix ignorieren). **Nicht** aus der
letzten BA-Datei oder dem letzten Commit ableiten — Versions-Stand und
BA-Datei können auseinanderlaufen. Maßgeblich ist immer `version.js`.
Beispiel: `3.2.181.2-beta` → nächste BA-Nummer 182, Ziel-Version nach
Build `3.2.182-beta`.

Dateiname-Konvention: `BAUANLEITUNG_<BA-Nummer>_<thema>.md` im Ordner
`.bauanleitungen/`. Der Bump in `version.js` ist Pflichtbestandteil
jeder Anleitung.


FEHLERMELDUNGEN UND DEBUGGING
=============================

Wenn der Nutzer ein Problem meldet:

- Knapp nachfragen mit Verweis auf das Bug-Report-Template in
  `docs/DEBUG.md`, falls die Beschreibung Lücken hat (Wo / Aktion /
  Erwartet / Tatsächlich / Konsole).
- Konsolen-Ausgabe zuerst holen, bevor durch den Code gewandert wird —
  spart oft eine ganze Such-Schleife.
- Wenn ein Konsole-Befehl die Diagnose abkürzen kann, dem Nutzer als
  kopierbaren Einzeiler geben.
- **Befehle immer ins Clipboard kopieren**, nicht nur anzeigen:
  `echo "BEFEHL" | xclip -i -selection clipboard`. Lange Befehle
  brechen im Terminal um und sind nicht direkt in die Browser-Konsole
  einfügbar. Clipboard-Kopie funktioniert zuverlässig. Gilt für jeden
  Konsolen-Befehl, auch kurze.
- Bei lesenden Befehlen (`console.log(...)`, `JSON.stringify(...)`):
  klar als Diagnose markieren. Bei verändernden Befehlen vorab klar
  sagen, was sie tun.

**Syntaxfehler nach BA-Build.** Wenn nach einer ausgeführten
Bauanleitung ein Syntaxfehler aus der Browser-Konsole gemeldet wird:
im **selben Sonnet-Chat** beheben lassen, nicht in einem neuen Chat.
Sonnet hat die gerade geänderten Dateien und die BA-Intention noch im
Kontext; ein frischer Chat müßte erst CLAUDE.md, ggf. CODESTRUKTUR.md
und die Datei zur Orientierung lesen — diese Startup-Kosten sind höher
als der Overhead durch die mitgeschickte Chat-Historie.

Ausnahmen:
- Chat ist schon sehr lang (mehrere Iterationen) → neuer Chat mit
  „BA X wurde ausgeführt, jetzt diese Konsolen-Meldung: …".
- Der „Syntaxfehler" entpuppt sich als Logikfehler oder zieht Module
  außerhalb der BA mit rein → neues Debugging-Thema, neuer Chat.

Die Standardregel „Opus und Sonnet nicht im selben Chat mischen" bleibt
davon unberührt — hier geht es um Sonnet-Chat fortsetzen vs. neuen
Sonnet-Chat.


REFERENZDATEIEN
===============

- **docs/CODESTRUKTUR.md** — Modulübersicht, Ladereihenfolge,
  Querverweise, Edit-Szenarien. Vor jedem nicht-trivialen Edit lesen.
- **docs/SPEC.md + docs/spec/** — Funktionsspezifikation. `docs/SPEC.md`
  ist ein schlanker Index mit Eckdaten und Verweisen auf neun Kapitel
  unter `docs/spec/` (Tabs, Messungen, Implantat, Schieber, Kurven,
  Player, Laden/Speichern, Drucken, Warteliste). **Bei Arbeiten an
  einem konkreten Bereich nur das passende Kapitel lesen, nicht die
  ganze Spec.**
- **docs/DEBUG.md** — Browser-Konsole, Network-Tab, Bug-Report-Template,
  Konsolen-Befehle für den Nutzer. Bei Fehlermeldungen dorthin
  verweisen oder passende Schritte zitieren.
- **docs/IDEEN.md** — Konzept-Skizzen und Erweiterungs-Ideen, die noch
  nicht abgesegnet oder reif sind. Abgrenzung zu `docs/SPEC.md`: SPEC
  beschreibt, was gebaut wird oder fest zur Umsetzung ansteht; IDEEN
  sammelt, was diskutiert wird oder langfristig denkbar ist. Bei neuen
  Ideen, die nicht sofort gebaut werden, dort eintragen. Beim Übergang
  in die Umsetzung: aus IDEEN entfernen und in SPEC übernehmen.
- **docs/Berechnungsgrundlagen dB zu CI.md** — Mathematische Grundlagen
  und Formeln für die Umrechnung von dB-Korrekturen in
  herstellerspezifische Einheiten (MED-EL qu, Cochlear CL, Advanced
  Bionics CU). Quellen, Vorbehalte, Mapping-Funktionen. Wird bei jeder
  Arbeit am Druck, am Levels-Tab im Absolutmodus oder an der
  MAPLAW-Simulation benötigt. Implementierung in `core.js` (`calcMedel`,
  `calcCochlear`, `calcAB`).
- **docs/Konzept_Frequenzwarping_und_EQ.md** — Konzeptionelle Grundlagen
  der Audio-Pipeline des Players: Wirkungsrichtung des Warpings,
  modus-abhängige Filter-Position des EQ, Pipeline-Reihenfolge. Vor
  jeder Arbeit an Warp-Wirkungsrichtung, EQ-Filter-Position oder
  Pipeline-Reihenfolge lesen.
- **docs/Konzept_Audio_Manifest.md** — Manifest-Format und
  Webspace-Struktur der Audio-Bibliotheken (Musik, Sätze, Hörbücher,
  Geräusche). Vor jeder Arbeit an Audio-Bibliotheken, Player-Quellen-
  Toggle, Embed-Neugenerierung oder Manifest-Erzeugung lesen.
- **docs/Audio_Tag_Katalog.md** — Zulässige Tag-Felder und kontrolliertes
  Vokabular pro Kategorie. Beim Anlegen neuer Manifeste oder neuer
  Tag-Werte hier ergänzen, damit Filter-Synonyme vermieden werden.
- **docs/BAUANLEITUNGEN_LEITLINIEN.md** — Format-Vorgaben für
  Sonnet-Bauanleitungen (Snippets, Skeleton, Akzeptanztest,
  Selbstprüfung, ASCII-Quotes, Aufteilung). Nur lesen, wenn tatsächlich
  eine BA verfaßt wird.


TERMINOLOGIE
============

- **„Schieber" statt „Presets"** in UI, Texten, Bauanleitungen und
  Diskussion. Der Variablenname `presets` in `state-side.js` ist nur
  noch historisch und bleibt intern — aber nicht in nutzerseitigem
  Text. Nicht aus eigener Initiative umbenennen (Refactor nur auf
  expliziten Auftrag).
- **testUI-API**: Sub-Reiter unter „Messungen" nutzen die testUI-API
  verbindlich. Wenn ein Verfahren etwas braucht, das die API nicht
  abbildet, wird **die API erweitert**, nicht im einzelnen Modul per
  Override/DOM-Patch umgangen. Siehe
  `docs/spec/00-testui-architektur.md`, Abschnitt „Notausgang-Prinzip".


EFFIZIENZ
=========

Diese Regeln dienen dem begrenzten Wochen-Volumen des Pro-Abos. Sie
gelten **untergeordnet** zur GRUNDHALTUNG: Sparsamkeit ist Mittel,
nicht Zweck. In Konzeptphasen, bei Code-Aussagen und bei Unsicherheit
gilt sie nicht — siehe Punkt 1 und 2 der GRUNDHALTUNG.

Wo Sparsamkeit angemessen ist:

- **Referenz-Dateien nur lesen, wenn nötig.** Bei trivialen Edits
  (String ersetzen, Tippfehler, eine bekannte Funktion ändern) reicht
  der Direkt-Edit. Die „vor jedem nicht-trivialen Edit lesen"-Regel
  aus REFERENZDATEIEN gilt streng — bei trivialen Edits eben nicht.
- **Gezielte File-Reads bei großen Dateien.** `lr-balance.js`,
  `i18n.js`, `index.html` nicht pauschal von oben lesen. Erst per
  `grep` die relevante Zeile finden, dann mit `offset`/`limit` nur
  den nötigen Ausschnitt einziehen.
- **Sonnet als Agent** für isolierte Subtasks mit klarem Scope
  (parallele Code-Suche, mechanische Refactorings). Nicht für
  Kleinaufgaben — das Briefing kostet dann mehr Tokens als die
  Aufgabe.
- **DeepSeek vorschlagen** bei reinen Wissensfragen (Hersteller-
  Mechaniken, Audiologie-Theorie, allgemeine Recherche). Bei Code-
  und Projektfragen bleibt es bei Claude.
- **Opus und Sonnet nicht im selben Chat mischen.** Standardfall: Hat
  Opus eine BA geschrieben, übernimmt ein neuer Sonnet-Chat das Bauen.
  **Ausnahme**: komplexe vernetzte Refactorings, bei denen Drift früh
  erkannt werden muß — dann darf Opus Sonnet als Agent direkt aus dem
  Opus-Chat aufrufen (Subagenten haben eigenen Kontext). Bei vielen
  Iterationen den Opus-Chat-Kontext im Auge behalten und ggf. ab einem
  Punkt doch auf BA + neuer Sonnet-Chat wechseln.
- **Nach abgeschlossenem Thema `/clear` empfehlen.** Lange Chats werden
  teuer, weil ältere Nachrichten mit jeder neuen mitgeschickt werden.
