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

i18n / Übersetzungen — nur Deutsch in Bauanleitungen:
- Bauanleitungen, die UI-Texte einführen oder ändern, legen **nur
  die deutschen Strings** in `i18n/de.js` an. Englisch, Französisch
  und Spanisch werden **nicht** in derselben Anleitung ergänzt.
- Grund: GUI-Texte werden während der Iteration mehrfach umformuliert,
  bis die deutsche Vorlage steht. Jede Iteration, bei der die anderen
  drei Sprachen mitgeführt werden, kostet Volumen für Bauen und
  Nachpflegen, ohne daß der Nutzer den Mehrwert sieht. Die anderen
  Sprachen werden in einer eigenen kleinen Anleitung nachgezogen,
  wenn die deutsche GUI-Vorlage durch ist.
- **Was trotzdem in der Bauanleitung gemacht wird:** Der Code muß
  von Anfang an i18n-fähig sein. Heißt: `data-t="someKey"` im HTML,
  `t("someKey")` im JS, `applyLang()`-Aufruf nach dynamischen Renders.
  Die anderen Sprachdateien (`en.js`, `fr.js`, `es.js`) bleiben
  unverändert — fehlende Keys fallen dann auf die deutschen
  Defaults zurück (Verhalten in `js/i18n.js` prüfen, falls
  unklar).
- **Hinweis am Ende der Bauanleitung** auf eine künftige Mini-
  Anleitung „Übersetzungen für XYZ" — nicht als Pflicht-Folge, der
  Nutzer entscheidet wann.

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
  `APP_VERSION` auf `"2.<Bauanleitungsnummer>-beta"` zu setzen
  (z.B. Bauanleitung 58 → `"2.58-beta"`). Ohne diesen Bump bleibt
  der Browser-Cache bei der alten Version hängen und die Nutzer
  sehen die Änderung nicht. Der Schritt gehört an den Anfang oder
  ans Ende der Anleitung, nicht in die Mitte (sonst leicht
  übersehen).
