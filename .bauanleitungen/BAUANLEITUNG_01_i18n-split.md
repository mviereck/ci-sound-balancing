# BAUANLEITUNG 01 — i18n-Split (4 Sprachen in eigene Dateien)

## Ziel

`i18n.js` (172 KB, alle vier Sprachen in einem Objekt) in einen
schlanken Core plus vier Sprachdateien aufteilen. Das spart bei
jedem Eingriff auf UI-Texten 75 % Token, weil Sonnet dann nur
noch die deutsche Datei anfaßt — fehlende Übersetzungen werden
gestaut und in späteren Sammelrunden nachgepflegt.

Funktional ändert sich **nichts**. Nur Datei-Struktur und Lade-
Reihenfolge.

## Vorab lesen

- **Diese Bauanleitung** komplett (eine Datei, klein gehalten).
- **`CODESTRUKTUR.md`** Abschnitt "Module im Ladeverlauf",
  insbesondere den Eintrag zu i18n.js — diesen Abschnitt mußt
  du am Ende dieser Bauanleitung aktualisieren.
- **`i18n.js`** nur ausschnittsweise: Zeilen 1–6, 705–707,
  1402–1404, 2086–2088, 2769–2772 sowie ab 2772 bis Datei-Ende.
  **NICHT** den gesamten Inhalt einlesen — nur die genannten
  Übergänge plus den Helper-Block am Ende.
- **`index.html`** Zeilen 1–40 (Script-Loader).

Alles andere bleibt unangetastet.

## Vorgehen

### Schritt 1 — Verzeichnis anlegen

Ordner `i18n/` im Repo-Root anlegen (neben den anderen `.js`-Dateien,
nicht in `assets/`).

### Schritt 2 — Vier Sprachdateien erzeugen

Aus der aktuellen `i18n.js` jeweils einen Sprachblock 1:1 herauslösen.
Die Zeilenbereiche stammen aus dem heutigen Stand:

- **DE**: Inhalt zwischen `de: {` (Z. 5) und der schließenden Zeile
  vor `en: {` (Z. 705 ist die letzte DE-Zeile).
- **EN**: Z. 706–1402.
- **FR**: Z. 1403–2086.
- **ES**: Z. 2087–2770.

Jede neue Datei `i18n/<lang>.js` hat genau diese Form:

```js
// ============================================================
// I18N — DEUTSCH
// ============================================================
Object.assign(L.de, {
  subtitle: "",
  sideLeft: "LINKS",
  sideRight: "RECHTS",
  // … alle DE-Keys 1:1 aus dem heutigen L.de-Block …
});
```

**Strikte Kopier-Regeln:**

- Die Schlüssel-Reihenfolge **nicht** ändern.
- Die Schlüssel-Werte **nicht** anfassen — auch nicht
  Whitespace, Umlaute, HTML-Tags, Zeilenumbrüche innerhalb von
  Strings.
- Trailing commas wie im Original beibehalten.
- Den Wrapper `de: {` durch `Object.assign(L.de, {` ersetzen,
  und das schließende `},` durch `});`.
- Analog für EN/FR/ES.

### Schritt 3 — i18n.js auf Core reduzieren

`i18n.js` enthält nach dem Split **nur noch**:

```js
// ============================================================
// I18N — CORE
// Sprachdaten liegen in i18n/de.js, i18n/en.js, i18n/fr.js, i18n/es.js
// und werden dort per Object.assign(L.<lang>, { … }) befüllt.
// ============================================================
const L = { de: {}, en: {}, fr: {}, es: {} };
let lang = "de";

function t(k) {
  return (L[lang] && L[lang][k]) || L.de[k] || k;
}

function updateMfrSelectLabels() {
  // …unverändert aus heutiger Z. 2777–2789 übernehmen…
}

const README_URLS = {
  // …unverändert aus heutiger Z. 2790–2795 übernehmen…
};

function applyLang() {
  // …unverändert aus heutiger Z. 2797–2883 übernehmen…
}

function updateRunExplain() {
  // …unverändert aus heutiger Z. 2884–2889 übernehmen…
}
```

**Wichtig:** `updateMfrSelectLabels()` enthält selbst eingebettete
Sprach-Hardcodes (de/en/fr/es Labels für "Elektroden") — das bleibt
**unverändert** im Core. Nicht in die Sprachdateien wegrefactoren.

### Schritt 4 — index.html Script-Reihenfolge anpassen

In `index.html` Z. 26–31 steht das Script-Array. **Vorher:**

```js
var scripts = [
  'version.js', 'mobile.js', 'touch-ctrl.js', 'i18n.js', 'core.js', 'state-side.js', 'audio.js',
  'ui-implant.js', 'freq-table.js', 'test-ui.js', 'test.js', 'freqmatch.js',
  'results.js', 'chart.js', 'file.js', 'print.js', 'print-md.js', 'tab-print.js', 'tabs-eq.js', 'levels.js',
  'levels-tab.js', 'player.js', 'freq-warp.js', 'maplaw.js', 'lr-balance.js', 'latency.js', 'sentences.js', 'init.js', 'legal.js'
];
```

**Nachher** — direkt nach `'i18n.js'` werden die vier Sprachdateien
eingefügt:

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

Reihenfolge ist zwingend: Core-i18n.js zuerst (definiert `L`,
`t`, `applyLang`), dann die vier Sprachdateien (befüllen `L.<lang>`),
dann alle restlichen Module (greifen auf `t()` und `L` zu).

### Schritt 5 — CODESTRUKTUR.md aktualisieren

Den Eintrag, der i18n.js im Ladeverlauf beschreibt, ergänzen
um die vier Sprachdateien `i18n/de.js`, `i18n/en.js`, `i18n/fr.js`,
`i18n/es.js`. Reihenfolge und Funktion (befüllen `L.<lang>` via
`Object.assign`) kurz erwähnen.

## Was du NICHT tust

- Du **veränderst keine** Übersetzungs-Inhalte (Strings,
  Reihenfolge, Whitespace).
- Du **erfindest keine** neuen i18n-Keys.
- Du **bewegst keinen** anderen Code (nicht `core.js`, nicht
  `init.js`, nicht `print-md.js` etc.) — die nutzen alle weiterhin
  `t()` und merken nichts vom Split.
- Du **rührst nicht** `updateMfrSelectLabels()` an, auch wenn da
  Sprach-Hardcodes drinstehen.

## Akzeptanztest (für den Nutzer, Klick für Klick)

1. **Tool im Browser öffnen** (z.B. lokal über
   `http://localhost:…/index.html` oder direkt aus dem geöffneten
   Verzeichnis) → erwartet: deutsche UI wie bisher, kein
   sichtbarer Unterschied.
2. **Sprachumschalter** oben rechts auf **English** → alle
   sichtbaren Texte werden englisch.
3. **Auf Français** → alle Texte französisch.
4. **Auf Español** → alle Texte spanisch.
5. **Zurück auf Deutsch** → alles deutsch.
6. **Implantat-Tab anklicken** → Hersteller-Dropdown zeigt für
   die aktuelle Sprache "MED-EL (12 Elektroden)" /
   "MED-EL (12 electrodes)" / etc. (das ist der
   `updateMfrSelectLabels`-Hardcode, sollte weiter funktionieren).
7. **Konsole öffnen** (F12) → keine Fehler vom Typ
   `L is not defined`, `t is not a function`,
   `Cannot read properties of undefined (reading 'de')`.
8. **Konsole-Spotcheck eingeben**:
   ```
   Object.keys(L.de).length
   Object.keys(L.en).length
   Object.keys(L.fr).length
   Object.keys(L.es).length
   ```
   Erwartet: 643 / 644 / 643 / 643 (heutige Werte, dürfen sich
   durch den Split nicht ändern).

## Selbstprüfung vor der Fertig-Meldung

Bevor du dem Nutzer meldest, du seist fertig, gehe jeden der
folgenden Punkte einzeln durch und melde für jeden:
*erfüllt / nicht erfüllt / unklar* — jeweils mit Datei- und
Zeilenangabe der relevanten Stelle.

1. Verzeichnis `i18n/` existiert und enthält genau 4 Dateien:
   `de.js`, `en.js`, `fr.js`, `es.js`.
2. Jede der vier Sprachdateien beginnt mit
   `Object.assign(L.<lang>, {` und endet mit `});`.
3. Die DE-Datei enthält 643 Keys (zähle z.B. via grep auf
   `:\s` am Zeilenanfang, oder per Konsolen-Check zur Laufzeit).
   EN: 644, FR: 643, ES: 643.
4. `i18n.js` enthält **kein** `de: {`, `en: {`, `fr: {`,
   `es: {` mehr — alle Sprach-Inhalte sind ausgelagert.
5. `i18n.js` enthält **weiterhin** unverändert:
   `const L = { de: {}, en: {}, fr: {}, es: {} };`,
   `let lang = "de";`, `function t(k)`, `updateMfrSelectLabels()`,
   `README_URLS`, `applyLang()`, `updateRunExplain()`.
6. `index.html` Z. 26–31 (Script-Array) listet `i18n/de.js`,
   `i18n/en.js`, `i18n/fr.js`, `i18n/es.js` **direkt nach**
   `i18n.js` und **vor** `core.js`.
7. `CODESTRUKTUR.md` ist um die neuen Sprachdateien ergänzt.
8. **Funktionstest**: lade die Seite im Browser und schalte
   alle vier Sprachen einmal durch. Berichte, ob die Texte
   korrekt wechseln und ob die Konsole sauber bleibt.

Wenn ein Punkt **unklar** ist, frage **vor** der Fertig-Meldung
beim Nutzer nach. Stille Annahmen sind in diesem Projekt teurer
als Rückfragen, weil der Nutzer den Code nicht selbst lesen kann.
