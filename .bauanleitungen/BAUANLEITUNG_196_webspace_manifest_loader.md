# Bauanleitung 196 — Webspace-Manifest-Loader

**Versionsbump:** `js/version.js` von `"3.2.195-beta"` (oder aktuellem
195-Fix-Stand) auf `"3.2.196-beta"`.

**Voraussetzung:** BA 195 muss durchgebaut sein. Diese BA setzt auf
dem Provider-System aus BA 193/194/195 auf.

## Ziel

Generischer Manifest-Loader, der die Audio-Bibliothek aus dem Webspace
zugänglich macht. Webspace-Root ist `http://ci-sound-balancing.honigburg.de/opus/`;
darunter liegen die Manifeste (`audio.manifest/index.json` etc.) und die
Audio-Dateien gemäß dem in `docs/Konzept_Audio_Manifest.md`
beschriebenen Schema.

Der Loader registriert sich als dritter Provider neben "generated" und
"embed" (BA 193) bzw. "local-books" (BA 195). Er lädt im Hintergrund:

1. `index.json` (alle bekannten Quellen).
2. Pro Quelle `source.json` (Metadaten + Pfad-Basis).
3. Pro Quelle die Kategorie-Manifeste (Sätze / Musik / Hörbücher /
   Geräusche).

Sobald eine Quelle gelistet ist, ruft der Loader die passenden
Refresh-UI-Funktionen, damit die neuen Items im jeweiligen Sub-Block
ohne Tool-Neustart erscheinen.

**Bewusst nicht in dieser BA:**
- Filter nach Sprache pro Sub-Block (kommt mit BA 197 für Sätze; bei
  Hörbüchern später).
- Pfad-Sortierung in Indizes (Pointer-Manifeste mit `kind: "index"`
  werden in dieser BA ignoriert; die UI sortiert direkt über die
  Collection-Tags).
- Streaming-Wiedergabe — Audio wird wie heute per `fetch` +
  `decodeAudioData` komplett in einen Buffer geladen.

## Voraussetzungen am Webspace

- `Access-Control-Allow-Origin: *` (oder die Tool-Origin) muss auf
  allen Manifest- und Audio-URLs gesetzt sein. Sonst scheitert
  `decodeAudioData` an cross-origin Buffern.
- Manifest-Schema gemäß `docs/Konzept_Audio_Manifest.md` mit
  `schema: "ci-sb-corpus/2"`, `kind: "collection"`, `category`
  jeweils gesetzt.
- URL-Auflösung: `<webspace-root> + <source.base> + <item.audio>`.

Falls der Webspace nicht erreichbar ist (HTTP-Fehler, `file://`-Modus,
offline), läuft das Tool ohne Webspace-Inhalte weiter — Generiert +
Embed + lokale Uploads bleiben verfügbar.

## Schritt 1: Loader-Modul in `js/audio-source.js`

Ans Ende der Datei anfügen:

```js
// ============================================================
// Webspace-Manifest-Loader (BA196)
// ============================================================

// Konfigurierbar ueber window.CI_SB_WEBSPACE_ROOT vor Lade-Beginn.
const AM_WEBSPACE_ROOT_DEFAULT = "http://ci-sound-balancing.honigburg.de/opus/";

function amWebspaceRoot() {
  const r = (typeof window !== "undefined" && window.CI_SB_WEBSPACE_ROOT)
    ? window.CI_SB_WEBSPACE_ROOT
    : AM_WEBSPACE_ROOT_DEFAULT;
  return r.endsWith("/") ? r : (r + "/");
}

const _amWebspace = {
  indexLoaded: false,
  failed: false,
  sources: [],                 // aus index.json
  loaded: new Map(),           // sourceKey -> { source, manifests: {cat: [collection,...]} }
  pendingRefresh: new Set()    // Kategorien, deren UI nach erfolgreichem Laden refreshet werden soll
};

async function amWebspaceLoadIndex() {
  if (_amWebspace.indexLoaded || _amWebspace.failed) return;
  const url = amWebspaceRoot() + "audio.manifest/index.json";
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    _amWebspace.sources = Array.isArray(data.sources) ? data.sources : [];
    _amWebspace.indexLoaded = true;
    console.log("[audio-source/webspace] Index geladen: " + _amWebspace.sources.length + " Quellen.");
  } catch (e) {
    console.warn("[audio-source/webspace] Index nicht erreichbar (" + url + "):", e.message);
    _amWebspace.failed = true;
  }
}

async function amWebspaceLoadSource(srcKey) {
  if (_amWebspace.failed) return null;
  if (_amWebspace.loaded.has(srcKey)) return _amWebspace.loaded.get(srcKey);
  const meta = _amWebspace.sources.find(function (s) { return s.key === srcKey; });
  if (!meta) return null;

  const root = amWebspaceRoot();
  let source = null;
  try {
    const srcUrl = root + "audio.manifest/" + meta.source;
    const r = await fetch(srcUrl, { mode: "cors" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    source = await r.json();
  } catch (e) {
    console.warn("[audio-source/webspace] source.json " + srcKey + " fehlgeschlagen:", e.message);
    return null;
  }

  const manifests = {};
  const cats = (source.manifests && typeof source.manifests === "object") ? source.manifests : {};
  for (const cat of Object.keys(cats)) {
    manifests[cat] = [];
    const list = Array.isArray(cats[cat]) ? cats[cat] : [];
    for (const mfPath of list) {
      const mfUrl = root + "audio.manifest/" + srcKey + "/" + mfPath;
      try {
        const mr = await fetch(mfUrl, { mode: "cors" });
        if (!mr.ok) throw new Error("HTTP " + mr.status);
        const mf = await mr.json();
        // Indizes (Pointer) hier ignorieren — BA196 unterstuetzt nur collections direkt.
        if (mf.kind === "collection") manifests[cat].push(mf);
      } catch (e) {
        console.warn("[audio-source/webspace] Manifest " + mfPath + " fehlgeschlagen:", e.message);
      }
    }
  }

  const entry = { meta: meta, source: source, manifests: manifests };
  _amWebspace.loaded.set(srcKey, entry);
  return entry;
}

function _amResolveAudioUrl(rawAudio, sourceBase) {
  if (!rawAudio) return null;
  if (/^(data:|https?:|blob:)/i.test(rawAudio)) return rawAudio;
  const root = amWebspaceRoot();
  const base = sourceBase || "";
  return root + base + rawAudio;
}

// --- Provider-Eintrag fuer Webspace ---

amRegisterProvider({
  id: "webspace",
  listItems: function (category) {
    const out = [];
    if (!_amWebspace.indexLoaded) return out;
    for (const [srcKey, entry] of _amWebspace.loaded) {
      const cols = entry.manifests[category] || [];
      for (const col of cols) {
        // Hoerbuecher gehen ueber listCollections, nicht ueber Items
        if (category === "hoerbuecher") continue;
        const colTags = col.tags || {};
        for (const it of (col.items || [])) {
          out.push({
            id: srcKey + ":" + (col.title || "") + "/" + (it.id || ""),
            title: it.title || it.id || "(unbenannt)",
            audio: _amResolveAudioUrl(it.audio, entry.source.base),
            duration: it.duration,
            sourceTitle: entry.meta.name || entry.source.name || srcKey,
            license: it.license || entry.source.license || entry.meta.license,
            credit:  it.credit  || entry.source.credit,
            tags: Object.assign({}, colTags, it.tags || {})
          });
        }
      }
    }
    return out;
  },
  listCollections: function (category) {
    if (category !== "hoerbuecher") return [];
    const out = [];
    if (!_amWebspace.indexLoaded) return out;
    for (const [srcKey, entry] of _amWebspace.loaded) {
      const cols = entry.manifests["hoerbuecher"] || [];
      for (const col of cols) {
        const id = "webspace-book:" + srcKey + ":" + (col.title || "");
        out.push({
          schema: col.schema,
          kind: "collection",
          category: "hoerbuecher",
          id: id,
          title: col.title || srcKey,
          lang: col.lang || null,
          tags: col.tags || {},
          license: entry.source.license || entry.meta.license,
          credit:  entry.source.credit,
          items: (col.items || []).map(function (it, i) {
            return {
              id: id + "#" + (it.id || ("ch" + (i+1))),
              title: it.title || ("Kapitel " + (i+1)),
              audio: _amResolveAudioUrl(it.audio, entry.source.base),
              duration: it.duration,
              tags: it.tags || {}
            };
          })
        });
      }
    }
    return out;
  }
});
```

## Schritt 2: Bootstrap-Funktion

Weiter in `js/audio-source.js`:

```js
function amWebspaceBootstrap() {
  amWebspaceLoadIndex().then(function () {
    if (_amWebspace.failed) return;
    // Pro Source nachladen — parallel, aber pro Erfolg ein UI-Refresh.
    for (const meta of _amWebspace.sources) {
      amWebspaceLoadSource(meta.key).then(function (entry) {
        if (!entry) return;
        const cats = Array.isArray(meta.categories) ? meta.categories : [];
        for (const cat of cats) {
          if (cat === "geraeusche") {
            if (typeof plNoiseRefreshUI    === "function") plNoiseRefreshUI();
            if (typeof plSentBgRefreshUI   === "function") plSentBgRefreshUI();
          } else if (cat === "hoerbuecher") {
            if (typeof plBookRefreshUI     === "function") plBookRefreshUI();
          } else if (cat === "saetze") {
            // Wird in BA 197 relevant, sobald Saetze ueber amCollectItems gehen.
            if (typeof sRefreshSpeakerDropdown === "function") sRefreshSpeakerDropdown();
          } else if (cat === "musik") {
            // Keine UI-Sub-Block-Liste fuer Musik in dieser BA — kommt spaeter.
          }
        }
      });
    }
  });
}
```

## Schritt 3: Bootstrap-Aufruf

Am Ende von `js/init.js`, **nach** den Refresh-UI-Aufrufen aus BA 193/195:

```js
if (typeof amWebspaceBootstrap === "function") {
  amWebspaceBootstrap();
}
```

## Schritt 4: Doku

### 4a. `docs/CODESTRUKTUR.md`

`js/audio-source.js` — Erweiterung: Webspace-Loader. Funktionen:
`amWebspaceRoot`, `amWebspaceLoadIndex`, `amWebspaceLoadSource`,
`amWebspaceBootstrap`. Zustands-Objekt `_amWebspace` (privat). Provider
"webspace" liefert `listItems` für `geraeusche/musik/saetze` und
`listCollections` für `hoerbuecher`.

Konfigurations-Hinweis: `window.CI_SB_WEBSPACE_ROOT` kann vor
Tool-Start gesetzt werden, um den Root zu überschreiben. Default
`http://ci-sound-balancing.honigburg.de/opus/`.

### 4b. `docs/spec/06-player.md`

Im Abschnitt zur Wiedergabe-Card ergänzen:

```
- **Webspace-Manifest-Loader (BA 196):** Beim Tool-Start lädt
  `js/audio-source.js` im Hintergrund `audio.manifest/index.json`
  vom Webspace-Root (Default `http://ci-sound-balancing.honigburg.de/opus/`).
  Pro Quelle werden `source.json` und Kategorie-Manifeste lazy
  nachgeladen; bei jedem erfolgreichen Source-Lade-Vorgang werden die
  betroffenen Sub-Block-UIs neu gerendert. Pfad-Auflösung gemäß
  Konzept-Doku: `<root> + source.base + item.audio`.
- Offline-Fallback: bei Netzwerk-/CORS-Fehlern bleibt der Player
  ohne Webspace-Inhalte funktional (generiert + embed + lokale
  Uploads).
- Pointer-Manifeste (`kind: "index"`) werden in BA 196 ignoriert; nur
  direkte Collection-Manifeste fließen in die UI.
```

## Schritt 5: Versionsbump

```js
const APP_VERSION = "3.2.196-beta";
```

## Akzeptanztest

1. Tool laden mit Internet-Verbindung. Konsole zeigt
   `[audio-source/webspace] Index geladen: N Quellen.` **Erwartet:** ✓
2. Quelle „Geräusche" wählen: das Dropdown enthält jetzt nicht nur die
   drei generierten Rauscher, sondern zusätzlich Items aus den
   Webspace-Quellen `test-noise` und `musan/geraeusche`. Sortierung
   „nach Quelle" zeigt die Gruppen klar. **Erwartet:** ✓
3. Ein Webspace-Geräusch wählen, Play: Datei lädt vom Webspace, wird
   abgespielt. Bei aktivem EQ/Warp läuft sie durch die Korrektur wie
   ein User-Upload. **Erwartet:** ✓
4. Quelle „Sätze", Hintergrund-Geräusch aktivieren — im Dropdown
   stehen jetzt auch die Webspace-Geräusche zur Verfügung. SNR-Mix
   funktioniert mit RMS-Normalisierung über Quellen hinweg.
   **Erwartet:** ✓
5. Quelle „Hörbücher": Webspace-Hörbücher tauchen im Hörbuch-Dropdown
   neben den lokalen Uploads auf (sofern der Webspace welche bereit
   stellt — anfangs ggf. leer). **Erwartet:** ✓ (oder ✓ leer, falls
   noch keine Webspace-Hörbücher dort liegen).
6. Tool offline laden (Netzwerk im Browser deaktivieren, neu laden):
   Konsole zeigt „Index nicht erreichbar". Quelle „Geräusche" zeigt
   nur die drei generierten Rauscher. Andere Quellen funktionieren
   ohne Webspace-Anteil. **Erwartet:** ✓
7. `window.CI_SB_WEBSPACE_ROOT = "http://anderer-host/foo/"` in der
   Browser-Konsole setzen vor dem Reload (z.B. via Bookmarklet),
   dann Tool neu laden: Lader holt von der neuen Adresse.
   **Erwartet:** ✓ (Test optional, demonstriert nur die Konfigurier-
   barkeit).

## Selbstprüfungsauftrag

Jeden der 7 Punkte einzeln durchgehen. Zusätzlich:

- CORS-Konfiguration am Webspace dokumentieren — die BA empfiehlt
  `Access-Control-Allow-Origin: *`. Wenn der Webspace das nicht
  liefert, scheitert `decodeAudioData` mit einem cross-origin-Fehler
  beim ersten Geräusch-Play; das ist kein Bug der BA, sondern
  Server-seitig zu beheben.
- `_amWebspace.indexLoaded` / `_amWebspace.failed` sind exklusiv
  (entweder/oder, nicht beides true).
- Nach erfolgreichem `amWebspaceLoadSource`-Call werden die Refresh-UI-
  Funktionen exakt einmal pro Source aufgerufen (nicht mehrfach,
  nicht gar nicht).
- `js/version.js` enthält `"3.2.196-beta"`.

## Folge-Bauanleitungen

- **BA 197:** Sätze auf das Manifest umstellen (heute `sentences.json`
  → `amCollectItems("saetze")`). Bringt Sätze-Titel-Fix mit.
- **BA 198:** i18n en/fr/es für alle neuen Keys aus BA 192–197.
- **Spätere BAs:**
  - Pointer-Manifeste (`kind: "index"`) unterstützen — sinnvoll, sobald
    die Manifest-Sammlung groß wird.
  - Streaming-Wiedergabe statt Voll-Buffer für lange Hörbuch-Kapitel.
