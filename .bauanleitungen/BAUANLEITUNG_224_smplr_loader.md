# BA 224 — smplr- und soundfont2-Loader-Infrastruktur

## Ziel

Lade-Infrastruktur fuer die smplr-Library (Mellotron + Soundfont2)
nach dem Muster von `js/rubberband-loader.js`. Diese BA baut nur die
Plumbing — keine neuen Tonarten, kein UI, keine Verfahrens-Aenderung.
BA 225 und 226 setzen auf diesem Loader auf.

Versionsbump: `js/version.js` von `3.2.223-beta` auf `3.2.224-beta`.

## Was schon vorbereitet ist (NICHT neu kopieren)

Die Vendor-Dateien liegen bereits unter `vendors/`:

```
vendors/smplr/dist/smplr.esm.js      (145 KB, ESM-Bundle)
vendors/smplr/dist/smplr.d.ts        (TypeScript-Definitionen, nur Doku)
vendors/soundfont2/lib/SoundFont2.js (164 KB, UMD-Bundle)
vendors/soundfont2/LICENSE           (MIT)
vendors/soundfont2/package.json
```

Pruefen mit `ls -la vendors/smplr/dist/ vendors/soundfont2/lib/`. Wenn
eine der Dateien fehlt, STOP und beim Nutzer rueckfragen.

## Vor dem Bau

`vendors/smplr/` braucht noch eine LICENSE-Datei (smplr ist MIT,
liefert aber keine LICENSE-Datei im Repo). Sonnet legt
`vendors/smplr/LICENSE.txt` mit folgendem Inhalt an:

```
MIT License

Copyright (c) Daniel Beltran (danigb) and smplr contributors

See https://github.com/danigb/smplr for full source and license text.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```

## Schritt 1 — `index.html` ergaenzen

In `index.html` den Script-Block (ab ca. Z. 135) erweitern. Direkt
**vor** der Zeile `'js/rubberband-loader.js',` zwei neue Eintraege
einfuegen:

**Vorher** (Z. 143-144):
```js
        'vendors/rubberband-wasm/dist/index.umd.min.js',
        'js/rubberband-loader.js',
```

**Nachher**:
```js
        'vendors/rubberband-wasm/dist/index.umd.min.js',
        'js/rubberband-loader.js',
        'vendors/soundfont2/lib/SoundFont2.js',
        'js/smplr-loader.js',
```

Die UMD-Datei `SoundFont2.js` legt `window.SoundFont2` global an.
Die smplr-ESM wird NICHT als `<script>` geladen — sie wird im Loader
per dynamic `import()` zur Laufzeit gefetcht. Deshalb steht nur die
`SoundFont2.js` im Script-Array.

## Schritt 2 — neue Datei `js/smplr-loader.js`

Datei komplett neu anlegen. Vollstaendiger Inhalt:

```js
// ============================================================
// SMPLR-LOADER — Lazy-Loader fuer smplr (Mellotron + Soundfont2)
// ============================================================
// vendors/smplr/dist/smplr.esm.js wird per dynamic import() bei
// Bedarf geladen. Liefert Mellotron- und Soundfont2-Sampler-
// Instanzen als Singletons (Cache pro Token).
//
// Erwartet, dass vendors/soundfont2/lib/SoundFont2.js per <script>
// in index.html vorher geladen wurde -> globales window.SoundFont2.
//
// Exportiert ins globale Scope:
//   SMPLR_SF2_KEYS                       readonly object key -> URL
//   smplrLoad()                          -> Promise<smplrModule>
//   smplrIsLoaded()                      -> boolean
//   loadMellotron(ctx, variant)          -> Promise<Instrument>
//   loadSoundfont2(ctx, key)             -> Promise<Sampler>
//   loadSamplerByToken(ctx, token)       -> Promise<Instrument|Sampler>
//   smplrSamplerIsReady(token)           -> boolean
//   smplrLastError                       -> string|null
//
// Token-Schema (wird in BA 225 in toneType_freqmatch verwendet):
//   "smplr:mellotron:<variantName>"   variantName aus getMellotronNames()
//   "smplr:sf2:<key>"                 key aus SMPLR_SF2_KEYS

const SMPLR_SF2_KEYS = Object.freeze({
  galaxy:   "https://smpldsnds.github.io/soundfonts/soundfonts/galaxy-electric-pianos.sf2",
  gigaMidi: "https://smpldsnds.github.io/soundfonts/soundfonts/giga-hq-fm-gm.sf2",
  supersaw: "https://smpldsnds.github.io/soundfonts/soundfonts/supersaw-collection.sf2"
});

let _smplrModule = null;
let _smplrLoadPromise = null;
let smplrLastError = null;

// token -> ready instance (nur Eintrag, wenn .load aufgeloest ist)
const _samplerCache = new Map();
// token -> Promise<instance> (waehrend des Ladens)
const _samplerLoading = new Map();

function smplrIsLoaded() {
  return _smplrModule !== null;
}

function smplrLoad() {
  if (_smplrModule) return Promise.resolve(_smplrModule);
  if (_smplrLoadPromise) return _smplrLoadPromise;

  _smplrLoadPromise = (async () => {
    try {
      const mod = await import("./vendors/smplr/dist/smplr.esm.js");
      _smplrModule = mod;
      smplrLastError = null;
      return mod;
    } catch (e) {
      const msg = "smplr ESM-Bundle konnte nicht geladen werden: "
        + (e && e.message ? e.message : String(e))
        + ". Laeuft das Tool ueber file://? Bitte lokalen Server "
        + "verwenden (python3 -m http.server).";
      smplrLastError = msg;
      throw new Error(msg);
    }
  })();

  _smplrLoadPromise.catch(() => { _smplrLoadPromise = null; });
  return _smplrLoadPromise;
}

function smplrSamplerIsReady(token) {
  return _samplerCache.has(token);
}

function loadMellotron(ctx, variant) {
  const token = "smplr:mellotron:" + variant;
  if (_samplerCache.has(token)) return Promise.resolve(_samplerCache.get(token));
  if (_samplerLoading.has(token)) return _samplerLoading.get(token);

  const p = (async () => {
    const mod = await smplrLoad();
    if (typeof mod.Mellotron !== "function") {
      throw new Error("smplr.Mellotron nicht im ESM-Bundle gefunden");
    }
    const instance = mod.Mellotron(ctx, { instrument: variant });
    await instance.load;
    _samplerCache.set(token, instance);
    return instance;
  })();

  _samplerLoading.set(token, p);
  p.catch(e => {
    smplrLastError = "Mellotron '" + variant + "' Laden fehlgeschlagen: "
      + (e && e.message ? e.message : String(e));
  }).finally(() => {
    _samplerLoading.delete(token);
  });
  return p;
}

function loadSoundfont2(ctx, key) {
  const url = SMPLR_SF2_KEYS[key];
  if (!url) return Promise.reject(new Error("Unbekannter SF2-Key: " + key));

  const token = "smplr:sf2:" + key;
  if (_samplerCache.has(token)) return Promise.resolve(_samplerCache.get(token));
  if (_samplerLoading.has(token)) return _samplerLoading.get(token);

  const p = (async () => {
    if (typeof window === "undefined" || typeof window.SoundFont2 !== "function") {
      throw new Error("window.SoundFont2 fehlt — "
        + "vendors/soundfont2/lib/SoundFont2.js nicht geladen?");
    }
    const mod = await smplrLoad();
    if (typeof mod.Soundfont2 !== "function") {
      throw new Error("smplr.Soundfont2 nicht im ESM-Bundle gefunden");
    }
    const sampler = mod.Soundfont2(ctx, {
      url,
      createSoundfont: (data) => new window.SoundFont2(data)
    });
    await sampler.load;
    // Default-Instrument (Index 0) laden — Modalbox-Eintrag spielt nur
    // dieses, Sub-Instrumente werden in BA 225/226 nicht angeboten.
    if (Array.isArray(sampler.instrumentNames) && sampler.instrumentNames.length > 0) {
      sampler.loadInstrument(sampler.instrumentNames[0]);
    }
    _samplerCache.set(token, sampler);
    return sampler;
  })();

  _samplerLoading.set(token, p);
  p.catch(e => {
    smplrLastError = "Soundfont2 '" + key + "' Laden fehlgeschlagen: "
      + (e && e.message ? e.message : String(e));
  }).finally(() => {
    _samplerLoading.delete(token);
  });
  return p;
}

function loadSamplerByToken(ctx, token) {
  if (typeof token !== "string" || !token.startsWith("smplr:")) {
    return Promise.reject(new Error("Kein smplr-Token: " + token));
  }
  const parts = token.split(":");
  if (parts.length < 3) {
    return Promise.reject(new Error("Token-Format ungueltig: " + token));
  }
  const kind = parts[1];
  const rest = parts.slice(2).join(":");
  if (kind === "mellotron") return loadMellotron(ctx, rest);
  if (kind === "sf2")       return loadSoundfont2(ctx, rest);
  return Promise.reject(new Error("Unbekannte smplr-Kategorie: " + kind));
}
```

Die Datei wird per `<script defer>` geladen (siehe Schritt 1) und
laeuft im klassischen Script-Scope. Alle `let`/`const`/`function` auf
Top-Level landen damit im globalen Scope und sind ueberall im Tool
ansprechbar — gleiches Pattern wie `rubberband-loader.js`.

## Schritt 3 — Versionsbump

In `js/version.js` die Konstante anpassen:

**Vorher**:
```js
const APP_VERSION = "3.2.223-beta";
```

**Nachher**:
```js
const APP_VERSION = "3.2.224-beta";
```

## Schritt 4 — `docs/CODESTRUKTUR.md`

In der Tabelle der `js/`-Module einen neuen Eintrag direkt nach
`14a | rubberband-loader.js` einfuegen (Nummer `14b`):

```
| 14b | smplr-loader.js | Lazy-Loader fuer die smplr-Library (`vendors/smplr/dist/smplr.esm.js`, ESM-Bundle). Exportiert `smplrLoad()` (Promise<Modul>), `smplrIsLoaded()` (bool), `loadMellotron(ctx, variant)`, `loadSoundfont2(ctx, key)`, `loadSamplerByToken(ctx, token)`, `smplrSamplerIsReady(token)`, `smplrLastError`, `SMPLR_SF2_KEYS`. Singleton-Cache pro Token (`smplr:mellotron:<variant>` / `smplr:sf2:<key>`). Bezieht das ESM beim ersten Aufruf per dynamic `import()`; benoetigt ausserdem das vorab per `<script>` geladene UMD `vendors/soundfont2/lib/SoundFont2.js` (legt `window.SoundFont2` global an) fuer SF2-Decoding. Vorerst ungenutzt — wird ab BA 225 in `playToneTyped` aufgerufen. (BA 224) |
```

Falls die Tabelle keinen `14a`-Eintrag in der gleichen Form hat, in
der CODESTRUKTUR-Datei nach `rubberband-loader.js` suchen und direkt
darunter einfuegen — Format an die umgebende Tabelle anpassen.

## Pflichten dieser BA

- Versionsbump 3.2.223-beta -> 3.2.224-beta (Schritt 3)
- CODESTRUKTUR.md mit neuem Eintrag (Schritt 4)
- KEINE i18n-Aenderungen (Loader hat keine UI-Texte)
- KEINE Aenderungen an `audio.js`, `_VALID_TT`, `_openToneTypeDialog`
  oder anderen Stellen — die kommen in BA 225/226

## Akzeptanztest (Nutzer, Browser-Konsole)

Tool laden, dann F12 -> Konsole. Folgende Befehle der Reihe nach:

1. `smplrIsLoaded()` -> erwartet `false`
2. `Object.keys(SMPLR_SF2_KEYS)` -> erwartet `["galaxy","gigaMidi","supersaw"]`
3. `smplrLoad().then(m => console.log("loaded", Object.keys(m).length, "exports"))`
   -> erwartet nach <1s "loaded 30 exports" (oder aehnliche Zahl >20)
4. `smplrIsLoaded()` -> jetzt `true`
5. `smplrLoad().then(m => console.log(typeof m.Mellotron, typeof m.Soundfont2))`
   -> erwartet "function function"
6. `loadMellotron(gAC(), "TRON FLUTE").then(_ => console.log("mellotron ready"))`
   -> erwartet nach 2-10s "mellotron ready" (Netzwerk-abhaengig)
7. `smplrSamplerIsReady("smplr:mellotron:TRON FLUTE")` -> erwartet `true`
8. `loadSoundfont2(gAC(), "galaxy").then(s => console.log("sf2 ready, instruments:", s.instrumentNames.length))`
   -> erwartet nach 5-30s "sf2 ready, instruments: <N>"  (N typischerweise 4-15)
9. `smplrLastError` -> erwartet `null`

Vortest: in der UI muss nirgendwo etwas neues erscheinen oder
verschwinden. Alle bestehenden Verfahren (Frequenzabgleich Slider,
Adaptiv, Latenz etc.) verhalten sich exakt wie in 3.2.223.

Falls Schritt 3 ("ESM-Bundle konnte nicht geladen werden")
fehlschlaegt: Tool laeuft vermutlich unter `file://`. Bitte ueber
`python3 -m http.server` neu oeffnen.

## Selbstprueffungs-Auftrag an Sonnet

VOR der Fertig-Meldung jede Akzeptanz-Kriterie aus der Checkliste
durchgehen und einzeln berichten:

- Kriterium 1-9 jeweils: erfuellt / nicht erfuellt / unklar
  (mit Datei- und Zeilenangabe der relevanten Stelle).
- Zusatz: `index.html` Script-Reihenfolge: `SoundFont2.js` MUSS vor
  `smplr-loader.js` stehen (sonst ist `window.SoundFont2` beim
  Loader-Init noch undefined). Bestaetigen mit Zeilennummer.
- Zusatz: `js/version.js` enthaelt nach dem Bump `"3.2.224-beta"`.
  Bestaetigen mit Zeilennummer.
- Zusatz: `vendors/smplr/LICENSE.txt` ist angelegt und beginnt mit
  "MIT License". Bestaetigen.
- Zusatz: `docs/CODESTRUKTUR.md` enthaelt den neuen `14b`-Eintrag.
  Bestaetigen mit Zeilennummer.

Wenn irgendetwas als "unklar" markiert wird oder ein Akzeptanztest
nicht ohne Annahmen durchgegangen werden kann: STOP und beim Nutzer
rueckfragen, statt stillschweigend etwas anzunehmen.

## Nach Abschluss manuell pruefen (Zwischenpruefung)

- Tool laedt ohne Konsolen-Fehler.
- Versionslabel in der UI zeigt `3.2.224-beta` (statt 3.2.223-beta).
- Akzeptanztest-Schritte 1-9 (oben) laufen wie beschrieben durch.
- Anschliessend kann BA 225 starten.

## i18n

Diese BA hat keine UI-Texte. Keine Aenderungen an `i18n/*.js` noetig.
