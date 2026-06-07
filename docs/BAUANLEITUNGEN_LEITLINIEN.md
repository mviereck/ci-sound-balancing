# Leitlinien für Bauanleitungen an Sonnet

Diese Datei nur lesen, wenn eine Sonnet-Bauanleitung verfaßt
werden soll. Sie ist aus CLAUDE.md ausgelagert, damit CLAUDE.md
bei jedem Chat-Start nicht 40 Zeilen mitschleppt, die nur in
einem schmalen Teil der Arbeit gebraucht werden.

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

i18n / Übersetzungen — pro Bauanleitung klären:
- Vor jeder Bauanleitung mit UI-Texten klärt Opus mit dem Nutzer, ob
  die Übersetzungen (en/fr/es) in derselben Anleitung mitlaufen oder
  als kleine Folge-Anleitung nachgezogen werden. Der Nutzer kann das
  auch von sich aus festlegen, ohne daß Opus gefragt hat.
- **Default-Empfehlung: nur Deutsch in der Anleitung**, Übersetzungen
  als Folge-Anleitung. Grund: GUI-Texte werden während der Iteration
  mehrfach umformuliert, bis die deutsche Vorlage steht. Jede
  Iteration, bei der die anderen drei Sprachen mitgeführt werden,
  kostet Volumen für Bauen und Nachpflegen, ohne daß der Nutzer
  den Mehrwert sieht.
- **Ausnahme „alle Sprachen mitnehmen"** ist sinnvoll, wenn der Block
  an neuen Texten ungewöhnlich umfangreich ist (z.B. 20+ Strings) und
  die deutsche Formulierung schon stabil wirkt — dann sparen Sonnet
  und Nutzer sich das Hin und Her zwischen zwei BAs. Diese Variante
  wird **nur** gewählt, wenn der Nutzer sie ausdrücklich anordnet.
- **Was unabhängig vom Sprachumfang gemacht wird:** Der Code muß
  von Anfang an i18n-fähig sein. Heißt: `data-t="someKey"` im HTML,
  `t("someKey")` im JS, `applyLang()`-Aufruf nach dynamischen Renders.
  Bei „nur Deutsch" bleiben die anderen Sprachdateien (`en.js`,
  `fr.js`, `es.js`) unverändert — fehlende Keys fallen dann auf die
  deutschen Defaults zurück (Verhalten in `js/i18n.js` prüfen, falls
  unklar).
- **Bei „nur Deutsch": Hinweis am Ende der Bauanleitung** auf eine
  künftige Mini-Anleitung „Übersetzungen für XYZ" — nicht als
  Pflicht-Folge, der Nutzer entscheidet wann.

Pflichtbestandteile jeder Bauanleitung:
- **Akzeptanztest-Checkliste am Ende**: Klick-für-Klick-Schritte, die
  der Nutzer ohne Code-Kenntnisse durchgehen kann, mit erwartetem
  Verhalten pro Schritt. Beispiel: "Tab Messungen → Sub-Tab
  Stereo-Balance → ‚Test starten' klicken → erwartet: roter Stop-
  Button aktiv, Voreinstellungen ausgegraut, Test-Block sichtbar."
- **Selbstprüfungs-Auftrag an Sonnet**: am Ende jedes Builds soll
  Sonnet **vor der Fertig-Meldung** jede Akzeptanz-Kriterie einzeln
  durchgehen und für jede melden: erfüllt / nicht erfüllt / unklar,
  mit Datei- und Zeilenangabe der relevanten Stelle. Wenn Sonnet
  selbst etwas als unklar markiert, ist das Signal zur Rückfrage,
  nicht zur stillen Annahme.
- **Versionsnummer hochzählen**: Jede Bauanleitung muß als
  expliziten Schritt enthalten, in `js/version.js` die Konstante
  `APP_VERSION` auf `"<Major>.<Minor>.<Bauanleitungsnummer>-beta"`
  zu setzen. Die ersten beiden Stellen (`Major.Minor`) werden
  **nur manuell** geändert (bei semantischen Brüchen). Die
  Bauanleitungsnummer wird **immer** weitergezählt, unabhängig
  von Major/Minor — z.B. Bauanleitung 62 → `"3.0.62-beta"`,
  Bauanleitung 63 → `"3.0.63-beta"`. Ohne diesen Bump bleibt
  der Browser-Cache bei der alten Version hängen und die Nutzer
  sehen die Änderung nicht. Der Schritt gehört an den Anfang
  oder ans Ende der Anleitung, nicht in die Mitte (sonst leicht
  übersehen).

Bau-Diagnose-Tests (optional, ab Bauanleitung 83)
-------------------------------------------------

Eine Bauanleitung darf einen temporären Test registrieren, mit dem
Sonnet das Laufzeit-Verhalten im Browser indirekt prüfen kann.
Workflow: Sonnet legt den Test ab, der Nutzer öffnet das
Debug-Panel und führt den Test aus, kopiert die Markdown-Ausgabe
über den Sektion-Copy-Knopf zurück an Sonnet. Sonnet vergleicht
mit der Erwartung und meldet Befund.

**Wann sinnvoll:**
- Wenn die Akzeptanz nicht offensichtlich aus dem Diff hervorgeht
  (z.B. Init-Reihenfolge, dynamisches DOM, Werte globaler
  Variablen zu einem Zeitpunkt).
- Wenn ein UI-Schritt sich programmatisch ohne Maus/Tastatur
  prüfen läßt (Existenz von Elementen, Klassen-Zustände, State-
  Werte).

**Wann NICHT:**
- Bei reinen UI-Anpassungen (Layout, Farben, Texte): die Akzeptanz-
  Checkliste der Bauanleitung reicht.
- Bei Tests, deren grünes Ergebnis nur den Bau selbst bestätigt
  und nichts über das Laufzeit-Verhalten aussagt (z.B. „Funktion
  X existiert"). Solche Tests sind selbstbestätigend und gehören
  in Sonnets Selbstprüfungs-Auftrag, nicht ins Panel.

**Konvention für Bau-Diagnose-Tests:**
- Test-Name beginnt mit `build/BAxx/`, gefolgt von einem kurzen
  Topic, z.B. `build/BA84/maplaw-init`.
- `opts.tab` setzt die Tab-Zuordnung, damit der Test bei aktivem
  Tab automatisch angehakt ist (siehe BA 82).
- `opts.label` als kurzes deutsches Label, das den Test im Panel
  beschriftet.
- Die Test-Definition liegt als eigener IIFE-Block in
  `js/debug-tests-current.js`. Klar kommentiert mit
  Bauanleitungs-Nummer am Anfang des Blocks.

**Workflow zwischen Sonnet und Nutzer:**
1. Sonnet baut die Bauanleitung um und legt parallel den Bau-
   Diagnose-Test in `js/debug-tests-current.js` an.
2. In seinem Build-Bericht weist Sonnet auf den Test hin und
   bittet den Nutzer, das Debug-Panel zu öffnen, den Test
   auszuführen (▶ alle oder ↻ einzeln) und den Sektion-Copy
   „Tests" zurückzuschicken.
3. Sonnet wertet die Markdown-Ausgabe aus und meldet Befund.
4. Bei Akzeptanz fragt Sonnet **aktiv** nach, ob der Test:
   (a) ersatzlos entfernt werden soll, oder
   (b) ins Archiv unter `archive/debug-tests/BAxx_<topic>.js`
       verschoben werden soll.
5. Sonnet führt die gewählte Aktion aus, bevor die Bauanleitung
   final geschlossen wird.

**Aufräum-Regel:** `js/debug-tests-current.js` darf am Ende
einer abgenommenen Bauanleitung **keinen** Test aus eben dieser
Bauanleitung mehr enthalten. Tests aus laufenden, noch nicht
abgenommenen Bauanleitungen dürfen parallel drin liegen.

**Archivierung:** Eine archivierte Test-Datei ist ein eigenständiger
IIFE im selben Format wie ein Block in
`js/debug-tests-current.js`, ergänzt um einen Kommentarkopf:

```js
/* archiviert YYYY-MM-DD aus Bauanleitung BAxx — kurze
 * Begründung, warum der Test aufgehoben wurde (z.B.
 * „nochmal nützlich, falls Init-Reihenfolge wieder
 * umgestellt werden sollte").
 */
```

Reaktivierung: Inhalt in `js/debug-tests-current.js`
zurückkopieren, neu laden, fertig. Die Archiv-Datei bleibt
unverändert liegen.

Häufige Fallen in Anleitungs-Snippets (Lessons learned ab BA 84)
-----------------------------------------------------------------

Diese vier Klassen von Anleitungs-Fehlern haben in BA 84 jeweils
einen Bug verursacht. Vor Versand jeder Bauanleitung gegenchecken:

- **State-Mutation vs. Reassignment in Funktions-Parametern**:
  Wenn eine Funktion einen State-Parameter erhält und dessen
  Properties verändern soll, NIE per Reassignment (`state.foo = bar`)
  ersetzen, wenn der Aufrufer die Änderung sehen soll. Reassignment
  ändert nur die Property im übergebenen Wrapper-Objekt, nicht das
  Original-Array/Objekt des Aufrufers. Entweder konsequent in-place
  mutieren (`state.foo.length = 0; state.foo.push(...neu)` für
  Arrays) oder eine Rückgabewert-API wählen, bei der der Aufrufer
  explizit zurückschreibt. Anleitungs-Kommentare wie „wird in-place
  mutiert" müssen tatsächlich stimmen — sie decken sonst den Bug zu.

- **Edge-Cases bei neuen Code-Pfaden explizit benennen**:
  Wenn ein neuer Anwendungsfall (z.B. „Adaptiv-Lauf ohne fertige
  `fRes`-Einträge") Heuristiken aus dem Altcode unter ungewohnte
  Eingangsbedingungen stellt, in der Anleitung den Edge-Case
  ausdrücklich erwähnen und prüfen, ob die alte Heuristik dort
  noch greift. Nicht stillschweigend übernehmen.

- **Anführungszeichen in i18n-Strings**:
  In Snippets für `i18n/de.js`-Strings entweder durchgängig
  typographische Anführungszeichen („…") verwenden oder das ASCII-
  `"` mit `\"` escapen. Mischformen wie `"...mit „?" ..."` brechen
  den JS-Parser, weil das innere `"` als Stringterminator gelesen
  wird. Vor Versand der Anleitung jeden i18n-String einmal per
  Auge auf reine `"`-Zähl-Konsistenz durchsehen.

- **Zwei Schwellen aus zwei Fragerunden = zwei Konstanten**:
  Wenn der User in getrennten Klärungsrunden zwei verwandte aber
  unterschiedliche Schwellen festlegt (z.B. „Schätzwert ab N",
  „Residuum ab M"), MÜSSEN in der Anleitung zwei separate Konstanten
  und zwei separate Code-Pfade auftauchen. Sammeln in einer
  Konstante verschleiert die Entscheidung und löscht eine der
  beiden Schwellen still aus. Vor Versand prüfen: jede in den
  Fragerunden gefallene Zahl im Code/Snippet wiederfinden.
