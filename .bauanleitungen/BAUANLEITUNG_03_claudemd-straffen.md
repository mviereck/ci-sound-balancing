# BAUANLEITUNG 03 — CLAUDE.md straffen, Bauanleitungs-Regeln auslagern

## Ziel

CLAUDE.md ist die einzige Datei, die bei **jedem** Chat-Start
automatisch in den Kontext geladen wird. Jede Zeile darin
zählt — auch wenn der aktuelle Chat gar keine Bauanleitung
schreibt.

Der Abschnitt "BAUANLEITUNGEN FÜR SONNET" (rund 40 Zeilen) wird
nur beim Verfassen einer Sonnet-Bauanleitung gebraucht. Er wandert
in eine eigene Datei `BAUANLEITUNGEN_LEITLINIEN.md`, die nur dann
gelesen wird, wenn sie wirklich relevant ist. CLAUDE.md verweist
nur noch kurz darauf.

Inhaltlich ändert sich **nichts** — der Text steht nur woanders.

## Vorab lesen

- **Diese Bauanleitung** komplett.
- **`CLAUDE.md`** komplett (ist nur ~142 Zeilen).

## Vorgehen

### Schritt 1 — Neue Datei `BAUANLEITUNGEN_LEITLINIEN.md` anlegen

Im Repo-Root. Die Datei enthält **eine einleitende Überschrift**
plus den vollständigen, **1:1 kopierten** Inhalt des heutigen
Abschnitts "BAUANLEITUNGEN FÜR SONNET" aus CLAUDE.md.

Struktur:

```markdown
# Leitlinien für Bauanleitungen an Sonnet

Diese Datei nur lesen, wenn eine Sonnet-Bauanleitung verfaßt
werden soll. Sie ist aus CLAUDE.md ausgelagert, damit CLAUDE.md
bei jedem Chat-Start nicht 40 Zeilen mitschleppt, die nur in
einem schmalen Teil der Arbeit gebraucht werden.

<HIER kommt der ausgelagerte Block 1:1 hinein.
Der Block beginnt mit der Überschrift "BAUANLEITUNGEN FÜR SONNET"
(Setext-Style mit Unterstreichungs-Zeile aus Bindestrichen) und
endet mit der letzten Zeile "ist das Signal zur Rückfrage, nicht
zur stillen Annahme.">
```

**Strikte Kopier-Regeln:**

- Inhalt unverändert übernehmen.
- Aufzählungszeichen, Einrückung, Code-Blöcke, Anführungszeichen,
  Umlaute, Zeilenumbrüche **bleiben identisch**.
- Die Setext-Überschrift "BAUANLEITUNGEN FÜR SONNET" mit der
  Bindestrich-Linie darunter kannst du beibehalten **oder** auf
  `## Bauanleitungen für Sonnet` umsetzen (beides erlaubt, weil
  die neue Datei einen eigenen Markdown-Kontext hat). Beim Rest
  des Blocks nichts ändern.

### Schritt 2 — CLAUDE.md anpassen

Im heutigen CLAUDE.md den Abschnitt "BAUANLEITUNGEN FÜR SONNET"
(beginnt etwa bei Z. 102, endet etwa bei Z. 143 — exakte Grenzen
kannst du anhand der Setext-Überschrift "BAUANLEITUNGEN FÜR SONNET"
und der nächsten Setext-Überschrift / dem Datei-Ende finden)
**komplett entfernen** und durch folgenden kurzen Verweis
ersetzen:

```markdown
BAUANLEITUNGEN FÜR SONNET
-------------------------

Vor dem Verfassen einer Sonnet-Bauanleitung
`BAUANLEITUNGEN_LEITLINIEN.md` lesen. Dort stehen Format-
Vorgaben, Pflichtbestandteile (Akzeptanztest, Selbstprüfungs-
Auftrag), Aufteilungs-Regeln und die Anweisung zum Volumen-
Sparen durch kleine, nummerierte Anleitungs-Dateien.
```

Position bleibt gleich (am alten Ort, wo der Block stand).

### Schritt 3 — Referenzdateien-Liste in CLAUDE.md ergänzen

Im Abschnitt "REFERENZDATEIEN" am Anfang von CLAUDE.md
einen neuen Eintrag hinzufügen — sinnvolle Position: am Ende
der Liste, nach `Berechnungsgrundlagen dB zu CI.md`.

Format wie die anderen Einträge:

```markdown
- **BAUANLEITUNGEN_LEITLINIEN.md** — Format-Vorgaben für
  Sonnet-Bauanleitungen (Snippets, Skeleton, Akzeptanztest,
  Selbstprüfung, Aufteilung in kleine Dateien). Nur lesen,
  wenn tatsächlich eine Bauanleitung verfaßt wird, nicht
  bei jedem Chat-Start.
```

## Was du NICHT tust

- Du **veränderst keinen** Inhalt des ausgelagerten Blocks.
  Keine Umformulierung, keine "Modernisierung", keine
  zusätzlichen Hinweise.
- Du **rührst keinen anderen Abschnitt** von CLAUDE.md an
  (nicht Nutzerkontext, nicht Arbeitsweise, nicht Aktive
  Rückfragen, nicht Fehlermeldungen).
- Du **erfindest keine** neuen Regeln in
  `BAUANLEITUNGEN_LEITLINIEN.md`. Nur der ausgelagerte Block
  plus die kurze Einleitung.
- Du **rührst keine** `.js`/`.html`/`.css`-Datei an. Auch
  nicht CODESTRUKTUR.md, SPEC.md, IDEEN.md, DEBUG.md.

## Akzeptanztest (für den Nutzer)

1. **Datei `BAUANLEITUNGEN_LEITLINIEN.md` im Editor öffnen**
   → erwartet: kurzer Einleitungssatz, dann der vollständige
   Bauanleitungs-Block, identisch zum bisherigen CLAUDE.md-
   Abschnitt.
2. **CLAUDE.md im Editor öffnen** → erwartet: keinerlei
   detaillierte Bauanleitungs-Regeln mehr. Stattdessen am alten
   Ort ein kurzer Verweis (4–5 Zeilen) auf die ausgelagerte
   Datei. Die Datei ist deutlich kürzer als vorher (Größenordnung
   100–110 Zeilen statt 142).
3. **Im Abschnitt "REFERENZDATEIEN"** taucht
   `BAUANLEITUNGEN_LEITLINIEN.md` als zusätzlicher Eintrag auf.
4. **Diff-Zusammensetzung**: Wenn du `BAUANLEITUNGEN_LEITLINIEN.md`
   und das neue CLAUDE.md zusammenführst (also den ausgelagerten
   Block wieder reinkopierst), entspricht das inhaltlich dem
   alten CLAUDE.md plus dem neuen Referenzdateien-Eintrag.

## Selbstprüfung vor der Fertig-Meldung

Gehe jeden Punkt einzeln durch und melde *erfüllt / nicht
erfüllt / unklar*, jeweils mit Datei- und Zeilenangabe der
relevanten Stelle.

1. Datei `BAUANLEITUNGEN_LEITLINIEN.md` existiert im Repo-Root.
2. Sie enthält die ausgelagerten Bauanleitungs-Regeln vollständig
   (alle Aufzählungspunkte, Code-Beispiele, Schlußhinweise).
3. CLAUDE.md enthält **keine** detaillierten Bauanleitungs-Regeln
   mehr — nur den kurzen Verweis am alten Ort.
4. CLAUDE.md-Abschnitt "REFERENZDATEIEN" listet
   `BAUANLEITUNGEN_LEITLINIEN.md` als zusätzlichen Eintrag.
5. CLAUDE.md ist kürzer als vorher (Zeilenanzahl angeben).
6. **Diff-Konsistenz**: Inhaltlich nichts verloren, nichts
   verändert (außer der Auslagerung und dem neuen Verweis).
7. Keine `.js`/`.html`/`.css`-Datei, kein anderes `.md` außer
   CLAUDE.md und der neuen Datei wurden angefaßt.

Wenn ein Punkt **unklar** ist, frage **vor** der Fertig-Meldung
beim Nutzer nach. Stille Annahmen sind in diesem Projekt teurer
als Rückfragen.
