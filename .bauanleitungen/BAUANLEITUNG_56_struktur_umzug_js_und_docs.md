# Bauanleitung 56 — Struktur-Umzug: JS-Dateien nach `js/`, Doku nach `docs/`

## Worum es geht

Das Wurzelverzeichnis ist überladen mit losen JavaScript-Dateien und
Markdown-Dokumenten. Aufräumen:

- **Alle JS-Logikdateien aus dem Root** wandern in einen neuen Ordner
  `js/`. **Ausnahmen:** Der Ordner `i18n/` (Sprachdaten) bleibt am
  Platz; nur `i18n.js` selbst (die Loader-Logik im Root) wandert mit
  nach `js/`.
- **Ausgewählte Dokumentations-Dateien** wandern in einen neuen Ordner
  `docs/`. **Mit umziehen:** `BAUANLEITUNGEN_LEITLINIEN.md`, `SPEC.md`
  und der Ordner `spec/`, `CODESTRUKTUR.md`, `IDEEN.md`. **Im Root
  bleiben:** `CLAUDE.md` (Claude Code erwartet sie im Projektroot),
  `README*.md` (GitHub-Konvention), `DEBUG.md` und
  `Berechnungsgrundlagen dB zu CI.md` (vom User nicht ausgewählt; bei
  Bedarf später).

Diese Anleitung ist die **letzte** in der Serie 48–56. Erst nachdem
alle vorherigen Bauanleitungen ausgeführt sind, wird der Umzug
gemacht — sonst veralten die Datei-Pfade in den anderen Anleitungen.

Datei-Verschiebungen mit `git mv`, damit die History erhalten bleibt.

## Stelle 1 — Zielordner anlegen

Im Projektroot:

```bash
mkdir -p js
mkdir -p docs
```

(Wenn `docs/` schon existiert: nicht stören.)

## Stelle 2 — JS-Dateien nach `js/` verschieben

Die folgenden 29 Dateien aus dem Root nach `js/` verschieben:

```
audio.js
chart.js
core.js
file.js
freq-table.js
freq-warp.js
freqmatch.js
i18n.js
init.js
latency.js
legal.js
levels-tab.js
levels.js
lr-balance.js
maplaw.js
mobile.js
player.js
print-md.js
print.js
results.js
sentences.js
state-side.js
tab-print.js
tabs-eq.js
test-ui.js
test.js
touch-ctrl.js
ui-implant.js
version.js
```

Befehl (alle auf einmal):

```bash
git mv audio.js chart.js core.js file.js freq-table.js freq-warp.js \
       freqmatch.js i18n.js init.js latency.js legal.js levels-tab.js \
       levels.js lr-balance.js maplaw.js mobile.js player.js print-md.js \
       print.js results.js sentences.js state-side.js tab-print.js \
       tabs-eq.js test-ui.js test.js touch-ctrl.js ui-implant.js \
       version.js js/
```

Anschließend prüfen:

```bash
ls *.js 2>/dev/null   # → kein Output erwartet (alle weg)
ls js/                # → die 29 Dateien
ls i18n/              # → de.js, en.js, fr.js, es.js (unverändert)
```

## Stelle 3 — `index.html` Loader-Pfade aktualisieren

In `index.html` Z. 26–33 die `scripts`-Liste anpassen. Aktuell:

```js
      var scripts = [
        'version.js', 'mobile.js', 'touch-ctrl.js', 'i18n.js',
        'i18n/de.js', 'i18n/en.js', 'i18n/fr.js', 'i18n/es.js',
        'core.js', 'state-side.js', 'audio.js',
        'ui-implant.js', 'freq-table.js', 'test-ui.js', 'test.js', 'freqmatch.js',
        'results.js', 'chart.js', 'file.js', 'print.js', 'print-md.js', 'tab-print.js', 'tabs-eq.js', 'levels.js',
        'levels-tab.js', 'player.js', 'freq-warp.js', 'maplaw.js', 'lr-balance.js', 'latency.js', 'sentences.js', 'init.js', 'legal.js'
      ];
```

Ersetzen durch:

```js
      var scripts = [
        'js/version.js', 'js/mobile.js', 'js/touch-ctrl.js', 'js/i18n.js',
        'i18n/de.js', 'i18n/en.js', 'i18n/fr.js', 'i18n/es.js',
        'js/core.js', 'js/state-side.js', 'js/audio.js',
        'js/ui-implant.js', 'js/freq-table.js', 'js/test-ui.js', 'js/test.js', 'js/freqmatch.js',
        'js/results.js', 'js/chart.js', 'js/file.js', 'js/print.js', 'js/print-md.js', 'js/tab-print.js', 'js/tabs-eq.js', 'js/levels.js',
        'js/levels-tab.js', 'js/player.js', 'js/freq-warp.js', 'js/maplaw.js', 'js/lr-balance.js', 'js/latency.js', 'js/sentences.js', 'js/init.js', 'js/legal.js'
      ];
```

Wichtig: **Die `i18n/de.js`-Zeile bleibt ohne `js/`-Prefix**, weil der
Ordner `i18n/` im Root bleibt. Nur die 29 Logikdateien bekommen
`js/`-Prefix.

## Stelle 4 — Dokumentations-Dateien nach `docs/` verschieben

```bash
git mv BAUANLEITUNGEN_LEITLINIEN.md docs/
git mv SPEC.md docs/
git mv spec docs/
git mv CODESTRUKTUR.md docs/
git mv IDEEN.md docs/
```

(`git mv spec docs/` verschiebt den ganzen Ordner mitsamt Inhalt nach
`docs/spec/`.)

Anschließend prüfen:

```bash
ls docs/        # → BAUANLEITUNGEN_LEITLINIEN.md SPEC.md spec/ CODESTRUKTUR.md IDEEN.md
ls *.md         # → CLAUDE.md README*.md DEBUG.md "Berechnungsgrundlagen dB zu CI.md"
```

`CLAUDE.md`, `README.md`, `README_de.md`, `README_en.md`, `README_fr.md`,
`README_es.md`, `DEBUG.md`, `Berechnungsgrundlagen dB zu CI.md` bleiben
im Root.

## Stelle 5 — `CLAUDE.md` Pfadverweise aktualisieren

In `CLAUDE.md` im Abschnitt **REFERENZDATEIEN** verweisen die Einträge
auf Doc-Dateien, deren Pfad sich jetzt geändert hat. Bisher z. B.:

```
- **CODESTRUKTUR.md** — Modulübersicht, …
- **SPEC.md + spec/** — Funktionsspezifikation. SPEC.md ist …
- **IDEEN.md** — Konzept-Skizzen …
- **BAUANLEITUNGEN_LEITLINIEN.md** — Format-Vorgaben …
```

Ersetzen durch (jeweils mit `docs/`-Prefix):

```
- **docs/CODESTRUKTUR.md** — Modulübersicht, …
- **docs/SPEC.md + docs/spec/** — Funktionsspezifikation. docs/SPEC.md ist …
- **docs/IDEEN.md** — Konzept-Skizzen …
- **docs/BAUANLEITUNGEN_LEITLINIEN.md** — Format-Vorgaben …
```

**DEBUG.md** und **Berechnungsgrundlagen dB zu CI.md** bleiben im
Root, deren Erwähnungen in `CLAUDE.md` brauchen keine Änderung.

Innerhalb der Erklärtexte gibt es zusätzliche Erwähnungen wie
„vor jedem nicht-trivialen Edit CODESTRUKTUR.md lesen" — diese
Fließtext-Erwähnungen mit `docs/` ergänzen, wo der Pfad eindeutig
nötig wäre. Stichprobe machen, kein blindes Suchen-und-Ersetzen.

## Stelle 6 — `docs/CODESTRUKTUR.md` Modul-Tabelle anpassen

Im Abschnitt **„Module im Ladeverlauf"** (Modul-Tabelle ab Z. 96 der
verschobenen Datei) liegt eine Tabelle mit Spalten `# | Datei | Inhalt`.
Aktuell stehen die Dateinamen ohne Pfad-Prefix (`audio.js`,
`chart.js`, …).

Zwei mögliche Lösungen:

**Variante A (empfohlen, weniger Änderungen):** Vor der Tabelle einen
einleitenden Hinweis ergänzen, daß alle JS-Module unter `js/` liegen,
mit Ausnahme der i18n-Sprachdaten in `i18n/`:

> Alle Logik-JS-Dateien liegen unter `js/`. Die Sprachdaten in
> `i18n/de.js` etc. bleiben im Root-Ordner `i18n/` (kein `js/`-
> Prefix).

Die Tabelle selbst behält die Dateinamen ohne Prefix — der Leser
weiß aus dem Hinweis, daß `js/` davorzudenken ist.

**Variante B:** In jeder Tabellenzeile den Pfad voll ausschreiben
(`js/audio.js`, `js/chart.js`, …). Vollständig korrekt, aber 29
Zeilen Edit. Wenn Variante A gewählt wird, in der Tabelle bei den
i18n-Sprachdaten explizit `i18n/de.js` etc. stehenlassen, damit die
Ausnahme sichtbar bleibt — wie schon jetzt.

**Empfehlung: Variante A.** Falls Sonnet unsicher ist: Variante A.

Im Abschnitt **„Einbindung in `index.html`"** den Hinweis ergänzen,
daß die Loader-Liste jetzt `js/`-Pfade enthält.

Im Abschnitt **„i18n-Split"** (Datenfluss-Block, Z. 376) ist der
Hinweis schon korrekt („`i18n/de.js`, `i18n/en.js`, …") — keine
Änderung nötig.

Den Verweis auf `Berechnungsgrundlagen dB zu CI.md` im Datenfluss-
Block (Implementierung der Formeln) korrekt lassen — die Datei bleibt
im Root.

## Stelle 7 — Querverweise in den verschobenen Doc-Dateien prüfen

Die folgenden potentiellen Stolperfallen prüfen:

- **`docs/SPEC.md` → `docs/spec/…`-Verweise:** SPEC.md verweist auf
  Kapitel unter `spec/`. Innerhalb des `docs/`-Ordners ist der
  relative Pfad `spec/…` weiterhin gültig — keine Änderung nötig.
- **README*.md im Root → SPEC.md / CODESTRUKTUR.md:** falls READMEs
  auf SPEC.md oder CODESTRUKTUR.md verweisen, müssen diese Verweise
  jetzt auf `docs/SPEC.md` / `docs/CODESTRUKTUR.md` zeigen.
  Stichprobe mit `grep`:
  ```bash
  grep -l "SPEC.md\|CODESTRUKTUR.md\|IDEEN.md\|BAUANLEITUNGEN_LEITLINIEN.md" README*.md
  ```
  Wenn Treffer: jeweils Pfad anpassen.
- **`.bauanleitungen/` (Bauanleitungen 01–55):** Diese Anleitungen
  erwähnen JS-Dateien oft ohne `js/`-Prefix. Sie sind historische
  Dokumente — keine Pfad-Anpassung. Wenn Sonnet später eine alte
  Anleitung erneut ausführen sollte, muß sie sich darüber bewußt
  sein, daß die Pfadangaben nicht mehr stimmen. Das ist akzeptabel.

## Stelle 8 — Versuche, keinen Fließtext zu zerstören

Die meisten Doc-Dateien enthalten Pfade in Fließtext (z. B. „der
Helper in `core.js` …"). Innerhalb dieser Texte ist der Bezug auf
„`core.js`" ohne `js/`-Prefix weiterhin **verständlich** (der Leser
weiß, daß die Datei jetzt unter `js/` liegt). Es ist nicht nötig,
jedes Auftreten zu ändern. Nur Pfad-Listen (Tabellen, Aufzählungen
mit Pfad-Charakter wie „Lade-Reihenfolge: …") sollten konsistent
gehalten werden.

Faustregel: **Pfad-Erwähnungen in Tabellen und Listen anpassen,
Fließtext-Erwähnungen unverändert lassen.**

## Stelle 9 — Inhalt der `.bauanleitungen/` ungeschoben lassen

Der Ordner `.bauanleitungen/` (Punkt-Prefix, versteckt) bleibt im Root,
ebenso wie sein Inhalt. Diese Bauanleitung selbst (Nr. 56) bleibt
ebenfalls dort.

## Akzeptanztest-Checkliste (manuell im Browser und Shell)

### Test A — Tool startet und alle Module laden

1. `index.html` im Browser öffnen (`http(s)://` oder `file://`).
2. Browser-Konsole öffnen — keine Skript-Lade-Fehler (404 oder
   ähnlich), keine `ReferenceError`.
3. Alle Tabs durchklicken: Einführung, Implantat, Messungen (mit
   allen Sub-Tabs), Meßergebnisse (mit allen Sub-Tabs), Kurven,
   Schieber, Player, Laden/Speichern. Jeder Tab rendert wie vorher.
4. Sprachwechsel testen (DE/EN/FR/ES) — i18n-Lade über `i18n/`
   funktioniert weiterhin.
5. Eine Messung starten (zumindest einen Tonpaar-Klick) — Audio
   funktioniert.

### Test B — Verzeichnisstruktur korrekt

Shell-Stichproben:

```bash
ls *.js              # → leer
ls js/ | wc -l       # → 29
ls i18n/             # → de.js en.js es.js fr.js
ls docs/             # → BAUANLEITUNGEN_LEITLINIEN.md CODESTRUKTUR.md IDEEN.md SPEC.md spec/
ls docs/spec/        # → die Kapitel-Dateien
ls *.md              # → CLAUDE.md README*.md DEBUG.md "Berechnungsgrundlagen dB zu CI.md"
```

### Test C — Git-History erhalten

```bash
git log --follow js/audio.js | head -5
```

Erwartet: zeigt frühere Commits, die `audio.js` (im Root) betrafen.
`--follow` zeigt History über Renames.

```bash
git log --follow docs/CODESTRUKTUR.md | head -5
```

Analog: zeigt frühere Commits zur `CODESTRUKTUR.md`.

### Test D — Doc-Verweise funktionieren

1. `CLAUDE.md` öffnen, prüfen: die Verweise auf
   `docs/CODESTRUKTUR.md` etc. sind korrekt geschrieben.
2. Klick (oder manuelles Folgen) auf die Pfade — Datei wird gefunden.
3. `docs/SPEC.md` öffnen, prüfen: Verweise auf `spec/*.md` sind
   nicht gebrochen (innerhalb `docs/` ist `spec/foo.md` der
   relativ-richtige Pfad).

### Test E — Loader-Cache-Bust funktioniert weiterhin

1. In der Browser-Konsole: `sessionStorage.removeItem('cacheBust')`.
2. Reload.
3. Network-Tab: alle JS-Dateien werden mit `?v=…`-Suffix geladen,
   neu (kein 304/cached).

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie A–E einzeln durchgehen
und für jede melden: **erfüllt / nicht erfüllt / unklar**, mit
Befehls- oder Datei- und Zeilenangabe.

Insbesondere prüfen:

- Wurden tatsächlich **alle 29** Dateien per `git mv` verschoben,
  nicht über reines `mv` (sonst Datei-History gebrochen)?
- Stimmt die `scripts`-Liste in `index.html` Z. 26–33 exakt mit der
  Vorgabe oben überein? Insbesondere die i18n-Sprachdateien
  (`i18n/de.js` etc.) **ohne** `js/`-Prefix.
- Gibt es noch andere HTML-/JS-Dateien außerhalb dieser Liste, die
  alte Pfade haben? Suche:
  ```bash
  grep -rn 'src="[a-z][a-z-]*\.js"' --include="*.html" .
  ```
  Erwartet: kein Treffer (oder nur i18n-Dateien). Falls Treffer:
  Pfad-Anpassung nötig.
- Wird `CLAUDE.md` durch Claude Code beim nächsten Chat-Start
  weiterhin korrekt gefunden? (Datei liegt im Root — sollte
  funktionieren.)
- Funktioniert der `Berechnungsgrundlagen dB zu CI.md`-Verweis in
  `CLAUDE.md` weiterhin? (Die Datei bleibt im Root.)
- Ist der Inline-Loader in `index.html` (Z. 11–38) sonst
  unverändert geblieben? Insbesondere `document.write` mit dem
  `?v=`-Cachebuster muß weiterlaufen — sonst werden Modulpfade
  ohne Cache-Busting geladen, und der Browser hängt am alten Cache.

Bei Unklarheit Rückfrage statt Annahme.
