# BAUANLEITUNG 184 — Rubberband-WASM Vendor-Files und Loader

## Zweck und Scope

Erste von drei Bauanleitungen für ein neues Frequenz-Warping-Verfahren
auf Basis von Rubberband-WASM. Diese Anleitung legt **nur die
Infrastruktur** an: Vendor-Files committen, JS-Loader anlegen, Lade-
Reihenfolge in `index.html` einbinden. Es passiert **keine** Änderung
am Player-Verhalten — das Tool läuft nach dieser BA klanglich
identisch zum Vorzustand.

Akzeptanz-Endpunkt dieser BA: in der Browser-Konsole liefert
`await rubberbandLoad()` ein Interface-Objekt zurück; bei file://-Block
kommt eine sprechende Fehlermeldung.

Die nachfolgenden BAs:
- **BA 185** hängt das Verfahren in die Player-UI ein (Dropdown,
  Defaults, i18n, Trigger-Stub).
- **BA 186** füllt die eigentliche Compute-Funktion (FIR-Bandpässe,
  Mono-Optimierung, Rubberband-Pitch-Shift pro Band).

## Vorabprüfung durch Sonnet

Prüfe vor dem Start per `grep -n 'APP_VERSION' js/version.js`, ob die
Datei `"3.2.183.1-beta"` enthält. Wenn nicht, beim Nutzer rückfragen.
Diese Bauanleitung erwartet diesen Ausgangs-Stand.

---

## Schritt 1 — Vendor-Files committen

Die Rubberband-WASM-Library liegt heute als reines Source-Tree in
`vendors/rubberband-wasm/` (`src/index.ts`, `src/rubberband.c`,
`build.sh`). Wir bauen sie **nicht** selbst, sondern holen die fertigen
Build-Artefakte direkt aus dem npm-Paket `rubberband-wasm@3.3.0` und
committen sie.

### Aktion

```bash
mkdir -p vendors/rubberband-wasm/dist
curl -sSL -o vendors/rubberband-wasm/dist/index.umd.min.js \
  https://unpkg.com/rubberband-wasm@3.3.0/dist/index.umd.min.js
curl -sSL -o vendors/rubberband-wasm/dist/rubberband.wasm \
  https://unpkg.com/rubberband-wasm@3.3.0/dist/rubberband.wasm
```

### Erwartete Datei-Größen

- `index.umd.min.js` ungefähr 6.8 KB
- `rubberband.wasm` ungefähr 265 KB

Wenn die Größen davon stark abweichen oder die Datei mit einer HTML-
Fehlerseite überschrieben wurde (z.B. weil unpkg auf eine UI-Seite
geredirected hat): **abbrechen** und beim Nutzer rückfragen. Nicht
raten.

### Sanity-Check

```bash
ls -la vendors/rubberband-wasm/dist/
file vendors/rubberband-wasm/dist/rubberband.wasm
head -c 100 vendors/rubberband-wasm/dist/index.umd.min.js
```

Erwartung:
- `rubberband.wasm` ist ein "WebAssembly (wasm) binary module".
- `index.umd.min.js` beginnt mit minifiziertem JS (z.B. `!function` oder
  einem Lizenz-Kommentar `/*! rubberband-wasm v3.3.0 ...`).

### Lizenz-Hinweis

Die Source-Lizenz in `vendors/rubberband-wasm/LICENSE` ist GPLv2 — das
ist mit der Tool-Lizenz (GPL-2.0-or-later seit Commit 272f9e1)
kompatibel. Keine Lizenz-Datei muß neu angelegt werden.

---

## Schritt 2 — Neue Datei `js/rubberband-loader.js`

Lazy WASM-Loader. Wird beim ersten Bedarf aufgerufen, cached die
Interface-Instanz im Modul-Scope, gibt sie als Promise zurück. Bei
Fehler (typisch: `fetch()` aus `file://` in Chromium) liefert er eine
sprechende Fehlermeldung, die spätere Aufrufer dem Nutzer zeigen
können.

### Skeleton — komplett übernehmen

```javascript
// ============================================================
// RUBBERBAND-LOADER — Lazy-Loader fuer rubberband-wasm@3.3.0
// ============================================================
// Geladen nach vendors/rubberband-wasm/dist/index.umd.min.js, das ein
// globales `rubberband`-Objekt mit RubberBandInterface bereitstellt.
// Exportiert ins globale Scope:
//   rubberbandLoad()      → Promise<RubberBandInterface>
//   rubberbandIsLoaded()  → boolean
//   rubberbandLastError   → string|null (nach Fehler gesetzt)
//
// Der Loader fetcht beim ersten Aufruf
// vendors/rubberband-wasm/dist/rubberband.wasm, compiliert das Modul
// und liefert eine initialisierte RubberBandInterface-Instanz.
// Folge-Aufrufe geben dieselbe Instanz zurueck (Singleton).

let _rbInterface = null;
let _rbLoadPromise = null;
let rubberbandLastError = null;

function rubberbandIsLoaded() {
  return _rbInterface !== null;
}

function rubberbandLoad() {
  if (_rbInterface) return Promise.resolve(_rbInterface);
  if (_rbLoadPromise) return _rbLoadPromise;

  _rbLoadPromise = (async () => {
    if (typeof rubberband === "undefined" || !rubberband.RubberBandInterface) {
      const msg = "Rubberband-UMD nicht geladen (vendors/rubberband-wasm/dist/index.umd.min.js fehlt im Script-Array?)";
      rubberbandLastError = msg;
      throw new Error(msg);
    }

    let resp;
    try {
      resp = await fetch("vendors/rubberband-wasm/dist/rubberband.wasm");
    } catch (e) {
      // Typisch unter file:// in Chromium: TypeError "Failed to fetch"
      const msg = "WASM-Datei konnte nicht geladen werden. Das Tool laeuft moeglicherweise unter file:// in einem Browser, der lokales fetch() blockiert. Bitte ueber einen lokalen Server starten (z.B. `python3 -m http.server`).";
      rubberbandLastError = msg;
      throw new Error(msg);
    }

    if (!resp.ok) {
      const msg = "WASM-Fetch fehlgeschlagen: HTTP " + resp.status;
      rubberbandLastError = msg;
      throw new Error(msg);
    }

    let bytes;
    try {
      bytes = await resp.arrayBuffer();
    } catch (e) {
      const msg = "WASM-Datei lesen fehlgeschlagen: " + (e && e.message ? e.message : e);
      rubberbandLastError = msg;
      throw new Error(msg);
    }

    let module;
    try {
      module = await WebAssembly.compile(bytes);
    } catch (e) {
      const msg = "WASM-Compile fehlgeschlagen: " + (e && e.message ? e.message : e);
      rubberbandLastError = msg;
      throw new Error(msg);
    }

    try {
      _rbInterface = await rubberband.RubberBandInterface.initialize(module);
    } catch (e) {
      const msg = "RubberBandInterface.initialize() fehlgeschlagen: " + (e && e.message ? e.message : e);
      rubberbandLastError = msg;
      throw new Error(msg);
    }

    rubberbandLastError = null;
    return _rbInterface;
  })();

  // Bei Fehler den Cache-Promise zuruecksetzen, damit ein erneuter
  // Aufruf einen neuen Versuch ausloest (z.B. nachdem der Nutzer das
  // Tool unter http:// statt file:// neu geoeffnet hat).
  _rbLoadPromise.catch(() => { _rbLoadPromise = null; });

  return _rbLoadPromise;
}
```

### Hinweis zur Fehler-Granularität

Der Fehler-Pfad ist bewußt fein typisiert, weil die späteren Aufrufer
(BA 186 in der Player-Status-Anzeige) diese Meldungen 1:1 dem Nutzer
zeigen. "WASM-Compile fehlgeschlagen" ist sehr viel hilfreicher als
ein generisches "Fehler beim Laden".

---

## Schritt 3 — Script-Tag in `index.html`

Das Tool lädt alle JS-Dateien zentral aus dem Array in `index.html`
(Z. 135-146). Wir hängen Vendor-UMD und Loader **vor** `freq-warp.js`
an die richtige Stelle.

### Vorher (Z. 135-146)

```html
      var scripts = [
        'js/debug.js',
        'js/mobile.js', 'js/touch-ctrl.js', 'js/i18n.js',
        'i18n/de.js', 'i18n/en.js', 'i18n/fr.js', 'i18n/es.js',
        'js/dependency-lock.js',
        'js/core.js', 'js/state-side.js', 'js/audio.js',
        'js/ui-implant.js', 'js/freq-table.js', 'js/data/cochlear-fats.js', 'js/implant-validate.js', 'js/test-ui.js', 'js/test.js', 'js/freqmatch-staircase.js', 'js/freqmatch.js', 'js/freqmatch-adaptive.js', 'js/freqmatch-slider.js',
        'js/results.js', 'js/chart.js', 'js/file.js', 'js/print.js', 'js/print-md.js', 'js/tab-print.js', 'js/tabs-eq.js', 'js/levels.js',
        'js/levels-tab.js', 'js/player.js', 'js/freq-warp.js', 'js/maplaw.js', 'js/lr-balance.js', 'js/latency.js', 'js/sentences.js', 'js/init.js', 'js/legal.js',
        'js/finanzen.js', 'js/unterstuetzung.js', 'js/update-check.js',
        'js/debug-tests.js', 'js/debug-tests-current.js'
      ];
```

### Nachher

```html
      var scripts = [
        'js/debug.js',
        'js/mobile.js', 'js/touch-ctrl.js', 'js/i18n.js',
        'i18n/de.js', 'i18n/en.js', 'i18n/fr.js', 'i18n/es.js',
        'js/dependency-lock.js',
        'js/core.js', 'js/state-side.js', 'js/audio.js',
        'js/ui-implant.js', 'js/freq-table.js', 'js/data/cochlear-fats.js', 'js/implant-validate.js', 'js/test-ui.js', 'js/test.js', 'js/freqmatch-staircase.js', 'js/freqmatch.js', 'js/freqmatch-adaptive.js', 'js/freqmatch-slider.js',
        'js/results.js', 'js/chart.js', 'js/file.js', 'js/print.js', 'js/print-md.js', 'js/tab-print.js', 'js/tabs-eq.js', 'js/levels.js',
        'vendors/rubberband-wasm/dist/index.umd.min.js',
        'js/rubberband-loader.js',
        'js/levels-tab.js', 'js/player.js', 'js/freq-warp.js', 'js/maplaw.js', 'js/lr-balance.js', 'js/latency.js', 'js/sentences.js', 'js/init.js', 'js/legal.js',
        'js/finanzen.js', 'js/unterstuetzung.js', 'js/update-check.js',
        'js/debug-tests.js', 'js/debug-tests-current.js'
      ];
```

**Konkret:** Zwei neue Einträge zwischen `'js/levels.js'` und
`'js/levels-tab.js'` einfügen — Vendor-UMD zuerst, dann der Loader.

Das `?v=`-Cache-Bust-Query gilt automatisch auch für die neuen Einträge
(Z. 148).

---

## Schritt 4 — `docs/CODESTRUKTUR.md` aktualisieren

Neuen Modul-Eintrag für `rubberband-loader.js` ergänzen. Position: in
der Modul-Tabelle, an einer Stelle die zur Ladereihenfolge passt
(zwischen `levels.js` und `levels-tab.js`, oder am passenden Platz im
Dokument — die existierende Struktur entscheidet).

Eintrag in der Tabelle:

> `rubberband-loader.js` — Lazy-Loader für die rubberband-wasm-Library
> (`vendors/rubberband-wasm/dist/`). Exportiert `rubberbandLoad()`
> (Promise<RubberBandInterface>), `rubberbandIsLoaded()` (bool) und
> `rubberbandLastError` (string|null). Lädt
> `vendors/rubberband-wasm/dist/rubberband.wasm` beim ersten Aufruf,
> cached die Interface-Instanz. Fehler-Handling für file://-Block und
> WASM-Compile-Fehler mit sprechenden Meldungen.

Wenn `CODESTRUKTUR.md` eine Sektion „Vendor-Bibliotheken" hat: dort
`vendors/rubberband-wasm/dist/` mit kurzem Hinweis ergänzen. Falls
nicht: keine zusätzliche Sektion anlegen, der Loader-Eintrag reicht.

---

## Schritt 5 — `js/version.js` Versions-Bump

### Vorher

```javascript
const APP_VERSION = "3.2.183.1-beta";
```

### Nachher

```javascript
const APP_VERSION = "3.2.184-beta";
```

---

## Akzeptanztest

Vom Nutzer ohne Code-Kenntnisse durchzuspielen:

### A — Smoke-Test: Ladevorgang

1. Tool öffnen (über lokalen Server, z.B. `python3 -m http.server` im
   Repo-Ordner, dann `http://localhost:8000/` aufrufen).
2. Browser-Konsole öffnen.
3. Erwartet: **keine** roten JS-Fehler in der Konsole, **keine**
   404-Meldungen für `index.umd.min.js` oder `rubberband-loader.js`.
4. Im Header zeigt das Versions-Tag `3.2.184-beta`.

### B — Loader-Test in der Konsole

1. In der Konsole tippen: `typeof rubberband` → Erwartet: `"object"`
   (kommt aus dem Vendor-UMD).
2. `typeof rubberbandLoad` → Erwartet: `"function"`.
3. `rubberbandIsLoaded()` → Erwartet: `false` (noch nicht geladen).
4. `await rubberbandLoad()` → Erwartet: ein Objekt mit Methoden wie
   `rubberband_new`, `rubberband_process`, `malloc`, `free` etc. Falls
   ein Fehler kommt: Fehlermeldung lesen, dem Nutzer schicken.
5. `rubberbandIsLoaded()` → Erwartet: `true`.
6. Erneut `await rubberbandLoad()` → Erwartet: dasselbe Objekt aus
   Cache, sofortige Antwort ohne Lade-Verzögerung.

### C — file://-Fehler-Handling (optional, manuell)

1. Tool unter `file://` öffnen (Doppelklick auf `index.html`).
2. In der Konsole `await rubberbandLoad()` ausführen.
3. Erwartet in Chromium: Promise rejected mit Fehlermeldung etwa "WASM-
   Datei konnte nicht geladen werden ... bitte ueber einen lokalen
   Server starten". In Firefox: u.U. funktioniert der Load (Firefox
   erlaubt lokale fetch()), dann läuft alles normal durch.

### D — Player unverändert

1. Player-Tab öffnen.
2. Verfahren-Dropdown öffnen.
3. Erwartet: vier Optionen wie bisher (Offline, Vocoder, Sinusoidal
   Modeling, Bandshift), Default Sinusoidal Modeling.
4. Audio-Datei laden, Play. Erwartet: klingt exakt wie vor BA 184 —
   diese BA ändert nichts am Wiedergabe-Verhalten.

---

## Selbstprüfungs-Auftrag an Sonnet

**Bevor du fertig meldest**, gehe jede der folgenden Akzeptanz-
Kriterien einzeln durch und melde **erfüllt / nicht erfüllt / unklar**
mit Datei und Zeilenangabe:

1. `vendors/rubberband-wasm/dist/index.umd.min.js` existiert,
   ungefähr 6.8 KB.
2. `vendors/rubberband-wasm/dist/rubberband.wasm` existiert,
   ungefähr 265 KB. `file <pfad>` meldet "WebAssembly".
3. `js/rubberband-loader.js` existiert und definiert globale Symbole
   `rubberbandLoad`, `rubberbandIsLoaded`, `rubberbandLastError`.
4. `index.html` Script-Array enthält zwischen `js/levels.js` und
   `js/levels-tab.js` die zwei neuen Einträge in dieser Reihenfolge:
   Vendor-UMD zuerst, Loader danach.
5. `docs/CODESTRUKTUR.md` hat einen neuen Eintrag für
   `rubberband-loader.js` mit Beschreibung.
6. `js/version.js` lautet `const APP_VERSION = "3.2.184-beta";`.
7. Andere JS-Dateien sind **nicht** angefasst (außer `version.js` und
   `index.html`).
8. `i18n/de.js`, `i18n/en.js`, `i18n/fr.js`, `i18n/es.js` sind **nicht**
   angefasst (das kommt in BA 185).

Bei "unklar" rückfragen, nicht still annehmen. ASCII-Quotes in allen
JS- und HTML-Edits prüfen.

---

## Nach Abschluß manuell prüfen

- Tool startet ohne Konsolen-Fehler unter lokalem Server.
- `await rubberbandLoad()` liefert in der Konsole ein Interface-Objekt.
- Player verhält sich unverändert (keine UI-Änderung, klanglich
  identisch zum Vorzustand).

Die nächste Bauanleitung (BA 185 — UI-Integration und Stub) bindet das
Rubberband-Verfahren in den Player-Tab ein.
