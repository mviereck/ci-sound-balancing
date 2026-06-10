# BAUANLEITUNG 174 — Tote i18n-Keys in allen Sprachdateien entfernen

**Ziel:** Aufräumarbeit zur Vorbereitung der späteren großen Übersetzungs-BA. Alle i18n-Keys, die nachweislich nirgends mehr im Produktivcode referenziert werden, aus den vier Sprachdateien `i18n/de.js`, `i18n/en.js`, `i18n/fr.js`, `i18n/es.js` entfernen. **Sicherheit hat absolute Priorität:** im Zweifel **nicht entfernen**, sondern in eine „Kiste der zweifelhaften Keys" eintragen, die der User am Ende sieht.

**Versionsbump:** `js/version.js` → `"3.1.174-beta"`.

**Keine UI-Änderungen, keine Verhaltensänderungen.** Diese BA ist rein mechanisch.

**Vorrang:** Wenn ein Schritt unklar ist, **stoppen und melden**, nicht raten.

---

## Schritt 0 — Versionsbump

Datei `js/version.js`:

```js
const APP_VERSION = "3.1.173-beta";
```

ersetzen durch:

```js
const APP_VERSION = "3.1.174-beta";
```

---

## Schritt 1 — Such-Whitelist festlegen

Lebendige Verwendung wird **ausschließlich** in folgenden Pfaden gesucht:

- `js/**/*.js` **außer** `js/data/`
- `index.html`
- `style.css`

**Nicht** durchsucht (Doku-Bestände sind kein Lebenszeichen):
- `docs/`, `.bauanleitungen/`, `.claude/`, `.git/`, `archive/`, `.manuals/`, `scripts/`, `README*.md`, `BAUANLEITUNG_*.md`, `out*.wav`, alle `i18n/*.js` (die werden ja gerade geprüft).

---

## Schritt 2 — Key-Universe sammeln

Aus jeder der vier Sprachdateien `i18n/de.js`, `i18n/en.js`, `i18n/fr.js`, `i18n/es.js` alle Top-Level-Property-Namen extrahieren. Die Dateien folgen dem Muster `Object.assign(L.<lang>, { keyName: "…", … })` — die Keys stehen jeweils am Zeilenanfang nach Whitespace, gefolgt von `:`.

Eine simple Heuristik per Regex:

```
^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:
```

Pro Datei eine Set-artige Liste erzeugen. Die **Vereinigung** der vier Listen ist das Key-Universe. Manche Keys existieren nur in einer Sprache; das ist normal (Stand der Übersetzung).

---

## Schritt 3 — Dynamische Lookup-Präfixe ermitteln

Der Code nutzt an mehreren Stellen Konkatenation, z.B. `t('fmBlocked_' + ev.reason)`. Solche Aufrufe ergeben Keys, die per direktem Grep **nicht** zu finden sind, obwohl sie lebendig sind. Diese Präfixe müssen vorher gesammelt werden.

### 3a) String-Konkatenation mit `+`

Suche in der Whitelist nach allen Aufrufen der Form `t('<prefix>' + …)` oder `t("<prefix>" + …)`:

```
grep -rEn "t\(['\"][^'\"]+['\"]\s*\+" js/ index.html style.css \
  --include='*.js' --include='*.html' --include='*.css' \
  --exclude-dir=data
```

Bei jedem Treffer den String-Literal-Teil zwischen `'`/`"` extrahieren — das ist ein **Präfix**.

### 3b) Template-Literale

Suche nach Template-Literalen mit Variablen-Einsetzung in `t(…)`:

```
grep -rEn 't\(\`[^\`]*\$\{' js/ index.html
```

Pro Treffer die feste Prefix-Hälfte vor `${` extrahieren.

### 3c) `dataset.t` dynamisch gesetzt

Suche nach Stellen, an denen `dataset.t` programmatisch zusammengebaut wird:

```
grep -rEn "dataset\.t\s*=\s*['\"\`]" js/
```

Bei dynamischer Zuweisung (z.B. `el.dataset.t = 'fmHintMethod' + suffix`) den festen Prefix-Teil extrahieren.

### 3d) Konkatenations-Präfix-Liste

Alle in 3a–3c gefundenen Präfixe als Set sammeln, z.B.:

- `fmBlocked_`
- `fmHintMethod`
- `cfgHint`
- (was immer der reale Code-Stand liefert)

Diese Liste ist **die** Whitelist für „Key überlebt wegen möglicher dynamischer Verwendung".

---

## Schritt 4 — Pro Key Entscheidung treffen

Für jeden Key aus dem Universe (Schritt 2) folgende Prüfung in genau dieser Reihenfolge:

### 4a) Direkter Wortmatch im Whitelist-Suchpfad

```
grep -rEn "(^|[^A-Za-z0-9_])<keyname>([^A-Za-z0-9_]|$)" js/ index.html style.css \
  --include='*.js' --include='*.html' --include='*.css' \
  --exclude-dir=data
```

Die Wortgrenzen `(^|[^A-Za-z0-9_])` und `([^A-Za-z0-9_]|$)` vermeiden Substring-Falschtreffer (z.B. `tabIntro` als Substring in `tabIntroDesc`).

- **Mindestens ein Treffer außerhalb von `i18n/*.js` und außerhalb von Kommentaren** → Key gilt als **LEBENDIG**, **behalten**.
- Treffer ausschließlich in Kommentaren (Zeilen, die mit `//` oder `/* … */` umschlossen sind) → **als zweifelhaft markieren** (siehe Schritt 5), Key **behalten**.
- Kein Treffer → weiter mit 4b.

### 4b) Präfix-Match gegen Konkatenations-Liste

Beginnt der Key mit einem der in Schritt 3d gesammelten Präfixe?

- Ja → **als zweifelhaft markieren**, Key **behalten**.
- Nein → weiter mit 4c.

### 4c) Endgültige Tot-Entscheidung

Wenn weder 4a noch 4b zugetroffen haben, gilt der Key als **TOT** und wird aus **allen** Sprachdateien entfernt, in denen er vorkommt (vier Dateien parallel).

---

## Schritt 5 — Kiste der zweifelhaften Keys protokollieren

Während der Schritte 4a/4b alle Keys, die *nicht direkt lebendig*, aber auch *nicht entfernt* wurden, in eine Liste schreiben. Format pro Eintrag:

```
- <keyname>:
    Grund: <"nur in Kommentar gefunden" | "Präfix-Match gegen <prefix>" | "sonstige Unsicherheit">
    Stellen: <dateipfad:zeile>, <dateipfad:zeile>, …
```

Diese Liste am Ende der Sonnet-Antwort als eigener Markdown-Block ausgeben — der User entscheidet später, ob diese Keys auch noch weg sollen oder bleiben.

**Wenn die Kiste leer ist**, ausdrücklich melden: „Kiste der zweifelhaften Keys: leer." Das ist eine wertvolle Information, kein Versäumnis.

---

## Schritt 6 — Löschung durchführen

Pro toter Key (aus 4c) in jeder der vier Sprachdateien, in denen er vorkommt, die **gesamte Eintrags-Zeile** entfernen. Format-Erhaltung:

- Wenn der Key über mehrere Zeilen geht (z.B. `key: "lange\nZeichenkette"`), den **gesamten Eintrag** entfernen, inkl. Folgezeilen bis zum nächsten `,` oder `}`.
- Keine umgebenden Leerzeilen löschen — die Lesbarkeit der Datei darf nicht leiden.
- Reihenfolge der verbleibenden Keys nicht ändern.
- Kein Reformat (Tabs/Spaces) der Datei.

Nach jedem Datei-Edit prüfen:
- Anzahl `{` == Anzahl `}` in der Datei (Klammer-Balance).
- Anzahl `"` ist gerade in jedem geänderten Bereich.
- Datei läuft im Browser durch (keine `SyntaxError`-Konsole).

---

## Schritt 7 — Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden Punkt einzeln durchgehen, melden: **erfüllt / nicht erfüllt / unklar**, mit konkretem Bezug.

1. `js/version.js` zeigt `"3.1.174-beta"`.
2. Schritt 1: Whitelist exakt eingehalten — kein toter Key wurde anhand von Doku-Treffern (`docs/`, `.bauanleitungen/`, `README*.md`) als lebendig gewertet.
3. Schritt 2: Key-Universe wurde aus allen vier `i18n/*.js`-Dateien gebildet.
4. Schritt 3: Konkatenations-Präfix-Liste wurde aus dem realen Codestand abgeleitet (per grep), nicht aus Erinnerung. Liste der gefundenen Präfixe ist in der Antwort ausgewiesen.
5. Schritt 4: Wortgrenz-Regex (`(^|[^A-Za-z0-9_])key([^A-Za-z0-9_]|$)`) wurde verwendet — keine Substring-Falschtreffer.
6. Schritt 5: „Kiste der zweifelhaften Keys" ist am Ende der Antwort ausgewiesen (auch wenn leer, dann explizit gemeldet).
7. Schritt 6: Klammer-Balance und Anführungszeichen-Hygiene jeder geänderten Sprachdatei geprüft.
8. Anzahl der entfernten Keys gemeldet, je Sprachdatei und insgesamt.
9. Liste der **endgültig entfernten Keys** (nicht der zweifelhaften) am Ende der Antwort als eigener Markdown-Block.
10. Browser-Test: Tool startet ohne `SyntaxError`-Konsolen-Fehler, Sprachwechsel DE/EN/FR/ES wirft keine `Cannot read property of undefined`-Fehler.
11. Smoke-Test: Reiter Einführung, Implantat, Datei, Player jeweils einmal geöffnet — kein offensichtlich fehlender String (statt eines deutschen Texts erscheint ein Key-Name als Klartext).

Bei einem Punkt unklar: **stoppen, melden, Rückfrage**.

---

## Schritt 8 — Akzeptanz-Checkliste für den Nutzer

1. **Frischer Browser-Tab.** Tool lädt ohne Konsolen-Fehler. Version-Label rechts oben zeigt `v3.1.174-beta`.
2. **Durch alle Reiter klicken** (Einführung, Implantat, Datei, Unterstützung, Links). Texte erscheinen wie gewohnt — kein Key-Name als Klartext sichtbar.
3. **Hörsituation und Hersteller setzen** (z.B. LINKS CI MED-EL, RECHTS Normalhörend). Reiter Messungen, Meßergebnisse, Kurven, Schieber, Player öffnen, kurz durchscrollen. Auch bei dynamischen Sperr-Texten (Modal beim Klick auf gesperrten Sub-Reiter mit „taub") keine Key-Namen sichtbar.
4. **Sprachwechsel auf EN/FR/ES.** Texte fallen wo nötig auf Deutsch zurück (erwartet, weil andere Sprachen Lückenhaft sind). Keine roten Konsolen-Fehler.
5. **Sonnet-Bericht durchsehen:** Die in der Sonnet-Antwort genannte Kiste der zweifelhaften Keys ist Dein Hand-Check-Material — entscheide je Key, ob er in einer Folge-BA noch weg soll oder bleibt.

---

## Schritt 9 — Folge-BA

Nach Abnahme von BA 174 bleibt nur noch die spätere große Übersetzungs-Mini-BA für en/fr/es. Die Aufräumarbeit aus BA 174 minimiert dort den Aufwand.

---

## Schlußbemerkung

Im Zweifel **nicht entfernen**, sondern in die Kiste der zweifelhaften Keys eintragen. Eine zu vorsichtige Aufräumarbeit ist akzeptabel; ein versehentlich entfernter lebendiger Key zieht einen `undefined`-Fallback nach sich und macht eine Stelle der UI sprachlos. Lieber drei Keys zu viel behalten als einen lebendigen kappen.
