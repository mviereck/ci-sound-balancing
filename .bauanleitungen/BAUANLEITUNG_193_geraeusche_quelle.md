# Bauanleitung 193 — Geräusche als vierte Audioquelle + BA-192-Fixes

**Versionsbump:** `js/version.js` von `"3.2.192-beta"` (oder aktuellem
192-Fix-Stand) auf `"3.2.193-beta"`.

## Ziel

Die in BA 192 nur als ausgegrauter Slot vorgesehene Geräusche-Quelle
wird aktiviert. Inhalt in dieser BA:

- **Generierte Standardrauscher** (White, Pink, Brown) — im Browser per
  WebAudio erzeugt, ohne Datei.
- **Embed-Loader-Modul** (`js/audio-source.js`) — generischer Loader für
  später eingebackenes Manifest-Material. In dieser BA wird der Loader
  funktional gebaut; die Embed-Datei `assets/audio-embed/noises.js`
  liegt als leerer Stub vor. Sample-Geräusche werden später vom Build-
  Skript dort eingebaut.
- **Sortier-Dropdown** in der Geräusch-Quelle, mit deklarativer Achsen-
  Definition, sodass spätere BAs zusätzliche Achsen (oder Filter)
  ohne Code-Refactor anbauen können.
- **Anzeige-Block** zeigt bei Geräuschen Titel + Meta-Zeile
  (`kind · spectrum · Lizenz · Quelle`).

Außerdem werden **drei Design-Bugs aus BA 192** behoben:

1. **Pause-Buttons immer aktiv** — nicht nur bei aktivem Auto-Advance.
   Begründung: die Pause-Zeit wirkt auch zwischen Loop-Wiederholungen,
   muss also immer einstellbar sein.
2. **„0 ms / keine Pause"** als zusätzlicher Pause-Button.
3. **Lautstärke-Schnellbuttons** zusätzlich zum heutigen Number-Input
   (Number-Input bleibt für Feinwerte).

Der Titel-Doppel-Bug bei Sätzen aus BA 192 bleibt explizit in dieser BA
**ungelöst**; er wird in einer Folge-BA gefixt, sobald die Sätze auf
das neue Manifest umgestellt sind und damit ein sinnvoller Titel (Sprecher
+ Sammlung) zur Verfügung steht.

## Struktur-Leitlinie für diese BA

Martin hat ausdrücklich gefordert, dass die Architektur **erweiterbar**
sein soll: spätere BAs sollen zusätzliche Sortier-Achsen, Tag-Filter
und Manifest-Quellen anbauen können, **ohne** die heute geschriebenen
Code-Pfade umbauen zu müssen. Konkret heißt das für Sonnet:

- **Sortier-Achsen deklarativ.** Eine Liste `[{key, label, getter}]`
  treibt den Dropdown. Eine zusätzliche Achse = ein Listen-Eintrag mehr.
- **Item-Provider modular.** Generierte Rauscher kommen aus einem
  Provider, Embed-Items aus einem zweiten, Webspace-Manifeste später aus
  einem dritten. Im Audio-Source-Modul gibt es eine Funktion
  `amCollectItems(category)`, die alle aktiven Provider abklappert und
  eine einheitliche Item-Liste zurückgibt.
- **Items haben ein einheitliches Schema** mit den Manifest-Tag-Feldern,
  unabhängig von der Herkunft. Generierte Rauscher bekommen passende
  Tags (`kind: "rauschen-weiss"`, `spectrum: "broadband"` etc.), damit
  sie in den Sortier-Achsen mit Sample-Items konsistent einsortieren.

## Schritt 1: Pause-Buttons immer aktiv + 0-ms-Button

In `index.html` den Pause-Block (BA 192, `#plPauseBtns`) erweitern:

```html
<div id="plPauseBtns" style="display:flex; gap:3px; flex-wrap:wrap">
  <button class="btn pl-pause-btn" type="button" data-ms="0">0</button>
  <button class="btn pl-pause-btn" type="button" data-ms="500">500</button>
  <button class="btn pl-pause-btn" type="button" data-ms="750">750</button>
  <button class="btn pl-pause-btn" type="button" data-ms="1000">1000</button>
  <button class="btn pl-pause-btn" type="button" data-ms="2000">2000</button>
  <button class="btn pl-pause-btn" type="button" data-ms="4000">4000</button>
  <button class="btn pl-pause-btn" type="button" data-ms="8000">8000</button>
</div>
```

In `js/player.js`, Funktion `plUpdTransportUI()` (aus BA 192): die
Pause-Button-Behandlung so umstellen, daß `disabled`/`opacity`/`cursor`
**nicht mehr** von `plAutoAdvance` abhängen. Konkret die Zeilen

```js
b.disabled = !plAutoAdvance;
b.style.opacity = plAutoAdvance ? "1" : "0.5";
b.style.cursor  = plAutoAdvance ? "pointer" : "not-allowed";
```

ersetzen durch

```js
b.disabled = false;
b.style.opacity = "1";
b.style.cursor  = "pointer";
```

Die Hervorhebung des aktiven Werts (`b.classList.toggle("active",
v === plPauseMs)` etc.) bleibt unverändert.

**Hinweis für Sonnet:** die Zeile `b.disabled = false` ist hier
absichtlich gesetzt (statt nur die alte Zeile zu entfernen), damit ein
Browser-Cache mit altem `disabled`-Attribut sicher zurückgesetzt wird.

## Schritt 2: Lautstärke — Schnellbuttons neben dem Number-Input

In `index.html`, im Transport-Block (BA 192), die Lautstärke-Gruppe so
ersetzen:

```html
<div class="control-group" style="flex-wrap:wrap; gap:4px">
  <label data-t="lblVol"></label>
  <input type="number" id="plVol" value="80" min="0" max="100" step="1"
         style="width:55px; padding:3px 5px; border:1px solid var(--border); border-radius:4px; text-align:center; font-family:var(--mono); font-size:0.88em" />%
  <div id="plVolBtns" style="display:flex; gap:3px; flex-wrap:wrap; margin-left:6px">
    <button class="btn pl-vol-btn" type="button" data-v="25">25</button>
    <button class="btn pl-vol-btn" type="button" data-v="50">50</button>
    <button class="btn pl-vol-btn" type="button" data-v="75">75</button>
    <button class="btn pl-vol-btn" type="button" data-v="100">100</button>
  </div>
</div>
```

Listener-Verkabelung am Ende von `js/player.js` (oder im
Init-Block, wo schon die anderen Transport-Listener sitzen):

```js
document.querySelectorAll(".pl-vol-btn").forEach(function (b) {
  b.addEventListener("click", function () {
    const v = parseInt(b.dataset.v, 10);
    if (!Number.isFinite(v)) return;
    const el = document.getElementById("plVol");
    el.value = v;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    plUpdVolBtns();
  });
});

function plUpdVolBtns() {
  const cur = parseInt(document.getElementById("plVol").value, 10);
  document.querySelectorAll(".pl-vol-btn").forEach(function (b) {
    const v = parseInt(b.dataset.v, 10);
    const active = (v === cur);
    b.classList.toggle("active", active);
    b.style.background = active ? "var(--accent, #6aa84f)" : "";
    b.style.color      = active ? "#fff" : "";
  });
}
```

Den bestehenden `plVol`-Change-Listener (`js/init.js` Z. 512) so
erweitern, daß er nach dem Setzen von `pGain` auch
`plUpdVolBtns()` aufruft, damit Tippen im Number-Input ebenfalls die
Button-Hervorhebung mitzieht:

```js
document.getElementById("plVol").addEventListener("change", function () {
  const v = Math.max(0, Math.min(100, parseInt(this.value) || 0));
  this.value = v;
  if (pGain) pGain.gain.value = v / 100;
  if (typeof plUpdVolBtns === "function") plUpdVolBtns();
});
```

Außerdem `plUpdVolBtns()` einmal am Ende der Init-Phase aufrufen, damit
die Button-Hervorhebung beim Start korrekt steht.

## Schritt 3: Neues Modul `js/audio-source.js`

Datei neu anlegen mit folgendem Inhalt. **Nur ASCII-Quotes**, keine
typografischen.

```js
/* ============================================================
 * audio-source.js — generischer Audio-Quellen-Layer
 *
 * Aufgaben:
 *  - Embed-Module einlesen (window.CI_SB_EMBED.sources)
 *  - generierte Standardrauscher als virtuelle Items bereitstellen
 *  - einheitliche Item-Liste pro Kategorie ausliefern
 *  - Sortier-Achsen deklarativ verwalten
 *
 * Erweiterbar: weitere Provider (Webspace-Manifest, User-Upload) hängen
 * sich als Eintrag in AM_PROVIDERS ein. Eine neue Sortier-Achse =
 * ein Eintrag mehr in AM_SORT_AXES[category]. Kein Refactor der
 * bestehenden Aufrufer noetig.
 * ============================================================ */

// Provider-Liste — Reihenfolge entspricht Anzeige-Reihenfolge der Items
const AM_PROVIDERS = [];

function amRegisterProvider(p) {
  // p = { id: "string", listItems: function(category) -> [item, ...] }
  AM_PROVIDERS.push(p);
}

function amCollectItems(category) {
  const out = [];
  for (const p of AM_PROVIDERS) {
    try {
      const items = p.listItems(category);
      if (Array.isArray(items)) {
        for (const it of items) {
          if (!it) continue;
          // Stempel "providerId" auf jedes Item, damit der Player weiss,
          // wo die Audio-Quelle herzuholen ist.
          it._providerId = p.id;
          out.push(it);
        }
      }
    } catch (e) {
      console.warn("[audio-source] provider " + p.id + " warf:", e);
    }
  }
  return out;
}

// --- Sortier-Achsen ---
// Pro Kategorie eine Liste. Ein Eintrag = eine Achse.
const AM_SORT_AXES = {
  geraeusche: [
    {
      key: "kind",
      labelKey: "amSortKind",
      labelDefault: "nach Art",
      getter: function (it) { return (it.tags && it.tags.kind) || "zzz-unbekannt"; }
    },
    {
      key: "spectrum",
      labelKey: "amSortSpectrum",
      labelDefault: "nach Spektrum",
      getter: function (it) { return (it.tags && it.tags.spectrum) || "zzz-unbekannt"; }
    },
    {
      key: "source",
      labelKey: "amSortSource",
      labelDefault: "nach Quelle",
      getter: function (it) { return it.sourceTitle || it._providerId || "zzz-unbekannt"; }
    }
  ]
  // weitere Kategorien (saetze, musik, hoerbuecher) folgen in spaeteren BAs.
};

function amSortAxesFor(category) {
  return AM_SORT_AXES[category] || [];
}

function amSortItems(items, category, axisKey) {
  const axes = amSortAxesFor(category);
  const axis = axes.find(function (a) { return a.key === axisKey; }) || axes[0];
  if (!axis) return items.slice();
  const arr = items.slice();
  arr.sort(function (a, b) {
    const va = axis.getter(a), vb = axis.getter(b);
    if (va < vb) return -1;
    if (va > vb) return 1;
    // Sekundaer-Sortierung: nach Item-Titel, damit die Reihenfolge stabil ist
    const ta = (a.title || a.id || "").toLowerCase();
    const tb = (b.title || b.id || "").toLowerCase();
    return ta < tb ? -1 : (ta > tb ? 1 : 0);
  });
  return arr;
}

// --- Provider 1: generierte Standardrauscher ---
// Items haben kein `audio`-Feld, sondern werden vom Player anhand der
// `id` mit dem Prefix "gen:" erkannt und ueber amGenerateNoiseBuffer
// als AudioBuffer erzeugt.

const AM_GEN_NOISES = [
  {
    id: "gen:white",
    title: "Weisses Rauschen",
    sourceTitle: "generiert",
    license: null,
    credit: null,
    tags: { kind: "rauschen-weiss", spectrum: "broadband", stationary: "y", loop_safe: "y" }
  },
  {
    id: "gen:pink",
    title: "Rosa Rauschen",
    sourceTitle: "generiert",
    license: null,
    credit: null,
    tags: { kind: "rauschen-rosa", spectrum: "broadband", stationary: "y", loop_safe: "y" }
  },
  {
    id: "gen:brown",
    title: "Braunes Rauschen",
    sourceTitle: "generiert",
    license: null,
    credit: null,
    tags: { kind: "rauschen-rosa", spectrum: "lowpass", stationary: "y", loop_safe: "y" }
    // braunes Rauschen hat keinen eigenen Manifest-Wert, daher "rauschen-rosa"
    // als naechstliegende Klasse. Spektrum lowpass kennzeichnet den tieflastigen Anteil.
  }
];

amRegisterProvider({
  id: "generated",
  listItems: function (category) {
    if (category !== "geraeusche") return [];
    return AM_GEN_NOISES.slice();
  }
});

// Generierungs-Funktion: liefert AudioBuffer mit ~5 s Rauschen, sample-genau
// loop-tauglich.
function amGenerateNoiseBuffer(ctx, kind) {
  const dur = 5.0;
  const sr  = ctx.sampleRate;
  const len = Math.floor(dur * sr);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);

  if (kind === "gen:white") {
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    return buf;
  }
  if (kind === "gen:pink") {
    // Voss-McCartney pink-noise Algorithmus (kuerzer Variante).
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      const out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
      data[i] = out * 0.11;
    }
    return buf;
  }
  if (kind === "gen:brown") {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = (Math.random() * 2 - 1) * 0.02;
      last = Math.max(-1, Math.min(1, last + w));
      data[i] = last * 3.5;
    }
    return buf;
  }
  return null;
}

// --- Provider 2: Embed-Modul (window.CI_SB_EMBED) ---
// Liest Collections aus dem Embed-Bundle und liefert Items.
// Items behalten ihre originale `audio`-Field (data-URL).

amRegisterProvider({
  id: "embed",
  listItems: function (category) {
    const out = [];
    const root = (typeof window !== "undefined") ? window.CI_SB_EMBED : null;
    if (!root || !root.sources) return out;
    for (const key in root.sources) {
      const col = root.sources[key];
      if (!col || col.category !== category) continue;
      const colTags = col.tags || {};
      const colTitle = col.title || key;
      const colLicense = col.license || null;
      const colCredit  = col.credit  || null;
      const items = Array.isArray(col.items) ? col.items : [];
      for (const it of items) {
        const merged = {
          id: key + ":" + (it.id || ""),
          title: it.title || it.id || "(unbenannt)",
          audio: it.audio,
          duration: it.duration,
          sourceTitle: colTitle,
          license: it.license || colLicense,
          credit:  it.credit  || colCredit,
          tags: Object.assign({}, colTags, it.tags || {})
        };
        out.push(merged);
      }
    }
    return out;
  }
});
```

`<script>`-Eintrag in `index.html` ergänzen, **vor** `init.js` und
nach `state-side.js`:

```html
<script src="js/audio-source.js"></script>
```

(Heutige Lade-Liste in `index.html` Z. ~145 anpassen — Reihenfolge:
`state-side.js` → `audio-source.js` → `player.js` → …)

## Schritt 4: Embed-Stub-Datei

Datei `assets/audio-embed/noises.js` neu anlegen, leerer Stub:

```js
/* assets/audio-embed/noises.js
 *
 * Embed-Modul fuer Geraeusche. Wird vom Build-Skript
 * scripts/build_embed.py befuellt, sobald die Geraeusche-Embed-Stufe
 * dort implementiert ist. Solange leer.
 *
 * Format siehe docs/Konzept_Audio_Manifest.md, Abschnitt "Embed".
 */
window.CI_SB_EMBED = window.CI_SB_EMBED || { sources: {} };
// (keine Eintraege — Geraeusche werden in BA 193 ausschliesslich generiert)
```

`<script>`-Eintrag in `index.html` ergänzen, **nach** `audio-source.js`
und vor `init.js`:

```html
<script src="assets/audio-embed/noises.js"></script>
```

## Schritt 5: Geräusche-Sub-Block im HTML

In `index.html`, den Platzhalter aus BA 192:

```html
<div id="plSubNoise" class="pl-subblock"
     style="margin-bottom: 12px; display: none; color: var(--text-muted); font-size: 0.9em"
     data-t="plNoiseComingSoon"></div>
```

durch den voll funktionalen Sub-Block ersetzen:

```html
<div id="plSubNoise" class="pl-subblock" style="margin-bottom: 12px; display: none">
  <div class="controls-row" style="gap:8px; flex-wrap:wrap; margin-bottom:6px">
    <div class="control-group">
      <label data-t="plNoiseSortLabel" style="margin-right:6px"></label>
      <select id="plNoiseSortSel"
              style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em">
        <!-- Optionen werden zur Laufzeit aus AM_SORT_AXES.geraeusche befuellt -->
      </select>
    </div>
    <div class="control-group" style="flex:1; min-width:240px">
      <label data-t="plNoiseItemLabel" style="margin-right:6px"></label>
      <select id="plNoiseItemSel"
              style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em; min-width:200px">
        <!-- Optionen werden zur Laufzeit aus amCollectItems("geraeusche") befuellt -->
      </select>
    </div>
  </div>
  <div id="plNoiseEmpty" class="explain" style="display:none;font-size:0.85em;color:var(--text-muted)"
       data-t="plNoiseEmpty"></div>
</div>
```

In `index.html` außerdem den Top-Toggle-Button für Geräusche **enabled**
machen — das `disabled`-Attribut und die `opacity: 0.5; cursor:
not-allowed`-Styles entfernen, den `title=""` ebenfalls löschen:

```html
<button id="plSrcNoiseBtn" class="btn btn-sm"
        style="font-weight: 600; min-width: 140px; border-radius: 6px"
        data-t="plSrcNoise"></button>
```

## Schritt 6: i18n-Strings in `i18n/de.js`

```js
plNoiseSortLabel: "Sortierung:",
plNoiseItemLabel: "Geräusch:",
plNoiseEmpty: "Keine Geräusche verfügbar.",
plNoiseComingSoon: "Geräusche folgen in einer späteren Bauanleitung.",
// (Vorherigen Eintrag aus BA 192 stehen lassen — wird durch Schritt 5 oben
//  zwar funktional ersetzt, kann aber als Fallback bleiben.)
amSortKind: "nach Art",
amSortSpectrum: "nach Spektrum",
amSortSource: "nach Quelle",
```

## Schritt 7: Geräusch-Auswahl-Logik in `js/player.js`

Neue Funktionen ergänzen (z. B. ans Ende von `js/player.js`):

```js
// ============================================================
// BA193: Geraeusche-Quelle
// ============================================================

let _plNoiseDecodedCache = Object.create(null); // id -> AudioBuffer

function plNoiseRefreshUI() {
  const sortSel = document.getElementById("plNoiseSortSel");
  const itemSel = document.getElementById("plNoiseItemSel");
  const empty   = document.getElementById("plNoiseEmpty");
  if (!sortSel || !itemSel) return;

  // Sortier-Achsen-Dropdown
  const axes = (typeof amSortAxesFor === "function") ? amSortAxesFor("geraeusche") : [];
  if (sortSel.options.length === 0) {
    for (const a of axes) {
      const opt = document.createElement("option");
      opt.value = a.key;
      opt.textContent = (typeof t === "function") ? t(a.labelKey) : a.labelDefault;
      sortSel.appendChild(opt);
    }
    if (typeof plNoiseSortAxis !== "undefined" && plNoiseSortAxis) {
      sortSel.value = plNoiseSortAxis;
    }
  } else {
    // Labels ggf. nach Sprachwechsel neu setzen
    for (let i = 0; i < sortSel.options.length; i++) {
      const opt = sortSel.options[i];
      const a = axes.find(function (x) { return x.key === opt.value; });
      if (a) opt.textContent = (typeof t === "function") ? t(a.labelKey) : a.labelDefault;
    }
  }

  // Items sammeln, sortieren, einsetzen
  const all = (typeof amCollectItems === "function") ? amCollectItems("geraeusche") : [];
  const sorted = (typeof amSortItems === "function")
    ? amSortItems(all, "geraeusche", sortSel.value)
    : all;

  const prev = itemSel.value;
  while (itemSel.firstChild) itemSel.removeChild(itemSel.firstChild);
  for (const it of sorted) {
    const opt = document.createElement("option");
    opt.value = it.id;
    opt.textContent = it.title || it.id;
    itemSel.appendChild(opt);
  }
  // vorherige Auswahl wiederherstellen, sonst gespeicherte oder erste
  if (sorted.find(function (it) { return it.id === prev; })) {
    itemSel.value = prev;
  } else if (typeof plNoiseSelectedId !== "undefined" && plNoiseSelectedId
             && sorted.find(function (it) { return it.id === plNoiseSelectedId; })) {
    itemSel.value = plNoiseSelectedId;
  } else if (sorted.length > 0) {
    itemSel.value = sorted[0].id;
  }
  if (empty) empty.style.display = (sorted.length === 0) ? "" : "none";

  // gemerkten State updaten
  if (typeof plNoiseSelectedId !== "undefined" && itemSel.value) {
    plNoiseSelectedId = itemSel.value;
  }
}

function plNoiseCurrentItem() {
  const all = (typeof amCollectItems === "function") ? amCollectItems("geraeusche") : [];
  return all.find(function (it) { return it.id === plNoiseSelectedId; }) || null;
}

async function plNoiseLoadSelected() {
  const it = plNoiseCurrentItem();
  if (!it) return;
  const ctx = gPC();

  let abuf = _plNoiseDecodedCache[it.id] || null;
  if (!abuf) {
    if (it.id && it.id.indexOf("gen:") === 0) {
      abuf = amGenerateNoiseBuffer(ctx, it.id);
    } else if (it.audio) {
      // Datei oder data-URL ueber fetch + decodeAudioData
      const r = await fetch(it.audio);
      const ab = await r.arrayBuffer();
      abuf = await ctx.decodeAudioData(ab);
    }
    if (abuf) _plNoiseDecodedCache[it.id] = abuf;
  }
  if (!abuf) return;

  // Geraeusch-Buffer in den Player-Pfad einspeisen.
  pNoiseBuf = abuf;
  pSetPlaybackMode("noise");
  document.getElementById("plTot").textContent = pFmt(pBuf ? pBuf.duration : 0);
  document.getElementById("plCur").textContent = "0:00";
  document.getElementById("plTL").value = 0;
  if (typeof plUpdDisplay     === "function") plUpdDisplay();
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
  pBuildEQ();
  pDrawEQ();
  pBuildTbl();
  document.getElementById("plEqViz").style.display = "";
  if (typeof pWarpOn !== "undefined" && pWarpOn) {
    if (typeof pWarpTrigger === "function") pWarpTrigger();
  }
}

// Event-Listener (am Ende von player.js, nach den uebrigen BA192-Listenern):
const _plNSortEl = document.getElementById("plNoiseSortSel");
const _plNItemEl = document.getElementById("plNoiseItemSel");
if (_plNSortEl) {
  _plNSortEl.addEventListener("change", function () {
    plNoiseSortAxis = _plNSortEl.value;
    plNoiseRefreshUI();
  });
}
if (_plNItemEl) {
  _plNItemEl.addEventListener("change", function () {
    plNoiseSelectedId = _plNItemEl.value;
    // Wenn Player gerade Geraeusche aktiv hat: sofort umladen
    if (plActiveSource === "noise") {
      // laufende Wiedergabe sauber stoppen, neues Material laden
      const wasPlaying = (typeof pPlaying !== "undefined") ? pPlaying : false;
      if (wasPlaying) { if (typeof pPause === "function") pPause(); }
      plNoiseLoadSelected().then(function () {
        if (wasPlaying && typeof pPlay === "function") pPlay();
      });
    }
    if (typeof plUpdDisplay === "function") plUpdDisplay();
  });
}
```

## Schritt 8: Player-Pipeline um "noise"-Modus erweitern

### 8a. State + Variable in `js/state-side.js`

Nach den BA-192-Player-Variablen ergänzen:

```js
let plNoiseSelectedId = "gen:pink";   // Default-Geraeusch beim ersten Start
let plNoiseSortAxis   = "kind";       // Default-Sortierachse
let pNoiseBuf         = null;         // dekodierter / generierter Geraeusch-Buffer
```

### 8b. `pSetPlaybackMode` erweitern in `js/player.js`

Heutige Funktion (Z. ~141):

```js
function pSetPlaybackMode(mode) {
  if (mode !== "file" && mode !== "sentence") return;
  pPlaybackMode = mode;
  if (mode === "file") {
    pSourceBuf = pFileBuf;
  } else {
    pSourceBuf = (typeof sSentenceBuf !== "undefined") ? sSentenceBuf : null;
  }
  ...
}
```

ersetzen durch:

```js
function pSetPlaybackMode(mode) {
  if (mode !== "file" && mode !== "sentence" && mode !== "noise") return;
  pPlaybackMode = mode;
  if (mode === "file") {
    pSourceBuf = pFileBuf;
  } else if (mode === "sentence") {
    pSourceBuf = (typeof sSentenceBuf !== "undefined") ? sSentenceBuf : null;
  } else { // noise
    pSourceBuf = (typeof pNoiseBuf !== "undefined") ? pNoiseBuf : null;
  }
  pMonoBuf = null;
  pLeftOnlyBuf = null;
  pRightOnlyBuf = null;
  if (typeof pWarpedBuf !== "undefined") {
    pWarpedBuf = null;
    if (typeof pWarpUpdUI === "function") pWarpUpdUI();
  }
  if (pSourceBuf) {
    pBuf = getPlaybackBuffer();
    pBuildEQ();
  } else {
    pBuf = null;
  }
}
```

### 8c. Loop und Auto-Advance bei Geräuschen

`pSrc.loop` setzen, wenn `plLoop` aktiv ist, **für alle Quellen**.
In `js/player.js`, in der Funktion `pPlay` (Z. ~460), an der Stelle,
an der `pSrc = c.createBufferSource()` aufgerufen wird (Z. ~524 in
heutigem Code), unmittelbar danach ergänzen:

```js
if (typeof plLoop !== "undefined" && plLoop) {
  pSrc.loop = true;
}
```

In demselben `pPlay`, die `pSrc.onended`-Behandlung anpassen — heute
behandelt sie nur den Übergang zurück in den "file"-Modus bzw. zu
Sätzen. Nach Stück-Ende soll bei Quelle Geräusche, falls `plAutoAdvance`
aktiv und nicht `plLoop`, das nächste Geräusch aus der sortierten Liste
gespielt werden. Dazu am Ende des `onended`-Handlers ergänzen:

```js
// BA193: Auto-Advance bei Geraeuschen
if (plActiveSource === "noise" && plAutoAdvance && !plLoop) {
  const ms = (typeof plPauseMs !== "undefined") ? plPauseMs : 0;
  setTimeout(function () {
    const all = amCollectItems("geraeusche");
    const sorted = amSortItems(all, "geraeusche", plNoiseSortAxis);
    if (sorted.length === 0) return;
    const idx = sorted.findIndex(function (x) { return x.id === plNoiseSelectedId; });
    const next = sorted[(idx + 1) % sorted.length];
    if (!next) return;
    plNoiseSelectedId = next.id;
    const sel = document.getElementById("plNoiseItemSel");
    if (sel) sel.value = next.id;
    plNoiseLoadSelected().then(function () {
      if (typeof pPlay === "function") pPlay();
    });
  }, ms);
}
```

**Wichtig:** Wenn der vorhandene `onended`-Code in `pPlay` an mehreren
Stellen früh `return`t (z.B. weil Vocoder-Übergänge separat behandelt
werden), den Geräusch-Hook so legen, daß er auch bei diesen frühen Pfaden
zum Tragen kommt. Sonnet soll im Build prüfen, ob die `onended`-
Pfadführung das zuverlässig auslöst; bei Unklarheit Rückfrage.

### 8d. Geräusch-Modus auch ohne Auto-Advance: Loop-Default-Hinweis

Geräusche werden im Player oft als Hintergrund gespielt und sollten dann
loopen. **Es gibt aber keinen automatischen Loop bei Quelle = Geräusche** —
der User drückt 🔁, wenn er das will. (Begründung: Loop wird laut Martins
Vorgabe „nicht gesondert behandelt".)

In der UI gibt es keinen Eingriff hier; nur Doku-Hinweis in
`docs/spec/06-player.md`.

## Schritt 9: Geräusche in zentrale Steuerung einklinken

### 9a. `plSetSource` (aus BA 192) erweitern in `js/player.js`

Heutige Funktion (aus BA 192):

```js
function plSetSource(src) {
  if (!["music", "sentences", "noise", "audiobook"].includes(src)) return;
  // BA192: noise und audiobook noch nicht verfuegbar
  if (src === "noise" || src === "audiobook") return;
  ...
}
```

ersetzen durch:

```js
function plSetSource(src) {
  if (!["music", "sentences", "noise", "audiobook"].includes(src)) return;
  if (src === "audiobook") return; // weiterhin nicht verfuegbar
  if (src === plActiveSource) return;
  plStopAll();
  plActiveSource = src;
  plUpdSourceUI();
  // Bei Wechsel auf Geraeusche: aktuelles Geraeusch-Item ggf. laden,
  // damit die Anzeige stimmt und Play sofort wirkt.
  if (src === "noise") {
    plNoiseRefreshUI();
    plNoiseLoadSelected();
  }
  plUpdDisplay();
}
```

### 9b. `plUpdSourceUI` aus BA 192 — Audiobook bleibt disabled, Noise wird aktiv

In der Funktion `plUpdSourceUI` (aus BA 192) die Zeile, die den
Noise-Button als immer aus markiert:

```js
setActive(btnN, false); // Geraeusche in BA192 immer aus
```

ersetzen durch:

```js
setActive(btnN, plActiveSource === "noise");
```

Außerdem die in BA 192 angelegte Style-Manipulation für den
Noise-Button-Disabled-Status entfernen. Das Markup ist in Schritt 5
bereits ohne `disabled`/`opacity:0.5` neu gesetzt.

### 9c. `plUpdDisplay` aus BA 192 erweitern in `js/player.js`

Die Funktion (aus BA 192) braucht einen Zweig für Geräusche. Vor dem
`else`-Fallback ergänzen:

```js
} else if (plActiveSource === "noise") {
  const it = plNoiseCurrentItem();
  if (it) {
    titleText = it.title || it.id;
    const parts = [];
    if (it.tags && it.tags.kind)     parts.push(it.tags.kind);
    if (it.tags && it.tags.spectrum) parts.push(it.tags.spectrum);
    if (it.license)     parts.push(it.license);
    if (it.sourceTitle) parts.push(it.sourceTitle);
    metaParts = parts;
  } else {
    titleText = (typeof t === "function") ? t("plDispEmpty") : "Nichts geladen";
  }
}
```

Sicherstellen, daß `showTextToggle = false` bei Geräuschen bleibt (die
Text-Anzeige-Checkbox darf nicht erscheinen).

### 9d. Play/Pause-Toggle erweitern

Heute behandelt `plPlayPauseToggle` (BA 192) die Fälle "sentences" und
"music". Für Geräusche braucht es einen kleinen Zweig — wenn noch nichts
geladen ist (`pBuf === null`), das aktuell ausgewählte Item laden und
dann starten. Die heutige `plPlayPauseToggle` so ändern, daß sie für
`plActiveSource === "noise"` zunächst `plNoiseLoadSelected()` aufruft,
falls `pNoiseBuf === null`, und anschließend `pToggle()`. Beispiel:

```js
function plPlayPauseToggle() {
  if (plActiveSource === "sentences") {
    // ... bisherige Saetze-Logik aus BA 192 ...
    return;
  }
  if (plActiveSource === "noise") {
    if (!pNoiseBuf || !pBuf) {
      plNoiseLoadSelected().then(function () {
        if (typeof pToggle === "function") pToggle();
      });
      return;
    }
    if (typeof pToggle === "function") pToggle();
    return;
  }
  // music (default)
  if (typeof pToggle === "function") pToggle();
}
```

### 9e. Quellenwechsel-Stop sauber halten

In `plStopAll` (aus BA 192) — heute werden Sätze und Datei-Wiedergabe
gestoppt. Geräusche laufen über denselben `pSrc`-Pfad wie Musik, die
heutige `pStopReset()`-Behandlung greift dort schon. Kein zusätzlicher
Eingriff nötig. Sonnet soll im Build verifizieren, daß `pStopAll()`
bei laufender Geräusch-Wiedergabe sauber stoppt.

## Schritt 10: Persistenz

`js/state-side.js`, `js/file.js`, `js/init.js` analog zu BA 192:
die zwei neuen Felder `plNoiseSelectedId` und `plNoiseSortAxis` in
Reset / Save / Restore aufnehmen.

`js/file.js` Reset (Z. ~80 und ~139, in beide Stellen analog BA 192):

```js
if (typeof plNoiseSelectedId !== "undefined") plNoiseSelectedId = "gen:pink";
if (typeof plNoiseSortAxis   !== "undefined") plNoiseSortAxis   = "kind";
```

`js/file.js` Save (Z. ~243 / ~272):

```js
plNoiseSelectedId: (typeof plNoiseSelectedId !== "undefined") ? plNoiseSelectedId : "gen:pink",
plNoiseSortAxis:   (typeof plNoiseSortAxis   !== "undefined") ? plNoiseSortAxis   : "kind",
```

`js/file.js` Restore (Z. ~596 / ~676):

```js
if (typeof d.plNoiseSelectedId === "string") plNoiseSelectedId = d.plNoiseSelectedId;
if (typeof d.plNoiseSortAxis   === "string") plNoiseSortAxis   = d.plNoiseSortAxis;
```

`js/init.js` analog die Autosave-Stellen.

## Schritt 11: Initialisierung beim Tool-Start

Am Ende von `js/init.js` (oder im DOMContentLoaded-Handler, in dem heute
`plUpdSourceUI()` etc. aufgerufen wird):

```js
if (typeof plNoiseRefreshUI === "function") plNoiseRefreshUI();
```

Sicherstellen, daß `plUpdVolBtns()` ebenfalls einmal initial aufgerufen
wird (siehe Schritt 2).

## Schritt 12: Doku nachziehen

### 12a. `docs/CODESTRUKTUR.md`

In der Modul-Übersicht **`js/audio-source.js`** als neues Modul aufnehmen:
zweck = generischer Audio-Quellen-Layer (Embed-Provider, Generator-
Provider, Sortier-Achsen). Reihenfolge: nach `state-side.js`, vor
`player.js`.

Im Abschnitt „Player" die Beschreibung der Wiedergabe-Card erweitern:
Geräusche-Sub-Block mit Sortier- und Item-Dropdown, generierte
Standardrauscher, Embed-Loader-Stub. Pause-Buttons immer aktiv,
0-ms-Eintrag, Lautstärke-Schnellbuttons.

### 12b. `docs/spec/06-player.md`

Im Abschnitt „Aufbau des Tabs", Punkt 4 (Wiedergabe-Card aus BA 192),
den Unterpunkt zur Quelle Geräusche aktualisieren — nicht mehr „kommt
in späterer BA", sondern:

```
- **Geräusche:** Vier-Quellen-Aktiv. Sub-Block mit zwei Dropdowns —
  Sortier-Achse (Default „nach Art", weitere: „nach Spektrum",
  „nach Quelle") und Geräusch-Auswahl. Inhalte: drei generierte
  Standardrauscher (Weiß, Rosa, Braun) per WebAudio im Browser;
  Sample-Geräusche folgen über das Embed-Modul (`assets/audio-embed/
  noises.js`) und später über Webspace-Manifest.
- Anzeige unter Transport: Titel · `kind` · `spectrum` · Lizenz · Quelle.
- Loop und Auto-Advance wirken wie bei den anderen Quellen.
- Pause-Buttons (inkl. 0 ms) gelten generisch für Loop und Auto-Advance.
```

Im Abschnitt „Audiopfad" erwähnen, daß `pSetPlaybackMode` nun drei
Modi kennt (`"file"`, `"sentence"`, `"noise"`).

## Schritt 13: Versionsbump

```js
const APP_VERSION = "3.2.193-beta";
```

## Akzeptanztest

1. Tool laden (Hard-Reload). Version `3.2.193-beta` im Page-Source.
   **Erwartet:** ✓
2. Tab „Player", Card „Wiedergabe", vier Quellen-Knöpfe sichtbar.
   Drei davon aktiv (Musik, Sätze, Geräusche), nur Hörbücher ausgegraut.
   **Erwartet:** ✓
3. Quelle „Geräusche" wählen. Sub-Block mit zwei Dropdowns sichtbar —
   Sortierung „nach Art", Geräusch-Auswahl zeigt drei generierte
   Einträge (Weißes/Rosa/Braunes Rauschen) plus ggf. Embed-Items
   (in dieser BA: keine). **Erwartet:** ✓
4. Anzeige-Block unter Transport zeigt den Titel des gewählten
   Geräuschs (Default: „Rosa Rauschen") und die Meta-Zeile
   `rauschen-rosa · broadband · — · generiert`. **Erwartet:** ✓
5. Play drücken: Rosa Rauschen ist hörbar. Das Geräusch läuft ca.
   5 Sekunden und endet (kein Auto-Loop ohne 🔁). **Erwartet:** ✓
6. 🔁 (Loop) aktivieren, erneut Play: Geräusch wiederholt sich endlos
   ohne hörbare Lücke (mit Pause-Wert 0). **Erwartet:** ✓
7. Pause-Buttons sind **alle aktiv** (auch ohne Auto-Advance an).
   500 ms wählen, Loop weiterhin an: das Rauschen wiederholt sich mit
   einer halben Sekunde Stille zwischen den Durchgängen. **Erwartet:** ✓
8. 🔁 aus, ↪ (Auto-Advance) an, Pause-Wert 0: nach Ende des aktuellen
   Geräuschs folgt automatisch das nächste in der Sortierung
   (Weiß → Rosa → Braun, je nach Sortier-Achse). **Erwartet:** ✓
9. Sortier-Achse auf „nach Spektrum" umstellen: Reihenfolge der
   Geräusch-Auswahl ändert sich; die aktuelle Auswahl bleibt
   ausgewählt. **Erwartet:** ✓
10. In der Geräusch-Auswahl manuell ein anderes Geräusch wählen, während
    Wiedergabe läuft: Player wechselt sauber, Anzeige aktualisiert.
    **Erwartet:** ✓
11. Lautstärke-Schnellbuttons: Klick auf 50 setzt Number-Input auf 50,
    Audio leiser; der 50er-Button ist hervorgehoben. Beim manuellen
    Tippen von „62" im Number-Input verlieren alle Buttons die
    Hervorhebung. **Erwartet:** ✓
12. Quelle wechseln auf Musik, Datei laden, abspielen — funktioniert
    weiterhin wie vorher. Loop-Knopf bewirkt jetzt auch hier echtes
    Loopen (war heute ggf. noch ohne Effekt; jetzt durch
    `pSrc.loop = true`-Bug-Fix wirksam). **Erwartet:** ✓
13. Quelle Sätze: Spielen-Verhalten unverändert. Pause-Buttons sind
    **unabhängig von Auto-Advance** aktiv und greifen, wenn 🔁 an
    ist (Pause zwischen Wiederholungen desselben Satzes). **Erwartet:** ✓
14. Save (JSON-Download), neuen Tab, Tool laden, Restore: ausgewählte
    Quelle, Geräusch-Item und Sortier-Achse wiederhergestellt.
    **Erwartet:** ✓

## Selbstprüfungsauftrag

Vor Fertigmeldung jeden der 14 Akzeptanzpunkte einzeln durchgehen und
**erfüllt / nicht erfüllt / unklar** mit Datei- und Zeilenangabe
melden. Zusätzlich prüfen:

- `js/audio-source.js` existiert, exportiert `amRegisterProvider`,
  `amCollectItems`, `amSortAxesFor`, `amSortItems`,
  `amGenerateNoiseBuffer`, und registriert die zwei Provider
  („generated", „embed") beim Modul-Laden.
- `assets/audio-embed/noises.js` existiert mit dem Stub-Inhalt aus
  Schritt 4.
- In `index.html` sind beide `<script>`-Tags eingetragen (in der
  richtigen Reihenfolge: state-side → audio-source → audio-embed/noises →
  player).
- Im Top-Toggle ist der Noise-Button nicht mehr disabled.
  Der Audiobook-Button bleibt disabled.
- `pSetPlaybackMode` akzeptiert nun `"noise"` und setzt `pSourceBuf`
  aus `pNoiseBuf`.
- `pPlay` setzt `pSrc.loop = plLoop` — wirkt für alle Modi.
- `plUpdTransportUI`: Pause-Buttons haben `disabled = false` unabhängig
  von `plAutoAdvance`.
- `js/version.js` enthält `"3.2.193-beta"`.

## Folge-Bauanleitungen

- **BA 194 (geplant):** Sätze + Hintergrund-Geräusch (Pre-Mix).
- **BA 195 (geplant):** Hörbuch-Quelle aktivieren.
- **BA 196+ (geplant):** Webspace-Manifest-Loader — lädt
  `audio.manifest/index.json` und je nach gewählter Kategorie die
  Sub-Manifeste; URL-Auflösung über `<webspace-root> + source.base +
  item.audio`. Default-Root: `http://ci-sound-balancing.honigburg.de/opus/`.
  Aktiviert die heute nur generierten/embed-Quellen mit echten Sample-
  Inhalten aus dem Webspace.
- **i18n-Folge-BA:** Übersetzungen `en.js`, `fr.js`, `es.js` für die in
  BA 192 und BA 193 neu eingeführten Keys nachziehen.
- **Sätze-Titel-Fix:** Aussetzung des Titel-Doppel-Bugs aus BA 192;
  wird im Zuge der Sätze-Manifest-Umstellung (eigene BA) erledigt.
