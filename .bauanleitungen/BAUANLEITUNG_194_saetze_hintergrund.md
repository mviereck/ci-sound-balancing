# Bauanleitung 194 — Sätze mit Hintergrund-Geräusch (Pre-Mix)

**Versionsbump:** `js/version.js` von `"3.2.193-beta"` (oder aktuellem
193-Fix-Stand) auf `"3.2.194-beta"`.

**Voraussetzung:** BA 193 muss durchgebaut sein. Diese BA nutzt
`amCollectItems("geraeusche")` und die generierten Rauscher aus
`js/audio-source.js`.

## Ziel

Audiologisches Test-Szenario „Sprache im Störgeräusch" im Sätze-Sub-
Block des Players. Beim Abspielen eines Satzes wird auf Wunsch ein
Hintergrund-Geräusch mit einem User-wählbaren SNR (Signal-to-Noise-
Ratio in dB) hinzugemischt. Der gemischte Buffer durchläuft danach den
normalen Player-Pfad (EQ, Warp, MAPLAW), so daß Sprache und Geräusch
**gemeinsam** korrigiert werden — physikalisch korrekt zum Real-Welt-
Mikrofon-Szenario.

Drei Komponenten:

1. **UI** im Sätze-Sub-Block: Master-Toggle, Geräusch-Dropdown
   (gespeist aus `amCollectItems("geraeusche")`), SNR-Quick-Buttons.
2. **Pre-Mix-Funktion** mit RMS-Normalisierung des Hintergrunds, damit
   der SNR-Wert über verschiedene Geräusche hinweg konsistent wirkt.
3. **Mix-Cache** mit LRU-Verdrängung (max 8 Einträge): für Loop oder
   bewusste Wiederholungen wird der vorberechnete Mix wiederverwendet.

## Design-Entscheidungen (aus Konzept-Phase)

- **Variante 2c**: nur ein Geräusch zur Zeit, User wählt manuell. Mehrere
  Geräusche gleichzeitig (Cocktail) sind in IDEEN.md als spätere
  Erweiterung notiert.
- **(b) Hintergrund startet pro Satz von 0**: kein Phase-Counter über
  Sätze hinweg. Bei statischen Rauschen unhörbar; bei Sample-Material
  hört der User bei Auto-Advance jedes Mal den Anfang.
- **Hintergrund kürzer als Satz wird geloopt** (Sample-by-Sample Modulo).
- **Nur bei Sätzen verfügbar**: bei Musik/Geräusche/Hörbuch kein
  Hintergrund-Mischer.

## Schritt 1: Item-Buffer-Cache aus BA 193 in `audio-source.js` migrieren

In BA 193 wurde `_plNoiseDecodedCache` in `js/player.js` angelegt
(Object-Map id → AudioBuffer). Diese Logik wird jetzt in
`js/audio-source.js` verallgemeinert, damit auch der Hintergrund-
Mischer denselben Cache nutzt.

In `js/audio-source.js` am Ende ergänzen:

```js
// ============================================================
// Item-Buffer-Cache + RMS-Normalisierung (BA194)
// ============================================================

const _amItemBufCache = new Map(); // itemId -> AudioBuffer

// Referenz-RMS fuer Normalisierung (entspricht ca. -20 dBFS).
const AM_REF_RMS = 0.1;

function _amRms(buf) {
  // Mittelwerts-RMS ueber alle Kanaele
  let sumSq = 0;
  let nSamples = 0;
  const nCh = buf.numberOfChannels;
  for (let ch = 0; ch < nCh; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) sumSq += d[i] * d[i];
    nSamples += d.length;
  }
  if (nSamples === 0) return 0;
  return Math.sqrt(sumSq / nSamples);
}

function _amNormalizeBufferRms(buf, refRms) {
  const rms = _amRms(buf);
  if (rms <= 1e-9) return buf; // Stille: nicht skalieren
  const factor = refRms / rms;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] *= factor;
  }
  return buf;
}

async function amGetItemBuffer(ctx, item) {
  if (!item || !item.id) return null;
  const cached = _amItemBufCache.get(item.id);
  if (cached) return cached;

  let abuf = null;
  if (item.id.indexOf("gen:") === 0) {
    abuf = amGenerateNoiseBuffer(ctx, item.id);
  } else if (item.audio) {
    const r = await fetch(item.audio);
    const ab = await r.arrayBuffer();
    abuf = await ctx.decodeAudioData(ab);
  }
  if (!abuf) return null;

  // RMS-Normalisierung fuer Kategorie "geraeusche":
  // Tag-Kategorie aus dem Item kommt indirekt — der Aufrufer entscheidet,
  // ob er normalisiert haben moechte (via amGetItemBuffer-Aufruf mit
  // explizitem Flag, siehe amGetNormalizedNoiseBuffer unten).
  // Fuer die Geraeusche-Wiedergabe (BA 193) ist Normalisierung nicht noetig.
  // Fuer Hintergrund-Mix (BA 194) wird amGetNormalizedNoiseBuffer genutzt.

  _amItemBufCache.set(item.id, abuf);
  return abuf;
}

// Spezialisierter Aufruf fuer Hintergrund-Mix: liefert einen
// RMS-normalisierten Buffer. Der normalisierte Buffer wird unter einem
// eigenen Cache-Schluessel ("norm:<id>") gehalten, damit die unnormierte
// Wiedergabe in der Geraeusche-Quelle weiter den Originalbuffer bekommt.
async function amGetNormalizedNoiseBuffer(ctx, item) {
  if (!item || !item.id) return null;
  const normKey = "norm:" + item.id;
  const cached = _amItemBufCache.get(normKey);
  if (cached) return cached;

  const orig = await amGetItemBuffer(ctx, item);
  if (!orig) return null;

  // Kopie anlegen, damit das Original im Cache unveraendert bleibt.
  const copy = ctx.createBuffer(orig.numberOfChannels, orig.length, orig.sampleRate);
  for (let ch = 0; ch < orig.numberOfChannels; ch++) {
    copy.copyToChannel(orig.getChannelData(ch), ch);
  }
  _amNormalizeBufferRms(copy, AM_REF_RMS);
  _amItemBufCache.set(normKey, copy);
  return copy;
}
```

Im selben Schritt: in `js/player.js` die in BA 193 angelegte Funktion
`plNoiseLoadSelected()` so anpassen, daß sie statt eines eigenen
`_plNoiseDecodedCache` jetzt `amGetItemBuffer(ctx, item)` aufruft.
Konkret:

```js
async function plNoiseLoadSelected() {
  const it = plNoiseCurrentItem();
  if (!it) return;
  const ctx = gPC();
  const abuf = await amGetItemBuffer(ctx, it);
  if (!abuf) return;

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
```

Den `_plNoiseDecodedCache` und alle Schreib-/Lese-Stellen darauf
entfernen — die Cache-Funktion sitzt jetzt in `audio-source.js`.

## Schritt 2: Pre-Mix-Funktion und Mix-Cache in `audio-source.js`

In `js/audio-source.js` weiter ergänzen:

```js
// ============================================================
// Pre-Mix mit Hintergrund-Geraeusch (BA194)
// ============================================================

const _amMixCache = new Map(); // key -> { buffer, lastUsed }
const AM_MIX_CACHE_MAX = 8;

function _amMixCacheKey(fgKey, bgId, snrDb) {
  return fgKey + "|" + bgId + "|" + snrDb;
}

function _amMixCacheTouch(key) {
  const hit = _amMixCache.get(key);
  if (hit) hit.lastUsed = Date.now();
  return hit ? hit.buffer : null;
}

function _amMixCachePut(key, buffer) {
  _amMixCache.set(key, { buffer: buffer, lastUsed: Date.now() });
  while (_amMixCache.size > AM_MIX_CACHE_MAX) {
    let oldestKey = null, oldestTime = Infinity;
    for (const [k, v] of _amMixCache) {
      if (v.lastUsed < oldestTime) { oldestTime = v.lastUsed; oldestKey = k; }
    }
    if (oldestKey) _amMixCache.delete(oldestKey);
    else break;
  }
}

// amMixForeground: berechnet (oder holt aus Cache) den gemischten
// Vordergrund+Hintergrund-Buffer.
//
// Annahmen:
//  - Vordergrund unveraendert in Pegel
//  - Hintergrund ist RMS-normalisiert (via amGetNormalizedNoiseBuffer)
//  - bgFactor = 10^(-snrDb/20)
//  - Hintergrund wird Sample-modulo geloopt, falls kuerzer als Vordergrund
//  - Output-Dimensionen folgen Vordergrund
function amMixForeground(ctx, fgKey, fgBuf, bgItem, bgBuf, snrDb) {
  if (!fgBuf) return null;
  if (!bgBuf || !bgItem) return fgBuf;
  const key = _amMixCacheKey(fgKey, bgItem.id, snrDb);
  const cached = _amMixCacheTouch(key);
  if (cached) return cached;

  const sr = fgBuf.sampleRate;
  const len = fgBuf.length;
  const nCh = Math.max(1, fgBuf.numberOfChannels);
  const out = ctx.createBuffer(nCh, len, sr);

  const bgFactor = Math.pow(10, -snrDb / 20);
  const bgLen = bgBuf.length;
  const bgNCh = bgBuf.numberOfChannels;

  for (let ch = 0; ch < nCh; ch++) {
    const fgD = fgBuf.getChannelData(ch);
    const bgD = bgBuf.getChannelData(ch < bgNCh ? ch : 0);
    const outD = out.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      let s = fgD[i] + bgD[i % bgLen] * bgFactor;
      // weiches Clipping bei +-1.0
      if (s >  1.0) s =  1.0;
      else if (s < -1.0) s = -1.0;
      outD[i] = s;
    }
  }
  _amMixCachePut(key, out);
  return out;
}

// Beim Wechsel von Hintergrund-Geraeusch oder SNR wird der bisherige
// Mix-Cache obsolet — aber wir wollen ihn nicht komplett killen, weil
// derselbe Satz mit verschiedenen Konfigurationen sinnvoll cachebar
// bleibt. LRU verdraengt aelteste Eintraege automatisch.
function amMixCacheClear() {
  _amMixCache.clear();
}
```

## Schritt 3: UI-Block im Sätze-Sub-Block

In `index.html` im bestehenden Sätze-Sub-Block `#plSubSentences` (aus
BA 192) **nach** dem Sprecher-Dropdown-Block und **vor** dem schließenden
`</div>` des Sub-Blocks einen neuen Hintergrund-Block einfügen:

```html
<!-- BA194: Hintergrund-Geraeusch fuer Saetze -->
<div id="plSentBgBlock"
     style="margin-top:10px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:4px">
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
    <strong style="font-size:0.92em" data-t="plSentBgTitle"></strong>
    <button id="plSentBgToggleBtn" class="btn btn-sm" type="button"
            style="min-width:90px; border-radius:6px; font-weight:600">
      <span data-t="plSentBgOff"></span>
    </button>
  </div>
  <div id="plSentBgControls" style="display:flex;flex-direction:column;gap:6px;opacity:0.5">
    <div class="control-group" style="flex-wrap:wrap;gap:6px">
      <label data-t="plSentBgSelLabel" style="margin-right:6px"></label>
      <select id="plSentBgSel"
              style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em; min-width:200px">
        <!-- Optionen werden zur Laufzeit aus amCollectItems("geraeusche") befuellt -->
      </select>
    </div>
    <div class="control-group" style="flex-wrap:wrap;gap:4px">
      <label data-t="plSentBgSnrLabel" style="margin-right:6px"></label>
      <div id="plSentBgSnrBtns" style="display:flex;gap:3px;flex-wrap:wrap">
        <button class="btn pl-snr-btn" type="button" data-snr="-10">-10</button>
        <button class="btn pl-snr-btn" type="button" data-snr="-5">-5</button>
        <button class="btn pl-snr-btn" type="button" data-snr="0">0</button>
        <button class="btn pl-snr-btn" type="button" data-snr="5">+5</button>
        <button class="btn pl-snr-btn" type="button" data-snr="10">+10</button>
      </div>
      <span style="font-size:0.85em;color:var(--text-muted)">dB</span>
    </div>
  </div>
</div>
```

## Schritt 4: i18n-Strings in `i18n/de.js`

```js
plSentBgTitle: "Hintergrund-Geräusch",
plSentBgOff: "Aus",
plSentBgOn:  "An",
plSentBgSelLabel: "Geräusch:",
plSentBgSnrLabel: "Sprach-Pegel über Geräusch (SNR):",
```

(Englisch/Französisch/Spanisch werden wie üblich in einer späteren
Übersetzungs-BA nachgezogen.)

## Schritt 5: State + Persistenz

### 5a. `js/state-side.js`

```js
let plSentBgEnabled = false;        // Master-Toggle
let plSentBgItemId  = "gen:pink";   // gewaehltes Hintergrund-Geraeusch
let plSentBgSnrDb   = 0;            // SNR in dB
```

### 5b. `js/file.js` Reset (Z. ~80 und ~139, beide Stellen):

```js
if (typeof plSentBgEnabled !== "undefined") plSentBgEnabled = false;
if (typeof plSentBgItemId  !== "undefined") plSentBgItemId  = "gen:pink";
if (typeof plSentBgSnrDb   !== "undefined") plSentBgSnrDb   = 0;
```

### 5c. `js/file.js` Save (Z. ~243/272):

```js
plSentBgEnabled: (typeof plSentBgEnabled !== "undefined") ? plSentBgEnabled : false,
plSentBgItemId:  (typeof plSentBgItemId  !== "undefined") ? plSentBgItemId  : "gen:pink",
plSentBgSnrDb:   (typeof plSentBgSnrDb   !== "undefined") ? plSentBgSnrDb   : 0,
```

### 5d. `js/file.js` Restore (Z. ~596/676):

```js
if (typeof d.plSentBgEnabled === "boolean") plSentBgEnabled = d.plSentBgEnabled;
if (typeof d.plSentBgItemId  === "string")  plSentBgItemId  = d.plSentBgItemId;
if (typeof d.plSentBgSnrDb   === "number")  plSentBgSnrDb   = d.plSentBgSnrDb;
```

### 5e. `js/init.js`

Dieselben Felder in den Autosave-Save (Z. ~870) und Autosave-Restore
(Z. ~711/630) ergänzen.

## Schritt 6: Sätze-Wiedergabe um Pre-Mix erweitern

In `js/sentences.js`, Funktion `sPlayCurrent` (Z. ~163): nach dem
`const decoded = await c.decodeAudioData(arrayBuf);` (Z. ~186) und vor
`sSentenceBuf = decoded;` (Z. ~188) den Pre-Mix-Hook einbauen.

**Bestehender Block:**

```js
const c = gPC();
const decoded = await c.decodeAudioData(arrayBuf);
if (!sActive) return;
sSentenceBuf = decoded;
pSetPlaybackMode("sentence");
```

**Ersetzen durch:**

```js
const c = gPC();
const decoded = await c.decodeAudioData(arrayBuf);
if (!sActive) return;

// BA194: Hintergrund-Geraeusch ggf. einmischen.
let finalBuf = decoded;
if (typeof plSentBgEnabled !== "undefined" && plSentBgEnabled
    && typeof plSentBgItemId !== "undefined" && plSentBgItemId
    && typeof amCollectItems === "function") {
  try {
    const allBg = amCollectItems("geraeusche");
    const bgItem = allBg.find(function (it) { return it.id === plSentBgItemId; });
    if (bgItem) {
      const bgBuf = await amGetNormalizedNoiseBuffer(c, bgItem);
      if (bgBuf) {
        const fgKey = audioRef; // stabile Kennung des Satz-Audios
        finalBuf = amMixForeground(c, fgKey, decoded, bgItem, bgBuf,
                                   plSentBgSnrDb);
      }
    }
  } catch (mixErr) {
    console.warn("[sentences] Hintergrund-Mix fehlgeschlagen:", mixErr);
    // Fallback: ohne Hintergrund weitermachen
    finalBuf = decoded;
  }
  if (!sActive) return;
}

sSentenceBuf = finalBuf;
pSetPlaybackMode("sentence");
```

## Schritt 7: UI-Logik in `js/player.js`

Neue Funktionen ergänzen (z. B. ans Ende von `js/player.js`):

```js
// ============================================================
// BA194: Hintergrund-Geraeusch fuer Saetze
// ============================================================

function plSentBgRefreshUI() {
  const block   = document.getElementById("plSentBgBlock");
  const toggle  = document.getElementById("plSentBgToggleBtn");
  const ctrls   = document.getElementById("plSentBgControls");
  const sel     = document.getElementById("plSentBgSel");
  if (!block || !toggle || !ctrls || !sel) return;

  // Toggle-Label
  const onLabel  = (typeof t === "function") ? t("plSentBgOn")  : "An";
  const offLabel = (typeof t === "function") ? t("plSentBgOff") : "Aus";
  const span = toggle.querySelector("[data-t]");
  if (span) span.textContent = plSentBgEnabled ? onLabel : offLabel;
  toggle.classList.toggle("active", !!plSentBgEnabled);
  toggle.style.background = plSentBgEnabled ? "var(--accent, #6aa84f)" : "";
  toggle.style.color      = plSentBgEnabled ? "#fff" : "";

  // Controls bei Aus optisch ausgegraut
  ctrls.style.opacity = plSentBgEnabled ? "1" : "0.5";
  ctrls.style.pointerEvents = plSentBgEnabled ? "" : "none";

  // Dropdown befuellen aus amCollectItems("geraeusche")
  const all = (typeof amCollectItems === "function") ? amCollectItems("geraeusche") : [];
  const prev = sel.value || plSentBgItemId;
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  for (const it of all) {
    const opt = document.createElement("option");
    opt.value = it.id;
    opt.textContent = it.title || it.id;
    sel.appendChild(opt);
  }
  if (all.find(function (it) { return it.id === prev; })) {
    sel.value = prev;
  } else if (all.length > 0) {
    sel.value = all[0].id;
    plSentBgItemId = all[0].id;
  }

  // SNR-Buttons
  document.querySelectorAll(".pl-snr-btn").forEach(function (b) {
    const v = parseInt(b.dataset.snr, 10);
    const active = (v === plSentBgSnrDb);
    b.classList.toggle("active", active);
    b.style.background = active ? "var(--accent, #6aa84f)" : "";
    b.style.color      = active ? "#fff" : "";
  });
}

function plSentBgToggle() {
  plSentBgEnabled = !plSentBgEnabled;
  // Cache leeren, damit beim naechsten Satz frisch gemischt wird
  if (typeof amMixCacheClear === "function") amMixCacheClear();
  plSentBgRefreshUI();
}

function plSentBgSetItem(id) {
  if (!id) return;
  plSentBgItemId = id;
  if (typeof amMixCacheClear === "function") amMixCacheClear();
  plSentBgRefreshUI();
}

function plSentBgSetSnr(db) {
  const v = parseInt(db, 10);
  if (!Number.isFinite(v)) return;
  plSentBgSnrDb = v;
  if (typeof amMixCacheClear === "function") amMixCacheClear();
  plSentBgRefreshUI();
}
```

Listener verkabeln (am Ende von `js/player.js` bei den anderen BA-192/193-
Listenern):

```js
const _plSBgToggle = document.getElementById("plSentBgToggleBtn");
if (_plSBgToggle) _plSBgToggle.addEventListener("click", plSentBgToggle);

const _plSBgSel = document.getElementById("plSentBgSel");
if (_plSBgSel) _plSBgSel.addEventListener("change", function () {
  plSentBgSetItem(_plSBgSel.value);
});

document.querySelectorAll(".pl-snr-btn").forEach(function (b) {
  b.addEventListener("click", function () {
    plSentBgSetSnr(b.dataset.snr);
  });
});
```

## Schritt 8: Initialisierung beim Tool-Start

Am Ende der bestehenden Player-Initialisierungs-Sequenz (z.B. in
`js/init.js` direkt nach `plNoiseRefreshUI()` aus BA 193):

```js
if (typeof plSentBgRefreshUI === "function") plSentBgRefreshUI();
```

Außerdem muss `plSentBgRefreshUI()` nach **jedem** Hinzufügen/Entfernen
neuer Geräusche aufgerufen werden, damit der Dropdown aktuell bleibt.
Konkret: in `plNoiseRefreshUI()` (BA 193) am Ende einen Aufruf ergänzen:

```js
if (typeof plSentBgRefreshUI === "function") plSentBgRefreshUI();
```

Damit folgt das Hintergrund-Dropdown automatisch dem Geräusche-Bestand.

## Schritt 9: Doku nachziehen

### 9a. `docs/CODESTRUKTUR.md`

Im Abschnitt zu `js/audio-source.js`: ergänzen, daß das Modul jetzt
auch RMS-Normalisierung (`amGetNormalizedNoiseBuffer`) und Pre-Mix
mit LRU-Cache (`amMixForeground`, `amMixCacheClear`) anbietet.

Im Abschnitt „Player" den Sätze-Sub-Block beschreiben: neuer
Hintergrund-Geräusch-Block mit Master-Toggle, Geräusch-Dropdown und
SNR-Quick-Buttons.

### 9b. `docs/spec/06-player.md`

Im Sätze-Abschnitt einen Unterpunkt zur Hintergrund-Funktion ergänzen:

```
- **Hintergrund-Geräusch (BA 194):** Master-Toggle + Dropdown
  (Auswahl aus allen verfügbaren Geräuschen via amCollectItems) +
  SNR-Quick-Buttons (-10 / -5 / 0 / +5 / +10 dB). Bei aktivem
  Hintergrund wird vor jedem Satz ein Pre-Mix berechnet
  (Hintergrund auf Satzlänge geloopt, RMS-normalisiert auf Referenz-
  Pegel, mit `10^(-SNR/20)` skaliert und sample-weise zum Satz
  addiert). Der gemischte Buffer durchläuft EQ/Warp/MAPLAW wie ein
  Satz ohne Hintergrund — Sprache und Geräusch werden gemeinsam
  korrigiert.
- Hintergrund startet pro Satz bei 0 (kein Phase-Counter über Sätze).
- Mix-Cache (max 8 Einträge, LRU) hält Pre-Mix-Buffer pro
  (Satz-Audio-Ref, Geräusch-Id, SNR-Wert) vor.
- Toggle-, Dropdown- und SNR-Änderungen leeren den Mix-Cache.
```

## Schritt 10: Versionsbump

```js
const APP_VERSION = "3.2.194-beta";
```

## Akzeptanztest

1. Tool laden (Hard-Reload). Version `3.2.194-beta`. **Erwartet:** ✓
2. Quelle „Sätze". Im Sätze-Sub-Block ist unten der neue Block
   „Hintergrund-Geräusch" sichtbar. Toggle steht auf „Aus", Geräusch-
   Dropdown und SNR-Buttons sind ausgegraut (opazität 0.5). SNR-Button
   „0" ist hervorgehoben. **Erwartet:** ✓
3. Play drücken: ein Satz spielt ohne Hintergrund (wie BA 192/193).
   **Erwartet:** ✓
4. Toggle auf „An": Geräusch-Dropdown wird klar (Opazität 1.0).
   Dropdown zeigt die drei generierten Rauscher (Weiß, Rosa, Braun);
   „Rosa Rauschen" ist vorausgewählt. **Erwartet:** ✓
5. Play drücken: derselbe Satz spielt jetzt mit Rosa Rauschen im
   Hintergrund. Bei SNR 0 dB sind beide etwa gleich laut wahrnehmbar.
   **Erwartet:** ✓
6. Während des Satzes SNR auf -10 dB klicken — Cache wird geleert.
   Nach Klick auf Stop und neuem Play: das Geräusch ist deutlich lauter
   relativ zum Satz. **Erwartet:** ✓
7. SNR auf +10 dB: das Geräusch ist deutlich leiser als die Sprache.
   **Erwartet:** ✓
8. Geräusch im Dropdown auf „Weisses Rauschen" wechseln, Play: das
   Geräusch ändert sich; bei SNR 0 dB ist die wahrgenommene Lautheit
   ungefähr vergleichbar zum Rosa Rauschen (Dank RMS-Normalisierung).
   **Erwartet:** ✓
9. 🔁 Loop an, Play: derselbe Satz wiederholt sich mit demselben
   Hintergrund. Pause-Wert (z. B. 500 ms) wirkt zwischen Wiederholungen.
   Hintergrund startet bei jeder Wiederholung von 0 — bei statischem
   Rauschen nicht auffällig. **Erwartet:** ✓
10. Loop aus, Auto-Advance an: bei jedem neuen Satz wird das Geräusch
    neu hinzugemischt. Hintergrund startet pro Satz bei 0.
    **Erwartet:** ✓
11. Save (JSON), Tool neu laden, Restore: Toggle, Geräusch-Wahl und
    SNR-Wert sind wiederhergestellt. **Erwartet:** ✓
12. Quelle auf „Musik" wechseln: der Hintergrund-Block ist nicht
    sichtbar (gehört zum Sätze-Sub-Block). Eine Musik-Datei spielt ohne
    Hintergrund-Mischung. **Erwartet:** ✓
13. Quelle auf „Geräusche" wechseln: die ausgewählte Geräusch-Quelle
    funktioniert unverändert (BA 193). Buffer-Cache aus `audio-source.js`
    funktioniert: bei zweiter Auswahl desselben Geräuschs kein neuer
    Generate-Lauf nötig (in der Konsole nur einmaliges Generate-Log).
    **Erwartet:** ✓

## Selbstprüfungsauftrag

Vor Fertigmeldung jeden der 13 Akzeptanzpunkte einzeln durchgehen und
**erfüllt / nicht erfüllt / unklar** mit Datei- und Zeilenangabe
melden. Zusätzlich prüfen:

- `js/audio-source.js`: enthält die neuen Funktionen `_amRms`,
  `_amNormalizeBufferRms`, `amGetItemBuffer`,
  `amGetNormalizedNoiseBuffer`, `amMixForeground`, `amMixCacheClear`.
  Cache-Verdrängung greift bei mehr als 8 Einträgen.
- `js/player.js`: `_plNoiseDecodedCache` ist entfernt;
  `plNoiseLoadSelected` ruft `amGetItemBuffer` auf.
- `js/sentences.js`: `sPlayCurrent` mischt Pre-Mix ein, **bevor**
  `sSentenceBuf` gesetzt und `pSetPlaybackMode("sentence")` aufgerufen
  wird.
- Mix-Fehler werfen keine Exceptions an die UI durch — Fallback auf
  unmischierten Satz, eine `console.warn`-Meldung in der Konsole.
- `js/version.js` enthält `"3.2.194-beta"`.

## Folge-Bauanleitungen

- **BA 195 (geplant):** Hörbuch-Quelle aktivieren — lokale Datei,
  lokaler Ordner mit Kapiteln, Kapitelliste.
- **BA 196+ (geplant):** Webspace-Manifest-Loader (Default-Root
  `http://ci-sound-balancing.honigburg.de/opus/`). Aktiviert echte
  Sample-Inhalte aus dem Webspace, ohne das UI in den späteren BAs zu
  ändern.
- **i18n-Folge-BA:** Übersetzungen `en.js`, `fr.js`, `es.js` für die
  in BA 192–194 neu eingeführten Keys nachziehen.
- **Sätze-Titel-Fix:** wird im Zuge der Sätze-Manifest-Umstellung in
  einer eigenen BA erledigt.
- **Cocktail-Party-Generator** (Idee in `docs/IDEEN.md`): mehrere
  parallele Sprach-Sources + Alltagsgeräusche dynamisch mischen.
