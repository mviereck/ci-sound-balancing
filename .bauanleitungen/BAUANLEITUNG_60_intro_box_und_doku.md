# Bauanleitung 60 — Intro-Hinweisbox und Doku-Updates für Unterstützung-Tab

## Worum es geht

Abschluß der Unterstützung-Tab-Serie. Drei Aufgaben:

1. **Hinweisbox im Intro-Tab**: am Ende von `#panel-intro` eine
   eigene Karte, die kurz auf den Unterstützung-Tab verweist.
2. **`docs/CODESTRUKTUR.md`** um den neuen Tab und die zwei neuen
   JS-Dateien (`finanzen.js`, `unterstuetzung.js`) erweitern.
3. **`docs/SPEC.md` und `docs/spec/01-tabs.md`** um den neuen Tab
   ergänzen.

**Voraussetzung:** Bauanleitung 58 (favicon, Impressum-Mail) und
Bauanleitung 59 (Unterstützung-Tab) sind erledigt.

## Stelle 1 — Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "2.60-beta";
```

## Stelle 2 — Hinweisbox im Intro-Tab

In `index.html` Z. 85 beginnt `#panel-intro`. Innerhalb des Panels
gibt es eine `.card`, die mit `</div>` auf Z. 119 endet, gefolgt
vom schließenden `</div>` des Panels auf Z. 120.

**Vor** dem schließenden `</div>` des Panels (Z. 120, also direkt
unter der bestehenden Card) eine zweite Card einfügen:

```html
        <div class="card card-support-hint">
          <h3 data-t="introSupportTitle"></h3>
          <p data-t="introSupportText"></p>
          <p>
            <a href="#" id="introSupportLink" data-t="introSupportLink"></a>
          </p>
        </div>
```

Der Klick auf den Link soll auf den Unterstützung-Tab umschalten.
In `js/init.js` am Ende des `DOMContentLoaded`-Handlers
(oder dort, wo andere Intro-Links wie `introManualLink` verdrahtet
werden) folgenden Block ergänzen:

```js
  var introSupportLink = document.getElementById("introSupportLink");
  if (introSupportLink) {
    introSupportLink.addEventListener("click", function (e) {
      e.preventDefault();
      if (typeof switchTab === "function") switchTab("unterstuetzung");
    });
  }
```

**Wenn `init.js` keinen passenden Block für `introManualLink` hat**
(`grep -n introManualLink js/init.js`) und die Sprach-/Link-Logik
woanders sitzt: in dem Modul ergänzen, wo `introManualLink` per
ID gegriffen wird. Bei Unklarheit Rückfrage.

## Stelle 3 — i18n-Schlüssel für die Intro-Box (nur Deutsch)

**Nur Deutsch in dieser Bauanleitung.** EN/FR/ES kommen in einer
eigenen Mini-Anleitung, wenn die deutschen Texte feststehen (siehe
`docs/BAUANLEITUNGEN_LEITLINIEN.md`, Abschnitt „i18n / Übersetzungen
— nur Deutsch in Bauanleitungen").

In `i18n/de.js` am Ende des `Object.assign(L.de, { ... })`-Blocks
folgende Schlüssel ergänzen:

```js
    introSupportTitle: "Unterstützer für das Projekt gesucht",
    introSupportText: "Dieses Projekt braucht Unterstützung, um weiter entwickelt werden zu können. Bitte ziehen Sie einen kleinen monatlichen Obolus in Betracht.",
    introSupportLink: "→ Alle Informationen im Tab „Unterstützung\"",
```

`i18n/en.js`, `i18n/fr.js`, `i18n/es.js` **nicht anfassen**. Solange
ein Key dort fehlt, fällt die Anzeige auf den deutschen Text zurück.

## Stelle 4 — Optional: dezente Optik für die Intro-Box

In `style.css` am Ende ergänzen, falls die Box optisch von der
Haupt-Card abgesetzt werden soll:

```css
.card-support-hint {
  border-left: 4px solid var(--accent, #d97700);
}
.card-support-hint h3 {
  margin-top: 0;
}
.card-support-hint p:last-child {
  margin-bottom: 0;
}
```

(Falls die Akzentfarbe im Projekt anders heißt, in `style.css` oben
nachsehen — siehe Hinweis in BA 59 Stelle 9.)

## Stelle 5 — `docs/CODESTRUKTUR.md` Tab-Tabelle erweitern

In `docs/CODESTRUKTUR.md` im Abschnitt **„Tabs und ihre Module"**
gibt es eine Tabelle der Form `Tab-Beschriftung (DE) | data-tab ID
| Hauptmodul(e)`. Nach der letzten Zeile (Laden/Speichern → file →
file.js) eine neue Zeile ergänzen:

```
| Unterstützung | unterstuetzung | unterstuetzung.js (Tab-Renderer, Dialoge), finanzen.js (Daten + Berechnung) |
```

Im Text darunter, wo die **Reihenfolge in `index.html`** beschrieben
wird, „Unterstützung" als letzten Tab nach „Laden/Speichern"
ergänzen.

## Stelle 6 — `docs/CODESTRUKTUR.md` Modul-Tabelle erweitern

Im Abschnitt **„Module im Ladeverlauf"** (Tabelle mit Spalten
`# | Datei | Inhalt`) zwei neue Zeilen am Ende ergänzen
(Nummerierung an die letzte vorhandene anschließen). Zum Beispiel,
wenn die letzte Zeile Nr. 23 ist:

```
| 24 | finanzen.js | Daten und Berechnung für den Unterstützung-Tab. Globales Objekt `FINANZEN` (Posten-Array mit `full` / `current` pro Posten, `donationsMonthly`). Funktionen: `finBerechne()` (liefert `sumFull`, `sumCurrent`, `donations`, `selfShare`, `gapToFull`, `fullVsCurrent`), `finFmtEuro(n)` (Formatierung `"107,20 €"`). Keine DOM-Manipulation. |
| 25 | unterstuetzung.js | Tab-Renderer für Unterstützung. Funktionen: `_untRenderFinanzTable` (befüllt `#untFinanzBody`, `#untFinanzFoot`, `#untGapHints` aus `finBerechne()`), `_untBuildIban` (baut Dialog-Inhalt `#untIbanBody` aus Fragmenten zusammen), `_untBuildMail` (baut Dialog-Inhalt `#untMailBody` aus Fragmenten zusammen), `_untOpenDialog` (Helper). Eigener DOMContentLoaded-Handler verdrahtet `#untShowIbanBtn`, `#untShowMailBtn` und `[data-close-support]`-Buttons. Ruft `applyLang()` nach jedem dynamischen Render. |
```

**Wichtig:** Beide Dateien liegen unter `js/`, das `js/`-Prefix
**nicht** in der Tabelle wiederholen (Konvention aus BA 56).

## Stelle 7 — `docs/SPEC.md` Eckdaten anpassen (falls nötig)

In `docs/SPEC.md` im **„Eckdaten"**-Block: wenn dort die Anzahl der
Tabs explizit erwähnt ist, um eins erhöhen. Wenn nur thematisch
beschrieben ist (z. B. „Top-Level-Tabs für Implantat, Messungen
…"): „Unterstützung" mit aufnehmen.

Stichprobe:
```bash
grep -n "Tab" docs/SPEC.md | head -10
```

## Stelle 8 — `docs/spec/01-tabs.md` Tab-Übersicht erweitern

In `docs/spec/01-tabs.md` im Abschnitt **„Tab-Übersicht"** nach
**„Laden/Speichern (file)"** und vor **„Footer"** eine neue Zeile
ergänzen:

```markdown
- **Unterstützung** (unterstuetzung) — Letzter Top-Level-Tab.
  Drei Karten: (1) Spendenaufruf mit zwei Bot-geschützten Dialogen
  (Bankverbindung mit IBAN/BIC/QR-Code, Kontakt-E-Mail). Sensible
  Daten werden erst beim Klick aus Fragmenten zusammengebaut, stehen
  nicht im HTML-Quelltext. (2) Offenlegung der Finanzierung:
  Vergleichstabelle Vollausbau vs. aktueller Stand, Einzelposten
  und Summen aus `finanzen.js` (`FINANZEN.posten`,
  `FINANZEN.donationsMonthly`), Summen-/Differenz-Berechnung in
  `finBerechne()`. Darunter Liste „Geplant"/"In Erwägung". (3)
  Mehrsprachiger Slogan (per `data-t` in aktiver UI-Sprache, nicht
  als Block aller vier Sprachen). Tab wird wie alle Top-Level-
  Tabs während laufender Tests gesperrt. Nicht Teil des „Alles
  drucken"-Ablaufs.
```

Außerdem ergänzen, daß im Intro-Tab am Ende eine Hinweisbox auf
diesen Tab steht. In der Beschreibung von **„Einführung (intro)"**
ergänzen:

```
Am Ende des Intro-Tabs steht eine zweite Card („Unterstützer für
das Projekt gesucht") mit kurzem Hinweistext und Link, der per
`switchTab("unterstuetzung")` direkt zum Unterstützung-Tab führt.
```

## Stelle 9 — Querverweise prüfen

```bash
grep -rn "tabFile\|tabSetup\|tabIntro" docs/
```

Wenn die Tab-Liste in einer Aufzählung mit fester Reihenfolge
erscheint und „Unterstützung" fehlen würde: ergänzen.

```bash
grep -rn "Bauanleitung 5[8-9]\|Bauanleitung 60" docs/ .bauanleitungen/
```

Wenn frühere Bauanleitungen sich gegenseitig zitieren und die Serie
58–60 erwähnen: keine Aktion nötig, die drei Anleitungen verweisen
selbst aufeinander.

## Akzeptanztest-Checkliste (manuell im Browser)

### Test A — Hinweisbox sichtbar im Intro-Tab

1. Hard-Reload (`Ctrl+Shift+R`).
2. Intro-Tab ist beim Start aktiv (Default).
3. Unten im Intro-Panel: eine zweite Karte mit Überschrift
   „Unterstützer für das Projekt gesucht", Erläutertext, Link
   „→ Alle Informationen im Tab „Unterstützung"".

### Test B — Link in der Hinweisbox schaltet zum Unterstützung-Tab

1. Auf den Link in der Hinweisbox klicken.
2. Der Unterstützung-Tab wird aktiv (Button optisch hervorgehoben),
   das Unterstützung-Panel ist sichtbar.
3. Zurück auf „Einführung" → Hinweisbox wieder sichtbar.

### Test C — Sprachwechsel-Fallback funktioniert

1. Sprache auf EN umschalten — Hinweisbox-Überschrift, Text und
   Link erscheinen als **deutscher Fallback** (die EN-Übersetzung
   kommt erst in einer späteren Mini-Anleitung). Keine Fehler in
   der Konsole, keine leeren Texte.
2. Analog FR und ES — überall deutscher Fallback ohne Fehler.
3. Zurück auf DE — Texte erscheinen wieder regulär deutsch.

### Test D — Doku ist konsistent

1. `docs/CODESTRUKTUR.md` öffnen, prüfen: Tab-Tabelle enthält
   Unterstützung-Zeile, Modul-Tabelle enthält finanzen.js und
   unterstuetzung.js mit korrekter Inhaltsbeschreibung.
2. `docs/spec/01-tabs.md` öffnen, prüfen: Tab-Übersicht enthält
   Eintrag „Unterstützung (unterstuetzung)".

### Test E — Tool sonst unverändert

1. Alle anderen Tabs öffnen — keine Veränderung.
2. Browser-Konsole: keine `ReferenceError` oder 404.
3. Tab-Sperre während Test funktioniert für alle Tabs inkl.
   Unterstützung (Wiederholung von BA 59 Test H — hier nochmal,
   weil die `init.js`-Verdrahtung der Hinweisbox eventuell die
   Tab-Sperre umgehen könnte; die Hinweisbox-Klicks dürfen
   während eines Tests **nicht** funktionieren).

### Test F — Tab-Sperre umfaßt Hinweisbox-Link

1. „Messungen" → Test starten.
2. Auf den Hinweisbox-Link im Intro-Tab klicken (sofern der Intro-
   Tab noch klickbar ist — typischerweise auch er ist gesperrt).
3. Der Tab-Wechsel zum Unterstützung-Tab darf nicht stattfinden,
   solange der Test läuft.

Falls Test F fehlschlägt (Wechsel wird trotz Test ausgeführt), in
`init.js` den Click-Handler so erweitern, daß er bei aktivem Test
nichts tut:

```js
  if (introSupportLink) {
    introSupportLink.addEventListener("click", function (e) {
      e.preventDefault();
      // Wenn ein Test läuft, Tab-Wechsel unterdrücken.
      if (typeof isAnyTestRunning === "function" && isAnyTestRunning()) return;
      if (typeof switchTab === "function") switchTab("unterstuetzung");
    });
  }
```

Den genauen Funktionsnamen der „läuft ein Test?"-Abfrage in
`js/test-ui.js` oder `js/test.js` nachsehen. Falls es keinen
zentralen Helper gibt: das Problem ist klein (der Tab-Button selbst
ist ohnehin gesperrt; nur der Intro-Link bietet einen Umweg).
Wenn Sonnet unsicher ist: bei Test F eine Notiz machen und den
User entscheiden lassen, ob das nachgezogen werden soll.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie A–F einzeln
durchgehen und für jede melden: **erfüllt / nicht erfüllt / unklar**,
mit Datei- und Zeilenangabe.

Insbesondere prüfen:

- Wurde die zweite Card **innerhalb** des `#panel-intro`-Containers
  eingefügt, **nicht** außerhalb? Ein `</div>` zu viel und die Box
  landet im falschen Container.
- Wurden die drei Keys `introSupportTitle` / `introSupportText` /
  `introSupportLink` **nur** in `i18n/de.js` ergänzt? EN/FR/ES
  bleiben in dieser Bauanleitung unangetastet (Übersetzungen
  folgen separat). Stichprobe:
  ```bash
  grep -c "introSupport" i18n/de.js i18n/en.js i18n/fr.js i18n/es.js
  ```
  Erwartet: `de.js` zeigt 3, die anderen drei zeigen 0.
- Wird der Link-Click-Handler tatsächlich in `init.js` registriert
  und nicht in `unterstuetzung.js`? (Konvention: tabsübergreifende
  Verdrahtung gehört in `init.js`.)
- Ist `docs/CODESTRUKTUR.md` strukturell unverändert geblieben
  (nur Tabellen ergänzt, keine bestehenden Zeilen umgeschrieben)?
- Steht in `docs/spec/01-tabs.md` die neue Tab-Zeile an der
  richtigen Position (nach Laden/Speichern, vor Footer)?

Bei Unklarheit Rückfrage statt Annahme.

## Nach Abschluß manuell prüfen

- Hinweisbox sichtbar im Intro-Tab.
- Link führt zum Unterstützung-Tab.
- Sprachwechsel funktioniert für die Box.
- Doku in `docs/CODESTRUKTUR.md` und `docs/spec/01-tabs.md` zeigt
  den neuen Tab und die zwei neuen Module.
- Reihe 58–60 ist damit funktional abgeschlossen.

**Übersetzungen für en/fr/es** (für alle in BA 59 und BA 60 neu
eingeführten `support*`- und `introSupport*`-Keys) kommen in einer
eigenen Mini-Anleitung, sobald die deutschen Texte im Browser
geprüft und ggf. nachgebessert sind. Solange erscheinen die neuen
Texte in den anderen Sprachen als deutscher Fallback.
