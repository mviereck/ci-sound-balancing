# Bauanleitung 83 — Debug-Modus: Bau-Diagnose-Tests (Konvention + Datei-Lager)

## Ziel

Eine Datei- und Namens-Konvention einführen, mit der **künftige**
Bauanleitungen optional einen **temporären Diagnose-Test** im
Debug-Panel ablegen können. Zweck: Sonnet (sieht keinen Browser)
und Nutzer (sieht keinen Code) tauschen Befunde über das
Test-Ergebnis aus.

Konkret:

- **`js/debug-tests-current.js`** (neu, geladen) hält Bau-Diagnose-
  Tests der **aktuell laufenden** Bauanleitungen.
- **`archive/debug-tests/`** (neuer Ordner, **nicht** geladen)
  ist das Lager für Tests, die nach Bau-Abnahme aufgehoben werden
  sollen — sichtbar nur über Datei-Lookup, nicht im Panel.
- **Namens-Konvention** für temporäre Tests:
  `build/BAxx/<topic>` (z.B. `build/BA84/loader-order`).

Diese Bauanleitung legt **nur** Datei-Skelette und Leitlinien-
Text. Es werden **keine** Tests registriert — die kommen erst mit
der nächsten Bauanleitung, die das Konvention nutzt.

**Voraussetzungen:** Bauanleitungen 80–82 sind umgesetzt und
abgenommen.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.83-beta";
```

---

## 2. Neue Datei `js/debug-tests-current.js`

Komplett neue Datei mit folgendem Inhalt:

```js
/* debug-tests-current.js — Bauanleitung 83
 *
 * Aktive Bau-Diagnose-Tests aus laufenden Bauanleitungen.
 * Konvention:
 *   - Tests heißen `build/BAxx/<topic>` und tragen `opts.tab` der
 *     zugehörigen Bauanleitung (z.B. "messungen", "player",
 *     "global").
 *   - Pro temporärem Test ein eigener IIFE-Block, klar mit
 *     Bauanleitungs-Nummer kommentiert.
 *   - Nach Bau-Abnahme entscheidet Sonnet auf Nachfrage beim
 *     Nutzer: entweder den Test entfernen, oder die Test-Definition
 *     nach archive/debug-tests/BAxx_<topic>.js verschieben.
 *
 * Diese Datei beim Start leer (bis auf Header). Sie wird von
 * Bauanleitungen befüllt und wieder geleert — und ist deshalb
 * der einzige Ort im aktiven Code, an dem Tests kommen und gehen.
 */
(function () {
  'use strict';
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  // (aktuell keine temporären Tests registriert)
})();
```

---

## 3. Archiv-Ordner anlegen: `archive/debug-tests/`

Neuer Ordner im Repo-Root: `archive/debug-tests/`.

Damit Git den leeren Ordner aufnimmt, eine `README.md` mit
folgendem Inhalt anlegen unter `archive/debug-tests/README.md`:

```markdown
# Archivierte Bau-Diagnose-Tests

Hier liegen Test-Definitionen, die während einer Bauanleitung
als Diagnose-Brücke zwischen Sonnet (kein Browser-Zugriff) und
Nutzer (Browser-Beobachtung) dienten und nach Abnahme der
jeweiligen Bauanleitung archiviert wurden.

**Diese Dateien werden vom Tool nicht geladen.** Sie liegen
hier ausschließlich als Nachschlagewerk, falls ein historischer
Diagnose-Test später noch einmal benötigt wird.

## Aufbau

Eine Datei pro archivierter Test:

```
archive/debug-tests/BAxx_<topic>.js
```

Inhalt: ein eigenständiger IIFE-Block im selben Format wie in
`js/debug-tests-current.js`, ergänzt um einen Kommentarkopf mit
Datum der Archivierung und Kurzbegründung.

## Reaktivierung

Bei Bedarf den Inhalt einer Archiv-Datei in
`js/debug-tests-current.js` zurückkopieren (eigener IIFE-Block).
Der Loader holt die Datei dann beim nächsten Reload mit. Die
Archiv-Datei selbst bleibt unverändert liegen.

## Aufräumen

Wenn eine archivierte Datei sicher nicht mehr gebraucht wird,
kann sie ersatzlos gelöscht werden. Git bewahrt den Inhalt in
der Historie auf.
```

Sonst nichts in dem Ordner — die README dient zugleich als
`.gitkeep`-Ersatz.

---

## 4. Loader-Liste in `index.html` erweitern

In `index.html`, im zweiten Inline-Loader, das Scripts-Array am
**Ende** anpassen.

Vorher (Stand nach BA 82):

```js
'js/finanzen.js', 'js/unterstuetzung.js',
'js/debug-tests.js'
```

Nachher:

```js
'js/finanzen.js', 'js/unterstuetzung.js',
'js/debug-tests.js', 'js/debug-tests-current.js'
```

`debug-tests-current.js` lädt **nach** `debug-tests.js`, damit die
persistenten Tests immer zuerst registriert sind und die
Default-Auswahl-Logik aus BA 82 die temporären als zusätzliche
Tests erkennt (gleicher `_testReg`-Map-Pool).

---

## 5. Leitlinien-Datei `docs/BAUANLEITUNGEN_LEITLINIEN.md` erweitern

Am Ende der Datei (nach dem letzten bestehenden Abschnitt) folgende
neue Sektion anhängen:

```markdown
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

\`\`\`js
/* archiviert YYYY-MM-DD aus Bauanleitung BAxx — kurze
 * Begründung, warum der Test aufgehoben wurde (z.B.
 * „nochmal nützlich, falls Init-Reihenfolge wieder
 * umgestellt werden sollte").
 */
\`\`\`

Reaktivierung: Inhalt in `js/debug-tests-current.js`
zurückkopieren, neu laden, fertig. Die Archiv-Datei bleibt
unverändert liegen.
```

(Die mit `\`\`\`` maskierten Backticks im obigen Snippet werden
beim Einfügen in die `.md`-Datei zu echten Backticks — Sonnet
beachtet das beim Schreiben.)

---

## 6. CODESTRUKTUR.md aktualisieren

In `docs/CODESTRUKTUR.md`, in der Tabelle „Module im Ladeverlauf",
**direkt nach** der Zeile für `debug-tests.js` (eingefügt in
BA 82, Index `22`) eine neue Zeile ergänzen:

```
| 23 | debug-tests-current.js | Temporäre Bau-Diagnose-Tests aus laufenden Bauanleitungen (Bauanleitung 83). Lädt nach `debug-tests.js`. Tests heißen per Konvention `build/BAxx/<topic>` und tragen `opts.tab` der jeweiligen Bauanleitung. Pro Test ein eigener IIFE-Block mit Bauanleitungs-Nummer im Kopfkommentar. Nach Bau-Abnahme entscheidet Sonnet auf Nachfrage beim Nutzer: löschen oder verschieben nach `archive/debug-tests/BAxx_<topic>.js`. Beim Start (vor erster Nutzung) leer bis auf Header. |
```

Weiter unten in der Datei, am Ende des Abschnitts „Strukturelle
Eigenschaften" oder als Anhang, einen kurzen Hinweis auf den
Archiv-Ordner ergänzen:

```markdown
Archiv-Ordner `archive/debug-tests/` (ab BA 83): hält
archivierte Bau-Diagnose-Tests aus abgenommenen Bauanleitungen.
Nicht Teil des aktiven Codes — wird vom Loader **nicht** geholt.
Reaktivierung via Zurück-Kopieren nach `js/debug-tests-current.js`.
```

---

## Akzeptanztest

1. Browser hart neu laden (Strg-F5). Versionslabel zeigt
   `3.0.83-beta`. Tool sieht ansonsten unverändert aus.
2. **Datei-Check** im Repo:
   - `js/debug-tests-current.js` existiert, enthält den
     beschriebenen Header und einen leeren IIFE-Block.
   - `archive/debug-tests/README.md` existiert mit erwartetem
     Inhalt.
   - `index.html` Loader-Liste enthält `js/debug-tests-current.js`
     als letzten Eintrag.
3. **Konsole frei von Fehlern** beim Start.
4. **Debug-Panel öffnen** (Doppelklick aufs Logo). Sektion
   „Tests" zeigt unverändert die vier Tests aus BA 82
   (`global/i18n`, `global/player`, `global/sentence`,
   `frequenzabgleich/adaptiv`). Keine zusätzlichen Einträge —
   `debug-tests-current.js` ist initial leer.
5. **Manueller Prüfschritt der Konvention** (kein Code-Test):
   Sonnet liest die in `docs/BAUANLEITUNGEN_LEITLINIEN.md`
   eingefügte neue Sektion ein und meldet die wichtigsten Punkte
   in eigenen Worten zurück (zwei, drei Sätze). Bestätigt damit,
   daß der Workflow klar formuliert ist.
6. **Manueller Probelauf** (nicht Teil der Akzeptanz im engeren
   Sinne, aber empfohlen): testweise einen Stub-Test in
   `js/debug-tests-current.js` einfügen, z.B.:
   ```js
   (function () {
     'use strict';
     if (typeof dbg === 'undefined') return;
     dbg.test('build/BA83/self-check',
              { tab: 'global', label: 'BA 83 Smoke' },
              function () { return { ok: true, msg: 'Datei lädt' }; });
   })();
   ```
   Browser reload, Panel öffnen, ↻ klicken — der Test sollte
   grün werden mit Meldung „Datei lädt". Stub-Test danach wieder
   entfernen, damit `debug-tests-current.js` wieder leer ist.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden der sechs Akzeptanz-Punkte einzeln
durchgehen und melden: **erfüllt / nicht erfüllt / unklar**.

Speziell prüfen:

- Ist die Reihenfolge in der Loader-Liste korrekt
  (`debug-tests.js` **vor** `debug-tests-current.js`)? Sonst
  überschreibt die `_applyDefaultSelection`-Logik aus BA 82
  ggf. nicht wie erwartet.
- Ist der Archiv-Ordner `archive/debug-tests/` **außerhalb**
  von `js/` (also tatsächlich im Repo-Root, nicht versehentlich
  unter `js/archive/...`)? Begründung: was unter `js/` liegt,
  wird beim Lesen leicht als „aktiver Code" mißverstanden.
- Liegt die `README.md` im Archiv-Ordner unter dem korrekten
  Pfad (`archive/debug-tests/README.md`, nicht nur
  `archive/README.md`)?
- Ist die Leitlinien-Sektion in `docs/BAUANLEITUNGEN_LEITLINIEN.md`
  **ans Ende** der Datei angefügt und greift nicht in bestehenden
  Text ein?
- Ist der CODESTRUKTUR-Eintrag konsistent mit dem
  Format der anderen Tabellenzeilen (Pipe-Trennung, Index, knappe
  Beschreibung)?
- Bricht der Loader, wenn `debug-tests-current.js` aus
  irgendeinem Grund nicht ladbar ist? Erwartung: der
  Inline-Loader in `index.html` mit `defer` ist robust, fehlende
  Dateien führen nur zu einer 404-Konsolen-Warnung, aber kein
  Folge-Crash. Sonnet prüft kurz.

Bei Zweifel: aktive Rückfrage, nicht stille Annahme.

---

## Was diese Anleitung NICHT macht

- Keine konkreten Tests einbauen. Die Datei `debug-tests-current.js`
  ist absichtlich leer beim Bau-Ende. Erst die nächste
  Bauanleitung, die die Konvention nutzt, füllt sie.
- Keine UI-Markierung für temporäre Tests im Panel (z.B. „BUILD"-
  Badge). Die Namens-Konvention `build/BAxx/...` macht die
  Herkunft im Test-Label und in der Tab-Spalte deutlich genug.
- Keine automatische Aufräum-Logik (kein „lösche Tests aus
  abgenommenen BAs nach 30 Tagen"). Aufräumen ist explizite
  Sonnet-Aufgabe am Ende der jeweiligen Bauanleitung.
- Keine Übersetzungen — Panel-UI bleibt bewußt deutsch
  (Entwickler-Werkzeug, wie in BA 80/81/82 begründet).
- Keine Persistenz der Archiv-Wahl (löschen vs. archivieren).
  Diese Entscheidung trifft der Nutzer pro Test ad hoc.

---

## Workflow-Beispiel (zur Veranschaulichung)

So sieht eine künftige Bauanleitung BA 84 unter dieser
Konvention aus (illustrativ, nicht Teil von BA 83):

> ### Bau-Diagnose-Test (BA 84)
>
> In `js/debug-tests-current.js` folgenden IIFE-Block ergänzen:
>
> ```js
> /* Bauanleitung 84 — temporärer Diagnose-Test */
> (function () {
>   'use strict';
>   if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
>   dbg.test('build/BA84/maplaw-init',
>            { tab: 'player', label: 'BA84 MAPLAW-Init' },
>            function () {
>     if (typeof pMaplawNode === 'undefined' || pMaplawNode === null) {
>       return { ok: false, msg: 'pMaplawNode nicht initialisiert' };
>     }
>     return { ok: true, msg: 'pMaplawNode lebt: ' + pMaplawNode.constructor.name };
>   });
> })();
> ```
>
> ### Abschluss-Anweisung an Sonnet
>
> Am Ende des Akzeptanztests, vor Final-Meldung: **bitte den
> Nutzer**, ob der Diagnose-Test `build/BA84/maplaw-init`
> (a) gelöscht oder (b) nach `archive/debug-tests/BA84_maplaw-init.js`
> verschoben werden soll. Nach Antwort: entsprechende Aktion
> ausführen, dann Bauanleitung final schließen.

Dieses Muster ist keine Pflicht — eine Bauanleitung ohne
Bau-Diagnose-Test bleibt selbstverständlich gültig.
