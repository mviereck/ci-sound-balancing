# Bauanleitung 52 — Laden/Speichern: globales Suffix-Feld für Dateinamen

## Worum es geht

Der User soll im Tab „Laden/Speichern" ein einzelnes Eingabefeld
vorfinden, mit dem er einen frei wählbaren Suffix für alle exportierten
Dateinamen festlegen kann. Der Suffix wird **an das Ende des Dateinamens
gehängt, aber vor die Datei-Endung**, getrennt durch einen Unterstrich.

Beispiel:

- Bisher: `ci-sound-balancing-2026-05-24-1430.json`
- Mit Suffix „MAP1": `ci-sound-balancing-2026-05-24-1430_MAP1.json`
- Mit Suffix „Test_links": `ci-sound-balancing-2026-05-24-1430_Test_links.json`

Anforderungen:

- **Position**: ganz oben im Tab Laden/Speichern, als eigene Box,
  oberhalb der bestehenden Karten „Archiv-Box" (`cardArchiv`) und
  „Audiologen-Box" (`cardAudiolog`). Begründung: der Wert gilt global
  für **alle** speicherbaren Dateien, deshalb gehört er logisch nicht
  in eine der bestehenden Boxen.
- **Eingabe**: Freitextfeld mit Vorschlags-Dropdown („MAP1", „MAP2",
  „MAP3", „MAP4"). Andere Werte sind ebenfalls erlaubt — die vier
  MAP-Vorschläge sind nur Schnellzugriff.
- **Wirkung**: gilt für JSON-Save (`saveJson`), EasyEffects-Export
  (`exportEasyEffects`), Markdown-Export der Archiv-Box
  (`mdArchivFilename`) und Markdown-Export der Audiologen-Box
  (`mdAudiologFilename`).
- **Persistenz**: in `localStorage` (sofort beim Eingabe-Change) und
  in JSON-Save/Load.
- **Sicherheit**: Dateinamen-feindliche Zeichen (`/ \ : * ? " < > |`)
  werden vor dem Anhängen durch `_` ersetzt; reine Whitespace-Eingabe
  wird als leer behandelt (kein Suffix).

## Stelle 1 — `index.html`: neue Suffix-Box ganz oben im File-Tab

In `index.html` aktuell ab Z. 1409:

```html
      <!-- ===== FILE ===== -->
      <div id="panel-file" class="panel">
        <div class="card" id="cardArchiv">
```

Direkt nach `<div id="panel-file" class="panel">` und **vor**
`<div class="card" id="cardArchiv">` folgenden Block einfügen:

```html
        <!-- Globale Dateinamen-Ergänzung -->
        <div class="card" id="cardFileSuffix">
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px">
            <label for="userFileSuffix"
                   style="font-weight:600"
                   data-t="userFileSuffixLabel">Dateinamen ergänzen um eigenes Wort:</label>
            <input type="text"
                   id="userFileSuffix"
                   list="userFileSuffixOptions"
                   maxlength="64"
                   placeholder="MAP1"
                   style="padding:6px 8px;border:1px solid var(--border);border-radius:4px;min-width:120px;font-family:var(--mono)" />
            <datalist id="userFileSuffixOptions">
              <option value="MAP1"></option>
              <option value="MAP2"></option>
              <option value="MAP3"></option>
              <option value="MAP4"></option>
            </datalist>
          </div>
        </div>
```

Hintergrund:

- `<input list="…">` + `<datalist>` ist HTML-Standard: liefert ein
  Combo-Box-Verhalten — Freitexteingabe plus Vorschlags-Dropdown.
  Funktioniert in allen modernen Browsern, kein JS nötig für das
  Vorschlags-UI.
- Der Wrapper ist eine `class="card"`, damit die Box visuell zu den
  anderen Boxen im File-Tab paßt (gleiche Hintergrund-/Border-/Padding-
  Behandlung).
- `maxlength="64"` bremst absurd lange Eingaben.
- `placeholder="MAP1"` zeigt den ersten Vorschlag schon im leeren Feld.

## Stelle 2 — `i18n/*.js`: Label-Key in allen vier Sprachen

In allen vier Sprachdateien einen neuen Schlüssel
`userFileSuffixLabel` ergänzen — z. B. direkt unter den anderen
Datei-Tab-bezogenen Keys (`tabFile`, `fLoad`, `fSave`, `archivTitle`
oder einer der vorhandenen `archiv*`-Keys).

**`i18n/de.js`**:
```js
    userFileSuffixLabel: "Dateinamen ergänzen um eigenes Wort:",
```

**`i18n/en.js`**:
```js
    userFileSuffixLabel: "Add own word to filename:",
```

**`i18n/fr.js`**:
```js
    userFileSuffixLabel: "Ajouter un mot personnel au nom de fichier :",
```

**`i18n/es.js`**:
```js
    userFileSuffixLabel: "Añadir palabra propia al nombre de archivo:",
```

## Stelle 3 — `state-side.js`: globale Variable deklarieren

In `state-side.js` zu den anderen freistehenden Top-Level-States passen
(z. B. nähe `defaultMfr`, `globalToneType` oder `audiologUserNote` —
alle globalen, seitenunabhängigen Werte sitzen in diesem Block). Eine
neue `let`-Deklaration ergänzen:

```js
let userFileSuffix = ""; // global, gilt für alle Dateinamen-Exporte
```

Stil des umliegenden Codes beibehalten (`let`/`var` je nach Block).

## Stelle 4 — `file.js`: Helper für Suffix-Anwendung

In `file.js` ganz am Anfang (vor `resetAll` und `saveJson`) zwei
Helper-Funktionen einfügen. Wenn schon ein Helper-Block existiert,
dort einreihen.

```js
// Sicheres Suffix-Fragment aus dem User-Input (oder leerer String).
// Dateinamen-feindliche Zeichen (/, \, :, *, ?, ", <, >, |, Whitespace,
// Steuerzeichen) werden zu "_" ersetzt; rein-leere Eingabe → "".
function _safeUserFileSuffix() {
  if (typeof userFileSuffix !== "string") return "";
  const s = userFileSuffix.trim();
  if (!s) return "";
  return s.replace(/[\s\/\\:*?"<>|\x00-\x1F]/g, "_");
}

// Hängt den User-Suffix vor die Datei-Endung an. Beispiele:
//   _applyUserFileSuffix("foo.json")         + suffix "MAP1" → "foo_MAP1.json"
//   _applyUserFileSuffix("a-b-c.tar.gz")     + suffix "MAP1" → "a-b-c.tar_MAP1.gz"  (letzter Punkt)
//   _applyUserFileSuffix("foo")              + suffix "MAP1" → "foo_MAP1"
//   _applyUserFileSuffix("foo.json")         + leerer Suffix → "foo.json"
function _applyUserFileSuffix(name) {
  const suf = _safeUserFileSuffix();
  if (!suf) return name;
  const dot = name.lastIndexOf(".");
  if (dot < 0) return name + "_" + suf;
  return name.slice(0, dot) + "_" + suf + name.slice(dot);
}
```

## Stelle 5 — `file.js`: Helper in `saveJson` und `exportEasyEffects` anwenden

**`saveJson`** (aktuell Z. 172). Aktuell:

```js
  const fn = `ci-sound-balancing-${ds}-${ts}.json`;
```

Ersetzen durch:

```js
  const fn = _applyUserFileSuffix(`ci-sound-balancing-${ds}-${ts}.json`);
```

**`exportEasyEffects`** (aktuell Z. 560). Aktuell:

```js
  a.download = "ci-sound-balancing-easyeffects.json";
```

Ersetzen durch:

```js
  a.download = _applyUserFileSuffix("ci-sound-balancing-easyeffects.json");
```

## Stelle 6 — `print-md.js`: Helper in den beiden Markdown-Filenames anwenden

`print-md.js` lebt im selben Lade-Scope wie `file.js`. `_applyUserFileSuffix`
ist nach Ladereihenfolge (file.js Z. 12 in CODESTRUKTUR, print-md.js Z. 12d)
also schon verfügbar, wenn `mdArchivFilename` und `mdAudiologFilename`
aufgerufen werden.

**`mdArchivFilename`** (Z. 57–59):

```js
function mdArchivFilename() {
  return `ci-sound-balancing-archiv-${mdDateStampFile()}.md`;
}
```

Ersetzen durch:

```js
function mdArchivFilename() {
  return _applyUserFileSuffix(`ci-sound-balancing-archiv-${mdDateStampFile()}.md`);
}
```

**`mdAudiologFilename`** (Z. 652–658):

```js
function mdAudiologFilename() {
  const side = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  const sideTag = (side === "left")  ? "links"
                : (side === "right") ? "rechts"
                : "beide";
  return `ci-sound-balancing-audiologe-${mdDateStampFile()}-${sideTag}.md`;
}
```

Ersetzen durch:

```js
function mdAudiologFilename() {
  const side = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  const sideTag = (side === "left")  ? "links"
                : (side === "right") ? "rechts"
                : "beide";
  return _applyUserFileSuffix(`ci-sound-balancing-audiologe-${mdDateStampFile()}-${sideTag}.md`);
}
```

## Stelle 7 — `init.js`: Event-Listener + Restore aus localStorage

**Listener** — im DOMContentLoaded-Handler von `init.js` (vor den
Restore-Blöcken, am sinnvollsten neben den anderen Tab-übergreifenden
Listener-Bindings, z. B. vor oder nach dem MAPLAW-UI-Block ab Z. 322):

```js
  // ========== Globale Dateinamen-Ergänzung ==========
  const userFileSuffixEl = document.getElementById("userFileSuffix");
  if (userFileSuffixEl) {
    userFileSuffixEl.addEventListener("input", function () {
      userFileSuffix = String(this.value || "");
      try { localStorage.setItem("ci-lb-userFileSuffix", userFileSuffix); } catch (e) {}
    });
  }
```

(„input" statt „change", damit jeder Tastenanschlag direkt persistiert
wird — sonst geht der Suffix verloren, wenn der User direkt nach der
Eingabe auf „Speichern" klickt, ohne das Feld zu verlassen.)

**Restore aus eigenem localStorage-Key** — direkt nach dem Listener-
Block (oder zumindest im DOMContentLoaded-Handler):

```js
  try {
    const _sufSaved = localStorage.getItem("ci-lb-userFileSuffix");
    if (_sufSaved !== null) {
      userFileSuffix = String(_sufSaved);
      if (userFileSuffixEl) userFileSuffixEl.value = userFileSuffix;
    }
  } catch (e) {}
```

## Stelle 8 — `init.js`: Restore aus dem JSON-Hauptblock (ci-lb-v4)

Im Restore-Block (aktuell ab Z. 540), innerhalb des `try`-Blocks, **zusätzlich** zum
eigenen localStorage-Restore (Stelle 7) einen Eintrag ergänzen. Ein
sinnvoller Platz ist neben den anderen globalen, seiten-unabhängigen
Werten — z. B. nach dem `playerSourceMeas`-Block. Einfügen:

```js
      if (typeof d.userFileSuffix === "string") {
        userFileSuffix = d.userFileSuffix;
        const _el = document.getElementById("userFileSuffix");
        if (_el) _el.value = userFileSuffix;
      }
```

## Stelle 9 — `init.js`: Autosave im setInterval-Block

Im `setInterval`-Autosave (ab Z. 695), innerhalb des
`JSON.stringify({…})`-Objekts. Direkt **nach** dem `globalToneType`-
Feld (oder einer anderen Stelle im globalen Block) einfügen:

```js
          userFileSuffix: (typeof userFileSuffix === "string") ? userFileSuffix : "",
```

(Komma am Zeilenende; bestehende Komma-Hygiene des umliegenden Blocks
einhalten.)

## Stelle 10 — `file.js`: JSON-Save/Load erweitern

**JSON-Save** in `saveJson` (aktuell ab Z. 65, das `d`-Objekt). Direkt
**vor** `audiologUserNote` (oder bei einem anderen globalen Feld)
einfügen:

```js
    userFileSuffix: (typeof userFileSuffix === "string") ? userFileSuffix : "",
```

**JSON-Load** in `applyLoadedData` (Suche nach „applyLoadedData" — laut
CODESTRUKTUR ist das die Restore-Funktion für JSON-Load). An passender
Stelle im Block, der globale Werte zurückspielt:

```js
  if (typeof d.userFileSuffix === "string") {
    userFileSuffix = d.userFileSuffix;
    const _el = document.getElementById("userFileSuffix");
    if (_el) _el.value = userFileSuffix;
  }
```

## Stelle 11 — `SPEC.md` / `spec/`

Im Kapitel **Laden/Speichern** (`spec/`-Datei für Persistenz und
Export) ergänzen:

> Oberhalb der Karten Archiv-Box und Audiologen-Box steht eine globale
> Eingabezeile „Dateinamen ergänzen um eigenes Wort". Der eingegebene
> Wert wird beim Speichern aller exportierten Dateien (JSON-Save,
> EasyEffects-Export, Archiv-Markdown, Audiologen-Markdown) ans Ende
> des Dateinamens gehängt, vor die Datei-Endung, getrennt durch einen
> Unterstrich. Vorgeschlagen werden „MAP1" bis „MAP4" via
> `<datalist>`-Dropdown; Freitext ist möglich. Dateinamen-feindliche
> Zeichen werden auf `_` reduziert. Persistenz: separater
> localStorage-Schlüssel `ci-lb-userFileSuffix` (sofort beim Eingabe-
> Change) plus Mitspeicherung im Haupt-Save (`ci-lb-v4`) und im
> JSON-Save/Load.

## Stelle 12 — `CODESTRUKTUR.md`

Im Abschnitt zur `state-side.js`-Modulbeschreibung (Z. 107) ist die
Liste der freistehenden Globals zu lang, aber neu ist hier
`userFileSuffix`. In der Liste der freistehenden globalen Variablen
ergänzen.

Im Abschnitt zur `file.js`-Modulbeschreibung (Z. 116) den Helper
`_safeUserFileSuffix` und `_applyUserFileSuffix` erwähnen.

Im Datenfluss-Block einen kurzen Absatz nach „Markdown-Export
(Archiv-Box)" anlegen:

> **Globaler Dateinamen-Suffix:** Das Eingabefeld
> `#userFileSuffix` im Laden/Speichern-Tab speichert seinen Wert in
> `userFileSuffix` (state-side.js) und in `localStorage`
> (`ci-lb-userFileSuffix`, sofort bei jedem `input`-Event). Beim
> Erzeugen von Download-Dateinamen wird der Wert über
> `_applyUserFileSuffix` (file.js) zwischen Basisname und Endung
> eingeschoben — wirkt in `saveJson`, `exportEasyEffects`,
> `mdArchivFilename`, `mdAudiologFilename`.

## Akzeptanztest-Checkliste (manuell im Browser)

### Vorbereitung

1. Werkzeug laden. Tab „Laden/Speichern" öffnen.
2. Erwartet: ganz oben eine neue Karte mit Label „Dateinamen
   ergänzen um eigenes Wort:" und einem Eingabefeld mit
   Placeholder „MAP1". Darunter wie gewohnt die beiden bestehenden
   Karten Archiv-Box und Audiologen-Box.
3. Auf das Eingabefeld klicken — Browser bietet ein Dropdown mit den
   Vorschlägen MAP1, MAP2, MAP3, MAP4 an.

### Test A — Suffix in JSON-Save

1. Suffix „MAP1" wählen (Dropdown oder Eingabe).
2. Im Tab „Daten speichern" klicken (Knopf `fSaveBtn`).
3. Erwartet: Datei-Save-Dialog zeigt einen Dateinamen wie
   `ci-sound-balancing-2026-05-24-1430_MAP1.json`.
4. Datei tatsächlich speichern — der gespeicherte Dateiname endet
   wirklich auf `_MAP1.json`.

### Test B — Suffix in Markdown-Exporten

1. Suffix „TestA" eintragen.
2. „Markdown Text exportieren" in der Archiv-Box klicken.
3. Erwartet: heruntergeladene Datei heißt
   `ci-sound-balancing-archiv-2026-05-24-1430_TestA.md`.
4. „Markdown Text exportieren" in der Audiologen-Box klicken
   (falls Knopf vorhanden).
5. Erwartet: heruntergeladene Datei heißt
   `ci-sound-balancing-audiologe-…_TestA.md`.

### Test C — Suffix in EasyEffects-Export

1. Suffix „MAP3" eintragen.
2. EasyEffects-Export auslösen (im UI vorhandener Knopf).
3. Erwartet: heruntergeladene Datei
   `ci-sound-balancing-easyeffects_MAP3.json`.

### Test D — Leerer Suffix

1. Feld leeren (oder nur Leerzeichen eintippen).
2. Datei speichern.
3. Erwartet: Dateiname ohne Suffix-Anhang, wie vorher.

### Test E — Sonderzeichen-Filter

1. Im Feld z. B. `My/MAP*1` eintragen.
2. Datei speichern.
3. Erwartet: Dateiname enthält `_My_MAP_1.json` (Schrägstrich und
   Stern wurden zu `_`).

### Test F — Persistenz localStorage

1. Suffix „MAP2" eintragen.
2. Browser-Tab neu laden (Strg-R).
3. Erwartet: Feld zeigt nach Reload wieder „MAP2".

### Test G — Persistenz JSON-Round-Trip

1. Suffix „RoundTrip" eintragen.
2. „Daten speichern" → JSON-Datei abspeichern.
3. „Daten löschen" (oder Reset), Feld leeren.
4. „Daten laden" → JSON-Datei laden.
5. Erwartet: Feld zeigt wieder „RoundTrip".

### Test H — Wirkung auf andere Tabs

1. Suffix gesetzt, Tab-Wechsel auf z. B. Player.
2. Erwartet: kein sichtbarer Effekt auf andere Tabs. Die Suffix-
   Eingabe lebt nur im Laden/Speichern-Tab; in anderen Tabs ist sie
   nicht sichtbar.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie A–H einzeln durchgehen
und für jede melden: **erfüllt / nicht erfüllt / unklar**, mit Datei-
und Zeilenangabe der relevanten Stelle.

Insbesondere prüfen:

- Ist `userFileSuffix` in `state-side.js` deklariert (nicht in einer
  Funktion lokal)? Sonst sehen `_safeUserFileSuffix` und
  `_applyUserFileSuffix` nichts.
- Ist `_applyUserFileSuffix` in **allen vier** Filename-Generatoren
  konsequent angewandt: `saveJson`, `exportEasyEffects`,
  `mdArchivFilename`, `mdAudiologFilename`?
- Wird der Suffix bei jedem Tastenanschlag persistiert (Event
  `input`)? Bei `change` allein würde ein Klick auf den Save-Knopf vor
  Feld-Verlassen den Suffix verlieren.
- Sind die Persistenz-Pfade redundant gehalten (eigener
  localStorage-Key + Mitspeicherung im Haupt-JSON)? Beides sollte
  gleichzeitig wirken, damit Tab-Reload **und** JSON-Round-Trip
  funktionieren.
- Greift der Sonderzeichen-Filter auf alle problematischen Zeichen?
  Der Regex `[\s\/\\:*?"<>|\x00-\x1F]` deckt Whitespace,
  Pfadtrenner, Wildcards, Anführungszeichen und Steuerzeichen ab.
  Falls weitere Zeichen problematisch sind (Punkt am Ende, sehr
  lange Eingabe), entsprechend ergänzen oder Rückfrage.
- Bricht der `<datalist>`-Mechanismus in einem alten/exotischen
  Browser (falls relevant)? Sofortiges Fallback ist nicht nötig —
  das Eingabefeld funktioniert auch ohne Vorschläge.

Bei Unklarheit Rückfrage statt Annahme.
